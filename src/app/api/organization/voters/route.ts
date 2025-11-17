import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service"; // Pastikan path ini benar

const prisma = new PrismaClient();

interface VoterWithVotes {
  id: number;
  username: string | null;
  email: string;
  role: "admin" | "organization" | "voter";
  status: "active" | "inactive" | "suspended";
  createdAt: Date;
  elections: {
    electionId: number;
    title: string;
    status: "DRAFT" | "ACTIVE" | "ENDED";
    votedAt: Date | null; // Diperbarui untuk memperbolehkan null
  }[];
}

export async function GET(request: NextRequest) {
  try {
    // ---------- Auth ----------
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = auth.verifyToken(token).payload;
    } catch {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    if (!decoded?.userId) return NextResponse.json({ success: false, message: "Invalid token payload" }, { status: 401 });

    const userId = typeof decoded.userId === "string" ? parseInt(decoded.userId, 10) : decoded.userId;
    if (isNaN(userId)) return NextResponse.json({ success: false, message: "Invalid user ID in token" }, { status: 401 });

    // Verifikasi bahwa user adalah Organisasi
    const orgUser = await prisma.user.findUnique({
      where: { id: userId, role: "ORGANIZATION" }
    });
    if (!orgUser) {
      return NextResponse.json({ success: false, message: "Organization access required" }, { status: 403 });
    }

    // ---------- Logika Revisi Total (Manual Join) ----------
    // Ini diperlukan karena skema Prisma Anda tampaknya tidak memiliki relasi
    // yang terdefinisi antara 'User' dan 'UserElectionParticipation'.

    // 1. Ambil semua ID election milik organisasi ini
    const orgElections = await prisma.election.findMany({
      where: { organizationId: userId },
      select: { id: true, title: true, status: true }, // Ambil detail yang kita perlukan sekarang
    });

    if (orgElections.length === 0) {
      // Organisasi ini tidak punya election, berarti tidak ada voter
      return NextResponse.json({ success: true, data: [] });
    }
    
    // Buat Map untuk lookup cepat
    const orgElectionIds = orgElections.map(e => e.id);
    const electionMap = new Map(orgElections.map(e => [e.id, { title: e.title, status: e.status }]));

    // 2. Ambil semua data partisipasi yang relevan
    const participations = await prisma.userElectionParticipation.findMany({
      where: {
        electionId: { in: orgElectionIds },
        // HAPUS: NOT: { userId: null } <-- Dihapus karena 'userId' sepertinya non-nullable (Int)
        // Jika userId BISA null, ini akan gagal, tapi error TypeScript menyarankan ini non-nullable.
      }
    });

    // 3. Ambil semua ID user unik dari partisipasi
    // Hapus '!' karena kita asumsikan non-nullable
    const userIds = [...new Set(participations.map(p => p.userId))]; 

    if (userIds.length === 0) {
      // Tidak ada user yang berpartisipasi
      return NextResponse.json({ success: true, data: [] });
    }

    // 4. Ambil data untuk semua user tersebut
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      }
    });
    // Buat Map user untuk lookup cepat
    const userMap = new Map(users.map(u => [u.id, u]));

    // 5. Gabungkan data secara manual
    const voterMap: Record<number, VoterWithVotes> = {};

    for (const p of participations) {
      // Hapus '!'
      const user = userMap.get(p.userId); 
      const election = electionMap.get(p.electionId);

      // Lewati jika karena alasan aneh data user atau election tidak ditemukan
      if (!user || !election) continue;

      // Jika ini pertama kalinya kita melihat user ini, inisialisasi data mereka
      if (!voterMap[user.id]) {
        voterMap[user.id] = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role.toLowerCase() as "admin" | "organization" | "voter",
          status: user.status.toLowerCase() as "active" | "inactive" | "suspended",
          createdAt: user.createdAt,
          elections: [], // Mulai dengan daftar election kosong
        };
      }

      // Tambahkan data election ke daftar partisipasi user
      voterMap[user.id].elections.push({
        electionId: p.electionId,
        title: election.title,
        status: election.status as "DRAFT" | "ACTIVE" | "ENDED",
        votedAt: p.votedAt,
      });
    }

    const voters: VoterWithVotes[] = Object.values(voterMap);
    
    // Urutkan (opsional, tapi bagus)
    voters.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // ---------- Audit ----------
    try {
      await AuditService.createAuditLog(
        userId,
        "VIEW",
        "VOTER_LIST",
        undefined,
        "Viewed list of registered voters",
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        request.headers.get("user-agent") || "unknown"
      );
    } catch (e) {
      console.error("Audit log failed:", e);
    }

    return NextResponse.json({ success: true, data: voters });

  } catch (error) {
    console.error("Error fetching organization voters:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", error: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}