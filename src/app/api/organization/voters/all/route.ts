import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // 1. Auth Check
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    try {
        auth.verifyToken(token);
    } catch {
        return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    // 2. Cek Query Param electionId
    const { searchParams } = new URL(request.url);
    const electionIdParam = searchParams.get("electionId");

    // 3. Ambil semua potential voters
    const potentialVoters = await prisma.user.findMany({
      where: {
        role: "VOTER",
        status: "ACTIVE"
      },
      select: {
        id: true,
        username: true,
        email: true
      }
    });

    // 4. Jika electionId ada, cek status assigned
    if (electionIdParam) {
        const electionId = parseInt(electionIdParam);
        
        // Ambil ID voter yang SUDAH terdaftar di election ini
        const existingParticipations = await prisma.userElectionParticipation.findMany({
            where: { electionId: electionId },
            select: { userId: true }
        });

        const assignedUserIds = new Set(existingParticipations.map(p => p.userId));

        // Map data voter + status isAssigned
        const votersWithStatus = potentialVoters.map(v => ({
            ...v,
            isAssigned: assignedUserIds.has(v.id)
        }));

        return NextResponse.json({ success: true, data: votersWithStatus });
    }

    // Jika tidak ada electionId, kembalikan data polos
    return NextResponse.json({ success: true, data: potentialVoters });

  } catch (error) {
    console.error("Error fetching voters:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}