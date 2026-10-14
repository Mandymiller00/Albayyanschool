import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  const { studentId } = await params;
  const accessFilter = session.user.role === Role.ADMIN
    ? { id: studentId }
    : session.user.role === Role.TEACHER
      ? { id: studentId, class: { assignments: { some: { teacher: { userId: session.user.id } } } } }
      : session.user.role === Role.STUDENT
        ? { id: studentId, userId: session.user.id }
        : session.user.role === Role.PARENT
          ? { id: studentId, parentLinks: { some: { parentId: session.user.id } } }
          : null;

  if (!accessFilter) return errorResponse("You do not have access to this student profile", 403);

  const student = await prisma.student.findFirst({
    where: accessFilter,
    select: {
      id: true,
      fullName: true,
      studentCode: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      passportPhotoUrl: true,
      address: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      medicalNotes: true,
      createdAt: true,
      user: { select: { email: true } },
      class: {
        select: {
          id: true,
          name: true,
          level: true,
          assignments: { select: { teacher: { select: { fullName: true } } } },
        },
      },
      parentLinks: {
        select: {
          relationship: true,
          isPrimary: true,
          parent: { select: { name: true, email: true } },
        },
      },
      enrollmentHistory: {
        orderBy: { startedAt: "desc" },
        select: { id: true, startedAt: true, endedAt: true, class: { select: { id: true, name: true, level: true } }, academicYear: { select: { name: true } } },
      },
    },
  });

  if (!student) return errorResponse("Student profile was not found", 404);
  return NextResponse.json({ student });
}

export async function POST(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return errorResponse("Only administrators can promote students", 403);
  const { studentId } = await params;
  let payload: { classId?: unknown; academicYearId?: unknown; effectiveDate?: unknown };
  try { payload = await request.json(); } catch { return errorResponse("Invalid request body", 400); }
  const classId = typeof payload.classId === "string" ? payload.classId.trim() : "";
  const academicYearId = typeof payload.academicYearId === "string" ? payload.academicYearId.trim() : "";
  const dateValue = typeof payload.effectiveDate === "string" ? payload.effectiveDate : "";
  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? new Date(`${dateValue}T00:00:00.000Z`) : null;
  if (!classId || !academicYearId || !effectiveDate || Number.isNaN(effectiveDate.getTime())) return errorResponse("Choose the new class, academic year, and a valid promotion date", 400);

  const [student, nextClass, year] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true, classId: true, fullName: true } }),
    prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true, name: true } }),
    prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true, name: true, startsAt: true, endsAt: true } }),
  ]);
  if (!student || !nextClass || !year) return errorResponse("Student, class or academic year was not found", 404);
  if (effectiveDate < year.startsAt || effectiveDate > year.endsAt) return errorResponse("Promotion date must fall within the selected academic year", 400);

  const updatedStudent = await prisma.$transaction(async (transaction) => {
    const currentEnrollment = await transaction.studentEnrollment.findFirst({ where: { studentId, endedAt: null }, orderBy: { startedAt: "desc" } });
    const endDate = new Date(effectiveDate);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    if (currentEnrollment) {
      await transaction.studentEnrollment.update({ where: { id: currentEnrollment.id }, data: { endedAt: endDate } });
    } else if (effectiveDate > year.startsAt && student.classId !== classId) {
      await transaction.studentEnrollment.create({ data: { studentId, classId: student.classId, academicYearId, startedAt: year.startsAt, endedAt: endDate } });
    }
    await transaction.studentEnrollment.create({ data: { studentId, classId, academicYearId, startedAt: effectiveDate } });
    return transaction.student.update({ where: { id: studentId }, data: { classId }, include: { class: { select: { id: true, name: true } } } });
  });

  return NextResponse.json({ student: updatedStudent, previousClassId: student.classId, academicYear: year.name });
}
