"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type PortalRole = "teacher" | "student" | "parent";
type Syllabus = {
  id: string;
  content: string;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  updatedAt: string;
};
type SyllabusAssignment = {
  id: string;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  teacher: { fullName: string };
  syllabus: Syllabus | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function SyllabusContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return <p className="syllabus-empty-content">Open the attachment below to view the full syllabus.</p>;
  return <div className="syllabus-topics">{lines.map((line, index) => <p key={`${index}-${line}`}><span>{String(index + 1).padStart(2, "0")}</span>{line}</p>)}</div>;
}

export default function SyllabusWorkspace({ role }: { role: PortalRole }) {
  const [assignments, setAssignments] = useState<SyllabusAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [content, setContent] = useState("");
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const teacherView = role === "teacher";

  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId);
  const publishedCount = useMemo(() => assignments.filter((assignment) => assignment.syllabus).length, [assignments]);

  useEffect(() => {
    async function loadSyllabi() {
      try {
        const response = await fetch("/api/syllabi");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load subject syllabi");
        const nextAssignments: SyllabusAssignment[] = data.assignments ?? [];
        setAssignments(nextAssignments);
        if (teacherView && nextAssignments.length) {
          setSelectedAssignmentId(nextAssignments[0].id);
          setContent(nextAssignments[0].syllabus?.content ?? "");
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to load subject syllabi");
      } finally {
        setLoading(false);
      }
    }
    void loadSyllabi();
  }, [teacherView]);

  function selectAssignment(assignmentId: string) {
    setSelectedAssignmentId(assignmentId);
    setContent(assignments.find((assignment) => assignment.id === assignmentId)?.syllabus?.content ?? "");
    setRemoveAttachment(false);
  }

  async function saveSyllabus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssignment) return;
    const formElement = event.currentTarget;
    const formData = new FormData();
    formData.set("assignmentId", selectedAssignment.id);
    formData.set("content", content);
    formData.set("removeAttachment", String(removeAttachment));
    const file = formElement.elements.namedItem("attachment");
    if (file instanceof HTMLInputElement && file.files?.[0]) formData.set("attachment", file.files[0]);

    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/syllabi", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save syllabus");
      setAssignments((current) => current.map((assignment) => assignment.id === selectedAssignment.id
        ? { ...assignment, syllabus: data.syllabus }
        : assignment));
      setRemoveAttachment(false);
      formElement.reset();
      setNotice(`${selectedAssignment.subject.name} syllabus saved and shared with the class.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save syllabus");
    } finally {
      setSaving(false);
    }
  }

  return <section className="syllabus-workspace">
    <header className="syllabus-hero">
      <div className="syllabus-hero-art" aria-hidden="true"><span/><span/><span/></div>
      <div className="syllabus-hero-copy"><span className="syllabus-kicker">{teacherView ? "TEACHING RESOURCES" : "YOUR LEARNING GUIDE"}</span><h2>{teacherView ? "Subject syllabi" : "Explore your subjects"}</h2><p>{teacherView ? "Plan the learning journey and share your subject outline with students and their families." : "A clear guide to the topics and learning goals for each of your subjects."}</p></div>
      <div className="syllabus-hero-stat"><strong>{assignments.length}</strong><span>SUBJECTS</span><i/><strong>{publishedCount}</strong><span>PUBLISHED</span></div>
    </header>

    {notice && <p className="syllabus-notice" role="status">{notice}</p>}
    {loading ? <div className="syllabus-loading"><span className="syllabus-loading-mark">✳</span><p>Preparing your subject library…</p></div>
      : !assignments.length ? <div className="syllabus-empty"><span>◌</span><h3>No subjects are assigned yet</h3><p>{teacherView ? "Once your class and subject assignments are set up, you can publish syllabi here." : "Your class subject syllabi will appear here once your teachers publish them."}</p></div>
        : <div className={teacherView ? "syllabus-layout syllabus-layout-teacher" : "syllabus-layout"}>
          {teacherView && <aside className="syllabus-editor-panel">
            <div className="syllabus-editor-heading"><span>✎</span><div><h3>Build a syllabus</h3><p>Your class will see updates straight away.</p></div></div>
            <form className="syllabus-editor-form" onSubmit={(event) => void saveSyllabus(event)}>
              <label>Class and subject<select value={selectedAssignmentId} onChange={(event) => selectAssignment(event.target.value)} required><option value="">Choose an assignment</option>{assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.class.name} · {assignment.subject.name}</option>)}</select></label>
              <label>Topics and learning plan<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={30000} rows={10} placeholder={"Enter one topic or learning objective per line.\n\nExample:\n1. Number patterns and place value\n2. Fractions and equivalent forms\n3. Applying mathematics to real-life problems"} /></label>
              <div className="syllabus-character-count">{content.length.toLocaleString()} / 30,000 characters</div>
              {selectedAssignment?.syllabus?.attachmentName && !removeAttachment && <div className="syllabus-current-file"><span className="syllabus-file-icon">▤</span><span><strong>Current resource</strong><small>{selectedAssignment.syllabus.attachmentName}</small></span><button type="button" onClick={() => setRemoveAttachment(true)}>Remove</button></div>}
              {removeAttachment && <p className="syllabus-remove-note">The current attachment will be removed when you save.</p>}
              <label className="syllabus-upload-field"><span className="syllabus-upload-icon">↑</span><span><strong>{selectedAssignment?.syllabus?.attachmentName && !removeAttachment ? "Replace resource" : "Add a resource"}</strong><small>PDF, Word, text, or image · up to 10 MB</small></span><input name="attachment" type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/gif,image/webp" /></label>
              <button className="syllabus-publish-button" type="submit" disabled={!selectedAssignment || saving}><span>{saving ? "Saving syllabus…" : selectedAssignment?.syllabus ? "Update syllabus" : "Publish syllabus"}</span><span aria-hidden="true">→</span></button>
            </form>
            <div className="syllabus-private-note"><span>i</span><p>Only students in this class and their linked parents can view this syllabus.</p></div>
          </aside>}
          <div className="syllabus-list">
            <div className="syllabus-list-heading"><div><span className="syllabus-kicker">{teacherView ? "YOUR ASSIGNMENTS" : role === "parent" ? "YOUR CHILD'S SUBJECTS" : "MY SUBJECTS"}</span><h3>{teacherView ? "Class syllabus library" : "Learning library"}</h3></div><span className="syllabus-count-pill">{publishedCount} of {assignments.length} published</span></div>
            <div className="syllabus-cards">{assignments.map((assignment) => {
              const syllabus = assignment.syllabus;
              const attachmentUrl = `/api/syllabi/${encodeURIComponent(assignment.id)}/attachment`;
              const imageAttachment = syllabus?.attachmentMimeType?.startsWith("image/");
              return <article className={`syllabus-card ${syllabus ? "syllabus-card-published" : ""}`} key={assignment.id}>
                <div className="syllabus-card-top"><span className="syllabus-subject-icon">{assignment.subject.name.slice(0, 1).toUpperCase()}</span><div className="syllabus-card-title"><span>{assignment.class.name}</span><h4>{assignment.subject.name}</h4></div><span className={`syllabus-status ${syllabus ? "is-published" : "is-pending"}`}><i/>{syllabus ? "Published" : "Coming soon"}</span></div>
                {syllabus ? <><div className="syllabus-teacher-line"><span>Prepared by {assignment.teacher.fullName}</span><span>Updated {formatDate(syllabus.updatedAt)}</span></div><SyllabusContent content={syllabus.content} />
                  {imageAttachment && <a className="syllabus-image-preview" href={attachmentUrl} target="_blank" rel="noreferrer"><Image src={attachmentUrl} alt={`${assignment.subject.name} syllabus resource`} width={720} height={400} unoptimized /></a>}
                  {syllabus.attachmentName && <a className="syllabus-resource-link" href={attachmentUrl} target="_blank" rel="noreferrer" download={!imageAttachment}><span className="syllabus-resource-icon">▤</span><span><strong>{syllabus.attachmentName}</strong><small>{imageAttachment ? "Open image resource" : "Open or download subject resource"}</small></span><span className="syllabus-resource-arrow">↗</span></a>}
                  {teacherView && <button className="syllabus-edit-button" type="button" onClick={() => selectAssignment(assignment.id)}>Edit this syllabus <span>→</span></button>}
                </> : <div className="syllabus-coming-soon"><span>✧</span><p>{teacherView ? "Add topics or a learning resource above to publish this syllabus." : "Your teacher is preparing the learning plan for this subject."}</p>{teacherView && <button type="button" onClick={() => selectAssignment(assignment.id)}>Create syllabus <span>→</span></button>}</div>}
              </article>;
            })}</div>
          </div>
        </div>}
  </section>;
}
