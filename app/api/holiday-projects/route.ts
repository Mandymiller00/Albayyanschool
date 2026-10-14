import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getHolidayProjectAccess } from "@/lib/holiday-project-access";
import { prisma } from "@/lib/prisma";

const maximumAttachmentSize = 10 * 1024 * 1024;
const supportedAttachments: Record<string, { mimeType: string; inline: boolean }> = {
  ".pdf": { mimeType: "application/pdf", inline: false },
  ".doc": { mimeType: "application/msword", inline: false },
  ".docx": { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false },
  ".gif": { mimeType: "image/gif", inline: true },
  ".jpeg": { mimeType: "image/jpeg", inline: true },
  ".jpg": { mimeType: "image/jpeg", inline: true },
  ".png": { mimeType: "image/png", inline: true },
  ".webp": { mimeType: "image/webp", inline: true },
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export { maximumAttachmentSize, supportedAttachments };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.STUDENT && session.user.role !== Role.PARENT) {
    return errorResponse("You do not have access to holiday projects", 403);
  }

  const access = await getHolidayProjectAccess(session.user.id, session.user.role);
  if (!access) return errorResponse("Your school profile is not linked to this account", 403);
  const projects = await prisma.holidayProject.findMany({
    where: session.user.role === Role.TEACHER
      ? { teacherId: access.teacherId ?? "" }
      : { classId: { in: access.classIds } },
    select: {
      id: true,
      title: true,
      description: true,
      assignedAt: true,
      dueDate: true,
      attachmentName: true,
      attachmentMimeType: true,
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { fullName: true } },
      term: { select: { name: true, academicYear: { select: { name: true } } } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const assignments = session.user.role === Role.TEACHER && access.teacherId
    ? await prisma.teachingAssignment.findMany({
      where: { teacherId: access.teacherId },
      select: {
        id: true,
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
    })
    : [];

  return NextResponse.json({ projects, assignments });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.TEACHER) {
    return errorResponse("Only teachers can create holiday projects", 403);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumAttachmentSize + 64 * 1024) {
    return errorResponse("Attachments must be 10 MB or smaller", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Submit the project as a form with an optional attachment", 400);
  }

  const assignmentId = String(form.get("assignmentId") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const dueDateValue = String(form.get("dueDate") ?? "").trim();
  if (!assignmentId || !title || title.length > 140 || !description || description.length > 5000) {
    return errorResponse("Choose a class and subject, enter a title up to 140 characters, and instructions up to 5000 characters", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateValue)) {
    return errorResponse("Choose a valid project deadline", 400);
  }
  const dueDate = new Date(`${dueDateValue}T00:00:00.000Z`);
  if (Number.isNaN(dueDate.getTime()) || dueDate.toISOString().slice(0, 10) !== dueDateValue) {
    return errorResponse("Choose a valid project deadline", 400);
  }

  const [teacher, assignment, term] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    prisma.teachingAssignment.findFirst({
      where: { id: assignmentId, teacher: { userId: session.user.id } },
      select: { classId: true, subjectId: true },
    }),
    prisma.term.findFirst({
      where: { isCurrent: true, academicYear: { isCurrent: true } },
      select: { id: true },
    }),
  ]);
  if (!teacher) return errorResponse("Teacher profile is not linked to this account", 403);
  if (!assignment) return errorResponse("Choose one of your assigned class and subject combinations", 403);

  const rawAttachment = form.get("attachment");
  let attachmentData: Uint8Array<ArrayBuffer> | null = null;
  let attachmentName: string | null = null;
  let attachmentMimeType: string | null = null;
  if (rawAttachment instanceof File && rawAttachment.size > 0) {
    if (rawAttachment.size > maximumAttachmentSize) return errorResponse("Attachments must be 10 MB or smaller", 413);
    const extension = rawAttachment.name.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "";
    const attachmentType = supportedAttachments[extension];
    if (!attachmentType || (rawAttachment.type && rawAttachment.type !== attachmentType.mimeType)) {
      return errorResponse("Upload a PDF, Word document, or JPG, PNG, GIF, or WEBP image", 415);
    }
    attachmentData = new Uint8Array(await rawAttachment.arrayBuffer());
    attachmentName = rawAttachment.name.replace(/[\\/\r\n"]/g, "_").slice(0, 180);
    attachmentMimeType = attachmentType.mimeType;
  }

  const project = await prisma.holidayProject.create({
    data: {
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      teacherId: teacher.id,
      termId: term?.id ?? null,
      title,
      description,
      dueDate,
      attachmentData,
      attachmentName,
      attachmentMimeType,
    },
    select: {
      id: true,
      title: true,
      description: true,
      assignedAt: true,
      dueDate: true,
      attachmentName: true,
      attachmentMimeType: true,
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { fullName: true } },
      term: { select: { name: true, academicYear: { select: { name: true } } } },
    },
  });
  return NextResponse.json({ project }, { status: 201 });
}
