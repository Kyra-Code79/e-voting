import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, UserElectionParticipation } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";

const prisma = new PrismaClient();

/**
 * GET /api/voter/elections
 * Get elections available to the authenticated voter
 */
export async function GET(request: NextRequest) {
  try {
    // ---------- Auth ----------
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = auth.verifyToken(token).payload;
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 },
      );
    }
    

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Invalid token payload" },
        { status: 401 },
      );
    }

    const userId = parseInt(decoded.userId, 10);
    if (isNaN(userId)) {
        return NextResponse.json(
            { success: false, message: "Invalid user ID" },
            { status: 401 },
        );
    }

    // Get user and verify voter role
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== "VOTER") {
      return NextResponse.json(
        { success: false, message: "Voter access required" },
        { status: 403 },
      );
    }

    // --- REFAKTOR UNTUK EFISIENSI ---
    // 1. Dapatkan semua partisipasi (dan data election terkait) dalam SATU kueri
    //    Ini menggantikan loop N+1 dan logika `ElectionVoter` yang lama.
    const participations = await prisma.userElectionParticipation.findMany({
      where: {
        userId: user.id,
      },
      include: {
        election: {
          include: {
            candidates: {
              orderBy: { id: "asc" },
            },
            organization: {
              select: { username: true, email: true },
            },
          },
        },
      },
    });

    // 2. Map hasil, tidak perlu kueri tambahan di dalam loop
    const now = new Date();
    const electionsWithVoteStatus = participations.map((participation) => {
      const { election } = participation;

      // Status vote diambil langsung dari data partisipasi
      const hasVotedStatus = participation.hasVoted;
      const votedAt = participation.votedAt;

      // Tentukan apakah voter bisa memilih
      const canVote =
        !hasVotedStatus &&
        election.status === "ACTIVE" &&
        now >= new Date(election.startDate) &&
        now <= new Date(election.endDate);

      // Hitung sisa waktu
      const remainingTime =
        election.status === "ACTIVE" && now < new Date(election.endDate)
          ? Math.max(0, new Date(election.endDate).getTime() - now.getTime())
          : 0;

      return {
        id: election.id,
        title: election.title,
        description: election.description,
        status: election.status,
        startDate: election.startDate.toISOString(),
        endDate: election.endDate.toISOString(),
        organizationId: election.organizationId,
        organization: election.organization,
        candidates: election.candidates,
        hasVoted: hasVotedStatus,
        votedAt: votedAt?.toISOString(),
        canVote,
        remainingTime,
        voterRegistrationId: participation.id, // Ini adalah ID partisipasi
      };
    });

    // --- LOGIKA SORTING BARU SESUAI PERMINTAAN ---
    // Buat Peta urutan status
    const statusOrder = {
      "ACTIVE": 1,
      "DRAFT": 2,
      "ENDED": 3,
    };

    const sortedElections = electionsWithVoteStatus.sort((a, b) => {
      // Dapatkan nilai urutan; default ke 99 jika status tidak diketahui
      const orderA = statusOrder[a.status as keyof typeof statusOrder] || 99;
      const orderB = statusOrder[b.status as keyof typeof statusOrder] || 99;

      // 1. Urutkan berdasarkan status
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // 2. Jika status sama, urutkan berdasarkan tanggal mulai (terbaru dulu)
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    // Create audit log
    await AuditService.createAuditLog(
      user.id,
      "VIEW",
      "VOTER_ELECTIONS",
      undefined,
      `Viewed ${sortedElections.length} available elections`,
      request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    return NextResponse.json({
      success: true,
      data: sortedElections,
    });
  } catch (error) {
    console.error("Error fetching voter elections:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}