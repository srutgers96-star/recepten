// "Nu aan het koken" (docs/specs/kookbalk.md, 13K): which recipes you are cooking right now and on
// which cook-mode page, mirrored from the device-local settings row `cook.sessions` — the same shape
// as src/step-amounts.ts (one load, idempotent; writers wait for it) and src/timers.ts (app-level
// signals the bar and the cook screen read). The rules themselves live in src/domain/cooking.ts.
//
// Import direction: this module imports @/timers; src/timers.ts NEVER imports this module.
import { computed, signal, type ReadonlySignal } from '@preact/signals';
import type { Recipe } from '@/domain/model';
import { COOKING_SETTING, normalizeSessions, pruneSessions, upsertSession, type CookingSession } from '@/domain/cooking';
import type { VariantDiet } from '@/domain/diets';
import { getRecipe, getSetting, setSetting } from '@/db/repo';
import { now, startTimerEngine, stopTimer, timers } from '@/timers';

/** Mirror of the `cook.sessions` setting, as stored (may still hold an expired row; read liveSessions). */
export const cookingSessions = signal<CookingSession[]>([]);
/** True once the sessions have been read from the database. */
export const cookingLoaded = signal(false);

/** Derived: pruneSessions(cookingSessions, timers, now) — what the bar and CookScreen read. */
export const liveSessions: ReadonlySignal<CookingSession[]> = computed(() =>
  pruneSessions(cookingSessions.value, timers.value, now.value),
);

let loaded: Promise<void> | null = null;
/** Bumped by reloadCooking so a load that started earlier never overwrites a later one. */
let generation = 0;
let listening = false;

async function save(list: CookingSession[]): Promise<void> {
  try {
    await setSetting(COOKING_SETTING, list);
  } catch (e) {
    console.warn('setSetting cook.sessions', e);
  }
}

/** Drops the expired sessions from the store and writes back when something went. */
async function pruneNow(): Promise<void> {
  const list = cookingSessions.value;
  const kept = pruneSessions(list, timers.value, Date.now());
  if (kept === list) return;
  cookingSessions.value = kept;
  await save(kept);
}

function listenForVisibility() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void loadCooking().then(pruneNow);
  });
}

async function readSessions(gen: number): Promise<void> {
  const raw = await getSetting<unknown>(COOKING_SETTING, []);
  const stored = normalizeSessions(raw);
  // Safety net: a session whose recipe no longer exists (deleted, restore, reset) goes. A failed
  // read keeps the session rather than losing it.
  const exists = await Promise.all(
    stored.map((s) =>
      getRecipe(s.recipeId).then(
        (r) => r !== undefined,
        () => true,
      ),
    ),
  );
  let list = stored.filter((_, i) => exists[i]);
  // Pruning needs the persisted timers (a running timer keeps its session alive): wait for them.
  let timersReady = true;
  try {
    await startTimerEngine();
  } catch (e) {
    timersReady = false;
    console.warn('startTimerEngine', e);
  }
  if (timersReady) list = pruneSessions(list, timers.value, Date.now());
  if (gen !== generation) return;
  cookingSessions.value = list;
  if (list.length !== stored.length) await save(list);
}

/**
 * Reads cook.sessions once (idempotent), prunes expired rows (writes back when something went),
 * and re-prunes on every visibilitychange → 'visible'. app.tsx calls it next to startTimerEngine().
 */
export function loadCooking(): Promise<void> {
  listenForVisibility();
  if (!loaded) {
    const gen = generation;
    loaded = readSessions(gen)
      .catch((e) => console.warn('loadCooking', e))
      .finally(() => {
        if (gen === generation) cookingLoaded.value = true;
      });
  }
  return loaded;
}

/** Re-reads the sessions from the database (after a restore), like reloadShowAmounts. */
export function reloadCooking(): Promise<void> {
  generation += 1;
  loaded = null;
  return loadCooking();
}

/**
 * Upsert: creates the session (startedAt = now) or moves it to `page`; lastActiveAt = now.
 * `servings: null` means "no choice known on this visit" and keeps the number a live session
 * already has: cook mode opened cold (a notification tap, F5 after `?step=`) reads its servings
 * before the store has loaded, and must not wipe the servings the bar row brings back as `&srv=`.
 * 13D blok 3: `variant` is the approved diet version cook mode shows (the bar row brings it back as
 * `&v=`); null = the original. Left out (a caller that does not know the tab, such as a ⏱ chip on
 * the recipe page) it keeps the variant a live session already has, like `servings: null`.
 */
export async function touchCooking(
  recipe: Pick<Recipe, 'id' | 'name' | 'steps'>,
  page: number,
  servings: number | null,
  variant?: VariantDiet | null,
): Promise<void> {
  // Wait for a load that may still be running, or its late write would undo this change.
  await loadCooking();
  const stepCount = recipe.steps.length;
  // The Gekookt page (page > stepCount) writes nothing.
  if (!Number.isInteger(page) || page < 0 || page > stepCount) return;
  const at = Date.now();
  // An expired session is over: touching its recipe again starts a new one.
  const live = pruneSessions(cookingSessions.value, timers.value, at);
  const own = live.find((s) => s.recipeId === recipe.id);
  const kept = servings ?? own?.servings ?? null;
  const keptVariant = variant === undefined ? (own?.variant ?? null) : variant;
  // Through the same normalisation as a stored row, so the mirror equals what a reload reads.
  const session = normalizeSessions([
    { recipeId: recipe.id, page, name: recipe.name, stepCount, servings: kept, startedAt: at, lastActiveAt: at, variant: keptVariant },
  ])[0];
  if (!session) return;
  const list = upsertSession(live, session);
  cookingSessions.value = list;
  await save(list);
}

/** Removes the session and stops EVERY timer of that recipe (stopTimer per id). No-op without session. */
export async function endCooking(recipeId: string): Promise<void> {
  await loadCooking();
  const list = cookingSessions.value;
  if (!list.some((s) => s.recipeId === recipeId)) return;
  const next = list.filter((s) => s.recipeId !== recipeId);
  cookingSessions.value = next;
  const ids = timers.value.filter((t) => t.recipeId === recipeId).map((t) => t.id);
  await Promise.all([save(next), ...ids.map((id) => stopTimer(id))]);
}

/** The live (not expired) session of a recipe, from the signal. */
export function sessionFor(recipeId: string): CookingSession | undefined {
  return liveSessions.value.find((s) => s.recipeId === recipeId);
}
