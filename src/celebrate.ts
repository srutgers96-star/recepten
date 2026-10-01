// Dopamine moments (PLAN.md §0 "Gamification"): `celebrate(kind)` triggers the confetti burst that
// <Confetti/> (src/components/Confetti.tsx, mounted once in the shell) renders. Never in the way:
// off with the setting `confetti = false` and under `prefers-reduced-motion`. Phase 5 block C:
// 'stars' is the small burst (rating a recipe), 'milestone' stays the big one (cook milestones,
// new badges — src/badges.ts fires it from checkNewBadges).
import { signal } from '@preact/signals';
import { getSetting, setSetting } from '@/db/repo';

export type CelebrationKind = 'cooked' | 'firstRecipe' | 'milestone' | 'stars';

export interface Celebration {
  kind: CelebrationKind;
  /** Epoch ms; a new value re-triggers the burst even for the same kind. */
  at: number;
}

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

/** Fire a celebration (no-op when confetti is off or the user prefers reduced motion). */
export function celebrate(kind: CelebrationKind): void {
  void loadCelebrateSettings().then(() => {
    if (!confettiEnabled.value || prefersReducedMotion()) return;
    celebration.value = { kind, at: Date.now() };
  });
}

export function clearCelebration(): void {
  celebration.value = null;
}
