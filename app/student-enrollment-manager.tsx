"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type ClassChoice = { id: string; name: string; level: string | null; _count: { students: number } };
type YearChoice = { id: string; name: string; isCurrent: boolean; startsAt: string; endsAt: string };
type Enrollment = { id: string; startedAt: string; endedAt: string | null; class: { id: string; name: string; level: string | null }; academicYear: { name: string } };

export default function StudentEnrollmentManager({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [classes, setClasses] = useState<ClassChoice[]>([]);
  const [years, setYears] = useState<YearChoice[]>([]);
  const [history, setHistory] = useState<Enrollment[]>([]);
  const [classId, setClassId] = useState("");
  const [yearId, setYearId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [academicsResponse, studentResponse] = await Promise.all([
        fetch("/api/academics"),
        fetch(`/api/students/${encodeURIComponent(studentId)}`),
      ]);
      const [academics, profile] = await Promise.all([academicsResponse.json(), studentResponse.json()]);
      if (!academicsResponse.ok) throw new Error(academics.error ?? "Unable to load academic setup");
      if (!studentResponse.ok) throw new Error(profile.error ?? "Unable to load enrollment history");
      setClasses(academics.classes ?? []);
      setYears(academics.academicYears ?? []);
      setHistory(profile.student.enrollmentHistory ?? []);
      setYearId((current) => current || academics.academicYears.find((year: YearChoice) => year.isCurrent)?.id || "");
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load enrollment history");
    }
  }, [studentId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function promote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/students/${encodeURIComponent(studentId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, academicYearId: yearId, effectiveDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to promote student");
      setNotice(`${studentName} moved to ${data.student.class.name} for ${data.academicYear}.`);
      setClassId("");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to promote student");
    } finally {
      setSaving(false);
    }
  }

  return <section className="student-enrollment-manager">
    <div className="section-heading"><div><h3>Enrollment & promotion history</h3><p>Promote this student while preserving prior class records.</p></div></div>
    <form className="student-promotion-form" onSubmit={promote}>
      <label>New class<select value={classId} onChange={(event) => setClassId(event.target.value)} required><option value="">Select class</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}{schoolClass.level ? ` · ${schoolClass.level}` : ""}</option>)}</select></label>
      <label>Academic year<select value={yearId} onChange={(event) => setYearId(event.target.value)} required><option value="">Select academic year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Current" : ""}</option>)}</select></label>
      <label>Effective date<input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} required /></label>
      <button className="primary-button" type="submit" disabled={saving || !classes.length || !years.length}>{saving ? "Promoting..." : "Promote student"}</button>
    </form>
    {notice && <p className="setup-notice" role="status">{notice}</p>}
    <div className="setup-existing-list">{history.map((enrollment) => <div key={enrollment.id}><strong>{enrollment.class.name} · {enrollment.academicYear.name}{!enrollment.endedAt ? " · Current" : ""}</strong><span>{new Date(enrollment.startedAt).toLocaleDateString()} – {enrollment.endedAt ? new Date(enrollment.endedAt).toLocaleDateString() : "Present"}</span></div>)}{!history.length && <small>No promotion history has been recorded yet.</small>}</div>
  </section>;
}
