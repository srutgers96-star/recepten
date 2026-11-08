// Dopamine moments (PLAN.md §0 "Gamification"): `celebrate(kind)` triggers the confetti burst that
// <Confetti/> (src/components/Confetti.tsx, mounted once in the shell) renders. Never in the way:
// off with the setting `confetti = false` and under `prefers-reduced-motion`. Phase 5 block C:
// 'stars' is the small burst (rating a recipe), 'milestone' stays the big one (cook milestones,
// new badges — src/badges.ts fires it from checkNewBadges).
//
// 6D-4a (docs/specs/xp-levels.md §1g): every burst carries a confetti style. 'cooked', 'milestone'
// and 'firstRecipe' pick one from the active styles (`activeConfettiStyles()`: 'default' plus the
// unlocked, switched-on ones), deterministically per burst (`hash32(String(at)) % n`), so it
// alternates without feeling random; 'stars' always stays the small default burst. "Probeer" on
// Vrijgespeeld passes the style it wants to show.
//
// 6D-S (docs/specs/badges-avatar.md block 6D-S, S-B.2): the device-local setting `confetti.style`
// ('random' | a style value; missing = 'random') is chosen in Jouw stijl. A chosen style that this
// phone can use ('default' or an unlocked confetti style) is used for every burst; 'random' (or a
// style no longer usable) keeps the rotation over the mix (`activeConfettiStyles()`). The chosen
// style ignores the mix ("De gekozen vaste stijl negeert de mix"): taking it out of "Verras me"
// does not stop it. Jouw stijl's tiles pass `style` for their preview.
//
// 6E (docs/specs/challenges.md §1c): 'challenge' is the full burst of a challenge done, in the active
// confetti style like 'cooked' and 'milestone' (src/challenges.ts settleChallenges fires it).
//
// V4 (docs/specs/verbeterronde-4.md §1a, §1c): the celebration has a speed, `celebrationSpeed` (1 | 2).
// One tap anywhere while a celebration runs (the word, the confetti or the XP strip) doubles the
// rest of that celebration; it falls back once everything is done. The level-30 unlock "Snelle
// vieringen" plus the device setting `celebrate.fast` makes 2 the default (a tap then keeps it at 2:
// the maximum is 2). The parts of a celebration (<Confetti/>, <CelebrationWord/>, <XpRise/>) hold it
// with `holdCelebration()` while they are on screen and time themselves with `afterCelebration()`,
// which re-plans its remaining time when the speed changes. Under prefers-reduced-motion celebrate()
// still sets `celebration` (the confetti CSS hides itself there) so the word can show statically.
import { computed, signal } from '@preact/signals';
import { badgesEnabled } from '@/badges';
import { getSetting, setSetting } from '@/db/repo';
import { hash32 } from '@/domain/xp';
import { activeConfettiStyles, isActive, unlockData, unlockedOnPhone } from '@/unlocks';

export type CelebrationKind = 'cooked' | 'firstRecipe' | 'milestone' | 'stars' | 'challenge';

export interface Celebration {
  kind: CelebrationKind;
  /** Epoch ms; a new value re-triggers the burst even for the same kind. */
  at: number;
  /** Confetti style (an unlock's `value`, e.g. 'double', 'veggies'); 'default' = the plain burst. */
  style: string;
}

/** The plain burst: no unlock needed. */
export const DEFAULT_CONFETTI_STYLE = 'default';

export const CONFETTI_SETTING = 'confetti';
/** Setting `confetti.style` (device-local, block 6D-S): 'random' or the value of one style. */
export const CONFETTI_STYLE_SETTING = 'confetti.style';
/** `confetti.style` for "Verras me": rotate over the mix (the default when the setting is missing). */
export const RANDOM_CONFETTI_STYLE = 'random';

/** The burst to show right now (null = none). Cleared by <Confetti/> when it is done. */
export const celebration = signal<Celebration | null>(null);
/** Mirror of the `confetti` setting (default true). */
export const confettiEnabled = signal(true);
/** Mirror of the `confetti.style` setting (default 'random'). */
export const confettiStyle = signal<string>(RANDOM_CONFETTI_STYLE);

/** Setting `celebrate.fast` (boolean, default off; V4 §1c): every celebration at double speed. */
export const CELEBRATE_FAST_SETTING = 'celebrate.fast';
/** The unlock (data/unlocks.json, kind 'feature', level 30) that makes `celebrate.fast` count. */
export const FAST_CELEBRATIONS_UNLOCK = 'fast-celebrations';
/** Mirror of the `celebrate.fast` setting (default false). */
export const celebrateFast = signal(false);

export type CelebrationSpeed = 1 | 2;
/** The fastest a celebration gets: a tap on top of "Snelle vieringen" stays 2 (V4 §1c). */
export const MAX_CELEBRATION_SPEED: CelebrationSpeed = 2;

/** True after a tap during the running celebration; reset when every part is done. */
const tapBoost = signal(false);

/** The speed without a tap (pure): 2 with `celebrate.fast` on and the unlock active, else 1. */
export function baseCelebrationSpeed(fast: boolean, unlocked: boolean): CelebrationSpeed {
  return fast && unlocked ? 2 : 1;
}

/** The speed with a tap (pure): a tap doubles, never beyond MAX_CELEBRATION_SPEED. */
export function boostedCelebrationSpeed(base: CelebrationSpeed, tapped: boolean): CelebrationSpeed {
  return tapped ? MAX_CELEBRATION_SPEED : base;
}

/**
 * The speed of the running celebration (1 | 2): word, XP strip and confetti divide their durations by it.
 * With badges off the unlock does not count (docs/specs/xp-levels.md, 6D-4a lens point 1: nothing from
 * the unlocks is seen or heard then, and Jouw stijl hides the switch); a tap still doubles.
 */
export const celebrationSpeed = computed<CelebrationSpeed>(() =>
  boostedCelebrationSpeed(
    baseCelebrationSpeed(celebrateFast.value, badgesEnabled.value && isActive(FAST_CELEBRATIONS_UNLOCK)),
    tapBoost.value,
  ),
);

function normalizeConfettiStyle(v: unknown): string {
  return typeof v === 'string' && v.trim() !== '' ? v : RANDOM_CONFETTI_STYLE;
}

let loaded: Promise<void> | null = null;

/** Reads the `confetti`, `confetti.style` and `celebrate.fast` settings once (idempotent). */
export function loadCelebrateSettings(): Promise<void> {
  if (!loaded) {
    loaded = Promise.all([
      getSetting<boolean>(CONFETTI_SETTING, true),
      getSetting<unknown>(CONFETTI_STYLE_SETTING, RANDOM_CONFETTI_STYLE),
      getSetting<unknown>(CELEBRATE_FAST_SETTING, false),
    ])
      .then(([on, style, fast]) => {
        confettiEnabled.value = on !== false;
        confettiStyle.value = normalizeConfettiStyle(style);
        celebrateFast.value = fast === true;
      })
      .catch(() => undefined);
  }
  return loaded;
}

/** Re-reads the setting from the database (after a restore replaced it). */
export function reloadCelebrateSettings(): Promise<void> {
  loaded = null;
  return loadCelebrateSettings();
}

export async function setConfettiEnabled(on: boolean): Promise<void> {
  confettiEnabled.value = on;
  loaded = Promise.resolve();
  await setSetting(CONFETTI_SETTING, on);
}

/** Jouw stijl: 'random' ("Verras me") or the value of one style ('default', 'trex', …). */
export async function setConfettiStyle(style: string): Promise<void> {
  const v = normalizeConfettiStyle(style);
  confettiStyle.value = v;
  await setSetting(CONFETTI_STYLE_SETTING, v);
}

/** Jouw stijl → Confetti, "Snelle vieringen" (V4 §1c): the device setting `celebrate.fast`. */
export async function setCelebrateFast(on: boolean): Promise<void> {
  celebrateFast.value = on;
  await setSetting(CELEBRATE_FAST_SETTING, on);
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * The confetti style of one burst (pure; block 6D-S, S-B.2). `setting` is `confetti.style`;
 * `active` the styles this phone can use; `mix` the rotation of "Verras me" (defaults to `active`).
 * A chosen style in `active` → that style; 'random', or a style not (any more) in `active` → one of
 * `mix`, picked deterministically by `at` (`hash32(String(at)) % n`, as before 6D-S); an empty
 * `mix` → 'default'.
 */
export function pickConfettiStyle(setting: string, active: readonly string[], at: number, mix: readonly string[] = active): string {
  if (setting !== RANDOM_CONFETTI_STYLE && active.includes(setting)) return setting;
  if (mix.length === 0) return DEFAULT_CONFETTI_STYLE;
  return mix[hash32(String(at)) % mix.length] ?? DEFAULT_CONFETTI_STYLE;
}

/**
 * The confetti styles this phone can use, mix or not: 'default' plus every confetti unlock that a
 * local profile unlocked (`unlockedOnPhone`). Badges off: only 'default' (nothing unlocked to see).
 */
export function usableConfettiStyles(): string[] {
  if (!badgesEnabled.value) return [DEFAULT_CONFETTI_STYLE];
  const unlocked = unlockedOnPhone.value;
  return [DEFAULT_CONFETTI_STYLE, ...unlockData().filter((u) => u.kind === 'confetti' && unlocked.has(u.id)).map((u) => u.value)];
}

/** The style of a burst: 'stars' stays plain; the others follow `confetti.style` (pickConfettiStyle). */
function pickStyle(kind: CelebrationKind, at: number): string {
  if (kind === 'stars') return DEFAULT_CONFETTI_STYLE;
  return pickConfettiStyle(confettiStyle.value, usableConfettiStyles(), at, activeConfettiStyles());
}

/**
 * Fire a celebration (no-op when confetti is off). `style` forces a confetti style (the preview of
 * a tile in Jouw stijl); without it the burst picks one. Under prefers-reduced-motion the burst is
 * still set: <Confetti/> hides itself there by CSS and <CelebrationWord/> shows its word statically
 * (V4 §1a).
 */
export function celebrate(kind: CelebrationKind, opts?: { style?: string }): void {
  void loadCelebrateSettings().then(() => {
    if (!confettiEnabled.value) return;
    const at = Date.now();
    celebration.value = { kind, at, style: opts?.style ?? pickStyle(kind, at) };
  });
}

export function clearCelebration(): void {
  celebration.value = null;
}

// ---------------------------------------------------------------------------- speed (V4 §1c)

let holds = 0;
let tapListening = false;

function onCelebrationTap(): void {
  if (holds > 0) tapBoost.value = true;
}

function setTapListener(on: boolean): void {
  if (typeof document === 'undefined' || on === tapListening) return;
  tapListening = on;
  // Capture phase and passive: the tap still reaches whatever is under the (click-through) overlay.
  if (on) document.addEventListener('pointerdown', onCelebrationTap, { capture: true, passive: true });
  else document.removeEventListener('pointerdown', onCelebrationTap, { capture: true });
}

/**
 * A part of the celebration (confetti, word, XP strip) is on screen: while anything holds it, one
 * tap anywhere sets the speed to 2 for the rest of it. Returns the release (idempotent); when the
 * last hold is released the tap boost resets, so the next celebration starts at the base speed.
 */
export function holdCelebration(): () => void {
  holds++;
  setTapListener(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (holds === 0) {
      setTapListener(false);
      tapBoost.value = false;
    }
  };
}

/** Speeds up the running celebration (what a tap does); no-op when nothing holds it. */
export function speedUpCelebration(): void {
  if (holds > 0) tapBoost.value = true;
}

export interface CelebrationTimer {
  cancel(): void;
  /** Adds `ms` of celebration time (at speed 1) to what is left (Overcooked! keeps the word 1.0 s longer). */
  extend(ms: number): void;
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/**
 * Runs `fn` after `ms` of celebration time: wall-clock time × the speed. When `celebrationSpeed`
 * changes on the way (a tap), the time that is left is re-planned at the new speed.
 */
export function afterCelebration(ms: number, fn: () => void): CelebrationTimer {
  let left = Math.max(0, ms);
  let speed: number = celebrationSpeed.peek();
  let start = nowMs();
  let handle: ReturnType<typeof setTimeout> | null = null;
  let done = false;
  let unsubscribe: () => void = () => undefined;

  const plan = (): void => {
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(fire, left / speed);
  };
  const settle = (): void => {
    const now = nowMs();
    left = Math.max(0, left - (now - start) * speed);
    start = now;
  };
  function fire(): void {
    if (done) return;
    done = true;
    handle = null;
    unsubscribe();
    fn();
  }
  unsubscribe = celebrationSpeed.subscribe((s) => {
    if (done || s === speed) return;
    settle();
    speed = s;
    plan();
  });
  plan();
  return {
    cancel() {
      if (done) return;
      done = true;
      if (handle !== null) clearTimeout(handle);
      unsubscribe();
    },
    extend(extra: number) {
      if (done) return;
      settle();
      left += Math.max(0, extra);
      plan();
    },
  };
}
