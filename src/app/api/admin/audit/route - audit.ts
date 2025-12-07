import prisma from "@/lib/database/client";
import { Prisma } from "@prisma/client";

export class AuditService {
  /**
   * Create a new audit log entry
   */
  static async createAuditLog(
    userId: number,
    action: string,
    resource: string,
    resourceId?: number,
    details: string = "",
    ipAddress: string = "unknown",
    userAgent: string = "unknown"
  ) {
    try {
      const log = await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          details,
          ipAddress,
          userAgent,
        },
      });
      return log;
    } catch (error) {
      console.error("Failed to create audit log:", error);
      // Don't throw error to prevent blocking main flow
      return null;
    }
  }

  /**
   * Get paginated audit logs
   * FIX: Menggunakan Prisma.AuditLogWhereInput agar support filter kompleks
   */
  static async getAuditLogs(
    page = 1, 
    limit = 10, 
    query: Prisma.AuditLogWhereInput = {} 
  ) {
    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: query,
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            user: {
              select: {
                username: true,
                role: true, // Penting untuk UI Admin Dashboard
                email: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where: query }),
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      throw error;
    }
  }

  /**
   * Export audit logs
   * FIX: Menggunakan Prisma.AuditLogWhereInput agar support filter kompleks
   */
  static async exportAuditLogs(
    query: Prisma.AuditLogWhereInput = {}, 
    csvFormat = false
  ) {
    try {
      const logs = await prisma.auditLog.findMany({
        where: query,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              username: true,
              email: true,
              role: true,
            },
          },
        },
        take: 10000, // Limit export to prevent memory issues
      });

      if (!csvFormat) {
        return logs;
      }

      // Format as CSV
      // Ini logic fallback jika tidak ditangani di API Route,
      // tapi biasanya formatting CSV dilakukan di API Route (seperti kode route.ts Anda yang baru).
      // Kita return raw logs saja agar fleksibel.
      return logs;
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      throw error;
    }
  }

  /**
   * Get audit statistics for dashboard
   */
  static async getAuditStatistics(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const [totalLogs, actionsCount, resourceCount] = await Promise.all([
        prisma.auditLog.count({
          where: {
            createdAt: {
              gte: startDate,
            },
          },
        }),
        prisma.auditLog.groupBy({
          by: ["action"],
          where: {
            createdAt: {
              gte: startDate,
            },
          },
          _count: {
            action: true,
          },
          orderBy: {
            _count: {
              action: "desc",
            },
          },
          take: 5,
        }),
        prisma.auditLog.groupBy({
          by: ["resource"],
          where: {
            createdAt: {
              gte: startDate,
            },
          },
          _count: {
            resource: true,
          },
          orderBy: {
            _count: {
              resource: "desc",
            },
          },
          take: 5,
        }),
      ]);

      return {
        totalLogs,
        topActions: actionsCount.map((item) => ({
          action: item.action,
          count: item._count.action,
        })),
        topResources: resourceCount.map((item) => ({
          resource: item.resource,
          count: item._count.resource,
        })),
      };
    } catch (error) {
      console.error("Error getting audit statistics:", error);
      throw error;
    }
  }

  /**
   * Get recent audit logs
   */
  static async getRecentAuditLogs(limit = 10) {
    return this.getAuditLogs(1, limit);
  }

  /**
   * Get top active users by activity count
   */
  static async getTopUsersByActivity(limit = 10, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const topUsers = await prisma.auditLog.groupBy({
        by: ["userId"],
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        _count: {
          userId: true,
        },
        orderBy: {
          _count: {
            userId: "desc",
          },
        },
        take: limit,
      });

      // Enrich with user details
      const userDetails = await Promise.all(
        topUsers.map(async (item) => {
          const user = await prisma.user.findUnique({
            where: { id: item.userId },
            select: {
              username: true,
              email: true,
              role: true,
            },
          });
          return {
            ...user,
            activityCount: item._count.userId,
            userId: item.userId,
          };
        })
      );

      return userDetails;
    } catch (error) {
      console.error("Error getting top users:", error);
      throw error;
    }
  }

  /**
   * Delete old audit logs (Maintenance)
   */
  static async deleteOldAuditLogs(daysToKeep = 90) {
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() - daysToKeep);

    try {
      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: deleteDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      console.error("Error deleting old audit logs:", error);
      throw error;
    }
  }
}