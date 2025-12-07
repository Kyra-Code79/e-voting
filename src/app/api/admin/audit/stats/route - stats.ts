/**
 * @file Admin Audit Statistics API Endpoint
 * @description API endpoints for admin users to view audit log statistics and analytics
 * @author BlockVote Development Team
 */

import { NextRequest, NextResponse } from "next/server";
import { protect } from "@/lib/auth/middleware";
import { AuditService } from "@/lib/database/services/audit.service";
import { UserService } from "@/lib/database/services/user.service";
import { log } from "@/utils/logger";
import { z } from "zod";

// Validation schema for statistics query parameters
const statsQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 7)),
  topUsersLimit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
});

/**
 * GET /api/admin/audit/stats
 * Get audit log statistics and analytics (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Protect route - Admin only
    const authResult = await protect.authenticate(request, {
      requireAuth: true,
      allowedRoles: ["admin"],
    });

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || "Access denied" },
        { status: authResult.statusCode || 401 },
      );
    }

    const user = await UserService.findById(parseInt(authResult.user.userId));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const queryResult = statsQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: queryResult.error.format(),
        },
        { status: 400 },
      );
    }

    const { days, topUsersLimit } = queryResult.data;

    // Validate days parameter (between 1 and 365)
    if (days < 1 || days > 365) {
      return NextResponse.json(
        {
          error: "Invalid days parameter",
          message: "Days must be between 1 and 365",
        },
        { status: 400 },
      );
    }

    // Log admin access
    log.audit("AUDIT_STATS_ACCESS", user.id.toString(), {
      adminEmail: user.email,
      days,
      topUsersLimit,
      ip: request.headers.get("x-forwarded-for") || "unknown",
    });

    // Log admin action in audit trail
    await AuditService.createAuditLog(
      user.id,
      "AUDIT_STATS_ACCESS",
      "AUDIT",
      undefined,
      `Admin accessed audit statistics for ${days} days`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    // Fetch statistics concurrently
    const [statistics, topUsers, recentLogs] = await Promise.all([
      AuditService.getAuditStatistics(days),
      AuditService.getTopUsersByActivity(topUsersLimit, days),
      AuditService.getRecentAuditLogs(20), // Last 20 recent logs
    ]);

    return NextResponse.json({
      success: true,
      message: "Audit statistics retrieved successfully",
      data: {
        overview: statistics,
        topActiveUsers: topUsers,
        recentActivity: {
          logs: recentLogs.data,
          total: recentLogs.pagination.total,
        },
        meta: {
          period: `Last ${days} days`,
          generatedAt: new Date().toISOString(),
          accessedBy: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
        },
      },
    });
  } catch (error) {
    log.exception(error as Error, "ADMIN_AUDIT_STATS", {
      operation: "getAuditStatistics",
    });

    return NextResponse.json(
      {
        error: "Failed to retrieve audit statistics",
        message: "An internal server error occurred",
      },
      { status: 500 },
    );
  }
}
