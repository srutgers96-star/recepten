// Dexie 4 database (docs/phase-1-spec.md §3). The name derives from the deploy base so the /next/
// channel never touches the real data (CLAUDE.md invariant 12).
//
// Schema history:
//   v1 (phase 0): userRecipes '++id, name, origin, createdAt' + settings.
//   v2/v3 (phase 1): the schema-2 tables. Dexie cannot change a table's primary key in place, so
//   v2 moves the old userRecipes rows (converted with normalizeRecipe) into a temporary table and
//   v3 moves them into the new `userRecipes` keyed by the string id. A fresh install creates the
//   final schema directly. Only src/db/repo.ts talks to this module.
import Dexie, { type Table } from 'dexie';
import type { CookLogEntry, Favorite, Note, Profile, Recipe, RunningTimer } from '@/domain/model';
import { newProfileId, nowIso } from '@/domain/model';
import { normalizeRecipe } from '@/domain/recipe-io';
import type { ImportSnapshot, Setting, UserRecipe } from './model';

export function dbNameFromBase(base: string): string {
  return /\/next\/?$/.test(base) ? 'recepten-next' : 'recepten';
}

export type AppDatabase = Dexie & {
  builtins: Table<Recipe, string>;
  userRecipes: Table<Recipe, string>;
  favorites: Table<Favorite, [string, string]>;
  notes: Table<Note, [string, string]>;
  cookLog: Table<CookLogEntry, number>;
  profiles: Table<Profile, string>;
  settings: Table<Setting, string>;
  imports: Table<ImportSnapshot, number>;
  timers: Table<RunningTimer, string>;
};

export const db = new Dexie(dbNameFromBase(import.meta.env.BASE_URL)) as AppDatabase;

const SCHEMA_V2_TABLES = {
  builtins: 'id',
  favorites: '[recipeId+profileId], profileId',
  notes: '[recipeId+profileId], profileId',
  cookLog: '++id, recipeId, profileId, at',
  profiles: 'id',
  settings: 'key',
  imports: '++id, at',
  timers: 'id, endAt',
} as const;

const USER_RECIPES_INDEXES = 'id, updatedAt, origin.kind';

db.version(1).stores({
  userRecipes: '++id, name, origin, createdAt',
  settings: 'key',
});

db.version(2)
  .stores({
    ...SCHEMA_V2_TABLES,
    userRecipes: null, // deleted after this upgrade ran (Dexie keeps it readable inside it)
    userRecipesV2: USER_RECIPES_INDEXES,
  })
  .upgrade(async (tx) => {
    const old = (await tx.table('userRecipes').toArray()) as UserRecipe[];
    const converted: Recipe[] = [];
    for (const u of old) {
      const r = normalizeRecipe(u);
      if (r) converted.push(r);
    }
    if (converted.length) await tx.table('userRecipesV2').bulkPut(converted);

    // settings.profileName (phase-0 share screen) seeds the first profile.
    const row = (await tx.table('settings').get('profileName')) as Setting | undefined;
    const name = typeof row?.value === 'string' ? row.value.trim() : '';
    if (name) {
      const profile: Profile = { id: newProfileId(), name, lang: phase0Lang(), color: '#2b4fa8', createdAt: nowIso() };
      await tx.table('profiles').put(profile);
      await tx.table('settings').put({ key: 'activeProfileId', value: profile.id });
    }
  });

db.version(3)
  .stores({
    userRecipesV2: null,
    userRecipes: USER_RECIPES_INDEXES,
  })
  .upgrade(async (tx) => {
    const rows = (await tx.table('userRecipesV2').toArray()) as Recipe[];
    if (rows.length) await tx.table('userRecipes').bulkPut(rows);
  });

/** The phase-0 language choice lived in localStorage; used once, to seed the first profile. */
function phase0Lang(): 'nl' | 'en' {
  try {
    return localStorage.getItem('recepten.lang') === 'en' ? 'en' : 'nl';
  } catch {
    return 'nl';
  }
}

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
