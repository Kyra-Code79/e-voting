import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";
import { AuditService } from "@/lib/database/services/audit.service";

const prisma = new PrismaClient();

/**
 * GET /api/organization/elections
 * Get elections for the authenticated organization
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
    let decoded;

    try {
      decoded = auth.verifyToken(token).payload;
    } catch (error) {
      console.error("Token verification failed:", error);
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 },
      );
    }

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Invalid token payload" },
        { status: 401 },
      );
    }

    // Convert userId to number
    const userId =
      typeof decoded.userId === "string"
        ? parseInt(decoded.userId, 10)
        : decoded.userId;

    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID in token" },
        { status: 401 },
      );
    }

    // Get user and verify organization role
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    if (user.role !== "ORGANIZATION") {
      return NextResponse.json(
        { success: false, message: "Organization access required" },
        { status: 403 },
      );
    }

    // Get organization elections with related data
    const elections = await prisma.election.findMany({
      where: {
        organizationId: user.id,
      },
      include: {
        candidates: {
          orderBy: { id: "asc" },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Create audit log
    try {
      await AuditService.createAuditLog(
        user.id,
        "VIEW",
        "ORGANIZATION_ELECTIONS",
        undefined,
        `Viewed ${elections.length} elections`,
        request.headers.get("x-forwarded-for") || "unknown",
        request.headers.get("user-agent") || "unknown",
      );
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: elections,
    });
  } catch (error) {
    console.error("Error fetching organization elections:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/organization/elections
 * Create a new election
 */
export async function POST(request: NextRequest) {
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
    let decoded;

    try {
      decoded = auth.verifyToken(token).payload;
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 },
      );
    }

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Invalid token payload" },
        { status: 401 },
      );
    }

    const userId = typeof decoded.userId === "string" ? parseInt(decoded.userId, 10) : decoded.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== "ORGANIZATION") {
      return NextResponse.json(
        { success: false, message: "Organization access required" },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, description, startDate, endDate, candidates } = body;

    // Validate required fields
    if (!title || !description || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start < now) {
      return NextResponse.json(
        { success: false, message: "Start date cannot be in the past" },
        { status: 400 },
      );
    }

    if (end <= start) {
      return NextResponse.json(
        { success: false, message: "End date must be after start date" },
        { status: 400 },
      );
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length < 2) {
      return NextResponse.json(
        { success: false, message: "At least 2 candidates are required" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create election
      const election = await tx.election.create({
        data: {
          title,
          description,
          startDate: start,
          endDate: end,
          organizationId: user.id,
          status: "DRAFT",
        },
      });

      // Create candidates
      const createdCandidates = await Promise.all(
        candidates.map((candidate: { name: string; description: string }) =>
          tx.candidate.create({
            data: {
              electionId: election.id,
              name: candidate.name,
              description: candidate.description,
            },
          }),
        ),
      );

      // Init statistics
      await tx.electionStatistics.create({
        data: {
          electionId: election.id,
          totalRegisteredVoters: 0,
          totalVotesCast: 0,
          participationRate: 0.0,
        },
      });

      return { election, candidates: createdCandidates };
    });

    // Audit Log
    try {
      await AuditService.createAuditLog(
        user.id,
        "CREATE",
        "ELECTION",
        result.election.id,
        `Created election: ${title}`,
        request.headers.get("x-forwarded-for") || "unknown",
        request.headers.get("user-agent") || "unknown",
      );
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.election,
        candidates: result.candidates,
      },
      message: "Election created successfully",
    });
  } catch (error) {
    console.error("Error creating election:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PATCH /api/organization/elections
 * Update election status (DRAFT -> ACTIVE -> ENDED)
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. Auth Check
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = auth.verifyToken(token).payload;
    } catch (error) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    if (!decoded || !decoded.userId) {
      return NextResponse.json({ success: false, message: "Invalid token payload" }, { status: 401 });
    }

    // Convert userId to number
    const userId = typeof decoded.userId === "string" ? parseInt(decoded.userId, 10) : decoded.userId;

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, message: "Invalid user ID in token" }, { status: 401 });
    }

    // 2. Verify Organization Role
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "ORGANIZATION") {
      return NextResponse.json({ success: false, message: "Organization access required" }, { status: 403 });
    }

    // 3. Parse Body
    const body = await request.json();
    const { electionId, status } = body;

    if (!electionId || !status) {
      return NextResponse.json({ success: false, message: "Election ID and status are required" }, { status: 400 });
    }

    // Validate status
    const validStatuses = ["DRAFT", "ACTIVE", "ENDED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, message: "Invalid status value" }, { status: 400 });
    }

    // 4. Verify Ownership & Update
    const existingElection = await prisma.election.findUnique({
      where: { id: electionId },
    });

    if (!existingElection) {
      return NextResponse.json({ success: false, message: "Election not found" }, { status: 404 });
    }

    if (existingElection.organizationId !== user.id) {
      return NextResponse.json({ success: false, message: "Unauthorized to update this election" }, { status: 403 });
    }

    const updatedElection = await prisma.election.update({
      where: { id: electionId },
      data: { status: status },
    });

    // 5. Audit Log
    try {
      await AuditService.createAuditLog(
        user.id,
        "UPDATE",
        "ELECTION_STATUS",
        electionId,
        `Updated status to ${status} for election: ${existingElection.title}`,
        request.headers.get("x-forwarded-for") || "unknown",
        request.headers.get("user-agent") || "unknown",
      );
    } catch (e) { console.error("Audit log failed", e); }

    return NextResponse.json({
      success: true,
      data: updatedElection,
      message: `Election status updated to ${status}`,
    });

  } catch (error) {
    console.error("Error updating election:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", error: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}