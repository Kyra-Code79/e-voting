import { NextRequest, NextResponse } from "next/server";
import { protect } from "@/lib/auth/middleware";
import prisma from "@/lib/database/client";
import { AuditService } from "@/lib/database/services/audit.service";

/**
 * GET /api/admin/system
 * Fetch System Statistics for Charts
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Auth Check
    const authResult = await protect.authenticate(request, {
      requireAuth: true,
      allowedRoles: ["admin"],
    });

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Aggregations for Charts
    const [
      usersByRole,
      electionsByStatus,
      totalVotes,
      totalLogs,
      totalBlocks
    ] = await Promise.all([
      // Chart 1: Donut (User Roles)
      prisma.user.groupBy({
        by: ["role"],
        _count: { role: true },
      }),
      // Chart 2: Donut (Election Status)
      prisma.election.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      // Chart 3: Bar (Volume Comparison)
      prisma.vote.count(),
      prisma.auditLog.count(),
      prisma.blockchainBlock.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        roles: usersByRole.map(r => ({ label: r.role, value: r._count.role })),
        elections: electionsByStatus.map(e => ({ label: e.status, value: e._count.status })),
        volume: [
          { label: "Total Votes", value: totalVotes },
          { label: "Audit Logs", value: totalLogs },
          { label: "Blocks Mined", value: totalBlocks },
        ]
      }
    });

  } catch (error) {
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/system
 * Handle Exports & Backups
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await protect.authenticate(request, { requireAuth: true, allowedRoles: ["admin"] });
    
    if (!authResult.success || !authResult.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(authResult.user.userId);
    const body = await request.json();
    const { action } = body;

    // --- ACTION: FULL DATABASE BACKUP (JSON) ---
    if (action === "backup_full") {
      const [users, elections, votes, configs, logs] = await Promise.all([
        prisma.user.findMany(),
        prisma.election.findMany(),
        prisma.vote.findMany(),
        prisma.systemConfig.findMany(),
        prisma.auditLog.findMany({ take: 5000, orderBy: { createdAt: 'desc' } }) // Limit logs for backup
      ]);

      const backupData = {
        metadata: { timestamp: new Date(), version: "1.0", type: "FULL_BACKUP" },
        users,
        elections,
        votes,
        configs,
        logs
      };

      await AuditService.createAuditLog(
        userId, "BACKUP", "SYSTEM", undefined, "Performed full system backup", 
        request.headers.get("x-forwarded-for") || "unknown", request.headers.get("user-agent") || "unknown"
      );

      return NextResponse.json({
        success: true,
        filename: `backup-full-${Date.now()}.json`,
        content: JSON.stringify(backupData, null, 2),
        type: "application/json"
      });
    }

    // --- ACTION: EXPORT USERS (CSV) ---
    if (action === "export_users") {
      const users = await prisma.user.findMany({
        select: { id: true, username: true, email: true, role: true, status: true, createdAt: true }
      });

      const csvHeader = "ID,Username,Email,Role,Status,Joined At\n";
      const csvRows = users.map(u => 
        `${u.id},${u.username},${u.email},${u.role},${u.status},${new Date(u.createdAt).toISOString()}`
      ).join("\n");

      await AuditService.createAuditLog(
        userId, "EXPORT", "USERS", undefined, "Exported user list to CSV", 
        request.headers.get("x-forwarded-for") || "unknown", request.headers.get("user-agent") || "unknown"
      );

      return NextResponse.json({
        success: true,
        filename: `users-export-${Date.now()}.csv`,
        content: csvHeader + csvRows,
        type: "text/csv"
      });
    }

    // --- ACTION: EXPORT LOGS (CSV) - [FIX: DITAMBAHKAN] ---
    if (action === "export_logs") {
        const logs = await prisma.auditLog.findMany({
            take: 10000, // Batasi 10rb log terakhir agar tidak timeout
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { username: true, role: true } }
            }
        });

        // Buat Header CSV
        const csvHeader = "ID,Timestamp,Actor,Role,Action,Resource,Details,IP Address\n";
        
        // Buat Baris CSV
        const csvRows = logs.map(log => {
            // Escape tanda kutip di dalam details agar CSV valid
            const safeDetails = log.details.replace(/"/g, '""'); 
            return `${log.id},"${new Date(log.createdAt).toISOString()}","${log.user.username}","${log.user.role}","${log.action}","${log.resource}","${safeDetails}","${log.ipAddress}"`;
        }).join("\n");

        await AuditService.createAuditLog(
            userId, "EXPORT", "AUDIT_LOGS", undefined, "Exported audit logs to CSV", 
            request.headers.get("x-forwarded-for") || "unknown", request.headers.get("user-agent") || "unknown"
        );

        return NextResponse.json({
            success: true,
            filename: `audit-logs-export-${Date.now()}.csv`,
            content: csvHeader + csvRows,
            type: "text/csv"
        });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("System API Error:", error);
    return NextResponse.json({ success: false, message: "Action failed" }, { status: 500 });
  }
}