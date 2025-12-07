import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";
import { BlockchainService } from "@/lib/blockchain/blockchain.service";
import { log } from "@/utils/logger";
import { z } from "zod";

const prisma = new PrismaClient();

const voteSchema = z.object({
  electionId: z.number().int().positive(),
  candidateId: z.number().int().positive(),
  signature: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const authHeader = request.headers.get("authorization");
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const tokenResult = auth.verifyToken(token);
    if (!tokenResult.isValid || !tokenResult.payload?.userId) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const userId = parseInt(tokenResult.payload.userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || (user.role as string).toLowerCase() !== "voter") {
      return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
    }

    // 2. Validate Request
    const body = await request.json();
    const validation = voteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, message: "Invalid data" }, { status: 400 });
    }

    const { electionId, candidateId, signature } = validation.data;

    // 3. Check Election & Status
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: { candidates: true }
    });

    if (!election) return NextResponse.json({ success: false, message: "Election not found" }, { status: 404 });
    
    if (election.status !== "ACTIVE") {
        return NextResponse.json({ success: false, message: "Election is not active" }, { status: 400 });
    }

    const candidate = election.candidates.find(c => c.id === candidateId);
    if (!candidate) return NextResponse.json({ success: false, message: "Candidate not found" }, { status: 404 });

    // 4. Eligibility Check
    const publicVoter = await prisma.electionVoter.findFirst({
        where: { electionId, email: user.email }
    });
    const privateParticipation = await prisma.userElectionParticipation.findUnique({
        where: { userId_electionId: { userId, electionId } }
    });

    const isAllowed = !!publicVoter || (privateParticipation && privateParticipation.inviteStatus === "ACCEPTED");

    if (!isAllowed) {
        return NextResponse.json({ success: false, message: "You are not registered or haven't accepted the invite." }, { status: 403 });
    }

    // 5. Double Vote Check
    if (publicVoter?.hasVoted || privateParticipation?.hasVoted) {
        return NextResponse.json({ success: false, message: "You have already voted." }, { status: 400 });
    }

    // 6. Execute Blockchain Vote
    const blockchain = BlockchainService.getInstance();
    
    // Pass empty signature if null; Service will now handle auto-signing
    const transaction = await blockchain.addVoteToElection(
      electionId,
      { candidateId, timestamp: new Date().toISOString() },
      user.publicKey || "", 
      signature || "" 
    );

    // 7. Update Database
    const vote = await prisma.vote.create({
      data: {
        electionId,
        voterId: userId,
        blockHash: transaction.blockHash,
        transactionHash: transaction.hash,
        votedAt: new Date(),
      }
    });

    // Update flags
    if (publicVoter) await prisma.electionVoter.update({ where: { id: publicVoter.id }, data: { hasVoted: true } });
    if (privateParticipation) await prisma.userElectionParticipation.update({ where: { id: privateParticipation.id }, data: { hasVoted: true, votedAt: new Date() } });

    // Update stats
    await prisma.electionStatistics.upsert({
        where: { electionId },
        create: { electionId, totalVotesCast: 1 },
        update: { totalVotesCast: { increment: 1 } }
    });

    // Audit Log
    try {
        await AuditService.createAuditLog(
            userId, "VOTE_CAST", "VOTE", vote.id, 
            `Voted for candidate ${candidateId}`, 
            request.headers.get("x-forwarded-for") || "unknown", 
            request.headers.get("user-agent") || "unknown"
        );
    } catch {}

    log.info("Vote cast successfully", "VOTER_VOTE", { userId, electionId, voteId: vote.id });

    return NextResponse.json({
      success: true,
      message: "Vote cast successfully",
      data: {
        voteId: vote.id,
        blockHash: vote.blockHash,
        transactionHash: vote.transactionHash
      }
    });

  } catch (error) {
    console.error("Vote Error:", error);
    const errMsg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, message: errMsg }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}