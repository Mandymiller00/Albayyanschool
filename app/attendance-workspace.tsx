"use client";

import { useEffect, useState } from "react";

type AttendanceRole = "admin" | "teacher" | "student" | "parent";
type SchoolClass = { id: string; name: string };
type AttendanceStudent = {
  id: string;
  fullName: string;
  studentCode: string;
  classId: string;
  class: SchoolClass;
};
type AttendanceRecord = {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note: string | null;
  student: { id: string; fullName: string; studentCode: string; classId: string };
};

const attendanceOptions = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
] as const;

function todayValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function statusLabel(status: AttendanceRecord["status"]) {
  return status[0] + status.slice(1).toLowerCase();
}

export default function AttendanceWorkspace({ role }: { role: AttendanceRole }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayValue);
  const [termLabel, setTermLabel] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canRecord = role === "admin" || role === "teacher";

  useEffect(() => {
    let active = true;
    async function loadAttendance() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ date });
        if (classId) params.set("classId", classId);
        const response = await fetch(`/api/attendance?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load attendance");
        if (!active) return;
        setClasses(data.classes);
        setStudents(data.students);
        setRecords(data.records);
        setTermLabel(data.term ? `${data.term.name} · ${data.term.academicYear}` : "No active term");
        const nextMarks: Record<string, string> = {};
        for (const record of data.records as AttendanceRecord[]) {
          if (record.date.slice(0, 10) === date) nextMarks[record.student.id] = record.status;
        }
        setMarks(nextMarks);
        setNotice("");
        if (!classId && canRecord && data.classes[0]?.id) setClassId(data.classes[0].id);
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Unable to load attendance");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAttendance();
    return () => { active = false; };
  }, [classId, date, canRecord]);

  async function saveAttendance() {
    if (!classId || !students.length) return;
    const entries = students.map((student) => ({ studentId: student.id, status: marks[student.id] }));
    if (entries.some((entry) => !entry.status)) {
      setNotice("Choose an attendance status for every student before saving");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, date, entries }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save attendance");
      setNotice(`Attendance saved for ${data.count} students`);
      const refresh = await fetch(`/api/attendance?date=${date}&classId=${classId}`);
      const refreshedData = await refresh.json();
      if (refresh.ok) setRecords(refreshedData.records);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save attendance");
    } finally {
      setSaving(false);
    }
  }

  const selectedStudents = classId ? students.filter((student) => student.classId === classId) : students;
  const historyByStudent = new Map<string, AttendanceRecord[]>();
  for (const record of records) {
    const entries = historyByStudent.get(record.student.id) ?? [];
    entries.push(record);
    historyByStudent.set(record.student.id, entries);
  }
  const summary = records.reduce((counts, record) => {
    counts[record.status] += 1;
    return counts;
  }, { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });

  return (
    <section className="results-section attendance-workspace">
      <div className="section-heading">
        <div><h2>{canRecord ? "Attendance register" : "Attendance history"}</h2><p>{canRecord ? "Record daily attendance for an assigned class." : "Attendance recorded for the active academic term."}</p></div>
        <span className="session-chip">{termLabel || "Loading term"}</span>
      </div>
      <div className="attendance-controls">
        {canRecord && <label>Class<select value={classId} onChange={(event) => setClassId(event.target.value)} disabled={!classes.length}><option value="">Select a class</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>}
        <label>{canRecord ? "Attendance date" : "History through"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {canRecord && <button className="primary-button" type="button" onClick={() => void saveAttendance()} disabled={loading || saving || !selectedStudents.length}>{saving ? "Saving..." : "Save attendance"}</button>}
      </div>
      {!canRecord && <div className="attendance-summary" aria-label="Attendance summary">
        <div><strong>{records.length}</strong><span>Records</span></div>
        <div><strong>{summary.PRESENT}</strong><span>Present</span></div>
        <div><strong>{summary.ABSENT}</strong><span>Absent</span></div>
        <div><strong>{summary.LATE}</strong><span>Late</span></div>
      </div>}
      {canRecord ? (
        <div className="table-scroll"><table className="results-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>CLASS</th><th>STATUS</th></tr></thead><tbody>
          {selectedStudents.map((student) => (
            <tr key={student.id}>
              <td><strong className="teacher-student-name">{student.fullName}</strong></td>
              <td>{student.studentCode}</td>
              <td><span className="class-tag">{student.class.name}</span></td>
              <td><label className="sr-only" htmlFor={`attendance-${student.id}`}>Attendance status for {student.fullName}</label><select id={`attendance-${student.id}`} className="attendance-status-select" value={marks[student.id] ?? ""} onChange={(event) => setMarks((current) => ({ ...current, [student.id]: event.target.value }))}><option value="">Select status</option>{attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
            </tr>
          ))}
          {!loading && selectedStudents.length === 0 && <tr><td className="empty-state" colSpan={4}>{classes.length ? "No students are currently enrolled in this class." : "No classes are assigned to this account."}</td></tr>}
        </tbody></table></div>
      ) : (
        <div className="table-scroll"><table className="results-table"><thead><tr><th>DATE</th><th>STUDENT</th><th>CLASS</th><th>STATUS</th><th>NOTE</th></tr></thead><tbody>
          {records.map((record) => <tr key={record.id}><td>{record.date.slice(0, 10)}</td><td><strong className="teacher-student-name">{record.student.fullName}</strong><small className="subcell-note">{record.student.studentCode}</small></td><td><span className="class-tag">{students.find((student) => student.id === record.student.id)?.class.name ?? "—"}</span></td><td><span className={`status status-${record.status.toLowerCase()}`}><i />{statusLabel(record.status)}</span></td><td>{record.note || "—"}</td></tr>)}
          {!loading && records.length === 0 && <tr><td className="empty-state" colSpan={5}>No attendance records are available for this term and date.</td></tr>}
        </tbody></table></div>
      )}
      {notice && <p className="attendance-notice" role="status">{notice}</p>}
      {loading && <p className="attendance-notice" role="status">Loading attendance records...</p>}
    </section>
  );
}