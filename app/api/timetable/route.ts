import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  const role = session.user.role;
  if (role === Role.ADMIN) {
    const slots = await prisma.timetableSlot.findMany({
      include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, fullName: true } } },
      orderBy: [{ class: { name: "asc" } }, { day: "asc" }, { startsAt: "asc" }],
    });
    const [classes, assignments] = await Promise.all([
      prisma.classRoom.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.teachingAssignment.findMany({ include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, fullName: true } } }, orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }] }),
    ]);
    return NextResponse.json({ slots, classes, assignments });
  }

  let classIds: string[] = [];
  if (role === Role.STUDENT) {
    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { classId: true } });
    if (!student) return errorResponse("Student profile is not linked to this account", 403);
    classIds = [student.classId];
  } else if (role === Role.PARENT) {
    const links = await prisma.parentStudent.findMany({ where: { parentId: session.user.id }, select: { student: { select: { classId: true } } } });
    classIds = [...new Set(links.map((link) => link.student.classId))];
  } else if (role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!teacher) return errorResponse("Teacher profile is not linked to this account", 403);
    const assignments = await prisma.teachingAssignment.findMany({ where: { teacherId: teacher.id }, select: { classId: true } });
    classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
  } else return errorResponse("You do not have access to timetables", 403);

  const slots = await prisma.timetableSlot.findMany({
    where: { classId: { in: classIds } },
    include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, fullName: true } } },
    orderBy: [{ class: { name: "asc" } }, { day: "asc" }, { startsAt: "asc" }],
  });
  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return errorResponse("Only administrators can manage the timetable", 403);
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return errorResponse("Invalid request body", 400); }

  const assignmentId = typeof payload.assignmentId === "string" ? payload.assignmentId.trim() : "";
  const day = typeof payload.day === "string" ? payload.day.toUpperCase() : "";
  const startsAt = typeof payload.startsAt === "string" ? payload.startsAt.trim() : "";
  const endsAt = typeof payload.endsAt === "string" ? payload.endsAt.trim() : "";
  const room = typeof payload.room === "string" ? payload.room.trim() : "";
  if (!assignmentId || !weekdays.includes(day as typeof weekdays[number]) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endsAt) || startsAt >= endsAt) {
    return errorResponse("Choose a class assignment, valid weekday, and valid start/end times", 400);
  }
  const assignment = await prisma.teachingAssignment.findUnique({ where: { id: assignmentId }, select: { classId: true, subjectId: true, teacherId: true } });
  if (!assignment) return errorResponse("Teaching assignment was not found", 404);
  const overlap = await prisma.timetableSlot.findFirst({ where: { classId: assignment.classId, day: day as typeof weekdays[number], startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
  if (overlap) return errorResponse("This class already has a timetable slot during that time", 409);
  const slot = await prisma.timetableSlot.create({
    data: { ...assignment, day: day as typeof weekdays[number], startsAt, endsAt, room: room || null },
    include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, fullName: true } } },
  });
  return NextResponse.json({ slot }, { status: 201 });
}
