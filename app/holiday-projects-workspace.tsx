"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";

type PortalRole = "teacher" | "student" | "parent";
type ProjectAssignment = {
  id: string;
  class: { id: string; name: string };
  subject: { id: string; name: string };
};
type HolidayProject = {
  id: string;
  title: string;
  description: string;
  assignedAt: string;
  dueDate: string;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  class: { id: string; name: string };
  subject: { id: string; name: string } | null;
  teacher: { fullName: string } | null;
  term: { name: string; academicYear: { name: string } } | null;
};

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function HolidayProjectsWorkspace({ role }: { role: PortalRole }) {
  const [projects, setProjects] = useState<HolidayProject[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/holiday-projects");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load holiday projects");
        setProjects(data.projects ?? []);
        setAssignments(data.assignments ?? []);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to load holiday projects");
      } finally {
        setLoading(false);
      }
    }
    void loadProjects();
  }, []);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/holiday-projects", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create holiday project");
      setProjects((current) => [data.project, ...current]);
      formElement.reset();
      setNotice("Holiday project assigned successfully.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create holiday project");
    } finally {
      setSaving(false);
    }
  }

  return <section className="results-section holiday-projects-workspace">
    <div className="section-heading">
      <div><h2>{role === "teacher" ? "Holiday projects" : "Holiday assignments"}</h2><p>{role === "teacher" ? "Create projects for your assigned classes and share instructions with students and parents." : "Projects assigned to your class, including instructions and deadlines."}</p></div>
    </div>
    {role === "teacher" && <form className="dashboard-form setup-form holiday-project-form" onSubmit={(event) => void createProject(event)}>
      <div className="form-pair">
        <label>Class and subject<select name="assignmentId" defaultValue="" required><option value="">Select your class and subject</option>{assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.class.name} · {assignment.subject.name}</option>)}</select></label>
        <label>Project title<input name="title" maxLength={140} required placeholder="e.g. Holiday reading journal" /></label>
      </div>
      <label>Instructions<textarea name="description" maxLength={5000} rows={4} required placeholder="Describe what students should complete." /></label>
      <div className="form-pair">
        <label>Deadline<input name="dueDate" type="date" required /></label>
        <label>Attachment (optional)<input name="attachment" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/gif,image/webp" /><span className="setup-help">PDF, Word, or image file · 10 MB maximum</span></label>
      </div>
      <button className="primary-button" type="submit" disabled={saving || !assignments.length}>{saving ? "Assigning..." : "Assign holiday project"}</button>
      {!assignments.length && <p className="form-help">You need an assigned class and subject before you can create a project.</p>}
    </form>}
    {notice && <p className="setup-notice" role="status">{notice}</p>}
    {loading ? <p className="empty-state">Loading holiday projects…</p>
      : projects.length ? <div className="project-grid">{projects.map((project) => {
        const attachmentUrl = `/api/holiday-projects/${encodeURIComponent(project.id)}/attachment`;
        const isImage = project.attachmentMimeType?.startsWith("image/");
        return <article className="record-panel project-card" key={project.id}>
          <div className="project-card-top"><span className="project-subject">{project.subject?.name ?? "Class project"}</span><span className="project-class-name">{project.class.name}</span></div>
          <h3>{project.title}</h3>
          <p>{project.description}</p>
          <div className="project-assignment-meta"><span>Assigned by <strong>{project.teacher?.fullName ?? "School"}</strong></span>{project.term && <span>{project.term.name[0] + project.term.name.slice(1).toLowerCase()} · {project.term.academicYear.name}</span>}</div>
          {isImage && <a className="holiday-project-image-link" href={attachmentUrl} target="_blank" rel="noreferrer"><Image src={attachmentUrl} alt={project.attachmentName ?? `Attachment for ${project.title}`} width={520} height={320} unoptimized /></a>}
          {project.attachmentName && <a className="holiday-project-attachment" href={attachmentUrl} target="_blank" rel="noreferrer" download={!isImage}>{isImage ? "View image attachment" : `Download ${project.attachmentName}`}</a>}
          <div className="project-due"><span>Deadline</span><strong>{formatDate(project.dueDate)}</strong></div>
        </article>;
      })}</div> : <p className="empty-state">{role === "teacher" ? "You have not assigned any holiday projects yet." : "No holiday projects have been assigned to your class yet."}</p>}
  </section>;
}
