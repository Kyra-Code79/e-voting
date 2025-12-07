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
import prisma from "@/lib/database/client";
import { Prisma, UserRole } from "@prisma/client";

// Validation schema
const auditQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  userId: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  action: z.string().optional(),
  role: z.enum(["admin", "organization", "voter", "ALL"]).optional(), // Support "ALL" explicitly
  resource: z.string().optional(),
  resourceId: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  ipAddress: z.string().optional(),
  export: z.string().optional().transform((val) => val === "true"),
});

export async function GET(request: NextRequest) {
  try {
    // 1. Auth Check
    const authResult = await protect.authenticate(request, {
      requireAuth: true,
      allowedRoles: ["admin"],
    });

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Access denied" }, { status: 401 });
    }

    const user = await UserService.findById(parseInt(authResult.user.userId));
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 2. Parse Query
    const { searchParams } = new URL(request.url);
    const queryResult = auditQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!queryResult.success) {
      return NextResponse.json({ error: "Invalid parameters", details: queryResult.error.format() }, { status: 400 });
    }

    const { page, limit, userId, action, role, resource, resourceId, startDate, endDate, ipAddress, export: shouldExport } = queryResult.data;

    // 3. Build Prisma Where Input
    const where: Prisma.AuditLogWhereInput = {};

    if (userId) where.userId = userId;
    
    // Filter Action (Ignore "ALL")
    if (action && action !== "ALL") {
        where.action = action;
    }

    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (ipAddress) where.ipAddress = { contains: ipAddress };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // 4. Handle Role Filter (Complex Logic)
    if (role && role !== "ALL") {
        // Convert to Prisma Enum (Uppercase)
        const roleEnum = role.toUpperCase() as UserRole;
        
        // Find all users with this role
        const users = await prisma.user.findMany({
            where: { role: roleEnum },
            select: { id: true }
        });
        
        const ids = users.map(u => u.id);
        
        if (ids.length === 0) {
            // No users with this role found, return empty result immediately
            return NextResponse.json({
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 }
            });
        }

        // Apply filter: userId MUST be in the list of IDs with that role
        if (where.userId) {
            // If specific userId is requested AND role filter is applied, check intersection
            if (typeof where.userId === 'number' && !ids.includes(where.userId)) {
                 return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
        } else {
            where.userId = { in: ids };
        }
    }

    // 5. Log Access
    await AuditService.createAuditLog(
      user.id, "AUDIT_LOGS_ACCESS", "AUDIT", undefined, 
      `Filters: Action=${action}, Role=${role}`, 
      request.headers.get("x-forwarded-for") || "unknown", 
      request.headers.get("user-agent") || "unknown"
    );

    // 6. Execute Query
    if (shouldExport) {
      const logs = await AuditService.exportAuditLogs(where, true);
      return NextResponse.json({ success: true, data: logs });
    } else {
      const result = await AuditService.getAuditLogs(page, limit, where);
      return NextResponse.json({
        success: true,
        message: "Audit logs retrieved",
        data: result.data,
        pagination: result.pagination,
      });
    }
  } catch (error) {
    console.error("Audit API Error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await protect.authenticate(request, { requireAuth: true, allowedRoles: ["admin"] });
    if (!authResult.success || !authResult.user) return NextResponse.json({ error: "Access denied" }, { status: 401 });

    const user = await UserService.findById(parseInt(authResult.user.userId));
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const { daysToKeep, confirm } = body;

    if (!confirm || typeof daysToKeep !== 'number') return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    await AuditService.createAuditLog(user.id, "AUDIT_LOGS_CLEANUP", "AUDIT", undefined, `Cleanup logs older than ${daysToKeep} days`);
    const deletedCount = await AuditService.deleteOldAuditLogs(daysToKeep);

    return NextResponse.json({ success: true, message: `Deleted ${deletedCount} logs`, data: { deletedCount } });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}