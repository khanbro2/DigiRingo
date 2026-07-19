# DIGIRINGO — Architecture & Cross-platform guide

DIGIRINGO is a React + Vite app structured so the **same codebase ships to web,
Android and iOS** with no rewrite. The mobile packaging path is **Capacitor**
(it wraps this exact web build in a native shell).

## Layered structure

```
src/app/
  core/
    theme.ts      ← design tokens (colors, gradients, radii, fonts). Single
                    source of truth — screens never hardcode a hex. Portable.
    types.ts      ← domain types (PhoneNumber, Conversation, ActivityItem…).
                    Pure data shapes, no UI.
  store/
    seed.ts       ← initial/mock data
    AppStore.tsx  ← the single store (Context + reducer). ALL business logic
                    lives here: auth, messaging, verification gating, wallet.
                    Screens are presentational; swap this file for a real API
                    later and the UI is untouched.
  screens/        ← one file per screen, presentational only
    AuthScreen, HomeScreen, NumbersScreen, NumberSettingsScreen,
    InboxScreen (number-wise), CallsScreen (call log), DialerScreen (keypad),
    ActivityScreen, TrustCenterScreen, WalletScreen, SettingsScreen
  components/     ← shared widgets (BuyNumberModal, ui/ primitives)
  App.tsx         ← phone shell + auth gate + bottom-tab navigation + overlays
```

### Two apps, one repo (Vite multi-page)

| Entry | URL | What |
|---|---|---|
| `index.html` → `src/main.tsx` | `/` | The **mobile app** (phone-shell UI) |
| `admin.html` → `src/admin.tsx` | `/admin.html` | The **Control Hub** (admin web dashboard) |

The Control Hub (`src/admin/`) is a full-width web dashboard to run the platform:
Overview (KPIs + charts), Users, Numbers, Telnyx (connection/config/10DLC/
messaging profiles/balance), **Payments** (Stripe / PayPal / bank + payout &
financial settings), **Integrations** (service API keys + your platform API
keys + webhooks), Billing (plans, MRR, invoices, Telnyx funding), Transactions
(ledger), Settings. It reuses the shared `services/telnyx` layer and
`core/theme`. Admin data (users, transactions, invoices) comes from your backend
admin API in production (mocked in `src/admin/mock.ts`). Charts use `recharts`.

Settings/secrets live in a small admin store (`src/admin/store.tsx`). **Payment
secrets and API keys are SECRETS** — in production a save POSTs to your backend,
which stores them encrypted; the dashboard only ever displays the last 4 chars
(`SecretField`). The mock store keeps only the last4 in memory, mirroring that.

**Why this is portable:** logic and styling are decoupled from the DOM. The
store and tokens contain no web-only APIs, so a future React Native port reuses
`core/` and `store/` directly and only re-skins `screens/`.

## Feature map

| Feature                 | Where |
|-------------------------|-------|
| User account (sign up / log in) | `screens/AuthScreen.tsx`, `store` `login/logout` |
| Activity (notifications)        | `screens/ActivityScreen.tsx`, `store.activity` |
| Number-wise inboxes + switcher  | `screens/InboxScreen.tsx`, `store.activeNumberId` |
| Call log                        | `screens/CallsScreen.tsx`, `store.calls` |
| Phone dialer (keypad, pick calling-from number) | `screens/DialerScreen.tsx`, `store.placeCall` |
| Per-number action/settings      | `screens/NumberSettingsScreen.tsx` |
| Verification (Trust center)     | `screens/TrustCenterScreen.tsx`, `store.registerNumber` |
| SMS gated by verification       | `store.sendMessage` (blocks unverified numbers) |
| Wallet / top-up                 | `screens/WalletScreen.tsx`, `store.addBalance` |

## Telnyx integration

All telephony (numbers, SMS, calls, 10DLC verification, balance) is modelled on
the **Telnyx v2 API**. The integration lives in `src/app/services/telnyx/`:

```
services/telnyx/
  types.ts    ← Telnyx wire types (PhoneNumberDetailed, Message, Brand, …)
  config.ts   ← mode (mock|live) + API base + ids, from env
  client.ts   ← HTTP wrapper (live mode → your backend proxy)
  mock.ts     ← in-memory mock returning real Telnyx shapes (no backend)
  index.ts    ← TelnyxService: searchAvailable, createNumberOrder,
                listPhoneNumbers, sendMessage, 10DLC brand/campaign/assign,
                createCall, getBalance — branches mock vs live
  adapt.ts    ← map Telnyx types ↔ app domain (core/types.ts)
```

**The Telnyx API key is a SECRET — it must never be in this app.** The app
talks to YOUR backend proxy, which injects the key server-side:

```
DIGIRINGO app ──/api/telnyx/*──▶ your proxy ──Bearer KEY──▶ api.telnyx.com/v2/*
```

- **Mock mode (default):** `VITE_TELNYX_MODE=mock` — the app runs fully with no
  backend or key, using `mock.ts`.
- **Live mode:** set `VITE_TELNYX_MODE=live` and `VITE_API_BASE` to your proxy,
  then run the proxy with the secret key:
  ```bash
  TELNYX_API_KEY=KEY_xxx node server/telnyx-proxy.mjs
  ```
  See `.env.example`. No app code changes — only the env flips.

Telnyx feature → app mapping:

| App action | Telnyx endpoint |
|---|---|
| Buy number (search + order) | `GET /available_phone_numbers`, `POST /number_orders` |
| Load owned numbers | `GET /phone_numbers` |
| Verification (Trust center) | 10DLC `POST /10dlc/brand`, `/campaignBuilder`, `/phone_number_campaigns` |
| Inbox (number-wise conversations) | backend messaging store fed by `message.received` webhooks + sent messages |
| Send SMS (gated by verification) | `POST /messages` → DLR `GET /messages/{id}` (sending→sent→delivered) |
| Messaging profiles | `GET /messaging_profiles` |
| Calls log | `GET /detail_records?filter[record_type]=call-control` (CDRs) |
| Place call | `POST /calls` (Call Control) |
| Number settings sync | `PATCH /phone_numbers/{id}/voice` and `/messaging` |
| Wallet balance | `GET /balance` (account-level; Telnyx has no per-number balance) |

> **Inbox note:** Telnyx has no "list conversations" endpoint. This is now
> implemented in `server/telnyx-proxy.mjs`: it receives inbound SMS at
> `POST /webhooks/telnyx` (`message.received`), records outbound sends made via
> `POST /api/telnyx/messages`, applies delivery-status webhooks (DLRs), and groups
> everything into threads per (owned number, contact). The app loads them via
> `telnyx.listConversations()` → `GET /api/telnyx/messaging/conversations`. The
> store is **in-memory** (resets on restart) — swap the `threads` Map for a DB in
> production; the route shapes stay identical. Point the Telnyx Messaging Profile
> webhook URL at `https://<your-host>/webhooks/telnyx` (use ngrok for local dev).

> Note: Telnyx balance is **account-level** (one wallet). Per-number cost is the
> monthly recurring charge billed against that balance — there is no separate
> balance per number. The app shows the account balance + per-number monthly cost.

## Shipping to Android & iOS (Capacitor)

```bash
pnpm add -D @capacitor/cli @capacitor/core
pnpm exec cap init DIGIRINGO app.digiringo.mobile --web-dir=dist
pnpm build                 # produces dist/
pnpm exec cap add android  # + cap add ios  (iOS needs macOS/Xcode)
pnpm exec cap sync
pnpm exec cap open android  # opens Android Studio to build the APK/AAB
```

After any web change: `pnpm build && pnpm exec cap sync`. No app code changes
are needed — Capacitor serves the same bundle inside the native WebView, and
native plugins (push notifications, contacts, etc.) can be added incrementally.
