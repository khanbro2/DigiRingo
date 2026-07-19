import type { ReactNode } from "react";
import { Reveal } from "../components/Reveal";

/* ============================================================================
   Legal pages — Terms of Service & Privacy Policy.
   NOTE: these are sensible, plain-English starting templates for a virtual-
   phone-number SaaS. They are NOT legal advice — have a lawyer review and adapt
   them (company name, jurisdiction, EIN/registration, GDPR/CCPA specifics)
   before a real public launch.
   ========================================================================== */

const UPDATED = "July 1, 2026";

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dg-section" style={{ paddingTop: "calc(var(--nav-h) + clamp(40px,7vw,80px))" }}>
      <div className="dg-wrap" style={{ maxWidth: 800 }}>
        <Reveal>
          <span className="dg-eyebrow">Legal</span>
          <h1 className="dg-h1" style={{ marginTop: 20, fontSize: "clamp(34px,5vw,56px)" }}>{title}</h1>
          <p className="dg-muted" style={{ marginTop: 14, fontSize: 13.5 }}>Last updated: {UPDATED}</p>
        </Reveal>
        <Reveal delay={80}>
          <div style={{ marginTop: 36, lineHeight: 1.7 }}>{children}</div>
        </Reveal>
      </div>
    </section>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 style={{ color: "var(--text)", fontSize: 20, fontWeight: 800, margin: "34px 0 12px" }}>{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 14 }}>{children}</p>;
}
function LI({ children }: { children: ReactNode }) {
  return <li style={{ color: "var(--muted)", fontSize: 15, marginBottom: 8 }}>{children}</li>;
}

/* ----------------------------------------------------------------- Terms */
export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <P>
        Welcome to DIGIRINGO. These Terms of Service ("Terms") govern your access to and use of the
        DIGIRINGO apps, websites and services (the "Service"). By creating an account or using the
        Service you agree to these Terms. If you do not agree, do not use the Service.
      </P>

      <H>1. The Service</H>
      <P>
        DIGIRINGO provides virtual local phone numbers and lets you make and receive calls and text
        messages through an app. Telephony is delivered through third-party carriers (including
        Telnyx). Availability of numbers and features varies by country and is subject to carrier
        and regulatory rules.
      </P>

      <H>2. Your account</H>
      <P>
        You must provide accurate information and keep your password secure. You are responsible for
        all activity under your account. You must be of legal age to form a binding contract in your
        country to use the Service.
      </P>

      <H>3. Acceptable use</H>
      <P>You agree not to use the Service to:</P>
      <ul>
        <LI>send spam, unsolicited or unlawful messages, or violate anti-spam or telemarketing laws;</LI>
        <LI>send messages without the recipient's required consent (opt-in), or ignore opt-out (STOP) requests;</LI>
        <LI>impersonate others, commit fraud, or share content that is illegal, harmful or infringing;</LI>
        <LI>bypass carrier registration requirements (such as 10DLC) where they apply.</LI>
      </ul>
      <P>
        You are responsible for complying with all applicable laws and carrier requirements for the
        messages and calls you send.
      </P>

      <H>4. Numbers</H>
      <P>
        Numbers are provided by carriers and remain subject to their terms. A number may need to be
        registered or verified before it can send messages, and may be reclaimed if your account is
        cancelled, suspended, or a number stays unpaid or unused. Some countries require regulatory
        documents (proof of identity/address) before a number can be activated.
      </P>

      <H>5. Plans, billing &amp; payments</H>
      <P>
        Paid plans and any add-ons are billed in advance as described at checkout. Payments are
        processed by our payment provider (PayPal); we do not store your full card details. Free
        trials, taxes, usage charges and applicable fees are shown before you are charged. Unless
        required by law, charges are non-refundable. You can cancel at any time; cancellation stops
        future charges and may end access at the end of the paid period.
      </P>

      <H>6. Third-party services</H>
      <P>
        The Service relies on third parties such as Telnyx (telephony) and PayPal (payments). Your
        use of those services may also be subject to their terms and privacy policies.
      </P>

      <H>7. Suspension &amp; termination</H>
      <P>
        We may suspend or terminate your account if you breach these Terms, abuse the Service, or to
        comply with law or carrier requirements. You may stop using the Service and close your
        account at any time.
      </P>

      <H>8. Disclaimers &amp; liability</H>
      <P>
        The Service is provided "as is" without warranties of any kind. We do not guarantee
        uninterrupted or error-free service, message delivery, or call quality. To the maximum extent
        permitted by law, DIGIRINGO is not liable for indirect, incidental or consequential damages, and
        our total liability is limited to the amount you paid us in the 3 months before the claim.
      </P>

      <H>9. Changes</H>
      <P>
        We may update these Terms from time to time. We will post the updated version with a new
        "Last updated" date, and material changes may be notified in the app or by email. Continued
        use after changes means you accept them.
      </P>

      <H>10. Contact</H>
      <P>Questions about these Terms? Email us at support@digiringo.app.</P>
    </LegalLayout>
  );
}

/* --------------------------------------------------------------- Privacy */
export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <P>
        This Privacy Policy explains what information DIGIRINGO collects, how we use it, and your
        choices. By using the Service you agree to this policy.
      </P>

      <H>1. Information we collect</H>
      <ul>
        <LI><b style={{ color: "var(--text)" }}>Account data</b> — your name, email and password (stored hashed).</LI>
        <LI><b style={{ color: "var(--text)" }}>Telephony data</b> — the numbers you own, and your messages and call records, which we process to provide the inbox, history and delivery.</LI>
        <LI><b style={{ color: "var(--text)" }}>Billing data</b> — your wallet balance and transactions. Payments are handled by PayPal; we do not store your full card details.</LI>
        <LI><b style={{ color: "var(--text)" }}>Verification data</b> — business details (for 10DLC) or documents you upload for number regulatory requirements.</LI>
        <LI><b style={{ color: "var(--text)" }}>Usage &amp; device data</b> — basic logs and settings (e.g. your theme preference) needed to run and secure the Service.</LI>
      </ul>

      <H>2. How we use it</H>
      <P>
        To provide and operate the Service (numbers, calls, messages, wallet), to verify numbers and
        prevent fraud and abuse, to process payments, to support you, and to comply with legal and
        carrier requirements.
      </P>

      <H>3. How we share it</H>
      <P>
        We share data only as needed to run the Service: with <b style={{ color: "var(--text)" }}>Telnyx</b> and
        carriers to deliver calls/messages and register numbers; with <b style={{ color: "var(--text)" }}>PayPal</b> to
        process payments; and where required by law or to protect rights and safety. We do not sell
        your personal data.
      </P>

      <H>4. Data retention</H>
      <P>
        We keep your data while your account is active and as needed for legal, billing and carrier
        record-keeping. You can ask us to delete your account and associated data, subject to records
        we are required to retain.
      </P>

      <H>5. Security</H>
      <P>
        We protect your data with industry practices: passwords are hashed, traffic is encrypted in
        transit (HTTPS), and secret keys are kept server-side only. No system is perfectly secure, so
        we cannot guarantee absolute security.
      </P>

      <H>6. Your rights</H>
      <P>
        Depending on where you live, you may have rights to access, correct, export or delete your
        personal data, and to object to certain processing. Contact us to exercise these rights.
      </P>

      <H>7. Cookies &amp; local storage</H>
      <P>
        We use your browser's local storage for essential features such as keeping you signed in and
        remembering your theme. We do not use third-party advertising trackers.
      </P>

      <H>8. Children</H>
      <P>The Service is not intended for children under the age required to consent in your country.</P>

      <H>9. Changes</H>
      <P>
        We may update this policy and will post the new version with an updated date; material changes
        may be notified in the app or by email.
      </P>

      <H>10. Contact</H>
      <P>Privacy questions? Email support@digiringo.app.</P>
    </LegalLayout>
  );
}
