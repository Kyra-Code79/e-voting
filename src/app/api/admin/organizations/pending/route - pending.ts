import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";

const prisma = new PrismaClient();

/**
 * GET /api/admin/organizations/pending
 * Get pending organization registrations for admin approval
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7);
    const decoded = auth.verifyToken(token).payload;

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 },
      );
    }

    // Get user and verify admin role
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 },
      );
    }

    // Get pagination parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Get pending registrations from system_config table
    // Organization registrations are stored as JSON in system_config
    const pendingRegistrations = await prisma.systemConfig.findMany({
      where: {
        key: {
          startsWith: "org_registration_",
        },
        // Only get pending ones (not processed)
        NOT: {
          key: {
            contains: "_processed_",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      skip: offset,
      take: limit,
    });

    // Parse the registration data
    const registrations = pendingRegistrations
      .map((config) => {
        try {
          const data = JSON.parse(config.value);
          return {
            id: config.id,
            organizationName: data.organizationName || "Unknown",
            contactName: data.contactName || "Unknown",
            contactEmail: data.contactEmail || "Unknown",
            username: data.username || "Unknown",
            description: data.description || "",
            website: data.website || "",
            phone: data.phone || "",
            address: data.address || "",
            status: "PENDING",
            submittedAt: config.updatedAt,
            configKey: config.key,
          };
        } catch (error) {
          console.error("Error parsing registration data:", error);
          return null;
        }
      })
      .filter(Boolean);

    // Get total count for pagination
    const totalCount = await prisma.systemConfig.count({
      where: {
        key: {
          startsWith: "org_registration_",
        },
        NOT: {
          key: {
            contains: "_processed_",
          },
        },
      },
    });

    // Create audit log
    await AuditService.createAuditLog(
      user.id,
      "VIEW",
      "PENDING_ORGANIZATIONS",
      undefined,
      `Viewed ${registrations.length} pending organization registrations`,
      request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    return NextResponse.json({
      success: true,
      data: registrations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching pending organizations:", error);
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
