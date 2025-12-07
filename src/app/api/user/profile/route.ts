import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/jwt';
import prisma from '@/lib/database/client';
import { AuditService } from '@/lib/database/services/audit.service';

/**
 * PUT /api/user/profile
 * Update user profile (username, fullName, profileImage)
 */
export async function PUT(request: NextRequest) {
  try {
    // Get token from cookie or header
    let token = null;
    const authHeader = request.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader
          .split(';')
          .map((c) => c.trim())
          .reduce(
            (acc, cookie) => {
              const [key, value] = cookie.split('=');
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
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token
    const tokenResult = auth.verifyToken(token);
    if (!tokenResult.isValid || !tokenResult.payload?.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = parseInt(tokenResult.payload.userId);

    // Get user
    const result = auth.verifyToken(token);
    
    if (!result.isValid || !result.payload?.userId) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(result.payload.userId) },
      // IMPORTANT: Exclude passwords/private keys
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        profileImage: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { username, fullName, profileImage, profileImagePath } = body;

    // Prepare update data
    const updateData: {
      username?: string;
      fullName?: string;
      profileImage?: string;
      profileImagePath?: string;
    } = {};

    // Organizations cannot change username
    if (username && user.role !== 'ORGANIZATION') {
      // Check if username is already taken
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });

      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json(
          { success: false, message: 'Username already taken' },
          { status: 400 }
        );
      }

      updateData.username = username;
    }

    if (fullName !== undefined) {
      updateData.fullName = fullName;
    }

    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
    }

    if (profileImagePath !== undefined) {
      updateData.profileImagePath = profileImagePath;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Create audit log
    await AuditService.createAuditLog(
      userId,
      'UPDATE',
      'USER_PROFILE',
      userId,
      `Updated profile: ${Object.keys(updateData).join(', ')}`,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        profileImage: updatedUser.profileImage,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
