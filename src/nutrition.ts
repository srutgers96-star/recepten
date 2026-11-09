// V9 (docs/specs/verbeterronde-9.md §1b): the nutrition table and the "Voedingswaarden" setting as
// signals. The table (data/nutrition.json, ~100 KB) is loaded lazily with import() the first time a
// recipe page or the dictionary needs it; a failure logs and leaves an empty table, never a broken page.
import { signal } from '@preact/signals';
import { getNutritionEnabled, setNutritionEnabled as saveNutritionEnabled } from '@/db/repo';
import type { NutritionItem, NutritionTable } from '@/domain/nutrition';

/** The table per 100 g, or null until loadNutrition() has finished. */
export const nutritionTable = signal<NutritionTable | null>(null);

/** Setting 'nutrition.show' (default on). */
export const nutritionEnabled = signal(true);

let loading: Promise<void> | null = null;

/** Loads data/nutrition.json once (memoised). */
export function loadNutrition(): Promise<void> {
  if (!loading) {
    loading = import('../data/nutrition.json')
      .then((mod) => {
        const data = (mod as { default?: unknown }).default ?? mod;
        const items = (data as { items?: unknown }).items;
        nutritionTable.value = items && typeof items === 'object' ? (items as Record<string, NutritionItem>) : {};
      })
      .catch((e: unknown) => {
        console.error('loadNutrition', e);
        nutritionTable.value = {};
      });
  }
  return loading;
}

/** Reads the setting from the database (at boot, and again when Meer opens, e.g. after a restore). */
export async function loadNutritionSetting(): Promise<void> {
  try {
    nutritionEnabled.value = await getNutritionEnabled();
  } catch (e) {
    console.error('loadNutritionSetting', e);
  }
}

export async function setNutritionEnabled(on: boolean): Promise<void> {
  nutritionEnabled.value = on;
  await saveNutritionEnabled(on);
}
