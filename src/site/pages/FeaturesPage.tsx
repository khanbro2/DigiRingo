import {
  Hash,
  MessageSquare,
  PhoneCall,
  Wallet,
  ShieldCheck,
  Globe,
  ArrowRight,
  Check,
  Bell,
  Users,
  Layers,
  Lock,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { PhoneFrame } from "../components/PhoneFrame";
import { LinkButton, SectionIntro } from "../components/ui";
import { FEATURES, SHOTS } from "../data";

const ICONS: Record<string, typeof Hash> = { Hash, MessageSquare, PhoneCall, Wallet, ShieldCheck, Globe };

const EXTRA = [
  { icon: Bell, title: "Activity center", body: "A single notifications feed for every text, call and account event — nothing slips by." },
  { icon: Users, title: "Contacts & snippets", body: "Save contacts and reusable message snippets for replies that take one tap." },
  { icon: Layers, title: "Per-number settings", body: "Tune voicemail, forwarding and messaging for each line independently." },
  { icon: Lock, title: "Private & secure", body: "Your secrets never touch the browser. Payments and keys stay server-side, encrypted." },
];

export function FeaturesPage() {
  return (
    <>
      {/* hero */}
      <section className="dg-section" style={{ paddingTop: "calc(var(--nav-h) + clamp(40px,8vw,90px))", paddingBottom: 40 }}>
        <div className="dg-wrap dg-center">
          <Reveal>
            <span className="dg-eyebrow">Features</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="dg-h1" style={{ marginTop: 22, fontSize: "clamp(36px,6vw,72px)" }}>
              Built to feel <span className="dg-grad-text">effortless</span>.
            </h1>
          </Reveal>
          <Reveal delay={150}>
            <p className="dg-lead" style={{ marginTop: 22, maxWidth: 600, margin: "22px auto 0" }}>
              Every detail of DIGIRINGO is designed so a second phone number feels as natural as the
              one you were born with. Here’s what’s inside.
            </p>
          </Reveal>
        </div>
      </section>

      {/* core features */}
      <section className="dg-section" style={{ paddingTop: 20 }}>
        <div className="dg-wrap">
          <div className="dg-grid dg-grid-3">
            {FEATURES.map((f, i) => {
              const Icon = ICONS[f.icon] ?? Hash;
              return (
                <Reveal key={f.title} delay={(i % 3) * 80}>
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

      {/* split highlight */}
      <section className="dg-section" style={{ paddingBottom: 40 }}>
        <div className="dg-wrap">
          <div className="dg-showcase">
            <Reveal style={{ display: "flex", justifyContent: "center" }}>
              <PhoneFrame src={SHOTS.wallet} caption="Wallet" />
            </Reveal>
            <Reveal delay={120}>
              <span className="dg-eyebrow">Prepaid wallet</span>
              <h2 className="dg-h2" style={{ marginTop: 20, fontSize: "clamp(28px,3.6vw,44px)" }}>
                Pay your way, <span className="dg-grad-text">see every cent.</span>
              </h2>
              <p className="dg-lead" style={{ marginTop: 18, fontSize: 17 }}>
                Top up securely with PayPal and spend as you go. Numbers, calls and texts draw from
                one balance, and an itemised history shows exactly where it went — no surprise bills.
              </p>
              <div style={{ marginTop: 22 }}>
                {["Secure PayPal top-ups", "Itemised transaction history", "Spend only on what you use"].map((p) => (
                  <div className="dg-feat-li" key={p} style={{ color: "var(--text)" }}>
                    <Check size={18} /> {p}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* extra features */}
      <section className="dg-section" style={{ paddingTop: 20 }}>
        <div className="dg-wrap">
          <Reveal>
            <SectionIntro
              eyebrow="And more"
              title="The little things that add up"
              lead="Thoughtful touches that make DIGIRINGO a joy to use every day."
            />
          </Reveal>
          <div className="dg-grid dg-grid-4" style={{ marginTop: 52 }}>
            {EXTRA.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 80}>
                <div className="dg-card" style={{ height: "100%" }}>
                  <div className="dg-card-icon"><f.icon size={21} /></div>
                  <h3 className="dg-h3" style={{ fontSize: 18 }}>{f.title}</h3>
                  <p className="dg-muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 8 }}>{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="dg-section" style={{ paddingTop: 20 }}>
        <div className="dg-wrap">
          <Reveal>
            <div className="dg-cta-band">
              <h2 className="dg-h2" style={{ maxWidth: 640, margin: "0 auto" }}>
                See it for yourself.
              </h2>
              <p className="dg-lead" style={{ margin: "18px auto 0", maxWidth: 500 }}>
                Create an account and get your first number in minutes.
              </p>
              <div style={{ marginTop: 30 }}>
                <LinkButton to="/signup" variant="primary" size="lg">
                  Get started free <ArrowRight size={17} />
                </LinkButton>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
