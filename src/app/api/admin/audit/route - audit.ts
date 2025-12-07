/**
 * @file Admin Audit Logs API Endpoint
 * @description API endpoints for admin users to view and manage audit logs
 * @author BlockVote Development Team
 */

import { NextRequest, NextResponse } from "next/server";
import { protect } from "@/lib/auth/middleware";
import { AuditService } from "@/lib/database/services/audit.service";
import { UserService } from "@/lib/database/services/user.service";
import { log } from "@/utils/logger";
import { z } from "zod";

// Validation schema for audit log query parameters
const auditQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  userId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  action: z.string().optional(),
  resource: z.string().optional(),
  resourceId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  ipAddress: z.string().optional(),
  export: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

/**
 * GET /api/admin/audit
 * Get audit logs with filtering and pagination (Admin only)
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
    const queryResult = auditQuerySchema.safeParse(
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

    const {
      page,
      limit,
      userId,
      action,
      resource,
      resourceId,
      startDate,
      endDate,
      ipAddress,
      export: shouldExport,
    } = queryResult.data;

    // Build query object
    const query = {
      userId,
      action,
      resource,
      resourceId,
      startDate,
      endDate,
      ipAddress,
    };

    // Remove undefined values
    Object.keys(query).forEach((key) => {
      if (query[key as keyof typeof query] === undefined) {
        delete query[key as keyof typeof query];
      }
    });

    // Log admin access
    log.audit("AUDIT_LOGS_ACCESS", user.id.toString(), {
      adminEmail: user.email,
      query,
      export: shouldExport,
      ip: request.headers.get("x-forwarded-for") || "unknown",
    });

    // Log admin action in audit trail
    await AuditService.createAuditLog(
      user.id,
      "AUDIT_LOGS_ACCESS",
      "AUDIT",
      undefined,
      `Admin accessed audit logs with filters: ${JSON.stringify(query)}`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    if (shouldExport) {
      // Export audit logs
      const auditLogs = await AuditService.exportAuditLogs(query, true);

      return NextResponse.json({
        success: true,
        message: "Audit logs exported successfully",
        data: auditLogs,
        meta: {
          exported: true,
          total: auditLogs.length,
          exportedAt: new Date().toISOString(),
          exportedBy: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
        },
      });
    } else {
      // Get paginated audit logs
      const result = await AuditService.getAuditLogs(page, limit, query);

      return NextResponse.json({
        success: true,
        message: "Audit logs retrieved successfully",
        data: result.data,
        pagination: result.pagination,
        meta: {
          query,
          accessedBy: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
        },
      });
    }
  } catch (error) {
    log.exception(error as Error, "ADMIN_AUDIT", {
      operation: "getAuditLogs",
    });

    return NextResponse.json(
      {
        error: "Failed to retrieve audit logs",
        message: "An internal server error occurred",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/audit
 * Delete old audit logs (Admin only - maintenance operation)
 */
export async function DELETE(request: NextRequest) {
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
    const body = await request.json();

    // Validation schema for delete operation
    const deleteSchema = z.object({
      daysToKeep: z.number().min(30).max(3650), // Between 30 days and 10 years
      confirm: z.boolean().refine((val) => val === true, {
        message: "Confirmation required for audit log deletion",
      }),
    });

    const validation = deleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validation.error.format(),
        },
        { status: 400 },
      );
    }

    const { daysToKeep } = validation.data;

    // Log the dangerous operation
    log.audit("AUDIT_LOGS_CLEANUP_INITIATED", user.id.toString(), {
      adminEmail: user.email,
      daysToKeep,
      ip: request.headers.get("x-forwarded-for") || "unknown",
    });

    // Create audit log before deletion
    await AuditService.createAuditLog(
      user.id,
      "AUDIT_LOGS_CLEANUP",
      "AUDIT",
      undefined,
      `Admin initiated cleanup of audit logs older than ${daysToKeep} days`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    // Perform the deletion
    const deletedCount = await AuditService.deleteOldAuditLogs(daysToKeep);

    // Log successful cleanup
    log.audit("AUDIT_LOGS_CLEANUP_COMPLETED", user.id.toString(), {
      adminEmail: user.email,
      deletedCount,
      daysToKeep,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} old audit log entries`,
      data: {
        deletedCount,
        daysToKeep,
        cleanupDate: new Date().toISOString(),
        performedBy: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      },
    });
  } catch (error) {
    log.exception(error as Error, "ADMIN_AUDIT", {
      operation: "deleteOldAuditLogs",
    });

    return NextResponse.json(
      {
        error: "Failed to cleanup audit logs",
        message: "An internal server error occurred",
      },
      { status: 500 },
    );
  }
}
