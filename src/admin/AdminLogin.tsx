import { useState } from "react";
import { Lock, ShieldCheck, Mail, User } from "lucide-react";
import { A, gradients, font } from "./ui";
import { DgrMark } from "../app/components/DgrMark";
import { adminLogin, agentLogin } from "./adminAuth";

/** Sign-in gate for the Control Hub. Owners sign in with the admin password;
 *  team members sign in with their email + password. */
export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"admin" | "agent">("admin");
  const [pw, setPw] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      if (mode === "admin") { if (!pw) { setBusy(false); return; } await adminLogin(pw); }
      else { if (!email || !pw) { setBusy(false); return; } await agentLogin(email, pw); }
      onSuccess();
    } catch (e) { setErr(e instanceof Error ? e.message : "Sign-in failed"); }
    setBusy(false);
  };

  const tab = (m: "admin" | "agent", label: string) => (
    <button onClick={() => { setMode(m); setErr(""); }} style={{
      flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: font.sans,
      fontSize: 13, fontWeight: 700, background: mode === m ? A.panelAlt : "transparent", color: mode === m ? A.text : A.muted,
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: A.shell, display: "grid", placeItems: "center", fontFamily: font.sans, padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>
      <div style={{ width: "100%", maxWidth: 380, background: A.panel, border: `1px solid ${A.line}`, borderRadius: 18, padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: gradients.brand, display: "grid", placeItems: "center" }}><DgrMark w={26} /></div>
          <div>
            <p style={{ color: A.text, fontSize: 16, fontWeight: 800, lineHeight: 1 }}>DIGIRINGO</p>
            <p style={{ color: A.muted, fontSize: 11.5, marginTop: 3 }}>Control Hub</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 22, padding: 4, background: A.shell, borderRadius: 12, border: `1px solid ${A.line}` }}>
          {tab("admin", "Admin")}
          {tab("agent", "Team member")}
        </div>

        <h1 style={{ color: A.text, fontSize: 19, fontWeight: 800, marginTop: 20 }}>{mode === "admin" ? "Admin sign in" : "Team sign in"}</h1>
        <p style={{ color: A.muted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          {mode === "admin" ? "Enter the admin password to access the dashboard." : "Sign in with the email + password your admin gave you."}
        </p>

        {mode === "agent" && (
          <div style={{ position: "relative", marginTop: 18 }}>
            <Mail size={15} color={A.muted} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
            <input value={email} type="email" placeholder="you@team.com" autoFocus
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
              style={{ width: "100%", padding: "12px 14px 12px 38px", background: A.panelAlt, border: `1px solid ${err ? A.red : A.line}`, borderRadius: 11, color: A.text, fontSize: 14, outline: "none", fontFamily: font.sans }} />
          </div>
        )}

        <div style={{ position: "relative", marginTop: mode === "agent" ? 12 : 18 }}>
          <Lock size={15} color={A.muted} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
          <input value={pw} type="password" autoFocus={mode === "admin"} placeholder="Password"
            onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{ width: "100%", padding: "12px 14px 12px 38px", background: A.panelAlt, border: `1px solid ${err ? A.red : A.line}`, borderRadius: 11, color: A.text, fontSize: 14, outline: "none", fontFamily: font.sans }} />
        </div>

        {err && <p style={{ color: A.red, fontSize: 12.5, marginTop: 8 }}>{err}</p>}
        <button onClick={submit} disabled={busy} style={{
          width: "100%", marginTop: 16, padding: "13px", border: "none", borderRadius: 12,
          background: gradients.brand, color: "#fff", fontSize: 14.5, fontWeight: 800,
          cursor: busy ? "wait" : "pointer", fontFamily: font.sans, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.75 : 1,
        }}>
          {mode === "admin" ? <ShieldCheck size={16} /> : <User size={16} />} {busy ? "Signing in…" : "Sign in"}
        </button>
        <a href="/" style={{ display: "block", textAlign: "center", marginTop: 16, color: A.muted, fontSize: 12.5, textDecoration: "none" }}>← Back to site</a>
      </div>
    </div>
  );
}
