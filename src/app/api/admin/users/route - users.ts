/**
 * Admin Users API Route for BlockVote
 * GET /api/admin/users - Get all users with filtering, pagination, and search
 * POST /api/admin/users - Create a new user (admin only)
 * PUT /api/admin/users - Update user (admin only)
 * DELETE /api/admin/users - Delete user (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/lib/database/services/user.service";
import { AuditService } from "@/lib/database/services/audit.service";
import { auth } from "@/lib/auth/jwt";
import { schemas } from "@/utils/validation";
import { log } from "@/utils/logger";

/**
 * Verify admin authentication
 */
async function verifyAdminAuth(request: NextRequest) {
  // Get token from header or cookie
  let token = null;
  const authHeader = request.headers.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
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
    return { error: "Authentication required", status: 401 };
  }

  const tokenResult = auth.verifyToken(token);
  if (!tokenResult.isValid || !tokenResult.payload?.userId) {
    return {
      error: tokenResult.expired ? "Token expired" : "Invalid token",
      status: 401,
    };
  }

  // Get user and verify admin role
  const user = await UserService.findById(parseInt(tokenResult.payload.userId));
  if (!user) {
    return { error: "User not found", status: 404 };
  }

  if (user.role !== "admin") {
    return { error: "Admin access required", status: 403 };
  }

  return { user, userId: user.id };
}

/**
 * GET /api/admin/users
 * Get all users with filtering, pagination, and search
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status },
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Validate parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, message: "Invalid pagination parameters" },
        { status: 400 },
      );
    }

    // Get users with filtering and pagination
    let users;
    let total;

    if (search) {
      // Use search functionality
      const result = await UserService.searchUsers(search, page, limit);
      users = result.data;
      total = result.pagination.total;
    } else {
      // Get all users with optional role filtering
      const result = await UserService.getAllUsers(
        page,
        limit,
        role ? (role as "admin" | "organization" | "voter") : undefined,
      );
      users = result.data;
      total = result.pagination.total;
    }

    // Filter by status if specified
    if (status) {
      users = users.filter((user) => user.status === status);
    }

    // Sort users
    users.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "username":
          aVal = a.username;
          bVal = b.username;
          break;
        case "email":
          aVal = a.email;
          bVal = b.email;
          break;
        case "role":
          aVal = a.role;
          bVal = b.role;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "createdAt":
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        const numA = typeof aVal === "number" ? aVal : 0;
        const numB = typeof bVal === "number" ? bVal : 0;
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }
    });

    // Remove sensitive data
    const sanitizedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
    }));

    // Create audit log
    await AuditService.createAuditLog(
      authResult.userId,
      "VIEW",
      "USERS",
      undefined,
      `Viewed users list (page ${page}, search: "${search}", role: "${role}")`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    return NextResponse.json({
      success: true,
      data: sanitizedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search,
        role,
        status,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    log.exception(error as Error, "ADMIN_USERS_GET", {
      path: "/api/admin/users",
    });

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = schemas.user.register.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return NextResponse.json(
        { success: false, message: "Validation failed", details: errors },
        { status: 400 },
      );
    }

    const { username, email, password: userPassword, role } = validation.data;

    // Check if user already exists
    const existingUser = await UserService.findByUsernameOrEmail(username);
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User already exists" },
        { status: 409 },
      );
    }

    const existingEmail = await UserService.findByEmail(email);
    if (existingEmail) {
      return NextResponse.json(
        { success: false, message: "Email already in use" },
        { status: 409 },
      );
    }

    // Create user (UserService will hash password internally)
    const newUser = await UserService.createUser({
      username,
      email,
      password: userPassword,
      role: role as "admin" | "organization" | "voter",
    });

    if (!newUser) {
      return NextResponse.json(
        { success: false, message: "Failed to create user" },
        { status: 500 },
      );
    }

    // Create audit log
    await AuditService.createAuditLog(
      authResult.userId,
      "CREATE",
      "USER",
      newUser.id,
      `Created new user: ${username} (${role})`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    // Return user without sensitive data
    const sanitizedUser = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };

    log.info("User created by admin", "ADMIN_USERS", {
      adminId: authResult.userId,
      newUserId: newUser.id,
      username,
      role,
    });

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      data: sanitizedUser,
    });
  } catch (error) {
    log.exception(error as Error, "ADMIN_USERS_POST", {
      path: "/api/admin/users",
    });

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/users
 * Update user (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status },
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId, updates } = body;

    if (!userId || !updates) {
      return NextResponse.json(
        { success: false, message: "User ID and updates are required" },
        { status: 400 },
      );
    }

    // Validate updates
    const allowedUpdates = [
      "username",
      "email",
      "role",
      "status",
      "fullName",
      "organizationName",
    ];
    const updateKeys = Object.keys(updates);
    const invalidKeys = updateKeys.filter(
      (key) => !allowedUpdates.includes(key),
    );

    if (invalidKeys.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid update fields: ${invalidKeys.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Get existing user
    const existingUser = await UserService.findById(userId);
    if (!existingUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    // Prevent admin from modifying their own role
    if (
      userId === authResult.userId &&
      updates.role &&
      updates.role !== existingUser.role
    ) {
      return NextResponse.json(
        { success: false, message: "Cannot modify your own role" },
        { status: 403 },
      );
    }

    // Check for username/email conflicts
    if (updates.username && updates.username !== existingUser.username) {
      const conflictUser = await UserService.findByUsername(updates.username);
      if (conflictUser && conflictUser.id !== userId) {
        return NextResponse.json(
          { success: false, message: "Username already in use" },
          { status: 409 },
        );
      }
    }

    if (updates.email && updates.email !== existingUser.email) {
      const conflictUser = await UserService.findByEmail(updates.email);
      if (conflictUser && conflictUser.id !== userId) {
        return NextResponse.json(
          { success: false, message: "Email already in use" },
          { status: 409 },
        );
      }
    }

    // Update user
    const updatedUser = await UserService.updateUser(userId, updates);

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: "Failed to update user" },
        { status: 500 },
      );
    }

    // Create audit log
    await AuditService.createAuditLog(
      authResult.userId,
      "UPDATE",
      "USER",
      userId,
      `Updated user ${existingUser.username}: ${JSON.stringify(updates)}`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    // Return updated user without sensitive data
    const sanitizedUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    log.info("User updated by admin", "ADMIN_USERS", {
      adminId: authResult.userId,
      updatedUserId: userId,
      updates: Object.keys(updates),
    });

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      data: sanitizedUser,
    });
  } catch (error) {
    log.exception(error as Error, "ADMIN_USERS_PUT", {
      path: "/api/admin/users",
    });

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/users
 * Delete user (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status },
      );
    }

    // Get user ID from query params
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get("userId") || "0");

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 },
      );
    }

    // Prevent admin from deleting themselves
    if (userId === authResult.userId) {
      return NextResponse.json(
        { success: false, message: "Cannot delete your own account" },
        { status: 403 },
      );
    }

    // Get existing user
    const existingUser = await UserService.findById(userId);
    if (!existingUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    // Delete user
    const deleted = await UserService.deleteUser(userId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Failed to delete user" },
        { status: 500 },
      );
    }

    // Create audit log
    await AuditService.createAuditLog(
      authResult.userId,
      "DELETE",
      "USER",
      userId,
      `Deleted user: ${existingUser.username} (${existingUser.role})`,
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
    );

    log.security("User deleted by admin", {
      adminId: authResult.userId,
      deletedUserId: userId,
      deletedUsername: existingUser.username,
      deletedUserRole: existingUser.role,
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    log.exception(error as Error, "ADMIN_USERS_DELETE", {
      path: "/api/admin/users",
    });

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
