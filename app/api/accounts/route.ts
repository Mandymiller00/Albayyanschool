import { Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Only administrators can view account records" }, { status: 403 });
  }

  const [users, students] = await Promise.all([prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      studentProfile: { select: { studentCode: true, class: { select: { name: true } } } },
      teacherProfile: { select: { teacherCode: true } },
      parentLinks: { select: { student: { select: { fullName: true, studentCode: true } } } },
    },
  }), prisma.student.findMany({
    orderBy: [{ class: { name: "asc" } }, { fullName: "asc" }],
    select: { id: true, fullName: true, studentCode: true, class: { select: { name: true } } },
  })]);

  const accounts = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    identifier: user.studentProfile?.studentCode ?? user.teacherProfile?.teacherCode ?? null,
    className: user.studentProfile?.class.name ?? null,
    linkedStudents: user.parentLinks.map(({ student }) => ({ name: student.fullName, studentCode: student.studentCode })),
  }));

  return NextResponse.json({ accounts, students });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Only administrators can create or link parent accounts" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const studentId = typeof payload.studentId === "string" ? payload.studentId.trim() : "";
  const relationship = typeof payload.relationship === "string" ? payload.relationship.trim() : "";
  if (!name || !email || !studentId || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter the parent's name, a valid email, and a student" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, fullName: true, studentCode: true } });
  if (!student) return NextResponse.json({ error: "Selected student was not found" }, { status: 404 });

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } });
  if (existing && existing.role !== Role.PARENT) {
    return NextResponse.json({ error: "That email is already used by a non-parent account" }, { status: 409 });
  }

  const temporaryPassword = existing ? null : randomBytes(18).toString("base64url");
  const passwordHash = temporaryPassword ? await hash(temporaryPassword, 12) : null;
  const parent = await prisma.$transaction(async (transaction) => {
    const parentUser = existing ?? await transaction.user.create({
      data: { name, email, role: Role.PARENT, passwordHash: passwordHash! },
      select: { id: true, name: true, email: true },
    });
    await transaction.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parentUser.id, studentId } },
      create: { parentId: parentUser.id, studentId, relationship: relationship || null, isPrimary: true },
      update: { relationship: relationship || undefined },
    });
    return parentUser;
  });

  return NextResponse.json({
    parent: { id: parent.id, name: parent.name, email },
    student,
    created: !existing,
    ...(temporaryPassword ? { temporaryPassword } : {}),
  }, { status: existing ? 200 : 201 });
}
