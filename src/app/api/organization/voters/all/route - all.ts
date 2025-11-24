import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // 1. Auth Check
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    let decoded;
    try {
        decoded = auth.verifyToken(token).payload;
    } catch {
        return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    // 2. Ambil semua user dengan role VOTER dan status ACTIVE
    // Anda bisa menyesuaikan filter ini sesuai kebutuhan
    const potentialVoters = await prisma.user.findMany({
      where: {
        role: "VOTER",
        status: "ACTIVE"
      },
      select: {
        id: true,
        username: true,
        email: true
      }
    });

    return NextResponse.json({ success: true, data: potentialVoters });

  } catch (error) {
    console.error("Error fetching all voters:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}