# DIGIRINGO — Google Play store listing pack

Everything in this folder is ready to paste/upload into Play Console.
Assets: `icon-512.png`, `feature-graphic-1024x500.png`, `screenshots/*.png` (6 × 1080×1920).

---

## 1. App details

| Field | Value |
|---|---|
| **App name** (max 30) | `DIGIRINGO — Second Number` |
| **Package name** | `com.digiringo.app` *(never change this)* |
| **Default language** | English (United States) – `en-US` |
| **App or game** | App |
| **Free or paid** | Free (with in-app purchases handled outside Play — see §7) |
| **Category** | Communication |
| **Tags** | Calling, Messaging, Business |
| **Contact email** | `support@digiringo.com` |
| **Website** | `https://digiringo.com` |
| **Privacy policy URL** | `https://digiringo.com/privacy` |
| **Terms URL** (optional) | `https://digiringo.com/terms` |

---

## 2. Short description (max 80 characters)

```
Your second phone number — call and text from a real US number, no extra SIM.
```
*(76 characters)*

---

## 3. Full description (max 4000 characters)

```
DIGIRINGO gives you a second phone number that lives inside your phone. Rent a real US number in seconds and use it to call and text — no second SIM, no second handset, no contract.

Keep your personal number private. Use DIGIRINGO for work, for selling online, for signing up to services, or for anyone you'd rather not hand your real number to.

WHAT YOU CAN DO

• Get a real US number
Browse available numbers by area code and activate one instantly. Add more numbers whenever you need them — one for work, one for a side business, one for classifieds.

• Make and receive calls
A full dialer with a country picker and live per-minute rates. Incoming calls ring your phone like a normal call, with a full-screen answer/decline screen — even when the app is closed or your phone is locked.

• Send and receive texts
SMS and MMS in familiar chat threads, with delivery status and unread badges. Everything stays in your inbox so you always have the history.

• Voicemail and forwarding
Missed a call? Take a voicemail, or forward calls straight to your normal cellphone so you never miss anything.

• Call history and activity log
Every call and message, with duration and cost, in one clear list.

• Multiple profiles
Run separate workspaces from one login — handy if you juggle a business and a personal line.

• Pay only for what you use
Top up your wallet or pay by card. Simple per-minute and per-message pricing, shown before you spend. No lock-in and no surprise bills.

BUILT FOR

Freelancers and small businesses that want a professional line without a second phone. Sellers on marketplaces who don't want strangers to have their personal number. Anyone travelling, working remotely, or simply keeping work and life apart.

WHY DIGIRINGO

• Real carrier-grade numbers, not a chat-only service — the people you call and text see a normal US number.
• Works on your phone and in any browser, with the same account and the same inbox.
• Clean, fast, dark interface designed for one-handed use.
• Your data stays yours: we never sell your information and we never use your calls or messages for advertising.

GETTING STARTED

1. Create a free account.
2. Choose a number by area code and activate it.
3. Start calling and texting straight away.

IMPORTANT

DIGIRINGO is a cloud calling service and needs an internet connection (Wi-Fi or mobile data). It is not a replacement for your mobile carrier and does NOT support emergency calls — you cannot dial 911 or any other emergency number from DIGIRINGO. Always keep a traditional phone service available for emergencies.

Purchases (numbers, plans and wallet top-ups) are for the DIGIRINGO cloud service and are processed on our website.

Privacy policy: https://digiringo.com/privacy
Terms of service: https://digiringo.com/terms
Support: support@digiringo.com
```

---

## 4. Screenshots

Upload all 6 from `screenshots/` in order. Play needs at least 2 phone
screenshots; 1080×1920 (9:16) is within spec.

| File | Caption theme |
|---|---|
| `01-home.png` | Your second number, ready to go |
| `02-dialer.png` | Call anyone, from your number |
| `03-inbox.png` | Text like a normal phone |
| `04-numbers.png` | Rent numbers in seconds |
| `05-calls.png` | Never miss a call |
| `06-wallet.png` | Pay only for what you use |

> Tablet screenshots are optional. If you skip them, Play shows a "not designed
> for tablets" note — harmless for a phone-first app.

---

## 5. Data safety form (App content → Data safety)

Answer exactly this. It must match the privacy policy.

**Does your app collect or share any of the required user data types?** → **Yes**
**Is all of the user data collected by your app encrypted in transit?** → **Yes**
**Do you provide a way for users to request that their data is deleted?** → **Yes**
 · Deletion URL: `https://digiringo.com/privacy` (the "Deleting your data" section)

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Personal info → Name | Yes | No | App functionality, Account management | Required |
| Personal info → Email address | Yes | No | App functionality, Account management | Required |
| Personal info → Phone number | Yes | Yes (carrier) | App functionality | Required |
| Financial info → Purchase history | Yes | No | App functionality | Required |
| Messages → SMS or MMS | Yes | Yes (carrier) | App functionality | Required |
| Audio → Voice or sound recordings | Yes | Yes (carrier) | App functionality | Optional (voicemail only) |
| App activity → App interactions | Yes | No | Analytics, App functionality | Required |
| App info & performance → Crash logs / diagnostics | Yes | No | App functionality | Required |
| Device or other IDs | Yes | Yes (Firebase) | App functionality (push notifications) | Required |

**Do NOT tick:** Location, Contacts, Photos/Videos, Files, Health, Calendar,
Web browsing history, Advertising. The app doesn't touch any of them.
Nothing is used for advertising or marketing, and no data is sold.

---

## 6. Content rating questionnaire

Category: **Utility, Productivity, Communication, or Other**

| Question | Answer |
|---|---|
| Violence, sexual content, profanity, drugs, gambling | No to all |
| Does the app allow users to interact or exchange content? | **Yes** |
| Does it share the user's current location with other users? | **No** |
| Does it allow users to purchase digital goods? | **Yes** |
| Does it contain user-generated content? | **Yes** (messages between users and their contacts) |

Expected result: **Everyone** or **Teen** (unrestricted communication usually
yields Teen / PEGI 12 — that's normal for a calling app).

---

## 7. Other "App content" declarations

- **Ads** → No, my app does not contain ads.
- **App access** → *Some functionality is restricted.* Provide a demo login so
  reviewers can get past the sign-in screen:
  `Username: <a real test account email>` / `Password: <its password>`
  Instructions: "Sign in with these credentials. A number is already active on
  the account, so Calls, Inbox and Numbers can be reviewed immediately."
  ⚠️ **Create this reviewer account and put a number + a little wallet balance on
  it before submitting.** Without it the app is rejected as "cannot log in".
- **Government apps** → No.
- **Financial features** → No (not a banking/lending app).
- **Health** → No.
- **Target audience** → 18 and over. Do **not** tick any under-18 age band.
- **News app** → No.
- **COVID-19 apps** → No.
- **Data safety** → see §5.
- **Advertising ID** → Not used (we don't include the ads SDK).
- **Full-screen intent permission** → Declare **Yes, my app is a calling app**.
  Justification text:
  "DIGIRINGO is a VoIP calling app. USE_FULL_SCREEN_INTENT shows the incoming-call
  screen with Answer and Decline actions when a call arrives while the device is
  locked or the app is in the background — the same behaviour as the system phone
  app. It is used for incoming calls only."
- **Permissions:** RECORD_AUDIO (microphone for calls), POST_NOTIFICATIONS
  (incoming call / message alerts), USE_FULL_SCREEN_INTENT, WAKE_LOCK, VIBRATE,
  INTERNET, ACCESS_NETWORK_STATE. No location, contacts, storage or SMS-read
  permissions — nothing that triggers a sensitive-permission review.
- **Payments:** numbers, plans and wallet top-ups are paid on digiringo.com and
  unlock a *cloud service*, so Play billing is not required. Keep the app free of
  in-app purchase SDKs. Do not add "buy" buttons that link out to a payment page
  from inside the app if Play flags it — the safe pattern is to let users top up
  on the website and simply reflect the balance in the app.

---

## 8. Build to upload

Google Play accepts **.aab** only (not .apk). CI already builds a signed
`app-release.aab`, but only after these four repository secrets exist
(GitHub → repo → Settings → Secrets and variables → Actions → New secret):

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the entire contents of `upload.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the upload keystore password |
| `ANDROID_KEY_ALIAS` | `digiringo` |
| `ANDROID_KEY_PASSWORD` | the upload key password |

(The keystore + passwords are in the local backup folder
`C:\Users\pc\DIGIRINGO-keystore-BACKUP\` — **back that folder up somewhere safe.
Lose it and the app can never be updated again.**)

Then: push to `main` (or run the "Build Android App (APK)" workflow manually) →
download the **`digiringo-aab`** artifact → upload `app-release.aab` in Play
Console.

**Version bumps:** every upload needs a higher `versionCode` in
`android/app/build.gradle`. It's currently `1`. Bump to `2`, `3`, … per release.

---

## 9. Release path (Personal accounts created after Nov 2023)

Google requires **closed testing with at least 12 testers who stay opted in for
14 consecutive days** before you may apply for production access.

1. Play Console → **Testing → Closed testing** → create a track.
2. Add 12+ tester email addresses (Google accounts) to an email list.
3. Upload the AAB, roll out, share the opt-in link with the testers.
4. Testers install and keep the app installed for 14 days.
5. **Apply for production access** → then promote the release to Production.

Organization accounts (with a D-U-N-S number) skip this and can publish straight
to production.

---

## 10. Checklist

- [ ] Deploy the site so `https://digiringo.com/privacy` and `/terms` are live
- [ ] Create the `support@digiringo.com` mailbox (it's the public contact address)
- [ ] Add the 4 signing secrets to GitHub
- [ ] Back up `C:\Users\pc\DIGIRINGO-keystore-BACKUP\` off-machine
- [ ] Create the reviewer demo account (with an active number + balance)
- [ ] Create the app in Play Console, paste §1–§3, upload §4 assets
- [ ] Complete §5 Data safety, §6 Content rating, §7 App content
- [ ] Upload the AAB to closed testing, recruit 12 testers
