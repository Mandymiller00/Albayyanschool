import { AttendanceStatus, Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const attendanceStatuses = new Set<string>(Object.values(AttendanceStatus));

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

async function findTermForDate(date: Date) {
  const selectedTerm = await prisma.term.findFirst({
    where: { isCurrent: true },
    include: { academicYear: { select: { name: true } } },
  });
  if (selectedTerm) return selectedTerm;

  const activeAcademicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (activeAcademicYear) {
    return prisma.term.findFirst({
      where: {
        academicYearId: activeAcademicYear.id,
        startsAt: { lte: date },
        endsAt: { gte: date },
      },
      include: { academicYear: { select: { name: true } } },
    });
  }

  return prisma.term.findFirst({
    where: {
      startsAt: { lte: date },
      endsAt: { gte: date },
      academicYear: { isCurrent: true },
    },
    include: { academicYear: { select: { name: true } } },
  });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const requestedDate = dateParam ? parseDate(dateParam) : null;
  if (dateParam && !requestedDate) return errorResponse("Date must use YYYY-MM-DD format", 400);
  const today = new Date();
  const date = requestedDate ?? new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const term = await findTermForDate(date);
  if (!term) return NextResponse.json({ term: null, date: date.toISOString().slice(0, 10), classes: [], students: [], records: [] });

  const classId = url.searchParams.get("classId");
  let classIds: string[] | undefined;
  let classes: Array<{ id: string; name: string }> = [];
  let students;

  if (session.user.role === Role.ADMIN) {
    classes = await prisma.classRoom.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
    classIds = classId ? [classId] : classes.map((schoolClass) => schoolClass.id);
    students = await prisma.student.findMany({
      where: { classId: { in: classIds } },
      orderBy: [{ class: { name: "asc" } }, { fullName: "asc" }],
      include: { class: { select: { id: true, name: true } } },
    });
  } else if (session.user.role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!teacher) return errorResponse("Teacher profile is not linked to this account", 403);
    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacher.id },
      distinct: ["classId"],
      select: { classId: true, class: { select: { id: true, name: true } } },
    });
    classes = assignments.map((assignment) => assignment.class);
    classIds = classes.map((schoolClass) => schoolClass.id);
    if (classId && !classIds.includes(classId)) return errorResponse("You can only view an assigned class", 403);
    students = await prisma.student.findMany({
      where: { classId: { in: classId ? [classId] : classIds } },
      orderBy: [{ class: { name: "asc" } }, { fullName: "asc" }],
      include: { class: { select: { id: true, name: true } } },
    });
  } else if (session.user.role === Role.STUDENT) {
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { class: { select: { id: true, name: true } } },
    });
    if (!student) return errorResponse("Student profile is not linked to this account", 403);
    students = [student];
    classes = [student.class];
  } else if (session.user.role === Role.PARENT) {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: session.user.id },
      include: { student: { include: { class: { select: { id: true, name: true } } } } },
      orderBy: { student: { fullName: "asc" } },
    });
    students = links.map((link) => link.student);
    classes = [...new Map(students.map((student) => [student.class.id, student.class])).values()];
  } else {
    return errorResponse("You do not have access to attendance", 403);
  }

  const studentIds = students.map((student) => student.id);
  const records = await prisma.attendanceRecord.findMany({
    where: {
      termId: term.id,
      studentId: { in: studentIds },
      ...(session.user.role === Role.ADMIN || session.user.role === Role.TEACHER
        ? { date }
        : {}),
    },
    include: { student: { select: { id: true, fullName: true, studentCode: true, classId: true } } },
    orderBy: [{ date: "desc" }, { student: { fullName: "asc" } }],
  });

  return NextResponse.json({
    term: { id: term.id, name: term.name, academicYear: term.academicYear.name },
    date: date.toISOString().slice(0, 10),
    classes,
    students,
    records,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.TEACHER) {
    return errorResponse("Only administrators and teachers can record attendance", 403);
  }

  let payload: { classId?: unknown; date?: unknown; entries?: unknown };
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const classId = typeof payload.classId === "string" ? payload.classId : "";
  const dateValue = typeof payload.date === "string" ? payload.date : null;
  const date = parseDate(dateValue);
  if (!classId || !date || !Array.isArray(payload.entries) || payload.entries.length === 0) {
    return errorResponse("Choose a class and date and provide at least one attendance mark", 400);
  }

  const term = await findTermForDate(date);
  if (!term) return errorResponse("The selected date is outside the current academic term", 400);

  if (session.user.role === Role.TEACHER) {
    const assignment = await prisma.teachingAssignment.findFirst({
      where: { classId, teacher: { userId: session.user.id } },
      select: { id: true },
    });
    if (!assignment) return errorResponse("You can only record attendance for an assigned class", 403);
  } else {
    const schoolClass = await prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true } });
    if (!schoolClass) return errorResponse("Selected class does not exist", 400);
  }

  const entries = payload.entries as Array<{ studentId?: unknown; status?: unknown; note?: unknown }>;
  if (entries.some((entry) => typeof entry.studentId !== "string" || typeof entry.status !== "string" || !attendanceStatuses.has(entry.status))) {
    return errorResponse("Each student needs a valid attendance status", 400);
  }
  const normalizedEntries = entries.map((entry) => ({
    studentId: entry.studentId as string,
    status: entry.status as AttendanceStatus,
    note: typeof entry.note === "string" ? entry.note.trim() || null : null,
  }));
  const studentIds = normalizedEntries.map((entry) => entry.studentId);
  if (new Set(studentIds).size !== studentIds.length) return errorResponse("A student can only be marked once per date", 400);

  const matchingStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, classId },
    select: { id: true },
  });
  if (matchingStudents.length !== studentIds.length) return errorResponse("One or more students are not in the selected class", 400);

  const saved = await prisma.$transaction(normalizedEntries.map((entry) => prisma.attendanceRecord.upsert({
    where: { studentId_date: { studentId: entry.studentId, date } },
    create: { studentId: entry.studentId, termId: term.id, date, status: entry.status, note: entry.note },
    update: { termId: term.id, status: entry.status, note: entry.note },
  })));

  return NextResponse.json({ records: saved, count: saved.length });
}