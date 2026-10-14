import { AnnouncementAudience, Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const audienceValues = new Set<string>(Object.values(AnnouncementAudience));

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);

  let classIds: string[] = [];
  if (session.user.role === Role.STUDENT) {
    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { classId: true } });
    if (!student) return errorResponse("Student profile is not linked to this account", 403);
    classIds = [student.classId];
  } else if (session.user.role === Role.PARENT) {
    const links = await prisma.parentStudent.findMany({ where: { parentId: session.user.id }, select: { student: { select: { classId: true } } } });
    classIds = [...new Set(links.map((link) => link.student.classId))];
  } else if (session.user.role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!teacher) return errorResponse("Teacher profile is not linked to this account", 403);
    const assignments = await prisma.teachingAssignment.findMany({ where: { teacherId: teacher.id }, select: { classId: true } });
    classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
  }

  const roleAudience = session.user.role === Role.ADMIN
    ? undefined
    : session.user.role === Role.TEACHER
      ? [AnnouncementAudience.ALL, AnnouncementAudience.STAFF, AnnouncementAudience.STUDENTS, AnnouncementAudience.PARENTS, AnnouncementAudience.CLASS]
      : session.user.role === Role.STUDENT
        ? [AnnouncementAudience.ALL, AnnouncementAudience.STUDENTS, AnnouncementAudience.CLASS]
        : [AnnouncementAudience.ALL, AnnouncementAudience.PARENTS, AnnouncementAudience.CLASS];

  const announcements = await prisma.announcement.findMany({
    where: {
      ...(roleAudience ? { audience: { in: roleAudience } } : {}),
      ...(session.user.role === Role.ADMIN
        ? {}
        : { OR: [{ audience: { not: AnnouncementAudience.CLASS } }, { audience: AnnouncementAudience.CLASS, classId: { in: classIds } }] }),
    },
    include: { class: { select: { id: true, name: true } }, author: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
  });
  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return errorResponse("Only administrators can publish announcements", 403);

  let payload: { title?: unknown; body?: unknown; audience?: unknown; classId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const audience = typeof payload.audience === "string" ? payload.audience : "";
  const classId = typeof payload.classId === "string" ? payload.classId : "";
  if (!title || title.length > 140 || !body || body.length > 5000) return errorResponse("Enter a title up to 140 characters and message up to 5000 characters", 400);
  if (!audienceValues.has(audience)) return errorResponse("Choose a valid announcement audience", 400);
  if (audience === AnnouncementAudience.CLASS && !classId) return errorResponse("Select a class for a class-targeted announcement", 400);
  if (audience !== AnnouncementAudience.CLASS && classId) return errorResponse("Class can only be selected for class-targeted announcements", 400);

  const author = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      audience: audience as AnnouncementAudience,
      classId: audience === AnnouncementAudience.CLASS ? classId : null,
      authorId: author?.id ?? null,
      publishedAt: new Date(),
    },
    include: { class: { select: { id: true, name: true } }, author: { select: { name: true } } },
  });
  return NextResponse.json({ announcement }, { status: 201 });
}