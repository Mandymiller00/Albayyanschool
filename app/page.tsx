"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { SchoolLogo } from "./school-logo";
import AttendanceWorkspace from "./attendance-workspace";
import AnnouncementsWorkspace from "./announcements-workspace";
import AcademicSetup from "./academic-setup";
import AccountManagement from "./account-management";
import LogoutButton from "./logout-button";
import StudentEnrollmentManager from "./student-enrollment-manager";
import { gradeForPercentage } from "@/lib/grade";

type ResultStatus = "Draft" | "Submitted" | "Under Review" | "Returned" | "Approved" | "Published" | "Locked";
type StudentStatus = "Active" | "Pending" | "On hold";

type StudentRecord = {
  id: string;
  name: string;
  studentId: string;
  classId: string;
  className: string;
  teacher: string;
  guardian: string;
  guardianPhone?: string | null;
  admission: string;
  status: StudentStatus;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  medicalNotes?: string | null;
  passportPhotoUrl?: string | null;
  accountEmail?: string | null;
};

type SchoolClass = { id: string; name: string };
type SubjectChoice = { id: string; name: string };
type AcademicAssignment = { id: string; classId: string; subjectId: string; teacherId: string; class: SchoolClass; subject: SubjectChoice; teacher: { id: string; fullName: string; teacherCode: string } };
type AdmissionRequestRecord = {
  id: string;
  studentCode: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string;
  status: "PENDING" | "APPROVED" | "RETURNED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
  class: SchoolClass;
  submittedBy?: { name: string; email: string } | null;
  createdStudent?: { id: string; studentCode: string; fullName: string } | null;
};

type StudentResult = {
  id: number | string;
  student: string;
  studentId: string;
  className: string;
  subject: string;
  score: number | null;
  outOf: number;
  teacherComment: string;
  behavioralRating: number | null;
  behavioralComment: string;
  psychomotorRating: number | null;
  psychomotorComment: string;
  status: ResultStatus;
  reviewNote?: string | null;
};
type ActiveAcademicPeriod = { termName: string | null; academicYear: string };

const statusAction: Partial<Record<ResultStatus, string>> = {
  Submitted: "Start review",
  "Under Review": "Approve",
  Approved: "Publish",
  Published: "Lock",
};

const apiActionForStatus: Partial<Record<ResultStatus, string>> = {
  Submitted: "start_review",
  "Under Review": "approve",
  Approved: "publish",
  Published: "lock",
};

function displayResultStatus(status: string): ResultStatus {
  return status.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ") as ResultStatus;
}

function gradeFor(score: number, outOf: number) {
  return gradeForPercentage((score / outOf) * 100);
}

function profileDate(value?: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatTermName(value: string) {
  return `${value[0]}${value.slice(1).toLowerCase()} Term`;
}

function getActiveAcademicPeriod(academicYears: Array<{
  name: string;
  isCurrent: boolean;
  terms: Array<{ name: string; isCurrent: boolean }>;
}>): ActiveAcademicPeriod | null {
  const academicYear = academicYears.find((year) => year.isCurrent);
  if (!academicYear) return null;
  const term = academicYear.terms.find((item) => item.isCurrent);
  return { termName: term ? formatTermName(term.name) : null, academicYear: academicYear.name };
}

function AdminDashboardLoading() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span><strong>Albayyan</strong><small>INTERNATIONAL SCHOOL</small></span></div>
      </aside>
      <section className="main-panel">
        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">LOADING</p>
              <h1>Academic management</h1>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeFeature = searchParams.get("feature") ?? "overview";
  const selectedStudentId = searchParams.get("studentId");
  const featureTitles: Record<string, string> = {
    overview: "Academic management",
    students: "Student management",
    teachers: "Teacher accounts",
    classes: "Class subjects",
    settings: "School settings",
    attendance: "Attendance register",
    results: "Student results",
    announcements: "Announcements",
    "student-profile": "Student profile",
    accounts: "Portal accounts",
  };
  const featureDescriptions: Record<string, string> = {
    overview: "Track students, classes, teachers and result reviews from a single dashboard.",
    students: "Register students and review teacher-submitted admission requests.",
    teachers: "Create teacher accounts and manage class and subject assignments.",
    classes: "Add subjects to each permanent class for automatic teacher assignment.",
    settings: "Configure academic sessions and their three required terms.",
    attendance: "Record and review daily class attendance.",
    results: "Review, approve and publish student results.",
    announcements: "Publish updates to students, families and staff.",
    "student-profile": "Full student information and school record.",
    accounts: "View school login accounts and securely reset student passwords.",
  };
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [activeAcademicPeriod, setActiveAcademicPeriod] = useState<ActiveAcademicPeriod | null>(null);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentClassFilter, setStudentClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [classFilter, setClassFilter] = useState("All classes");
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [academicAssignments, setAcademicAssignments] = useState<AcademicAssignment[]>([]);
  const [admissionRequests, setAdmissionRequests] = useState<AdmissionRequestRecord[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [resultReviewNotes, setResultReviewNotes] = useState<Record<string, string>>({});
  const [dataWarning, setDataWarning] = useState("");
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [notice, setNotice] = useState("");
  const profileStudent = students.find((student) => student.id === selectedStudentId);
  const pageTitle = activeFeature === "student-profile" && profileStudent
    ? profileStudent.name
    : featureTitles[activeFeature] ?? featureTitles.overview;

  const visibleResults = results.filter((result) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [result.student, result.studentId, result.subject].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "All statuses" || result.status === statusFilter)
      && (classFilter === "All classes" || result.className === classFilter);
  });

  const visibleStudents = students.filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    const matchesSearch = !query || [student.name, student.studentId, student.teacher, student.className].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (studentClassFilter === "All classes" || student.className === studentClassFilter);
  });

  const countFor = (status: ResultStatus) => results.filter((result) => result.status === status).length;
  const activeStudentCount = students.filter((student) => student.status === "Active").length;
  const pendingRegistrationCount = admissionRequests.filter((request) => request.status === "PENDING").length;
  const classAllocations = schoolClasses.map((schoolClass) => {
    const assignments = academicAssignments.filter((assignment) => assignment.classId === schoolClass.id);
    const teacherNames = [...new Set(assignments.map((assignment) => assignment.teacher.fullName))];
    const studentCount = students.filter((student) => student.classId === schoolClass.id).length;
    return { ...schoolClass, teacherNames, studentCount };
  });

  useEffect(() => {
    async function loadSchoolData() {
      try {
        const response = await fetch("/api/admissions");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load school records");
        setSchoolClasses(data.classes);
        setAdmissionRequests(data.requests);
        const resultResponse = await fetch("/api/results");
        const resultData = await resultResponse.json();
        if (!resultResponse.ok) throw new Error(resultData.error ?? "Unable to load result records");
        const academicResponse = await fetch("/api/academics");
        const academicData = await academicResponse.json();
        if (!academicResponse.ok) throw new Error(academicData.error ?? "Unable to load teacher assignments");
        setActiveAcademicPeriod(getActiveAcademicPeriod(academicData.academicYears ?? []));
        const loadedAssignments = academicData.assignments ?? [];
        setAcademicAssignments(loadedAssignments);
        setResults(resultData.results.map((result: {
          id: string;
          marks: number | string;
          maxMarks: number | string;
          comments: string | null;
          behavioralRating: number | null;
          behavioralComment: string | null;
          psychomotorRating: number | null;
          psychomotorComment: string | null;
          status: string;
          reviewNote: string | null;
          student: { fullName: string; studentCode: string; class: { name: string } };
          subject: { name: string };
        }) => ({
          id: result.id,
          student: result.student.fullName,
          studentId: result.student.studentCode,
          className: result.student.class.name,
          subject: result.subject.name,
          score: result.marks === null ? null : Number(result.marks),
          outOf: Number(result.maxMarks),
          teacherComment: result.comments || "—",
          behavioralRating: result.behavioralRating,
          behavioralComment: result.behavioralComment || "—",
          psychomotorRating: result.psychomotorRating,
          psychomotorComment: result.psychomotorComment || "—",
          status: displayResultStatus(result.status),
          reviewNote: result.reviewNote,
        })));
        setStudents(data.students.map((student: {
          id: string;
          fullName: string;
          studentCode: string;
          class: SchoolClass;
          emergencyContactName: string | null;
          emergencyContactPhone: string | null;
          createdAt: string;
          email: string | null;
          phone: string | null;
          dateOfBirth: string | null;
          gender: string | null;
          address: string | null;
          medicalNotes: string | null;
          passportPhotoUrl: string | null;
          user: { email: string } | null;
        }) => ({
          id: student.id,
          name: student.fullName,
          studentId: student.studentCode,
          classId: student.class.id,
          className: student.class.name,
          teacher: loadedAssignments.filter((assignment: AcademicAssignment) => assignment.classId === student.class.id).map((assignment: AcademicAssignment) => assignment.teacher.fullName).filter((name: string, index: number, names: string[]) => names.indexOf(name) === index).join(", ") || "Class teacher not assigned",
          guardian: student.emergencyContactName || "Guardian details not provided",
          guardianPhone: student.emergencyContactPhone,
          admission: new Date(student.createdAt).toLocaleDateString(),
          status: "Active" as const,
          email: student.email,
          phone: student.phone,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          address: student.address,
          medicalNotes: student.medicalNotes,
          passportPhotoUrl: student.passportPhotoUrl,
          accountEmail: student.user?.email ?? null,
        })));
        setDataWarning("");
      } catch (error) {
        setDataWarning(error instanceof Error ? error.message : "Unable to load school records");
      }
    }
    void loadSchoolData();
  }, []);

  useEffect(() => {
    async function refreshActiveAcademicPeriod(event?: Event) {
      if (event instanceof CustomEvent) {
        const detail = event.detail as { academicYear?: string | null; termName?: string | null };
        if (detail.academicYear !== undefined) {
          setActiveAcademicPeriod(detail.academicYear
            ? { academicYear: detail.academicYear, termName: detail.termName ?? null }
            : null);
          return;
        }
      }
      try {
        const response = await fetch("/api/academics");
        const data = await response.json();
        if (!response.ok) return;
        setActiveAcademicPeriod(getActiveAcademicPeriod(data.academicYears ?? []));
      } catch {
        return;
      }
    }
    void refreshActiveAcademicPeriod();
    window.addEventListener("active-academic-period-changed", refreshActiveAcademicPeriod);
    return () => window.removeEventListener("active-academic-period-changed", refreshActiveAcademicPeriod);
  }, []);

  async function advanceResult(id: number | string, status: ResultStatus) {
    const action = apiActionForStatus[status];
    if (!action) return;
    try {
      const response = await fetch(`/api/results/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update result");
      setResults((current) => current.map((result) => result.id === id ? { ...result, status: displayResultStatus(data.result.status), reviewNote: data.result.reviewNote } : result));
      setNotice("Result workflow updated");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update result");
    }
  }

  async function returnResult(id: number | string) {
    const note = resultReviewNotes[String(id)]?.trim() ?? "";
    if (!note) {
      setNotice("Add a correction note before returning this result");
      return;
    }
    try {
      const response = await fetch(`/api/results/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return", note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to return result");
      setResults((current) => current.map((result) => result.id === id ? { ...result, status: "Returned", reviewNote: note } : result));
      setNotice("Result returned to the teacher with a correction note");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to return result");
    }
  }

  async function registerStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name")).trim();
    const studentId = String(form.get("studentId")).trim();
    const classId = String(form.get("classId")).trim();
    const guardian = String(form.get("guardian")).trim();
    const guardianPhone = String(form.get("guardianPhone")).trim();
    const address = String(form.get("address")).trim();

    if (!name || !studentId || !classId || !guardian || !guardianPhone) {
      setNotice("Complete the student, class, and guardian details");
      return;
    }

    try {
      const response = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentCode: studentId, fullName: name, classId, guardianName: guardian, guardianPhone, address }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not register student");
      const student = data.student;
      setStudents((current) => [{
        id: student.id,
        name: student.fullName,
        studentId: student.studentCode,
        classId: student.class.id,
        className: student.class.name,
        teacher: "Assigned class teacher",
        guardian: student.emergencyContactName,
        guardianPhone: student.emergencyContactPhone,
        admission: new Date(student.createdAt).toLocaleDateString(),
        status: "Active",
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        address: student.address,
        phone: student.phone,
        email: student.email,
        medicalNotes: student.medicalNotes,
        passportPhotoUrl: student.passportPhotoUrl,
        accountEmail: student.user?.email ?? null,
      }, ...current]);
      if (data.account) setCreatedCredentials({ email: data.account.email, password: data.account.temporaryPassword });
      setStudentDialogOpen(false);
      setNotice("Student registered with a linked portal account");
      formElement.reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not register student");
    }
  }

  async function reviewAdmission(requestId: string, action: "approve" | "return" | "reject") {
    const note = reviewNotes[requestId]?.trim() ?? "";
    if (action !== "approve" && !note) {
      setNotice("Add a review note before returning or rejecting this request");
      return;
    }

    try {
      const response = await fetch(`/api/admissions/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not review request");
      setAdmissionRequests((current) => current.map((request) => request.id === requestId ? data.request : request));
      if (action === "approve") {
        const request = admissionRequests.find((item) => item.id === requestId);
        if (data.account) setCreatedCredentials({ email: data.account.email, password: data.account.temporaryPassword });
        if (request && data.request.createdStudent) {
          setStudents((current) => [{
            id: data.request.createdStudent.id,
            name: request.fullName,
            studentId: request.studentCode,
            classId: request.class.id,
            className: request.class.name,
            teacher: "Assigned class teacher",
            guardian: request.guardianName,
            admission: new Date().toLocaleDateString(),
            status: "Active",
          }, ...current]);
        }
      }
      setNotice(action === "approve" ? "Registration approved; student portal account created" : `Registration ${action === "return" ? "returned to the teacher" : "rejected"}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not review request");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="#overview">
          <SchoolLogo size={44} className="brand-crest" />
          <span><strong>Albayyan</strong><small>INTERNATIONAL SCHOOL</small></span>
        </Link>
        <div className="school-switcher">
          <SchoolLogo size={34} className="school-crest-small" />
          <span><strong>Albayyan International School</strong><small>Administration</small></span>
          <span className="chevron">⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          <Link className={activeFeature === "overview" ? "active" : ""} href="/" aria-current={activeFeature === "overview" ? "page" : undefined}><span className="nav-symbol">▦</span>Overview</Link>
          <Link className={activeFeature === "students" || activeFeature === "student-profile" ? "active" : ""} href="/?feature=students" aria-current={activeFeature === "students" || activeFeature === "student-profile" ? "page" : undefined}><span className="nav-symbol">▤</span>Students<span className="nav-count">{students.length}</span></Link>
          <Link className={activeFeature === "teachers" ? "active" : ""} href="/?feature=teachers" aria-current={activeFeature === "teachers" ? "page" : undefined}><span className="nav-symbol">♧</span>Teachers</Link>
          <Link className={activeFeature === "classes" ? "active" : ""} href="/?feature=classes" aria-current={activeFeature === "classes" ? "page" : undefined}><span className="nav-symbol">▥</span>Classes</Link>
          <Link className={activeFeature === "settings" ? "active" : ""} href="/?feature=settings" aria-current={activeFeature === "settings" ? "page" : undefined}><span className="nav-symbol">⚙</span>Settings</Link>
          <Link className={activeFeature === "attendance" ? "active" : ""} href="/?feature=attendance" aria-current={activeFeature === "attendance" ? "page" : undefined}><span className="nav-symbol">◷</span>Attendance</Link>
          <Link className={activeFeature === "results" ? "active" : ""} href="/?feature=results" aria-current={activeFeature === "results" ? "page" : undefined}><span className="nav-symbol">⌑</span>Results</Link>
          <Link className={activeFeature === "announcements" ? "active" : ""} href="/?feature=announcements" aria-current={activeFeature === "announcements" ? "page" : undefined}><span className="nav-symbol">↗</span>Announcements</Link>
          <Link className={activeFeature === "accounts" ? "active" : ""} href="/?feature=accounts" aria-current={activeFeature === "accounts" ? "page" : undefined}><span className="nav-symbol">♙</span>Accounts</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="term-note"><span className="term-dot" /><span><small>ACTIVE SESSION</small><strong>{activeAcademicPeriod?.academicYear ?? "Not set"}</strong></span></div>
          <div className="profile-button" aria-label="Signed in as Amaka Okoro, school administrator">
            <span className="profile-avatar">AO</span>
            <span><strong>Amaka Okoro</strong><small>School administrator</small></span>
          </div>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar">
          <div className="breadcrumb">School management <span>/</span> <strong>Dashboard</strong></div>
          <div className="topbar-actions">
            <span className="icon-button" aria-label="No new notifications">♧<i /></span>
            <span className="topbar-divider" />
            <span className="portal-session">{activeAcademicPeriod ? `${activeAcademicPeriod.termName ?? "No current term"} · ${activeAcademicPeriod.academicYear}` : "No active session"}</span>
            <LogoutButton />
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SCHOOL OPERATIONS <span className="eyebrow-dot" /> {activeAcademicPeriod ? `${activeAcademicPeriod.termName ?? "NO CURRENT TERM"} · ${activeAcademicPeriod.academicYear}` : "NO ACTIVE SESSION"}</p>
              <h1>{pageTitle}</h1>
              <p className="page-description">{featureDescriptions[activeFeature] ?? featureDescriptions.overview}</p>
            </div>
            <div className="page-actions">
              {(activeFeature === "overview" || activeFeature === "students") && <button className="cancel-button" type="button" onClick={() => setStudentDialogOpen(true)}>Register student</button>}
            </div>
          </div>

          {activeFeature === "overview" && <section className="workflow-strip" aria-label="Academic summary">
            <div className="workflow-intro"><span className="workflow-icon">▥</span><span><strong>School snapshot</strong><small>Admissions, class allocation and review status</small></span></div>
            <div className="workflow-step"><span className="step-index">01</span><span><strong>Enrolment</strong><small>{activeStudentCount} active students</small></span></div>
            <span className="step-connector" />
            <div className="workflow-step"><span className="step-index">02</span><span><strong>Classes</strong><small>{new Set(students.map((student) => student.className)).size} assigned classes</small></span></div>
            <span className="step-connector" />
            <div className="workflow-step"><span className="step-index">03</span><span><strong>Results</strong><small>{countFor("Submitted") + countFor("Under Review")} in review</small></span></div>
          </section>}

          {activeFeature === "overview" && <section className="summary-grid" aria-label="School summary">
            <article className="summary-card"><span className="summary-label">TOTAL STUDENTS</span><strong>{students.length}</strong><small>Across all classes</small><span className="summary-mark mark-green">♙</span></article>
            <article className="summary-card"><span className="summary-label">ACTIVE ENROLMENT</span><strong>{activeStudentCount}</strong><small>Confirmed registration</small><span className="summary-mark mark-blue">✓</span></article>
            <article className="summary-card"><span className="summary-label">PENDING</span><strong>{pendingRegistrationCount}</strong><small>Awaiting class allocation</small><span className="summary-mark mark-amber">◷</span></article>
            <article className="summary-card"><span className="summary-label">RESULTS REVIEW</span><strong>{countFor("Under Review") + countFor("Submitted")}</strong><small>In administrative queue</small><span className="summary-mark mark-red">↶</span></article>
          </section>}

          {activeFeature === "attendance" && <AttendanceWorkspace role="admin" />}
          {activeFeature === "announcements" && <AnnouncementsWorkspace role="admin" />}
          {activeFeature === "accounts" && <AccountManagement />}
          {activeFeature === "teachers" && <AcademicSetup focus="teachers" />}
          {activeFeature === "classes" && <AcademicSetup focus="classes" />}
          {activeFeature === "settings" && <AcademicSetup focus="settings" />}

          {activeFeature === "student-profile" && (profileStudent ? <section className="admin-student-profile">
            <div className="student-profile-toolbar"><Link className="student-profile-back" href="/?feature=students">← Back to students</Link><span className="status status-approved"><i />{profileStudent.status}</span></div>
            <section className="student-profile-hero">
              <span className="student-profile-avatar" aria-hidden="true">{profileStudent.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div><p className="eyebrow">STUDENT RECORD</p><h2>{profileStudent.name}</h2><p>{profileStudent.studentId} <span>·</span> {profileStudent.className}</p></div>
              <div className="student-profile-hero-meta"><span>Class teacher</span><strong>{profileStudent.teacher}</strong><span>Admission date</span><strong>{profileStudent.admission}</strong></div>
            </section>
            <div className="student-profile-grid">
              <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Personal information</h3></div><dl className="student-profile-fields">
                <div><dt>Full name</dt><dd>{profileStudent.name}</dd></div>
                <div><dt>Student ID</dt><dd>{profileStudent.studentId}</dd></div>
                <div><dt>Date of birth</dt><dd>{profileDate(profileStudent.dateOfBirth)}</dd></div>
                <div><dt>Gender</dt><dd>{profileStudent.gender || "Not provided"}</dd></div>
                <div><dt>Student email</dt><dd>{profileStudent.email || "Not provided"}</dd></div>
                <div><dt>Student phone</dt><dd>{profileStudent.phone || "Not provided"}</dd></div>
                <div className="student-profile-wide"><dt>Home address</dt><dd>{profileStudent.address || "Not provided"}</dd></div>
              </dl></section>
              <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Enrollment</h3></div><dl className="student-profile-fields">
                <div><dt>Current class</dt><dd>{profileStudent.className}</dd></div>
                <div><dt>Class teacher(s)</dt><dd>{profileStudent.teacher}</dd></div>
                <div><dt>Admission date</dt><dd>{profileStudent.admission}</dd></div>
                <div><dt>Student portal account</dt><dd>{profileStudent.accountEmail || "Not linked"}</dd></div>
              </dl></section>
              <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Parent / guardian</h3></div><dl className="student-profile-fields">
                <div><dt>Guardian name</dt><dd>{profileStudent.guardian}</dd></div>
                <div><dt>Guardian phone</dt><dd>{profileStudent.guardianPhone || "Not provided"}</dd></div>
              </dl></section>
              <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Medical information</h3></div><dl className="student-profile-fields"><div className="student-profile-wide"><dt>Medical notes / needs</dt><dd>{profileStudent.medicalNotes || "No medical notes recorded"}</dd></div><div className="student-profile-wide"><dt>Passport photo</dt><dd>{profileStudent.passportPhotoUrl ? <a href={profileStudent.passportPhotoUrl} target="_blank" rel="noreferrer">View passport photo</a> : "Not provided"}</dd></div></dl></section>
              <section className="student-profile-panel student-profile-results"><div className="student-profile-panel-heading"><div><h3>Academic results</h3><p>Results recorded for this student</p></div></div><div className="table-scroll"><table className="results-table"><thead><tr><th>SUBJECT</th><th>MARK</th><th>GRADE</th><th>STATUS</th></tr></thead><tbody>{results.filter((result) => result.studentId === profileStudent.studentId).map((result) => <tr key={result.id}><td>{result.subject}</td><td>{result.score === null ? "—" : `${result.score} / ${result.outOf}`}</td><td>{result.score === null ? "—" : gradeFor(result.score, result.outOf)}</td><td>{result.status}</td></tr>)}{!results.some((result) => result.studentId === profileStudent.studentId) && <tr><td className="empty-state" colSpan={4}>No results recorded yet.</td></tr>}</tbody></table></div></section>
              <section className="student-profile-panel student-profile-results"><StudentEnrollmentManager studentId={profileStudent.id} studentName={profileStudent.name} /></section>
            </div>
          </section> : <section className="results-section"><div className="section-heading"><div><h2>Student record unavailable</h2><p>This student could not be found. Return to the student list and select a record.</p></div><Link className="student-profile-back" href="/?feature=students">Back to students</Link></div></section>)}

          {(activeFeature === "students" || activeFeature === "classes") && <div className="management-grid" id="students">
            {activeFeature === "students" && <>
            <section className="results-section">
              <div className="section-heading"><div><h2>Student management</h2><p>Register students, open their full profiles, and assign them to class groups and teachers.</p></div><button className="export-button" type="button" onClick={() => setStudentDialogOpen(true)}>＋ <span>New student</span></button></div>
              <div className="filters-row">
                <label className="search-field"><span>⌕</span><input aria-label="Search students" placeholder="Search name, class or teacher" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} /><kbd>⌘ K</kbd></label>
                <label className="select-wrap"><span className="sr-only">Filter students by class</span><select value={studentClassFilter} onChange={(event) => setStudentClassFilter(event.target.value)}><option>All classes</option>{schoolClasses.map((schoolClass) => <option key={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
              </div>
              <div className="table-scroll">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>STUDENT ID</th>
                      <th>CLASS</th>
                      <th>TEACHER</th>
                      <th>STATUS</th>
                      <th>PROFILE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.map((student) => (
                      <tr key={student.id}>
                        <td><div className="student-cell"><span className={`student-avatar avatar-${String(student.id).charCodeAt(0) % 5}`}>{student.name.split(" ").map((part) => part[0]).join("")}</span><span><a className="student-profile-link" href={`/?feature=student-profile&studentId=${encodeURIComponent(student.id)}`}><strong>{student.name}</strong></a><small>{student.guardian}</small></span></div></td>
                        <td>{student.studentId}</td>
                        <td><span className="class-tag">{student.className}</span></td>
                        <td>{student.teacher}</td>
                        <td><span className={`status ${student.status === "Active" ? "status-approved" : student.status === "Pending" ? "status-submitted" : "status-returned"}`}><i />{student.status}</span></td>
                        <td><a className="row-action student-profile-action" href={`/?feature=student-profile&studentId=${encodeURIComponent(student.id)}`} aria-label={`View ${student.name} profile`} title={`View ${student.name} profile`}><span aria-hidden="true">♙</span> View profile</a></td>
                      </tr>
                    ))}
                    {visibleStudents.length === 0 && <tr><td className="empty-state" colSpan={6}>{dataWarning ? "Student records are unavailable until the database connection is restored." : "No student records match this search."}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            </>}

            {activeFeature === "classes" && <>
            <aside className="results-section management-panel" id="teachers">
              <div className="section-heading"><div><h2>Class allocation</h2><p>Teacher responsibility for student registration.</p></div></div>
              <div className="mini-stat-list">
                {classAllocations.map((schoolClass) => <div className="mini-stat-item" key={schoolClass.id}><strong>{schoolClass.name}</strong><span>{schoolClass.teacherNames.length ? schoolClass.teacherNames.join(", ") : "No teacher assigned"}</span><small>{schoolClass.studentCount} students · {academicAssignments.filter((assignment) => assignment.classId === schoolClass.id).length} subject assignments</small></div>)}
                {classAllocations.length === 0 && <p className="empty-state">No classes have been configured.</p>}
              </div>
              <div className="panel-note">
                <strong>Teacher duties</strong>
                <ul>
                  <li>Review class registers</li>
                  <li>Register new students to class</li>
                  <li>Submit results for admin review</li>
                </ul>
              </div>
            </aside>
            </>}
          </div>}

          {activeFeature === "students" && <section className="results-section admission-review-section">
            <div className="section-heading"><div><h2>Admission review</h2><p>Teacher-submitted registrations awaiting an administrative decision.</p></div><span className="status status-under-review">{pendingRegistrationCount} awaiting review</span></div>
            <div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>REQUESTED CLASS</th><th>GUARDIAN</th><th>SUBMITTED BY</th><th>STATUS</th><th>REVIEW NOTE</th><th>ACTION</th></tr></thead><tbody>
              {admissionRequests.map((request) => (
                <tr key={request.id}>
                  <td><strong className="teacher-student-name">{request.fullName}</strong></td>
                  <td>{request.studentCode}</td>
                  <td><span className="class-tag">{request.class.name}</span></td>
                  <td>{request.guardianName}<small className="subcell-note">{request.guardianPhone}</small></td>
                  <td>{request.submittedBy?.name ?? "School administrator"}</td>
                  <td><span className={`status ${request.status === "APPROVED" ? "status-approved" : request.status === "REJECTED" ? "status-returned" : request.status === "RETURNED" ? "status-submitted" : "status-under-review"}`}><i />{request.status}</span></td>
                  <td>{request.status === "PENDING" ? <input className="review-note-input" aria-label={`Review note for ${request.fullName}`} value={reviewNotes[request.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Required for return/reject" /> : request.reviewNote || "—"}</td>
                  <td><div className="row-actions">{request.status === "PENDING" ? <><button className="row-action" type="button" onClick={() => void reviewAdmission(request.id, "approve")}>Approve</button><button className="return-action" type="button" onClick={() => void reviewAdmission(request.id, "return")}>Return</button><button className="return-action" type="button" onClick={() => void reviewAdmission(request.id, "reject")}>Reject</button></> : request.status === "RETURNED" ? <span className="locked-label">Awaiting teacher update</span> : <span className="locked-label">Reviewed</span>}</div></td>
                </tr>
              ))}
              {admissionRequests.length === 0 && <tr><td className="empty-state" colSpan={8}>No teacher registrations are awaiting review.</td></tr>}
            </tbody></table></div>
          </section>}

          {activeFeature === "results" && <section className="results-section" id="results">
            <div className="section-heading"><div><h2>Student results</h2><p>Professional result management and approval workflow.</p></div><button className="export-button" type="button" onClick={() => setNotice("Export will be available when records are connected to the school database")}>↧ <span>Export</span></button></div>
            <div className="filters-row">
              <label className="search-field"><span>⌕</span><input aria-label="Search results" placeholder="Search student, ID or subject" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>
              <label className="select-wrap"><span className="sr-only">Filter by class</span><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All classes</option>{schoolClasses.map((schoolClass) => <option key={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
              <label className="select-wrap"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Draft</option><option>Submitted</option><option>Under Review</option><option>Returned</option><option>Approved</option><option>Published</option><option>Locked</option></select></label>
            </div>
            <div className="table-scroll"><table className="results-table"><thead><tr><th><input aria-label="Select all results" type="checkbox" /></th><th>STUDENT</th><th>CLASS</th><th>SUBJECT</th><th>MARK</th><th>GRADE</th><th>STATUS</th><th>REVIEW NOTE</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
              {visibleResults.map((result) => (
                <tr key={result.id}>
                  <td><input aria-label={`Select ${result.student}`} type="checkbox" /></td>
                  <td><div className="student-cell"><span className={`student-avatar avatar-${String(result.id).charCodeAt(0) % 5}`}>{result.student.split(" ").map((part) => part[0]).join("")}</span><span><strong>{result.student}</strong><small>{result.studentId}</small></span></div></td>
                  <td><span className="class-tag">{result.className}</span></td>
                  <td>{result.subject}</td>
                  <td><strong className="mark-value">{result.score === null ? "—" : <>{result.score}<span> / {result.outOf}</span></>}</strong></td>
                  <td>{result.score === null ? "—" : <span className={`grade grade-${gradeFor(result.score, result.outOf).toLowerCase()}`}>{gradeFor(result.score, result.outOf)}</span>}</td>
                  <td><span className={`status status-${result.status.toLowerCase().replaceAll(" ", "-")}`}><i />{result.status}</span></td>
                  <td>{result.status === "Submitted" || result.status === "Under Review" ? <input className="review-note-input" aria-label={`Correction note for ${result.student} ${result.subject}`} value={resultReviewNotes[String(result.id)] ?? ""} onChange={(event) => setResultReviewNotes((current) => ({ ...current, [String(result.id)]: event.target.value }))} placeholder="Required to return" /> : result.reviewNote || "—"}</td>
                  <td><div className="row-actions">{statusAction[result.status] && <button className="row-action" type="button" onClick={() => void advanceResult(result.id, result.status)}>{statusAction[result.status]} <span>→</span></button>}{(result.status === "Submitted" || result.status === "Under Review") && <button className="return-action" type="button" onClick={() => void returnResult(result.id)}>Return</button>}{result.status === "Locked" && <span className="locked-label">Final</span>}</div></td>
                </tr>
              ))}
              {visibleResults.length === 0 && <tr><td className="empty-state" colSpan={9}>No results match these filters.</td></tr>}
            </tbody></table></div>
            <footer className="table-footer"><span>Showing <strong>{visibleResults.length}</strong> of <strong>{results.length}</strong> results</span><div className="pagination"><button type="button" disabled aria-label="Previous page">←</button><button className="page-current" type="button">1</button><button type="button" disabled aria-label="Next page">→</button></div></footer>
          </section>}

          {activeFeature === "results" && <section className="results-section psychomotor-review-section"><div className="section-heading"><div><h2>Behavior & psychomotor review</h2><p>Review the teacher&apos;s assessment before publishing results.</p></div></div><div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>SUBJECT</th><th>BEHAVIOR RATING</th><th>BEHAVIOR COMMENT</th><th>PSYCHOMOTOR RATING</th><th>PSYCHOMOTOR COMMENT</th><th>TEACHER COMMENT</th></tr></thead><tbody>{visibleResults.map((result) => <tr key={`${result.id}-assessment`}><td>{result.student}</td><td>{result.subject}</td><td>{result.behavioralRating ? `${result.behavioralRating} / 5` : "—"}</td><td>{result.behavioralComment}</td><td>{result.psychomotorRating ? `${result.psychomotorRating} / 5` : "—"}</td><td>{result.psychomotorComment}</td><td>{result.teacherComment}</td></tr>)}{!visibleResults.length && <tr><td className="empty-state" colSpan={7}>No assessment records match these filters.</td></tr>}</tbody></table></div></section>}

          <p className="data-note"><span>i</span> {dataWarning ? `School records could not be loaded: ${dataWarning}` : "Student admissions, class assignments, results and review events are saved in the school database."}</p>
        </div>
      </section>

      {notice && <div className="toast" role="status">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}

      {createdCredentials && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreatedCredentials(null); }}>
        <section className="result-modal student-login-modal" role="dialog" aria-modal="true" aria-labelledby="student-login-title">
          <div className="modal-heading"><div><p className="eyebrow">STUDENT PORTAL ACCOUNT</p><h2 id="student-login-title">Save the login details</h2></div><button className="modal-close" type="button" aria-label="Close login details" onClick={() => setCreatedCredentials(null)}>×</button></div>
          <p className="modal-description">This temporary password is shown once. Share it securely with the student or guardian.</p>
          <dl className="student-login-credentials"><div><dt>Login email</dt><dd>{createdCredentials.email}</dd></div><div><dt>Temporary password</dt><dd>{createdCredentials.password}</dd></div></dl>
          <div className="form-actions"><button className="cancel-button" type="button" onClick={() => { void navigator.clipboard.writeText(`Login: ${createdCredentials.email}\nTemporary password: ${createdCredentials.password}`).then(() => setNotice("Login details copied; share them securely")).catch(() => setNotice("Copy is unavailable; note the login details before closing")); }}>Copy login details</button><button className="primary-button" type="button" onClick={() => setCreatedCredentials(null)}>Done</button></div>
        </section>
      </div>}

      {studentDialogOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setStudentDialogOpen(false); }}>
          <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
            <div className="modal-heading">
              <div><p className="eyebrow">ENROLMENT</p><h2 id="student-modal-title">Add student</h2></div>
              <button className="modal-close" type="button" aria-label="Close dialog" onClick={() => setStudentDialogOpen(false)}>×</button>
            </div>
            <p className="modal-description">Register an active student directly to a school class.</p>
            <form onSubmit={registerStudent} className="result-form">
              <label>Student full name<input name="name" placeholder="e.g. Chinedu Okafor" required /></label>
              <div className="form-pair">
                <label>Student ID<input name="studentId" placeholder="e.g. ST-2210" required /></label>
                <label>Class<select name="classId" defaultValue="" required><option value="" disabled>Select class</option>{schoolClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
              </div>
              <div className="form-pair">
                <label>Parent / guardian<input name="guardian" placeholder="e.g. Rose Okafor" required /></label>
                <label>Guardian phone<input name="guardianPhone" type="tel" placeholder="e.g. +234 801 234 5678" required /></label>
              </div>
              <label>Home address<input name="address" placeholder="Student home address" /></label>
              {schoolClasses.length === 0 && <p className="form-help">Create school classes and teacher assignments before registering students.</p>}
              <div className="form-actions">
                <button className="cancel-button" type="button" onClick={() => setStudentDialogOpen(false)}>Cancel</button>
                <button className="primary-button" type="submit" disabled={schoolClasses.length === 0}>Save student</button>
              </div>
            </form>
          </section>
        </div>
      )}

    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<AdminDashboardLoading />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
