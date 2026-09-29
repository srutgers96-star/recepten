// The repository (docs/phase-1-spec.md §3): the ONLY module the UI talks to for data. All async,
// all typed. Builtins come from the bundled data/recipes.json and are refreshed when its
// dataVersion changes; user + received recipes live in `userRecipes`.
import recipesData from '@data/recipes.json';
import {
  newUserId,
  nowIso,
  type CookLogEntry,
  type Favorite,
  type Note,
  type Profile,
  type Recipe,
  type RunningTimer,
} from '@/domain/model';
import { normalizeRecipe, recipeFingerprint } from '@/domain/recipe-io';
import { applyLineOverrides, applyOverride, RECIPE_PATCH_KEYS, type LineOverride, type RecipeOverride, type RecipePatch } from '@/domain/overrides';
import type { Ingredient } from '@/domain/dictionary';
import { db, getSetting, setSetting } from './db';
import type { BackupBundle, ImportSnapshot, Setting } from './model';

export { getSetting, setSetting };

// --- Settings keys (phase 2) -------------------------------------------------------------------

/** Setting 'units.fahrenheit' (boolean): append °F to oven temperatures in the English edition. */
export const FAHRENHEIT_KEY = 'units.fahrenheit';

export async function getFahrenheit(): Promise<boolean> {
  return (await getSetting<unknown>(FAHRENHEIT_KEY, false)) === true;
}

export async function setFahrenheit(on: boolean): Promise<void> {
  await setSetting(FAHRENHEIT_KEY, on === true);
}

interface RecipesFile {
  schema: 2;
  dataVersion: number;
  generatedAt: string;
  recipes: Recipe[];
}

/** The bundled classics (data/recipes.json), typed. */
export const bundled = recipesData as unknown as RecipesFile;

export const DATA_VERSION_KEY = 'dataVersion';

export function isBuiltinId(id: string): boolean {
  return id.startsWith('b:');
}

// --- Builtins ---------------------------------------------------------------------------------

/** Copies the bundled classics into `builtins` when settings.dataVersion differs from the bundle. */
export async function ensureBuiltins(): Promise<void> {
  const current = await getSetting<number>(DATA_VERSION_KEY, 0);
  if (current === bundled.dataVersion) {
    // Cheap sanity check: a half-finished first import leaves the table empty.
    if ((await db.builtins.count()) > 0) return;
  }
  await db.transaction('rw', db.builtins, db.settings, async () => {
    await db.builtins.clear();
    await db.builtins.bulkPut(bundled.recipes);
    await db.settings.put({ key: DATA_VERSION_KEY, value: bundled.dataVersion });
  });
}

// --- Recipes -----------------------------------------------------------------------------------

/**
 * Builtins (with their override patch applied, see src/domain/overrides.ts) + user/received
 * recipes, in one list (a user recipe with a builtin id would win).
 */
export async function allRecipes(): Promise<Recipe[]> {
  const [builtins, users, overrides] = await Promise.all([db.builtins.toArray(), db.userRecipes.toArray(), db.overrides.toArray()]);
  const patches = new Map<string, RecipeOverride>();
  for (const o of overrides) patches.set(o.baseId, o);
  const byId = new Map<string, Recipe>();
  for (const r of builtins) byId.set(r.id, applyOverride(r, patches.get(r.id)));
  for (const r of users) byId.set(r.id, r);
  return [...byId.values()];
}

/** A recipe by id; a builtin comes with its override patch applied. */
export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const user = await db.userRecipes.get(id);
  if (user) return user;
  const base = await db.builtins.get(id);
  if (!base) return undefined;
  return applyOverride(base, await db.overrides.get(id));
}

/** The bundled builtin as shipped, WITHOUT its override (for "herstel origineel" / diffs). */
export async function getBaseRecipe(id: string): Promise<Recipe | undefined> {
  return db.builtins.get(id);
}

/** Own and received recipes only. */
export async function userRecipes(): Promise<Recipe[]> {
  return db.userRecipes.toArray();
}

/**
 * Insert or update an own/received recipe: bumps rev + updatedAt. Builtins are read-only.
 * An own recipe keeps its corrections IN the lines (`ing` on the line), so any index-keyed
 * `lineOverrides` rows of that id are cleared here: the editor may have inserted or removed
 * rows, after which such rows would point at the wrong line. Callers that want to keep them
 * fold them into `r.lines` first (`effectiveLines`), as the editor does on load.
 */
export async function saveUserRecipe(r: Recipe): Promise<void> {
  if (isBuiltinId(r.id)) throw new Error('builtin-readonly');
  const now = nowIso();
  await db.transaction('rw', db.userRecipes, db.lineOverrides, async () => {
    const existing = await db.userRecipes.get(r.id);
    const rev = existing ? existing.rev + 1 : Math.max(1, Math.floor(r.rev || 1));
    await db.userRecipes.put({ ...r, schema: 2, rev, createdAt: existing?.createdAt ?? r.createdAt ?? now, updatedAt: now });
    await db.lineOverrides.where('recipeId').equals(r.id).delete();
  });
}

/**
 * "Koppel ingrediënt" on one line of an own/received recipe: written into the line itself
 * (`ing`, confidence 1), never as a line override. Throws Error('builtin-readonly') for a
 * builtin (use `setLineOverride`) and Error('not-found') / Error('no-such-line') otherwise.
 */
export async function linkUserRecipeLine(recipeId: string, index: number, ing: string | null): Promise<void> {
  if (isBuiltinId(recipeId)) throw new Error('builtin-readonly');
  const r = await db.userRecipes.get(recipeId);
  if (!r) throw new Error('not-found');
  const overrides = await listLineOverrides(recipeId);
  const lines = applyLineOverrides(r.lines, overrides);
  const line = lines[index];
  if (!line || line.kind === 'header') throw new Error('no-such-line');
  lines[index] = ing ? { ...line, ing, confidence: 1 } : { ...line, ing: null };
  await saveUserRecipe({ ...r, lines });
}

export async function deleteUserRecipe(id: string): Promise<void> {
  await db.transaction('rw', db.userRecipes, db.favorites, db.notes, db.lineOverrides, async () => {
    await db.userRecipes.delete(id);
    await db.favorites.where('recipeId').equals(id).delete();
    await db.notes.where('recipeId').equals(id).delete();
    await db.lineOverrides.where('recipeId').equals(id).delete();
  });
}

// --- Line overrides ("Koppel ingrediënt" on a builtin's line) ------------------------------------

/** All line overrides of a recipe, by index ascending. */
export async function listLineOverrides(recipeId: string): Promise<LineOverride[]> {
  const rows = await db.lineOverrides.where('recipeId').equals(recipeId).toArray();
  return rows.sort((a, b) => a.index - b.index);
}

/**
 * Stores a line override (put by [recipeId+index]; `updatedAt` is set here). Keys that are
 * absent stay absent (untouched by `mergeLineOverride`); pass null to unlink/clear explicitly.
 * An override without ing/qual/prep removes the row.
 */
export async function setLineOverride(o: Omit<LineOverride, 'updatedAt'> & { updatedAt?: string }): Promise<void> {
  if (!o || typeof o.recipeId !== 'string' || !Number.isInteger(o.index) || o.index < 0) throw new Error('invalid-line-override');
  const row: LineOverride = { recipeId: o.recipeId, index: o.index, updatedAt: nowIso() };
  if (o.ing !== undefined) row.ing = o.ing;
  if (o.qual !== undefined) row.qual = [...o.qual];
  if (o.prep !== undefined) row.prep = o.prep === null ? null : { ...o.prep };
  if (row.ing === undefined && row.qual === undefined && row.prep === undefined) {
    await db.lineOverrides.delete([o.recipeId, o.index]);
    return;
  }
  await db.lineOverrides.put(row);
}

export async function clearLineOverride(recipeId: string, index: number): Promise<void> {
  await db.lineOverrides.delete([recipeId, index]);
}

// --- User ingredients (dictionary entries created in the app) ------------------------------------

/** All user-created dictionary entries, sorted by id. */
export async function listUserIngredients(): Promise<Ingredient[]> {
  const rows = await db.userIngredients.toArray();
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Inserts or replaces a user ingredient (put by id). The caller (IngredientPicker) chooses an id
 * that does not collide with the bundled dictionary, and calls `reloadDictionary()` afterwards.
 */
export async function saveUserIngredient(entry: Ingredient): Promise<void> {
  if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) throw new Error('invalid-ingredient-id');
  if (!entry.nl?.one?.trim() && !entry.en?.one?.trim()) throw new Error('invalid-ingredient-name');
  await db.userIngredients.put(entry);
}

export async function deleteUserIngredient(id: string): Promise<void> {
  await db.userIngredients.delete(id);
}

// --- Recipe overrides (curator patches on builtins) -----------------------------------------------

export async function getOverride(baseId: string): Promise<RecipeOverride | undefined> {
  return db.overrides.get(baseId);
}

export async function listOverrides(): Promise<RecipeOverride[]> {
  return db.overrides.toArray();
}

/** Recipe keys a patch may NOT carry (identity and bookkeeping live on the builtin). */
const PROTECTED_RECIPE_KEYS = new Set(['schema', 'id', 'rev', 'createdAt', 'updatedAt', 'origin', 'servings', 'goesWith', 'aliases', 'override']);

/**
 * Saves the patch for a builtin (rev bumped on every save, `updatedAt` set here). The patch
 * REPLACES the stored one; merge with `getOverride()` first when you only change one field.
 * The schema-2 patch keys (name, description, steps, lines, category, tags, servingTip) and
 * unknown keys are kept, identity keys are dropped; an empty patch removes the override.
 * Throws Error('override-builtin-only') for a non-builtin id.
 */
export async function saveOverride(o: { baseId: string; patch: RecipePatch; by?: string | null }): Promise<RecipeOverride | undefined> {
  if (!o || !isBuiltinId(o.baseId)) throw new Error('override-builtin-only');
  const patch: RecipePatch = {};
  for (const [k, v] of Object.entries(o.patch ?? {})) {
    if (v === undefined) continue;
    if ((RECIPE_PATCH_KEYS as readonly string[]).includes(k) || !PROTECTED_RECIPE_KEYS.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    await db.overrides.delete(o.baseId);
    return undefined;
  }
  return db.transaction('rw', db.overrides, async () => {
    const existing = await db.overrides.get(o.baseId);
    const row: RecipeOverride = {
      baseId: o.baseId,
      rev: existing ? existing.rev + 1 : 1,
      patch,
      updatedAt: nowIso(),
      by: o.by ?? existing?.by ?? null,
    };
    await db.overrides.put(row);
    return row;
  });
}

/** Removes the override: the builtin renders as shipped again. */
export async function clearOverride(baseId: string): Promise<void> {
  await db.overrides.delete(baseId);
}

/**
 * Builtin (or any recipe) -> a fresh own copy with origin.basedOn set; saved and returned. The
 * source's line overrides ("Koppel ingrediënt" on the detail page) are folded into the copy's
 * lines, so the copy keeps those links.
 */
export async function duplicateAsOwn(r: Recipe, profile: Profile): Promise<Recipe> {
  const now = nowIso();
  const lines = applyLineOverrides(r.lines, await listLineOverrides(r.id));
  const copy: Recipe = {
    ...r,
    schema: 2,
    id: newUserId(),
    rev: 1,
    createdAt: now,
    updatedAt: now,
    origin: { kind: 'user', author: profile.name, basedOn: r.id },
    lines: lines.map((l) => ({ ...l, raw: { ...l.raw } })),
    steps: r.steps.map((s) => ({ ...s, text: { ...s.text }, ...(s.timers ? { timers: s.timers.map((t) => ({ ...t })) } : {}) })),
    tags: [...r.tags],
    goesWith: [...r.goesWith],
    aliases: [...r.aliases],
  };
  // A builtin read through getRecipe() carries the applied-override marker (applyOverride);
  // an own copy is a plain recipe again.
  delete (copy as { override?: unknown }).override;
  await db.userRecipes.put(copy);
  return copy;
}

// --- Favorites ---------------------------------------------------------------------------------

export async function listFavorites(profileId: string): Promise<Set<string>> {
  const rows = await db.favorites.where('profileId').equals(profileId).toArray();
  return new Set(rows.map((f) => f.recipeId));
}

/** Toggles and returns the new state (true = now a favourite). */
export async function toggleFavorite(recipeId: string, profileId: string): Promise<boolean> {
  return db.transaction('rw', db.favorites, async () => {
    const key: [string, string] = [recipeId, profileId];
    const existing = await db.favorites.get(key);
    if (existing) {
      await db.favorites.delete(key);
      return false;
    }
    const fav: Favorite = { recipeId, profileId, at: nowIso() };
    await db.favorites.put(fav);
    return true;
  });
}

// --- Notes -------------------------------------------------------------------------------------

export async function getNote(recipeId: string, profileId: string): Promise<string> {
  const row = await db.notes.get([recipeId, profileId]);
  return row?.text ?? '';
}

/** Empty text removes the note. */
export async function setNote(recipeId: string, profileId: string, text: string): Promise<void> {
  const key: [string, string] = [recipeId, profileId];
  if (text.trim() === '') {
    await db.notes.delete(key);
    return;
  }
  const note: Note = { recipeId, profileId, text, updatedAt: nowIso() };
  await db.notes.put(note);
}

// --- Cook log ----------------------------------------------------------------------------------

export async function logCooked(entry: Omit<CookLogEntry, 'id'>): Promise<void> {
  const row: CookLogEntry = { ...entry, at: entry.at || nowIso() };
  if (row.stars !== undefined && row.stars !== null) row.stars = Math.min(5, Math.max(1, Math.round(row.stars)));
  await db.cookLog.add(row);
}

/** Newest first; all profiles when `profileId` is omitted. */
export async function recentCooked(profileId?: string, limit = 10): Promise<CookLogEntry[]> {
  let coll = db.cookLog.orderBy('at').reverse();
  if (profileId) coll = coll.filter((e) => e.profileId === profileId);
  return coll.limit(limit).toArray();
}

export async function cookStats(recipeId: string): Promise<{ count: number; last?: string }> {
  const rows = await db.cookLog.where('recipeId').equals(recipeId).toArray();
  let last: string | undefined;
  for (const r of rows) if (last === undefined || r.at > last) last = r.at;
  return last === undefined ? { count: rows.length } : { count: rows.length, last };
}

/** Distinct recipe ids ever logged as cooked ("Samen al N van de 196"). */
export async function cookedRecipeIds(): Promise<Set<string>> {
  const rows = await db.cookLog.toArray();
  return new Set(rows.map((r) => r.recipeId));
}

// --- Profiles ----------------------------------------------------------------------------------

export async function listProfiles(): Promise<Profile[]> {
  const rows = await db.profiles.toArray();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveProfile(p: Profile): Promise<void> {
  await db.profiles.put(p);
}

/** Removes the profile and its favorites and notes; the cook log keeps its history. */
export async function deleteProfile(id: string): Promise<void> {
  await db.transaction('rw', db.profiles, db.favorites, db.notes, async () => {
    await db.profiles.delete(id);
    await db.favorites.where('profileId').equals(id).delete();
    await db.notes.where('profileId').equals(id).delete();
  });
}

// --- Import / export ---------------------------------------------------------------------------

export interface ImportResult {
  added: string[];
  updated: string[];
  skipped: string[];
}

/**
 * Imports recipes by id: unknown id -> added (origin received, from `from.name`); known user
 * recipe with the same fingerprint -> skipped; known with another fingerprint -> updated (rev
 * bumped, previous version kept in the `imports` snapshot); builtin ids are always skipped.
 * An empty sender name is stored as null (the UI then shows "ontvangen" without a name).
 */
export async function importRecipes(recipes: Recipe[], from: { name: string }): Promise<ImportResult> {
  const now = nowIso();
  const sender = (from.name ?? '').trim() || null;
  const result: ImportResult = { added: [], updated: [], skipped: [] };
  const previous: Recipe[] = [];
  await db.transaction('rw', db.userRecipes, db.builtins, db.imports, async () => {
    for (const incoming of recipes) {
      const r = normalizeRecipe(incoming);
      if (!r) continue;
      if (isBuiltinId(r.id) && (await db.builtins.get(r.id))) {
        result.skipped.push(r.id);
        continue;
      }
      const existing = await db.userRecipes.get(r.id);
      if (existing) {
        if (recipeFingerprint(existing) === recipeFingerprint(r)) {
          result.skipped.push(r.id);
          continue;
        }
        previous.push(existing);
        await db.userRecipes.put({
          ...r,
          rev: existing.rev + 1,
          createdAt: existing.createdAt,
          updatedAt: now,
          origin: { ...existing.origin, receivedFrom: sender ?? existing.origin.receivedFrom ?? null, receivedAt: now },
        });
        result.updated.push(r.id);
      } else {
        await db.userRecipes.put({
          ...r,
          rev: 1,
          updatedAt: now,
          origin: { ...r.origin, kind: 'received', receivedFrom: sender, receivedAt: now },
        });
        result.added.push(r.id);
      }
    }
    if (result.added.length || result.updated.length) {
      const snapshot: ImportSnapshot = { at: now, from: sender ?? '', ...result, previous };
      await db.imports.add(snapshot);
    }
  });
  return result;
}

export async function exportBundle(): Promise<BackupBundle> {
  const [profiles, userRecipes, favorites, notes, cookLog, settings, lineOverrides, userIngredients, overrides] = await Promise.all([
    listProfiles(),
    db.userRecipes.toArray(),
    db.favorites.toArray(),
    db.notes.toArray(),
    db.cookLog.orderBy('at').toArray(),
    db.settings.toArray(),
    db.lineOverrides.toArray(),
    db.userIngredients.toArray(),
    db.overrides.toArray(),
  ]);
  return {
    v: 2,
    t: 'b',
    at: nowIso(),
    app: 'recepten',
    profiles,
    userRecipes,
    favorites,
    notes,
    cookLog,
    settings: settings.filter((s) => s.key !== DATA_VERSION_KEY),
    lineOverrides,
    userIngredients,
    overrides,
  };
}

export interface RestoreResult {
  recipes: number;
  favorites: number;
  notes: number;
  cookLog: number;
  profiles: number;
}

/** Settings that belong to this phone, not to the person: a restore never overwrites them. */
const DEVICE_LOCAL_SETTINGS = new Set(['theme', 'backup.lastAt']);
/** Only restored when this phone had no profile yet (a fresh install), never on a merge. */
const ACTIVE_PROFILE_SETTING = 'activeProfileId';
/** Merged (union) instead of replaced, so a restore never re-badges recipes already seen here. */
const INBOX_SEEN_SETTING = 'inbox.seenIds';

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Merges a backup into the database (put by key; cook-log entries deduplicated on
 * recipeId+profileId+at). Device-local settings (theme, last backup date, and the active profile
 * when a profile already exists) are left alone, so restoring the other person's backup on this
 * phone adds their recipes/favourites without switching who this phone is. Throws
 * Error('invalid-bundle') for anything that is not a v2 backup. The caller refreshes the in-memory
 * mirrors afterwards (loadProfiles, reloadCelebrateSettings).
 */
export async function importBundle(b: BackupBundle): Promise<RestoreResult> {
  if (!b || typeof b !== 'object' || b.v !== 2 || b.t !== 'b') throw new Error('invalid-bundle');
  const profiles = Array.isArray(b.profiles) ? b.profiles.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string') : [];
  const recipes = (Array.isArray(b.userRecipes) ? b.userRecipes : []).map(normalizeRecipe).filter((r): r is Recipe => r !== null && !isBuiltinId(r.id));
  const favorites = Array.isArray(b.favorites) ? b.favorites.filter((f) => f && typeof f.recipeId === 'string' && typeof f.profileId === 'string') : [];
  const notes = Array.isArray(b.notes) ? b.notes.filter((n) => n && typeof n.recipeId === 'string' && typeof n.profileId === 'string' && typeof n.text === 'string') : [];
  const cookLog = Array.isArray(b.cookLog) ? b.cookLog.filter((e) => e && typeof e.recipeId === 'string' && typeof e.profileId === 'string' && typeof e.at === 'string') : [];
  const settings: Setting[] = Array.isArray(b.settings)
    ? b.settings.filter((s) => s && typeof s.key === 'string' && s.key !== DATA_VERSION_KEY && !DEVICE_LOCAL_SETTINGS.has(s.key))
    : [];
  // Phase-2 tables (absent in older backups): put by key, the newer `updatedAt` wins on a merge.
  const lineOverrides = Array.isArray(b.lineOverrides)
    ? b.lineOverrides.filter((o) => o && typeof o.recipeId === 'string' && Number.isInteger(o.index) && o.index >= 0)
    : [];
  const userIngredients = Array.isArray(b.userIngredients)
    ? b.userIngredients.filter((i) => i && typeof i.id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(i.id) && i.nl && i.en)
    : [];
  const overrides = Array.isArray(b.overrides)
    ? b.overrides.filter((o) => o && typeof o.baseId === 'string' && isBuiltinId(o.baseId) && o.patch && typeof o.patch === 'object')
    : [];

  let addedLog = 0;
  await db.transaction('rw', [db.profiles, db.userRecipes, db.favorites, db.notes, db.cookLog, db.settings, db.lineOverrides, db.userIngredients, db.overrides], async () => {
    const hadProfiles = (await db.profiles.count()) > 0;
    await db.profiles.bulkPut(profiles);
    await db.userRecipes.bulkPut(recipes);
    await db.userIngredients.bulkPut(userIngredients);
    for (const o of lineOverrides) {
      const cur = await db.lineOverrides.get([o.recipeId, o.index]);
      if (!cur || (cur.updatedAt ?? '') <= (o.updatedAt ?? '')) await db.lineOverrides.put({ ...o, updatedAt: o.updatedAt || nowIso() });
    }
    for (const o of overrides) {
      const cur = await db.overrides.get(o.baseId);
      if (!cur || (cur.updatedAt ?? '') <= (o.updatedAt ?? '')) await db.overrides.put({ ...o, rev: Math.max(1, Math.floor(o.rev || 1)), updatedAt: o.updatedAt || nowIso() });
    }
    await db.favorites.bulkPut(favorites.map((f) => ({ recipeId: f.recipeId, profileId: f.profileId, at: f.at || nowIso() })));
    await db.notes.bulkPut(notes.map((n) => ({ recipeId: n.recipeId, profileId: n.profileId, text: n.text, updatedAt: n.updatedAt || nowIso() })));
    const existing = new Set((await db.cookLog.toArray()).map((e) => `${e.recipeId}|${e.profileId}|${e.at}`));
    const fresh: CookLogEntry[] = [];
    for (const e of cookLog) {
      const k = `${e.recipeId}|${e.profileId}|${e.at}`;
      if (existing.has(k)) continue;
      existing.add(k);
      const { id: _id, ...rest } = e;
      fresh.push(rest);
    }
    if (fresh.length) await db.cookLog.bulkAdd(fresh);
    addedLog = fresh.length;
    for (const s of settings) {
      if (s.key === ACTIVE_PROFILE_SETTING && hadProfiles) continue;
      if (s.key === INBOX_SEEN_SETTING) {
        const current = stringArray((await db.settings.get(s.key))?.value);
        await db.settings.put({ key: s.key, value: [...new Set([...current, ...stringArray(s.value)])] });
        continue;
      }
      await db.settings.put({ key: s.key, value: s.value });
    }
  });
  return { recipes: recipes.length, favorites: favorites.length, notes: notes.length, cookLog: addedLog, profiles: profiles.length };
}

// --- Timers ------------------------------------------------------------------------------------

export async function listTimers(): Promise<RunningTimer[]> {
  return db.timers.orderBy('endAt').toArray();
}

export async function putTimer(t: RunningTimer): Promise<void> {
  await db.timers.put(t);
}

export async function deleteTimer(id: string): Promise<void> {
  await db.timers.delete(id);
}
