import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/jwt";


const prisma = new PrismaClient();


// GET /api/voter/history
export async function GET(request: NextRequest) {
try {
let token = null;
const authHeader = request.headers.get("authorization");


if (authHeader?.startsWith("Bearer ")) {
token = authHeader.substring(7);
} else {
const cookieHeader = request.headers.get("cookie");
if (cookieHeader) {
const cookies = Object.fromEntries(
cookieHeader.split(";").map((c) => c.trim().split("="))
);
token = cookies.accessToken;
}
}


if (!token) {
return NextResponse.json(
{ success: false, message: "Authentication required" },
{ status: 401 }
);
}


const tokenResult = auth.verifyToken(token);
if (!tokenResult.isValid || !tokenResult.payload?.userId) {
return NextResponse.json(
{ success: false, message: "Invalid or expired token" },
{ status: 401 }
);
}


const userId = parseInt(tokenResult.payload.userId);


const votes = await prisma.vote.findMany({
where: { voterId: userId },
orderBy: { votedAt: "desc" },
include: {
election: {
include: {
organization: true,
_count: { select: { votes: true } },
},
},
},
});


return NextResponse.json({ success: true, data: votes });
} catch (error) {
return NextResponse.json(
{ success: false, message: "Internal server error" },
{ status: 500 }
);
} finally {
await prisma.$disconnect();
}
}