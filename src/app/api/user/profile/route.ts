import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/jwt';
import { PrismaClient } from '@prisma/client'; // Use direct import if client wrapper not found
import { AuditService } from '@/lib/database/services/audit.service';

const prisma = new PrismaClient();

// Helper to verify token and return userId
function verifyAuth(request: NextRequest) {
  let token = null;
  const authHeader = request.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) acc[key] = decodeURIComponent(value);
        return acc;
      }, {} as Record<string, string>);
      token = cookies.accessToken;
    }
  }

  if (!token) return null;
  const result = auth.verifyToken(token);
  return result.isValid && result.payload?.userId ? parseInt(result.payload.userId) : null;
}

/**
 * GET /api/user/profile
 * Fetch user profile data
 */
export async function GET(request: NextRequest) {
  try {
    const userId = verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        studentId: true, // Added studentId since it's in your schema
        profileImage: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PUT /api/user/profile
 * Update user profile (username, fullName, profileImage)
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Get current user data to check role
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { username, fullName, studentId, profileImage, profileImagePath } = body;

    // Prepare update object
    const updateData: { username?: string; fullName?: string; studentId?: string; profileImage?: string; profileImagePath?: string } = {};

    // 1. Handle Username Update
    if (username && username !== currentUser.username) {
      // Logic: Organization might be restricted, but let's assume allowed if unique
      // Check uniqueness
      const existingUser = await prisma.user.findUnique({ where: { username } });
      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json({ success: false, message: 'Username already taken' }, { status: 400 });
      }
      updateData.username = username;
    }

    // 2. Handle Other Fields
    if (fullName !== undefined) updateData.fullName = fullName;
    if (studentId !== undefined) updateData.studentId = studentId;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (profileImagePath !== undefined) updateData.profileImagePath = profileImagePath;

    // 3. Update Database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        profileImage: true,
        role: true
      }
    });

    // 4. Create Audit Log
    try {
        const changes = Object.keys(updateData).join(', ');
        await AuditService.createAuditLog(
          userId,
          'UPDATE',
          'USER_PROFILE',
          userId,
          `Updated profile fields: ${changes}`,
          request.headers.get('x-forwarded-for') || 'unknown',
          request.headers.get('user-agent') || 'unknown'
        );
    } catch (e) { console.error("Audit log failed", e); }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}