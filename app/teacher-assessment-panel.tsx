"use client";

import { useState } from "react";
import { gradeForPercentage } from "@/lib/grade";
import { calculateStudentCumulativeAverage, calculateSubjectCumulativeAverage, type SubjectTermScore } from "@/lib/subject-cumulative-average";

type SchoolClass = { id: string; name: string };
type RosterStudent = { id: string; name: string; studentId: string };
type AssessmentField = "ca1" | "ca2" | "ca3" | "exam" | "comments" | "behavioralRating" | "behavioralComment" | "psychomotorRating" | "psychomotorComment";
type AssessmentEntry = {
  id: string;
  studentId: string;
  subjectId: string;
  status: string;
  marks: string | number | null;
  maxMarks: string | number;
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  exam: number | null;
  comments: string | null;
  behavioralRating: number | null;
  behavioralComment: string | null;
  psychomotorRating: number | null;
  psychomotorComment: string | null;
  reviewNote?: string | null;
};

type TeacherAssessmentPanelProps = {
  students: RosterStudent[];
  classes: SchoolClass[];
  classId: string;
  subjects: Array<{ id: string; name: string }>;
  subjectId: string;
  termId: string;
  termResults: SubjectTermScore[];
  getEntry: (studentId: string) => AssessmentEntry | undefined;
  onClassChange: (classId: string) => void;
  onSubjectChange: (subjectId: string) => void;
  onUpdate: (studentId: string, field: AssessmentField, value: string | number | null) => void;
  onSave: (action: "draft" | "submit") => void;
  saving: boolean;
  notice: string;
  canCreateResults: boolean;
  termDataReady: boolean;
  loadingTermData: boolean;
};

type EntryScore = { total: number; max: number; percentage: number; complete: boolean };

function numeric(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreFor(entry?: AssessmentEntry): EntryScore | null {
  if (!entry) return null;
  const components = [entry.ca1, entry.ca2, entry.ca3, entry.exam].map(numeric);
  if (components.some((value) => value !== null)) {
    const total = components.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return { total, max: 100, percentage: total, complete: components.every((value) => value !== null) };
  }
  const total = numeric(entry.marks);
  const max = numeric(entry.maxMarks);
  return total === null || max === null || max <= 0
    ? null
    : { total, max, percentage: total / max * 100, complete: true };
}

function RatingSelect({ label, value, disabled, onChange }: { label: string; value: number | null; disabled: boolean; onChange: (value: number | null) => void }) {
  return <select className="assessment-rating" aria-label={label} value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
    <option value="">Select</option>
    <option value="1">1 · Needs support</option>
    <option value="2">2 · Developing</option>
    <option value="3">3 · Satisfactory</option>
    <option value="4">4 · Good</option>
    <option value="5">5 · Excellent</option>
  </select>;
}

export default function TeacherAssessmentPanel({ students, classes, classId, subjects, subjectId, termId, termResults, getEntry, onClassChange, onSubjectChange, onUpdate, onSave, saving, notice, canCreateResults, termDataReady, loadingTermData }: TeacherAssessmentPanelProps) {
  const [mode, setMode] = useState<"subject" | "behavior">("subject");
  const subjectName = subjects.find((subject) => subject.id === subjectId)?.name ?? "";
  const classScores = students.map((student) => scoreFor(getEntry(student.id))).filter((score): score is EntryScore => Boolean(score?.complete));
  const highestScore = classScores.length ? Math.max(...classScores.map((score) => score.total)) : null;
  const classAverage = classScores.length ? classScores.reduce((sum, score) => sum + score.percentage, 0) / classScores.length : null;

  function cumulativeAverage(studentId: string) {
    const entry = getEntry(studentId);
    if (!entry || !subjectId || !termId) {
      return calculateSubjectCumulativeAverage(termResults, studentId, subjectId);
    }

    const currentTermResults = termResults.filter((result) => !(
      result.studentId === studentId
      && result.subjectId === subjectId
      && result.termId === termId
    ));
    const score = scoreFor(entry);
    if (score?.complete) {
      currentTermResults.push({
        studentId,
        subjectId,
        termId,
        marks: score.total,
        maxMarks: score.max,
        ca1: entry.ca1,
        ca2: entry.ca2,
        ca3: entry.ca3,
        exam: entry.exam,
      });
    }
    return calculateSubjectCumulativeAverage(currentTermResults, studentId, subjectId);
  }

  function sessionAverage(studentId: string) {
    return calculateStudentCumulativeAverage(termResults, studentId);
  }

  const lockedFor = (entry?: AssessmentEntry) => Boolean(entry && !["DRAFT", "RETURNED"].includes(entry.status));
  const canSave = termDataReady && (canCreateResults || students.some((student) => ["DRAFT", "RETURNED"].includes(getEntry(student.id)?.status ?? "")));

  return <section className="results-section teacher-assessment-panel">
    <div className="section-heading teacher-assessment-heading">
      <div><h2>Enter class results</h2><p>{subjectName ? `${className(classes, classId)} · ${subjectName} · All enrolled students` : "Choose a class and assigned subject to enter results."}</p></div>
      <label className="teacher-class-picker"><span>CLASS</span><select value={classId} onChange={(event) => onClassChange(event.target.value)}><option value="">Select class</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
    </div>
    <div className="teacher-subject-list" aria-label="Assigned subjects">
      {subjects.map((subject) => <button className={subject.id === subjectId ? "active" : ""} type="button" key={subject.id} aria-pressed={subject.id === subjectId} onClick={() => onSubjectChange(subject.id)}>{subject.name}</button>)}
      {!subjects.length && <span className="assessment-help">No subjects are assigned to this class.</span>}
    </div>
    <div className="assessment-mode-switch" role="tablist" aria-label="Assessment type">
      <button type="button" role="tab" aria-selected={mode === "subject"} className={mode === "subject" ? "active" : ""} onClick={() => setMode("subject")}>Subject scores</button>
      <button type="button" role="tab" aria-selected={mode === "behavior"} className={mode === "behavior" ? "active" : ""} onClick={() => setMode("behavior")}>Behavior & psychomotor</button>
    </div>
    {mode === "subject" && <>
      <div className="assessment-summary" aria-label="Class score summary">
        <div><span>STUDENTS</span><strong>{students.length}</strong></div>
        <div><span>HIGHEST SCORE</span><strong>{highestScore === null ? "—" : `${highestScore.toFixed(1)} / 100`}</strong></div>
        <div><span>CLASS AVERAGE</span><strong>{classAverage === null ? "—" : `${classAverage.toFixed(1)}%`}</strong></div>
      </div>
      <div className="table-scroll"><table className="results-table teacher-score-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>1ST CA / 10</th><th>2ND CA / 10</th><th>3RD CA / 10</th><th>EXAM / 70</th><th>TOTAL / 100</th><th>GRADE</th><th>CUM. AVG</th><th>HIGHEST SCORE</th><th>SESSION AVG</th><th>STATUS</th><th>ADMIN NOTE</th></tr></thead><tbody>
        {students.map((student) => {
          const entry = getEntry(student.id);
          const locked = lockedFor(entry);
          const readOnly = locked || !termDataReady || (!entry && !canCreateResults);
          const scores = scoreFor(entry);
          const cumulative = cumulativeAverage(student.id);
          const sessional = sessionAverage(student.id);
          return <tr key={student.id}>
            <td><strong className="teacher-student-name">{student.name}</strong></td>
            <td>{student.studentId}</td>
            {(["ca1", "ca2", "ca3", "exam"] as const).map((field) => <td key={field}>{readOnly ? entry?.[field] ?? "—" : <input className="assessment-score-input" aria-label={`${field.toUpperCase()} score for ${student.name}`} type="number" min="0" max={field === "exam" ? 70 : 10} step="0.01" value={entry?.[field] ?? ""} disabled={!subjectId || !termDataReady} onChange={(event) => onUpdate(student.id, field, event.target.value === "" ? null : Number(event.target.value))} />}</td>)}
            <td><strong>{scores ? scores.total.toFixed(1) : "—"}</strong></td>
            <td>{scores?.complete ? <span className={`grade grade-${gradeForPercentage(scores.percentage).toLowerCase()}`}>{gradeForPercentage(scores.percentage)}</span> : "—"}</td>
            <td className="teacher-cumulative-average">{cumulative ? <><strong>{cumulative.average.toFixed(1)}</strong><small>{cumulative.completedTerms} {cumulative.completedTerms === 1 ? "term" : "terms"}</small></> : "—"}</td>
            <td>{highestScore === null ? "—" : `${highestScore.toFixed(1)} / 100`}</td>
            <td className="teacher-cumulative-average">{sessional ? <><strong>{sessional.average.toFixed(1)}</strong><small>{sessional.completedTerms} completed</small></> : "—"}</td>
            <td>{entry?.status.replaceAll("_", " ") ?? "Not entered"}</td>
            <td>{entry?.reviewNote || "—"}</td>
          </tr>;
        })}
        {!students.length && <tr><td className="empty-state" colSpan={13}>No students are enrolled in this class.</td></tr>}
      </tbody></table></div>
    </>}
    {mode === "behavior" && <div className="table-scroll"><table className="results-table teacher-behavior-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>BEHAVIOR RATING</th><th>BEHAVIOR COMMENT</th><th>PSYCHOMOTOR RATING</th><th>PSYCHOMOTOR COMMENT</th><th>STATUS</th><th>ADMIN NOTE</th></tr></thead><tbody>
      {students.map((student) => {
        const entry = getEntry(student.id);
          const locked = lockedFor(entry) || !termDataReady || (!entry && !canCreateResults);
        return <tr key={student.id}>
          <td><strong className="teacher-student-name">{student.name}</strong></td>
          <td>{student.studentId}</td>
          <td>{locked ? entry?.behavioralRating ?? "—" : <RatingSelect label={`Behavior rating for ${student.name}`} value={entry?.behavioralRating ?? null} disabled={!subjectId} onChange={(value) => onUpdate(student.id, "behavioralRating", value)} />}</td>
          <td>{locked ? entry?.behavioralComment || "—" : <input className="assessment-comment-input" aria-label={`Behavior comment for ${student.name}`} value={entry?.behavioralComment ?? ""} disabled={!subjectId} placeholder="Participation, conduct, responsibility..." onChange={(event) => onUpdate(student.id, "behavioralComment", event.target.value)} />}</td>
          <td>{locked ? entry?.psychomotorRating ?? "—" : <RatingSelect label={`Psychomotor rating for ${student.name}`} value={entry?.psychomotorRating ?? null} disabled={!subjectId} onChange={(value) => onUpdate(student.id, "psychomotorRating", value)} />}</td>
          <td>{locked ? entry?.psychomotorComment || "—" : <input className="assessment-comment-input" aria-label={`Psychomotor comment for ${student.name}`} value={entry?.psychomotorComment ?? ""} disabled={!subjectId} placeholder="Coordination, handwriting, practical skills..." onChange={(event) => onUpdate(student.id, "psychomotorComment", event.target.value)} />}</td>
          <td>{entry?.status.replaceAll("_", " ") ?? "Not entered"}</td>
          <td>{entry?.reviewNote || "—"}</td>
        </tr>;
      })}
      {!students.length && <tr><td className="empty-state" colSpan={8}>No students are enrolled in this class.</td></tr>}
    </tbody></table></div>}
    <footer className="table-footer teacher-result-actions"><span role="status">{loadingTermData ? "Loading results for the selected term..." : !termDataReady ? notice || "Unable to load results for this term. Select the term again to retry." : notice || (canCreateResults ? "Each CA is out of 10; the exam is out of 70. Total is out of 100." : "Historical terms are read-only except drafts or returned results already saved for that term.")}</span><div className="row-actions"><button className="cancel-button" type="button" onClick={() => onSave("draft")} disabled={saving || !termDataReady || !subjectId || !canSave}>{saving ? "Saving..." : "Save draft"}</button><button className="primary-button" type="button" onClick={() => onSave("submit")} disabled={saving || !termDataReady || !subjectId || !canSave}>{saving ? "Saving..." : "Submit for review"}</button></div></footer>
  </section>;
}

function className(classes: SchoolClass[], classId: string) {
  return classes.find((schoolClass) => schoolClass.id === classId)?.name ?? "Select a class";
}
