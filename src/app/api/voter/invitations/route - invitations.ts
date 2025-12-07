/**
 * Voter Invitations API Route for BlockVote
 * POST /api/voter/invitations - Respond to election invitations (accept/decline)
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";
import { log } from "@/utils/logger";
import { z } from "zod";

const prisma = new PrismaClient();

// Validation schema for invitation response
const invitationResponseSchema = z.object({
  participationId: z.number().int().positive("Participation ID must be a positive integer"),
  action: z.enum(["accept", "decline"], {
    errorMap: () => ({ message: "Action must be either 'accept' or 'decline'" }),
  }),
});

/**
 * POST /api/voter/invitations
 * Respond to an election invitation (accept or decline)
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

    if (user.role !== "voter") {
      return NextResponse.json(
        { success: false, message: "Voter access required" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = invitationResponseSchema.safeParse(body);

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

    const { participationId, action } = validation.data;

    // Find the participation record
    const participation = await prisma.userElectionParticipation.findUnique({
      where: { id: participationId },
      include: {
        election: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!participation) {
      return NextResponse.json(
        { success: false, message: "Invitation not found" },
        { status: 404 }
      );
    }

    // Verify the invitation belongs to the current user
    if (participation.userId !== userId) {
      return NextResponse.json(
        { success: false, message: "You can only respond to your own invitations" },
        { status: 403 }
      );
    }

    // Check if already responded
    if (participation.inviteStatus !== "pending") {
      return NextResponse.json(
        { 
          success: false, 
          message: `You have already ${participation.inviteStatus} this invitation` 
        },
        { status: 400 }
      );
    }

    // Update participation status
    const inviteStatus = action === "accept" ? "accepted" : "declined";
    const updatedParticipation = await prisma.userElectionParticipation.update({
      where: { id: participationId },
      data: {
        inviteStatus,
        respondedAt: new Date(),
      },
    });

    // If accepted, ensure voter is registered in election_voters table
    if (action === "accept") {
      // Check if voter registration already exists
      const existingVoterReg = await prisma.electionVoter.findFirst({
        where: {
          electionId: participation.electionId,
          email: user.email,
        },
      });

      if (!existingVoterReg) {
        // Create voter registration
        await prisma.electionVoter.create({
          data: {
            electionId: participation.electionId,
            name: user.fullName || user.username,
            email: user.email,
            username: user.username,
          },
        });

        log.info("Voter registered for election after accepting invitation", "VOTER_INVITATION", {
          userId,
          electionId: participation.electionId,
          participationId,
        });
      }
    }

    // Create audit log
    await AuditService.createAuditLog(
      userId,
      `INVITATION_${action.toUpperCase()}`,
      "PARTICIPATION",
      participationId,
      `Voter ${action}ed invitation to election ${participation.electionId}`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown"
    );

    log.info(`Invitation ${action}ed successfully`, "VOTER_INVITATION", {
      userId,
      participationId,
      electionId: participation.electionId,
      action,
    });

    return NextResponse.json({
      success: true,
      message: `Invitation ${action}ed successfully`,
      data: {
        participationId: updatedParticipation.id,
        electionId: updatedParticipation.electionId,
        inviteStatus,
        respondedAt: updatedParticipation.respondedAt?.toISOString(),
      },
    });
  } catch (error) {
    log.exception(error as Error, "VOTER_INVITATION", {
      path: "/api/voter/invitations",
    });

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
