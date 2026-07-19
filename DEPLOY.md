# Deploying DIGIRINGO to Hostinger (GitHub → Node.js app)

One Node server hosts **everything** from a single deploy:

| URL | What |
|-----|------|
| `https://digiringo.com/`        | Marketing website (opens directly) |
| `https://digiringo.com/app`     | The DIGIRINGO app |
| `https://digiringo.com/admin`   | Control Hub (admin) |
| `https://digiringo.com/api/*`   | Telnyx + PayPal proxy (secret key injected server-side) |
| `https://digiringo.com/webhooks/telnyx` | Telnyx inbound-SMS / status webhook |

The whole front-end (`dist/`) is built automatically on install, and the Node
server (`server/telnyx-proxy.mjs`) serves it next to the API.

---

## 0. One-time: push to GitHub

The repo is `https://github.com/khanbro2/DigiRingo`. Secrets are **never** committed
(`.env` is git-ignored). Only public config (`.env.production`) ships.

```bash
git add .
git commit -m "Deploy setup"
git push origin main
```

---

## 1. Create the Node.js app in Hostinger (hPanel)

1. **hPanel → Websites → (your plan) → Advanced → Node.js** (or *Cloud/VPS → Node.js app*).
2. Click **Create application** and set:
   - **Node.js version:** `20.x` (anything ≥ 18 works)
   - **Application root:** e.g. `domains/digiringo.com/app` (any empty folder)
   - **Application URL:** your domain `digiringo.com`
   - **Startup file:** `server/telnyx-proxy.mjs`
3. **Connect the GitHub repo** `khanbro2/DigiRingo` (branch `main`), **or** upload the files.

On install Hostinger runs `npm install`, which triggers the `postinstall` step
(`vite build`) → the `dist/` folder is produced automatically. No manual build.

> If your panel has a separate **Build command** field, set it to `npm run build`.
> If a build ever doesn't run automatically, open the panel terminal / SSH and run
> `npm run build` once inside the application root.

---

## 2. Set the secret environment variables (THIS is where the keys go)

In the Node app's **Environment variables** section add (these stay on the server,
never in the browser):

| Variable | Value |
|----------|-------|
| `TELNYX_API_KEY`     | your real Telnyx **V2 API key** (`KEY...`) |
| `PAYPAL_CLIENT_ID`   | PayPal **Live** client id |
| `PAYPAL_SECRET`      | PayPal **Live** secret |
| `PAYPAL_ENV`         | `live` |
| `NODE_ENV`           | `production` |

> Do **not** set `PORT` — Hostinger provides it automatically and the server reads it.

The public build config (live mode, API path, account ids, PayPal **public**
client id) is already in the committed `.env.production`. If you'd rather not have
the account ids in the repo, blank them there and add `VITE_PAYPAL_CLIENT_ID`
plus the two `VITE_TELNYX_*` ids before the build instead.

---

## 3. Start & point the domain

1. Click **Restart / Start** on the Node app.
2. Make sure **Application URL** is your domain so `digiringo.com` maps to this app.
3. Visit `https://digiringo.com` — the marketing site should load immediately.

---

## 4. Telnyx webhook (for inbound SMS)

In the Telnyx portal set the **Messaging Profile** and **Voice/Call-Control**
webhook URL to:

```
https://digiringo.com/webhooks/telnyx
```

(No more ngrok/cloudflared once you're on a real domain.)

---

## 5. Updating later

Just push to GitHub:

```bash
git add . && git commit -m "..." && git push
```

Hostinger re-pulls, re-installs (re-builds), and restarts. Done.

---

### Notes / production TODO
- The wallet + inbox store are **in-memory** today (reset on restart). For real
  use, back them with a database. The API route shapes won't change.
- Add a PayPal **capture webhook** for extra robustness.
- Test PayPal with a **$1** top-up first (Live = real money).
