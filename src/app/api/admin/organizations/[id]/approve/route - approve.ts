/**
 * Organization Approval Endpoint
 * Allows admin to approve pending organization registrations
 * 
 * Per problem statement:
 * - Admin reviews pending organizations
 * - On approval, creates organization user account
 * - Sends confirmation email to organization
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

    // Create organization user account
    const organization = await prisma.user.create({
      data: {
        username: registrationData.username,
        email: registrationData.contactEmail,
        fullName: registrationData.contactName,
        passwordHash: registrationData.passwordHash,
        role: "ORGANIZATION",
        status: "ACTIVE",
        emailVerified: true, // Email was verified during registration
      },
    });

    // Mark registration as processed
    await prisma.systemConfig.update({
      where: { id: registration.id },
      data: {
        key: registration.key.replace("org_registration_", "org_registration_processed_"),
        value: JSON.stringify({
          ...registrationData,
          approvedAt: new Date().toISOString(),
          approvedBy: user.id,
          organizationUserId: organization.id,
        }),
      },
    });

    // TODO: Send confirmation email to organization
    // Email should include:
    // - Congratulations message
    // - Login credentials (username, they have the password)
    // - Link to login page
    // - Getting started guide

    log.auth("Organization registration approved", {
      registrationId: registration.id,
      organizationUserId: organization.id,
      organizationName: registrationData.organizationName,
      approvedBy: user.id,
    });

    // Create audit log
    await AuditService.createAuditLog(
      user.id,
      "APPROVE",
      "ORGANIZATION_REGISTRATION",
      organization.id,
      `Approved organization registration: ${registrationData.organizationName}`,
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    return NextResponse.json({
      success: true,
      message: "Organization approved successfully",
      data: {
        organizationId: organization.id,
        username: organization.username,
        email: organization.email,
      },
    });

  } catch (error) {
    log.exception(error as Error, "ADMIN", {
      operation: "approveOrganization",
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
