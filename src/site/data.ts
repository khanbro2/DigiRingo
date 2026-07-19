/**
 * Marketing content for the DIGIRINGO site. Kept in one place so copy/pricing can
 * be tuned without touching layout. `shot` paths point at /public/shots/*.png —
 * real app captures (see scripts that screenshot the running app).
 */

export const NAV = [
  { label: "Home", to: "/" },
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "Contact", to: "/contact" },
];

export const COUNTRIES = [
  { flag: "🇺🇸", name: "United States" },
  { flag: "🇬🇧", name: "United Kingdom" },
  { flag: "🇨🇦", name: "Canada" },
  { flag: "🇦🇺", name: "Australia" },
  { flag: "🇩🇪", name: "Germany" },
  { flag: "🇫🇷", name: "France" },
  { flag: "🇧🇷", name: "Brazil" },
  { flag: "🇯🇵", name: "Japan" },
];

export const STATS = [
  { num: "8+", label: "Countries with local numbers" },
  { num: "60s", label: "From sign-up to your first number" },
  { num: "$2.99", label: "Local numbers per month" },
  { num: "100%", label: "App-based — no SIM, no contract" },
];

export const FEATURES = [
  {
    icon: "Hash",
    title: "Real local numbers",
    body: "Get genuine local phone numbers in 8+ countries. They look and ring exactly like a native line — because they are one.",
  },
  {
    icon: "MessageSquare",
    title: "SMS that just works",
    body: "Send and receive texts with delivery receipts, per-number inboxes and threaded conversations — all from one screen.",
  },
  {
    icon: "PhoneCall",
    title: "Crystal-clear calls",
    body: "Place and take HD calls over the internet. Pick which of your numbers you call from with a single tap.",
  },
  {
    icon: "Wallet",
    title: "Prepaid wallet",
    body: "Top up once and spend as you go. No surprise invoices — see every charge in a clean, itemised history.",
  },
  {
    icon: "ShieldCheck",
    title: "Trust center",
    body: "Register your numbers for business messaging and stay compliant with 10DLC and carrier requirements, guided step by step.",
  },
  {
    icon: "Globe",
    title: "Borderless by design",
    body: "Keep a US line for work, a UK line for family and more — all in one app, no extra device or SIM required.",
  },
];

export const STEPS = [
  { n: "01", title: "Create your account", body: "Sign up in under a minute. No paperwork, no store visit." },
  { n: "02", title: "Pick a number", body: "Browse live local & mobile numbers and choose the one you like." },
  { n: "03", title: "Top up your wallet", body: "Add credit securely by card — pay only for what you use." },
  { n: "04", title: "Call & text away", body: "Your new number is live instantly. Start messaging and calling." },
];

/**
 * DIGIRINGO pricing — mirrors the app's canonical catalog (src/app/core/plans.ts).
 * Keep the two in sync: these are the numbers shown to customers, the app charges
 * from the same values.
 *
 * How it works:
 *   • Every number comes with a PLAN — pick Starter, Business or Pro (monthly or
 *     annual). Each plan includes ONE free number plus a pool of minutes + SMS,
 *     and lets you add more numbers up to a cap.
 *   • When a plan's pool runs out you keep going pay-as-you-go (USAGE_RATES),
 *     funded from the wallet — and we alert you near the limit so you can upgrade.
 */
export const PRICING = [
  {
    name: "Starter",
    monthly: 9.99,
    yearly: 8.25,      // effective /mo when billed annually
    yearlyTotal: 99,   // single upfront annual charge
    unit: "/mo",
    tagline: "A second line with room to grow.",
    cta: "Get Starter",
    featured: false,
    features: [
      "1 number FREE (add up to 3)",
      "300 minutes / mo",
      "300 SMS / mo",
      "Overage at pay-as-you-go rates",
      "Email support",
    ],
  },
  {
    name: "Business",
    monthly: 24.99,
    yearly: 20.75,
    yearlyTotal: 249,
    unit: "/mo",
    tagline: "For teams that live on calls & texts.",
    cta: "Get Business",
    featured: true, // Most popular
    features: [
      "1 number FREE (add up to 5)",
      "1,000 minutes / mo",
      "1,000 SMS / mo",
      "Overage at pay-as-you-go rates",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    monthly: 49.99,
    yearly: 41.58,
    yearlyTotal: 499,
    unit: "/mo",
    tagline: "High volume, toll-free ready.",
    cta: "Get Pro",
    featured: false,
    features: [
      "1 toll-free number FREE (add up to 10)",
      "3,000 minutes / mo",
      "3,000 SMS / mo",
      "Overage at pay-as-you-go rates",
      "Priority support",
    ],
  },
];

/** Flat monthly rental for EXTRA numbers on a plan (the first is free). */
export const NUMBER_RENTAL = [
  { type: "Extra local number", price: "$2.99", unit: "/mo" },
  { type: "Extra toll-free number", price: "$4.99", unit: "/mo" },
];

/** Pay-as-you-go usage rates — pooled across every number on the account. */
export const USAGE_RATES = [
  { item: "Voice — in & out", price: "$0.015", unit: "/min" },
  { item: "Local SMS", price: "$0.015", unit: "/msg" },
  { item: "Toll-free SMS", price: "$0.02", unit: "/msg" },
  { item: "Short-code SMS", price: "$0.025", unit: "/msg" },
  { item: "MMS — outbound", price: "$0.045", unit: "/msg" },
  { item: "MMS — inbound", price: "$0.015", unit: "/msg" },
];

export const FAQS = [
  {
    q: "What exactly is DIGIRINGO?",
    a: "DIGIRINGO is an app that gives you real local phone numbers in multiple countries. You can call and text from them just like a normal SIM line — but everything lives in one simple app, with no physical SIM or contract.",
  },
  {
    q: "Do I need a SIM card or a second phone?",
    a: "No. DIGIRINGO works entirely over the internet on the phone you already own. Add as many numbers as you like without swapping SIMs or carrying another device.",
  },
  {
    q: "Which countries are available?",
    a: "You can get local numbers in the US, UK, Canada, Australia, Germany, France, Brazil and more — with new countries added regularly. Some countries offer mobile numbers for full SMS support.",
  },
  {
    q: "How does billing work?",
    a: "Every number comes with a plan — you pick Starter, Business or Pro (billed monthly, or annually with 2 months free). Your plan includes one number FREE plus a pool of minutes and SMS, and you can add more numbers up to the plan's limit ($2.99/mo local, $4.99/mo toll-free each). When your included minutes or SMS run out you simply keep going pay-as-you-go — voice from $0.015/min, SMS from $0.015/msg, drawn from your prepaid wallet. You can pay for a plan or an extra number straight from the wallet, or directly by card.",
  },
  {
    q: "What happens when I hit my plan limit?",
    a: "We watch your usage and alert you inside the app (and web app) as you approach your plan's limit, so you can upgrade in a tap. If you keep going after the pool runs out, extra usage is billed pay-as-you-go from your wallet at standard rates — you're never cut off mid-conversation. Upgrading to a bigger plan gives you more included minutes, SMS and numbers.",
  },
  {
    q: "Can I pay from my wallet or by card?",
    a: "Both. Every purchase — a plan, an extra number, or a wallet top-up — can be paid straight from your prepaid wallet balance, or directly by card. Pay-as-you-go usage beyond your plan is always drawn from the wallet, so keeping a little balance means you're never cut off mid-conversation.",
  },
  {
    q: "Can I send business SMS?",
    a: "Yes. The built-in Trust Center walks you through registering your numbers (10DLC and carrier requirements) so your business messages are delivered reliably and stay compliant.",
  },
  {
    q: "Is it available on iPhone and Android?",
    a: "DIGIRINGO is built cross-platform and ships to both iOS and Android, with the same clean experience on every device.",
  },
];

/** Real app captures — see /public/shots. PhoneFrame falls back gracefully. */
export const SHOTS = {
  home: "/shots/home.png",
  numbers: "/shots/numbers.png",
  buy: "/shots/buy.png",
  inbox: "/shots/inbox.png",
  chat: "/shots/chat.png",
  calls: "/shots/calls.png",
  dialer: "/shots/dialer.png",
  wallet: "/shots/wallet.png",
  settings: "/shots/settings.png",
  activity: "/shots/activity.png",
};
