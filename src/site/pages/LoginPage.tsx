import { useState, type FormEvent } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { AuthShell } from "../components/AuthShell";
import { Link } from "../router";

export function LoginPage() {
  const [busy, setBusy] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // Real authentication lives in the DIGIRINGO app — hand off to it.
    window.location.href = "/app";
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to manage your numbers, inbox and wallet."
      footer={<>New to DIGIRINGO? <Link to="/signup" style={{ color: "var(--blue)", fontWeight: 600 }}>Create an account</Link></>}
    >
      <div className="dg-social">
        <button type="button" className="dg-social-btn" onClick={() => (window.location.href = "/app")}>
          <GoogleIcon /> Google
        </button>
        <button type="button" className="dg-social-btn" onClick={() => (window.location.href = "/app")}>
          <AppleIcon /> Apple
        </button>
      </div>
      <div className="dg-divider">or continue with email</div>

      <form onSubmit={onSubmit}>
        <div className="dg-field">
          <label className="dg-label">Email</label>
          <div className="dg-input-wrap">
            <Mail size={17} className="ic" />
            <input className="dg-input" type="email" placeholder="you@example.com" required />
          </div>
        </div>
        <div className="dg-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="dg-label">Password</label>
            <a href="#/login" className="dg-muted" style={{ fontSize: 12.5 }}>Forgot?</a>
          </div>
          <div className="dg-input-wrap">
            <Lock size={17} className="ic" />
            <input className="dg-input" type="password" placeholder="••••••••" required />
          </div>
        </div>
        <button type="submit" className="dg-btn dg-btn-primary dg-btn-lg" style={{ width: "100%", marginTop: 8 }} disabled={busy}>
          {busy ? "Logging in…" : <>Log in <ArrowRight size={17} /></>}
        </button>
      </form>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75Z" />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
      <path d="M16.36 12.62c.03 3.14 2.76 4.18 2.79 4.2-.02.07-.44 1.5-1.44 2.97-.87 1.28-1.77 2.55-3.19 2.58-1.39.02-1.84-.82-3.43-.82s-2.08.8-3.4.85c-1.36.05-2.4-1.39-3.28-2.66-1.8-2.6-3.18-7.36-1.33-10.57.92-1.6 2.56-2.6 4.34-2.63 1.34-.02 2.6.9 3.43.9.82 0 2.36-1.11 3.98-.95.68.03 2.58.27 3.8 2.07-.1.06-2.27 1.32-2.25 3.96M13.8 3.5c.73-.88 1.22-2.11 1.08-3.33-1.05.04-2.32.7-3.07 1.58-.67.78-1.26 2.03-1.1 3.22 1.17.09 2.36-.6 3.09-1.47" />
    </svg>
  );
}
