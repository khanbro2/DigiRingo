import { Twitter, Instagram, Linkedin, Globe } from "lucide-react";
import { Link } from "../router";
import { Logo } from "./ui";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Pricing", to: "/pricing" },
      { label: "Get started", to: "/signup" },
      { label: "Log in", to: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", to: "/contact" },
      { label: "About", to: "/" },
      { label: "Careers", to: "/" },
      { label: "Blog", to: "/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Trust center", to: "/features" },
      { label: "Status", to: "/" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="dg-footer">
      <div className="dg-wrap">
        <div className="dg-footer-grid">
          <div>
            <Logo />
            <p className="dg-muted" style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 16, maxWidth: 300 }}>
              A second phone number for a borderless world. Call, text and manage local numbers from
              8+ countries — all in one app.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              {[Twitter, Instagram, Linkedin, Globe].map((Icon, i) => (
                <a
                  key={i}
                  href="#/"
                  aria-label="social"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--line)",
                    color: "var(--muted)",
                  }}
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <h5>{c.title}</h5>
              {c.links.map((l, i) => (
                <Link key={i} to={l.to}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="dg-footer-bottom">
          <span>© 2026 DIGIRINGO. All rights reserved.</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Made for a borderless world 🌍</span>
        </div>
      </div>
    </footer>
  );
}
