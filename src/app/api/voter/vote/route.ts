import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";
import { BlockchainService } from "@/lib/blockchain/blockchain.service";
import { log } from "@/utils/logger";
import { z } from "zod";

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
    // Get token from cookie or header
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
        {
          success: false,
          message: tokenResult.expired ? "Token expired" : "Invalid token",
        },
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

    // FIX 1: Handle Enum vs String comparison error
    // We cast to string to compare safely, assuming 'voter' or 'VOTER' 
    // Adjust "voter" to match your Enum value in schema.prisma (likely "VOTER")
    if ((user.role as string).toLowerCase() !== "voter") {
      return NextResponse.json(
        { success: false, message: "Voter access required" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = voteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { electionId, candidateId, signature } = validation.data;

    // Check if election exists
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: {
            orderBy: { id: 'asc' }
        },
      },
    });

    if (!election) {
      return NextResponse.json(
        { success: false, message: "Election not found" },
        { status: 404 }
      );
    }

    // Check if election is active
    const now = new Date();
    const isActive = election.status.toLowerCase() === "active";
    
    if (!isActive) {
      return NextResponse.json(
        { success: false, message: "Election is not active" },
        { status: 400 }
      );
    }

    if (now < election.startDate || now > election.endDate) {
      return NextResponse.json(
        { success: false, message: "Voting period has ended or not started" },
        { status: 400 }
      );
    }

    // Check if candidate exists in this election
    const candidate = election.candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      return NextResponse.json(
        { success: false, message: "Candidate not found in this election" },
        { status: 404 }
      );
    }

    // Check if voter is registered
    const voterRegistration = await prisma.electionVoter.findFirst({
      where: {
        electionId,
        email: user.email,
      },
    });

    const participation = await prisma.userElectionParticipation.findUnique({
        where: { userId_electionId: { userId, electionId } }
    });

    if (!voterRegistration && !participation) {
      return NextResponse.json(
        { success: false, message: "You are not registered for this election" },
        { status: 403 }
      );
    }

    // Check if voter has already voted
    const existingVote = await prisma.vote.findFirst({
      where: {
        electionId,
        voterId: userId,
      },
    });

    if (existingVote) {
      return NextResponse.json(
        { success: false, message: "You have already voted in this election" },
        { status: 400 }
      );
    }

    // Create the vote with blockchain transaction
    const blockchain = BlockchainService.getInstance();
    
    // Create vote transaction data
    const voteData = {
      candidateId,
      timestamp: new Date().toISOString(),
    };

    // Add vote to blockchain
    const transaction = await blockchain.addVoteToElection(
      electionId,
      voteData,
      user.publicKey || "", 
      signature || ""
    );

    // Create vote record in database
    const vote = await prisma.vote.create({
      data: {
        electionId,
        voterId: userId,
        blockHash: transaction.blockHash,
        transactionHash: transaction.hash,
        votedAt: new Date(),
        // NOTE: Ensure your prisma schema 'Vote' model has a candidateId field if you want to store it.
        // If not, this line will fail. If it's missing in schema, remove this line.
        // candidateId: candidateId, 
      },
    });

    // Update voter registration (if exists)
    if (voterRegistration) {
        // FIX 2: 'votedAt' error. 
        // If your ElectionVoter model doesn't have 'votedAt', you must add it to schema.prisma
        // Or use 'status: "voted"' if that's how you track it.
        // Assuming you will update Schema:
        await prisma.electionVoter.update({
            where: { id: voterRegistration.id },
            data: {
               
                votedAt: new Date(),
            },
        });
    }

    // Update user election participation (if exists)
    if (participation) {
        await prisma.userElectionParticipation.update({
        where: { id: participation.id },
        data: {
            hasVoted: true,
            votedAt: new Date(),
        },
        });
    }

    // Create audit log
    await AuditService.createAuditLog(
      userId,
      "VOTE_CAST",
      "VOTE",
      vote.id,
      `Voter cast vote in election ${electionId} for candidate ${candidateId}`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown"
    );

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
        // FIX 3: Use the local 'candidateId' variable instead of 'vote.candidateId'
        // because 'vote' (from prisma) doesn't have candidateId in your current schema types
        candidateId: candidateId,
        votedAt: vote.votedAt.toISOString(),
        blockHash: vote.blockHash,
        transactionHash: vote.transactionHash,
      },
    });
  } catch (error) {
    console.error("Voting Error:", error);
    try {
        log.exception(error as Error, "VOTER_VOTE", {
        path: "/api/voter/vote",
        });
    } catch {}

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}