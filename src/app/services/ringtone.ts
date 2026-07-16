/**
 * Synthesized phone ringtones (Web Audio API) — no audio files needed. Several
 * selectable styles; the choice persists in localStorage and is used both for
 * the incoming-call ring loop and the settings preview.
 */
export type RingtoneId = "classic" | "digital" | "chime" | "retro";

export const RINGTONES: Array<{ id: RingtoneId; name: string; desc: string }> = [
  { id: "classic", name: "Classic", desc: "Traditional dual-tone ring" },
  { id: "digital", name: "Digital", desc: "Modern double beep" },
  { id: "chime", name: "Chime", desc: "Soft ascending bells" },
  { id: "retro", name: "Retro bell", desc: "Old-school telephone trill" },
];

const KEY = "dg-ringtone";
export const getRingtone = (): RingtoneId => {
  try {
    const v = localStorage.getItem(KEY) as RingtoneId | null;
    return v && RINGTONES.some((r) => r.id === v) ? v : "classic";
  } catch { return "classic"; }
};
export const setRingtone = (id: RingtoneId): void => {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
};

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

/** One tone with a soft attack/decay envelope. */
function tone(c: AudioContext, freq: number, at: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.03);
  gain.gain.setValueAtTime(vol, at + dur * 0.75);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(at); osc.stop(at + dur + 0.05);
}

/* Each style: a burst renderer + how often the burst repeats. */
const STYLES: Record<RingtoneId, { burst: (c: AudioContext) => void; intervalMs: number }> = {
  classic: {
    intervalMs: 3000,
    burst: (c) => { const t = c.currentTime; for (const f of [440, 480]) tone(c, f, t, 1.55, 0.18); },
  },
  digital: {
    intervalMs: 2100,
    burst: (c) => {
      const t = c.currentTime;
      for (const dt of [0, 0.28]) { tone(c, 932, t + dt, 0.16, 0.2); tone(c, 1245, t + dt, 0.16, 0.12); }
    },
  },
  chime: {
    intervalMs: 2700,
    burst: (c) => {
      const t = c.currentTime;
      [659, 880, 1109].forEach((f, i) => tone(c, f, t + i * 0.17, 0.9, 0.16, "triangle"));
    },
  },
  retro: {
    intervalMs: 2800,
    burst: (c) => {
      // Rapid bell trill: amplitude-modulated tone pair, like a mechanical bell.
      const t = c.currentTime, dur = 1.3;
      for (const f of [620, 780]) {
        const osc = c.createOscillator(); const gain = c.createGain();
        const lfo = c.createOscillator(); const lfoGain = c.createGain();
        osc.type = "square"; osc.frequency.value = f;
        gain.gain.value = 0.0001;
        gain.gain.setValueAtTime(0.055, t + 0.02);
        gain.gain.setValueAtTime(0.055, t + dur - 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        lfo.frequency.value = 21; lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain); lfoGain.connect(gain.gain);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + dur + 0.05);
        lfo.start(t); lfo.stop(t + dur + 0.05);
      }
    },
  },
};

function makeCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const c = new AC();
    c.resume?.().catch(() => {});
    return c;
  } catch { return null; }
}

/** Loop the SELECTED ringtone while an incoming call rings. */
export function startRingtone(): void {
  stopRingtone();
  const style = STYLES[getRingtone()];
  ctx = makeCtx();
  if (!ctx) return;
  style.burst(ctx);
  timer = setInterval(() => { if (ctx) style.burst(ctx); }, style.intervalMs);
}

export function stopRingtone(): void {
  if (timer) { clearInterval(timer); timer = null; }
  if (ctx) { try { ctx.close(); } catch { /* ignore */ } ctx = null; }
}

/** Play a single burst of a style (settings preview). */
export function previewRingtone(id: RingtoneId): void {
  stopRingtone();
  const c = makeCtx();
  if (!c) return;
  STYLES[id].burst(c);
  setTimeout(() => { try { c.close(); } catch { /* ignore */ } }, 2000);
}
