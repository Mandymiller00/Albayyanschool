import { ResultStatus, Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function currentTerm() {
  return prisma.term.findFirst({
    where: { isCurrent: true, academicYear: { isCurrent: true } },
    include: { academicYear: { select: { name: true, isCurrent: true } } },
  });
}

const resultRelations = {
  student: { select: { id: true, fullName: true, studentCode: true, class: { select: { id: true, name: true } } } },
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true } },
  term: { select: { id: true, name: true, academicYear: { select: { name: true } } } },
  events: { orderBy: { createdAt: "desc" as const }, include: { actor: { select: { name: true } } } },
};

async function parentPublishedHistory(studentIds: string[]) {
  const records = await prisma.result.findMany({
    where: {
      studentId: { in: studentIds },
      status: { in: [ResultStatus.PUBLISHED, ResultStatus.LOCKED] },
    },
    select: {
      id: true,
      studentId: true,
      marks: true,
      maxMarks: true,
      student: { select: { fullName: true } },
      subject: { select: { name: true } },
      term: { select: { id: true, name: true, startsAt: true, academicYear: { select: { name: true } } } },
    },
    orderBy: [{ term: { startsAt: "asc" } }, { subject: { name: "asc" } }],
  });
  return records.map((record) => ({
    id: record.id,
    studentId: record.studentId,
    studentName: record.student.fullName,
    subject: record.subject.name,
    score: Number(record.marks),
    outOf: Number(record.maxMarks),
    termId: record.term.id,
    termName: record.term.name,
    academicYear: record.term.academicYear.name,
    startsAt: record.term.startsAt,
  }));
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return errorResponse("Authentication required", 401);
  const activeTerm = await currentTerm();
  let term = activeTerm;
  let academicYears: Awaited<ReturnType<typeof prisma.academicYear.findMany>> = [];
  let selectedSessionId = "";
  let selectedSessionName = "";
  let sessionResultsView = false;
  if (session.user.role === Role.TEACHER) {
    const url = new URL(request.url);
    const requestedTermId = url.searchParams.get("termId");
    academicYears = await prisma.academicYear.findMany({
      orderBy: { startsAt: "desc" },
      include: { terms: { orderBy: { startsAt: "asc" } } },
    });
    if (url.searchParams.get("activeOnly") === "true") {
      return NextResponse.json({ activeTermId: activeTerm?.id ?? null, academicYears });
    }
    if (requestedTermId) {
      term = await prisma.term.findUnique({
        where: { id: requestedTermId },
        include: { academicYear: { select: { id: true, name: true, isCurrent: true } } },
      });
      if (!term) return errorResponse("Selected academic term does not exist", 404);
    }
  } else if (session.user.role === Role.STUDENT || session.user.role === Role.PARENT) {
    const url = new URL(request.url);
    const requestedTermId = url.searchParams.get("termId");
    selectedSessionId = url.searchParams.get("sessionId") ?? "";
    sessionResultsView = Boolean(selectedSessionId);
    academicYears = await prisma.academicYear.findMany({
      orderBy: { startsAt: "desc" },
      include: { terms: { orderBy: { startsAt: "asc" } } },
    });
    if (sessionResultsView) {
      const academicYear = academicYears.find((year) => year.id === selectedSessionId);
      if (!academicYear) return errorResponse("Selected academic session does not exist", 404);
      selectedSessionName = academicYear.name;
      term = null;
    } else if (requestedTermId) {
      term = await prisma.term.findUnique({
        where: { id: requestedTermId },
        include: { academicYear: { select: { id: true, name: true, isCurrent: true } } },
      });
      if (!term) return errorResponse("Selected academic term does not exist", 404);
    }
  }
  if (!term && session.user.role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!teacher) return errorResponse("Teacher profile is not linked to this account", 403);
    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacher.id },
      include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
    });
    const classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
    const [students] = await Promise.all([
      prisma.student.findMany({ where: { classId: { in: classIds } }, include: { class: { select: { id: true, name: true } } }, orderBy: [{ class: { name: "asc" } }, { fullName: "asc" }] }),
    ]);
    const subjects = assignments.map((assignment) => assignment.subject).filter((subject, index, list) => list.findIndex((item) => item.id === subject.id) === index);
    return NextResponse.json({ term: null, activeTermId: activeTerm?.id ?? null, academicYears, assignments, students, subjects, results: [], termResults: [] });
  }
  if (!term && !sessionResultsView) {
    if (session.user.role === Role.STUDENT) {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
        select: { id: true, fullName: true, studentCode: true, class: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ term: null, activeTermId: activeTerm?.id ?? null, academicYears, students: student ? [student] : [], results: [] });
    }
    if (session.user.role === Role.PARENT) {
      const links = await prisma.parentStudent.findMany({
        where: { parentId: session.user.id },
        select: { student: { select: { id: true, fullName: true, studentCode: true, class: { select: { id: true, name: true } } } } },
        orderBy: { student: { fullName: "asc" } },
      });
      const history = await parentPublishedHistory(links.map((link) => link.student.id));
      return NextResponse.json({ term: null, activeTermId: activeTerm?.id ?? null, academicYears, students: links.map((link) => link.student), results: [], history });
    }
    return NextResponse.json({ term: null, assignments: [], students: [], subjects: [], results: [] });
  }

  if (session.user.role === Role.ADMIN && term) {
    const [results, students, assignments] = await Promise.all([
      prisma.result.findMany({
        where: { termId: term.id },
        include: resultRelations,
        orderBy: [{ status: "asc" }, { student: { fullName: "asc" } }, { subject: { name: "asc" } }],
      }),
      prisma.student.findMany({ include: { class: { select: { id: true, name: true } } }, orderBy: [{ class: { name: "asc" } }, { fullName: "asc" }] }),
      prisma.teachingAssignment.findMany({
        include: { teacher: { select: { id: true, fullName: true } }, class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
        orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
      }),
    ]);
    return NextResponse.json({ term: { id: term.id, name: term.name, academicYear: term.academicYear.name }, assignments, students, subjects: [], results });
  }

  if (session.user.role === Role.TEACHER && term) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!teacher) return errorResponse("Teacher profile is not linked to this account", 403);
    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacher.id },
      include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
    });
    const classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
    const assignmentPairs = assignments.map((assignment) => ({
      student: { classId: assignment.classId },
      subjectId: assignment.subjectId,
    }));
    const [enrollments, termStudentRows] = await Promise.all([
      prisma.studentEnrollment.findMany({
        where: { academicYearId: term.academicYearId, classId: { in: classIds } },
        include: { class: { select: { id: true, name: true } } },
        orderBy: { startedAt: "desc" },
      }),
      prisma.result.findMany({ where: { teacherId: teacher.id, termId: term.id }, select: { studentId: true } }),
    ]);
    const sessionClassByStudent = new Map<string, { id: string; name: string }>();
    for (const enrollment of enrollments) {
      if (!sessionClassByStudent.has(enrollment.studentId)) sessionClassByStudent.set(enrollment.studentId, enrollment.class);
    }
    const rosterIds = [...new Set([...sessionClassByStudent.keys(), ...termStudentRows.map((row) => row.studentId)])];
    const [sessionStudents, results, termResults] = await Promise.all([
      prisma.student.findMany({
        where: rosterIds.length ? { id: { in: rosterIds } } : { classId: { in: classIds } },
        include: { class: { select: { id: true, name: true } } },
        orderBy: [{ class: { name: "asc" } }, { fullName: "asc" }],
      }),
      prisma.result.findMany({ where: { teacherId: teacher.id, termId: term.id }, include: resultRelations, orderBy: [{ student: { fullName: "asc" } }, { subject: { name: "asc" } }] }),
      prisma.result.findMany({
        where: {
          OR: [...assignmentPairs, { teacherId: teacher.id }],
          term: { academicYearId: term.academicYearId, startsAt: { lte: term.startsAt } },
        },
        select: { studentId: true, subjectId: true, termId: true, marks: true, maxMarks: true, ca1: true, ca2: true, ca3: true, exam: true },
      }),
    ]);
    const students = sessionStudents.map((student) => ({
      ...student,
      class: sessionClassByStudent.get(student.id) ?? student.class,
    }));
    const subjects = assignments.map((assignment) => assignment.subject).filter((subject, index, list) => list.findIndex((item) => item.id === subject.id) === index);
    return NextResponse.json({
      term: { id: term.id, name: term.name, academicYear: term.academicYear.name },
      activeTermId: activeTerm?.id ?? null,
      academicYears,
      assignments,
      students,
      subjects,
      results,
      termResults,
    });
  }

  if (session.user.role === Role.STUDENT) {
    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return errorResponse("Student profile is not linked to this account", 403);
    const profile = await prisma.student.findUnique({
      where: { id: student.id },
      select: { id: true, fullName: true, studentCode: true, class: { select: { id: true, name: true } } },
    });
    const [results, cumulativeResults] = await Promise.all([
      prisma.result.findMany({
        where: {
          studentId: student.id,
          ...(sessionResultsView ? { term: { academicYearId: selectedSessionId } } : { termId: term?.id }),
          status: { in: [ResultStatus.PUBLISHED, ResultStatus.LOCKED] },
        },
        include: { ...resultRelations, events: false },
        orderBy: [{ term: { startsAt: "asc" } }, { subject: { name: "asc" } }],
      }),
      !sessionResultsView && term
        ? prisma.result.findMany({
          where: {
            studentId: student.id,
            term: { academicYearId: term.academicYearId, startsAt: { lte: term.startsAt } },
            status: { in: [ResultStatus.PUBLISHED, ResultStatus.LOCKED] },
          },
          select: { studentId: true, subjectId: true, termId: true, marks: true, maxMarks: true, ca1: true, ca2: true, ca3: true, exam: true },
        })
        : Promise.resolve([]),
    ]);
    const sessionCumulativeResults = sessionResultsView
      ? results.map(({ studentId, subjectId, termId, marks, maxMarks, ca1, ca2, ca3, exam }) => ({ studentId, subjectId, termId, marks, maxMarks, ca1, ca2, ca3, exam }))
      : cumulativeResults;
    return NextResponse.json({
      term: sessionResultsView
        ? { id: selectedSessionId, name: "SESSION", academicYear: selectedSessionName }
        : term ? { id: term.id, name: term.name, academicYear: term.academicYear.name } : null,
      view: sessionResultsView ? "session" : "term",
      activeTermId: activeTerm?.id ?? null,
      academicYears,
      students: profile ? [profile] : [],
      results,
      cumulativeResults: sessionCumulativeResults,
    });
  }

  if (session.user.role === Role.PARENT) {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: session.user.id },
      select: { student: { select: { id: true, fullName: true, studentCode: true, class: { select: { id: true, name: true } } } } },
      orderBy: { student: { fullName: "asc" } },
    });
    const [results, cumulativeResults, history] = await Promise.all([
      prisma.result.findMany({
        where: {
          studentId: { in: links.map((link) => link.student.id) },
          ...(sessionResultsView ? { term: { academicYearId: selectedSessionId } } : { termId: term?.id }),
          status: { in: [ResultStatus.PUBLISHED, ResultStatus.LOCKED] },
        },
        include: { ...resultRelations, events: false },
        orderBy: [{ term: { startsAt: "asc" } }, { student: { fullName: "asc" } }, { subject: { name: "asc" } }],
      }),
      !sessionResultsView && term
        ? prisma.result.findMany({
          where: {
            studentId: { in: links.map((link) => link.student.id) },
            term: { academicYearId: term.academicYearId, startsAt: { lte: term.startsAt } },
            status: { in: [ResultStatus.PUBLISHED, ResultStatus.LOCKED] },
          },
          select: { studentId: true, subjectId: true, termId: true, marks: true, maxMarks: true, ca1: true, ca2: true, ca3: true, exam: true },
        })
        : Promise.resolve([]),
      parentPublishedHistory(links.map((link) => link.student.id)),
    ]);
    const sessionCumulativeResults = sessionResultsView
      ? results.map(({ studentId, subjectId, termId, marks, maxMarks, ca1, ca2, ca3, exam }) => ({ studentId, subjectId, termId, marks, maxMarks, ca1, ca2, ca3, exam }))
      : cumulativeResults;
    return NextResponse.json({
      term: sessionResultsView
        ? { id: selectedSessionId, name: "SESSION", academicYear: selectedSessionName }
        : term ? { id: term.id, name: term.name, academicYear: term.academicYear.name } : null,
      view: sessionResultsView ? "session" : "term",
      activeTermId: activeTerm?.id ?? null,
      academicYears,
      students: links.map((link) => link.student),
      results,
      cumulativeResults: sessionCumulativeResults,
      history,
    });
  }

  return errorResponse("You do not have access to results", 403);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.TEACHER) {
    return errorResponse("Only teachers can enter class results", 403);
  }

  let payload: { action?: unknown; entries?: unknown; termId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }
  if (payload.action !== "draft" && payload.action !== "submit") return errorResponse("Choose draft or submit", 400);
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) return errorResponse("Provide at least one result entry", 400);

  const teacherId = (await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } }))?.id;
  if (!teacherId) return errorResponse("Teacher profile is not linked to this account", 403);
  const activeTerm = await currentTerm();
  const requestedTermId = typeof payload.termId === "string" ? payload.termId : "";
  const term = requestedTermId
    ? await prisma.term.findUnique({ where: { id: requestedTermId } })
    : activeTerm;
  if (!term) return errorResponse("There is no selected term for result entry", 409);

  const entries = payload.entries as Array<{ studentId?: unknown; subjectId?: unknown; marks?: unknown; maxMarks?: unknown; ca1?: unknown; ca2?: unknown; ca3?: unknown; exam?: unknown; comments?: unknown; behavioralRating?: unknown; behavioralComment?: unknown; psychomotorRating?: unknown; psychomotorComment?: unknown }>;
  if (entries.some((entry) => typeof entry.studentId !== "string" || typeof entry.subjectId !== "string")) {
    return errorResponse("Each entry needs a student and subject", 400);
  }
  const normalized = entries.map((entry) => {
    const components = [entry.ca1, entry.ca2, entry.ca3, entry.exam].map((value) => typeof value === "number" && Number.isFinite(value) ? value : null);
    const hasComponentScores = components.some((value) => value !== null);
    return {
      studentId: entry.studentId as string,
      subjectId: entry.subjectId as string,
      marks: hasComponentScores
        ? components.reduce<number>((total, value) => total + (value ?? 0), 0)
        : typeof entry.marks === "number" && Number.isFinite(entry.marks) ? entry.marks : null,
      maxMarks: hasComponentScores ? 100 : typeof entry.maxMarks === "number" && Number.isFinite(entry.maxMarks) ? entry.maxMarks : 100,
      ca1: components[0],
      ca2: components[1],
      ca3: components[2],
      exam: components[3],
      comments: typeof entry.comments === "string" ? entry.comments.trim() || null : null,
      behavioralRating: typeof entry.behavioralRating === "number" && Number.isInteger(entry.behavioralRating) ? entry.behavioralRating : null,
      behavioralComment: typeof entry.behavioralComment === "string" ? entry.behavioralComment.trim() || null : null,
      psychomotorRating: typeof entry.psychomotorRating === "number" && Number.isInteger(entry.psychomotorRating) ? entry.psychomotorRating : null,
      psychomotorComment: typeof entry.psychomotorComment === "string" ? entry.psychomotorComment.trim() || null : null,
    };
  });
  const keys = normalized.map((entry) => `${entry.studentId}:${entry.subjectId}`);
  if (new Set(keys).size !== keys.length) return errorResponse("A student and subject can only be included once", 400);
  const scoreFields = ["marks", "ca1", "ca2", "ca3", "exam"] as const;
  if (normalized.some((entry) => scoreFields.some((field) => entry[field] !== null && (entry[field] < 0 || entry[field] > entry.maxMarks)))) {
    return errorResponse("Scores must be between zero and the maximum mark", 400);
  }
  if (normalized.some((entry) => [entry.ca1, entry.ca2, entry.ca3].some((score) => score !== null && score > 10))) {
    return errorResponse("Each CA score must be between zero and 10", 400);
  }
  if (normalized.some((entry) => entry.exam !== null && entry.exam > 70)) {
    return errorResponse("The exam score must be between zero and 70", 400);
  }
  if (payload.action === "submit" && normalized.some((entry) => [entry.ca1, entry.ca2, entry.ca3, entry.exam].some((score) => score !== null) && [entry.ca1, entry.ca2, entry.ca3, entry.exam].some((score) => score === null))) {
    return errorResponse("Complete all four assessment components before submitting results", 400);
  }
  if (payload.action === "submit" && normalized.some((entry) => entry.marks === null
    && entry.behavioralRating === null && !entry.behavioralComment
    && entry.psychomotorRating === null && !entry.psychomotorComment)) {
    return errorResponse("Enter a subject score before submitting this result", 400);
  }
  if (normalized.some((entry) => entry.maxMarks <= 0)) return errorResponse("The maximum mark must be greater than zero", 400);
  if (normalized.some((entry) => [entry.behavioralRating, entry.psychomotorRating].some((rating) => rating !== null && (rating < 1 || rating > 5)))) {
    return errorResponse("Behavior and psychomotor ratings must be between 1 and 5", 400);
  }
  if (normalized.every((entry) => scoreFields.every((field) => entry[field] === null)
    && entry.behavioralRating === null && !entry.behavioralComment && entry.psychomotorRating === null && !entry.psychomotorComment)) {
    return errorResponse("Enter a score or assessment before saving", 400);
  }

  const assignments = await prisma.teachingAssignment.findMany({ where: { teacherId } });
  const validPairs = new Set(assignments.map((assignment) => `${assignment.classId}:${assignment.subjectId}`));
  const students = await prisma.student.findMany({ where: { id: { in: normalized.map((entry) => entry.studentId) } }, select: { id: true, classId: true } });
  const classByStudent = new Map(students.map((student) => [student.id, student.classId]));
  const existingResults = await prisma.result.findMany({
    where: {
      termId: term.id,
      OR: normalized.map(({ studentId, subjectId }) => ({ studentId, subjectId })),
    },
    select: { studentId: true, subjectId: true, teacherId: true, status: true },
  });
  const existingByKey = new Map(existingResults.map((result) => [`${result.studentId}:${result.subjectId}`, result]));
  for (const entry of normalized) {
    const existing = existingByKey.get(`${entry.studentId}:${entry.subjectId}`);
    if (existing) {
      if (existing.teacherId !== teacherId) return errorResponse("You can only edit results that you entered", 403);
      if (existing.status !== ResultStatus.DRAFT && existing.status !== ResultStatus.RETURNED) {
        return errorResponse("A submitted or reviewed result cannot be edited", 409);
      }
      continue;
    }
    if (term.id !== activeTerm?.id) return errorResponse("New results can only be recorded for the admin-selected active term", 409);
    if (!validPairs.has(`${classByStudent.get(entry.studentId)}:${entry.subjectId}`)) {
      return errorResponse("One or more students or subjects are outside your teaching assignments", 403);
    }
  }

  const actor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  const actorId = actor?.id ?? null;

  const resultIds = await prisma.$transaction(async (transaction) => {
    const updatedIds: string[] = [];
    for (const entry of normalized) {
      const existing = await transaction.result.findUnique({ where: { studentId_subjectId_termId: { studentId: entry.studentId, subjectId: entry.subjectId, termId: term.id } } });
      if (existing && (existing.teacherId !== teacherId || (existing.status !== ResultStatus.DRAFT && existing.status !== ResultStatus.RETURNED))) {
        throw new Error("A submitted or reviewed result cannot be edited");
      }
      const nextStatus = payload.action === "submit" ? ResultStatus.SUBMITTED : ResultStatus.DRAFT;
      const saved = await transaction.result.upsert({
        where: { studentId_subjectId_termId: { studentId: entry.studentId, subjectId: entry.subjectId, termId: term.id } },
        create: { ...entry, termId: term.id, teacherId, enteredById: actorId, status: nextStatus },
        update: { ...entry, teacherId, enteredById: actorId, status: nextStatus, reviewNote: null, reviewedAt: null, reviewedById: null },
      });
      const fromStatus = existing?.status ?? null;
      if (fromStatus !== nextStatus) {
        await transaction.resultWorkflowEvent.create({
          data: {
            resultId: saved.id,
            actorId,
            fromStatus,
            toStatus: nextStatus,
          },
        });
      }
      updatedIds.push(saved.id);
    }
    return updatedIds;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("cannot be edited")) throw error;
    throw error;
  });

  return NextResponse.json({ count: resultIds.length, resultIds });
}