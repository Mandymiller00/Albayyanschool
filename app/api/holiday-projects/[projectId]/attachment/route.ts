import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getHolidayProjectAccess } from "@/lib/holiday-project-access";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.STUDENT && session.user.role !== Role.PARENT) {
    return errorResponse("You do not have access to holiday project attachments", 403);
  }
  const access = await getHolidayProjectAccess(session.user.id, session.user.role);
  if (!access) return errorResponse("Your school profile is not linked to this account", 403);
  const { projectId } = await params;
  const project = await prisma.holidayProject.findFirst({
    where: {
      id: projectId,
      ...(session.user.role === Role.TEACHER
        ? { teacherId: access.teacherId ?? "" }
        : { classId: { in: access.classIds } }),
    },
    select: { attachmentData: true, attachmentName: true, attachmentMimeType: true },
  });
  if (!project) return errorResponse("Holiday project attachment not found", 404);
  if (!project.attachmentData || !project.attachmentName || !project.attachmentMimeType) {
    return errorResponse("This project does not have an attachment", 404);
  }

  const safeName = encodeURIComponent(project.attachmentName);
  const inline = project.attachmentMimeType.startsWith("image/");
  return new Response(new Blob([Uint8Array.from(project.attachmentData)]), {
    headers: {
      "Content-Type": project.attachmentMimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`,
      "Content-Length": String(project.attachmentData.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
