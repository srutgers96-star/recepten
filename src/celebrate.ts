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
import { signal } from '@preact/signals';
import { badgesEnabled } from '@/badges';
import { getSetting, setSetting } from '@/db/repo';
import { hash32 } from '@/domain/xp';
import { activeConfettiStyles, unlockData, unlockedOnPhone } from '@/unlocks';

export type CelebrationKind = 'cooked' | 'firstRecipe' | 'milestone' | 'stars';

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

function normalizeConfettiStyle(v: unknown): string {
  return typeof v === 'string' && v.trim() !== '' ? v : RANDOM_CONFETTI_STYLE;
}

let loaded: Promise<void> | null = null;

/** Reads the `confetti` and `confetti.style` settings once (idempotent). */
export function loadCelebrateSettings(): Promise<void> {
  if (!loaded) {
    loaded = Promise.all([getSetting<boolean>(CONFETTI_SETTING, true), getSetting<unknown>(CONFETTI_STYLE_SETTING, RANDOM_CONFETTI_STYLE)])
      .then(([on, style]) => {
        confettiEnabled.value = on !== false;
        confettiStyle.value = normalizeConfettiStyle(style);
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
 * Fire a celebration (no-op when confetti is off or the user prefers reduced motion). `style`
 * forces a confetti style (the preview of a tile in Jouw stijl); without it the burst picks one.
 */
export function celebrate(kind: CelebrationKind, opts?: { style?: string }): void {
  void loadCelebrateSettings().then(() => {
    if (!confettiEnabled.value || prefersReducedMotion()) return;
    const at = Date.now();
    celebration.value = { kind, at, style: opts?.style ?? pickStyle(kind, at) };
  });
}

export function clearCelebration(): void {
  celebration.value = null;
}
