"use client";

import { useEffect, useState, type FormEvent } from "react";

type AnnouncementRole = "admin" | "teacher" | "student" | "parent";
type SchoolClass = { id: string; name: string };
type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "ALL" | "STAFF" | "STUDENTS" | "PARENTS" | "CLASS";
  publishedAt: string;
  class: SchoolClass | null;
  author: { name: string } | null;
};

const audienceLabel: Record<Announcement["audience"], string> = {
  ALL: "Everyone",
  STAFF: "Staff",
  STUDENTS: "Students",
  PARENTS: "Parents",
  CLASS: "Class",
};

export default function AnnouncementsWorkspace({ role }: { role: AnnouncementRole }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState("ALL");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [announcementResponse, classResponse] = await Promise.all([
          fetch("/api/announcements"),
          role === "admin" ? fetch("/api/admissions") : Promise.resolve(null),
        ]);
        const announcementData = await announcementResponse.json();
        if (!announcementResponse.ok) throw new Error(announcementData.error ?? "Unable to load announcements");
        if (!active) return;
        setAnnouncements(announcementData.announcements);
        if (classResponse) {
          const classData = await classResponse.json();
          if (classResponse.ok && active) setClasses(classData.classes);
        }
        setNotice("");
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Unable to load announcements");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [role]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const audience = String(form.get("audience"));
    setPublishing(true);
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          body: form.get("body"),
          audience,
          classId: audience === "CLASS" ? form.get("classId") : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to publish announcement");
      setAnnouncements((current) => [data.announcement, ...current]);
      setNotice("Announcement published to the selected audience");
      formElement.reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to publish announcement");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="results-section announcements-workspace">
      <div className="section-heading">
        <div><h2>{role === "admin" ? "Announcements" : "School announcements"}</h2><p>{role === "admin" ? "Publish updates to the right school community." : "Updates published for your role and class."}</p></div>
      </div>
      {role === "admin" && <form className="announcement-form" onSubmit={publish}>
        <label>Title<input name="title" maxLength={140} placeholder="e.g. Mid-term assessment schedule" required /></label>
        <label>Message<textarea name="body" maxLength={5000} rows={3} placeholder="Write a clear school update" required /></label>
        <div className="announcement-form-actions">
          <label>Audience<select name="audience" value={selectedAudience} onChange={(event) => setSelectedAudience(event.target.value)}><option value="ALL">Everyone</option><option value="STAFF">Staff</option><option value="STUDENTS">Students</option><option value="PARENTS">Parents</option><option value="CLASS">Specific class</option></select></label>
            <label>Class<select name="classId" defaultValue="" disabled={selectedAudience !== "CLASS" || !classes.length} required={selectedAudience === "CLASS"}><option value="">Select class</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
            <button className="primary-button" type="submit" disabled={publishing || (selectedAudience === "CLASS" && !classes.length)}>{publishing ? "Publishing..." : "Publish announcement"}</button>
        </div>
      </form>}
      <div className="announcement-list">
        {announcements.map((announcement) => <article className="announcement-item" key={announcement.id}>
          <div className="announcement-item-meta"><span className="class-tag">{audienceLabel[announcement.audience]}{announcement.class ? ` · ${announcement.class.name}` : ""}</span><time dateTime={announcement.publishedAt}>{new Date(announcement.publishedAt).toLocaleString()}</time></div>
          <h3>{announcement.title}</h3>
          <p>{announcement.body}</p>
          <small>Published by {announcement.author?.name ?? "School administration"}</small>
        </article>)}
        {!loading && announcements.length === 0 && <p className="empty-state">No announcements have been published for this audience.</p>}
        {loading && <p className="announcement-notice">Loading announcements...</p>}
      </div>
      {notice && <p className="announcement-notice" role="status">{notice}</p>}
    </section>
  );
}
