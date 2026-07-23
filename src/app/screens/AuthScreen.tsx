import { useState, type ReactNode, type CSSProperties } from "react";
import { Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { C, gradients, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";
import { apiForgotPassword } from "../services/api";
import { DgrMark } from "../components/DgrMark";

/** Sign up / Log in. Gates the whole app — nothing is reachable until logged in. */
export function AuthScreen() {
  const { login, showToast } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

  const forgotSubmit = async () => {
    if (busy) return;
    if (!email.trim()) { showToast("Enter your email", "error"); return; }
    setBusy(true);
    try { await apiForgotPassword(email.trim()); } catch { /* generic message regardless */ }
    setSent(true);
    setBusy(false);
  };

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !pw.trim() || (mode === "signup" && !name.trim())) {
      showToast("Please fill in all fields", "error");
      return;
    }
    setBusy(true);
    const res = await login(email.trim(), pw, mode === "signup" ? name.trim() : undefined);
    setBusy(false);
    if (res.ok) {
      showToast(mode === "signup" ? "Account created 🎉" : "Welcome back!");
    } else {
      showToast(res.error || "Something went wrong", "error");
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100%", display: "flex", flexDirection: "column", padding: "0 24px" }}>
      {/* Brand */}
      <div style={{ paddingTop: 64, textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: "0 auto 18px",
          background: gradients.brand, display: "flex", alignItems: "center",
          justifyContent: "center", boxShadow: "0 12px 36px rgba(124,92,255,0.4)",
        }}><DgrMark w={42} /></div>
        <h1 style={{ color: C.text, fontSize: 26, fontWeight: 800 }}>DIGIRINGO</h1>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
          {forgot ? "Reset your password" : mode === "signup" ? "Create your workspace" : "Log in to your workspace"}
        </p>
      </div>

      {forgot ? (
        /* ---- Forgot-password flow ---- */
        sent ? (
          <div style={{ marginTop: 30, textAlign: "center" }}>
            <p style={{ color: C.text, fontSize: 16, fontWeight: 800 }}>Check your email 📧</p>
            <p style={{ color: C.muted, fontSize: 13.5, marginTop: 10, lineHeight: 1.6 }}>
              If an account exists for <b style={{ color: C.text }}>{email.trim()}</b>, we've sent a link to reset your password. It expires in 1 hour.
            </p>
            <button onClick={() => { setForgot(false); setSent(false); }} style={backBtn}>← Back to log in</button>
          </div>
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: 13.5, marginTop: 26, textAlign: "center", lineHeight: 1.6 }}>
              Enter your account email and we'll send you a link to reset your password.
            </p>
            <div style={{ marginTop: 18 }}>
              <Field icon={<Mail size={16} color={C.muted} />} placeholder="Email address" value={email} onChange={setEmail} type="email" />
            </div>
            <button onClick={forgotSubmit} disabled={busy} style={primaryBtn(busy)}>
              {busy ? "Sending…" : "Send reset link"} {!busy && <ArrowRight size={17} />}
            </button>
            <button onClick={() => setForgot(false)} style={backBtn}>← Back to log in</button>
          </>
        )
      ) : (
        <>
          {/* Mode switch */}
          <div style={{
            marginTop: 32, background: C.input, borderRadius: radius.md, padding: 4,
            display: "flex", border: `1px solid ${C.line}`,
          }}>
            {(["signup", "login"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: "10px 0", borderRadius: 11, border: "none", cursor: "pointer",
                background: mode === m ? gradients.brand : "transparent",
                color: mode === m ? "#fff" : C.muted, fontSize: 13, fontWeight: 700,
                fontFamily: font.sans, transition: "background 0.2s",
              }}>{m === "signup" ? "Sign Up" : "Log In"}</button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "signup" && (
              <Field icon={<UserIcon size={16} color={C.muted} />} placeholder="Full name" value={name} onChange={setName} />
            )}
            <Field icon={<Mail size={16} color={C.muted} />} placeholder="Email address" value={email} onChange={setEmail} type="email" />
            <Field icon={<Lock size={16} color={C.muted} />} placeholder="Password" value={pw} onChange={setPw} type="password" />
          </div>

          {mode === "login" && (
            <div style={{ textAlign: "right", marginTop: 10 }}>
              <button onClick={() => { setForgot(true); setSent(false); }} style={{ background: "none", border: "none", color: C.blue, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font.sans }}>Forgot password?</button>
            </div>
          )}

          <button onClick={submit} disabled={busy} style={{ ...primaryBtn(busy), marginTop: mode === "login" ? 16 : 24 }}>
            {busy ? "Please wait…" : (mode === "signup" ? "Create account" : "Log in")}
            {!busy && <ArrowRight size={17} />}
          </button>

          <p style={{ color: C.faint, fontSize: 11, textAlign: "center", marginTop: 18, lineHeight: 1.6 }}>
            By continuing you agree to DIGIRINGO's<br />Terms of Service and Privacy Policy.
          </p>
        </>
      )}
    </div>
  );
}

const primaryBtn = (busy: boolean): CSSProperties => ({
  marginTop: 24, padding: "15px", border: "none", borderRadius: radius.md, width: "100%",
  background: gradients.brand, color: "#fff", fontSize: 15, fontWeight: 800,
  cursor: busy ? "wait" : "pointer", fontFamily: font.sans, display: "flex",
  alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1,
  boxShadow: "0 8px 24px rgba(124,92,255,0.35)",
});
const backBtn: CSSProperties = {
  background: "none", border: "none", color: C.muted, fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: font.sans, marginTop: 18, display: "block", marginInline: "auto",
};

function Field({ icon, placeholder, value, onChange, type = "text" }: {
  icon: ReactNode; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>{icon}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} type={type}
        style={{
          width: "100%", padding: "14px 14px 14px 42px",
          background: C.input, border: `1px solid ${C.line}`, borderRadius: radius.md,
          color: C.text, fontSize: 14, outline: "none", fontFamily: font.sans,
        }}
      />
    </div>
  );
}
