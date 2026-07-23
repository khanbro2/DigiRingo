import { AppProvider, useApp } from "./store/AppStore";
import { colors as C, THEME_VARS } from "./core/theme";
import { ThemeProvider } from "./core/theme-context";
import { PhoneFrame } from "./components/PhoneFrame";
import { PhoneGate } from "./MobileShell";
import { DashboardShell } from "./DashboardShell";
import { isNative } from "./native";

/**
 * True on REAL phones/tablets only — the device's primary pointer is a finger,
 * or a mobile user-agent. Window WIDTH deliberately plays no part: shrinking a
 * laptop window must never flip the web app into the phone UI (that lives
 * behind the dashboard's "Mobile preview" toolbar button instead). Touch-screen
 * laptops stay desktop too — their primary pointer is the trackpad/mouse.
 */
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
}

/**
 * Responsive root. Signed-in users on a wide screen get the full DASHBOARD
 * (sidebar + all areas + a live mobile preview). Everyone else — small screens,
 * and the login / email-verification flow — gets the phone experience. Both are
 * driven by the same store, so state stays perfectly in sync.
 */
function Root() {
  const { state } = useApp();
  const authed = !!state.user && state.user.emailVerified !== false;

  // Desktops/laptops ALWAYS get the dashboard once signed in — never the phone
  // UI, no matter how small the window is. Phones/tablets and the native app
  // get the phone experience.
  if (authed && !isNative() && !isMobileDevice()) return <DashboardShell />;

  // Native (Capacitor) app: fill the real device screen — NO phone-mockup frame
  // or fake status bar (that chrome is only for the web/desktop preview, and on a
  // real phone it looks like a phone-inside-a-phone). Safe-area insets keep the
  // content clear of the system status bar / gesture bar.
  if (isNative()) {
    return (
      <div style={{
        width: "100vw", height: "100dvh", display: "flex", flexDirection: "column",
        overflow: "hidden", background: C.bg,
        paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        <PhoneGate />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.shell, padding: "20px 0", fontFamily: "'Inter', sans-serif" }}>
      <PhoneFrame><PhoneGate /></PhoneFrame>
    </div>
  );
}

export default function App() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        ${THEME_VARS}
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.shell}; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; -ms-overflow-style: none; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes glowPulse { 0%,100% { box-shadow: 0 0 6px 2px rgba(34,197,94,0.7); } 50% { box-shadow: 0 0 12px 4px rgba(34,197,94,0.3); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dgpulse { 0%,100% { transform: scale(1); box-shadow: 0 16px 48px rgba(124,92,255,0.45); } 50% { transform: scale(1.06); box-shadow: 0 20px 60px rgba(168,85,247,0.5); } }
        .tab-screen { animation: fadeIn 0.22s ease; }
        .glow-dot { animation: glowPulse 2s ease-in-out infinite; }
        .spin { animation: spin 0.7s linear infinite; }
      `}</style>

      {/* Remote call audio — the Telnyx WebRTC SDK attaches the far-end stream
          here. Must exist in the DOM whenever a call is placed. */}
      <audio id="dg-remote-audio" autoPlay style={{ display: "none" }} />

      <ThemeProvider>
        <AppProvider>
          <Root />
        </AppProvider>
      </ThemeProvider>
    </>
  );
}
