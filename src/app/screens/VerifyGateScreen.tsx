import { useState, type CSSProperties } from "react";
import { Mail, RefreshCw, ArrowRight } from "lucide-react";
import { C, gradients, font, radius } from "../core/theme";
import { useApp } from "../store/AppStore";

/**
 * Hard email-verification gate. Shown full-screen after login when the account's
 * email isn't confirmed yet — the app stays locked until the user clicks the
 * verification link and taps "I've verified". Resend + logout available here.
 */
export function VerifyGateScreen() {
  const { state, resendVerification, refreshUser, logout, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const resend = async () => { setBusy(true); await resendVerification(); setBusy(false); };
  const check = async () => {
    setChecking(true);
    await refreshUser();
    setChecking(false);
    // If still unverified after the refresh, the gate stays — nudge the user.
    if (state.user && state.user.emailVerified === false) {
      showToast("Not verified yet — tap the link in your email first", "error");
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100%", display: "flex", flexDirection: "column", padding: "0 24px", textAlign: "center" }}>
      <div style={{ paddingTop: 72 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22, margin: "0 auto 22px",
          background: "rgba(124,92,255,0.14)", border: "1px solid rgba(124,92,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Mail size={32} color={C.blue} />
        </div>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800 }}>Verify your email</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 12, lineHeight: 1.6, maxWidth: 320, marginInline: "auto" }}>
          We sent a verification link to <b style={{ color: C.text }}>{state.user?.email}</b>. Open it to
          activate your account, then come back and tap the button below.
        </p>
      </div>

      <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={check} disabled={checking} style={{ ...primaryBtn, opacity: checking ? 0.7 : 1 }}>
          {checking ? "Checking…" : <>I've verified — continue <ArrowRight size={17} /></>}
        </button>
        <button onClick={resend} disabled={busy} style={secondaryBtn}>
          <RefreshCw size={15} /> {busy ? "Sending…" : "Resend verification email"}
        </button>
      </div>

      <p style={{ color: C.faint, fontSize: 12, marginTop: 26, lineHeight: 1.6 }}>
        Wrong email or didn't sign up?{" "}
        <button onClick={logout} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font.sans, padding: 0 }}>Log out</button>
      </p>
      <p style={{ color: C.faint, fontSize: 11.5, marginTop: 14, lineHeight: 1.6 }}>
        Check your spam folder if you don't see it within a minute.
      </p>
    </div>
  );
}

const primaryBtn: CSSProperties = {
  padding: "15px", border: "none", borderRadius: radius.md, width: "100%",
  background: gradients.brand, color: "#fff", fontSize: 15, fontWeight: 800,
  cursor: "pointer", fontFamily: font.sans, display: "flex",
  alignItems: "center", justifyContent: "center", gap: 8,
  boxShadow: "0 8px 24px rgba(124,92,255,0.35)",
};
const secondaryBtn: CSSProperties = {
  padding: "13px", border: `1px solid ${C.line}`, borderRadius: radius.md, width: "100%",
  background: C.input, color: C.text, fontSize: 14, fontWeight: 700,
  cursor: "pointer", fontFamily: font.sans, display: "flex",
  alignItems: "center", justifyContent: "center", gap: 8,
};
