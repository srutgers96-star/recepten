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
import { normalizeRecipe } from '@/domain/recipe-io';
import { applyLineOverrides, applyOverride, RECIPE_PATCH_KEYS, type LineOverride, type RecipeOverride, type RecipePatch } from '@/domain/overrides';
import type { Ingredient } from '@/domain/dictionary';
import { ingredientsData } from '@/domain/data';
import { legacyChoices, planImport, resolveImport, type ImportChoices, type ImportPlan, type LocalState } from '@/domain/merge';
import type { ParsedShare } from '@/domain/share';
import { db, getSetting, setSetting } from './db';
import type { BackupBundle, ImportBefore, ImportSnapshot, ImportWrote, Setting } from './model';

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
  /** Ids of the copies a "both" choice made. */
  copies: string[];
  /** Number of dictionary entries added. */
  ingredients: number;
  /** Row id of the `imports` snapshot (undefined when nothing was written). */
  importId?: number;
}

/** Setting 'inbox.seenIds' (src/inbox-badge.ts): received ids not in it count as unseen. */
const INBOX_SEEN_KEY = 'inbox.seenIds';

let builtinIngredientIds: ReadonlySet<string> | undefined;

/** Everything `planImport` (src/domain/merge.ts) compares an incoming share against. */
export async function localStateForImport(): Promise<LocalState> {
  const [recipes, overrides, userIngredients] = await Promise.all([allRecipes(), db.overrides.toArray(), db.userIngredients.toArray()]);
  if (!builtinIngredientIds) builtinIngredientIds = new Set(ingredientsData.map((i) => i.id));
  return { recipes, overrides, userIngredients, builtinIngredientIds };
}

/**
 * Writes an import plan with the user's choices (src/domain/merge.ts `resolveImport`) in ONE
 * transaction: recipes, overrides, line overrides and user ingredients. Received recipes get
 * `sync` (set by the resolver), the replaced rows go into an `imports` snapshot with their
 * `before` state so `undoLastImport` restores exactly, and the written received ids are removed
 * from 'inbox.seenIds' so the Inbox badge counts them. Items without a choice get the default
 * (new/update applied, the rest skipped). The caller refreshes the dictionary afterwards
 * (`reloadDictionary`) when `ingredients > 0`.
 */
export async function applyImportPlan(plan: ImportPlan, choices: ImportChoices, from: { name: string }): Promise<ImportResult> {
  const now = nowIso();
  const sender = (from.name ?? '').trim() || plan.by || '';
  const effective: ImportPlan = { ...plan };
  if (sender) effective.by = sender;
  else delete effective.by;
  const w = resolveImport(effective, choices, { now });
  const result: ImportResult = { added: w.added, updated: w.updated, skipped: w.skipped, copies: w.copies, ingredients: w.userIngredients.length };
  const nothing = !w.recipes.length && !w.overrides.length && !w.lineOverrides.length && !w.userIngredients.length;
  if (nothing) return result;

  await db.transaction('rw', [db.userRecipes, db.overrides, db.lineOverrides, db.userIngredients, db.imports, db.settings], async () => {
    const before: ImportBefore = { recipes: [], overrides: [], lineOverrides: [], userIngredients: [] };
    const wrote: ImportWrote = { recipes: [], overrides: [], lineOverrides: [], userIngredients: [] };

    for (const r of w.recipes) {
      const cur = await db.userRecipes.get(r.id);
      if (cur) before.recipes.push(cur);
      wrote.recipes.push(r.id);
    }
    for (const o of w.overrides) {
      const cur = await db.overrides.get(o.baseId);
      if (cur) before.overrides.push(cur);
      wrote.overrides.push(o.baseId);
    }
    const lineKeys = new Map<string, [string, number]>();
    for (const id of w.clearLineOverridesFor) {
      for (const o of await db.lineOverrides.where('recipeId').equals(id).toArray()) lineKeys.set(`${o.recipeId}|${o.index}`, [o.recipeId, o.index]);
    }
    for (const o of w.lineOverrides) lineKeys.set(`${o.recipeId}|${o.index}`, [o.recipeId, o.index]);
    for (const k of lineKeys.values()) {
      const cur = await db.lineOverrides.get(k);
      if (cur) before.lineOverrides.push(cur);
      wrote.lineOverrides.push(k);
    }
    for (const e of w.userIngredients) {
      const cur = await db.userIngredients.get(e.id);
      if (cur) before.userIngredients.push(cur);
      wrote.userIngredients.push(e.id);
    }

    if (w.recipes.length) await db.userRecipes.bulkPut(w.recipes);
    if (w.overrides.length) await db.overrides.bulkPut(w.overrides);
    for (const id of w.clearLineOverridesFor) await db.lineOverrides.where('recipeId').equals(id).delete();
    if (w.lineOverrides.length) await db.lineOverrides.bulkPut(w.lineOverrides);
    if (w.userIngredients.length) await db.userIngredients.bulkPut(w.userIngredients);

    // Unseen for the Inbox badge: a re-received (updated) recipe shows up again.
    const received = w.recipes.filter((r) => r.origin.kind === 'received').map((r) => r.id);
    if (received.length) {
      const seen = stringArray((await db.settings.get(INBOX_SEEN_KEY))?.value);
      const drop = new Set(received);
      const kept = seen.filter((id) => !drop.has(id));
      if (kept.length !== seen.length) await db.settings.put({ key: INBOX_SEEN_KEY, value: kept });
    }

    const snapshot: ImportSnapshot = {
      at: now,
      from: sender,
      added: w.added,
      updated: w.updated,
      skipped: w.skipped,
      copies: w.copies,
      previous: before.recipes,
      before,
      wrote,
    };
    result.importId = (await db.imports.add(snapshot)) as number;
  });
  return result;
}

/**
 * Restores the state before the most recent import that has a `before` snapshot and was not
 * undone yet: added rows are deleted, replaced rows put back. Returns false when there is
 * nothing to undo. The caller refreshes the dictionary afterwards.
 */
export async function undoLastImport(): Promise<boolean> {
  const rows = await db.imports.orderBy('at').reverse().toArray();
  const latest = rows.find((s) => !s.undone && s.before && s.wrote);
  if (!latest || latest.id === undefined) return false;
  const before = latest.before as ImportBefore;
  const wrote = latest.wrote as ImportWrote;
  await db.transaction('rw', [db.userRecipes, db.overrides, db.lineOverrides, db.userIngredients, db.imports], async () => {
    if (wrote.recipes.length) await db.userRecipes.bulkDelete(wrote.recipes);
    if (before.recipes.length) await db.userRecipes.bulkPut(before.recipes);
    if (wrote.overrides.length) await db.overrides.bulkDelete(wrote.overrides);
    if (before.overrides.length) await db.overrides.bulkPut(before.overrides);
    if (wrote.lineOverrides.length) await db.lineOverrides.bulkDelete(wrote.lineOverrides);
    if (before.lineOverrides.length) await db.lineOverrides.bulkPut(before.lineOverrides);
    if (wrote.userIngredients.length) await db.userIngredients.bulkDelete(wrote.userIngredients);
    if (before.userIngredients.length) await db.userIngredients.bulkPut(before.userIngredients);
    await db.imports.update(latest.id as number, { undone: true });
  });
  return true;
}

/** The import history, newest first (default the last 10). Only the newest not-undone one can be undone. */
export async function listImports(limit = 10): Promise<ImportSnapshot[]> {
  return db.imports.orderBy('at').reverse().limit(limit).toArray();
}

/**
 * Phase-1 entry point, kept for old callers: imports recipes by id with the phase-1 decisions
 * (conflicts take theirs, look-alikes are added) through planImport / applyImportPlan.
 */
export async function importRecipes(recipes: Recipe[], from: { name: string }): Promise<ImportResult> {
  const list = recipes.map(normalizeRecipe).filter((r): r is Recipe => r !== null);
  const share: ParsedShare = { kind: 'bundle', dict: { ing: [] }, recipes: list, patches: [] };
  const sender = (from.name ?? '').trim();
  if (sender) share.by = sender;
  const plan = planImport(share, await localStateForImport());
  return applyImportPlan(plan, legacyChoices(plan), from);
}

// --- Delta share ("Stuur nieuwe naar <naam>", docs/phase-3-spec.md §3) ---------------------------

export const LAST_SENT_TO_KEY = 'share.lastSentTo';

export interface DeltaSince {
  recipes: Recipe[];
  patches: RecipeOverride[];
  userIngredients: Ingredient[];
  /** Line overrides of the patched classics (fold into the patch envelopes). */
  lineOverrides: LineOverride[];
  /** Effective names of the patched classics by baseId (for the patch envelopes / headers). */
  names: Record<string, { nl?: string; en?: string }>;
}

/** True when a received recipe was edited after it arrived (own recipes always count). */
function editedSinceReceipt(r: Recipe): boolean {
  if (r.origin.kind !== 'received') return true;
  if (r.sync && typeof r.sync.receivedRev === 'number') return r.rev !== r.sync.receivedRev;
  const receivedAt = r.origin.receivedAt ?? r.createdAt;
  return (r.updatedAt ?? '') > (receivedAt ?? '');
}

/**
 * What changed since `sinceIso` (null = everything): own recipes and received ones edited after
 * receipt with `updatedAt > since`, overrides with `updatedAt > since`, and the user ingredients
 * those reference plus the ones saved since.
 */
export async function collectDeltaSince(sinceIso: string | null): Promise<DeltaSince> {
  const since = sinceIso ?? '';
  const [users, overrides, ingredients, builtins] = await Promise.all([db.userRecipes.toArray(), db.overrides.toArray(), db.userIngredients.toArray(), db.builtins.toArray()]);
  const recipes = users.filter((r) => (r.updatedAt ?? '') > since && editedSinceReceipt(r)).sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''));
  const patches = overrides.filter((o) => (o.updatedAt ?? '') > since).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const lineOverrides: LineOverride[] = [];
  const names: DeltaSince['names'] = {};
  const baseById = new Map(builtins.map((b) => [b.id, b]));
  for (const o of patches) {
    lineOverrides.push(...(await listLineOverrides(o.baseId)));
    const base = baseById.get(o.baseId);
    if (base) names[o.baseId] = applyOverride(base, o).name;
  }
  const wanted = new Set<string>();
  const visit = (lines: readonly Recipe['lines'][number][] | undefined) => {
    for (const l of lines ?? []) {
      if (typeof l.ing === 'string' && l.ing) wanted.add(l.ing);
      if (Array.isArray(l.alt)) visit(l.alt);
    }
  };
  for (const r of recipes) visit(r.lines);
  for (const o of patches) if (Array.isArray(o.patch.lines)) visit(o.patch.lines);
  for (const o of lineOverrides) if (typeof o.ing === 'string' && o.ing) wanted.add(o.ing);
  const userIngredients = ingredients.filter((e) => wanted.has(e.id) || (e.updatedAt ?? '') > since).sort((a, b) => a.id.localeCompare(b.id));
  return { recipes, patches, userIngredients, lineOverrides, names };
}

/** Setting 'share.lastSentTo': { [partner name]: ISO of the last successful share }. */
export async function getLastSentTo(): Promise<Record<string, string>> {
  const raw = await getSetting<unknown>(LAST_SENT_TO_KEY, {});
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string' && k.trim()) out[k] = v;
  }
  return out;
}

export async function markSentTo(name: string, atIso: string = nowIso()): Promise<void> {
  const key = name.trim();
  if (!key) return;
  const current = await getLastSentTo();
  current[key] = atIso;
  await setSetting(LAST_SENT_TO_KEY, current);
}

// --- Backup health (docs/phase-3-spec.md §4 Storage / Home) --------------------------------------

export const LAST_BACKUP_KEY = 'backup.lastAt';
const BACKUP_OVERDUE_MS = 30 * 24 * 60 * 60 * 1000;

export interface BackupHealth {
  lastBackupAt: string | null;
  /** Rows (recipes, overrides, line overrides, ingredients, notes, favourites, cook-log entries) changed since the last backup. */
  unbackedChanges: number;
  /** Changes exist and the last backup is older than 30 days (or there never was one). */
  overdue: boolean;
}

export async function backupHealth(): Promise<BackupHealth> {
  const raw = await getSetting<unknown>(LAST_BACKUP_KEY, null);
  const lastBackupAt = typeof raw === 'string' && raw.trim() ? raw : null;
  const since = lastBackupAt ?? '';
  const [recipes, overrides, lineOverrides, ingredients, notes, favorites, cookLog] = await Promise.all([
    db.userRecipes.toArray(),
    db.overrides.toArray(),
    db.lineOverrides.toArray(),
    db.userIngredients.toArray(),
    db.notes.toArray(),
    db.favorites.toArray(),
    db.cookLog.toArray(),
  ]);
  let n = 0;
  for (const r of recipes) if ((r.updatedAt ?? '') > since) n++;
  for (const o of overrides) if ((o.updatedAt ?? '') > since) n++;
  for (const o of lineOverrides) if ((o.updatedAt ?? '') > since) n++;
  // User ingredients saved before phase 3 have no updatedAt: they count only when there was never a backup.
  for (const e of ingredients) if ((e.updatedAt ?? '') > since || !lastBackupAt) n++;
  for (const x of notes) if ((x.updatedAt ?? '') > since) n++;
  for (const f of favorites) if ((f.at ?? '') > since) n++;
  for (const c of cookLog) if ((c.at ?? '') > since) n++;
  const lastMs = lastBackupAt ? new Date(lastBackupAt).getTime() : NaN;
  const old = Number.isNaN(lastMs) || Date.now() - lastMs > BACKUP_OVERDUE_MS;
  return { lastBackupAt, unbackedChanges: n, overdue: n > 0 && old };
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
