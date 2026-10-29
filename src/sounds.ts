// Timer-end sounds (docs/phase-5-spec.md Block B item 3, PLAN.md §0 "Timer-afloop"): the settings
// `timer.sound` ('beeps' | 'bell' | 'melody' | 'off') and `timer.vibrate`, rendered with WebAudio
// oscillators — no audio files. The 🔔 in the timer bar toggles between 'off' and the last non-'off'
// choice (kept in setting 'timer.soundLast'). The timer engine (src/timers.ts) plays through its own
// tap-unlocked AudioContext; the test button in Meer previews through a module-level context that is
// created/resumed inside the tap.
//
// 6D-4a (docs/specs/xp-levels.md §1g, "Blok 6D-3" bouwer B): four unlockable timer sounds (cowbell,
// gong, kitchen, fanfare) and the ta-da on Cooked! (`cooked.sound`, only plays while the unlock
// `sound-cooked-tada` is active). The ta-da plays through the same tap context as the previews: the
// cook screens wake it with `tapAudioContext()` inside the tap and play once the cook is saved.
import { signal } from '@preact/signals';
import { getSetting, setSetting } from '@/db/repo';

export type TimerSound = 'beeps' | 'bell' | 'melody' | 'cowbell' | 'gong' | 'kitchen' | 'fanfare' | 'off';

export const TIMER_SOUND_SETTING = 'timer.sound';
export const TIMER_VIBRATE_SETTING = 'timer.vibrate';
/** Remembers the last non-'off' choice so the 🔔 toggle can bring it back. */
export const TIMER_SOUND_LAST_SETTING = 'timer.soundLast';
/** 6D-4a: the ta-da when a cook is saved (default on; only heard while `sound-cooked-tada` is unlocked). */
export const COOKED_SOUND_SETTING = 'cooked.sound';

const SOUNDS: readonly TimerSound[] = ['beeps', 'bell', 'melody', 'cowbell', 'gong', 'kitchen', 'fanfare', 'off'];

function normalizeSound(v: unknown, fallback: TimerSound): TimerSound {
  return typeof v === 'string' && (SOUNDS as readonly string[]).includes(v) ? (v as TimerSound) : fallback;
}

/** Mirror of the `timer.sound` setting (default 'beeps'). */
export const timerSound = signal<TimerSound>('beeps');
/** Mirror of the `timer.vibrate` setting (default true). */
export const timerVibrate = signal(true);
/** Mirror of the `cooked.sound` setting (default true). */
export const cookedSound = signal(true);

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
      getSetting<unknown>(COOKED_SOUND_SETTING, true),
    ])
      .then(([sound, vibrate, last, cooked]) => {
        timerSound.value = normalizeSound(sound, 'beeps');
        timerVibrate.value = vibrate !== false;
        cookedSound.value = cooked !== false;
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

export async function setCookedSound(on: boolean): Promise<void> {
  await loadSoundSettings();
  cookedSound.value = on;
  await setSetting(COOKED_SOUND_SETTING, on);
}

/**
 * A timer sound that may no longer be chosen (its unlock was switched off, docs/specs/xp-levels.md
 * §1f/§1g) falls back to 'beeps': as the chosen sound (`timer.sound`), and also as the remembered
 * last choice (`timer.soundLast`) while the timer is muted, so the 🔔 toggle never brings it back.
 */
export async function dropTimerSound(s: TimerSound): Promise<void> {
  if (s === 'off' || s === 'beeps') return;
  await loadSoundSettings();
  if (timerSound.value === s) {
    await setTimerSound('beeps');
    return;
  }
  if (lastNonOff === s) lastNonOff = 'beeps';
  const last = await getSetting<unknown>(TIMER_SOUND_LAST_SETTING, 'beeps');
  if (last === s) await setSetting(TIMER_SOUND_LAST_SETTING, lastNonOff);
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
 * One note: fast attack, exponential decay to silence at `at + decay`, oscillator stopped at
 * `at + stop` (default just past the decay). Sine unless `type` says otherwise (6D-4a), so beeps,
 * bell and melody sound exactly as before.
 */
function note(
  ctx: AudioContext,
  freq: number,
  at: number,
  peak: number,
  decay: number,
  stop: number = decay + 0.05,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
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

// --- 6D-4a: the unlockable sounds (docs/specs/xp-levels.md §3 "Blok 6D-3", recipes verbatim) -----

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/**
 * The notes of a chord share one peak budget (their peaks add up to 0.5), so stacked notes never
 * get louder than the ≤ 0.5 peaks of the other sounds. The recipes give no peak for the chords.
 */
const CHORD_PEAK_TOTAL = 0.5;

/** Two tones at once (587 + 845 Hz, square, peak 0.25, decay 0.25 s), three strikes 0.35 s apart, twice (1.5 s). */
function playCowbell(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) {
      const at = start + round * 1.5 + i * 0.35;
      note(ctx, 587, at, 0.25, 0.25, undefined, 'square');
      note(ctx, 845, at, 0.25, 0.25, undefined, 'square');
    }
  }
}

/** 180 Hz sine (peak 0.35, decay 3 s) with partials 432 Hz (0.12) and 558 Hz (0.08); a second strike after 2.5 s. */
function playGong(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let strike = 0; strike < 2; strike++) {
    const at = start + strike * 2.5;
    note(ctx, 180, at, 0.35, 3);
    note(ctx, 432, at, 0.12, 3);
    note(ctx, 558, at, 0.08, 3);
  }
}

/** Ten ticks (square, 2000 Hz, 0.03 s, peak 0.15, 0.08 s apart), then a 1000 Hz bell (peak 0.4, decay 1 s). */
function playKitchen(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let i = 0; i < 10; i++) {
    note(ctx, 2000, start + i * 0.08, 0.15, 0.03, 0.03, 'square');
  }
  note(ctx, 1000, start + 10 * 0.08, 0.4, 1);
}

/** `freqs` together as one triangle chord at `at`, ringing for `decay` seconds. */
function chord(ctx: AudioContext, freqs: readonly number[], at: number, decay: number) {
  const peak = CHORD_PEAK_TOTAL / freqs.length;
  for (const f of freqs) note(ctx, f, at, peak, decay, undefined, 'triangle');
}

/** Triangle C5 E5 G5 C6 (0.22 s each, peak 0.35), then the chord C5+E5+G5+C6 for 1.2 s. */
function playFanfare(ctx: AudioContext) {
  const start = ctx.currentTime;
  const run = [C5, E5, G5, C6];
  run.forEach((freq, i) => {
    note(ctx, freq, start + i * 0.22, 0.35, 0.2, 0.22, 'triangle');
  });
  chord(ctx, run, start + run.length * 0.22, 1.2);
}

/** Renders the chosen sound on the given (already unlocked) context. 'off' is a no-op. */
export function playTimerSound(ctx: AudioContext, kind: TimerSound): void {
  try {
    if (kind === 'beeps') playBeeps(ctx);
    else if (kind === 'bell') playBell(ctx);
    else if (kind === 'melody') playMelody(ctx);
    else if (kind === 'cowbell') playCowbell(ctx);
    else if (kind === 'gong') playGong(ctx);
    else if (kind === 'kitchen') playKitchen(ctx);
    else if (kind === 'fanfare') playFanfare(ctx);
    // 'off': nothing.
  } catch (e) {
    console.warn('playTimerSound', e);
  }
}

/**
 * The ta-da on Cooked!: triangle C5 G5 C6 0.12 s apart, then the chord C5+E5+G5 for 0.5 s
 * (0.86 s in all, under 1 s). Plays on the given (already unlocked) context.
 */
export function playCookedSound(ctx: AudioContext): void {
  try {
    const start = ctx.currentTime;
    [C5, G5, C6].forEach((freq, i) => {
      note(ctx, freq, start + i * 0.12, 0.35, 0.1, 0.12, 'triangle');
    });
    chord(ctx, [C5, E5, G5], start + 3 * 0.12, 0.5);
  } catch (e) {
    console.warn('playCookedSound', e);
  }
}

let previewCtx: AudioContext | null = null;

/**
 * The module's own AudioContext, created/reused and resumed now. Call it inside the tap: iOS only
 * lets a user gesture wake a context, after which it can still play later (the ta-da once the cook
 * is saved). Null when WebAudio is unavailable.
 */
export function tapAudioContext(): AudioContext | null {
  try {
    const ctx = previewCtx ?? new AudioContext();
    previewCtx = ctx;
    void ctx.resume();
    return ctx;
  } catch (e) {
    console.warn('AudioContext', e);
    return null;
  }
}

/**
 * The test button in Meer (and "Probeer" on Vrijgespeeld): creates/reuses the module's own
 * AudioContext and resumes it inside the tap, then plays the sound through it.
 */
export function previewTimerSound(kind: TimerSound): void {
  if (kind === 'off') return;
  const ctx = tapAudioContext();
  if (ctx) playTimerSound(ctx, kind);
}

/** "Probeer" for the ta-da on Vrijgespeeld: the same tap-context pattern as `previewTimerSound`. */
export function previewCookedSound(): void {
  const ctx = tapAudioContext();
  if (ctx) playCookedSound(ctx);
}
