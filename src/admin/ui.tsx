import type { ReactNode, CSSProperties } from "react";
import { colors as C, gradients, radius, font } from "../app/core/theme";

/** Control Hub shared theme + primitives (dark, full-width web layout). */
export const A = {
  shell: "#070a12",
  panel: "#0e1320",
  panelAlt: "#111828",
  line: "rgba(255,255,255,0.07)",
  lineSoft: "rgba(255,255,255,0.045)",
  text: C.text,
  muted: C.muted,
  faint: C.faint,
  blue: C.blue, purple: C.purple, green: C.green, amber: C.amber, red: C.red,
  sidebar: 248,
};

export { gradients, radius, font };

export function Card({ children, style, pad = 20 }: { children: ReactNode; style?: CSSProperties; pad?: number }) {
  return (
    <div style={{ background: A.panel, border: `1px solid ${A.line}`, borderRadius: 16, padding: pad, ...style }}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, delta, icon, accent }: { label: string; value: string; delta?: string; icon: ReactNode; accent: string }) {
  const up = delta?.startsWith("+");
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        {delta && <span style={{ fontSize: 12, fontWeight: 700, color: up ? A.green : A.red }}>{delta}</span>}
      </div>
      <p style={{ color: A.text, fontSize: 26, fontWeight: 800, marginTop: 14, lineHeight: 1 }}>{value}</p>
      <p style={{ color: A.muted, fontSize: 13, marginTop: 6 }}>{label}</p>
    </Card>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone: "green" | "amber" | "red" | "blue" | "purple" | "muted" }) {
  const map = {
    green: [A.green, "rgba(34,197,94,0.14)"], amber: [A.amber, "rgba(245,158,11,0.14)"],
    red: [A.red, "rgba(239,68,68,0.14)"], blue: [A.blue, "rgba(124,92,255,0.14)"],
    purple: [A.purple, "rgba(155,111,247,0.14)"],
    muted: [A.muted, "rgba(136,146,170,0.14)"],
  } as const;
  const [color, bg] = map[tone];
  return <span style={{ color, background: bg, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{children}</span>;
}

export function Button({ children, onClick, variant = "primary", size = "md" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  const base: CSSProperties = {
    border: "none", cursor: "pointer", fontFamily: font.sans, fontWeight: 700, borderRadius: 11,
    padding: size === "sm" ? "7px 12px" : "10px 16px", fontSize: size === "sm" ? 12.5 : 13.5,
    display: "inline-flex", alignItems: "center", gap: 7,
  };
  const v = variant === "primary" ? { background: gradients.brand, color: "#fff" }
    : variant === "danger" ? { background: "rgba(239,68,68,0.12)", color: A.red, border: `1px solid rgba(239,68,68,0.25)` }
    : { background: A.panelAlt, color: A.text, border: `1px solid ${A.line}` };
  return <button onClick={onClick} style={{ ...base, ...v }}>{children}</button>;
}

/* Table primitives */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font.sans }}>
        <thead>
          <tr>{head.map((h) => (
            <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: A.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", borderBottom: `1px solid ${A.line}` }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Td({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <td style={{ padding: "13px 14px", color: A.text, fontSize: 13.5, borderBottom: `1px solid ${A.lineSoft}`, ...style }}>{children}</td>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ color: A.text, fontSize: 24, fontWeight: 800 }}>{title}</h1>
        {subtitle && <p style={{ color: A.muted, fontSize: 13.5, marginTop: 4 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 440, background: A.panel, border: `1px solid ${A.line}`, borderRadius: 16, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <p style={{ color: A.text, fontSize: 17, fontWeight: 800, marginBottom: 16 }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

export function Input({ label, value, onChange, placeholder, type = "text", mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ color: A.muted, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>{label}</p>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type}
        style={{ width: "100%", padding: "11px 14px", background: A.panelAlt, border: `1px solid ${A.line}`, borderRadius: 11, color: A.text, fontSize: 14, outline: "none", fontFamily: mono ? "monospace" : "inherit" }} />
    </div>
  );
}

/** A masked secret display with a "Replace" affordance. */
export function SecretField({ status, last4, onReplace }: { status: "set" | "missing"; last4?: string; onReplace: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {status === "set"
        ? <span style={{ fontFamily: "monospace", color: A.text, fontSize: 13 }}>•••• •••• {last4}</span>
        : <Badge tone="amber">Not set</Badge>}
      <Button size="sm" variant="ghost" onClick={onReplace}>{status === "set" ? "Replace" : "Add key"}</Button>
    </div>
  );
}
