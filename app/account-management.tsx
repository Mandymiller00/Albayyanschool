"use client";

import { useEffect, useState } from "react";

type Account = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  createdAt: string;
  identifier: string | null;
  className: string | null;
  linkedStudents: { name: string; studentCode: string }[];
};
type TemporaryCredentials = { name: string; email: string; password: string };
type StudentChoice = { id: string; fullName: string; studentCode: string; class: { name: string } };

const roleLabels: Record<Account["role"], string> = {
  ADMIN: "Administrator",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

export default function AccountManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [students, setStudents] = useState<StudentChoice[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [temporaryCredentials, setTemporaryCredentials] = useState<TemporaryCredentials | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      setLoading(true);
      try {
        const response = await fetch("/api/accounts");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load accounts");
        if (active) {
          setAccounts(data.accounts);
          setStudents(data.students ?? []);
          setNotice("");
        }
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Unable to load accounts");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAccounts();
    return () => { active = false; };
  }, []);

  const visibleAccounts = accounts.filter((account) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [account.name, account.email, account.identifier ?? "", ...account.linkedStudents.map((student) => student.name)].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (roleFilter === "ALL" || account.role === roleFilter);
  });

  async function createOrLinkParent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setNotice("");
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("parentName"),
          email: form.get("parentEmail"),
          studentId: form.get("studentId"),
          relationship: form.get("relationship"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create or link parent account");
      if (data.temporaryPassword) {
        setTemporaryCredentials({ name: data.parent.name, email: data.parent.email, password: data.temporaryPassword });
        setNotice("Parent account created and linked. Share the temporary password securely.");
      } else {
        setNotice("Existing parent account linked to the selected student.");
      }
      formElement.reset();
      const refresh = await fetch("/api/accounts");
      const refreshedData = await refresh.json();
      if (refresh.ok) {
        setAccounts(refreshedData.accounts);
        setStudents(refreshedData.students ?? []);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create or link parent account");
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget) return;
    if (newPassword !== confirmPassword) {
      setResetError("The passwords do not match");
      return;
    }
    const account = resetTarget;
    setResettingId(account.id);
    setTemporaryCredentials(null);
    setNotice("");
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(account.id)}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to reset password");
      setNotice(`Password updated for ${account.name} (${data.email}).`);
      setResetTarget(null);
      setNewPassword("");
      setConfirmPassword("");
      setResetError("");
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Unable to reset password");
    } finally {
      setResettingId(null);
    }
  }

  async function copyCredentials() {
    if (!temporaryCredentials) return;
    try {
      await navigator.clipboard.writeText(`Login: ${temporaryCredentials.email}\nTemporary password: ${temporaryCredentials.password}`);
      setNotice("Temporary credentials copied. Share them securely; this password is shown only once.");
    } catch {
      setNotice("Clipboard access is unavailable. Copy the credentials before closing this page.");
    }
  }

  return <section className="account-management results-section">
    <div className="section-heading"><div><h2>Portal accounts</h2><p>Account emails and roles for administrators, teachers, students and parents.</p></div><span className="account-count">{accounts.length} accounts</span></div>
    <section className="parent-account-setup"><div><h3>Create or link a parent</h3><p>Use the parent&apos;s email. Existing parent accounts can be linked to another child without resetting their password.</p></div><form className="parent-account-form" onSubmit={createOrLinkParent}>
      <label>Parent full name<input name="parentName" required placeholder="Parent or guardian name" /></label>
      <label>Parent email<input name="parentEmail" type="email" required placeholder="name@example.com" /></label>
      <label>Student<select name="studentId" required defaultValue=""><option value="" disabled>Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.studentCode} · {student.class.name}</option>)}</select></label>
      <label>Relationship<input name="relationship" placeholder="Mother, father, guardian" /></label>
      <button className="primary-button" type="submit" disabled={!students.length}>Create / link parent</button>
    </form></section>
    <p className="account-security-note"><span aria-hidden="true">i</span> Passwords are never displayed or stored in plain text. Reset an account by entering a new password; it is securely hashed before storage.</p>
    {temporaryCredentials && <section className="temporary-credentials" aria-live="polite">
      <div><p className="eyebrow">NEW TEMPORARY PASSWORD · SHOWN ONCE</p><h3>{temporaryCredentials.name}</h3><dl><div><dt>Login</dt><dd>{temporaryCredentials.email}</dd></div><div><dt>Temporary password</dt><dd className="temporary-password">{temporaryCredentials.password}</dd></div></dl></div>
      <div className="temporary-credentials-actions"><button className="export-button" type="button" onClick={() => void copyCredentials()} aria-label="Copy temporary login credentials" title="Copy credentials">▣</button><button className="student-profile-close" type="button" onClick={() => setTemporaryCredentials(null)} aria-label="Dismiss temporary credentials">×</button></div>
    </section>}
    <div className="account-filters">
      <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search accounts" placeholder="Search name, login or linked student" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="select-wrap"><span className="sr-only">Filter accounts by role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="ALL">All roles</option><option value="ADMIN">Administrators</option><option value="TEACHER">Teachers</option><option value="STUDENT">Students</option><option value="PARENT">Parents</option></select></label>
    </div>
    {notice && <p className="account-notice" role="status">{notice}</p>}
    <div className="table-scroll"><table className="results-table account-table"><thead><tr><th>ACCOUNT HOLDER</th><th>LOGIN EMAIL</th><th>ROLE</th><th>LINKED RECORD</th><th>CREATED</th><th>ACTION</th></tr></thead><tbody>
      {visibleAccounts.map((account) => <tr key={account.id}><td><strong className="teacher-student-name">{account.name}</strong></td><td>{account.email}</td><td><span className={`account-role account-role-${account.role.toLowerCase()}`}>{roleLabels[account.role]}</span></td><td>{account.role === "STUDENT" ? [account.identifier, account.className].filter(Boolean).join(" · ") || "Not linked" : account.role === "TEACHER" ? account.identifier || "Not linked" : account.role === "PARENT" ? account.linkedStudents.map((student) => `${student.name} (${student.studentCode})`).join(", ") || "No students linked" : "School access"}</td><td>{new Date(account.createdAt).toLocaleDateString()}</td><td><button className="row-action" type="button" disabled={resettingId === account.id} onClick={() => { setResetTarget(account); setNewPassword(""); setConfirmPassword(""); setResetError(""); setTemporaryCredentials(null); setNotice(""); }}>{resettingId === account.id ? "Updating..." : "Reset password"}</button></td></tr>)}
      {!loading && visibleAccounts.length === 0 && <tr><td className="empty-state" colSpan={6}>{notice ? "Accounts could not be loaded." : "No accounts match these filters."}</td></tr>}
      {loading && <tr><td className="empty-state" colSpan={6}>Loading accounts...</td></tr>}
    </tbody></table></div>
    {resetTarget && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !resettingId) setResetTarget(null); }}>
      <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="reset-account-password-title">
        <div className="modal-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h2 id="reset-account-password-title">Set a new password</h2></div><button className="modal-close" type="button" aria-label="Close password reset" disabled={Boolean(resettingId)} onClick={() => setResetTarget(null)}>×</button></div>
        <p className="modal-description">Set a new password for {resetTarget.name} ({resetTarget.email}). The current password cannot be viewed.</p>
        <form className="result-form" onSubmit={(event) => void resetPassword(event)}>
          <label>New password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><span className="field-hint">Use at least 12 characters.</span></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          {resetError && <p className="signin-error" role="alert">{resetError}</p>}
          <div className="form-actions"><button className="cancel-button" type="button" disabled={Boolean(resettingId)} onClick={() => setResetTarget(null)}>Cancel</button><button className="primary-button" type="submit" disabled={Boolean(resettingId)}>{resettingId ? "Updating..." : "Update password"}</button></div>
        </form>
      </section>
    </div>}
  </section>;
}
