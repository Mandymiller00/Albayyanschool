"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type ClassSubject = { subject: Subject };
type SchoolClass = { id: string; name: string; level: string | null; _count: { students: number }; classSubjects: ClassSubject[] };
type Subject = { id: string; name: string };
type Teacher = {
  id: string;
  fullName: string;
  teacherCode: string;
  email: string | null;
  user: { email: string } | null;
  subject: Subject;
  assignments: Array<{ class: { id: string; name: string }; subject: Subject }>;
};
type Assignment = {
  id: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  class: SchoolClass;
  subject: Subject;
  teacher: { fullName: string; teacherCode: string };
};
type Term = { id: string; name: string; startsAt: string; endsAt: string; resumptionDate: string | null; isCurrent: boolean };
type AcademicYear = { id: string; name: string; startsAt: string; endsAt: string; isCurrent: boolean; terms: Term[] };
type TimetableSlot = { id: string; day: string; startsAt: string; endsAt: string; room: string | null; class: { id: string; name: string }; subject: Subject; teacher: { id: string; fullName: string } | null };

type SetupData = {
  classes: SchoolClass[];
  subjects: Subject[];
  teachers: Teacher[];
  assignments: Assignment[];
  academicYears: AcademicYear[];
  timetableSlots: TimetableSlot[];
};

const emptySetup: SetupData = { classes: [], subjects: [], teachers: [], assignments: [], academicYears: [], timetableSlots: [] };

export default function AcademicSetup({ focus = "all" }: { focus?: "all" | "teachers" | "classes" | "settings" }) {
  const [data, setData] = useState<SetupData>(emptySetup);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingSubjectId, setRemovingSubjectId] = useState<string | null>(null);
  const [selectedYearId, setSelectedYearId] = useState("");

  const load = useCallback(async (successNotice?: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/academics");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load academic setup");
      setData(result);
      const activeYear = result.academicYears.find((year: AcademicYear) => year.isCurrent);
      const activeTerm = activeYear?.terms.find((term: Term) => term.isCurrent);
      window.dispatchEvent(new CustomEvent("active-academic-period-changed", {
        detail: {
          academicYear: activeYear?.name ?? null,
          termName: activeTerm ? `${activeTerm.name[0]}${activeTerm.name.slice(1).toLowerCase()} Term` : null,
        },
      }));
      setSelectedYearId((current) => result.academicYears.some((year: AcademicYear) => year.id === current)
        ? current
        : result.academicYears.find((year: AcademicYear) => year.isCurrent)?.id ?? result.academicYears[0]?.id ?? "");
      setNotice(successNotice ?? "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load academic setup");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload: Record<string, FormDataEntryValue | boolean> = Object.fromEntries(form.entries());
    if (form.has("isCurrent")) payload.isCurrent = form.get("isCurrent") === "on";
    setSaving(true);
    try {
      const response = await fetch("/api/academics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save academic setup");
      formElement.reset();
      if (result.academicYear) setSelectedYearId(result.academicYear.id);
      setNotice(payload.action === "create_teacher" ? "Teacher account created. Share the initial password securely." : payload.action === "create_timetable_slot" ? "Timetable slot saved" : "Academic setup saved");
      await load();
      if (payload.action === "create_academic_year" && payload.isCurrent) window.dispatchEvent(new Event("active-academic-period-changed"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save academic setup");
    } finally {
      setSaving(false);
    }
  }

  async function removeClassSubject(classId: string, subjectId: string) {
    if (!window.confirm("Remove this subject from the selected class?")) return;
    setRemovingSubjectId(subjectId);
    try {
      const response = await fetch("/api/academics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_class_subject", classId, subjectId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to remove subject");
      setNotice("Subject removed from the class");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to remove subject");
    } finally {
      setRemovingSubjectId(null);
    }
  }

  async function setAcademicSession(academicYearId: string) {
    try {
      const response = await fetch("/api/academics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_active_session", academicYearId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update active session");
      setSelectedYearId(academicYearId);
      setNotice("Active academic session updated");
      await load();
      window.dispatchEvent(new Event("active-academic-period-changed"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update active session");
    }
  }

  async function setAcademicTerm(termId: string) {
    try {
      const response = await fetch("/api/academics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_active_term", termId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update current term");
      setSelectedYearId(result.term.academicYear.id);
      await load("Current term updated for teachers and students");
      window.dispatchEvent(new Event("active-academic-period-changed"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update current term");
    }
  }

  const selectedYear = data.academicYears.find((year) => year.id === selectedYearId);
  const heading = focus === "teachers" ? "Teacher accounts" : focus === "classes" ? "Class subjects" : focus === "settings" ? "School settings" : "Academic setup";
  const description = focus === "teachers"
    ? "Create teacher accounts and assign every subject linked to the selected class."
    : focus === "classes"
      ? "Add subjects to each permanent class. Subjects are available automatically to teachers assigned to that class."
      : focus === "settings"
        ? "Configure each academic session and its three required terms."
        : "Configure sessions, classes, subjects, teacher accounts and class assignments.";

  return (
    <section className="academic-setup-section" id="settings">
      <div className="section-heading academic-setup-heading">
        <div><p className="eyebrow">SCHOOL CONFIGURATION</p><h2>{heading}</h2><p>{description}</p></div>
        <button className="export-button" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh academic setup">↻ <span>Refresh</span></button>
      </div>
      <div className="academic-setup-grid">
        {(focus === "all" || focus === "settings") && <section className="results-section setup-panel">
          <div className="section-heading"><div><h3>Academic session</h3><p>Every session must contain exactly three dated terms: First, Second and Third.</p></div></div>
          <form className="dashboard-form setup-form" onSubmit={submit}>
            <input type="hidden" name="action" value="create_academic_year" />
            <label>Session name<input name="name" placeholder="2026 / 2027" maxLength={40} required /></label>
            <div className="form-pair"><label>Session starts<input name="startsAt" type="date" required /></label><label>Session ends<input name="endsAt" type="date" required /></label></div>
            <div className="setup-term-grid">
              <div><strong>First term</strong><div className="form-pair"><label>Starts<input name="firstTermStartsAt" type="date" required /></label><label>Ends<input name="firstTermEndsAt" type="date" required /></label></div><label>Resumption date<input name="firstTermResumptionDate" type="date" required /></label></div>
              <div><strong>Second term</strong><div className="form-pair"><label>Starts<input name="secondTermStartsAt" type="date" required /></label><label>Ends<input name="secondTermEndsAt" type="date" required /></label></div><label>Resumption date<input name="secondTermResumptionDate" type="date" required /></label></div>
              <div><strong>Third term</strong><div className="form-pair"><label>Starts<input name="thirdTermStartsAt" type="date" required /></label><label>Ends<input name="thirdTermEndsAt" type="date" required /></label></div><label>Resumption date<input name="thirdTermResumptionDate" type="date" required /></label></div>
            </div>
            <label className="setup-checkbox"><input name="isCurrent" type="checkbox" /> Set as current session</label>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Create session with 3 terms"}</button>
          </form>
          <div className="setup-existing-list">
            {data.academicYears.map((year) => (
              <div key={year.id} className={`term-card ${year.isCurrent ? "is-current" : ""}`}>
                <div className="term-card-head"><strong>{year.name}</strong><button className="row-action" type="button" onClick={() => void setAcademicSession(year.id)}>{year.isCurrent ? "Active session" : "Set active"}</button></div>
                <small>{new Date(year.startsAt).toLocaleDateString()} – {new Date(year.endsAt).toLocaleDateString()} {year.isCurrent ? "· Active" : ""}</small>
              </div>
            ))}
            {!loading && data.academicYears.length === 0 && <small>No academic sessions created yet.</small>}
          </div>
          <div className="setup-existing-list">{selectedYear?.terms.map((term) => <div key={term.id} className={`term-card ${term.isCurrent ? "is-current" : ""}`}><div className="term-card-head"><strong>{term.name[0] + term.name.slice(1).toLowerCase()} term</strong><button className="row-action" type="button" onClick={() => void setAcademicTerm(term.id)}>{term.isCurrent ? "Current term" : "Set current term"}</button></div><span>{new Date(term.startsAt).toLocaleDateString()} – {new Date(term.endsAt).toLocaleDateString()}</span><small>Resumption: {term.resumptionDate ? new Date(term.resumptionDate).toLocaleDateString() : "Not set"}</small></div>)}{!loading && selectedYear && selectedYear.terms.length === 0 && <small>No terms configured for this session.</small>}</div>
        </section>}

        {(focus === "all" || focus === "classes") && <section className="results-section setup-panel">
          <div className="section-heading"><div><h3>Subjects by class</h3><p>Add subjects to a permanent class. Each subject becomes available to teachers assigned to that class.</p></div></div>
          <form className="dashboard-form setup-form setup-secondary-form" onSubmit={submit}>
            <input type="hidden" name="action" value="create_class_subject" />
            <label>Class<select name="classId" defaultValue="" required><option value="">Select class</option>{data.classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
            <label>Subject name<input name="name" placeholder="Mathematics" maxLength={100} required /></label>
            <button className="cancel-button" type="submit" disabled={saving || !data.classes.length}>{saving ? "Saving..." : "Add subject to class"}</button>
          </form>
          <div className="setup-existing-list">
            {data.classes.map((schoolClass) => <div key={schoolClass.id} className="class-subject-list-item"><strong>{schoolClass.name}</strong><div className="class-subject-list">{schoolClass.classSubjects.map((item) => <span key={item.subject.id}>{item.subject.name}<button type="button" className="subject-remove-button" onClick={() => void removeClassSubject(schoolClass.id, item.subject.id)} disabled={removingSubjectId === item.subject.id} aria-label={`Remove ${item.subject.name} from ${schoolClass.name}`}>{removingSubjectId === item.subject.id ? "Removing..." : "Remove"}</button></span>)}</div>{schoolClass.classSubjects.length === 0 && <small>No subjects added</small>}</div>)}
          </div>
        </section>}

        {(focus === "all" || focus === "teachers") && <section className="results-section setup-panel">
          <div className="section-heading"><div><h3>Teacher accounts</h3><p>Create a teacher login and automatically assign every subject in the selected class.</p></div></div>
          <form className="dashboard-form setup-form" onSubmit={submit}>
            <input type="hidden" name="action" value="create_teacher" />
            <div className="form-pair"><label>Full name<input name="fullName" placeholder="Teacher name" required /></label><label>Staff ID<input name="teacherCode" placeholder="T-0102" required /></label></div>
            <label>School email<input name="email" type="email" placeholder="name@albayyan.edu" required /></label>
            <label>Initial password<input name="initialPassword" type="password" minLength={12} autoComplete="new-password" required /><span className="setup-help">At least 12 characters. Share it securely with the teacher.</span></label>
            <div className="form-pair"><label>Class<select name="classId" defaultValue="" required><option value="">Select class</option>{data.classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label><label>Phone<input name="phone" type="tel" placeholder="Optional" /></label></div>
            <button className="primary-button" type="submit" disabled={saving || !data.classes.length || !data.subjects.length}>{saving ? "Creating..." : "Create teacher account"}</button>
          </form>
          <div className="setup-existing-list">
            {data.teachers.map((teacher) => <div key={teacher.id}><strong>{teacher.fullName} · {teacher.teacherCode}</strong><span>{teacher.assignments.length ? teacher.assignments.map((assignment) => `${assignment.class.name} / ${assignment.subject.name}`).join("; ") : "No class or subject assignments"}</span></div>)}
            {!data.teachers.length && <small>No teacher accounts configured.</small>}
          </div>
          <div className="setup-existing-list"><div><strong>{data.assignments.length} class assignments</strong><span>{data.assignments.map((assignment) => `${assignment.teacher.fullName}: ${assignment.class.name} / ${assignment.subject.name}`).join("; ") || "None configured"}</span></div></div>
        </section>}

        {(focus === "all") && <section className="results-section setup-panel">
          <div className="section-heading"><div><h3>Class timetable</h3><p>Schedule the subject assignments students will see in their portal.</p></div></div>
          <form className="dashboard-form setup-form" onSubmit={submit}>
            <input type="hidden" name="action" value="create_timetable_slot" />
            <label>Class / subject / teacher<select name="assignmentId" defaultValue="" required><option value="">Select assignment</option>{data.assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.class.name} · {assignment.subject.name} · {assignment.teacher.fullName}</option>)}</select></label>
            <div className="form-pair"><label>Day<select name="day" defaultValue="MONDAY" required><option value="MONDAY">Monday</option><option value="TUESDAY">Tuesday</option><option value="WEDNESDAY">Wednesday</option><option value="THURSDAY">Thursday</option><option value="FRIDAY">Friday</option></select></label><label>Room<input name="room" placeholder="Optional" maxLength={40} /></label></div>
            <div className="form-pair"><label>Starts<input name="startsAt" type="time" required /></label><label>Ends<input name="endsAt" type="time" required /></label></div>
            <button className="primary-button" type="submit" disabled={saving || !data.assignments.length}>{saving ? "Saving..." : "Add timetable slot"}</button>
            {!data.assignments.length && <p className="form-help">Create teacher class and subject assignments before scheduling lessons.</p>}
          </form>
          <div className="setup-existing-list">{data.timetableSlots.map((slot) => <div key={slot.id}><strong>{slot.class.name} · {slot.day[0] + slot.day.slice(1).toLowerCase()} · {slot.startsAt}–{slot.endsAt}</strong><span>{slot.subject.name} · {slot.teacher?.fullName ?? "Teacher not assigned"}{slot.room ? ` · Room ${slot.room}` : ""}</span></div>)}{!loading && data.timetableSlots.length === 0 && <small>No timetable slots configured.</small>}</div>
        </section>}
      </div>
      {notice && <p className="setup-notice" role="status">{notice}</p>}
    </section>
  );
}
