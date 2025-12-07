/**
 * Organization Rejection Endpoint
 * Allows admin to reject pending organization registrations
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/jwt";
import prisma from "@/lib/database/client";
import { AuditService } from "@/lib/database/services/audit.service";
import { log } from "@/utils/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Get optional rejection reason from body
    const body = await request.json().catch(() => ({}));
    const rejectionReason = body.reason || "Not specified";

    // Get registration from system_config
    const registration = await prisma.systemConfig.findUnique({
      where: { id: parseInt(id) },
    });

    if (!registration) {
      return NextResponse.json(
        { success: false, message: "Registration not found" },
        { status: 404 },
      );
    }

    // Parse registration data
    let registrationData;
    try {
      registrationData = JSON.parse(registration.value);
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid registration data" },
        { status: 400 },
      );
    }

    // Check if already processed
    if (registration.key.includes("_processed_")) {
      return NextResponse.json(
        { success: false, message: "Registration already processed" },
        { status: 400 },
      );
    }

    // Mark registration as rejected
    await prisma.systemConfig.update({
      where: { id: registration.id },
      data: {
        key: registration.key.replace("org_registration_", "org_registration_processed_rejected_"),
        value: JSON.stringify({
          ...registrationData,
          rejectedAt: new Date().toISOString(),
          rejectedBy: user.id,
          rejectionReason,
        }),
      },
    });

    // TODO: Send rejection email to organization
    // Email should include:
    // - Polite rejection message
    // - Reason for rejection
    // - Option to reapply with corrections

    log.auth("Organization registration rejected", {
      registrationId: registration.id,
      organizationName: registrationData.organizationName,
      rejectedBy: user.id,
      reason: rejectionReason,
    });

    // Create audit log
    await AuditService.createAuditLog(
      user.id,
      "REJECT",
      "ORGANIZATION_REGISTRATION",
      registration.id,
      `Rejected organization registration: ${registrationData.organizationName}. Reason: ${rejectionReason}`,
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    return NextResponse.json({
      success: true,
      message: "Organization registration rejected",
    });

  } catch (error) {
    log.exception(error as Error, "ADMIN", {
      operation: "rejectOrganization",
      registrationId: id,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development"
          ? error instanceof Error ? error.message : String(error)
          : undefined,
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
