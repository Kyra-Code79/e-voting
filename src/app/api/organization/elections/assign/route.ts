import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // 1. Auth & Validation
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    let decoded;
    try {
        decoded = auth.verifyToken(token).payload;
    } catch (e) {
        return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }
    
    if (!decoded || !decoded.userId) {
        return NextResponse.json({ success: false, message: "Invalid token payload" }, { status: 401 });
    }

    const userId = typeof decoded.userId === 'string' ? parseInt(decoded.userId, 10) : decoded.userId;

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

    // 4. FILTER LOGIC (Mencegah Duplikasi)
    const existingParticipations = await prisma.userElectionParticipation.findMany({
        where: {
            electionId: electionId,
            userId: { in: voterIds }
        },
        select: { userId: true }
    });

    const existingUserIds = new Set(existingParticipations.map(p => p.userId));
    const newVoterIds = voterIds.filter((id: number) => !existingUserIds.has(id));

    let count = 0;

    // 5. INSERT LOGIC (FIXED)
    if (newVoterIds.length > 0) {
        const result = await prisma.userElectionParticipation.createMany({
            data: newVoterIds.map((vid: number) => ({
                electionId: electionId,
                userId: vid,
                inviteStatus: 'PENDING', // PERBAIKAN: Gunakan HURUF BESAR sesuai Enum Prisma
                invitedAt: new Date(),   
                hasVoted: false,
                // Pastikan properti lain sesuai schema Anda
            })),
        });
        count = result.count;
    }

    // 6. Update statistics
    const totalParticipants = await prisma.userElectionParticipation.count({
        where: { electionId: electionId }
    });

    await prisma.electionStatistics.updateMany({
        where: { electionId: electionId },
        data: { totalRegisteredVoters: totalParticipants }
    });

    // Audit Log
    if (count > 0) {
        try {
            await AuditService.createAuditLog(
                userId, "UPDATE", "ELECTION_VOTERS", electionId, 
                `Assigned ${count} new voters to election ${election.title}`,
                request.headers.get("x-forwarded-for") || "unknown",
                request.headers.get("user-agent") || "unknown"
            );
        } catch (auditError) {
            console.error("Audit log failed", auditError);
        }
    }

    return NextResponse.json({ 
      success: true, 
      message: count > 0 ? `Successfully assigned ${count} voters` : "All selected voters are already assigned",
      count: count
    });

  } catch (error) {
    console.error("Assign error:", error);
    return NextResponse.json({ 
        success: false, 
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}