"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { SchoolLogo } from "./school-logo";
import AttendanceWorkspace from "./attendance-workspace";
import AnnouncementsWorkspace from "./announcements-workspace";
import StudentProfileView from "./student-profile-view";
import LogoutButton from "./logout-button";
import TeacherAssessmentPanel from "./teacher-assessment-panel";
import TermReportCard from "./term-report-card";
import HolidayProjectsWorkspace from "./holiday-projects-workspace";
import SyllabusWorkspace from "./syllabus-workspace";
import { gradeForPercentage } from "@/lib/grade";
import type { SubjectTermScore } from "@/lib/subject-cumulative-average";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type PortalRole = "teacher" | "student" | "parent";
type PublishedResult = { subject: string; score: number; outOf: number; grade: string; teacherComment: string; ca1?: number | null; ca2?: number | null; ca3?: number | null; exam?: number | null; behavioralRating?: number | null; behavioralComment?: string; psychomotorRating?: number | null; psychomotorComment?: string };
type TeacherClass = { id: string; name: string };
type TeacherStudent = { id: string; name: string; studentId: string; className: string; parent: string; status: "Active" };
type TeacherResultStudent = TeacherStudent & { classId: string };
type TeacherAdmission = { id: string; fullName: string; studentCode: string; guardianName: string; guardianPhone: string; address: string | null; status: "PENDING" | "APPROVED" | "RETURNED" | "REJECTED"; reviewNote: string | null; class: TeacherClass };
type TeacherSubject = { id: string; name: string };
type TeacherAssignment = { classId: string; subjectId: string; class: TeacherClass; subject: TeacherSubject };
type TeacherAcademicTerm = { id: string; name: string; startsAt: string; endsAt: string; isCurrent: boolean };
type TeacherAcademicYear = { id: string; name: string; isCurrent: boolean; terms: TeacherAcademicTerm[] };
type PortalStudent = { id: string; fullName: string; studentCode: string; class: TeacherClass };
type PortalTimetableSlot = { id: string; day: string; startsAt: string; endsAt: string; room: string | null; class: TeacherClass; subject: TeacherSubject; teacher: { id: string; fullName: string } | null };
type PortalPublishedResult = PublishedResult & { id: string; studentId: string; subjectId: string; termId: string; studentName: string; termName: string; academicYear: string };
type ParentHistoricalResult = { id: string; studentId: string; studentName: string; subject: string; score: number; outOf: number; termId: string; termName: string; academicYear: string; startsAt: string };
type PersistedResult = {
  id: string;
  studentId: string;
  subjectId: string;
  marks: string | number | null;
  maxMarks: string | number;
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  exam: number | null;
  status: string;
  comments: string | null;
  behavioralRating: number | null;
  behavioralComment: string | null;
  psychomotorRating: number | null;
  psychomotorComment: string | null;
  reviewNote?: string | null;
  student: { id: string; fullName: string; studentCode: string; class: TeacherClass };
  subject: TeacherSubject;
  events?: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
};

const childReports: Record<string, { className: string; average: number; position: string; results: PublishedResult[] }> = {
  "Amara Okafor": {
    className: "JSS 2A", average: 83, position: "4th of 32",
    results: [
      { subject: "Mathematics", score: 88, outOf: 100, grade: "A", teacherComment: "Excellent problem solving." },
      { subject: "English Language", score: 76, outOf: 100, grade: "B", teacherComment: "Good progress in writing." },
      { subject: "Basic Science", score: 84, outOf: 100, grade: "A", teacherComment: "Strong understanding." },
      { subject: "Social Studies", score: 79, outOf: 100, grade: "B", teacherComment: "Consistent effort." },
    ],
  },
  "David Okafor": {
    className: "Primary 5B", average: 79, position: "7th of 28",
    results: [
      { subject: "Mathematics", score: 82, outOf: 100, grade: "A", teacherComment: "Very good work." },
      { subject: "English Language", score: 74, outOf: 100, grade: "B", teacherComment: "Keep practising comprehension." },
      { subject: "Basic Science", score: 80, outOf: 100, grade: "A", teacherComment: "Good class participation." },
      { subject: "Creative Arts", score: 80, outOf: 100, grade: "A", teacherComment: "Creative and engaged." },
    ],
  },
};

function gradeFor(score: number) {
  return gradeForPercentage(score);
}

function formatTermName(name: string) {
  return `${name[0]}${name.slice(1).toLowerCase()} term`;
}

const portalFeatures: Record<PortalRole, { id: string; label: string }[]> = {
  teacher: [
    { id: "overview", label: "Overview" },
    { id: "classes", label: "My Classes" },
    { id: "attendance", label: "Attendance" },
    { id: "results", label: "Enter Results" },
    { id: "syllabus", label: "Subject Syllabus" },
    { id: "holiday-projects", label: "Holiday Projects" },
    { id: "announcements", label: "Announcements" },
    { id: "profile", label: "My Profile" },
  ],
  student: [
    { id: "overview", label: "Overview" },
    { id: "results", label: "My Results" },
    { id: "attendance", label: "Attendance" },
    { id: "timetable", label: "Timetable" },
    { id: "syllabus", label: "Subject Syllabus" },
    { id: "holiday-projects", label: "Holiday Projects" },
    { id: "fees", label: "Fees" },
    { id: "announcements", label: "Announcements" },
    { id: "profile", label: "My Profile" },
  ],
  parent: [
    { id: "overview", label: "Overview" },
    { id: "children", label: "My Children" },
    { id: "results", label: "Academic Results" },
    { id: "attendance", label: "Attendance" },
    { id: "syllabus", label: "Subject Syllabus" },
    { id: "holiday-projects", label: "Holiday Projects" },
    { id: "fees", label: "Fees & Payments" },
    { id: "announcements", label: "Announcements" },
    { id: "profile", label: "My Profile" },
  ],
};

function RoleNavigation({ role, feature }: { role: PortalRole; feature: string }) {
  const roleFeatures = portalFeatures[role];
  return (
    <>
      <p className="nav-label">{role.toUpperCase()} WORKSPACE</p>
      <nav className="side-nav portal-nav" aria-label="Role portals">
        {roleFeatures.map((item) => <Link className={feature === item.id ? "active" : ""} href={`/${role}${item.id === "overview" ? "" : `/${item.id}`}`} aria-current={feature === item.id ? "page" : undefined} key={item.id}><span className="nav-symbol">{item.id === "overview" ? "▦" : item.id === "attendance" ? "◷" : item.id === "results" ? "▤" : item.id === "holiday-projects" ? "▧" : item.id === "syllabus" ? "✧" : item.id === "profile" ? "♙" : "▥"}</span>{item.label}</Link>)}
        <span className="nav-label portal-switch-label">SWITCH PORTAL</span>
        <Link href="/teacher"><span className="nav-symbol">♧</span>Teacher portal</Link>
        <Link href="/student"><span className="nav-symbol">♙</span>Student portal</Link>
        <Link href="/parent"><span className="nav-symbol">♧</span>Parent portal</Link>
        <Link href="/" aria-label="Administrator results"><span className="nav-symbol">▤</span>Admin review</Link>
      </nav>
    </>
  );
}

function PassportAvatar({ studentName, photo, onPhotoChange }: { studentName: string; photo?: string; onPhotoChange: (photo: string) => void }) {
  const initials = studentName.split(" ").map((part) => part[0]).join("");

  function readPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPhotoChange(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <label className="passport-avatar-upload" title="Upload or change passport photo">
      {photo ? <Image className="student-passport-avatar" src={photo} alt={`${studentName} passport photograph`} width={44} height={44} unoptimized /> : <span className="student-passport-placeholder">{initials}</span>}
      <input type="file" accept="image/*" aria-label={`Upload ${studentName} passport photo`} onChange={readPhoto} />
    </label>
  );
}

export default function RolePortal({ role, feature = "overview" }: { role: PortalRole; feature?: string }) {
  const [marks, setMarks] = useState<PersistedResult[]>([]);
  const [termResults, setTermResults] = useState<SubjectTermScore[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubject[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
    const [portalStudents, setPortalStudents] = useState<PortalStudent[]>([]);
    const [portalResults, setPortalResults] = useState<PortalPublishedResult[]>([]);
    const [portalCumulativeResults, setPortalCumulativeResults] = useState<SubjectTermScore[]>([]);
    const [portalAcademicYears, setPortalAcademicYears] = useState<TeacherAcademicYear[]>([]);
    const [selectedPortalYearId, setSelectedPortalYearId] = useState("");
    const [selectedPortalTermId, setSelectedPortalTermId] = useState("");
    const [portalResultsView, setPortalResultsView] = useState<"term" | "session">("term");
    const [parentHistory, setParentHistory] = useState<ParentHistoricalResult[]>([]);
    const [portalTimetable, setPortalTimetable] = useState<PortalTimetableSlot[]>([]);
    const [portalTerm, setPortalTerm] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [resultNotice, setResultNotice] = useState("");
  const [savingResults, setSavingResults] = useState(false);
  const [teacherAcademicYears, setTeacherAcademicYears] = useState<TeacherAcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [selectedTeacherTermId, setSelectedTeacherTermId] = useState("");
  const [activeResultTermId, setActiveResultTermId] = useState("");
  const [teacherResultsLoaded, setTeacherResultsLoaded] = useState(false);
  const [teacherResultsLoading, setTeacherResultsLoading] = useState(true);
  const [loadedTeacherTermId, setLoadedTeacherTermId] = useState("");
  const [teacherResultsDirty, setTeacherResultsDirty] = useState(false);
  const [termNoticeDismissed, setTermNoticeDismissed] = useState(false);
  const [followsActiveTerm, setFollowsActiveTerm] = useState(true);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [classRoster, setClassRoster] = useState<TeacherStudent[]>([]);
  const [teacherResultStudents, setTeacherResultStudents] = useState<TeacherResultStudent[]>([]);
  const [teacherAdmissions, setTeacherAdmissions] = useState<TeacherAdmission[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedRosterProfileId, setSelectedRosterProfileId] = useState<string | null>(null);
  const [editingAdmissionId, setEditingAdmissionId] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState("");
  const [passportPhotos, setPassportPhotos] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const roleName = role[0].toUpperCase() + role.slice(1);
  const selectedTeacherClass = teacherClasses.find((schoolClass) => schoolClass.id === selectedClassId);
  const selectedClassRoster = classRoster.filter((student) => student.className === selectedTeacherClass?.name);
  const selectedTeacherResultRoster = teacherResultStudents.filter((student) => student.classId === selectedClassId);
  const selectedClassAdmissions = teacherAdmissions.filter((request) => request.class.id === selectedClassId);
  const selectedClassSubjects = teacherSubjects.filter((subject) => teacherAssignments.some((assignment) => assignment.classId === selectedClassId && assignment.subjectId === subject.id));
  const teacherSessionBlocked = role === "teacher" && feature === "results" && teacherResultsLoaded && !activeResultTermId && !selectedTeacherTermId && !termNoticeDismissed;
  const canCreateResults = Boolean(activeResultTermId && selectedTeacherTermId === activeResultTermId);
  const teacherResultsReady = !teacherResultsLoading && loadedTeacherTermId === selectedTeacherTermId;
  const selectedAcademicYear = teacherAcademicYears.find((year) => year.id === selectedAcademicYearId);

  useEffect(() => {
    if (role !== "teacher") return;
    async function loadTeacherClasses() {
      try {
        const response = await fetch("/api/admissions");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load assigned classes");
        setTeacherClasses(data.classes);
        setSelectedClassId((current) => current || data.classes[0]?.id || "");
        setClassRoster(data.students.map((student: {
          id: string;
          fullName: string;
          studentCode: string;
          class: TeacherClass;
          emergencyContactName: string | null;
        }) => ({
          id: student.id,
          name: student.fullName,
          studentId: student.studentCode,
          className: student.class.name,
          parent: student.emergencyContactName || "Not provided",
          status: "Active" as const,
        })));
        setTeacherAdmissions(data.requests);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to load assigned classes");
      }
    }
    void loadTeacherClasses();
  }, [role]);
  useEffect(() => {
    if (role !== "student" && role !== "parent") return;
    async function loadPublishedResults() {
      try {
        const query = new URLSearchParams();
        if (selectedPortalYearId && portalResultsView === "session") query.set("sessionId", selectedPortalYearId);
        else if (selectedPortalTermId) query.set("termId", selectedPortalTermId);
        const response = await fetch(`/api/results${query.size ? `?${query.toString()}` : ""}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load published results");
        const linkedStudents = (data.students ?? []) as PortalStudent[];
        const academicYears = (data.academicYears ?? []) as TeacherAcademicYear[];
        setPortalAcademicYears(academicYears);
        const activeYear = academicYears.find((year) => year.isCurrent);
        const resultYear = data.term && data.term.name !== "SESSION"
          ? academicYears.find((year) => year.terms.some((term) => term.id === data.term.id))
          : null;
        const defaultYear = resultYear ?? academicYears.find((year) => year.isCurrent) ?? academicYears[0];
        setSelectedPortalYearId((current) => current || defaultYear?.id || "");
        if (!data.term || data.term.name === "SESSION") {
          setSelectedPortalTermId((current) => current || data.activeTermId || defaultYear?.terms.find((term) => term.isCurrent)?.id || defaultYear?.terms[0]?.id || "");
        }
        if (data.term && data.term.name !== "SESSION") setSelectedPortalTermId((current) => current || data.term.id);
        setPortalStudents(linkedStudents);
        setParentHistory((data.history ?? []).map((result: ParentHistoricalResult) => ({ ...result, score: Number(result.score), outOf: Number(result.outOf) })));
        setSelectedChild((current) => linkedStudents.some((student) => student.id === current) ? current : linkedStudents[0]?.id ?? "");
        setPortalTerm(data.term
          ? `${data.term.name === "SESSION" ? "Session results" : formatTermName(data.term.name)} · ${data.term.academicYear}`
          : activeYear ? `No current term · ${activeYear.name}` : "No active session");
        setPortalResults((data.results ?? []).map((result: {
          id: string;
          subjectId: string;
          termId: string;
          marks: number | string;
          maxMarks: number | string;
          ca1: number | string | null;
          ca2: number | string | null;
          ca3: number | string | null;
          exam: number | string | null;
          comments: string | null;
          behavioralRating: number | null;
          behavioralComment: string | null;
          psychomotorRating: number | null;
          psychomotorComment: string | null;
          subject: { name: string };
          student: { id: string; fullName: string };
          term: { name: string; academicYear: { name: string } };
        }) => {
          const score = Number(result.marks);
          const outOf = Number(result.maxMarks);
          return {
            id: result.id,
            studentId: result.student.id,
            subjectId: result.subjectId,
            termId: result.termId,
            studentName: result.student.fullName,
            termName: result.term.name,
            academicYear: result.term.academicYear.name,
            subject: result.subject.name,
            score,
            outOf,
            grade: gradeForPercentage(score / outOf * 100),
            teacherComment: result.comments || "No teacher comment",
            ca1: result.ca1 === null ? null : Number(result.ca1),
            ca2: result.ca2 === null ? null : Number(result.ca2),
            ca3: result.ca3 === null ? null : Number(result.ca3),
            exam: result.exam === null ? null : Number(result.exam),
            behavioralRating: result.behavioralRating,
            behavioralComment: result.behavioralComment || "No behavior comment",
            psychomotorRating: result.psychomotorRating,
            psychomotorComment: result.psychomotorComment || "No psychomotor comment",
          };
        }));
        setPortalCumulativeResults((data.cumulativeResults ?? []) as SubjectTermScore[]);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to load published results");
      }
    }
    void loadPublishedResults();
  }, [role, selectedPortalYearId, selectedPortalTermId, portalResultsView]);
  useEffect(() => {
    if (feature !== "timetable") return;
    async function loadTimetable() {
      try {
        const response = await fetch("/api/timetable");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load timetable");
        setPortalTimetable(data.slots ?? []);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to load timetable");
      }
    }
    void loadTimetable();
  }, [feature, role]);
  const activePortalStudent = role === "student"
    ? portalStudents[0]
    : portalStudents.find((student) => student.id === selectedChild) ?? portalStudents[0];
  const displayedStudent = activePortalStudent?.fullName ?? "";
  const activePortalResults = role === "student" || role === "parent"
    ? portalResults.filter((result) => result.studentId === activePortalStudent?.id)
    : portalResults;
  const activePortalCumulativeResults = portalCumulativeResults.filter((result) => result.studentId === activePortalStudent?.id);
  const activeParentHistory = parentHistory.filter((result) => result.studentId === activePortalStudent?.id);
  const activePortalTimetable = portalTimetable.filter((slot) => role !== "parent" || slot.class.id === activePortalStudent?.class.id);
  const parentTerms = [...new Map(activeParentHistory.map((result) => [result.termId, { id: result.termId, name: result.termName, academicYear: result.academicYear, startsAt: result.startsAt }])).values()]
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const latestPublishedTerm = parentTerms.at(-1);
  const previousPublishedTerm = parentTerms.at(-2);
  const comparisonSubjects = [...new Set(activeParentHistory
    .filter((result) => result.termId === latestPublishedTerm?.id || result.termId === previousPublishedTerm?.id)
    .map((result) => result.subject))];
  const comparisonData = comparisonSubjects.map((subject) => {
    const current = activeParentHistory.find((result) => result.termId === latestPublishedTerm?.id && result.subject === subject);
    const previous = activeParentHistory.find((result) => result.termId === previousPublishedTerm?.id && result.subject === subject);
    return {
      subject,
      current: current ? Math.round(current.score / current.outOf * 100) : null,
      previous: previous ? Math.round(previous.score / previous.outOf * 100) : null,
    };
  });
  const termLabel = (term?: { name: string; academicYear: string }) => term ? `${term.name[0]}${term.name.slice(1).toLowerCase()} · ${term.academicYear}` : "";
  const publishedAverage = activePortalResults.length
    ? Math.round(activePortalResults.reduce((sum, result) => sum + (result.score / result.outOf) * 100, 0) / activePortalResults.length)
    : 0;
  const selectedPortalYear = portalAcademicYears.find((year) => year.id === selectedPortalYearId);
  const selectedPortalTerm = selectedPortalYear?.terms.find((term) => term.id === selectedPortalTermId);

  useEffect(() => {
    if (role !== "teacher") return;
    const controller = new AbortController();
    async function loadTeacherResults() {
      setTeacherResultsLoading(true);
      try {
        const query = selectedTeacherTermId ? `?termId=${encodeURIComponent(selectedTeacherTermId)}` : "";
        const response = await fetch(`/api/results${query}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load assigned results");
        const years = data.academicYears ?? [];
        setTeacherAcademicYears(years);
        setTeacherResultStudents((data.students ?? []).map((student: { id: string; fullName: string; studentCode: string; class: TeacherClass }) => ({
          id: student.id,
          name: student.fullName,
          studentId: student.studentCode,
          classId: student.class.id,
          className: student.class.name,
          parent: "Not provided",
          status: "Active" as const,
        })));
        setActiveResultTermId(data.activeTermId ?? "");
        const yearForDisplayedTerm = data.term
          ? years.find((year: TeacherAcademicYear) => year.terms.some((term) => term.id === data.term.id))
          : null;
        const defaultYear = years.find((year: TeacherAcademicYear) => year.isCurrent) ?? years[0];
        setSelectedAcademicYearId(yearForDisplayedTerm?.id ?? defaultYear?.id ?? "");
        if (data.term) {
          setSelectedTeacherTermId(data.term.id);
          setFollowsActiveTerm(data.term.id === data.activeTermId);
        }
        setLoadedTeacherTermId(data.term?.id ?? "");
        setTeacherResultsLoaded(true);
        const activeYear = years.find((year: TeacherAcademicYear) => year.isCurrent);
        const nextTerm = data.term
          ? `${formatTermName(data.term.name)} · ${data.term.academicYear}`
          : activeYear ? `No current term · ${activeYear.name}` : "No active session";
        setPortalTerm(nextTerm);
        if (!data.term) {
          setTeacherAssignments([]);
          setTeacherSubjects([]);
          setSelectedSubjectId("");
          setMarks([]);
          setTermResults([]);
          setResultNotice("Admin has not set the school session and term. Please contact your admin because a session and term must be set before results can be recorded.");
          return;
        }
        setTeacherAssignments(data.assignments);
        setTeacherSubjects(data.subjects);
        setSelectedSubjectId((current) => current || data.subjects[0]?.id || "");
        setMarks(data.results);
        setTermResults(data.termResults ?? []);
        setTeacherResultsDirty(false);
        setResultNotice(data.activeTermId === data.term.id ? "" : "Historical term selected. Only existing drafts or returned results can be edited.");
      } catch (error) {
        if (controller.signal.aborted) return;
        setResultNotice(error instanceof Error ? error.message : "Unable to load assigned results");
      } finally {
        if (!controller.signal.aborted) setTeacherResultsLoading(false);
      }
    }
    void loadTeacherResults();
    return () => controller.abort();
  }, [role, selectedTeacherTermId]);

  useEffect(() => {
    if (role !== "teacher" || feature !== "results") return;
    async function refreshActiveTerm() {
      try {
        const response = await fetch("/api/results?activeOnly=true");
        const data = await response.json();
        if (!response.ok) return;
        const activeTermId = data.activeTermId ?? "";
        const years = data.academicYears ?? [];
        setTeacherAcademicYears(years);
        if (followsActiveTerm) {
          if (activeTermId !== selectedTeacherTermId && teacherResultsDirty) {
            setFollowsActiveTerm(false);
            setResultNotice("The admin changed the active term. Your unsaved edits are still shown; save existing drafts or confirm before switching terms.");
            return;
          }
          setActiveResultTermId(activeTermId);
          if (activeTermId !== selectedTeacherTermId) setSelectedTeacherTermId(activeTermId);
          const activeYear = years.find((year: TeacherAcademicYear) => year.terms.some((term) => term.id === activeTermId))
            ?? years.find((year: TeacherAcademicYear) => year.isCurrent);
          if (activeYear) setSelectedAcademicYearId(activeYear.id);
        } else {
          setActiveResultTermId(activeTermId);
        }
      } catch {
        return;
      }
    }
    void refreshActiveTerm();
    const interval = window.setInterval(() => { void refreshActiveTerm(); }, 30000);
    window.addEventListener("focus", refreshActiveTerm);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshActiveTerm);
    };
  }, [role, feature, followsActiveTerm, selectedTeacherTermId, teacherResultsDirty]);

  function changeTeacherTerm(academicYearId: string, termId: string) {
    if (termId !== selectedTeacherTermId && teacherResultsDirty) {
      const discard = window.confirm("Switch terms and discard unsaved result changes?");
      if (!discard) return;
      setTeacherResultsDirty(false);
    }
    setSelectedAcademicYearId(academicYearId);
    setSelectedTeacherTermId(termId);
    const year = teacherAcademicYears.find((item) => item.id === academicYearId);
    setFollowsActiveTerm(Boolean(year?.terms.some((term) => term.id === termId && term.isCurrent)));
  }

  function setStudentPassport(studentName: string, photo: string) {
    setPassportPhotos((current) => ({ ...current, [studentName]: photo }));
  }

  function updateMark(studentId: string, score: number) {
    setTeacherResultsDirty(true);
    const existing = marks.find((mark) => mark.studentId === studentId && mark.subjectId === selectedSubjectId);
    if (existing) {
      setMarks((current) => current.map((mark) => mark.id === existing.id ? { ...mark, marks: score } : mark));
    } else {
      const student = teacherResultStudents.find((item) => item.id === studentId);
      const subject = teacherSubjects.find((item) => item.id === selectedSubjectId);
      if (!student || !subject || !selectedTeacherClass) return;
      setMarks((current) => [{
        id: `local:${studentId}:${selectedSubjectId}`,
        studentId,
        subjectId: selectedSubjectId,
        marks: score,
        maxMarks: 100,
        ca1: null,
        ca2: null,
        ca3: null,
        exam: null,
        status: "DRAFT",
        comments: null,
        behavioralRating: null,
        behavioralComment: null,
        psychomotorRating: null,
        psychomotorComment: null,
        student: { id: student.id, fullName: student.name, studentCode: student.studentId, class: { id: selectedClassId, name: student.className } },
        subject,
      }, ...current]);
    }
  }

  function updateResultDetails(studentId: string, field: "ca1" | "ca2" | "ca3" | "exam" | "comments" | "behavioralRating" | "behavioralComment" | "psychomotorRating" | "psychomotorComment", value: string | number | null) {
    setTeacherResultsDirty(true);
    const existing = marks.find((mark) => mark.studentId === studentId && mark.subjectId === selectedSubjectId);
    if (existing) {
      setMarks((current) => current.map((mark) => mark.id === existing.id ? { ...mark, [field]: value } : mark));
      return;
    }
    const student = teacherResultStudents.find((item) => item.id === studentId);
    const subject = teacherSubjects.find((item) => item.id === selectedSubjectId);
    if (!student || !subject || !selectedTeacherClass) return;
    setMarks((current) => [{
      id: `local:${studentId}:${selectedSubjectId}`,
      studentId,
      subjectId: selectedSubjectId,
      marks: "",
      maxMarks: 100,
      ca1: null,
      ca2: null,
      ca3: null,
      exam: null,
      status: "DRAFT",
      comments: null,
      behavioralRating: null,
      behavioralComment: null,
      psychomotorRating: null,
      psychomotorComment: null,
      [field]: value,
      student: { id: student.id, fullName: student.name, studentCode: student.studentId, class: { id: selectedClassId, name: student.className } },
      subject,
    }, ...current]);
  }

  async function saveMarks(action: "draft" | "submit") {
    if (!teacherResultsReady) {
      setResultNotice("Wait for the selected term's results to finish loading before saving.");
      return;
    }
    if (!selectedTeacherTermId) {
      setResultNotice("Admin has not set the school session and term. Please contact your admin because a session and term must be set before results can be recorded.");
      return;
    }
    const incompleteScores = action === "submit" && selectedTeacherResultRoster.some((student) => {
      const result = marks.find((item) => item.studentId === student.id && item.subjectId === selectedSubjectId);
      const components = [result?.ca1, result?.ca2, result?.ca3, result?.exam];
      return components.some((score) => score !== null && score !== undefined)
        && components.some((score) => score === null || score === undefined);
    });
    if (incompleteScores) {
      setResultNotice("Complete CA1, CA2, CA3, and exam for each student before submitting");
      return;
    }
    const entries = selectedTeacherResultRoster.flatMap((student) => {
      const result = marks.find((item) => item.studentId === student.id && item.subjectId === selectedSubjectId);
      if (!result) return [];
      const components = [result.ca1, result.ca2, result.ca3, result.exam].map((value) => value === null ? null : Number(value));
      const hasComponents = components.some((value) => value !== null);
      const hasLegacyMark = !hasComponents && result.marks !== null && result.marks !== "" && Number.isFinite(Number(result.marks));
      const hasAssessment = result.behavioralRating !== null || Boolean(result.behavioralComment?.trim())
        || result.psychomotorRating !== null || Boolean(result.psychomotorComment?.trim());
      if (!hasComponents && !hasLegacyMark && !hasAssessment && !result.comments?.trim()) return [];
      return [{
        studentId: student.id,
        subjectId: selectedSubjectId,
        marks: hasLegacyMark ? Number(result.marks) : undefined,
        maxMarks: hasLegacyMark ? Number(result.maxMarks) : 100,
        ca1: components[0],
        ca2: components[1],
        ca3: components[2],
        exam: components[3],
        comments: result.comments ?? "",
        behavioralRating: result.behavioralRating,
        behavioralComment: result.behavioralComment ?? "",
        psychomotorRating: result.psychomotorRating,
        psychomotorComment: result.psychomotorComment ?? "",
      }];
    });
    if (!entries.length) {
      setResultNotice("Enter at least one score or assessment before saving");
      return;
    }
    if (entries.some((entry) => [entry.ca1, entry.ca2, entry.ca3].some((score) => score !== null && (score < 0 || score > 10))
      || (entry.exam !== null && (entry.exam < 0 || entry.exam > 70)))) {
      setResultNotice("Each CA must be between 0 and 10; the exam must be between 0 and 70");
      return;
    }
    setSavingResults(true);
    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, termId: selectedTeacherTermId, entries }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save results");
      const refreshed = await fetch(`/api/results?termId=${encodeURIComponent(selectedTeacherTermId)}`);
      const refreshedData = await refreshed.json();
      if (refreshed.ok) {
        setMarks(refreshedData.results);
        setTermResults(refreshedData.termResults ?? []);
        setTeacherResultsDirty(false);
      }
      setResultNotice(action === "submit" ? `${data.count} result${data.count === 1 ? "" : "s"} submitted for admin review` : `${data.count} draft result${data.count === 1 ? "" : "s"} saved`);
    } catch (error) {
      setResultNotice(error instanceof Error ? error.message : "Unable to save results");
    } finally {
      setSavingResults(false);
    }
  }

  async function registerStudentToClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch(editingAdmissionId ? `/api/admissions/${editingAdmissionId}` : "/api/admissions", {
        method: editingAdmissionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingAdmissionId ? "resubmit" : undefined,
          fullName: form.get("studentName"),
          studentCode: form.get("studentId"),
          classId: form.get("classId"),
          guardianName: form.get("parentName"),
          guardianPhone: form.get("parentPhone"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not submit registration");
      setTeacherAdmissions((current) => editingAdmissionId
        ? current.map((request) => request.id === editingAdmissionId ? data.request : request)
        : [data.request, ...current]);
      setEditingAdmissionId(null);
      formElement.reset();
      setNotice(editingAdmissionId ? "Corrected registration resubmitted for review" : "Registration sent to the administrator for review");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not submit registration");
    }
  }

  if (feature === "overview") {
    const overviewCards = role === "teacher"
      ? [
          { label: "My Classes", href: "/teacher/classes" },
          { label: "Enter Results", href: "/teacher/results" },
          { label: "Attendance", href: "/teacher/attendance" },
          { label: "Announcements", href: "/teacher/announcements" },
        ]
      : role === "student"
        ? [
            { label: "My Results", href: "/student/results" },
            { label: "Attendance", href: "/student/attendance" },
            { label: "Timetable", href: "/student/timetable" },
            { label: "Profile", href: "/student/profile" },
          ]
        : [
            { label: "My Children", href: "/parent/children" },
            { label: "Academic Results", href: "/parent/results" },
            { label: "Attendance", href: "/parent/attendance" },
            { label: "Profile", href: "/parent/profile" },
          ];

    return (
      <main className="app-shell">
        <aside className="sidebar">
          <Link className="brand" href="/"><SchoolLogo size={44} className="brand-crest"/><span><strong>Albayyan</strong><small>INTERNATIONAL SCHOOL</small></span></Link>
          <div className="school-switcher"><SchoolLogo size={34} className="school-crest-small"/><span><strong>Albayyan International School</strong><small>{roleName} access</small></span><span className="chevron">⌄</span></div>
          <RoleNavigation role={role} feature={feature}/>
          <div className="sidebar-bottom"><div className="term-note"><span className="term-dot"/><span><small>ACTIVE SESSION</small><strong>{portalTerm.split(" · ")[1] || "Loading"}</strong></span></div><div className="profile-button"><span className="profile-avatar">{role === "teacher" ? "PN" : role === "student" ? "VO" : "VP"}</span><span><strong>{displayedStudent || (role === "teacher" ? "Signed-in teacher" : role === "parent" ? "Linked parent" : "Signed-in student")}</strong><small>{roleName} portal</small></span></div></div>
        </aside>
        <section className="main-panel">
          <header className="topbar"><div className="breadcrumb">Results portals <span>/</span> <strong>{roleName}</strong></div><div className="topbar-actions"><span className="portal-session">{portalTerm || "Loading session"}</span><button className="portal-profile-trigger" type="button" aria-label="Open my profile" title="My profile" onClick={() => setProfileOpen(true)}><span className="profile-trigger-avatar">{role === "teacher" ? "PN" : role === "student" ? "VO" : "VP"}</span><span className="profile-trigger-label">Profile</span></button><LogoutButton /></div></header>
          <div className="content-wrap">
            <div className="page-heading"><div><p className="eyebrow">{roleName.toUpperCase()} PORTAL <span className="eyebrow-dot"/> {portalTerm.split(" · ")[0] || "CURRENT SESSION"}</p><h1>Overview</h1><p className="page-description">Each workspace below opens on its own dedicated page.</p></div></div>
            <section className="summary-grid role-summary">
              {role === "teacher" && <>
                <article className="summary-card"><span className="summary-label">CLASS ROSTER</span><strong>{selectedClassRoster.length}</strong><small>Assigned students</small><span className="summary-mark mark-green">♙</span></article>
                <article className="summary-card"><span className="summary-label">REGISTRATION</span><strong>{selectedClassAdmissions.filter((item) => item.status === "PENDING" || item.status === "RETURNED").length}</strong><small>Awaiting review</small><span className="summary-mark mark-amber">◷</span></article>
                <article className="summary-card"><span className="summary-label">RESULTS</span><strong>{marks.filter((mark) => mark.status === "SUBMITTED" || mark.status === "UNDER_REVIEW").length}</strong><small>Pending approval</small><span className="summary-mark mark-blue">✓</span></article>
              </>}
              {role === "student" && <>
                <article className="summary-card"><span className="summary-label">TERM AVERAGE</span><strong>{publishedAverage}%</strong><small>Published subjects</small><span className="summary-mark mark-green">↗</span></article>
                <article className="summary-card"><span className="summary-label">CLASS</span><strong>{activePortalStudent?.class.name ?? "—"}</strong><small>Current enrolment</small><span className="summary-mark mark-blue">▥</span></article>
                <article className="summary-card"><span className="summary-label">RESULTS</span><strong>{activePortalResults.length}</strong><small>Published</small><span className="summary-mark mark-amber">▤</span></article>
              </>}
              {role === "parent" && <>
                <article className="summary-card"><span className="summary-label">CHILDREN</span><strong>{portalStudents.length}</strong><small>Linked students</small><span className="summary-mark mark-green">♙</span></article>
                <article className="summary-card"><span className="summary-label">SESSION</span><strong>{portalTerm.split(" · ")[1] || "—"}</strong><small>Current term</small><span className="summary-mark mark-blue">▥</span></article>
                <article className="summary-card"><span className="summary-label">RESULTS</span><strong>{activePortalResults.length}</strong><small>Public record</small><span className="summary-mark mark-amber">▤</span></article>
              </>}
            </section>
            <div className="management-grid">
              {overviewCards.map((item) => (
                <Link key={item.href} className="results-section feature-highlight-card" href={item.href}>
                  <div className="section-heading"><div><h2>{item.label}</h2><p>Open the dedicated {item.label.toLowerCase()} page.</p></div></div>
                </Link>
              ))}
            </div>
            <p className="data-note"><span>i</span> Each feature opens on its own page; this overview only links to the dedicated workspaces.</p>
          </div>
        </section>
      </main>
    );
  }

  if (feature !== "overview") {
    const featureTitle = portalFeatures[role].find((item) => item.id === feature)?.label ?? "My Portal";
    return (
      <main className="app-shell">
        <aside className="sidebar">
          <Link className="brand" href="/"><SchoolLogo size={44} className="brand-crest"/><span><strong>Albayyan</strong><small>INTERNATIONAL SCHOOL</small></span></Link>
          <div className="school-switcher"><SchoolLogo size={34} className="school-crest-small"/><span><strong>Albayyan International School</strong><small>{roleName} access</small></span></div>
          <RoleNavigation role={role} feature={feature}/>
          <div className="sidebar-bottom"><div className="term-note"><span className="term-dot"/><span><small>ACTIVE SESSION</small><strong>{portalTerm.split(" · ")[1] || "Loading"}</strong></span></div><div className="profile-button"><span className="profile-avatar">{role === "teacher" ? "PN" : role === "student" ? "VO" : "VP"}</span><span><strong>{displayedStudent || (role === "teacher" ? "Signed-in teacher" : role === "parent" ? "Linked parent" : "Signed-in student")}</strong><small>{roleName} portal</small></span></div></div>
        </aside>
        <section className="main-panel">
          <header className="topbar"><div className="breadcrumb">{roleName} workspace <span>/</span> <strong>{featureTitle}</strong></div><div className="topbar-actions"><span className="portal-session">{portalTerm || "Loading session"}</span><button className="portal-profile-trigger" type="button" aria-label="Open my profile" title="My profile" onClick={() => setProfileOpen(true)}><span className="profile-trigger-avatar">{role === "teacher" ? "PN" : role === "student" ? "VO" : "VP"}</span><span className="profile-trigger-label">Profile</span></button><LogoutButton /></div></header>
          <div className="content-wrap">
            <div className="page-heading"><div><p className="eyebrow">{roleName.toUpperCase()} PORTAL <span className="eyebrow-dot"/> {portalTerm.split(" · ")[0] || "CURRENT SESSION"}</p><h1>{featureTitle}</h1><p className="page-description">{role === "teacher" ? "Manage this part of your assigned school workflow." : "View the records and updates available to your account."}</p></div></div>
            {role === "teacher" && feature === "results" && <div className="teacher-term-navigation">
              <label className="teacher-class-picker"><span>SESSION</span><select value={selectedAcademicYearId} onChange={(event) => {
                const yearId = event.target.value;
                const year = teacherAcademicYears.find((item) => item.id === yearId);
                const firstTermId = year?.terms.find((term) => term.isCurrent)?.id ?? year?.terms[0]?.id ?? "";
                changeTeacherTerm(yearId, firstTermId);
              }} disabled={!teacherAcademicYears.length}><option value="">Select session</option>{teacherAcademicYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Active" : ""}</option>)}</select></label>
              <label className="teacher-class-picker"><span>TERM</span><select value={selectedTeacherTermId} onChange={(event) => {
                const termId = event.target.value;
                changeTeacherTerm(selectedAcademicYearId, termId);
              }} disabled={!selectedAcademicYear?.terms.length}><option value="">Select term</option>{selectedAcademicYear?.terms.map((term) => <option key={term.id} value={term.id}>{term.name[0] + term.name.slice(1).toLowerCase()} term{term.isCurrent ? " · Active" : ""}</option>)}</select></label>
              <span className="teacher-term-state">{canCreateResults ? "Active recording term" : selectedTeacherTermId ? "Historical term" : "No term selected"}</span>
            </div>}
            {role === "teacher" && feature === "classes" && <>
              <section className="role-banner"><span className="role-banner-mark">♧</span><div><strong>{selectedTeacherClass?.name ?? "Assigned classes"}</strong><small>{selectedClassRoster.length} enrolled students <span>·</span> {teacherClasses.length} assigned classes</small></div>{teacherClasses.length > 1 && <label className="teacher-class-picker"><span className="sr-only">Select class</span><select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>{teacherClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>}</section>
              <div className="management-grid">
                <section className="results-section"><div className="section-heading"><div><h2>Assigned subjects</h2><p>Subjects linked to {selectedTeacherClass?.name ?? "this class"}</p></div></div><div className="class-subject-list">{selectedClassSubjects.length ? selectedClassSubjects.map((subject) => <span key={subject.id}>{subject.name}</span>) : <span>No subjects assigned to this class yet.</span>}</div></section>
                <section className="results-section"><div className="section-heading"><div><h2>Register student to class</h2><p>Send a registration request to the administrator for approval.</p></div></div><form key={editingAdmissionId ?? "new-admission"} className="dashboard-form" onSubmit={registerStudentToClass}><label>Student full name<input name="studentName" defaultValue={teacherAdmissions.find((item) => item.id === editingAdmissionId)?.fullName ?? ""} required /></label><div className="form-pair"><label>Student ID<input name="studentId" defaultValue={teacherAdmissions.find((item) => item.id === editingAdmissionId)?.studentCode ?? ""} required /></label><label>Class<select name="classId" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} required disabled={!teacherClasses.length}><option value="" disabled>Select assigned class</option>{teacherClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label></div><div className="form-pair"><label>Parent / guardian<input name="parentName" defaultValue={teacherAdmissions.find((item) => item.id === editingAdmissionId)?.guardianName ?? ""} required /></label><label>Guardian phone<input name="parentPhone" type="tel" defaultValue={teacherAdmissions.find((item) => item.id === editingAdmissionId)?.guardianPhone ?? ""} required /></label></div><div className="slot-actions"><button className="primary-button" type="submit" disabled={!teacherClasses.length}>{editingAdmissionId ? "Resubmit request" : "Submit registration"}</button></div></form></section>
                <section className="results-section"><div className="section-heading"><div><h2>{selectedTeacherClass?.name ?? "Class"} roster</h2><p>Approved students</p></div></div><div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>GUARDIAN</th><th>PROFILE</th></tr></thead><tbody>{selectedClassRoster.map((student) => <tr key={student.id}><td>{student.name}</td><td>{student.studentId}</td><td>{student.parent}</td><td><button className="row-action" type="button" onClick={() => setSelectedRosterProfileId(student.id)}>View profile</button></td></tr>)}{!selectedClassRoster.length && <tr><td className="empty-state" colSpan={4}>No students enrolled.</td></tr>}</tbody></table></div></section>
              </div>
              {selectedRosterProfileId && <StudentProfileView studentId={selectedRosterProfileId} onClose={() => setSelectedRosterProfileId(null)} />}
              <section className="results-section"><div className="section-heading"><div><h2>Registration requests</h2><p>Review the administrator&apos;s decision and notes.</p></div></div><div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>CLASS</th><th>STATUS</th><th>ADMIN NOTE</th><th>ACTION</th></tr></thead><tbody>{selectedClassAdmissions.map((item) => <tr key={item.id}><td>{item.fullName}</td><td>{item.class.name}</td><td>{item.status}</td><td>{item.reviewNote ?? "—"}</td><td>{item.status === "RETURNED" && <button className="row-action" type="button" onClick={() => { setEditingAdmissionId(item.id); setSelectedClassId(item.class.id); }}>Edit & resubmit</button>}</td></tr>)}{!selectedClassAdmissions.length && <tr><td className="empty-state" colSpan={5}>No registration requests for this class.</td></tr>}</tbody></table></div></section>
            </>}
            {role === "teacher" && feature === "attendance" && <AttendanceWorkspace role="teacher" />}
            {role === "teacher" && feature === "announcements" && <AnnouncementsWorkspace role="teacher" />}
            {role === "teacher" && feature === "results" && (
              teacherSessionBlocked ? (
                <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setTermNoticeDismissed(true); setResultNotice(""); } }}>
                  <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="term-block-title">
                    <div className="modal-heading">
                      <div><p className="eyebrow">SCHOOL SESSION</p><h2 id="term-block-title">Session not set</h2></div>
                      <button className="modal-close" type="button" aria-label="Close session notice" onClick={() => { setTermNoticeDismissed(true); setResultNotice(""); }}>×</button>
                    </div>
                    <p className="modal-description">Admin has not set the school session and term. Please contact your admin because a session and term must be set before results can be recorded.</p>
                    <div className="form-actions"><button className="primary-button" type="button" onClick={() => { setTermNoticeDismissed(true); setResultNotice(""); }}>OK</button></div>
                  </section>
                </div>
              ) : (
                <section className="results-section"><div className="section-heading"><div><h2>Enter class results</h2><p>Save drafts or submit marks for administrator review.</p></div><label className="teacher-class-picker"><span className="sr-only">Select subject</span><select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)} disabled={!selectedClassSubjects.length}><option value="">Select subject</option>{selectedClassSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label></div><div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>ID</th><th>MARK</th><th>GRADE</th><th>STATUS</th><th>ADMIN NOTE</th></tr></thead><tbody>{selectedClassRoster.map((student) => { const result = marks.find((item) => item.studentId === student.id && item.subjectId === selectedSubjectId); const score = result ? Number(result.marks) : 0; const locked = result && !["DRAFT", "RETURNED"].includes(result.status); return <tr key={student.id}><td>{student.name}</td><td>{student.studentId}</td><td>{locked ? `${score} / ${result?.maxMarks}` : <input className="score-input" type="number" min="0" max={result?.maxMarks ?? 100} value={result ? score : ""} onChange={(event) => updateMark(student.id, Number(event.target.value))} aria-label={`Score for ${student.name}`} />}</td><td>{result ? gradeFor(score / Number(result.maxMarks) * 100) : "—"}</td><td>{result?.status.replaceAll("_", " ") ?? "Not entered"}</td><td>{result?.reviewNote ?? "—"}</td></tr>})}{!selectedClassRoster.length && <tr><td className="empty-state" colSpan={6}>No students assigned.</td></tr>}</tbody></table></div><footer className="table-footer"><span>{resultNotice || "Marks are editable until submission."}</span><div className="row-actions"><button className="cancel-button" type="button" onClick={() => void saveMarks("draft")} disabled={savingResults}>Save drafts</button><button className="primary-button" type="button" onClick={() => void saveMarks("submit")} disabled={savingResults}>{savingResults ? "Saving..." : "Submit for review"}</button></div></footer></section>
              )
            )}
            {role === "parent" && feature === "results" && <section className="results-section parent-performance-section"><div className="section-heading"><div><h2>Performance comparison</h2><p>{latestPublishedTerm ? `Latest published: ${termLabel(latestPublishedTerm)}${previousPublishedTerm ? ` · Previous: ${termLabel(previousPublishedTerm)}` : " · No earlier published term yet"}` : "Published results will appear here once available."}</p></div></div>{comparisonData.length > 0 && latestPublishedTerm ? <><div className="parent-performance-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparisonData} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}><CartesianGrid stroke="#e7ece7" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" tick={{ fill: "#6f7b72", fontSize: 10 }} axisLine={{ stroke: "#dfe6df" }} tickLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "#77837a", fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => typeof value === "number" ? `${value}%` : "—"} /><Legend />{previousPublishedTerm && <Bar dataKey="previous" name={termLabel(previousPublishedTerm)} fill="#d7a85c" radius={[3, 3, 0, 0]} />}<Bar dataKey="current" name={termLabel(latestPublishedTerm)} fill="#286b4a" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><p className="parent-performance-note">Subject marks are converted to percentages; only published or locked results are included.</p></> : <div className="parent-performance-empty">No published results are available for this child yet.</div>}{latestPublishedTerm && !previousPublishedTerm && comparisonData.length > 0 && <p className="parent-performance-note">A previous-term comparison will appear after results from another term are published.</p>}</section>}
            {(role === "student" || role === "parent") && feature === "attendance" && <AttendanceWorkspace role={role} />}
            {(role === "student" || role === "parent") && feature === "announcements" && <AnnouncementsWorkspace role={role} />}
            {feature === "syllabus" && <SyllabusWorkspace role={role} />}
            {feature === "holiday-projects" && <HolidayProjectsWorkspace role={role} />}
            {(role === "student" || role === "parent") && feature === "results" && <>
              <div className="report-card-context no-print">
                {role === "parent" && <label className="child-picker"><span>CHILD</span><select value={selectedChild} onChange={(event) => setSelectedChild(event.target.value)}>{portalStudents.map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}</select></label>}
                <label className="child-picker"><span>SESSION</span><select value={selectedPortalYearId} onChange={(event) => {
                  const yearId = event.target.value;
                  const year = portalAcademicYears.find((item) => item.id === yearId);
                  setSelectedPortalYearId(yearId);
                  setSelectedPortalTermId(year?.terms.find((item) => item.isCurrent)?.id ?? year?.terms[0]?.id ?? "");
                }} disabled={!portalAcademicYears.length}><option value="">Select session</option>{portalAcademicYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Active" : ""}</option>)}</select></label>
                <label className="child-picker"><span>RESULT VIEW</span><select value={portalResultsView === "session" ? "session" : selectedPortalTermId} onChange={(event) => {
                  if (event.target.value === "session") {
                    setPortalResultsView("session");
                    return;
                  }
                  setSelectedPortalTermId(event.target.value);
                  setPortalResultsView("term");
                }} disabled={!selectedPortalYear?.terms.length}><option value="session">Session results · All terms</option>{selectedPortalYear?.terms.map((term) => <option key={term.id} value={term.id}>{term.name[0] + term.name.slice(1).toLowerCase()} term</option>)}</select></label>
              </div>
              <TermReportCard studentName={displayedStudent} studentCode={activePortalStudent?.studentCode ?? ""} className={activePortalStudent?.class.name ?? ""} term={portalResultsView === "session" ? `SESSION · ${selectedPortalYear?.name ?? ""}` : selectedPortalTerm ? `${selectedPortalTerm.name[0] + selectedPortalTerm.name.slice(1).toLowerCase()} · ${selectedPortalYear?.name ?? ""}` : portalTerm} results={activePortalResults} cumulativeResults={activePortalCumulativeResults} studentId={activePortalStudent?.id ?? ""} average={publishedAverage} isSessionResult={portalResultsView === "session"} />
            </>}
            {(role === "student" || role === "parent") && feature === "timetable" && <section className="results-section"><div className="section-heading"><div><h2>{role === "parent" ? `${displayedStudent} timetable` : "Weekly timetable"}</h2><p>{activePortalStudent?.class.name ?? "Assigned class schedule"} · Current published schedule</p></div>{role === "parent" && <label className="child-picker"><span>CHILD</span><select value={selectedChild} onChange={(event) => setSelectedChild(event.target.value)}>{portalStudents.map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}</select></label>}</div><div className="table-scroll"><table className="results-table"><thead><tr><th>DAY</th><th>TIME</th><th>SUBJECT</th><th>TEACHER</th><th>ROOM</th></tr></thead><tbody>{activePortalTimetable.map((slot) => <tr key={slot.id}><td>{slot.day[0] + slot.day.slice(1).toLowerCase()}</td><td>{slot.startsAt}–{slot.endsAt}</td><td>{slot.subject.name}</td><td>{slot.teacher?.fullName ?? "—"}</td><td>{slot.room ?? "—"}</td></tr>)}{!activePortalTimetable.length && <tr><td className="empty-state" colSpan={5}>No timetable has been published for this class yet.</td></tr>}</tbody></table></div></section>}
            {(role === "student" || role === "parent") && feature === "fees" && <StudentDetailsPanel studentName={activePortalStudent?.fullName ?? "Student"} initialSection="Fees & debts" lockedSection />}
            {(feature === "profile" || feature === "children") && (activePortalStudent
              ? <StudentProfileView studentId={activePortalStudent.id} />
              : <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Student profile unavailable</h3></div><p className="student-profile-error">No student record is linked to this account.</p></section>)}
            {role === "teacher" && feature === "profile" && <section className="results-section"><div className="section-heading"><div><h2>Teacher profile</h2><p>Employment and teaching assignment</p></div></div><div className="profile-content"><dl className="profile-fields"><div><dt>Teacher name</dt><dd>Signed-in teacher</dd></div><div><dt>Assigned classes</dt><dd>{teacherClasses.map((item) => item.name).join(", ") || "No classes assigned"}</dd></div><div><dt>Assigned subjects</dt><dd>{teacherSubjects.map((item) => item.name).join(", ") || "No subjects assigned"}</dd></div></dl></div></section>}
            {!portalFeatures[role].some((item) => item.id === feature) && <section className="results-section"><div className="section-heading"><div><h2>Feature not available</h2><p>This feature has not been configured yet.</p></div></div></section>}
            {role === "teacher" && feature === "results" && !teacherSessionBlocked && <TeacherAssessmentPanel
              students={teacherResultsReady ? selectedTeacherResultRoster : []}
              classes={teacherClasses}
              classId={selectedClassId}
              subjects={selectedClassSubjects}
              subjectId={selectedSubjectId}
              termId={selectedTeacherTermId}
              termResults={teacherResultsReady ? termResults : []}
              getEntry={(studentId) => marks.find((item) => item.studentId === studentId && item.subjectId === selectedSubjectId)}
              onClassChange={(classId) => {
                setSelectedClassId(classId);
                setSelectedSubjectId(teacherAssignments.find((assignment) => assignment.classId === classId)?.subjectId ?? "");
              }}
              onSubjectChange={setSelectedSubjectId}
              onUpdate={updateResultDetails}
              onSave={saveMarks}
              saving={savingResults}
              notice={resultNotice}
              canCreateResults={canCreateResults && teacherResultsReady}
              termDataReady={teacherResultsReady}
              loadingTermData={teacherResultsLoading}
            />}
            <p className="data-note"><span>i</span> Features open on their own route. Data-backed pages require PostgreSQL and the latest Prisma migration.</p>
          </div>
        </section>
        {notice && <div className="toast" role="status">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><SchoolLogo size={44} className="brand-crest"/><span><strong>Albayyan</strong><small>INTERNATIONAL SCHOOL</small></span></Link>
        <div className="school-switcher"><SchoolLogo size={34} className="school-crest-small"/><span><strong>Albayyan International School</strong><small>{roleName} access</small></span><span className="chevron">⌄</span></div>
        <RoleNavigation role={role} feature={feature}/>
        <div className="sidebar-bottom"><div className="term-note"><span className="term-dot"/><span><small>ACTIVE SESSION</small><strong>{portalTerm.split(" · ")[1] || "Loading"}</strong></span></div><div className="profile-button"><span className="profile-avatar">{role === "teacher" ? "PN" : role === "student" ? "VO" : "VP"}</span><span><strong>{displayedStudent || (role === "teacher" ? "Signed-in teacher" : role === "parent" ? "Linked parent" : "Signed-in student")}</strong><small>{roleName} portal</small></span></div></div>
      </aside>

      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb">Results portals <span>/</span> <strong>{roleName}</strong></div><div className="topbar-actions"><span className="portal-session">{portalTerm || "Loading session"}</span><button className="portal-profile-trigger" type="button" aria-label="Open my profile" title="My profile" onClick={() => setProfileOpen(true)}><span className="profile-trigger-avatar">{role === "teacher" ? "PN" : role === "student" ? "VO" : "VP"}</span><span className="profile-trigger-label">Profile</span></button></div></header>
        <div className="content-wrap">
          {role === "teacher" && <>
            <div className="page-heading"><div><p className="eyebrow">TEACHER WORKSPACE <span className="eyebrow-dot"/> SECOND TERM</p><h1>Class registration & score entry</h1><p className="page-description">Manage your assigned class, submit student admissions for approval, and enter results.</p></div></div>
            <section className="role-banner"><span className="role-banner-mark">♧</span><div><strong>{selectedTeacherClass?.name ?? "Assigned classes"}</strong><small>Teacher account <span>·</span> {selectedClassRoster.length} enrolled students</small></div>{teacherClasses.length > 1 && <label className="teacher-class-picker"><span className="sr-only">Select class</span><select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>{teacherClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>}<span className="banner-status">Class management</span></section>
            <section className="summary-grid role-summary"><article className="summary-card"><span className="summary-label">CLASS ROSTER</span><strong>{selectedClassRoster.length}</strong><small>Approved students</small><span className="summary-mark mark-green">♙</span></article><article className="summary-card"><span className="summary-label">REGISTRATION REQUESTS</span><strong>{selectedClassAdmissions.filter((item) => item.status === "PENDING" || item.status === "RETURNED").length}</strong><small>Awaiting admin decision</small><span className="summary-mark mark-amber">◷</span></article><article className="summary-card"><span className="summary-label">SUBMITTED RESULTS</span><strong>{marks.filter((mark) => mark.status === "SUBMITTED" || mark.status === "UNDER_REVIEW").length}</strong><small>Awaiting admin review</small><span className="summary-mark mark-blue">✓</span></article><article className="summary-card"><span className="summary-label">RETURNED RESULTS</span><strong>{marks.filter((mark) => mark.status === "RETURNED").length}</strong><small>Needs correction</small><span className="summary-mark mark-red">↶</span></article></section>
            <AttendanceWorkspace role="teacher" />
            <AnnouncementsWorkspace role="teacher" />
            <div className="management-grid">
              <section className="results-section">
                <div className="section-heading"><div><h2>Register student to class</h2><p>Submit a new student for administrator review before enrolment.</p></div></div>
                <form key={editingAdmissionId ?? "new-admission"} className="dashboard-form" onSubmit={registerStudentToClass}>
                  <label>Student full name<input name="studentName" defaultValue={teacherAdmissions.find((item) => item.id === editingAdmissionId)?.fullName ?? ""} placeholder="e.g. Chinedu Okafor" required /></label>
                  <div className="form-pair"><label>Student ID<input name="studentId" defaultValue={teacherAdmissions.find((item) => item.id === editingAdmissionId)?.studentCode ?? ""} placeholder="e.g. ST-2210" required /></label><label>Assigned class<select name="classId" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} required disabled={!teacherClasses.length}><option value="" disabled>Select assigned class</option>{teacherClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label></div>
                  <div className="form-pair"><label>Parent / guardian<input name="parentName" defaultValue={teacherAdmissions.find((item) => item.id === editingAdmissionId)?.guardianName ?? ""} placeholder="e.g. Rose Okafor" required /></label><label>Guardian phone<input name="parentPhone" type="tel" defaultValue={teacherAdmissions.find((item) => item.id === editingAdmissionId)?.guardianPhone ?? ""} placeholder="e.g. +234 801 234 5678" required /></label></div>
                  <div className="slot-actions">{editingAdmissionId && <button className="cancel-button" type="button" onClick={() => setEditingAdmissionId(null)}>Cancel correction</button>}<button className="primary-button" type="submit" disabled={!teacherClasses.length}>{editingAdmissionId ? "Resubmit for review" : "Submit registration"}</button></div>
                  {!teacherClasses.length && <p className="form-help">No classes are assigned to this teacher account yet.</p>}
                </form>
              </section>
              <section className="results-section">
                <div className="section-heading"><div><h2>Class roster</h2><p>Approved students currently assigned to {selectedTeacherClass?.name ?? "your class"}.</p></div></div>
                <div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>PARENT / GUARDIAN</th></tr></thead><tbody>{selectedClassRoster.map((student) => <tr key={student.id}><td><strong className="teacher-student-name">{student.name}</strong></td><td>{student.studentId}</td><td>{student.parent}</td></tr>)}{selectedClassRoster.length === 0 && <tr><td className="empty-state" colSpan={3}>No approved students are assigned to this class yet.</td></tr>}</tbody></table></div>
              </section>
            </div>
            <section className="results-section"><div className="section-heading"><div><h2>My registration requests</h2><p>Track review decisions and any correction notes from the administrator.</p></div></div><div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>CLASS</th><th>STATUS</th><th>ADMIN NOTE</th><th>ACTION</th></tr></thead><tbody>{selectedClassAdmissions.map((admission) => <tr key={admission.id}><td><strong className="teacher-student-name">{admission.fullName}</strong></td><td>{admission.studentCode}</td><td><span className="class-tag">{admission.class.name}</span></td><td><span className={`status ${admission.status === "APPROVED" ? "status-approved" : admission.status === "REJECTED" ? "status-returned" : admission.status === "RETURNED" ? "status-submitted" : "status-under-review"}`}><i />{admission.status}</span></td><td>{admission.reviewNote || "—"}</td><td>{admission.status === "RETURNED" && <button className="row-action" type="button" onClick={() => { setEditingAdmissionId(admission.id); setSelectedClassId(admission.class.id); }}>Edit & resubmit →</button>}</td></tr>)}{selectedClassAdmissions.length === 0 && <tr><td className="empty-state" colSpan={6}>No registration requests for this class.</td></tr>}</tbody></table></div></section>
            <section className="results-section"><div className="section-heading"><div><h2>Class subject results</h2><p>Save work as drafts or submit this subject for administrator review.</p></div><label className="teacher-class-picker"><span className="sr-only">Select subject</span><select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)} disabled={!selectedClassSubjects.length}><option value="">Select subject</option>{selectedClassSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label></div><div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>MARK</th><th>GRADE</th><th>STATUS</th><th>ADMIN NOTE</th></tr></thead><tbody>{selectedClassRoster.map((student) => { const result = marks.find((item) => item.studentId === student.id && item.subjectId === selectedSubjectId); const score = result ? Number(result.marks) : 0; const locked = result && !["DRAFT", "RETURNED"].includes(result.status); return <tr key={student.id}><td><strong className="teacher-student-name">{student.name}</strong></td><td>{student.studentId}</td><td>{locked ? <strong className="mark-value">{score} / {result?.maxMarks}</strong> : <input className="score-input" aria-label={`Score for ${student.name}`} type="number" min="0" max={result?.maxMarks ?? 100} value={result ? score : ""} placeholder="—" onChange={(event) => updateMark(student.id, Number(event.target.value))}/>}</td><td>{result ? <span className={`grade grade-${gradeFor(score).toLowerCase()}`}>{gradeFor(score)}</span> : "—"}</td><td><span className={`status status-${(result?.status ?? "DRAFT").toLowerCase().replaceAll("_", "-")}`}><i/>{result?.status.replaceAll("_", " ") ?? "Not entered"}</span></td><td>{result?.reviewNote || "—"}</td></tr>; })}{selectedClassRoster.length === 0 && <tr><td className="empty-state" colSpan={6}>No approved students are available for this class.</td></tr>}</tbody></table></div><footer className="table-footer"><span>{resultNotice || "Marks are saved to the active term and cannot be changed after admin submission."}</span><div className="row-actions"><button className="cancel-button" type="button" disabled={savingResults || !selectedSubjectId} onClick={() => void saveMarks("draft")}>Save drafts</button><button className="primary-button" type="button" disabled={savingResults || !selectedSubjectId} onClick={() => void saveMarks("submit")}>{savingResults ? "Saving..." : "Submit for review"}</button></div></footer></section>
          </>}

          {role === "student" && <>
            <div className="page-heading"><div><p className="eyebrow">STUDENT PORTAL <span className="eyebrow-dot"/> SECOND TERM</p><h1>My results</h1><p className="page-description">Your published academic results for the current term.</p></div><span className="term-chip">2025 / 2026</span></div>
            <section className="role-banner"><PassportAvatar studentName={activePortalStudent?.fullName ?? "Student"} photo={passportPhotos[activePortalStudent?.fullName ?? ""]} onPhotoChange={(photo) => activePortalStudent && setStudentPassport(activePortalStudent.fullName, photo)} /><div><strong>{activePortalStudent?.fullName ?? "Student account"}</strong><small>{activePortalStudent?.studentCode ?? "Profile not linked"} <span>·</span> {activePortalStudent?.class.name ?? "No class"}</small></div><span className="published-label"><i/> Published records</span></section>
            <section className="summary-grid role-summary"><article className="summary-card"><span className="summary-label">TERM AVERAGE</span><strong>{publishedAverage}%</strong><small>Across published subjects</small><span className="summary-mark mark-green">↗</span></article><article className="summary-card"><span className="summary-label">CLASS</span><strong className="term-card-value">{activePortalStudent?.class.name ?? "—"}</strong><small>Current enrolment</small><span className="summary-mark mark-blue">▥</span></article><article className="summary-card"><span className="summary-label">SUBJECTS</span><strong>{activePortalResults.length}</strong><small>{selectedChild || "No linked student"}</small><span className="summary-mark mark-amber">▤</span></article><article className="summary-card"><span className="summary-label">SCHOOL SESSION</span><strong className="term-card-value">{portalTerm.split(" · ")[1] || "—"}</strong><small>{portalTerm.split(" · ")[0] || "No active term"}</small><span className="summary-mark mark-red">◷</span></article></section>
            <AttendanceWorkspace role="student" />
            <AnnouncementsWorkspace role="student" />
            <TermReportCard studentName={activePortalStudent?.fullName ?? ""} studentCode={activePortalStudent?.studentCode ?? ""} className={activePortalStudent?.class.name ?? ""} term={portalTerm} results={activePortalResults} cumulativeResults={activePortalCumulativeResults} studentId={activePortalStudent?.id ?? ""} average={publishedAverage} />
            <StudentDetailsPanel studentName={displayedStudent} />
          </>}

          {role === "parent" && <>
            <div className="page-heading"><div><p className="eyebrow">FAMILY PORTAL <span className="eyebrow-dot"/> SECOND TERM</p><h1>Child results</h1><p className="page-description">View published academic results for your linked children.</p></div><label className="child-picker"><span>CHILD</span><select value={selectedChild} onChange={(event) => setSelectedChild(event.target.value)}>{portalStudents.map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}</select></label></div>
            <section className="role-banner"><PassportAvatar studentName={displayedStudent || "Student"} photo={passportPhotos[displayedStudent]} onPhotoChange={(photo) => setStudentPassport(displayedStudent, photo)} /><div><strong>{displayedStudent || "No linked students"}</strong><small>{activePortalStudent?.studentCode ?? "—"} <span>·</span> {activePortalStudent?.class.name ?? "—"}</small></div><span className="published-label"><i/> Results released</span></section>
            <section className="summary-grid role-summary"><article className="summary-card"><span className="summary-label">TERM AVERAGE</span><strong>{publishedAverage}%</strong><small>Published subjects</small><span className="summary-mark mark-green">↗</span></article><article className="summary-card"><span className="summary-label">CLASS</span><strong className="term-card-value">{activePortalStudent?.class.name ?? "—"}</strong><small>Current enrolment</small><span className="summary-mark mark-blue">▥</span></article><article className="summary-card"><span className="summary-label">SUBJECTS RELEASED</span><strong>{activePortalResults.length}</strong><small>{displayedStudent || "No linked student"}</small><span className="summary-mark mark-amber">▤</span></article><article className="summary-card"><span className="summary-label">SCHOOL SESSION</span><strong className="term-card-value">{portalTerm.split(" · ")[1] || "—"}</strong><small>{portalTerm.split(" · ")[0] || "No active term"}</small><span className="summary-mark mark-red">◷</span></article></section>
            <AttendanceWorkspace role="parent" />
            <AnnouncementsWorkspace role="parent" />
            <TermReportCard studentName={activePortalStudent?.fullName ?? ""} studentCode={activePortalStudent?.studentCode ?? ""} className={activePortalStudent?.class.name ?? ""} term={portalTerm} results={activePortalResults} cumulativeResults={activePortalCumulativeResults} studentId={activePortalStudent?.id ?? ""} average={publishedAverage} />
            <StudentDetailsPanel key={selectedChild} studentName={displayedStudent} />
          </>}
          <p className="data-note"><span>i</span> Academic results shown here are published school records. Profile presentation details and uploaded photos may be sample content.</p>
        </div>
      </section>
      {notice && <div className="toast" role="status">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
      {profileOpen && <div className="profile-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><aside className="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-drawer-title">
        <div className="profile-drawer-top"><span className="profile-drawer-kicker"><SchoolLogo size={24} className="drawer-crest"/> ALBAYYAN INTERNATIONAL SCHOOL · {roleName.toUpperCase()} PROFILE</span><button className="profile-drawer-close" type="button" aria-label="Close profile" onClick={() => setProfileOpen(false)}>×</button></div>
        {role === "teacher" && <>
          <div className="profile-identity"><span className="drawer-avatar">PN</span><div><h2 id="profile-drawer-title">Peter Nwosu</h2><p>Mathematics teacher · Staff ID T-0086</p><span className="profile-verified"><i/> Active staff</span></div></div>
          <div className="profile-section"><h3>Teaching assignment</h3><dl className="drawer-details"><div><dt>Primary subject</dt><dd>Mathematics</dd></div><div><dt>Assigned class</dt><dd>JSS 2A</dd></div><div><dt>Academic session</dt><dd>2025 / 2026</dd></div><div><dt>Employment start</dt><dd>08 September 2018</dd></div></dl></div>
          <div className="profile-section"><h3>Contact details</h3><dl className="drawer-details"><div><dt>Email address</dt><dd>peter.nwosu@albayyan.edu</dd></div><div><dt>Phone number</dt><dd>+234 803 555 0186</dd></div><div><dt>Department</dt><dd>Junior Secondary</dd></div></dl></div>
        </>}
        {role === "student" && <>
          <div className="profile-identity"><PassportAvatar studentName="Amara Okafor" photo={passportPhotos["Amara Okafor"]} onPhotoChange={(photo) => setStudentPassport("Amara Okafor", photo)} /><div><h2 id="profile-drawer-title">Amara Okafor</h2><p>Student ID ST-2041 · JSS 2A</p><span className="profile-verified"><i/> Enrolled · 2025 / 2026</span></div></div>
          <div className="profile-section"><h3>Student information</h3><dl className="drawer-details"><div><dt>Date of birth</dt><dd>14 March 2012</dd></div><div><dt>Gender</dt><dd>Female</dd></div><div><dt>Admission date</dt><dd>05 September 2022</dd></div><div><dt>Home address</dt><dd>Ikeja, Lagos</dd></div></dl></div>
          <div className="profile-section"><h3>Academic overview</h3><div className="profile-stat-row"><div><strong>83%</strong><span>Term average</span></div><div><strong>4th</strong><span>Class position</span></div><div><strong>97%</strong><span>Attendance</span></div></div></div>
          <div className="profile-section"><h3>Parent / guardian</h3><dl className="drawer-details"><div><dt>Full name</dt><dd>Oluchi Okafor</dd></div><div><dt>Relationship</dt><dd>Mother</dd></div><div><dt>Phone</dt><dd>+234 802 555 0142</dd></div><div><dt>Email</dt><dd>oluchi.okafor@example.com</dd></div></dl></div>
        </>}
        {role === "parent" && <>
          <div className="profile-identity"><span className="drawer-avatar parent-avatar">OO</span><div><h2 id="profile-drawer-title">Oluchi Okafor</h2><p>Parent account · Family ID F-1048</p><span className="profile-verified"><i/> Account active</span></div></div>
          <div className="profile-section"><h3>Contact details</h3><dl className="drawer-details"><div><dt>Phone number</dt><dd>+234 802 555 0142</dd></div><div><dt>Email address</dt><dd>oluchi.okafor@example.com</dd></div><div><dt>Home address</dt><dd>Ikeja, Lagos</dd></div><div><dt>Preferred contact</dt><dd>SMS and email</dd></div></dl></div>
          <div className="profile-section"><div className="profile-section-heading"><h3>Linked students</h3><span>2 children</span></div><div className="linked-student-list">{Object.entries(studentRecords).map(([name, record]) => <article className="linked-student-card" key={name}><PassportAvatar studentName={name} photo={passportPhotos[name]} onPhotoChange={(photo) => setStudentPassport(name, photo)} /><div><strong>{name}</strong><small>{record.studentId} · {record.className}</small><small>{childReports[name].average}% term average</small></div><button type="button" aria-label={`View ${name} results`} onClick={() => { setSelectedChild(name); setProfileOpen(false); }}>View <span>→</span></button></article>)}</div></div>
        </>}
        <footer className="profile-drawer-footer"><span>Profile details are demonstration data.</span><button className="profile-edit-button" type="button" onClick={() => setNotice("Profile editing will be available when accounts are connected")}>Edit profile</button></footer>
      </aside></div>}
    </main>
  );
}

type StudentRecord = {
  studentId: string;
  name: string;
  className: string;
  dateOfBirth: string;
  gender: string;
  admissionDate: string;
  guardian: string;
  address: string;
  attendance: { present: number; absent: number; late: number; total: number };
  monthlyAttendance: { month: string; present: number; absent: number; total: number }[];
  fees: { term: string; amount: number; paid: number; dueDate: string; session: string }[];
};

const studentRecords: Record<string, StudentRecord> = {
  "Amara Okafor": {
    studentId: "ST-2041", name: "Amara Okafor", className: "JSS 2A", dateOfBirth: "14 March 2012", gender: "Female", admissionDate: "05 September 2022", guardian: "Oluchi Okafor", address: "Ikeja, Lagos", attendance: { present: 58, absent: 2, late: 3, total: 60 },
    monthlyAttendance: [{ month: "September", present: 20, absent: 1, total: 21 }, { month: "October", present: 19, absent: 1, total: 20 }, { month: "November", present: 19, absent: 0, total: 19 }],
    fees: [{ term: "First term", amount: 65000, paid: 50000, dueDate: "20 Sep 2025", session: "2025 / 2026" }, { term: "Second term", amount: 70000, paid: 40000, dueDate: "16 Jan 2026", session: "2025 / 2026" }, { term: "Third term", amount: 68000, paid: 0, dueDate: "20 Apr 2026", session: "2025 / 2026" }],
  },
  "David Okafor": {
    studentId: "ST-2258", name: "David Okafor", className: "Primary 5B", dateOfBirth: "02 July 2015", gender: "Male", admissionDate: "08 September 2021", guardian: "Oluchi Okafor", address: "Ikeja, Lagos", attendance: { present: 56, absent: 4, late: 2, total: 60 },
    monthlyAttendance: [{ month: "September", present: 19, absent: 2, total: 21 }, { month: "October", present: 19, absent: 1, total: 20 }, { month: "November", present: 18, absent: 1, total: 19 }],
    fees: [{ term: "First term", amount: 58000, paid: 58000, dueDate: "20 Sep 2025", session: "2025 / 2026" }, { term: "Second term", amount: 60000, paid: 35000, dueDate: "16 Jan 2026", session: "2025 / 2026" }, { term: "Third term", amount: 60000, paid: 0, dueDate: "20 Apr 2026", session: "2025 / 2026" }],
  },
};

const recordSections = ["Profile", "Attendance", "Fees & debts", "Timetable", "Textbooks"] as const;
type RecordSection = typeof recordSections[number];
const schoolTimetable = [
  { day: "Monday", periods: ["Mathematics", "English", "Basic Science", "Civic Education"] },
  { day: "Tuesday", periods: ["Social Studies", "Mathematics", "ICT", "English"] },
  { day: "Wednesday", periods: ["Basic Science", "French", "Mathematics", "Creative Arts"] },
  { day: "Thursday", periods: ["English", "Civic Education", "Social Studies", "Physical Education"] },
  { day: "Friday", periods: ["Mathematics", "Basic Science", "Library", "Club activities"] },
];
const schoolBooks = [
  { subject: "Mathematics", title: "New General Mathematics 2", edition: "Second edition", status: "Issued" },
  { subject: "English Language", title: "Essential English 2", edition: "Revised edition", status: "Issued" },
  { subject: "Basic Science", title: "Basic Science for Junior Secondary 2", edition: "Third edition", status: "Issued" },
  { subject: "Social Studies", title: "Our Society: Social Studies 2", edition: "Second edition", status: "To collect" },
];

function money(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function StudentDetailsPanel({ studentName, initialSection = "Profile", lockedSection = false }: { studentName: string; initialSection?: RecordSection; lockedSection?: boolean }) {
  const [activeSection, setActiveSection] = useState<RecordSection>(initialSection);
  const record = studentRecords[studentName];
  const balance = record.fees.reduce((total, fee) => total + fee.amount - fee.paid, 0);
  const attendanceRate = Math.round((record.attendance.present / record.attendance.total) * 100);

  return (
    <section className="student-record-area">
      <div className="record-area-heading"><div><p className="eyebrow">STUDENT RECORD</p><h2>School information</h2></div><span className="session-chip">2025 / 2026 SESSION</span></div>
      {!lockedSection && <nav className="record-tabs" aria-label="Student record sections">{recordSections.map((section) => <button key={section} type="button" className={activeSection === section ? "selected" : ""} aria-current={activeSection === section ? "page" : undefined} onClick={() => setActiveSection(section)}>{section}</button>)}</nav>}
      {activeSection === "Profile" && <div className="profile-record-grid">
        <section className="record-panel profile-panel"><div className="record-panel-heading"><div><h3>Student profile</h3><p>Personal and enrollment details</p></div><span className="class-tag">{record.className}</span></div><div className="profile-content"><dl className="profile-fields"><div><dt>Full name</dt><dd>{record.name}</dd></div><div><dt>Student ID</dt><dd>{record.studentId}</dd></div><div><dt>Date of birth</dt><dd>{record.dateOfBirth}</dd></div><div><dt>Gender</dt><dd>{record.gender}</dd></div><div><dt>Admission date</dt><dd>{record.admissionDate}</dd></div><div><dt>Parent / guardian</dt><dd>{record.guardian}</dd></div><div className="wide-field"><dt>Home address</dt><dd>{record.address}</dd></div></dl></div></section>
        <section className="record-panel attendance-brief"><div className="record-panel-heading"><div><h3>Attendance overview</h3><p>Current session to date</p></div><span className="attendance-rate">{attendanceRate}%</span></div><div className="attendance-meter"><span style={{ width: `${attendanceRate}%` }}/></div><div className="attendance-counts"><div><strong>{record.attendance.present}</strong><small>Present</small></div><div><strong>{record.attendance.absent}</strong><small>Absent</small></div><div><strong>{record.attendance.late}</strong><small>Late</small></div></div><button className="text-link" type="button" onClick={() => setActiveSection("Attendance")}>View attendance record →</button></section>
      </div>}
      {activeSection === "Attendance" && <section className="record-panel"><div className="record-panel-heading"><div><h3>Attendance record</h3><p>{record.name} · {record.className} · 2025 / 2026</p></div><span className="attendance-rate">{attendanceRate}% present</span></div><div className="attendance-counts attendance-counts-large"><div><strong>{record.attendance.present}</strong><small>Days present</small></div><div><strong>{record.attendance.absent}</strong><small>Absent</small></div><div><strong>{record.attendance.late}</strong><small>Late arrivals</small></div><div><strong>{record.attendance.total}</strong><small>School days</small></div></div><div className="table-scroll"><table className="results-table"><thead><tr><th>MONTH</th><th>SCHOOL DAYS</th><th>PRESENT</th><th>ABSENT</th><th>ATTENDANCE</th></tr></thead><tbody>{record.monthlyAttendance.map((month) => <tr key={month.month}><td><strong className="teacher-student-name">{month.month}</strong></td><td>{month.total}</td><td>{month.present}</td><td>{month.absent}</td><td>{Math.round((month.present / month.total) * 100)}%</td></tr>)}</tbody></table></div></section>}
      {activeSection === "Fees & debts" && <><section className="record-panel"><div className="record-panel-heading"><div><h3>Term fee schedule</h3><p>Fees and payments for each term</p></div><span className="debt-total">Outstanding {money(balance)}</span></div><div className="table-scroll"><table className="results-table"><thead><tr><th>TERM</th><th>SESSION</th><th>FEE</th><th>PAID</th><th>BALANCE</th><th>DUE DATE</th></tr></thead><tbody>{record.fees.map((fee) => <tr key={fee.term}><td><strong className="teacher-student-name">{fee.term}</strong></td><td>{fee.session}</td><td>{money(fee.amount)}</td><td>{money(fee.paid)}</td><td><strong className={fee.amount > fee.paid ? "debt-value" : "paid-value"}>{money(fee.amount - fee.paid)}</strong></td><td>{fee.dueDate}</td></tr>)}</tbody></table></div></section><section className="record-panel debt-ledger"><div className="record-panel-heading"><div><h3>Outstanding fee ledger</h3><p>Balances with term, session and payment due date</p></div></div><div className="table-scroll"><table className="results-table"><thead><tr><th>DUE DATE</th><th>DESCRIPTION</th><th>TERM</th><th>SESSION</th><th>AMOUNT DUE</th><th>STATUS</th></tr></thead><tbody>{record.fees.filter((fee) => fee.amount > fee.paid).map((fee) => <tr key={fee.term}><td>{fee.dueDate}</td><td>{fee.term} school fees</td><td>{fee.term}</td><td>{fee.session}</td><td><strong className="debt-value">{money(fee.amount - fee.paid)}</strong></td><td><span className="status status-returned"><i/>Outstanding</span></td></tr>)}</tbody></table></div></section></>}
      {activeSection === "Timetable" && <section className="record-panel"><div className="record-panel-heading"><div><h3>Weekly timetable</h3><p>{record.className} · Monday to Friday</p></div><span className="session-chip">TERM 2</span></div><div className="table-scroll"><table className="results-table timetable-table"><thead><tr><th>DAY</th><th>08:00 – 08:40</th><th>08:45 – 09:25</th><th>09:45 – 10:25</th><th>10:30 – 11:10</th></tr></thead><tbody>{schoolTimetable.map((day) => (
        <tr key={day.day}>
          <td><strong className="teacher-student-name">{day.day}</strong></td>
          {day.periods.map((subject, index) => (
            <td key={`${day.day}-${index}`}><span className="timetable-subject">{subject}</span></td>
          ))}
        </tr>
      ))}</tbody></table></div></section>}
      {activeSection === "Textbooks" && <section className="record-panel"><div className="record-panel-heading"><div><h3>Textbooks & learning materials</h3><p>Required and issued books for {record.className}</p></div></div><div className="table-scroll"><table className="results-table"><thead><tr><th>SUBJECT</th><th>TEXTBOOK</th><th>EDITION</th><th>ISSUE STATUS</th></tr></thead><tbody>{schoolBooks.map((book) => <tr key={book.subject}><td><span className="class-tag">{book.subject}</span></td><td><strong className="teacher-student-name">{book.title}</strong></td><td>{book.edition}</td><td><span className={`status ${book.status === "Issued" ? "status-approved" : "status-under-review"}`}><i/>{book.status}</span></td></tr>)}</tbody></table></div></section>}
    </section>
  );
}