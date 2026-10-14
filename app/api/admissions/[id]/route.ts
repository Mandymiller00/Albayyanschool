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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);

  let payload: { action?: unknown; note?: unknown; fullName?: unknown; studentCode?: unknown; classId?: unknown; guardianName?: unknown; guardianPhone?: unknown; address?: unknown };
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const action = payload.action;
  if (action !== "approve" && action !== "return" && action !== "reject" && action !== "resubmit") {
    return errorResponse("Choose approve, return, reject or resubmit", 400);
  }
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  if ((action === "return" || action === "reject") && !note) return errorResponse("Add a note explaining the requested action", 400);

  const { id } = await context.params;
  const admission = await prisma.admissionRequest.findUnique({ where: { id } });
  if (!admission) return errorResponse("Registration request not found", 404);

  if (action === "resubmit") {
    if (session.user.role !== Role.TEACHER || admission.submittedById !== session.user.id || admission.status !== AdmissionRequestStatus.RETURNED) {
      return errorResponse("Only the submitting teacher can resubmit a returned request", 403);
    }
    const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
    const studentCode = typeof payload.studentCode === "string" ? payload.studentCode.trim() : "";
    const classId = typeof payload.classId === "string" ? payload.classId.trim() : "";
    const guardianName = typeof payload.guardianName === "string" ? payload.guardianName.trim() : "";
    const guardianPhone = typeof payload.guardianPhone === "string" ? payload.guardianPhone.trim() : "";
    const address = typeof payload.address === "string" ? payload.address.trim() : "";
    if (!fullName || !studentCode || !classId || !guardianName || !guardianPhone) {
      return errorResponse("Student, class and guardian details are required", 400);
    }

    const assignedClass = await prisma.teachingAssignment.findFirst({
      where: { classId, teacher: { userId: session.user.id } },
      select: { id: true },
    });
    if (!assignedClass) return errorResponse("You can only resubmit to a class assigned to you", 403);
    const studentExists = await prisma.student.findUnique({ where: { studentCode }, select: { id: true } });
    const otherRequest = await prisma.admissionRequest.findFirst({
      where: { studentCode, status: AdmissionRequestStatus.PENDING, NOT: { id } },
      select: { id: true },
    });
    if (studentExists || otherRequest) return errorResponse("That student ID already exists or is used by another pending request", 409);

    const updated = await prisma.admissionRequest.update({
      where: { id },
      data: { fullName, studentCode, classId, guardianName, guardianPhone, address: address || null, status: AdmissionRequestStatus.PENDING, reviewNote: null, reviewedAt: null, reviewedById: null },
      include: { class: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ request: updated });
  }

  if (session.user.role !== Role.ADMIN) return errorResponse("Only administrators can review student registrations", 403);
  if (admission.status !== AdmissionRequestStatus.PENDING) return errorResponse("Only pending requests can be reviewed", 409);

  if (action === "approve") {
    const studentExists = await prisma.student.findUnique({ where: { studentCode: admission.studentCode }, select: { id: true } });
    if (studentExists) return errorResponse("A student with this ID already exists", 409);
  }

  const reviewerExists = session.user.id.startsWith("demo-")
    ? false
    : Boolean(await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } }));

  const credentials = action === "approve" ? generateStudentAccountCredentials(admission.studentCode) : null;
  const passwordHash = credentials ? await hash(credentials.temporaryPassword, 12) : null;
  const updatedRequest = await prisma.$transaction(async (transaction) => {
    let createdStudentId: string | undefined;
    if (action === "approve") {
      if (!credentials || !passwordHash) throw new Error("Student account credentials could not be generated");
      const user = await transaction.user.create({
        data: { name: admission.fullName, email: credentials.email, role: Role.STUDENT, passwordHash },
        select: { id: true },
      });
      const student = await transaction.student.create({
        data: {
          studentCode: admission.studentCode,
          fullName: admission.fullName,
          userId: user.id,
          dateOfBirth: admission.dateOfBirth,
          gender: admission.gender,
          address: admission.address,
          phone: admission.guardianPhone,
          emergencyContactName: admission.guardianName,
          emergencyContactPhone: admission.guardianPhone,
          classId: admission.classId,
        },
      });
      createdStudentId = student.id;
    }

    return transaction.admissionRequest.update({
      where: { id },
      data: {
        status: action === "approve"
          ? AdmissionRequestStatus.APPROVED
          : action === "return"
            ? AdmissionRequestStatus.RETURNED
            : AdmissionRequestStatus.REJECTED,
        reviewNote: note || null,
        reviewedAt: new Date(),
        reviewedById: reviewerExists ? session.user.id : null,
        createdStudentId,
      },
      include: {
        class: { select: { id: true, name: true } },
        createdStudent: { select: { id: true, studentCode: true, fullName: true } },
      },
    });
  });

  return NextResponse.json({ request: updatedRequest, ...(credentials ? { account: credentials } : {}) });
}