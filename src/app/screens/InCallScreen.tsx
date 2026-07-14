import { useEffect, useState, type CSSProperties } from "react";
import { Mic, MicOff, PhoneOff, Phone, Volume2, X } from "lucide-react";
import { font } from "../core/theme";
import { useApp } from "../store/AppStore";
import { startRingtone, stopRingtone } from "../services/ringtone";
import type { CallQuality } from "../services/voice";

/**
 * In-call overlay for the WebRTC softphone. Shows connecting / ringing / active
 * states, a live timer, mute + hang-up controls, and a connection-quality
 * indicator. Rendered over the whole app (phone frame or desktop) while a call
 * is in progress. The actual audio plays through the hidden <audio> at the root.
 */
export function InCallScreen({ desktop }: { desktop?: boolean }) {
  const { activeCall, answerCall, hangupCall, toggleCallMute, dismissCall } = useApp();
  const [now, setNow] = useState(Date.now());

  // Tick every second so the call timer updates while active.
  useEffect(() => {
    if (activeCall?.phase !== "active") return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [activeCall?.phase]);

  // Auto-dismiss the ended/failed screen so the overlay never stays stuck.
  useEffect(() => {
    if (activeCall?.phase !== "ended" && activeCall?.phase !== "failed") return;
    const t = setTimeout(() => dismissCall(), 3200);
    return () => clearTimeout(t);
  }, [activeCall?.phase, dismissCall]);

  // Ring out loud while an incoming call is ringing; stop once answered/ended.
  useEffect(() => {
    if (activeCall?.phase === "incoming") startRingtone();
    else stopRingtone();
    return () => stopRingtone();
  }, [activeCall?.phase]);

  if (!activeCall) return null;
  const { phase, contact, callerNumber, muted, quality, startedAt, error } = activeCall;

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const timer = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;

  const incoming = phase === "incoming";
  const statusText =
    incoming ? "Incoming call" :
    phase === "connecting" ? "Connecting…" :
    phase === "ringing" ? "Ringing…" :
    phase === "active" ? timer :
    phase === "failed" ? "Call failed" : "Call ended";

  const ended = phase === "ended" || phase === "failed";
  const ringing = phase === "ringing" || phase === "connecting" || incoming;

  return (
    <div style={{
      position: desktop ? "fixed" : "absolute", inset: 0, zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: desktop ? 24 : 0,
      // On desktop the call is a FLOATING card — the wrapper doesn't capture
      // clicks, so the rest of the dashboard (and mobile preview) stay usable.
      pointerEvents: desktop ? "none" : "auto",
    }}>
      <div style={{
        background: "linear-gradient(165deg,#0b1226 0%,#171034 55%,#0a1330 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
        fontFamily: font.sans, pointerEvents: "auto",
        width: desktop ? "min(400px, 94vw)" : "100%",
        height: desktop ? "min(600px, 92vh)" : "100%",
        borderRadius: desktop ? 28 : 0,
        border: desktop ? "1px solid rgba(255,255,255,0.08)" : "none",
        boxShadow: desktop ? "0 40px 120px rgba(0,0,0,0.6)" : "none",
        padding: desktop ? "44px 28px 36px" : "56px 28px 40px",
      }}>
      {/* Caller info */}
      <div style={{ textAlign: "center", width: "100%" }}>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" }}>
          {incoming ? "Incoming" : phase === "active" ? "On call" : phase === "ringing" ? "Calling" : phase === "connecting" ? "Dialing" : "Call"}
        </p>
        <div style={{
          width: 108, height: 108, borderRadius: "50%", margin: "26px auto 20px",
          background: "linear-gradient(135deg,#4f8ef7,#a855f7)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 44, boxShadow: "0 16px 48px rgba(79,142,247,0.45)",
          animation: ringing ? "dgpulse 1.6s ease-in-out infinite" : "none",
        }}>📞</div>
        <p style={{ color: "#fff", fontSize: 26, fontWeight: 800, fontFamily: font.mono, letterSpacing: 0.5, wordBreak: "break-all" }}>{contact}</p>
        <p style={{ color: phase === "failed" ? "#fca5a5" : "rgba(255,255,255,0.7)", fontSize: 16, fontWeight: 600, marginTop: 10, fontFamily: font.mono }}>{statusText}</p>
        {callerNumber && !ended && (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5, marginTop: 10 }}>via {callerNumber}</p>
        )}
        {phase === "active" && <QualityPill quality={quality} />}
        {error && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 14, lineHeight: 1.5, maxWidth: 320, marginInline: "auto" }}>{error}</p>}
      </div>

      {/* Controls */}
      {ended ? (
        <button onClick={dismissCall} style={{
          padding: "15px 40px", borderRadius: 16, border: "none", cursor: "pointer",
          background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: font.sans,
          display: "flex", alignItems: "center", gap: 8,
        }}><X size={18} /> Close</button>
      ) : incoming ? (
        <div style={{ display: "flex", gap: 72, justifyContent: "center", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <button onClick={hangupCall} title="Decline" style={{
              width: 72, height: 72, borderRadius: "50%", background: "#ef4444", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 32px rgba(239,68,68,0.5)",
            }}><PhoneOff size={28} color="#fff" /></button>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>Decline</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <button onClick={answerCall} title="Accept" className="glow-dot" style={{
              width: 72, height: 72, borderRadius: "50%", background: "#22c55e", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Phone size={28} color="#fff" /></button>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>Accept</span>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, width: "100%" }}>
          {/* secondary controls */}
          <div style={{ display: "flex", gap: 34, justifyContent: "center" }}>
            <CircleBtn label={muted ? "Unmute" : "Mute"} active={muted} onClick={toggleCallMute}>
              {muted ? <MicOff size={24} color="#0b1226" /> : <Mic size={24} color="#fff" />}
            </CircleBtn>
            <CircleBtn label="Speaker" active={false} onClick={() => {}}>
              <Volume2 size={24} color="#fff" />
            </CircleBtn>
          </div>
          {/* hang up */}
          <button onClick={hangupCall} title="Hang up" style={{
            width: 72, height: 72, borderRadius: "50%", background: "#ef4444", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 32px rgba(239,68,68,0.5)",
          }}>
            <PhoneOff size={28} color="#fff" />
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

const QUALITY: Record<CallQuality, { label: string; color: string; bars: number }> = {
  excellent: { label: "HD Voice", color: "#22c55e", bars: 3 },
  good:      { label: "Good",     color: "#22c55e", bars: 3 },
  fair:      { label: "Fair",     color: "#f59e0b", bars: 2 },
  poor:      { label: "Weak signal", color: "#ef4444", bars: 1 },
  unknown:   { label: "Measuring…", color: "rgba(255,255,255,0.5)", bars: 0 },
};

function QualityPill({ quality }: { quality: CallQuality }) {
  const q = QUALITY[quality] ?? QUALITY.unknown;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
        {[6, 10, 14].map((h, i) => (
          <span key={i} style={{ width: 3.5, height: h, borderRadius: 1.5, background: i < q.bars ? q.color : "rgba(255,255,255,0.2)" }} />
        ))}
      </span>
      <span style={{ color: q.color, fontSize: 12, fontWeight: 700 }}>{q.label}</span>
    </div>
  );
}

function CircleBtn({ children, label, active, onClick }: { children: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button onClick={onClick} style={{
        width: 62, height: 62, borderRadius: "50%", cursor: "pointer",
        background: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.14)", border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {children}
      </button>
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
