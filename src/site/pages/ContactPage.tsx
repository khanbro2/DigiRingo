import { useState, type FormEvent } from "react";
import { Mail, MessageSquare, MapPin, Send, Check } from "lucide-react";
import { Reveal } from "../components/Reveal";

const CHANNELS = [
  { icon: Mail, title: "Email us", body: "support@digiringo.app", sub: "We reply within 24 hours." },
  { icon: MessageSquare, title: "Live chat", body: "In-app support", sub: "Available right inside DIGIRINGO." },
  { icon: MapPin, title: "Where we are", body: "Remote-first", sub: "Serving customers worldwide 🌍" },
];

export function ContactPage() {
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <>
      <section className="dg-section" style={{ paddingTop: "calc(var(--nav-h) + clamp(40px,8vw,90px))", paddingBottom: 30 }}>
        <div className="dg-wrap dg-center">
          <Reveal>
            <span className="dg-eyebrow">Contact</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="dg-h1" style={{ marginTop: 22, fontSize: "clamp(36px,6vw,72px)" }}>
              Let’s <span className="dg-grad-text">talk</span>.
            </h1>
          </Reveal>
          <Reveal delay={150}>
            <p className="dg-lead" style={{ marginTop: 22, maxWidth: 540, margin: "22px auto 0" }}>
              Questions about numbers, pricing or your account? Drop us a line and a real human will
              get back to you.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="dg-section" style={{ paddingTop: 10 }}>
        <div className="dg-wrap">
          <div className="dg-showcase" style={{ gridTemplateColumns: "0.9fr 1.1fr", alignItems: "start" }}>
            {/* channels */}
            <Reveal>
              <div style={{ display: "grid", gap: 16 }}>
                {CHANNELS.map((c) => (
                  <div className="dg-card" key={c.title} style={{ padding: 24, display: "flex", gap: 16, alignItems: "center" }}>
                    <div className="dg-card-icon" style={{ marginBottom: 0, flexShrink: 0 }}>
                      <c.icon size={21} />
                    </div>
                    <div>
                      <h3 className="dg-h3" style={{ fontSize: 17 }}>{c.title}</h3>
                      <p style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{c.body}</p>
                      <p className="dg-muted" style={{ fontSize: 13, marginTop: 2 }}>{c.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* form */}
            <Reveal delay={120}>
              <div className="dg-card" style={{ padding: "clamp(24px,4vw,40px)" }}>
                {sent ? (
                  <div className="dg-center" style={{ padding: "40px 10px" }}>
                    <div className="dg-card-icon" style={{ margin: "0 auto 18px", width: 60, height: 60, color: "var(--green)", background: "rgba(34,197,94,0.12)" }}>
                      <Check size={28} />
                    </div>
                    <h3 className="dg-h3">Message sent!</h3>
                    <p className="dg-muted" style={{ marginTop: 10, fontSize: 14.5 }}>
                      Thanks for reaching out. We’ll get back to you at the email you provided shortly.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={onSubmit}>
                    <h3 className="dg-h3" style={{ marginBottom: 22 }}>Send us a message</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div className="dg-field">
                        <label className="dg-label">First name</label>
                        <input className="dg-input" placeholder="Jane" required />
                      </div>
                      <div className="dg-field">
                        <label className="dg-label">Last name</label>
                        <input className="dg-input" placeholder="Doe" required />
                      </div>
                    </div>
                    <div className="dg-field">
                      <label className="dg-label">Email</label>
                      <input className="dg-input" type="email" placeholder="you@example.com" required />
                    </div>
                    <div className="dg-field">
                      <label className="dg-label">Subject</label>
                      <input className="dg-input" placeholder="How can we help?" required />
                    </div>
                    <div className="dg-field">
                      <label className="dg-label">Message</label>
                      <textarea
                        className="dg-input"
                        placeholder="Tell us a bit more…"
                        required
                        style={{ height: 130, padding: "13px 16px", resize: "vertical", lineHeight: 1.5 }}
                      />
                    </div>
                    <button type="submit" className="dg-btn dg-btn-primary dg-btn-lg" style={{ width: "100%", marginTop: 6 }}>
                      Send message <Send size={16} />
                    </button>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
