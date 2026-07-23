import { useRef, useState } from "react";
import { X, Delete, Phone, ChevronDown, Check } from "lucide-react";
import { C, gradients, font } from "../core/theme";
import { useApp, useActiveNumber } from "../store/AppStore";

interface Props { onClose: () => void; onCall: (number: string) => void; }

const KEYS: Array<{ d: string; sub?: string }> = [
  { d: "1" }, { d: "2", sub: "ABC" }, { d: "3", sub: "DEF" },
  { d: "4", sub: "GHI" }, { d: "5", sub: "JKL" }, { d: "6", sub: "MNO" },
  { d: "7", sub: "PQRS" }, { d: "8", sub: "TUV" }, { d: "9", sub: "WXYZ" },
  { d: "*" }, { d: "0", sub: "+" }, { d: "#" },
];

/** Dialer — a phone keypad. Dials from the currently active number. */
export function DialerScreen({ onClose, onCall }: Props) {
  const { state, showToast, selectNumber } = useApp();
  const active = useActiveNumber();
  const [value, setValue] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Only numbers with voice capability can place calls.
  const callable = state.numbers.filter((n) => n.voice);

  // Keep only dialable characters (digits, +, *, #) — strips spaces/dashes/parens from pasted numbers.
  const sanitize = (raw: string) => raw.replace(/[^\d+*#]/g, "").slice(0, 18);
  const press = (d: string) => { setValue((v) => sanitize(v + d)); inputRef.current?.focus(); };
  const back = () => { setValue((v) => v.slice(0, -1)); inputRef.current?.focus(); };
  const call = () => {
    if (!value.trim()) { showToast("Enter a number to call", "error"); return; }
    onCall(value.trim());
  };

  return (
    <div style={{ background: C.bg, height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Top bar — the "calling from" label is a tappable number selector */}
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ width: 36 }} />
        <button onClick={() => setShowPicker(true)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center", fontFamily: font.sans }}>
          <p style={{ color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: 0.4 }}>CALLING FROM</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <p style={{ color: C.text, fontSize: 13, fontWeight: 700, fontFamily: font.mono }}>{active?.flag} {active?.number}</p>
            <ChevronDown size={14} color={C.muted} />
          </div>
        </button>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 11, background: C.input, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={17} color={C.muted} />
        </button>
      </div>

      {/* Display — a real input: type with the keyboard, paste with Ctrl+V or right-click */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, padding: "0 20px" }}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(sanitize(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && call()}
          autoFocus
          inputMode="none"
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter number"
          aria-label="Phone number"
          className="dg-dialer-input"
          style={{
            width: "100%", background: "transparent", border: "none", outline: "none",
            color: C.text, fontSize: 30, fontWeight: 700, fontFamily: font.mono,
            letterSpacing: 1, textAlign: "center", caretColor: C.green,
          }}
        />
      </div>

      {/* Keypad */}
      <div style={{ padding: "0 28px 8px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, justifyItems: "center", flexShrink: 0 }}>
        {KEYS.map((k) => (
          <button key={k.d} onClick={() => press(k.d)} style={{
            width: 70, height: 70, borderRadius: "50%", background: C.card, border: `1px solid ${C.line}`,
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
            fontFamily: font.sans,
          }}>
            <span style={{ color: C.text, fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{k.d}</span>
            {k.sub && <span style={{ color: C.faint, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{k.sub}</span>}
          </button>
        ))}
      </div>

      {/* Call row */}
      <div style={{ padding: "8px 28px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 28, flexShrink: 0, position: "relative" }}>
        <div style={{ width: 56 }} />
        <button onClick={call} style={{
          width: 68, height: 68, borderRadius: "50%", background: gradients.green, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px rgba(34,197,94,0.5)",
        }}>
          <Phone size={26} color="#fff" />
        </button>
        <button onClick={back} disabled={!value} style={{
          width: 56, height: 56, borderRadius: "50%", background: "transparent", border: "none",
          cursor: value ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", opacity: value ? 1 : 0.3,
        }}>
          <Delete size={24} color={C.muted} />
        </button>
      </div>

      {/* "Calling from" number picker */}
      {showPicker && (
        <div onClick={(e) => e.target === e.currentTarget && setShowPicker(false)} style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: "100%", background: C.card, borderRadius: "26px 26px 0 0", border: `1px solid ${C.line}`, maxHeight: "70%", overflowY: "auto", padding: "8px 0 24px" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 6px" }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line }} />
            </div>
            <p style={{ color: C.text, fontSize: 16, fontWeight: 800, padding: "8px 20px 12px" }}>Call from</p>
            {callable.map((n) => {
              const sel = n.id === active?.id;
              return (
                <button key={n.id} onClick={() => { selectNumber(n.id); setShowPicker(false); }} style={{
                  width: "100%", padding: "13px 20px", background: sel ? "rgba(124,92,255,0.12)" : "transparent",
                  border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: font.sans,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.input, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{n.flag}</div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{n.settings.label}</p>
                    <p style={{ color: C.muted, fontSize: 12, fontFamily: font.mono, marginTop: 2 }}>{n.number}</p>
                  </div>
                  {sel && <Check size={18} color={C.blue} />}
                </button>
              );
            })}
            <p style={{ color: C.faint, fontSize: 11, padding: "12px 20px 0", lineHeight: 1.5 }}>Only numbers with voice capability can place calls.</p>
          </div>
        </div>
      )}
    </div>
  );
}
