import type { ReactNode } from "react";
import { Star, Check } from "lucide-react";
import { Logo } from "./ui";
import { Link } from "../router";

/**
 * Split-screen auth layout: form on the left, a brand-tinted testimonial /
 * trust panel on the right (hidden on mobile). The actual authentication lives
 * in the DIGIRINGO app — these forms send the user into it at "/".
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  aside,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="dg-auth">
      <div className="dg-auth-panel">
        <div style={{ maxWidth: 400, width: "100%", margin: "0 auto" }}>
          <div style={{ marginBottom: 40 }}>
            <Logo />
          </div>
          <h1 className="dg-h2" style={{ fontSize: "clamp(28px,4vw,40px)" }}>{title}</h1>
          <p className="dg-muted" style={{ marginTop: 12, fontSize: 15.5 }}>{subtitle}</p>
          <div style={{ marginTop: 30 }}>{children}</div>
          <p className="dg-muted dg-center" style={{ marginTop: 28, fontSize: 14 }}>{footer}</p>
        </div>
      </div>

      <aside className="dg-auth-aside">
        {aside ?? <DefaultAside />}
      </aside>
    </div>
  );
}

function DefaultAside() {
  return (
    <div style={{ maxWidth: 420, position: "relative", zIndex: 1 }}>
      <span className="dg-eyebrow">
        <Star size={13} fill="currentColor" /> Trusted worldwide
      </span>
      <h2 className="dg-h2" style={{ marginTop: 24, fontSize: "clamp(26px,3vw,38px)" }}>
        Your number. <span className="dg-grad-text">Anywhere on Earth.</span>
      </h2>
      <p className="dg-lead" style={{ marginTop: 18, fontSize: 16 }}>
        Join people in dozens of countries who run their calls and texts through one simple,
        borderless app.
      </p>
      <div style={{ marginTop: 30, display: "grid", gap: 14 }}>
        {[
          "Real local numbers in 8+ countries",
          "No SIM, no contract, no second phone",
          "Live in under 60 seconds",
        ].map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 15 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(34,197,94,0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Check size={15} color="var(--green)" />
            </span>
            {t}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 36, padding: 20, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)" }}>
        <p style={{ fontSize: 15, lineHeight: 1.6 }}>
          “I keep a US line for work and a UK line for family — all in one app. DIGIRINGO just
          replaced two phones.”
        </p>
        <p className="dg-muted" style={{ fontSize: 13, marginTop: 12 }}>— A very happy customer</p>
      </div>
      <p style={{ marginTop: 30, fontSize: 13.5 }}>
        <Link to="/" className="dg-muted">← Back to home</Link>
      </p>
    </div>
  );
}
