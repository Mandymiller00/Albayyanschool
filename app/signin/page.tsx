"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { SchoolLogo } from "../school-logo";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoLoginEnabled = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === "true";

  function fillDemoLogin() {
    setEmail("demo@albayyan.edu");
    setPassword("Albayyan-Demo-2026!");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/",
        redirect: false,
      });

      if (result?.error || !result?.url) {
        setError("We couldn’t sign you in. Check your details and try again.");
        setIsSubmitting(false);
        return;
      }

      window.location.assign(result.url);
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again shortly.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="signin-page">
      <section className="signin-aside">
        <a className="brand signin-brand" href="/signin" aria-label="Albayyan International School">
          <SchoolLogo size={58} className="signin-brand-crest"/>
          <span><strong>Albayyan</strong><small>INTERNATIONAL SCHOOL</small></span>
        </a>
        <div className="signin-aside-copy">
          <span className="signin-kicker">ALBAYYAN INTERNATIONAL SCHOOL</span>
          <h1>Every learner.<br />Every milestone.</h1>
          <p>Academic records and school services, brought together in one secure place.</p>
        </div>
        <div className="signin-aside-footer"><span>ACADEMIC SESSION</span><strong>2025 / 2026</strong></div>
      </section>
      <section className="signin-main">
        <div className="signin-card">
          <div className="signin-heading"><SchoolLogo size={74} className="signin-main-crest"/><p className="signin-kicker">WELCOME BACK</p><h2>Sign in to your portal</h2><p>Use the school account provided to you.</p></div>
          <form className="signin-form" onSubmit={handleSubmit}>
            <label htmlFor="signin-email">Email address</label>
            <input id="signin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@school.edu" required />
            <div className="signin-password-label"><label htmlFor="signin-password">Password</label></div>
            <input id="signin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
            {error && <p className="signin-error" role="alert">{error}</p>}
            <button className="signin-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></button>
            {demoLoginEnabled && <button className="signin-demo" type="button" onClick={fillDemoLogin}>Fill demo administrator login</button>}
          </form>
          <p className="signin-help">Need access? Contact your school administrator.</p>
        </div>
        <footer className="signin-footer">Secure access for Albayyan International School students, families and staff.</footer>
      </section>
    </main>
  );
}