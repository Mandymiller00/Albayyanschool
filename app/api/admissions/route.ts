import { AdmissionRequestStatus, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateStudentAccountCredentials } from "@/lib/student-account";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);

  if (session.user.role === Role.ADMIN) {
    const [classes, students, requests] = await Promise.all([
      prisma.classRoom.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.student.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              assignments: { select: { teacher: { select: { fullName: true } } } },
            },
          },
          user: { select: { email: true } },
        },
      }),
      prisma.admissionRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          class: { select: { id: true, name: true } },
          submittedBy: { select: { name: true, email: true } },
          createdStudent: { select: { id: true, studentCode: true } },
        },
      }),
    ]);
    return NextResponse.json({ classes, students, requests });
  }

  if (session.user.role !== Role.TEACHER) return errorResponse("You do not have access to admissions", 403);

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!teacher) return errorResponse("Teacher profile is not linked to this account", 403);

  const [assignments, requests] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { teacherId: teacher.id },
      distinct: ["classId"],
      orderBy: { class: { name: "asc" } },
      select: { class: { select: { id: true, name: true } } },
    }),
    prisma.admissionRequest.findMany({
      where: { submittedById: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { class: { select: { id: true, name: true } } },
    }),
  ]);
  const classes = assignments.map(({ class: assignedClass }) => assignedClass);
  const students = await prisma.student.findMany({
    where: { classId: { in: classes.map((schoolClass) => schoolClass.id) } },
    orderBy: { fullName: "asc" },
    include: { class: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ classes, students, requests });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.TEACHER) {
    return errorResponse("You do not have permission to register students", 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const studentCode = typeof payload.studentCode === "string" ? payload.studentCode.trim() : "";
  const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
  const classId = typeof payload.classId === "string" ? payload.classId.trim() : "";
  const guardianName = typeof payload.guardianName === "string" ? payload.guardianName.trim() : "";
  const guardianPhone = typeof payload.guardianPhone === "string" ? payload.guardianPhone.trim() : "";
  const address = typeof payload.address === "string" ? payload.address.trim() : "";
  const gender = typeof payload.gender === "string" ? payload.gender.trim() : "";
  const dateOfBirth = typeof payload.dateOfBirth === "string" && payload.dateOfBirth ? new Date(payload.dateOfBirth) : null;

  if (!studentCode || !fullName || !classId || !guardianName || !guardianPhone) {
    return errorResponse("Student code, name, class, guardian and guardian phone are required", 400);
  }
  if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) return errorResponse("Date of birth is invalid", 400);

  if (session.user.role === Role.TEACHER) {
    const assignedClass = await prisma.teachingAssignment.findFirst({
      where: { classId, teacher: { userId: session.user.id } },
      select: { id: true },
    });
    if (!assignedClass) return errorResponse("You can only request registration to a class assigned to you", 403);
  } else {
    const schoolClass = await prisma.classRoom.findUnique({ where: { id: classId }, select: { id: true } });
    if (!schoolClass) return errorResponse("Selected class does not exist", 400);
  }

  const existingStudent = await prisma.student.findUnique({ where: { studentCode }, select: { id: true } });
  const pendingRequest = await prisma.admissionRequest.findFirst({
    where: { studentCode, status: AdmissionRequestStatus.PENDING },
    select: { id: true },
  });
  if (existingStudent || pendingRequest) return errorResponse("That student ID already exists or has a pending request", 409);

  const submittedById = session.user.id.startsWith("demo-") ? null : session.user.id;
  if (session.user.role === Role.ADMIN) {
    const credentials = generateStudentAccountCredentials(studentCode);
    const passwordHash = await hash(credentials.temporaryPassword, 12);
    const adminUserId = submittedById && await prisma.user.findUnique({ where: { id: submittedById }, select: { id: true } })
      ? submittedById
      : null;
    const { student } = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: fullName, email: credentials.email, role: Role.STUDENT, passwordHash },
        select: { id: true, email: true },
      });
      const createdStudent = await transaction.student.create({
        data: {
          studentCode,
          fullName,
          classId,
          userId: user.id,
          phone: guardianPhone,
          address: address || null,
          gender: gender || null,
          dateOfBirth,
          emergencyContactName: guardianName,
          emergencyContactPhone: guardianPhone,
        },
        include: { class: { select: { id: true, name: true } }, user: { select: { email: true } } },
      });
      await transaction.admissionRequest.create({
        data: {
          studentCode,
          fullName,
          classId,
          guardianName,
          guardianPhone,
          address: address || null,
          gender: gender || null,
          dateOfBirth,
          submittedById: adminUserId,
          reviewedById: adminUserId,
          reviewedAt: new Date(),
          reviewNote: "Registered directly by an administrator",
          status: AdmissionRequestStatus.APPROVED,
          createdStudentId: createdStudent.id,
        },
      });
      return { student: createdStudent };
    });
    return NextResponse.json({ student, account: { email: credentials.email, temporaryPassword: credentials.temporaryPassword } }, { status: 201 });
  }

  const admission = await prisma.admissionRequest.create({
    data: {
      studentCode,
      fullName,
      classId,
      guardianName,
      guardianPhone,
      address: address || null,
      gender: gender || null,
      dateOfBirth,
      submittedById,
    },
    include: { class: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ request: admission }, { status: 201 });
}