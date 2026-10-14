import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getSyllabusAccess } from "@/lib/syllabus-access";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.STUDENT && session.user.role !== Role.PARENT) {
    return errorResponse("You do not have access to this syllabus attachment", 403);
  }
  const access = await getSyllabusAccess(session.user.id, session.user.role);
  if (!access) return errorResponse("Your school profile is not linked to this account", 403);
  const { assignmentId } = await params;
  const assignment = await prisma.teachingAssignment.findFirst({
    where: session.user.role === Role.TEACHER
      ? { id: assignmentId, teacherId: access.teacherId ?? "" }
      : { id: assignmentId, classId: { in: access.classIds } },
    select: {
      syllabus: { select: { attachmentData: true, attachmentName: true, attachmentMimeType: true } },
    },
  });
  if (!assignment) return errorResponse("Syllabus not found", 404);
  const { attachmentData, attachmentName, attachmentMimeType } = assignment.syllabus ?? {};
  if (!attachmentData || !attachmentName || !attachmentMimeType) return errorResponse("This syllabus has no attachment", 404);

  const safeName = encodeURIComponent(attachmentName);
  const inline = attachmentMimeType.startsWith("image/") || attachmentMimeType === "application/pdf" || attachmentMimeType === "text/plain";
  return new Response(new Blob([Uint8Array.from(attachmentData)]), {
    headers: {
      "Content-Type": attachmentMimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`,
      "Content-Length": String(attachmentData.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
