import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Only administrators can reset passwords" }, { status: 403 });
  }

  let payload: { password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a new password" }, { status: 400 });
  }
  const password = typeof payload.password === "string" ? payload.password : "";
  if (password.length < 12 || password.length > 128) {
    return NextResponse.json({ error: "The new password must be between 12 and 128 characters" }, { status: 400 });
  }

  const { userId } = await params;
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const passwordHash = await hash(password, 12);
  await prisma.user.update({ where: { id: account.id }, data: { passwordHash } });

  return NextResponse.json({ email: account.email });
}
