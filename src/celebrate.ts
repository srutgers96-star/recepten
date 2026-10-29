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
import { signal } from '@preact/signals';
import { getSetting, setSetting } from '@/db/repo';
import { hash32 } from '@/domain/xp';
import { activeConfettiStyles } from '@/unlocks';

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

/** The burst to show right now (null = none). Cleared by <Confetti/> when it is done. */
export const celebration = signal<Celebration | null>(null);
/** Mirror of the `confetti` setting (default true). */
export const confettiEnabled = signal(true);

let loaded: Promise<void> | null = null;

/** Reads the `confetti` setting once (idempotent). */
export function loadCelebrateSettings(): Promise<void> {
  if (!loaded) {
    loaded = getSetting<boolean>(CONFETTI_SETTING, true)
      .then((on) => {
        confettiEnabled.value = on !== false;
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

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The style of a burst: 'stars' stays plain; the others rotate over the active styles by `at`. */
function pickStyle(kind: CelebrationKind, at: number): string {
  if (kind === 'stars') return DEFAULT_CONFETTI_STYLE;
  const styles = activeConfettiStyles();
  if (styles.length === 0) return DEFAULT_CONFETTI_STYLE;
  return styles[hash32(String(at)) % styles.length] ?? DEFAULT_CONFETTI_STYLE;
}

/**
 * Fire a celebration (no-op when confetti is off or the user prefers reduced motion). `style`
 * forces a confetti style ("Probeer" on Vrijgespeeld); without it the burst picks one itself.
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
