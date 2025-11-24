import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // 1. Auth & Validation
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ success: false }, { status: 401 });
    
    const token = authHeader.substring(7);
    const decoded = auth.verifyToken(token).payload;
    const userId = typeof decoded.userId === 'string' ? parseInt(decoded.userId) : decoded.userId;

    // 2. Parse Body
    const { electionId, voterIds } = await request.json();

    if (!electionId || !voterIds || !Array.isArray(voterIds)) {
      return NextResponse.json({ success: false, message: "Invalid data" }, { status: 400 });
    }

    // 3. Pastikan Election milik Organization ini
    const election = await prisma.election.findFirst({
      where: { id: electionId, organizationId: userId }
    });

    if (!election) {
      return NextResponse.json({ success: false, message: "Election not found or unauthorized" }, { status: 404 });
    }

    // 4. Lakukan Assign (Insert ke UserElectionParticipation)
    // Kita gunakan createMany (jika DB support) atau loop.
    // Kita perlu handle duplikat (skipDuplicates: true) agar tidak error jika sudah di-assign
    
    // Catatan: Pastikan schema prisma Anda memiliki model UserElectionParticipation
    const result = await prisma.userElectionParticipation.createMany({
      data: voterIds.map((vid: number) => ({
        electionId: electionId,
        userId: vid,
        // votedAt biarkan null (default)
      })),
      skipDuplicates: true, 
    });

    // 5. Update statistik total registered voters
    // Hitung total partisipan sekarang
    const totalParticipants = await prisma.userElectionParticipation.count({
        where: { electionId: electionId }
    });

    await prisma.electionStatistics.updateMany({
        where: { electionId: electionId },
        data: { totalRegisteredVoters: totalParticipants }
    });

    // Audit Log
    await AuditService.createAuditLog(
        userId, "UPDATE", "ELECTION_VOTERS", electionId, 
        `Assigned ${result.count} voters to election ${election.title}`,
        request.headers.get("x-forwarded-for") || "unknown",
        request.headers.get("user-agent") || "unknown"
    );

    return NextResponse.json({ 
      success: true, 
      message: `Successfully assigned ${result.count} voters`,
      count: result.count
    });

  } catch (error) {
    console.error("Assign error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}