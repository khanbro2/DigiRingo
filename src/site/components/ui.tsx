import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Link } from "../router";

/** DIGIRINGO wordmark + gradient glyph. */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <Link to="/" className="dg-logo">
      <span className="dg-logo-mark" aria-hidden>D</span>
      <span style={{ fontSize: size }}>DIGIRINGO</span>
    </Link>
  );
}

/** Pill button rendered as a hash link. */
export function LinkButton({
  to,
  children,
  variant = "primary",
  size,
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  size?: "sm" | "lg";
}) {
  const cls = ["dg-btn", `dg-btn-${variant}`, size ? `dg-btn-${size}` : ""].join(" ");
  return (
    <motion.span
      style={{ display: "inline-flex" }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Link to={to} className={cls}>
        {children}
      </Link>
    </motion.span>
  );
}

/** Eyebrow label + heading + lead, the standard section intro. */
export function SectionIntro({
  eyebrow,
  title,
  lead,
  center = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
}) {
  return (
    <div style={{ textAlign: center ? "center" : "left", maxWidth: center ? 760 : 640, margin: center ? "0 auto" : 0 }}>
      {eyebrow && <span className="dg-eyebrow">{eyebrow}</span>}
      <h2 className="dg-h2" style={{ marginTop: eyebrow ? 22 : 0 }}>
        {title}
      </h2>
      {lead && (
        <p className="dg-lead" style={{ marginTop: 18, marginLeft: center ? "auto" : 0, marginRight: center ? "auto" : 0, maxWidth: 620 }}>
          {lead}
        </p>
      )}
    </div>
  );
}
