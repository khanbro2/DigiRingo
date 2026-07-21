/**
 * Browser softphone — real two-way audio via the Telnyx WebRTC SDK.
 *
 * Login uses an EPHEMERAL JWT minted by our backend (`POST /api/telnyx/rtc-token`)
 * from a Credential Connection, so the SIP password never reaches the browser.
 * The remote audio is attached to a hidden <audio id="dg-remote-audio"> that the
 * app renders once at the root.
 *
 * The client REGISTERS in the background as soon as the user is signed in
 * (`register()`), so inbound calls to their number ring the app even when no
 * call is in progress. `startCall()` places outbound calls on the same client.
 *
 * In "mock" mode there's no SDK/network — call state is simulated so the in-call
 * UI is fully demoable offline (incl. a dev hook to preview an incoming call).
 */
import { TelnyxRTC } from "@telnyx/webrtc";
import { getToken } from "./api";
import { API_BASE, TELNYX_MODE } from "./telnyx/config";

const live = TELNYX_MODE === "live";
export const REMOTE_AUDIO_ID = "dg-remote-audio";

export type CallPhase = "incoming" | "connecting" | "ringing" | "active" | "ended" | "failed";
export type CallQuality = "excellent" | "good" | "fair" | "poor" | "unknown";
export type CallDir = "inbound" | "outbound";

export interface CallSnapshot {
  phase: CallPhase;
  direction: CallDir;
  contact: string;
  callerNumber: string | null;
  muted: boolean;
  quality: CallQuality;
  /** epoch ms when the call became active (for the timer) */
  startedAt: number | null;
  /** talk-time budget left (plan + wallet, pooled across profiles) as reported
   *  by the server, and WHEN it was reported — the UI interpolates between
   *  heartbeats. null = unknown/mock. */
  remainingSec: number | null;
  remainingAt: number | null;
  error?: string;
}

type Listener = (s: CallSnapshot | null) => void;

let snap: CallSnapshot | null = null;
const listeners = new Set<Listener>();

function notify() { listeners.forEach((fn) => fn(snap)); }
function pushSnap(s: CallSnapshot) { snap = s; notify(); }
function emit(patch: Partial<CallSnapshot>) {
  if (!snap) return;
  snap = { ...snap, ...patch };
  notify();
}

export function subscribeCall(fn: Listener): () => void {
  listeners.add(fn);
  fn(snap);
  return () => { listeners.delete(fn); };
}
export function currentCall(): CallSnapshot | null { return snap; }

/* ------------------------------------------------------------------ live SDK */
type AnyCall = {
  id: string;
  state: string;
  direction: string;
  options?: { remoteCallerNumber?: string; remoteCallerName?: string };
  answer: () => void;
  hangup: () => void;
  muteAudio: () => void;
  unmuteAudio: () => void;
  peer?: { instance?: RTCPeerConnection };
};
let client: InstanceType<typeof TelnyxRTC> | null = null;
let registered = false;
let readyPromise: Promise<void> | null = null;
let call: AnyCall | null = null;
let myCaller: string | null = null;
let myName: string | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;
let beatTimer: ReturnType<typeof setInterval> | null = null;
let mockTimers: ReturnType<typeof setTimeout>[] = [];
let lastStats: { lost: number; recv: number } | null = null;

/* -------------------------------------- Android full-screen call notification */
// The native CallMessagingService turns an incoming-call FCM into a WhatsApp-style
// full-screen notification and, on Answer/Decline (or a lock-screen full-screen
// launch), calls window.__dgCallAction(...) → these hooks. The push can beat the
// WebRTC inbound leg (cold start / lock screen), so an action with no live call
// yet is QUEUED and applied the moment the real call lands (see onNotification).
let pendingNative: "answer" | "decline" | null = null;
let pendingNativeAt = 0;
// True while a native notification is the one ringing (background / lock screen),
// so the in-app ringtone stays silent and we don't double-ring.
let nativeCallActive = false;
const PENDING_TTL_MS = 30_000;

/** Whether the native full-screen notification currently owns the ring. The
 *  in-app InCallScreen reads this to avoid a second, overlapping ringtone. */
export function isNativeRinging(): boolean { return nativeCallActive; }

/** Ask the Android shell to dismiss the ringing full-screen call notification
 *  (once the call is answered/declined in-app). No-op on web. */
function clearNativeCallNotification(): void {
  try {
    (window as unknown as { DigiNative?: { clearCallNotification?: () => void } })
      .DigiNative?.clearCallNotification?.();
  } catch { /* not native */ }
}

/* ------------------------------------------------- talk-time budget (server) */
// The server pools plan minutes + wallet-funded overflow across every profile
// of the account. We ask before dialing (gate) and every 15s during a call
// (countdown + auto-cut when the pool runs dry).
const API_ORIGIN_BASE = API_BASE.replace(/\/api\/telnyx$/, "");

async function fetchRemaining(): Promise<{ remainingSec: number; allowed: boolean } | null> {
  try {
    const t = getToken();
    const r = await fetch(`${API_ORIGIN_BASE}/api/voice/remaining`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!r.ok) return null; // fail-open: never block calling on a server blip
    return await r.json();
  } catch { return null; }
}

async function sendHeartbeat(callId: string, ended = false): Promise<{ remainingSec: number; allowed: boolean } | null> {
  try {
    const t = getToken();
    const r = await fetch(`${API_ORIGIN_BASE}/api/voice/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ callId, phase: ended ? "ended" : "active" }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const OUT_OF_TIME_MSG = "Plan minutes used up — top up your wallet or upgrade to keep calling.";

function startHeartbeat() {
  if (beatTimer || !live) return;
  const beat = async () => {
    const id = call?.id;
    if (!id || !snap || snap.phase !== "active") return;
    const u = await sendHeartbeat(id);
    if (!u || !snap || snap.phase !== "active") return;
    emit({ remainingSec: u.remainingSec, remainingAt: Date.now() });
    if (!u.allowed) {
      // Budget exhausted mid-call → cut it and tell the user why.
      hangupCall();
      emit({ phase: "failed", error: OUT_OF_TIME_MSG });
    }
  };
  beat(); // first beat immediately so the countdown appears right away
  beatTimer = setInterval(beat, 15_000);
}

function stopHeartbeat() {
  if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }
  const id = call?.id;
  if (live && id) void sendHeartbeat(id, true);
}

// Fetch the connection's STATIC SIP credentials (username/password). We log in
// with these — not an on-demand token — so the client also RECEIVES inbound
// calls (Telnyx on-demand credentials are outbound-only).
// A stable per-device id so this device keeps its OWN Telnyx SIP identity — that
// lets the phone and the browser BOTH stay registered and BOTH ring (a single
// shared identity let them kick each other off Telnyx in a loop).
function deviceId(): string {
  try {
    const KEY = "dg-device-id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch { return ""; }
}
function devicePlatform(): string {
  const c = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return c?.getPlatform?.() || "web";
}

async function fetchCreds(): Promise<{ loginToken: string | null; login: string | null; password: string | null; callerNumber: string | null; callerName: string | null }> {
  const t = getToken();
  const r = await fetch(`${API_BASE}/rtc-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ deviceId: deviceId(), platform: devicePlatform() }),
  });
  const j = await r.json().catch(() => ({}));
  // Prefer a per-user login token (unique SIP identity); fall back to the shared
  // static credential if the server returned login/password instead.
  if (!r.ok || (!j.loginToken && !(j.login && j.password))) throw new Error(j.error || "Could not start voice session");
  return { loginToken: j.loginToken ?? null, login: j.login ?? null, password: j.password ?? null, callerNumber: j.callerNumber ?? null, callerName: j.callerName ?? null };
}

/** Connect + register the WebRTC client once; resolves when ready to call/receive. */
function ensureClient(): Promise<void> {
  if (!live) return Promise.resolve();
  if (registered && client) return Promise.resolve();
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Voice service timed out — check your connection.")), 15000);
    (async () => {
      try {
        const { loginToken, login, password, callerNumber, callerName } = await fetchCreds();
        myCaller = callerNumber; myName = callerName;
        client = new TelnyxRTC(loginToken ? { login_token: loginToken } : { login: login!, password: password! });
        client.remoteElement = REMOTE_AUDIO_ID;
        client.on("telnyx.ready", () => { registered = true; clearTimeout(timeout); console.info("[voice] registered (ready for inbound + outbound)"); resolve(); });
        client.on("telnyx.notification", onNotification);
        client.on("telnyx.socket.close", () => { console.warn("[voice] socket closed"); registered = false; });
        client.on("telnyx.error", (e: unknown) => {
          const msg = (e as { error?: { message?: string } })?.error?.message || "Voice connection error";
          console.warn("[voice] error:", msg);
          clearTimeout(timeout);
          if (snap && snap.phase !== "ended") { endCall(); emit({ phase: "failed", error: msg }); }
          reject(new Error(msg));
        });
        client.connect();
      } catch (e) { clearTimeout(timeout); reject(e); }
    })();
  });
  readyPromise.catch(() => { readyPromise = null; registered = false; });
  return readyPromise;
}

function onNotification(n: { type?: string; call?: AnyCall }) {
  if (n?.type === "userMediaError") {
    endCall();
    emit({ phase: "failed", error: "Microphone blocked — allow mic access and try again." });
    return;
  }
  if (n?.type !== "callUpdate" || !n.call) return;
  const c = n.call;
  const dir = String(c.direction ?? "");
  const st = String(c.state ?? "");

  console.info("[voice] callUpdate:", dir, st, "tracking=", call?.id ?? "none", "cid=", c.id);
  // Brand-new INBOUND call we're not already tracking → ring the incoming UI.
  // Lenient on state (SDK may report new/ringing/early) — just not a terminal one.
  const terminal = st === "hangup" || st === "destroy" || st === "purge";
  const isNewInbound = (!call || call.id !== c.id) && dir === "inbound" && !terminal && st !== "active";
  if (isNewInbound) {
    console.info("[voice] ✅ INCOMING → showing ring UI", c.id);
    call = c;
    // Inbound while the app is hidden → the native FCM notification is (or will
    // be) ringing, so let it own the ring and keep the in-app ringtone silent.
    if (devicePlatform() !== "web" && typeof document !== "undefined" && document.hidden) nativeCallActive = true;
    pushSnap({
      phase: "incoming", direction: "inbound",
      contact: (c.options?.remoteCallerNumber || (c as { remoteCallerNumber?: string }).remoteCallerNumber || "Unknown caller") as string,
      callerNumber: myCaller, muted: false, quality: "unknown", startedAt: null,
      remainingSec: null, remainingAt: null,
    });
    // A native Answer/Decline that arrived before this leg → apply it now.
    applyPendingNative();
    return;
  }
  // Update for the call we're tracking.
  if (call && c.id === call.id) applyState(st);
}

/** Map the SDK's Verto call state to our phases. */
function applyState(state: string) {
  if (!snap || snap.phase === "ended" || snap.phase === "failed") return;
  switch (state) {
    case "ringing":
    case "early":
      if (snap.direction === "outbound") emit({ phase: "ringing" });
      break;
    case "active":
      emit({ phase: "active", startedAt: snap.startedAt ?? Date.now() });
      startStatsPolling();
      startHeartbeat();
      break;
    case "hangup":
    case "destroy":
    case "purge":
      endCall();
      emit({ phase: "ended" });
      break;
    default:
      if (snap.phase === "connecting" && snap.direction === "outbound") emit({ phase: "connecting" });
  }
}

function startStatsPolling() {
  if (statsTimer || !live) return;
  statsTimer = setInterval(async () => {
    try {
      const pc = call?.peer?.instance;
      if (!pc) return;
      const reports = await pc.getStats();
      let lost = 0, recv = 0, jitter = 0;
      reports.forEach((rep: { type?: string; packetsLost?: number; packetsReceived?: number; jitter?: number }) => {
        if (rep.type === "inbound-rtp") {
          lost += rep.packetsLost ?? 0;
          recv += rep.packetsReceived ?? 0;
          if (typeof rep.jitter === "number") jitter = rep.jitter;
        }
      });
      const dLost = lastStats ? lost - lastStats.lost : lost;
      const dRecv = lastStats ? recv - lastStats.recv : recv;
      lastStats = { lost, recv };
      const ratio = dRecv > 0 ? dLost / (dLost + dRecv) : 0;
      let quality: CallQuality = "excellent";
      if (ratio > 0.08 || jitter > 0.06) quality = "poor";
      else if (ratio > 0.03 || jitter > 0.03) quality = "fair";
      else if (ratio > 0.01) quality = "good";
      emit({ quality });
    } catch { /* stats not accessible */ }
  }, 2500);
}

/** Clear the CURRENT call but keep the client registered for future inbound. */
function endCall() {
  if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
  stopHeartbeat(); // tells the server this call stopped burning budget
  mockTimers.forEach(clearTimeout); mockTimers = [];
  lastStats = null;
  call = null;
  nativeCallActive = false;
}

/* -------------------------------------------------------------------- public */

/** Register in the background so inbound calls ring the app. Call after login. */
export function register() {
  if (!live) return;
  console.info("[voice] register() — connecting for inbound…");
  ensureClient().catch((e) => { console.warn("[voice] register failed:", e?.message); });
}

/** Tear down the client entirely (e.g. on logout). */
export function unregister() {
  endCall();
  try { if (client) client.disconnect(); } catch { /* ignore */ }
  client = null; registered = false; readyPromise = null; snap = null; notify();
}

/** Start an outbound call to `destination`. */
export async function startCall(destination: string, callerNumber: string | null = null) {
  endCall();
  pushSnap({
    phase: "connecting", direction: "outbound", contact: destination,
    callerNumber: callerNumber || myCaller, muted: false,
    quality: live ? "unknown" : "excellent", startedAt: null,
    remainingSec: null, remainingAt: null,
  });

  // Gate BEFORE dialing: no talk-time budget left → don't place the call.
  if (live) {
    const rem = await fetchRemaining();
    if (rem && !rem.allowed) {
      endCall();
      emit({ phase: "failed", error: OUT_OF_TIME_MSG });
      return;
    }
    if (rem) emit({ remainingSec: rem.remainingSec, remainingAt: Date.now() });
  }

  if (!live) {
    mockTimers.push(setTimeout(() => emit({ phase: "ringing" }), 700));
    mockTimers.push(setTimeout(() => emit({ phase: "active", startedAt: Date.now() }), 2100));
    return;
  }

  try {
    await ensureClient();
    if (!snap || snap.phase === "ended") return; // hung up while connecting
    const caller = callerNumber || myCaller;
    emit({ callerNumber: caller });
    call = client!.newCall({
      destinationNumber: destination,
      callerNumber: caller || undefined,
      callerName: myName || "DIGIRINGO",
      audio: true, video: false,
      remoteElement: REMOTE_AUDIO_ID,
    }) as unknown as AnyCall;
  } catch (e) {
    endCall();
    emit({ phase: "failed", error: e instanceof Error ? e.message : "Could not place the call" });
  }
}

/** Answer the ringing inbound call. */
export function answerCall() {
  clearNativeCallNotification();
  nativeCallActive = false;
  pendingNative = null;
  try {
    if (live && call) call.answer();
    else if (!live && snap?.phase === "incoming") emit({ phase: "active", startedAt: Date.now() });
  } catch { /* ignore */ }
}

export function hangupCall() {
  clearNativeCallNotification();
  nativeCallActive = false;
  pendingNative = null;
  try { if (live && call) call.hangup(); } catch { /* ignore */ }
  const wasIncoming = snap?.phase === "incoming";
  endCall();
  if (snap && snap.phase !== "failed") emit({ phase: "ended", startedAt: wasIncoming ? null : snap.startedAt });
}

export function toggleMute(): boolean {
  if (!snap) return false;
  const next = !snap.muted;
  try { if (live && call) { next ? call.muteAudio() : call.unmuteAudio(); } } catch { /* ignore */ }
  emit({ muted: next });
  return next;
}

/** Dismiss the ended/failed overlay. */
export function clearCall() { endCall(); snap = null; notify(); }

/* ---------------------------------- native full-screen call notification bridge */

/** Apply a queued native Answer/Decline once the real WebRTC leg is ringing. */
function applyPendingNative() {
  if (!pendingNative) return;
  if (Date.now() - pendingNativeAt > PENDING_TTL_MS) { pendingNative = null; return; }
  if (!(live && call) || snap?.phase !== "incoming") return; // wait for the leg
  const act = pendingNative; pendingNative = null;
  if (act === "answer") answerCall();
  else hangupCall();
}

/** Seed the in-app incoming UI from the native push (caller number) so a cold /
 *  lock-screen launch shows the call screen instead of the dashboard, even before
 *  the WebRTC leg arrives. The real call overwrites it when it lands. */
function showNativeIncoming(caller: string) {
  if (snap && snap.phase !== "ended" && snap.phase !== "failed") return; // already live
  pushSnap({
    phase: "incoming", direction: "inbound",
    contact: caller && caller !== "Unknown caller" ? caller : "Incoming call",
    callerNumber: myCaller, muted: false, quality: "unknown",
    startedAt: null, remainingSec: null, remainingAt: null,
  });
}

// Called by the Android shell (MainActivity.injectCallAction) when the user acts
// on the full-screen call notification, or when it launches the app over the lock
// screen. No-op on web (never invoked there).
if (typeof window !== "undefined") {
  (window as unknown as { __dgCallAction?: (action: string, caller?: string) => void }).__dgCallAction =
    (action, caller = "") => {
      if (action === "decline") {
        if (live && call) { hangupCall(); return; }
        // No leg yet → remember the decline and drop any seeded UI.
        pendingNative = "decline"; pendingNativeAt = Date.now();
        clearNativeCallNotification();
        if (snap && snap.phase === "incoming") clearCall();
        return;
      }
      // "answer" or "show": a native notification is ringing; bring up the softphone
      // and surface the call UI now (over the lock screen).
      nativeCallActive = true;
      register();
      showNativeIncoming(caller);
      if (action === "answer") {
        if (live && call && snap?.phase === "incoming") answerCall();
        else { pendingNative = "answer"; pendingNativeAt = Date.now(); }
      }
    };
}

// Dev-only: preview the incoming-call UI in mock mode (window.__dgIncoming()).
if (!live && typeof window !== "undefined") {
  (window as unknown as { __dgIncoming?: (from?: string) => void }).__dgIncoming = (from = "+1 (415) 555-7788") => {
    pushSnap({ phase: "incoming", direction: "inbound", contact: from, callerNumber: "+14155550182", muted: false, quality: "unknown", startedAt: null, remainingSec: null, remainingAt: null });
  };
}
