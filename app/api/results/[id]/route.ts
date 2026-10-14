import { ResultStatus, Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const transitions: Record<string, ResultStatus> = {
  start_review: ResultStatus.UNDER_REVIEW,
  approve: ResultStatus.APPROVED,
  publish: ResultStatus.PUBLISHED,
  lock: ResultStatus.LOCKED,
  return: ResultStatus.RETURNED,
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return errorResponse("Only administrators can review or publish results", 403);
  }

  let payload: { action?: unknown; note?: unknown };
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }
  if (typeof payload.action !== "string" || !transitions[payload.action]) {
    return errorResponse("Choose start_review, approve, return, publish or lock", 400);
  }
  const action = payload.action;
  const nextStatus = transitions[action];
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  if (action === "return" && !note) return errorResponse("Add a correction note before returning a result", 400);

  const { id } = await context.params;
  const result = await prisma.result.findUnique({ where: { id } });
  if (!result) return errorResponse("Result not found", 404);

  const validFrom: Record<string, ResultStatus[]> = {
    start_review: [ResultStatus.SUBMITTED],
    approve: [ResultStatus.UNDER_REVIEW],
    return: [ResultStatus.SUBMITTED, ResultStatus.UNDER_REVIEW],
    publish: [ResultStatus.APPROVED],
    lock: [ResultStatus.PUBLISHED],
  };
  if (!validFrom[action].includes(result.status)) {
    return errorResponse(`Cannot ${action.replace("_", " ")} a result in ${result.status.toLowerCase()} status`, 409);
  }

  const reviewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  const reviewerId = reviewer?.id ?? null;

  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.result.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewNote: action === "return" ? note : null,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true, class: { select: { id: true, name: true } } } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true } },
      },
    });
    await transaction.resultWorkflowEvent.create({
      data: { resultId: id, actorId: reviewerId, fromStatus: result.status, toStatus: nextStatus, note: note || null },
    });
    return next;
  });

  return NextResponse.json({ result: updated });
}