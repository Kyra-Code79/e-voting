import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";

const prisma = new PrismaClient();

/**
 * GET /api/admin/stats
 * Get system statistics for admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication - check both header and cookies
    let token = null;

    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      // Fallback to cookie
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
      console.error("No authentication token found", {
        hasAuthHeader: !!authHeader,
        hasCookieHeader: !!request.headers.get("cookie"),
        cookies: request.headers.get("cookie"),
      });

      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    const tokenResult = auth.verifyToken(token);

    if (
      !tokenResult.isValid ||
      !tokenResult.payload ||
      !tokenResult.payload.userId
    ) {
      console.error("Token verification failed", {
        isValid: tokenResult.isValid,
        error: tokenResult.error,
        expired: tokenResult.expired,
      });

      return NextResponse.json(
        {
          success: false,
          message: tokenResult.expired ? "Token expired" : "Invalid token",
          error: tokenResult.error,
        },
        { status: 401 },
      );
    }

    const decoded = tokenResult.payload;

    // Get user and verify admin role
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
    });

    if (!user) {
      console.error("User not found", { userId: decoded.userId });
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    if (user.role !== "ADMIN") {
      console.error("Admin access denied", {
        userId: decoded.userId,
        userRole: user.role,
        expectedRole: "ADMIN",
      });
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 },
      );
    }

    // Gather system statistics
    const [
      totalUsers,
      totalElections,
      totalVotes,
      totalBlocks,
      systemStats,
      usersByRole,
      electionsByStatus,
      recentActivity,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Total elections
      prisma.election.count(),

      // Total votes
      prisma.vote.count(),

      // Total blockchain blocks
      prisma.blockchainBlock.count(),

      // System statistics (if available)
      prisma.systemStatistics.findFirst().catch(() => null),

      // Users by role
      prisma.user.groupBy({
        by: ["role"],
        _count: {
          role: true,
        },
      }),

      // Elections by status
      prisma.election.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
      }),

      // Recent activity (last 24 hours)
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calculate additional metrics
    const activeElections = await prisma.election.count({
      where: {
        status: "ACTIVE",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    const completedElections = await prisma.election.count({
      where: { status: "ENDED" },
    });

    // Get vote participation rate
    const totalEligibleVoters = await prisma.electionVoter.count();
    const participationRate =
      totalEligibleVoters > 0 ? (totalVotes / totalEligibleVoters) * 100 : 0;

    // Calculate average block time (if we have blocks)
    let averageBlockTime = 0;
    if (totalBlocks > 1) {
      const blocks = await prisma.blockchainBlock.findMany({
        select: { timestamp: true },
        orderBy: { timestamp: "asc" },
        take: 10, // Last 10 blocks for average
      });

      if (blocks.length > 1) {
        const timestamps = blocks.map((b) => new Date(b.timestamp).getTime());
        const timeDiffs = [];
        for (let i = 1; i < timestamps.length; i++) {
          timeDiffs.push(timestamps[i] - timestamps[i - 1]);
        }
        averageBlockTime =
          timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length / 1000; // in seconds
      }
    }

    // Get storage usage (SQLite doesn't have built-in size functions)
    const databaseSize = null; // SQLite storage info not available via query

    // System uptime (from system stats or calculate)
    const systemUptime = systemStats?.systemUptime || 0;

    // Prepare response data
    const statsData = {
      // Basic counts
      totalUsers,
      totalElections,
      totalVotes,
      totalBlocks,

      // Calculated metrics
      activeElections,
      completedElections,
      participationRate: Math.round(participationRate * 100) / 100,
      averageBlockTime: Math.round(averageBlockTime * 100) / 100,
      systemUptime,
      recentActivity,

      // Breakdowns
      usersByRole: usersByRole.reduce(
        (acc, item) => {
          acc[item.role] = item._count.role;
          return acc;
        },
        {} as Record<string, number>,
      ),

      electionsByStatus: electionsByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        },
        {} as Record<string, number>,
      ),

      // System health indicators
      systemHealth: {
        databaseConnected: true,
        blockchainActive: totalBlocks > 0,
        recentActivity: recentActivity > 0,
        averageBlockTime,
      },

      // Storage info (if available)
      storage: databaseSize || null,

      // Timestamps
      lastUpdated: new Date().toISOString(),
    };

    // Create audit log
    await AuditService.createAuditLog(
      user.id,
      "VIEW",
      "ADMIN_STATS",
      undefined,
      "Viewed system statistics dashboard",
      request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    return NextResponse.json({
      success: true,
      data: statsData,
    });
  } catch (error) {
    console.error("Error fetching admin statistics:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
