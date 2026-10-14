import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getSyllabusAccess } from "@/lib/syllabus-access";
import { prisma } from "@/lib/prisma";

const maximumAttachmentSize = 10 * 1024 * 1024;
const supportedAttachments: Record<string, string> = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp",
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.STUDENT && session.user.role !== Role.PARENT) {
    return errorResponse("You do not have access to subject syllabi", 403);
  }

  const access = await getSyllabusAccess(session.user.id, session.user.role);
  if (!access) return errorResponse("Your school profile is not linked to this account", 403);
  const assignments = await prisma.teachingAssignment.findMany({
    where: session.user.role === Role.TEACHER
      ? { teacherId: access.teacherId ?? "" }
      : { classId: { in: access.classIds } },
    select: {
      id: true,
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { fullName: true } },
      syllabus: {
        select: {
          id: true,
          content: true,
          attachmentName: true,
          attachmentMimeType: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
  });
  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.TEACHER) {
    return errorResponse("Only teachers can create or update syllabi", 403);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumAttachmentSize + 64 * 1024) {
    return errorResponse("Attachments must be 10 MB or smaller", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Submit the syllabus as a form with an optional attachment", 400);
  }
  const assignmentId = String(form.get("assignmentId") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const removeAttachment = form.get("removeAttachment") === "true";
  if (!assignmentId || content.length > 30000) {
    return errorResponse("Choose a class and subject and keep syllabus text under 30,000 characters", 400);
  }

  const [teacher, assignment] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    prisma.teachingAssignment.findFirst({
      where: { id: assignmentId, teacher: { userId: session.user.id } },
      select: { id: true },
    }),
  ]);
  if (!teacher) return errorResponse("Teacher profile is not linked to this account", 403);
  if (!assignment) return errorResponse("Choose one of your assigned class and subject combinations", 403);

  const rawAttachment = form.get("attachment");
  let attachmentData: Uint8Array<ArrayBuffer> | undefined;
  let attachmentName: string | undefined;
  let attachmentMimeType: string | undefined;
  if (rawAttachment instanceof File && rawAttachment.size > 0) {
    if (rawAttachment.size > maximumAttachmentSize) return errorResponse("Attachments must be 10 MB or smaller", 413);
    const extension = rawAttachment.name.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "";
    const expectedMimeType = supportedAttachments[extension];
    if (!expectedMimeType || (rawAttachment.type && rawAttachment.type !== expectedMimeType)) {
      return errorResponse("Upload a PDF, Word, text, or JPG, PNG, GIF, or WEBP file", 415);
    }
    attachmentData = new Uint8Array(await rawAttachment.arrayBuffer());
    attachmentName = rawAttachment.name.replace(/[\\/\r\n"]/g, "_").slice(0, 180);
    attachmentMimeType = expectedMimeType;
  }

  if (!content && !attachmentData) {
    const existing = await prisma.subjectSyllabus.findUnique({
      where: { assignmentId: assignment.id },
      select: { id: true, attachmentData: true },
    });
    if (!existing?.attachmentData || removeAttachment) {
      return errorResponse("Add syllabus content or attach a file before publishing", 400);
    }
  }

  const attachmentUpdate = attachmentData
    ? { attachmentData, attachmentName, attachmentMimeType }
    : removeAttachment
      ? { attachmentData: null, attachmentName: null, attachmentMimeType: null }
      : {};
  const syllabus = await prisma.subjectSyllabus.upsert({
    where: { assignmentId: assignment.id },
    create: {
      assignmentId: assignment.id,
      teacherId: teacher.id,
      content,
      ...(attachmentData ? { attachmentData, attachmentName, attachmentMimeType } : {}),
    },
    update: { content, ...attachmentUpdate },
    select: { id: true, content: true, attachmentName: true, attachmentMimeType: true, updatedAt: true },
  });
  return NextResponse.json({ syllabus });
}
