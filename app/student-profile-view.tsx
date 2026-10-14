"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type StudentProfile = {
  id: string;
  fullName: string;
  studentCode: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  passportPhotoUrl: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalNotes: string | null;
  createdAt: string;
  user: { email: string } | null;
  class: { name: string; level: string | null; assignments: { teacher: { fullName: string } }[] };
  parentLinks: { relationship: string | null; isPrimary: boolean; parent: { name: string; email: string } }[];
};

function display(value: string | null | undefined) {
  return value?.trim() || "Not provided";
}

function formatDate(value: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export default function StudentProfileView({ studentId, onClose }: { studentId: string; onClose?: () => void }) {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/students/${encodeURIComponent(studentId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load student profile");
        if (active) setStudent(data.student);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load student profile");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, [studentId]);

  if (loading) return <section className="student-profile-panel" role="status"><div className="student-profile-panel-heading"><h3>Loading student profile...</h3></div></section>;
  if (error || !student) return <section className="student-profile-panel" role="alert"><div className="student-profile-panel-heading"><h3>Profile unavailable</h3></div><p className="student-profile-error">{error || "Student profile was not found."}</p></section>;

  const initials = student.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const teachers = [...new Set(student.class.assignments.map((assignment) => assignment.teacher.fullName))];

  return <section className="student-profile-view" aria-label={`${student.fullName} student profile`}>
    {onClose && <div className="student-profile-toolbar"><span className="eyebrow">READ-ONLY STUDENT PROFILE</span><button className="student-profile-close" type="button" onClick={onClose} aria-label="Close student profile">×</button></div>}
    <header className="student-profile-hero">
      {student.passportPhotoUrl ? <Image className="student-profile-photo" src={student.passportPhotoUrl} alt={`${student.fullName} passport photograph`} width={58} height={58} unoptimized /> : <span className="student-profile-avatar" aria-hidden="true">{initials}</span>}
      <div><p className="eyebrow">STUDENT PROFILE</p><h2>{student.fullName}</h2><p>{student.studentCode} <span>·</span> {student.class.name}</p></div>
      <div className="student-profile-hero-meta"><span>Class teacher(s)</span><strong>{teachers.join(", ") || "Not assigned"}</strong><span>Admission date</span><strong>{formatDate(student.createdAt)}</strong></div>
    </header>
    <div className="student-profile-grid">
      <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Personal information</h3></div><dl className="student-profile-fields">
        <ProfileField label="Full name" value={student.fullName} />
        <ProfileField label="Student ID" value={student.studentCode} />
        <ProfileField label="Date of birth" value={formatDate(student.dateOfBirth)} />
        <ProfileField label="Gender" value={display(student.gender)} />
        <ProfileField label="Email address" value={display(student.email)} />
        <ProfileField label="Phone number" value={display(student.phone)} />
        <div className="student-profile-wide"><ProfileField label="Home address" value={display(student.address)} /></div>
      </dl></section>
      <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Enrollment</h3></div><dl className="student-profile-fields">
        <ProfileField label="Current class" value={student.class.name} />
        <ProfileField label="Level / section" value={display(student.class.level)} />
        <ProfileField label="Class teacher(s)" value={teachers.join(", ") || "Not assigned"} />
        <ProfileField label="Admission date" value={formatDate(student.createdAt)} />
        <ProfileField label="Portal account" value={display(student.user?.email)} />
      </dl></section>
      <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Parent / guardian</h3></div><dl className="student-profile-fields">
        <ProfileField label="Emergency contact" value={display(student.emergencyContactName)} />
        <ProfileField label="Emergency phone" value={display(student.emergencyContactPhone)} />
        {student.parentLinks.length ? student.parentLinks.map((link) => <div key={`${link.parent.email}:${link.relationship}`}><dt>{link.isPrimary ? "Primary guardian" : "Linked guardian"}</dt><dd>{link.parent.name}{link.relationship ? ` · ${link.relationship}` : ""}<br />{link.parent.email}</dd></div>) : <div><dt>Linked parent accounts</dt><dd>None linked</dd></div>}
      </dl></section>
      <section className="student-profile-panel"><div className="student-profile-panel-heading"><h3>Medical information</h3></div><dl className="student-profile-fields"><div className="student-profile-wide"><ProfileField label="Medical notes / needs" value={display(student.medicalNotes)} /></div><div className="student-profile-wide"><ProfileField label="Passport photo" value={student.passportPhotoUrl ? "Photo on file" : "Not provided"} /></div></dl></section>
    </div>
  </section>;
}
