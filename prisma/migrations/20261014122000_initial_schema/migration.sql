-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'PUBLISHED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AdmissionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'STAFF', 'STUDENTS', 'PARENTS', 'CLASS');

-- CreateEnum
CREATE TYPE "TermName" AS ENUM ('FIRST', 'SECOND', 'THIRD');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "TextbookStatus" AS ENUM ('ISSUED', 'RETURNED', 'LOST', 'DAMAGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "passportPhotoUrl" TEXT,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "medicalNotes" TEXT,
    "classId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionRequest" (
    "id" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "address" TEXT,
    "classId" TEXT NOT NULL,
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "createdStudentId" TEXT,
    "status" "AdmissionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "teacherCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "employmentDate" TIMESTAMP(3),
    "subjectId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubject" (
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("classId","subjectId")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "classId" TEXT,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudent" (
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ParentStudent_pkey" PRIMARY KEY ("parentId","studentId")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "startedAt" DATE NOT NULL,
    "endedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" "TermName" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "resumptionDate" DATE,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectSyllabus" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentData" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectSyllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "teacherId" TEXT,
    "enteredById" TEXT,
    "marks" DECIMAL(7,2),
    "maxMarks" DECIMAL(7,2) NOT NULL DEFAULT 100,
    "ca1" DECIMAL(7,2),
    "ca2" DECIMAL(7,2),
    "ca3" DECIMAL(7,2),
    "exam" DECIMAL(7,2),
    "behavioralRating" INTEGER,
    "behavioralComment" TEXT,
    "psychomotorRating" INTEGER,
    "psychomotorComment" TEXT,
    "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
    "comments" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultWorkflowEvent" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" "ResultStatus",
    "toStatus" "ResultStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeCharge" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePayment" (
    "id" TEXT NOT NULL,
    "feeChargeId" TEXT NOT NULL,
    "recordedById" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'OTHER',
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayProject" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherId" TEXT,
    "subjectId" TEXT,
    "termId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE NOT NULL,
    "attachmentName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentData" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSubmission" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "comment" TEXT,
    "score" DECIMAL(7,2),
    "status" "SubmissionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "day" "Weekday" NOT NULL,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Textbook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "author" TEXT,
    "edition" TEXT,
    "isbn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Textbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTextbook" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "textbookId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTextbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TextbookLoan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "textbookId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "issuedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE,
    "returnedAt" DATE,
    "status" "TextbookStatus" NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextbookLoan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_classId_fullName_idx" ON "Student"("classId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionRequest_createdStudentId_key" ON "AdmissionRequest"("createdStudentId");

-- CreateIndex
CREATE INDEX "AdmissionRequest_status_createdAt_idx" ON "AdmissionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionRequest_classId_status_idx" ON "AdmissionRequest"("classId", "status");

-- CreateIndex
CREATE INDEX "AdmissionRequest_submittedById_status_idx" ON "AdmissionRequest"("submittedById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_teacherCode_key" ON "Teacher"("teacherCode");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoom_name_key" ON "ClassRoom"("name");

-- CreateIndex
CREATE INDEX "ClassSubject_subjectId_idx" ON "ClassSubject"("subjectId");

-- CreateIndex
CREATE INDEX "Announcement_audience_publishedAt_idx" ON "Announcement"("audience", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_classId_publishedAt_idx" ON "Announcement"("classId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- CreateIndex
CREATE INDEX "ParentStudent_studentId_idx" ON "ParentStudent"("studentId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_startedAt_idx" ON "StudentEnrollment"("studentId", "startedAt");

-- CreateIndex
CREATE INDEX "StudentEnrollment_classId_academicYearId_idx" ON "StudentEnrollment"("classId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_name_key" ON "AcademicYear"("name");

-- CreateIndex
CREATE INDEX "Term_academicYearId_startsAt_idx" ON "Term"("academicYearId", "startsAt");

-- CreateIndex
CREATE INDEX "Term_isCurrent_idx" ON "Term"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "Term_academicYearId_name_key" ON "Term"("academicYearId", "name");

-- CreateIndex
CREATE INDEX "TeachingAssignment_classId_subjectId_idx" ON "TeachingAssignment"("classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_teacherId_classId_subjectId_key" ON "TeachingAssignment"("teacherId", "classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectSyllabus_assignmentId_key" ON "SubjectSyllabus"("assignmentId");

-- CreateIndex
CREATE INDEX "SubjectSyllabus_teacherId_updatedAt_idx" ON "SubjectSyllabus"("teacherId", "updatedAt");

-- CreateIndex
CREATE INDEX "Result_termId_status_idx" ON "Result"("termId", "status");

-- CreateIndex
CREATE INDEX "Result_studentId_termId_idx" ON "Result"("studentId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_studentId_subjectId_termId_key" ON "Result"("studentId", "subjectId", "termId");

-- CreateIndex
CREATE INDEX "ResultWorkflowEvent_resultId_createdAt_idx" ON "ResultWorkflowEvent"("resultId", "createdAt");

-- CreateIndex
CREATE INDEX "ResultWorkflowEvent_actorId_createdAt_idx" ON "ResultWorkflowEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_termId_date_status_idx" ON "AttendanceRecord"("termId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_key" ON "AttendanceRecord"("studentId", "date");

-- CreateIndex
CREATE INDEX "FeeCharge_studentId_termId_idx" ON "FeeCharge"("studentId", "termId");

-- CreateIndex
CREATE INDEX "FeeCharge_dueDate_idx" ON "FeeCharge"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCharge_studentId_termId_description_key" ON "FeeCharge"("studentId", "termId", "description");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_reference_key" ON "FeePayment"("reference");

-- CreateIndex
CREATE INDEX "FeePayment_feeChargeId_paidAt_idx" ON "FeePayment"("feeChargeId", "paidAt");

-- CreateIndex
CREATE INDEX "HolidayProject_classId_termId_dueDate_idx" ON "HolidayProject"("classId", "termId", "dueDate");

-- CreateIndex
CREATE INDEX "ProjectSubmission_studentId_status_idx" ON "ProjectSubmission"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSubmission_projectId_studentId_key" ON "ProjectSubmission"("projectId", "studentId");

-- CreateIndex
CREATE INDEX "TimetableSlot_classId_day_startsAt_idx" ON "TimetableSlot"("classId", "day", "startsAt");

-- CreateIndex
CREATE INDEX "TimetableSlot_teacherId_day_startsAt_idx" ON "TimetableSlot"("teacherId", "day", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Textbook_isbn_key" ON "Textbook"("isbn");

-- CreateIndex
CREATE INDEX "Textbook_subject_title_idx" ON "Textbook"("subject", "title");

-- CreateIndex
CREATE INDEX "ClassTextbook_classId_termId_idx" ON "ClassTextbook"("classId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTextbook_classId_textbookId_termId_key" ON "ClassTextbook"("classId", "textbookId", "termId");

-- CreateIndex
CREATE INDEX "TextbookLoan_studentId_termId_status_idx" ON "TextbookLoan"("studentId", "termId", "status");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRequest" ADD CONSTRAINT "AdmissionRequest_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRequest" ADD CONSTRAINT "AdmissionRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRequest" ADD CONSTRAINT "AdmissionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRequest" ADD CONSTRAINT "AdmissionRequest_createdStudentId_fkey" FOREIGN KEY ("createdStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectSyllabus" ADD CONSTRAINT "SubjectSyllabus_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectSyllabus" ADD CONSTRAINT "SubjectSyllabus_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultWorkflowEvent" ADD CONSTRAINT "ResultWorkflowEvent_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultWorkflowEvent" ADD CONSTRAINT "ResultWorkflowEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCharge" ADD CONSTRAINT "FeeCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCharge" ADD CONSTRAINT "FeeCharge_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_feeChargeId_fkey" FOREIGN KEY ("feeChargeId") REFERENCES "FeeCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayProject" ADD CONSTRAINT "HolidayProject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayProject" ADD CONSTRAINT "HolidayProject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayProject" ADD CONSTRAINT "HolidayProject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayProject" ADD CONSTRAINT "HolidayProject_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSubmission" ADD CONSTRAINT "ProjectSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "HolidayProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSubmission" ADD CONSTRAINT "ProjectSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTextbook" ADD CONSTRAINT "ClassTextbook_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTextbook" ADD CONSTRAINT "ClassTextbook_textbookId_fkey" FOREIGN KEY ("textbookId") REFERENCES "Textbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTextbook" ADD CONSTRAINT "ClassTextbook_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextbookLoan" ADD CONSTRAINT "TextbookLoan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextbookLoan" ADD CONSTRAINT "TextbookLoan_textbookId_fkey" FOREIGN KEY ("textbookId") REFERENCES "Textbook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextbookLoan" ADD CONSTRAINT "TextbookLoan_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
