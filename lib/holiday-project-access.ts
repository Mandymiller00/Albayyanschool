import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HolidayProjectAccess = {
  classIds: string[];
  teacherId: string | null;
};

export async function getHolidayProjectAccess(userId: string, role: Role): Promise<HolidayProjectAccess | null> {
  if (role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      select: { id: true, assignments: { select: { classId: true } } },
    });
    if (!teacher) return null;
    return {
      classIds: [...new Set(teacher.assignments.map((assignment) => assignment.classId))],
      teacherId: teacher.id,
    };
  }

  if (role === Role.STUDENT) {
    const student = await prisma.student.findUnique({ where: { userId }, select: { classId: true } });
    return student ? { classIds: [student.classId], teacherId: null } : null;
  }

  if (role === Role.PARENT) {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: userId },
      select: { student: { select: { classId: true } } },
    });
    return { classIds: [...new Set(links.map((link) => link.student.classId))], teacherId: null };
  }

  return null;
}
