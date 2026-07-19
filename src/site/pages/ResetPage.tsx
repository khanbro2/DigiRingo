import { useState } from "react";

/**
 * Password-reset landing. The email link points here (digiringo.com/?reset=TOKEN);
 * SiteApp renders this (bare) when the `reset` query param is present. Self-
 * contained — talks to /api/auth/reset directly, no app/store imports.
 */
export function ResetPage() {
  const token = (() => { try { return new URLSearchParams(window.location.search).get("reset") || ""; } catch { return ""; } })();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (pw.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (pw !== pw2) { setErr("Passwords don't match"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const j = await r.json().catch(() => ({} as { ok?: boolean; error?: string }));
      if (!r.ok || !j.ok) throw new Error(j.error || "Reset failed");
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Reset failed"); }
    setBusy(false);
  };

  return (
    <div className="dg-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>
        <div className="dg-logo" style={{ marginBottom: 6 }}>
          <span className="dg-logo-mark" aria-hidden>D</span><span style={{ fontSize: 18 }}>DIGIRINGO</span>
        </div>

        {!token ? (
          <>
            <h1 className="dg-h2" style={{ fontSize: 28, marginTop: 20 }}>Invalid link</h1>
            <p className="dg-lead" style={{ fontSize: 15, marginTop: 12 }}>
              This password-reset link is missing or broken. Request a new one from the app.
            </p>
            <a href="/app" className="dg-btn dg-btn-primary dg-btn-lg" style={{ marginTop: 26 }}>Open the app</a>
          </>
        ) : done ? (
          <>
            <h1 className="dg-h2" style={{ fontSize: 28, marginTop: 20 }}>Password updated ✓</h1>
            <p className="dg-lead" style={{ fontSize: 15, marginTop: 12 }}>
              Your password has been reset. You can now log in with your new password.
            </p>
            <a href="/app" className="dg-btn dg-btn-primary dg-btn-lg" style={{ marginTop: 26 }}>Log in</a>
          </>
        ) : (
          <>
            <h1 className="dg-h2" style={{ fontSize: 28, marginTop: 20 }}>Set a new password</h1>
            <p className="dg-lead" style={{ fontSize: 14.5, marginTop: 10 }}>Choose a new password for your DIGIRINGO account.</p>
            <div className="dg-field" style={{ marginTop: 22 }}>
              <label className="dg-label">New password</label>
              <input className="dg-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <div className="dg-field">
              <label className="dg-label">Confirm password</label>
              <input className="dg-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Repeat password" />
            </div>
            {err && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 2 }}>{err}</p>}
            <button onClick={submit} disabled={busy} className="dg-btn dg-btn-primary dg-btn-lg" style={{ width: "100%", marginTop: 16, opacity: busy ? 0.7 : 1 }}>
              {busy ? "Saving…" : "Reset password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
