"use client";

import { gradeForPercentage } from "@/lib/grade";
import { calculateSubjectCumulativeAverage, type SubjectTermScore } from "@/lib/subject-cumulative-average";
import { SchoolLogo } from "./school-logo";

type ReportResult = {
  id: string;
  studentId: string;
  subject: string;
  subjectId: string;
  termName: string;
  score: number;
  outOf: number;
  grade: string;
  ca1?: number | null;
  ca2?: number | null;
  ca3?: number | null;
  exam?: number | null;
  teacherComment: string;
  behavioralRating?: number | null;
  behavioralComment?: string;
  psychomotorRating?: number | null;
  psychomotorComment?: string;
};

type TermReportCardProps = {
  studentName: string;
  studentCode: string;
  className: string;
  term: string;
  results: ReportResult[];
  cumulativeResults: SubjectTermScore[];
  studentId: string;
  average: number;
  isSessionResult?: boolean;
};

function mark(value?: number | null) {
  return value === null || value === undefined ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function assessmentRemark(value?: string) {
  return value && value !== "No behavior comment" && value !== "No psychomotor comment" ? value : "—";
}

const sessionTerms = ["FIRST", "SECOND", "THIRD"] as const;
type SessionTerm = typeof sessionTerms[number];

export default function TermReportCard({ studentName, studentCode, className, term, results, cumulativeResults, studentId, average, isSessionResult = false }: TermReportCardProps) {
  const studentResults = results.filter((result) => result.studentId === studentId);
  const hasResults = studentResults.length > 0;
  const sessionRows = new Map<string, { subject: string; terms: Partial<Record<SessionTerm, ReportResult>> }>();
  for (const result of studentResults) {
    const termName = result.termName.toUpperCase();
    if (!sessionTerms.includes(termName as SessionTerm)) continue;
    const subjectResults: { subject: string; terms: Partial<Record<SessionTerm, ReportResult>> } =
      sessionRows.get(result.subjectId) ?? { subject: result.subject, terms: {} };
    subjectResults.terms[termName as SessionTerm] = result;
    sessionRows.set(result.subjectId, subjectResults);
  }
  const groupedSessionResults = [...sessionRows.entries()].sort(([, left], [, right]) => left.subject.localeCompare(right.subject));
  const subjectCount = isSessionResult ? groupedSessionResults.length : studentResults.length;

  function sessionDevelopment(result?: ReportResult) {
    if (!result) return "—";
    const ratings = [
      result.behavioralRating ? `Behavior ${result.behavioralRating}/5` : "",
      result.psychomotorRating ? `Psychomotor ${result.psychomotorRating}/5` : "",
    ].filter(Boolean);
    const comments = [result.behavioralComment, result.psychomotorComment]
      .filter((comment) => comment && comment !== "No behavior comment" && comment !== "No psychomotor comment");
    if (!ratings.length && !comments.length) return "—";
    return <div className="session-development-cell">{ratings.map((rating) => <strong key={rating}>{rating}</strong>)}{comments.map((comment) => <small key={comment}>{comment}</small>)}</div>;
  }

  return <section className="term-report-card">
    <div className="report-card-toolbar no-print"><div><h2>{isSessionResult ? "Session report" : "Term report card"}</h2><p>Published academic record for {term || "the current term"}.</p></div><button className="export-button" type="button" onClick={() => window.print()} aria-label="Print report" title="Print report">▤ <span>Print report</span></button></div>
    <article className="report-card-document">
      <header className="report-card-brand">
        <SchoolLogo size={76} className="report-card-logo" />
        <div className="report-card-school"><p>ALBAYYAN INTERNATIONAL SCHOOL</p><h2>STUDENT REPORT CARD</h2><span>ACADEMIC PERFORMANCE RECORD</span></div>
        <div className="report-card-term"><span>SESSION / TERM</span><strong>{term || "Not available"}</strong></div>
      </header>
      <section className="report-card-identity" aria-label="Student information">
        <div><span>STUDENT NAME</span><strong>{studentName || "Student"}</strong></div>
        <div><span>STUDENT ID</span><strong>{studentCode || "—"}</strong></div>
        <div><span>CLASS</span><strong>{className || "—"}</strong></div>
        <div><span>SUBJECTS REPORTED</span><strong>{subjectCount}</strong></div>
      </section>
      <section className="report-card-summary" aria-label="Overall performance">
        <div><span>{isSessionResult ? "SESSION AVERAGE" : "TERM AVERAGE"}</span><strong>{hasResults ? `${average.toFixed(1)}%` : "—"}</strong></div>
        <div><span>OVERALL GRADE</span><strong className={hasResults ? `report-card-overall-grade grade-${gradeForPercentage(average).toLowerCase()}` : ""}>{hasResults ? gradeForPercentage(average) : "—"}</strong></div>
        <div><span>REPORT STATUS</span><strong>{hasResults ? "Published" : "Not published"}</strong></div>
      </section>
      <section className="report-card-section">
        <div className="report-card-section-heading"><span>01</span><div><h3>Academic achievement</h3><p>{isSessionResult ? "Term totals and cumulative session averages" : "Continuous assessment and examination scores"}</p></div></div>
        <div className="table-scroll report-card-table-wrap"><table className="results-table report-card-table">
          {isSessionResult ? <>
            <thead><tr><th>SUBJECT</th><th>FIRST TERM<br/>TOTAL / 100</th><th>SECOND TERM<br/>TOTAL / 100</th><th>THIRD TERM<br/>TOTAL / 100</th><th>SESSION<br/>CUM. AVG</th><th>GRADE</th></tr></thead>
            <tbody>
              {groupedSessionResults.map(([subjectId, { subject, terms }]) => {
                const subjectAverage = calculateSubjectCumulativeAverage(cumulativeResults, studentId, subjectId)?.average ?? null;
                return <tr key={subjectId}>
                  <td><strong>{subject}</strong></td>
                  {sessionTerms.map((sessionTerm) => {
                    const result = terms[sessionTerm];
                    const total = result && result.outOf > 0 ? result.score / result.outOf * 100 : null;
                    return <td key={sessionTerm}><strong>{mark(total)}</strong></td>;
                  })}
                  <td>{subjectAverage === null ? "—" : subjectAverage.toFixed(1)}</td>
                  <td>{subjectAverage === null ? "—" : <span className={`grade grade-${gradeForPercentage(subjectAverage).toLowerCase()}`}>{gradeForPercentage(subjectAverage)}</span>}</td>
                </tr>;
              })}
              {!groupedSessionResults.length && <tr><td className="empty-state" colSpan={6}>No published results are available for this session.</td></tr>}
            </tbody>
          </> : <>
            <thead><tr><th>SUBJECT</th><th>CA 1<br/>/ 10</th><th>CA 2<br/>/ 10</th><th>CA 3<br/>/ 10</th><th>EXAM<br/>/ 70</th><th>TOTAL<br/>/ 100</th><th>GRADE</th><th>CUM. AVG</th></tr></thead>
            <tbody>
              {studentResults.map((result) => {
                const cumulative = calculateSubjectCumulativeAverage(cumulativeResults, studentId, result.subjectId);
                return <tr key={result.id}><td><strong>{result.subject}</strong></td><td>{mark(result.ca1)}</td><td>{mark(result.ca2)}</td><td>{mark(result.ca3)}</td><td>{mark(result.exam)}</td><td><strong>{mark(result.score)}</strong></td><td><span className={`grade grade-${result.grade.toLowerCase()}`}>{result.grade}</span></td><td>{cumulative ? cumulative.average.toFixed(1) : "—"}</td></tr>;
              })}
              {!hasResults && <tr><td className="empty-state" colSpan={8}>No published results are available for this term.</td></tr>}
            </tbody>
          </>}
        </table></div>
      </section>
      <section className="report-card-section report-card-assessments">
        <div className="report-card-section-heading"><span>02</span><div><h3>Behavior, skills & development</h3><p>Teacher assessment and developmental observations</p></div></div>
        <div className="table-scroll report-card-table-wrap"><table className="results-table report-card-table">
          {isSessionResult ? <>
            <thead><tr><th>SUBJECT</th><th>FIRST TERM</th><th>SECOND TERM</th><th>THIRD TERM</th></tr></thead>
            <tbody>
              {groupedSessionResults.map(([subjectId, { subject, terms }]) => <tr key={`${subjectId}-development`}><td><strong>{subject}</strong></td>{sessionTerms.map((sessionTerm) => <td key={sessionTerm}>{sessionDevelopment(terms[sessionTerm])}</td>)}</tr>)}
              {!groupedSessionResults.length && <tr><td className="empty-state" colSpan={4}>Published assessments will appear here.</td></tr>}
            </tbody>
          </> : <>
            <thead><tr><th>SUBJECT</th><th>BEHAVIOR<br/>/ 5</th><th>BEHAVIOR REMARK</th><th>PSYCHOMOTOR<br/>/ 5</th><th>PSYCHOMOTOR REMARK</th></tr></thead>
            <tbody>
              {studentResults.map((result) => <tr key={`${result.id}-development`}><td><strong>{result.subject}</strong></td><td>{result.behavioralRating ? `${result.behavioralRating} / 5` : "—"}</td><td className="report-card-remark">{assessmentRemark(result.behavioralComment)}</td><td>{result.psychomotorRating ? `${result.psychomotorRating} / 5` : "—"}</td><td className="report-card-remark">{assessmentRemark(result.psychomotorComment)}</td></tr>)}
              {!hasResults && <tr><td className="empty-state" colSpan={5}>Published assessments will appear here.</td></tr>}
            </tbody>
          </>}
        </table></div>
      </section>
      <section className="report-card-signatures" aria-label="Report acknowledgements">
        <div><span>CLASS TEACHER</span><i/><small>Signature & date</small></div>
        <div><span>HEAD OF SCHOOL</span><i/><small>Signature & date</small></div>
        <div><span>PARENT / GUARDIAN</span><i/><small>Signature & date</small></div>
      </section>
      <footer className="report-card-footer"><span>Albayyan International School</span><span>End of {term || "term"} report</span></footer>
    </article>
  </section>;
}
