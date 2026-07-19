import { useEffect, useState } from "react";

/**
 * Email-verification landing. Signup emails a link (digiringo.com/?verify=TOKEN);
 * SiteApp renders this (bare) when the `verify` query param is present. Self-
 * contained — hits /api/auth/verify directly, no app/store imports.
 */
export function VerifyPage() {
  const token = (() => { try { return new URLSearchParams(window.location.search).get("verify") || ""; } catch { return ""; } })();
  const [state, setState] = useState<"verifying" | "done" | "error">(token ? "verifying" : "error");
  const [err, setErr] = useState("This verification link is missing or broken.");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/verify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const j = await r.json().catch(() => ({} as { ok?: boolean; error?: string }));
        if (!r.ok || !j.ok) throw new Error(j.error || "Verification failed");
        if (!cancelled) setState("done");
      } catch (e) {
        if (!cancelled) { setErr(e instanceof Error ? e.message : "Verification failed"); setState("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="dg-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1, textAlign: "center" }}>
        <div className="dg-logo" style={{ marginBottom: 6, justifyContent: "center" }}>
          <span className="dg-logo-mark" aria-hidden>D</span><span style={{ fontSize: 18 }}>DIGIRINGO</span>
        </div>

        {state === "verifying" && (
          <>
            <h1 className="dg-h2" style={{ fontSize: 28, marginTop: 20 }}>Verifying…</h1>
            <p className="dg-lead" style={{ fontSize: 15, marginTop: 12 }}>Just a moment while we confirm your email.</p>
          </>
        )}
        {state === "done" && (
          <>
            <h1 className="dg-h2" style={{ fontSize: 28, marginTop: 20 }}>Email verified ✓</h1>
            <p className="dg-lead" style={{ fontSize: 15, marginTop: 12 }}>
              Your email is confirmed. You're all set — head back to the app.
            </p>
            <a href="/app" className="dg-btn dg-btn-primary dg-btn-lg" style={{ marginTop: 26 }}>Open the app</a>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="dg-h2" style={{ fontSize: 28, marginTop: 20 }}>Link invalid or expired</h1>
            <p className="dg-lead" style={{ fontSize: 15, marginTop: 12 }}>{err} You can request a new link from the app.</p>
            <a href="/app" className="dg-btn dg-btn-primary dg-btn-lg" style={{ marginTop: 26 }}>Open the app</a>
          </>
        )}
      </div>
    </div>
  );
}
