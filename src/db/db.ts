// Dexie 4 database. The name derives from the deploy base so the /next/ channel never touches
// the real data (PLAN.md §4 "Het /next/-kanaal, veilig").
import Dexie, { type EntityTable } from 'dexie';
import type { Setting, UserRecipe } from './model';

export function dbNameFromBase(base: string): string {
  return /\/next\/?$/.test(base) ? 'recepten-next' : 'recepten';
}

export const db = new Dexie(dbNameFromBase(import.meta.env.BASE_URL)) as Dexie & {
  userRecipes: EntityTable<UserRecipe, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

// Device-check answers and the test timer live in localStorage (phase-0 scratch, not records), so
// there is deliberately no `checks` table: nothing dead gets frozen into schema v1.
db.version(1).stores({
  userRecipes: '++id, name, origin, createdAt',
  settings: 'key',
});

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.settings.get(key);
    return row ? (row.value as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
