// Timer-end sounds (docs/phase-5-spec.md Block B item 3, PLAN.md §0 "Timer-afloop"): the settings
// `timer.sound` ('beeps' | 'bell' | 'melody' | 'off') and `timer.vibrate`, rendered with WebAudio
// oscillators — no audio files. The 🔔 in the timer bar toggles between 'off' and the last non-'off'
// choice (kept in setting 'timer.soundLast'). The timer engine (src/timers.ts) plays through its own
// tap-unlocked AudioContext; the test button in Meer previews through a module-level context that is
// created/resumed inside the tap.
import { signal } from '@preact/signals';
import { getSetting, setSetting } from '@/db/repo';

export type TimerSound = 'beeps' | 'bell' | 'melody' | 'off';

export const TIMER_SOUND_SETTING = 'timer.sound';
export const TIMER_VIBRATE_SETTING = 'timer.vibrate';
/** Remembers the last non-'off' choice so the 🔔 toggle can bring it back. */
export const TIMER_SOUND_LAST_SETTING = 'timer.soundLast';

const SOUNDS: readonly TimerSound[] = ['beeps', 'bell', 'melody', 'off'];

function normalizeSound(v: unknown, fallback: TimerSound): TimerSound {
  return typeof v === 'string' && (SOUNDS as readonly string[]).includes(v) ? (v as TimerSound) : fallback;
}

/** Mirror of the `timer.sound` setting (default 'beeps'). */
export const timerSound = signal<TimerSound>('beeps');
/** Mirror of the `timer.vibrate` setting (default true). */
export const timerVibrate = signal(true);

/** The last non-'off' sound; what the 🔔 toggle switches back to. Never 'off'. */
let lastNonOff: Exclude<TimerSound, 'off'> = 'beeps';

let loaded: Promise<void> | null = null;

/** Reads the sound settings once (idempotent, like src/celebrate.ts). */
export function loadSoundSettings(): Promise<void> {
  if (!loaded) {
    loaded = Promise.all([
      getSetting<unknown>(TIMER_SOUND_SETTING, 'beeps'),
      getSetting<unknown>(TIMER_VIBRATE_SETTING, true),
      getSetting<unknown>(TIMER_SOUND_LAST_SETTING, 'beeps'),
    ])
      .then(([sound, vibrate, last]) => {
        timerSound.value = normalizeSound(sound, 'beeps');
        timerVibrate.value = vibrate !== false;
        const l = normalizeSound(last, 'beeps');
        lastNonOff = l === 'off' ? 'beeps' : l;
        if (timerSound.value !== 'off') lastNonOff = timerSound.value;
      })
      .catch(() => undefined);
  }
  return loaded;
}

/** Re-reads the settings from the database (after a restore replaced them). */
export function reloadSoundSettings(): Promise<void> {
  loaded = null;
  return loadSoundSettings();
}

export async function setTimerSound(s: TimerSound): Promise<void> {
  await loadSoundSettings();
  timerSound.value = s;
  if (s !== 'off') lastNonOff = s;
  await setSetting(TIMER_SOUND_SETTING, s);
  if (s !== 'off') await setSetting(TIMER_SOUND_LAST_SETTING, s);
}

export async function setTimerVibrate(on: boolean): Promise<void> {
  await loadSoundSettings();
  timerVibrate.value = on;
  await setSetting(TIMER_VIBRATE_SETTING, on);
}

/** The 🔔 in the timer bar: off ↔ the last non-'off' sound (default 'beeps'). Returns the new value. */
export async function toggleTimerSound(): Promise<TimerSound> {
  await loadSoundSettings();
  const next: TimerSound = timerSound.value === 'off' ? lastNonOff : 'off';
  await setTimerSound(next);
  return next;
}

// --- WebAudio rendering (total loudness comparable to the original beeps: peaks ≤ 0.5) ------------

/**
 * One sine note: fast attack, exponential decay to silence at `at + decay`, oscillator stopped at
 * `at + stop` (default just past the decay).
 */
function note(ctx: AudioContext, freq: number, at: number, peak: number, decay: number, stop: number = decay + 0.05) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + stop);
}

/**
 * Three short 880 Hz beeps, played twice — the exact pattern that phase 0 proved to sound in the
 * background on Android (moved here from src/timers.ts).
 */
function playBeeps(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) {
      note(ctx, 880, start + round * 1.2 + i * 0.3, 0.5, 0.22, 0.25);
    }
  }
}

/**
 * One warm bell strike, twice: a ~660 Hz fundamental with a long decay plus two quieter upper
 * partials (the highest slightly inharmonic, which is what makes it read as a bell).
 */
function playBell(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let strike = 0; strike < 2; strike++) {
    const at = start + strike * 1.8;
    note(ctx, 660, at, 0.3, 1.5);
    note(ctx, 1320, at, 0.12, 1.1);
    note(ctx, 1848, at, 0.06, 0.8);
  }
}

/** C5–E5–G5–C6–G5. */
const MELODY = [523.25, 659.25, 783.99, 1046.5, 783.99];

/** A short cheerful five-note motif (sine, ~0.18 s per note), played twice. */
function playMelody(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let round = 0; round < 2; round++) {
    MELODY.forEach((freq, i) => {
      note(ctx, freq, start + round * 1.2 + i * 0.18, 0.4, 0.16, 0.18);
    });
  }
}

/** Renders the chosen sound on the given (already unlocked) context. 'off' is a no-op. */
export function playTimerSound(ctx: AudioContext, kind: TimerSound): void {
  try {
    if (kind === 'beeps') playBeeps(ctx);
    else if (kind === 'bell') playBell(ctx);
    else if (kind === 'melody') playMelody(ctx);
    // 'off': nothing.
  } catch (e) {
    console.warn('playTimerSound', e);
  }
}

let previewCtx: AudioContext | null = null;

/**
 * The test button in Meer: creates/reuses the module's own AudioContext and resumes it inside the
 * tap, then plays the sound through it.
 */
export function previewTimerSound(kind: TimerSound): void {
  if (kind === 'off') return;
  try {
    const ctx = previewCtx ?? new AudioContext();
    previewCtx = ctx;
    void ctx.resume();
    playTimerSound(ctx, kind);
  } catch (e) {
    console.warn('previewTimerSound', e);
  }
}
