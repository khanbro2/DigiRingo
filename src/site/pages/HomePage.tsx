import {
  Hash,
  MessageSquare,
  PhoneCall,
  Wallet,
  ShieldCheck,
  Globe,
  ArrowRight,
  Star,
  Check,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { PhoneFrame } from "../components/PhoneFrame";
import { HeroPhones } from "../components/HeroPhones";
import { PixelRipple } from "../components/PixelRipple";
import { CountUpStat } from "../components/CountUpStat";
import { LinkButton, SectionIntro } from "../components/ui";
import { Link } from "../router";
import { COUNTRIES, STATS, FEATURES, STEPS, SHOTS } from "../data";

const ICONS: Record<string, typeof Hash> = { Hash, MessageSquare, PhoneCall, Wallet, ShieldCheck, Globe };

export function HomePage() {
  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section
        className="dg-hero-ripple"
        style={{
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
          paddingTop: "calc(var(--nav-h) + clamp(72px, 12vw, 150px))",
          paddingBottom: "clamp(56px, 9vw, 120px)",
        }}
      >
        <PixelRipple />
        <div className="dg-wrap" style={{ position: "relative", zIndex: 1 }}>
          <Reveal>
            <span className="dg-eyebrow">
              <Star size={13} fill="currentColor" /> Your number. Anywhere on Earth.
            </span>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="dg-h1" style={{ marginTop: 26, maxWidth: 1000, marginLeft: "auto", marginRight: "auto" }}>
              Borderless.<br />
              <span className="dg-grad-text">Effortless.</span>
            </h1>
          </Reveal>
          <Reveal delay={170}>
            <p className="dg-lead" style={{ marginTop: 24, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
              One app for every number — call, text and manage real local lines in 8+ countries.
              No SIM, no contract, no second phone.
            </p>
          </Reveal>
          <Reveal delay={250}>
            <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap", justifyContent: "center" }}>
              <LinkButton to="/signup" variant="primary" size="lg">
                Get started free <ArrowRight size={17} />
              </LinkButton>
              <LinkButton to="/pricing" variant="ghost" size="lg">
                See pricing
              </LinkButton>
            </div>
          </Reveal>
          <Reveal delay={330}>
            <div style={{ display: "flex", gap: 22, marginTop: 30, flexWrap: "wrap", justifyContent: "center" }}>
              {["No SIM required", "Cancel anytime", "Live in 60 seconds"].map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--muted)" }}>
                  <Check size={15} color="var(--green)" /> {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------- COUNTRY MARQUEE */}
      <section style={{ padding: "8px 0 36px" }}>
        <div className="dg-wrap">
          <Reveal>
            <p className="dg-center dg-muted" style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 22 }}>
              Local numbers available in
            </p>
          </Reveal>
        </div>
        <div className="dg-marquee">
          <div className="dg-marquee-track">
            {[...COUNTRIES, ...COUNTRIES].map((c, i) => (
              <span className="dg-flagchip" key={i}>
                <span className="flag">{c.flag}</span> {c.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ PRODUCT PREVIEW */}
      <section className="dg-section" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div className="dg-wrap">
          <HeroPhones />
        </div>
      </section>

      {/* -------------------------------------------------------------- STATS */}
      <section className="dg-section" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <div className="dg-wrap">
          <div className="dg-grid dg-grid-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="dg-card dg-center" style={{ padding: "30px 18px" }}>
                  <CountUpStat value={s.num} className="dg-stat-num grad" />
                  <p className="dg-muted" style={{ fontSize: 13.5, marginTop: 8 }}>{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- FEATURES */}
      <section className="dg-section" id="features">
        <div className="dg-wrap">
          <Reveal>
            <SectionIntro
              eyebrow="Everything you need"
              title={<>One app. <span className="dg-grad-text">Every number you’ll ever need.</span></>}
              lead="From your first local line to a full business presence across continents — DIGIRINGO keeps it effortless."
            />
          </Reveal>
          <div className="dg-grid dg-grid-3" style={{ marginTop: 56 }}>
            {FEATURES.map((f, i) => {
              const Icon = ICONS[f.icon] ?? Hash;
              return (
                <Reveal key={f.title} delay={(i % 3) * 90}>
                  <div className="dg-card" style={{ height: "100%" }}>
                    <div className="dg-card-icon"><Icon size={22} /></div>
                    <h3 className="dg-h3">{f.title}</h3>
                    <p className="dg-muted" style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 10 }}>{f.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- SHOWCASE (REVault-style) */}
      <Showcase
        eyebrow="Buy in seconds"
        title={<>Pick a number. <span className="dg-grad-text">It’s yours instantly.</span></>}
        body="Browse live local and mobile numbers across 8+ countries. Filter by area code, see what supports SMS, and own it with a single tap — your wallet handles the rest."
        points={["Live inventory from real carriers", "Local & mobile options explained", "Pay from your prepaid wallet"]}
        shot={SHOTS.buy}
        caption="Buy a number"
      />
      <Showcase
        reverse
        eyebrow="Messaging"
        title={<>Texts, organised the <span className="dg-grad-text">way you think.</span></>}
        body="Every number gets its own inbox with threaded conversations and delivery receipts. Switch between lines from a tidy drawer — work, family and side-project, never tangled."
        points={["Per-number inboxes", "Delivery & read receipts", "Snippets for quick replies"]}
        shot={SHOTS.chat}
        caption="Inbox"
      />
      <Showcase
        eyebrow="Calling"
        title={<>Dial out from <span className="dg-grad-text">any of your numbers.</span></>}
        body="A full keypad with a ‘calling from’ selector lets you place HD calls on whichever line fits the moment. Your call log keeps a clean record of everything."
        points={["HD voice over the internet", "Choose the line you call from", "Searchable call history"]}
        shot={SHOTS.dialer}
        caption="Dialer"
      />

      {/* ----------------------------------------------------------- HOW IT WORKS */}
      <section className="dg-section">
        <div className="dg-wrap">
          <Reveal>
            <SectionIntro
              eyebrow="How it works"
              title="Live in four simple steps"
              lead="From download to your first text in under a minute."
            />
          </Reveal>
          <div className="dg-grid dg-grid-4" style={{ marginTop: 56 }}>
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="dg-card" style={{ height: "100%" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--blue)", fontWeight: 600 }}>{s.n}</div>
                  <h3 className="dg-h3" style={{ marginTop: 14, fontSize: 19 }}>{s.title}</h3>
                  <p className="dg-muted" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- CTA BAND */}
      <section className="dg-section" style={{ paddingTop: 20 }}>
        <div className="dg-wrap">
          <Reveal>
            <div className="dg-cta-band">
              <h2 className="dg-h2" style={{ maxWidth: 720, margin: "0 auto" }}>
                Ready to claim your <span className="dg-grad-text">borderless number?</span>
              </h2>
              <p className="dg-lead" style={{ margin: "20px auto 0", maxWidth: 520 }}>
                Join DIGIRINGO today. Your first number is minutes away.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
                <LinkButton to="/signup" variant="primary" size="lg">
                  Get started free <ArrowRight size={17} />
                </LinkButton>
                <Link to="/contact" className="dg-btn dg-btn-ghost dg-btn-lg">Talk to us</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/** Alternating image + copy block — the detailed product story sections. */
function Showcase({
  eyebrow,
  title,
  body,
  points,
  shot,
  caption,
  reverse = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  shot: string;
  caption: string;
  reverse?: boolean;
}) {
  return (
    <section className="dg-section" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="dg-wrap">
        <div className="dg-showcase">
          <Reveal style={{ order: reverse ? 2 : 1 }}>
            <span className="dg-eyebrow">{eyebrow}</span>
            <h2 className="dg-h2" style={{ marginTop: 20, fontSize: "clamp(28px,3.6vw,44px)" }}>{title}</h2>
            <p className="dg-lead" style={{ marginTop: 18, fontSize: 17 }}>{body}</p>
            <div style={{ marginTop: 22 }}>
              {points.map((p) => (
                <div className="dg-feat-li" key={p} style={{ color: "var(--text)" }}>
                  <Check size={18} /> {p}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120} style={{ order: reverse ? 1 : 2, display: "flex", justifyContent: "center" }}>
            <PhoneFrame src={shot} caption={caption} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
