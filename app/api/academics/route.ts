import { Role, TermName, Weekday } from "@prisma/client";
import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

const DEFAULT_SCHOOL_CLASSES = [
  { name: "Creche", level: "Primary" },
  { name: "Reception 1", level: "Primary" },
  { name: "Reception 2", level: "Primary" },
  { name: "Nursery 1", level: "Primary" },
  { name: "Nursery 2", level: "Primary" },
  { name: "Grade 1", level: "Primary" },
  { name: "Grade 2", level: "Primary" },
  { name: "Grade 3", level: "Primary" },
  { name: "Grade 4", level: "Primary" },
  { name: "JSS1", level: "Secondary" },
  { name: "JSS2", level: "Secondary" },
  { name: "JSS3", level: "Secondary" },
  { name: "SS1", level: "Secondary" },
  { name: "SS2", level: "Secondary" },
  { name: "SS3", level: "Secondary" },
] as const;

async function ensureDefaultSchoolClasses() {
  const existing = await prisma.classRoom.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((schoolClass) => schoolClass.name.toLowerCase()));
  const missing = DEFAULT_SCHOOL_CLASSES.filter(({ name }) => !existingNames.has(name.toLowerCase()));

  if (missing.length > 0) {
    await prisma.classRoom.createMany({
      data: missing.map(({ name, level }) => ({ name, level })),
    });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return errorResponse("Only administrators can manage academic setup", 403);
  await ensureDefaultSchoolClasses();

  const [classes, subjects, teachers, assignments, academicYears, timetableSlots] = await Promise.all([
    prisma.classRoom.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { students: true } },
        classSubjects: { include: { subject: { select: { id: true, name: true } } }, orderBy: { subject: { name: "asc" } } },
      },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    prisma.teacher.findMany({
      orderBy: { fullName: "asc" },
      include: {
        subject: { select: { id: true, name: true } },
        user: { select: { id: true, email: true } },
        assignments: { include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } } },
      },
    }),
    prisma.teachingAssignment.findMany({
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true, teacherCode: true } },
      },
    }),
    prisma.academicYear.findMany({
      orderBy: { startsAt: "desc" },
      include: { terms: { orderBy: { startsAt: "asc" } } },
    }),
    prisma.timetableSlot.findMany({ include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, fullName: true } } }, orderBy: [{ class: { name: "asc" } }, { day: "asc" }, { startsAt: "asc" }] }),
  ]);

  return NextResponse.json({ classes, subjects, teachers, assignments, academicYears, timetableSlots });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return errorResponse("Only administrators can manage academic setup", 403);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const action = text(payload.action);
  const classId = text(payload.classId);
  const subjectId = text(payload.subjectId);
  if (action !== "delete_class_subject" || !classId || !subjectId) {
    return errorResponse("A class subject deletion request is required", 400);
  }

  const [schoolClass, subject] = await Promise.all([
    prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true } }),
    prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } }),
  ]);
  if (!schoolClass || !subject) return errorResponse("Selected class or subject does not exist", 404);

  await prisma.$transaction(async (transaction) => {
    await transaction.timetableSlot.deleteMany({ where: { classId, subjectId } });
    await transaction.result.deleteMany({ where: { subjectId, student: { classId } } });
    await transaction.teachingAssignment.deleteMany({ where: { classId, subjectId } });
    await transaction.classSubject.deleteMany({ where: { classId, subjectId } });
  });

  return NextResponse.json({ removed: true, classId, subjectId });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return errorResponse("Only administrators can manage academic setup", 403);

  await ensureDefaultSchoolClasses();

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const action = text(payload.action);
  try {
    if (action === "create_academic_year") {
      const name = text(payload.name);
      const startsAt = parseDate(payload.startsAt);
      const endsAt = parseDate(payload.endsAt);
      const isCurrent = payload.isCurrent === true;
      const termData = [
        { name: TermName.FIRST, startsAt: parseDate(payload.firstTermStartsAt), endsAt: parseDate(payload.firstTermEndsAt), resumptionDate: parseDate(payload.firstTermResumptionDate) },
        { name: TermName.SECOND, startsAt: parseDate(payload.secondTermStartsAt), endsAt: parseDate(payload.secondTermEndsAt), resumptionDate: parseDate(payload.secondTermResumptionDate) },
        { name: TermName.THIRD, startsAt: parseDate(payload.thirdTermStartsAt), endsAt: parseDate(payload.thirdTermEndsAt), resumptionDate: parseDate(payload.thirdTermResumptionDate) },
      ];
      if (!name || name.length > 40 || !startsAt || !endsAt || startsAt >= endsAt) return errorResponse("Enter a session name and valid session start/end dates", 400);
      if (termData.some((term) => !term.startsAt || !term.endsAt || !term.resumptionDate || term.startsAt >= term.endsAt)) {
        return errorResponse("Each of the three terms requires valid start, end and resumption dates", 400);
      }
      const normalizedTermData = termData.map((term) => ({
        name: term.name,
        startsAt: term.startsAt as Date,
        endsAt: term.endsAt as Date,
        resumptionDate: term.resumptionDate as Date,
      }));
      if (normalizedTermData.some((term) => term.startsAt < startsAt || term.endsAt > endsAt || term.resumptionDate < startsAt || term.resumptionDate > endsAt)) {
        return errorResponse("Term dates and resumption dates must fall within the session dates", 400);
      }
      if (normalizedTermData.some((term, index) => index > 0 && term.startsAt < normalizedTermData[index - 1].endsAt)) {
        return errorResponse("Terms must be scheduled in chronological order without overlapping", 400);
      }

      const academicYear = await prisma.$transaction(async (transaction) => {
        if (isCurrent) {
          await transaction.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
          await transaction.term.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
        }
        const year = await transaction.academicYear.create({ data: { name, startsAt, endsAt, isCurrent } });
        await transaction.term.createMany({ data: normalizedTermData.map((term) => ({ academicYearId: year.id, ...term })) });
        return year;
      });
      return NextResponse.json({ academicYear }, { status: 201 });
    }

    if (action === "create_term") {
      const academicYearId = text(payload.academicYearId);
      const name = text(payload.name).toUpperCase();
      const startsAt = parseDate(payload.startsAt);
      const endsAt = parseDate(payload.endsAt);
      const resumptionDate = parseDate(payload.resumptionDate);
      if (!academicYearId || !Object.values(TermName).includes(name as TermName) || !startsAt || !endsAt || !resumptionDate || startsAt >= endsAt) {
        return errorResponse("Choose a session, term name, valid start/end dates and resumption date", 400);
      }
      const year = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
      if (!year) return errorResponse("Selected academic session does not exist", 404);
      const existingTermCount = await prisma.term.count({ where: { academicYearId } });
      if (existingTermCount >= 3) return errorResponse("This session already contains all three required terms", 409);
      if (startsAt < year.startsAt || endsAt > year.endsAt || resumptionDate < year.startsAt || resumptionDate > year.endsAt) {
        return errorResponse("Term and resumption dates must fall within the academic session", 400);
      }
      const term = await prisma.term.create({ data: { academicYearId, name: name as TermName, startsAt, endsAt, resumptionDate } });
      return NextResponse.json({ term }, { status: 201 });
    }

    if (action === "set_active_session") {
      const academicYearId = text(payload.academicYearId);
      if (!academicYearId) return errorResponse("Choose an academic session", 400);
      const year = await prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true } });
      if (!year) return errorResponse("Selected academic session does not exist", 404);
      const updatedYear = await prisma.$transaction(async (transaction) => {
        await transaction.academicYear.updateMany({ data: { isCurrent: false } });
        await transaction.term.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
        return transaction.academicYear.update({
          where: { id: academicYearId },
          data: { isCurrent: true },
          include: { terms: { orderBy: { startsAt: "asc" } } },
        });
      });
      return NextResponse.json({ academicYear: updatedYear }, { status: 200 });
    }

    if (action === "set_active_term") {
      const termId = text(payload.termId);
      if (!termId) return errorResponse("Choose an academic term", 400);
      const term = await prisma.term.findUnique({ where: { id: termId }, select: { id: true, academicYearId: true } });
      if (!term) return errorResponse("Selected academic term does not exist", 404);
      const updatedTerm = await prisma.$transaction(async (transaction) => {
        await transaction.term.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
        await transaction.academicYear.updateMany({ where: { id: { not: term.academicYearId } }, data: { isCurrent: false } });
        await transaction.academicYear.update({ where: { id: term.academicYearId }, data: { isCurrent: true } });
        return transaction.term.update({
          where: { id: termId },
          data: { isCurrent: true },
          include: { academicYear: { select: { id: true, name: true } } },
        });
      });
      return NextResponse.json({ term: updatedTerm }, { status: 200 });
    }

    if (action === "create_class_subject") {
      const classId = text(payload.classId);
      const name = text(payload.name);
      if (!classId || !name || name.length > 100) return errorResponse("Choose a class and enter a subject name up to 100 characters", 400);
      const schoolClass = await prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true } });
      if (!schoolClass) return errorResponse("Selected class does not exist", 404);
      const existingSubject = await prisma.subject.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, name: true } });
      if (existingSubject) {
        const existingClassSubject = await prisma.classSubject.findUnique({ where: { classId_subjectId: { classId, subjectId: existingSubject.id } } });
        if (existingClassSubject) return errorResponse("That subject is already linked to this class", 409);
      }
      const subject = existingSubject ?? await prisma.subject.create({ data: { name } });
      await prisma.$transaction(async (transaction) => {
        await transaction.classSubject.create({ data: { classId, subjectId: subject.id } });
        const assignedTeachers = await transaction.teachingAssignment.findMany({
          where: { classId },
          distinct: ["teacherId"],
          select: { teacherId: true },
        });
        if (assignedTeachers.length) {
          await transaction.teachingAssignment.createMany({
            data: assignedTeachers.map(({ teacherId }) => ({ teacherId, classId, subjectId: subject.id })),
            skipDuplicates: true,
          });
        }
      });
      return NextResponse.json({ subject, classId }, { status: 201 });
    }

    if (action === "delete_class_subject") {
      const classId = text(payload.classId);
      const subjectId = text(payload.subjectId);
      if (!classId || !subjectId) return errorResponse("Class and subject are required", 400);
      const schoolClass = await prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true } });
      const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
      if (!schoolClass || !subject) return errorResponse("Selected class or subject does not exist", 404);
      await prisma.classSubject.deleteMany({ where: { classId, subjectId } });
      return NextResponse.json({ removed: true, classId, subjectId });
    }

    if (action === "create_teacher") {
      const fullName = text(payload.fullName);
      const teacherCode = text(payload.teacherCode).toUpperCase();
      const email = text(payload.email).toLowerCase();
      const password = text(payload.initialPassword);
      const phone = text(payload.phone);
      const classId = text(payload.classId);
      if (!fullName || !teacherCode || !email || !classId) return errorResponse("Name, staff ID, email and class are required", 400);
      if (!/^\S+@\S+\.\S+$/.test(email)) return errorResponse("Enter a valid teacher email address", 400);
      if (password.length < 12) return errorResponse("Initial password must contain at least 12 characters", 400);

      const [schoolClass, classSubjects] = await Promise.all([
        prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true, name: true } }),
        prisma.classSubject.findMany({ where: { classId }, include: { subject: { select: { id: true, name: true } } }, orderBy: { subject: { name: "asc" } } }),
      ]);
      if (!schoolClass) return errorResponse("Selected class does not exist", 404);
      if (classSubjects.length === 0) return errorResponse("Add at least one subject to this class before creating a teacher", 400);

      const passwordHash = await hash(password, 12);
      const teacher = await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: { name: fullName, email, role: Role.TEACHER, passwordHash },
        });
        const createdTeacher = await transaction.teacher.create({
          data: { fullName, teacherCode, email, phone: phone || null, subjectId: classSubjects[0].subject.id, userId: user.id },
          include: { subject: { select: { id: true, name: true } }, user: { select: { id: true, email: true } } },
        });
        await transaction.teachingAssignment.createMany({
          data: classSubjects.map((classSubject) => ({ teacherId: createdTeacher.id, classId, subjectId: classSubject.subject.id })),
        });
        return createdTeacher;
      });
      return NextResponse.json({ teacher, className: schoolClass.name, assignedSubjects: classSubjects.map((classSubject) => classSubject.subject.name) }, { status: 201 });
    }

    if (action === "assign_teacher") {
      const teacherId = text(payload.teacherId);
      const classId = text(payload.classId);
      const subjectId = text(payload.subjectId);
      if (!teacherId || !classId || !subjectId) return errorResponse("Teacher, class and subject are required", 400);
      const [teacher, schoolClass, subject] = await Promise.all([
        prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } }),
        prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true } }),
        prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } }),
      ]);
      if (!teacher || !schoolClass || !subject) return errorResponse("Select an existing teacher, class and subject", 400);
      const classSubject = await prisma.classSubject.findUnique({ where: { classId_subjectId: { classId, subjectId } }, select: { classId: true, subjectId: true } });
      if (!classSubject) return errorResponse("The selected subject is not linked to the selected class", 409);
      const assignment = await prisma.$transaction(async (transaction) => {
        const classSubjects = await transaction.classSubject.findMany({ where: { classId }, select: { subjectId: true } });
        await transaction.teachingAssignment.createMany({
          data: classSubjects.map(({ subjectId: assignedSubjectId }) => ({ teacherId, classId, subjectId: assignedSubjectId })),
          skipDuplicates: true,
        });
        return transaction.teachingAssignment.findUnique({
          where: { teacherId_classId_subjectId: { teacherId, classId, subjectId } },
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, fullName: true, teacherCode: true } },
          },
        });
      });
      return NextResponse.json({ assignment }, { status: 201 });
    }

    if (action === "create_timetable_slot") {
      const assignmentId = text(payload.assignmentId);
      const day = text(payload.day).toUpperCase();
      const startsAt = text(payload.startsAt);
      const endsAt = text(payload.endsAt);
      const room = text(payload.room);
      const validWeekdays = Object.values(Weekday);
      if (!assignmentId || !validWeekdays.includes(day as Weekday) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endsAt) || startsAt >= endsAt) {
        return errorResponse("Choose an assignment, valid weekday, and valid start/end times", 400);
      }
      const normalizedDay = day as Weekday;
      const assignment = await prisma.teachingAssignment.findUnique({ where: { id: assignmentId }, select: { classId: true, subjectId: true, teacherId: true } });
      if (!assignment) return errorResponse("Teaching assignment was not found", 404);
      const overlap = await prisma.timetableSlot.findFirst({ where: { classId: assignment.classId, day: normalizedDay, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
      if (overlap) return errorResponse("This class already has a timetable slot during that time", 409);
      const slot = await prisma.timetableSlot.create({
        data: { ...assignment, day: normalizedDay, startsAt, endsAt, room: room || null },
        include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, fullName: true } } },
      });
      return NextResponse.json({ slot }, { status: 201 });
    }

    return errorResponse("Choose a supported academic setup action", 400);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return errorResponse("That class, subject, staff ID, email or assignment already exists", 409);
    }
    throw error;
  }
}