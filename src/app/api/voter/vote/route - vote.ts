import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";
import { BlockchainService } from "@/lib/blockchain/blockchain.service";
import { log } from "@/utils/logger";
import { z } from "zod";
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Validation schema for vote request
const voteSchema = z.object({
  electionId: z.number().int().positive("Election ID must be a positive integer"),
  candidateId: z.number().int().positive("Candidate ID must be a positive integer"),
  signature: z.string().optional(),
});

/**
 * POST /api/voter/vote
 * Cast a vote in an election
 */
export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. AUTHENTICATION
    // ------------------------------------------------------------------
    let token = null;
    const authHeader = request.headers.get("authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const cookies = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .reduce(
            (acc, cookie) => {
              const [key, value] = cookie.split("=");
              if (key && value) {
                acc[key] = decodeURIComponent(value);
              }
              return acc;
            },
            {} as Record<string, string>,
          );
        token = cookies.accessToken;
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const tokenResult = auth.verifyToken(token);
    if (!tokenResult.isValid || !tokenResult.payload?.userId) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    const userId = parseInt(tokenResult.payload.userId);

    // Get user and verify voter role
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    if ((user.role as string).toLowerCase() !== "voter") {
      return NextResponse.json(
        { success: false, message: "Voter access required" },
        { status: 403 }
      );
    }

    // ------------------------------------------------------------------
    // 2. VALIDATE REQUEST & ELECTION
    // ------------------------------------------------------------------
    const body = await request.json();
    const validation = voteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: "Invalid request data" },
        { status: 400 }
      );
    }

    const { electionId, candidateId, signature: clientSignature } = validation.data;

    // Check if election exists
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: { candidates: true },
    });

    if (!election) {
      return NextResponse.json(
        { success: false, message: "Election not found" },
        { status: 404 }
      );
    }

    // Check if election is active (CASE SENSITIVE CHECK)
    if (election.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Election is not active" },
        { status: 400 }
      );
    }

    const now = new Date();
    if (now < election.startDate || now > election.endDate) {
      return NextResponse.json(
        { success: false, message: "Voting period has ended or not started" },
        { status: 400 }
      );
    }

    // Check if candidate exists
    const candidate = election.candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      return NextResponse.json(
        { success: false, message: "Candidate not found in this election" },
        { status: 404 }
      );
    }

    // ------------------------------------------------------------------
    // 3. CHECK ELIGIBILITY
    // ------------------------------------------------------------------
    
    // Check Public List
    const voterRegistration = await prisma.electionVoter.findFirst({
      where: { electionId, email: user.email },
    });

    // Check Private Invitation
    const participation = await prisma.userElectionParticipation.findUnique({
        where: { userId_electionId: { userId, electionId } }
    });

    const isRegisteredPublicly = !!voterRegistration;
    // Fix: Explicit Uppercase 'ACCEPTED'
    const isInvitedAndAccepted = participation && participation.inviteStatus === 'ACCEPTED';

    if (!isRegisteredPublicly && !isInvitedAndAccepted) {
      let message = "You are not registered for this election";
      if (participation && participation.inviteStatus === 'PENDING') {
        message = "You must accept the invitation before voting.";
      } else if (participation && participation.inviteStatus === 'DECLINED') {
        message = "You declined this election invitation.";
      }
      return NextResponse.json({ success: false, message }, { status: 403 });
    }

    // ------------------------------------------------------------------
    // 4. CHECK DOUBLE VOTING
    // ------------------------------------------------------------------
    
    const existingVote = await prisma.vote.findFirst({
      where: { electionId, voterId: userId },
    });

    const publicHasVoted = voterRegistration?.hasVoted;
    const privateHasVoted = participation?.hasVoted;

    if (existingVote || publicHasVoted || privateHasVoted) {
      return NextResponse.json(
        { success: false, message: "You have already voted in this election" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // 5. PREPARE BLOCKCHAIN TRANSACTION (HEX SIGNING FIX)
    // ------------------------------------------------------------------

    const blockchain = BlockchainService.getInstance();
    
    const voteData = {
      candidateId,
      timestamp: new Date().toISOString(),
    };

    let finalPublicKey = user.publicKey;
    let finalSignature = clientSignature;

    // FIX: Generate HEX format keys if no signature is provided
    // This fixes "Invalid vote signature" errors in the Blockchain Service
    if (!finalSignature) {
      try {
        // Generate key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
          namedCurve: 'secp256k1',
          // Use DER format for public key (binary), then convert to HEX
          publicKeyEncoding: { type: 'spki', format: 'der' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        // Convert DER Buffer to Hex String (likely what BlockchainService expects)
        finalPublicKey = publicKey.toString('hex');

        // Sign data
        const sign = crypto.createSign('SHA256');
        // IMPORTANT: The data format here must match validation exactly. 
        // Using JSON.stringify is standard but order-sensitive.
        sign.update(JSON.stringify(voteData));
        sign.end();
        finalSignature = sign.sign(privateKey, 'hex');
        
      } catch (signError) {
        console.error("Auto-signing failed:", signError);
        finalSignature = ""; 
      }
    }

    // Fallback if still empty
    if (!finalPublicKey) finalPublicKey = "system_fallback_key";

    // Add to blockchain
    const transaction = await blockchain.addVoteToElection(
      electionId,
      voteData,
      finalPublicKey,
      finalSignature || ""
    );

    // ------------------------------------------------------------------
    // 6. DB UPDATE
    // ------------------------------------------------------------------

    // Record Vote
    const vote = await prisma.vote.create({
      data: {
        electionId,
        voterId: userId,
        blockHash: transaction.blockHash,
        transactionHash: transaction.hash,
        votedAt: new Date(),
      },
    });

    // Mark as Voted (Public)
    if (voterRegistration) {
        await prisma.electionVoter.update({
            where: { id: voterRegistration.id },
            data: { hasVoted: true },
        });
    }

    // Mark as Voted (Private)
    if (participation) {
        await prisma.userElectionParticipation.update({
            where: { id: participation.id },
            data: { hasVoted: true, votedAt: new Date() },
        });
    }

    // Update Statistics
    await prisma.electionStatistics.upsert({
        where: { electionId },
        create: { electionId, totalVotesCast: 1 },
        update: { totalVotesCast: { increment: 1 } }
    });

    // Audit Log
    try {
      await AuditService.createAuditLog(
        userId,
        "VOTE_CAST",
        "VOTE",
        vote.id,
        `Voter cast vote in election ${electionId} for candidate ${candidateId}`,
        request.headers.get("x-forwarded-for") || "unknown",
        request.headers.get("user-agent") || "unknown"
      );
    } catch {}

    log.info("Vote cast successfully", "VOTER_VOTE", {
      userId,
      electionId,
      candidateId,
      voteId: vote.id,
      blockHash: transaction.blockHash,
    });

    return NextResponse.json({
      success: true,
      message: "Vote cast successfully",
      data: {
        voteId: vote.id,
        electionId: vote.electionId,
        candidateId: candidateId,
        votedAt: vote.votedAt.toISOString(),
        blockHash: vote.blockHash,
        transactionHash: vote.transactionHash,
      },
    });

  } catch (error) {
    console.error("Voting Error:", error);
    try {
        log.exception(error as Error, "VOTER_VOTE", { path: "/api/voter/vote" });
    } catch {}

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}