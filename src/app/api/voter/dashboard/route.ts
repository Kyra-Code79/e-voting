/**
 * Voter Dashboard API Route for BlockVote
 * GET /api/voter/dashboard - Get voter's dashboard data
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { log } from "@/utils/logger";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. AUTHENTICATION & VALIDATION
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
          .reduce((acc, cookie) => {
            const [key, value] = cookie.split("=");
            if (key && value) acc[key] = decodeURIComponent(value);
            return acc;
          }, {} as Record<string, string>);
        token = cookies.accessToken;
      }
    }

    if (!token) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const tokenResult = auth.verifyToken(token);
    if (!tokenResult.isValid || !tokenResult.payload?.userId) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const userId = parseInt(tokenResult.payload.userId);

    // Get user to verify role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true, username: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Secure Role Check
    if ((user.role as string).toLowerCase() !== "voter") {
      return NextResponse.json({ success: false, message: "Voter access required" }, { status: 403 });
    }

    // ------------------------------------------------------------------
    // 2. FETCH DATA
    // ------------------------------------------------------------------

    const now = new Date();

    // A. Get Pending Invitations
    const pendingInvitations = await prisma.userElectionParticipation.findMany({
      where: {
        userId: userId,
        inviteStatus: "PENDING", // Matches Prisma Enum
        election: {
          status: { not: "DRAFT" }
        }
      },
      include: {
        election: {
          select: { id: true, title: true, description: true, status: true, startDate: true, endDate: true }
        }
      },
      orderBy: { invitedAt: "desc" }
    });

    // B. Get Active Elections (Started and Active)
    const activeElections = await prisma.election.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
        OR: [
          {
            UserElectionParticipation: {
              some: {
                userId: userId,
                inviteStatus: "ACCEPTED"
              }
            }
          },
          {
            voters: {
              some: {
                email: user.email
              }
            }
          }
        ]
      },
      include: {
        organization: {
          select: { id: true, username: true, email: true }
        },
        _count: {
          select: { votes: true, voters: true }
        },
        candidates: {
          select: { id: true, name: true, description: true }
        }
      },
      orderBy: { endDate: "asc" }
    });

    // B.2 Get Upcoming Elections (Active but Not Started)
    const upcomingElections = await prisma.election.findMany({
      where: {
        status: "ACTIVE",
        startDate: { gt: now }, // Starts in the future
        OR: [
          {
            UserElectionParticipation: {
              some: {
                userId: userId,
                inviteStatus: "ACCEPTED"
              }
            }
          },
          {
            voters: {
              some: {
                email: user.email
              }
            }
          }
        ]
      },
      include: {
        organization: {
          select: { id: true, username: true, email: true }
        },
        _count: {
          select: { votes: true, voters: true }
        },
        candidates: {
          select: { id: true, name: true, description: true }
        }
      },
      orderBy: { startDate: "asc" }
    });

    // C. Get Voting History
    const votingHistory = await prisma.vote.findMany({
      where: { voterId: userId },
      include: {
        election: {
          select: { id: true, title: true, description: true, status: true, startDate: true, endDate: true, organization: { select: { username: true } } }
        }
      },
      orderBy: { votedAt: "desc" }
    });

    // D. Statistics
    const allParticipations = await prisma.userElectionParticipation.findMany({
      where: { userId: userId }
    });

    const totalInvitations = allParticipations.length;
    const totalVoted = votingHistory.length;
    const participationRate = totalInvitations > 0 ? (totalVoted / totalInvitations) * 100 : 0;
    const pendingInvitationsCount = pendingInvitations.length;

    log.info("Voter accessed dashboard", "VOTER_DASHBOARD", {
      userId,
      totalInvitations,
      totalVoted,
      pendingInvitations: pendingInvitationsCount
    });

    return NextResponse.json({
      success: true,
      data: {
        participations: allParticipations,
        activeElections,
        upcomingElections,
        votingHistory,
        pendingInvitations,
        statistics: {
          totalInvitations,
          totalVoted,
          participationRate,
          pendingInvitations: pendingInvitationsCount,
        },
      },
    });

  } catch (error) {
    try {
      log.exception(error as Error, "VOTER_DASHBOARD", {
        path: "/api/voter/dashboard",
      });
    } catch (e) { }

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}