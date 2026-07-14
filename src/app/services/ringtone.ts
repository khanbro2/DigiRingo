/**
 * Synthesized phone ringtone (Web Audio API) — no audio file needed. Loops a
 * classic dual-tone ring (440 + 480 Hz bursts) while an incoming call is
 * ringing, and stops the moment the call is answered / declined / ended.
 */
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function burst(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const f of [440, 480]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    // ~1.5s tone with soft attack/release, so it sounds like a ring, not a beep.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
    gain.gain.setValueAtTime(0.18, now + 1.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.6);
  }
}

export function startRingtone(): void {
  stopRingtone();
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ctx.resume?.().catch(() => {});
    burst();
    timer = setInterval(burst, 3000); // ring pattern: ~1.5s on, ~1.5s off
  } catch { /* audio unavailable */ }
}

export function stopRingtone(): void {
  if (timer) { clearInterval(timer); timer = null; }
  if (ctx) { try { ctx.close(); } catch { /* ignore */ } ctx = null; }
}
