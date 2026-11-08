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
//
// V5 (docs/specs/verbeterronde-5.md §1b, bouwer B): eight more unlockable timer sounds — marimba, ode,
// mozart, cuckoo, rooster, baby, modem, foghorn. Still oscillator recipes only (no recordings, no
// protected melodies: Beethoven and Mozart are public domain), each ≤ 4 s with peaks ≤ 0.5.
import { signal } from '@preact/signals';
import { getSetting, setSetting } from '@/db/repo';

export type TimerSound =
  | 'beeps'
  | 'bell'
  | 'melody'
  | 'cowbell'
  | 'gong'
  | 'kitchen'
  | 'fanfare'
  | 'marimba'
  | 'ode'
  | 'mozart'
  | 'cuckoo'
  | 'rooster'
  | 'baby'
  | 'modem'
  | 'foghorn'
  | 'off';

export const TIMER_SOUND_SETTING = 'timer.sound';
export const TIMER_VIBRATE_SETTING = 'timer.vibrate';
/** Remembers the last non-'off' choice so the 🔔 toggle can bring it back. */
export const TIMER_SOUND_LAST_SETTING = 'timer.soundLast';
/** 6D-4a: the ta-da when a cook is saved (default on; only heard while `sound-cooked-tada` is unlocked). */
export const COOKED_SOUND_SETTING = 'cooked.sound';

const SOUNDS: readonly TimerSound[] = [
  'beeps', 'bell', 'melody', 'cowbell', 'gong', 'kitchen', 'fanfare',
  'marimba', 'ode', 'mozart', 'cuckoo', 'rooster', 'baby', 'modem', 'foghorn',
  'off',
];

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

// --- V5: eight more unlockable sounds (docs/specs/verbeterronde-5.md §1b, recipes from the table) ----

const D4 = 293.66;
const G4 = 392.0;
const B4 = 493.88;
const D5 = 587.33;
const F5 = 698.46;

/**
 * A held tone with a shaped envelope: linear rise to `peak` over `attack`, held, then a linear fall to
 * silence over `release` (the tone lasts `dur` seconds in all), optionally through a filter. Returns
 * the oscillator so a recipe can automate its frequency (glides, steps) or add vibrato.
 */
function tone(
  ctx: AudioContext,
  freq: number,
  at: number,
  dur: number,
  peak: number,
  type: OscillatorType = 'sine',
  attack = 0.01,
  release = 0.03,
  filter?: { type: BiquadFilterType; freq: number; q?: number },
): OscillatorNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  const a = Math.min(attack, dur / 2);
  const r = Math.min(release, dur - a);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + a);
  gain.gain.setValueAtTime(peak, at + dur - r);
  gain.gain.linearRampToValueAtTime(0, at + dur);
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    if (filter.q !== undefined) f.Q.value = filter.q;
    osc.connect(f).connect(gain).connect(ctx.destination);
  } else {
    osc.connect(gain).connect(ctx.destination);
  }
  osc.start(at);
  osc.stop(at + dur + 0.02);
  return osc;
}

/** A `rate` Hz wobble of ± `depth` Hz on the oscillator's pitch from `at` to `at + dur`. */
function vibrato(ctx: AudioContext, osc: OscillatorNode, rate: number, depth: number, at: number, dur: number) {
  const lfo = ctx.createOscillator();
  const amount = ctx.createGain();
  lfo.frequency.value = rate;
  amount.gain.value = depth;
  lfo.connect(amount).connect(osc.frequency);
  lfo.start(at);
  lfo.stop(at + dur + 0.02);
}

/** `dur` seconds of white noise (a buffer of random samples) at a flat `level`, band-limited. */
function noise(ctx: AudioContext, at: number, dur: number, level: number, band: { freq: number; q: number }) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = band.freq;
  f.Q.value = band.q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.01);
  gain.gain.setValueAtTime(level, at + dur - 0.03);
  gain.gain.linearRampToValueAtTime(0, at + dur);
  src.connect(f).connect(gain).connect(ctx.destination);
  src.start(at);
  src.stop(at + dur + 0.02);
}

/** Own four-note figure "à la classic phone" (no existing ringtone): sine E5 C5 G4 C5, 0.22 s each, twice (≈ 2.1 s). */
function playMarimba(ctx: AudioContext) {
  const start = ctx.currentTime;
  const run = [E5, C5, G4, C5];
  for (let round = 0; round < 2; round++) {
    run.forEach((freq, i) => {
      note(ctx, freq, start + round * 1.2 + i * 0.22, 0.4, 0.2, 0.22);
    });
  }
}

/**
 * Ode an die Freude (Beethoven, public domain): E E F G G F E D C C D E E D D, triangle. The recipe
 * says 0.3 s per note, but 15 notes × 0.3 s is 4.5 s and every sound must stay ≤ 4 s, so the notes
 * are 0.26 s apart (≈ 3.9 s in all; reported as an open point for the spec owner).
 */
const ODE = [E5, E5, F5, G5, G5, F5, E5, D5, C5, C5, D5, E5, E5, D5, D5];
const ODE_STEP = 0.26;
function playOde(ctx: AudioContext) {
  const start = ctx.currentTime;
  ODE.forEach((freq, i) => {
    const len = i === ODE.length - 1 ? ODE_STEP * 1.3 : ODE_STEP;
    note(ctx, freq, start + i * ODE_STEP, 0.35, len * 0.9, len, 'triangle');
  });
}

/**
 * Opening motif of Eine kleine Nachtmusik (Mozart, public domain): G D G D G D G B D in its dotted
 * long–short rhythm, a soft (low-passed, quiet) sawtooth, 2.6 s. Beats: G 1.5 · D 0.5 · G 1.5 · D 0.5 ·
 * G D G B 0.5 each · D 2 (8 beats of 0.325 s).
 */
const MOZART: readonly (readonly [number, number])[] = [
  [G4, 1.5], [D4, 0.5], [G4, 1.5], [D4, 0.5], [G4, 0.5], [D4, 0.5], [G4, 0.5], [B4, 0.5], [D5, 2],
];
function playMozart(ctx: AudioContext) {
  const start = ctx.currentTime;
  const beat = 2.6 / 8;
  let at = start;
  for (const [freq, beats] of MOZART) {
    // The long G's are detached (a quarter and a rest, like the original); the last D rings out.
    const len = beats >= 2 ? beats * beat * 0.95 : Math.min(beats, 1) * beat * 0.9;
    tone(ctx, freq, at, len, 0.18, 'sawtooth', 0.01, Math.min(0.08, len / 2), { type: 'lowpass', freq: 1800 });
    at += beats * beat;
  }
}

/** Cuckoo: E5 → C5 (sine, 6 Hz vibrato), three calls with 0.7 s between them (≈ 3.2 s). */
function playCuckoo(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let call = 0; call < 3; call++) {
    const at = start + call * (0.6 + 0.7);
    const hi = tone(ctx, E5, at, 0.22, 0.4, 'sine', 0.015, 0.06);
    vibrato(ctx, hi, 6, 6, at, 0.22);
    const lo = tone(ctx, C5, at + 0.25, 0.35, 0.4, 'sine', 0.015, 0.15);
    vibrato(ctx, lo, 6, 5, at + 0.25, 0.35);
  }
}

/**
 * Rooster (meant to be funny): a sawtooth glissando 600 → 1100 → 800 Hz with vibrato, in three
 * "syllables" (short, short, long), 1.8 s in all.
 */
const ROOSTER: readonly (readonly [number, number, number, number])[] = [
  // [offset s, duration s, from Hz, to Hz]
  [0, 0.3, 600, 760],
  [0.36, 0.34, 760, 1100],
  [0.76, 1.04, 1100, 800],
];
function playRooster(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (const [offset, dur, from, to] of ROOSTER) {
    const at = start + offset;
    const osc = tone(ctx, from, at, dur, 0.2, 'sawtooth', 0.03, Math.min(0.25, dur / 2), { type: 'lowpass', freq: 2600 });
    // The long last syllable holds its top briefly before sliding down.
    if (dur > 0.5) osc.frequency.setValueAtTime(from, at + 0.25);
    osc.frequency.linearRampToValueAtTime(to, at + dur);
    vibrato(ctx, osc, 9, 18, at, dur);
  }
}

/**
 * Crying baby: two sawtooths (300 Hz + 500 Hz) through one band-pass "formant" that sweeps 400 → 900 →
 * 400 Hz (the wah), three cries of 0.8 s with 0.3 s between them (3 s). The two saws are mixed at 0.5
 * each into an envelope that peaks at 0.5, so the sum never exceeds 0.5.
 */
function playBaby(ctx: AudioContext) {
  const start = ctx.currentTime;
  const dur = 0.8;
  for (let cry = 0; cry < 3; cry++) {
    const at = start + cry * 1.1;
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 3;
    formant.frequency.setValueAtTime(400, at);
    formant.frequency.linearRampToValueAtTime(900, at + 0.3);
    formant.frequency.linearRampToValueAtTime(400, at + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.5, at + 0.08);
    gain.gain.setValueAtTime(0.5, at + dur - 0.2);
    gain.gain.linearRampToValueAtTime(0, at + dur);
    formant.connect(gain).connect(ctx.destination);
    for (const freq of [300, 500]) {
      const osc = ctx.createOscillator();
      const mix = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, at);
      // A small sob in the pitch along with the wah.
      osc.frequency.linearRampToValueAtTime(freq * 1.08, at + 0.3);
      osc.frequency.linearRampToValueAtTime(freq * 0.94, at + dur);
      mix.gain.value = 0.5;
      osc.connect(mix).connect(formant);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    }
  }
}

/** DTMF pairs (row Hz, column Hz) for the digits 1, 5, 9, 0. */
const DTMF: readonly (readonly [number, number])[] = [[697, 1209], [770, 1336], [852, 1477], [941, 1336]];

/**
 * Dial-up modem (3 s): 0.6 s of dialling (four DTMF pairs, 0.1 s on, 0.05 s off), 0.2 s pause, 1.2 s
 * of sines switching between 1200 and 2400 Hz every 0.1 s over white noise, 0.2 s pause, 0.8 s of
 * carrier hum (the 1650/1850 Hz pair with a little noise).
 */
function playModem(ctx: AudioContext) {
  const start = ctx.currentTime;
  DTMF.forEach(([row, col], i) => {
    const at = start + i * 0.15;
    tone(ctx, row, at, 0.1, 0.2);
    tone(ctx, col, at, 0.1, 0.2);
  });
  const hs = start + 0.8;
  const osc = tone(ctx, 1200, hs, 1.2, 0.2);
  for (let k = 1; k < 12; k++) osc.frequency.setValueAtTime(k % 2 === 1 ? 2400 : 1200, hs + k * 0.1);
  noise(ctx, hs, 1.2, 0.15, { freq: 1800, q: 0.7 });
  const carrier = start + 2.2;
  tone(ctx, 1650, carrier, 0.8, 0.15, 'sine', 0.02, 0.06);
  tone(ctx, 1850, carrier, 0.8, 0.15, 'sine', 0.02, 0.06);
  noise(ctx, carrier, 0.8, 0.12, { freq: 1750, q: 1 });
}

/** Foghorn: low sawtooth 110 Hz + 165 Hz, slow rise and fall, twice 1.4 s with 0.3 s between (3.1 s). */
function playFoghorn(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let blast = 0; blast < 2; blast++) {
    const at = start + blast * 1.7;
    tone(ctx, 110, at, 1.4, 0.25, 'sawtooth', 0.35, 0.45, { type: 'lowpass', freq: 700 });
    tone(ctx, 165, at, 1.4, 0.2, 'sawtooth', 0.35, 0.45, { type: 'lowpass', freq: 700 });
  }
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
    else if (kind === 'marimba') playMarimba(ctx);
    else if (kind === 'ode') playOde(ctx);
    else if (kind === 'mozart') playMozart(ctx);
    else if (kind === 'cuckoo') playCuckoo(ctx);
    else if (kind === 'rooster') playRooster(ctx);
    else if (kind === 'baby') playBaby(ctx);
    else if (kind === 'modem') playModem(ctx);
    else if (kind === 'foghorn') playFoghorn(ctx);
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
