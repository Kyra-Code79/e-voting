import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";

const prisma = new PrismaClient();

interface ElectionStatistic {
  electionId: number;
  totalRegisteredVoters: number;
  totalVotesCast: number;
  participationRate: number;
  election: {
    title: string;
    status: string;
    startDate: Date;
    endDate: Date;
  };
}

interface RecentElection {
  id: number;
  title: string;
  status: string;
  startDate: Date;
  endDate: Date;
  candidateCount: number;
  voterCount: number;
  voteCount: number;
  participationRate: number;
}

interface MostActiveElection {
  id: number;
  title: string;
  voteCount: number;
}

/**
 * GET /api/organization/stats
 * Get statistics for the authenticated organization
 */
export async function GET(request: NextRequest) {
  try {
    // ---------- Auth ----------
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = auth.verifyToken(token).payload;
    } catch (error) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    if (!decoded || !decoded.userId) return NextResponse.json({ success: false, message: "Invalid token payload" }, { status: 401 });

    const userId = typeof decoded.userId === "string" ? parseInt(decoded.userId, 10) : decoded.userId;
    if (isNaN(userId)) return NextResponse.json({ success: false, message: "Invalid user ID in token" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    if (user.role !== "ORGANIZATION") return NextResponse.json({ success: false, message: "Organization access required" }, { status: 403 });

    // ---------- Stats (Efficient Calculation) ----------

    const totalElections = await prisma.election.count({ where: { organizationId: user.id } });
    const activeElections = await prisma.election.count({ where: { organizationId: user.id, status: "ACTIVE" } });
    const draftElections = await prisma.election.count({ where: { organizationId: user.id, status: "DRAFT" } });
    const endedElections = await prisma.election.count({ where: { organizationId: user.id, status: "ENDED" } });

    // ---------- Election Statistics (Fetch this first, as it's the source of truth) ----------

    let electionStatistics: ElectionStatistic[] = [];
    try {
      // Data ini diambil dari ElectionStatistics yang biasanya sudah terhitung sebelumnya
      electionStatistics = await prisma.electionStatistics.findMany({
        where: { election: { organizationId: user.id } },
        include: { election: { select: { title: true, status: true, startDate: true, endDate: true } } },
      });
      // Normalisasi participation rate (karena Prisma/DB mungkin menyimpan sebagai desimal 0-1)
      // JSON Anda menunjukkan 37.5 dan 83.3, jadi kita asumsikan data sudah 0-100 atau dikali 100.
      // Mari kita pastikan kita mengalikannya jika itu desimal.
      electionStatistics = electionStatistics.map(stat => ({
        ...stat,
        // Jika participationRate > 1, asumsikan sudah 0-100. Jika 0-1, kalikan 100.
        participationRate: stat.participationRate <= 1 ? stat.participationRate * 100 : stat.participationRate
      }));
    } catch (e) { console.error("Error fetching election statistics:", e); }

    // ---------- Calculate Totals FROM Statistics ----------
    
    // Gunakan data statistik yang sudah di-fetch sebagai sumber kebenaran
    // const totalVoters = electionStatistics.reduce((sum, stat) => sum + stat.totalRegisteredVoters, 0); // <-- Logika LAMA (SUM)
    
    // Logika BARU: Ambil nilai voters terbanyak dari salah satu election, sesuai permintaan
    const totalVoters = Math.max(0, ...electionStatistics.map(stat => stat.totalRegisteredVoters));
    
    // totalVotes tetap SUM dari semua election
    const totalVotes = electionStatistics.reduce((sum, stat) => sum + stat.totalVotesCast, 0);
    
    // --- Perhitungan BARU untuk Participation Rate ---
    // Ambil TOTAL gabungan pemilih (SUM) HANYA untuk perhitungan rate
    const totalVotersForRateCalc = electionStatistics.reduce((sum, stat) => sum + stat.totalRegisteredVoters, 0); // e.g., 14

    // Hitung 'averageParticipation' menggunakan SUM votes / SUM voters (gabungan)
    const participationRate = totalVotersForRateCalc > 0 ? (totalVotes / totalVotersForRateCalc) * 100 : 0; // e.g., (8/14) * 100 = 57.14%


    // ---------- Recent Elections ----------
    const recentElections: RecentElection[] = [];
    try {
      const recent = await prisma.election.findMany({
        where: { organizationId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { candidates: true, _count: { select: { votes: true } } },
      });

      for (const election of recent) {
        // HAPUS kueri N+1: const voterCount = await prisma.electionVoter.count({ where: { electionId: election.id } });
        
        // GANTI dengan mencari data dari electionStatistics yang sudah kita fetch
        const stat = electionStatistics.find(s => s.electionId === election.id);

        const voterCount = stat ? stat.totalRegisteredVoters : 0;
        const voteCount = stat ? stat.totalVotesCast : election._count.votes; // Gunakan stat jika ada
        const participationRate = stat ? stat.participationRate : 0; // Gunakan stat jika ada

        recentElections.push({
          id: election.id,
          title: election.title,
          status: election.status,
          startDate: election.startDate,
          endDate: election.endDate,
          candidateCount: election.candidates.length,
          voterCount,
          voteCount: voteCount, // Diperbarui dari stat
          participationRate: voterCount > 0 ? Math.round((voteCount / voterCount) * 100 * 100) / 100 : 0, // Kalkulasi ulang untuk konsistensi, atau gunakan stat.participationRate
        });
      }
    } catch (e) { console.error("Error fetching recent elections:", e); }


    // ---------- Recent Votes (Past 30 days) ----------
    let recentVotes = 0;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      recentVotes = await prisma.vote.count({
        where: { election: { organizationId: user.id }, votedAt: { gte: thirtyDaysAgo } },
      });
    } catch (e) { console.error("Error counting recent votes:", e); }


    // ---------- Most Active Election ----------
    let mostActiveElection: MostActiveElection | null = null;
    try {
      const electionsWithVotes = await prisma.election.findMany({
        where: { organizationId: user.id },
        include: { _count: { select: { votes: true } } },
      });
      if (electionsWithVotes.length > 0) {
        // Sort in memory to find the top one
        const sorted = electionsWithVotes.sort((a, b) => b._count.votes - a._count.votes);
        const top = sorted[0];
        if (top && top._count.votes > 0) mostActiveElection = { id: top.id, title: top.title, voteCount: top._count.votes };
      }
    } catch (e) { console.error("Error fetching most active election:", e); }


    // ---------- Prepare Response ----------
    const statsData = {
      totalElections,
      activeElections,
      draftElections,
      endedElections,
      totalVotes,
      totalVoters,
      // Pembulatan rata-rata partisipasi
      averageParticipation: Math.round(participationRate * 100) / 100,
      recentVotes,
      electionBreakdown: { draft: draftElections, active: activeElections, ended: endedElections },
      recentElections,
      performance: {
        mostActiveElection,
        averageVotesPerElection: totalElections > 0 ? Math.round((totalVotes / totalElections) * 100) / 100 : 0,
        totalEngagement: totalVoters + totalVotes, // Total Registered Slots + Total Votes
      },
      detailedStatistics: electionStatistics.map(stat => ({
        electionId: stat.electionId,
        electionTitle: stat.election.title,
        electionStatus: stat.election.status,
        totalRegisteredVoters: stat.totalRegisteredVoters,
        totalVotesCast: stat.totalVotesCast,
        participationRate: stat.participationRate, // Sudah dinormalisasi di atas
        startDate: stat.election.startDate,
        endDate: stat.election.endDate,
      })),
      lastUpdated: new Date().toISOString(),
    };


    // ---------- Audit ----------
    try {
      await AuditService.createAuditLog(
        user.id,
        "VIEW",
        "ORGANIZATION_STATS",
        undefined,
        "Viewed organization statistics dashboard",
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        request.headers.get("user-agent") || "unknown"
      );
    } catch (e) { console.error("Audit log failed:", e); }


    return NextResponse.json({ success: true, data: statsData });


  } catch (error) {
    console.error("Error fetching organization statistics:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", error: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}