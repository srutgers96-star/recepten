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
import type { Dictionary, Ingredient } from '@/domain/dictionary';
import { ingredientsData } from '@/domain/data';
import { legacyChoices, planImport, resolveImport, type ImportChoices, type ImportPlan, type LocalState } from '@/domain/merge';
import type { ParsedShare } from '@/domain/share';
import { aggregate, type ListItem } from '@/domain/aggregate';
import { DEFAULT_SERVINGS, emptyPlan, newPlanItem, normalizeServings, planHash, planHashAll, type Plan, type PlanItem } from '@/domain/planner';
import { HOUSEHOLD_KEY, normalizeHousehold, type HouseholdSetting } from '@/domain/household';
import { db, getSetting, setSetting } from './db';
import type { BackupBundle, ImportBefore, ImportSnapshot, ImportWrote, List, PantryItem, Setting } from './model';

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
 * Inserts or replaces a user ingredient (put by id); `updatedAt` is stamped here, so the entry
 * counts as a change for backups / delta shares and wins the "newer updatedAt" rule against an
 * older copy from the other phone (imports bypass this and keep the sender's stamp: bulkPut in
 * applyImportPlan / importBundle). The caller (IngredientPicker) chooses an id that does not
 * collide with the bundled dictionary, and calls `reloadDictionary()` afterwards.
 */
export async function saveUserIngredient(entry: Ingredient): Promise<void> {
  if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) throw new Error('invalid-ingredient-id');
  if (!entry.nl?.one?.trim() && !entry.en?.one?.trim()) throw new Error('invalid-ingredient-name');
  await db.userIngredients.put({ ...entry, updatedAt: nowIso() });
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
 * unknown keys are kept, identity keys are dropped; an empty patch removes the override. A
 * received override keeps its `sync` (the rev bump then makes it "touched since receipt").
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
    if (existing?.sync) row.sync = existing.sync;
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
  // A builtin read through getRecipe() carries the applied-override marker (applyOverride) and a
  // received recipe its receiver-side `sync`; an own copy is a plain recipe again.
  delete (copy as { override?: unknown }).override;
  delete (copy as { sync?: unknown }).sync;
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

/**
 * Everything `planImport` (src/domain/merge.ts) compares an incoming share against: the recipes
 * as the user sees them (overrides applied), the classics as shipped (`bases`, so a "both" copy
 * of an incoming patch is their version and not a blend with my override), the overrides and
 * the user ingredients.
 */
export async function localStateForImport(): Promise<LocalState> {
  const [recipes, bases, overrides, userIngredients] = await Promise.all([allRecipes(), db.builtins.toArray(), db.overrides.toArray(), db.userIngredients.toArray()]);
  if (!builtinIngredientIds) builtinIngredientIds = new Set(ingredientsData.map((i) => i.id));
  return { recipes, bases, overrides, userIngredients, builtinIngredientIds };
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

    // Unseen for the Inbox badge: a re-received (updated) recipe shows up again. The dropped
    // ids go into the snapshot so an undo does not leave a restored recipe badged as unseen.
    const received = w.recipes.filter((r) => r.origin.kind === 'received').map((r) => r.id);
    if (received.length) {
      const seen = stringArray((await db.settings.get(INBOX_SEEN_KEY))?.value);
      const drop = new Set(received);
      const kept = seen.filter((id) => !drop.has(id));
      if (kept.length !== seen.length) {
        before.seenIds = seen.filter((id) => drop.has(id));
        await db.settings.put({ key: INBOX_SEEN_KEY, value: kept });
      }
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

/** True for the snapshot "Maak ongedaan" may restore: the NEWEST import, not undone, with a phase-3 snapshot. */
export function isUndoable(latest: ImportSnapshot | undefined): latest is ImportSnapshot & { id: number; before: ImportBefore; wrote: ImportWrote } {
  return !!latest && latest.id !== undefined && !latest.undone && !!latest.before && !!latest.wrote;
}

/**
 * Restores the state before the most recent import (docs/phase-3-spec.md §4: "until the next
 * import"): added rows are deleted, replaced rows put back, the received ids the import
 * re-badged as unseen are marked seen again. Only the NEWEST snapshot can be undone: an older
 * one may hold rows the user edited since. Returns false when there is nothing to undo. The
 * caller refreshes the dictionary afterwards.
 */
export async function undoLastImport(): Promise<boolean> {
  const latest = await db.imports.orderBy('at').reverse().first();
  if (!isUndoable(latest)) return false;
  const { before, wrote } = latest;
  await db.transaction('rw', [db.userRecipes, db.overrides, db.lineOverrides, db.userIngredients, db.imports, db.settings], async () => {
    if (wrote.recipes.length) await db.userRecipes.bulkDelete(wrote.recipes);
    if (before.recipes.length) await db.userRecipes.bulkPut(before.recipes);
    if (wrote.overrides.length) await db.overrides.bulkDelete(wrote.overrides);
    if (before.overrides.length) await db.overrides.bulkPut(before.overrides);
    if (wrote.lineOverrides.length) await db.lineOverrides.bulkDelete(wrote.lineOverrides);
    if (before.lineOverrides.length) await db.lineOverrides.bulkPut(before.lineOverrides);
    if (wrote.userIngredients.length) await db.userIngredients.bulkDelete(wrote.userIngredients);
    if (before.userIngredients.length) await db.userIngredients.bulkPut(before.userIngredients);
    if (before.seenIds?.length) {
      const seen = stringArray((await db.settings.get(INBOX_SEEN_KEY))?.value);
      await db.settings.put({ key: INBOX_SEEN_KEY, value: [...new Set([...seen, ...before.seenIds])] });
    }
    await db.imports.update(latest.id, { undone: true });
  });
  return true;
}

/** The import history, newest first (default the last 10). Only the newest one can be undone (`isUndoable`). */
export async function listImports(limit = 10): Promise<ImportSnapshot[]> {
  return db.imports.orderBy('at').reverse().limit(limit).toArray();
}

/** A classic whose override came in through an import: who sent it and when (newest import wins). */
export interface ReceivedPatch {
  baseId: string;
  from: string;
  at: string;
}

/**
 * Classics adjusted by someone else: every `'p:' + baseId` in a non-undone import's `added` /
 * `updated` whose override still exists and (phase-3 snapshots) whose override row that import
 * wrote — a links-only patch writes no override, so my own override is never credited to the
 * sender. Shared by the Inbox list ("aangepast door X") and the unseen badge (seen key =
 * `'p:' + baseId` in 'inbox.seenIds'), so both count the same rows.
 */
export async function receivedPatches(): Promise<ReceivedPatch[]> {
  const [imports, overrides] = await Promise.all([db.imports.orderBy('at').reverse().toArray(), db.overrides.toArray()]);
  const overridden = new Set(overrides.map((o) => o.baseId));
  const out = new Map<string, ReceivedPatch>();
  for (const s of imports) {
    if (s.undone) continue;
    for (const id of [...s.added, ...s.updated]) {
      if (!id.startsWith('p:')) continue;
      const baseId = id.slice(2);
      if (!overridden.has(baseId) || out.has(baseId)) continue;
      if (s.wrote && !s.wrote.overrides.includes(baseId)) continue;
      out.set(baseId, { baseId, from: s.from, at: s.at });
    }
  }
  return [...out.values()];
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
  /** ISO timestamp of the OLDEST change that is in no backup yet (null when there is none). */
  oldestChangeAt: string | null;
  /**
   * "> 30 days of un-backed-up changes" (ADR-0003): the oldest change that is in no backup is
   * more than 30 days old. A change made yesterday is never overdue, however old the last
   * backup is; a fresh install becomes overdue 30 days after its first change.
   */
  overdue: boolean;
}

export async function backupHealth(now: number = Date.now()): Promise<BackupHealth> {
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
  let oldest: string | null = null;
  /** Counts a change with its timestamp; an unknown timestamp (phase-2 rows) counts as very old. */
  const change = (at: string | undefined) => {
    n++;
    const iso = at && !Number.isNaN(new Date(at).getTime()) ? at : '1970-01-01T00:00:00.000Z';
    if (oldest === null || iso < oldest) oldest = iso;
  };
  for (const r of recipes) if ((r.updatedAt ?? '') > since) change(r.updatedAt);
  for (const o of overrides) if ((o.updatedAt ?? '') > since) change(o.updatedAt);
  for (const o of lineOverrides) if ((o.updatedAt ?? '') > since) change(o.updatedAt);
  // User ingredients saved before phase 3 have no updatedAt: they count only when there was never a backup.
  for (const e of ingredients) if ((e.updatedAt ?? '') > since || !lastBackupAt) change(e.updatedAt);
  for (const x of notes) if ((x.updatedAt ?? '') > since) change(x.updatedAt);
  for (const f of favorites) if ((f.at ?? '') > since) change(f.at);
  for (const c of cookLog) if ((c.at ?? '') > since) change(c.at);
  const oldestChangeAt: string | null = oldest;
  const overdue = oldestChangeAt !== null && now - new Date(oldestChangeAt).getTime() > BACKUP_OVERDUE_MS;
  return { lastBackupAt, unbackedChanges: n, oldestChangeAt, overdue };
}

export async function exportBundle(): Promise<BackupBundle> {
  const [profiles, userRecipes, favorites, notes, cookLog, settings, lineOverrides, userIngredients, overrides, plans, lists, pantry] = await Promise.all([
    listProfiles(),
    db.userRecipes.toArray(),
    db.favorites.toArray(),
    db.notes.toArray(),
    db.cookLog.orderBy('at').toArray(),
    db.settings.toArray(),
    db.lineOverrides.toArray(),
    db.userIngredients.toArray(),
    db.overrides.toArray(),
    db.plans.toArray(),
    db.lists.toArray(),
    db.pantry.toArray(),
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
    plans,
    lists,
    pantry,
  };
}

/** What a restore wrote per table (rows the file held but a newer local row won against are not counted). */
export interface RestoreResult {
  recipes: number;
  favorites: number;
  notes: number;
  cookLog: number;
  profiles: number;
  overrides: number;
  lineOverrides: number;
  userIngredients: number;
  /** Phase 4: 1 when the file's plan / list replaced (or created) the local one, else 0. */
  plans?: number;
  lists?: number;
  pantry?: number;
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
  // Phase-4 rows (absent in older backups): one plan and one list, the newer `updatedAt` wins.
  const plan = Array.isArray(b.plans) ? b.plans.find((p) => p && p.id === PLAN_ID && Array.isArray(p.items)) : undefined;
  const list = Array.isArray(b.lists) ? b.lists.find((l) => l && l.id === LIST_ID && Array.isArray(l.items)) : undefined;
  const pantry = Array.isArray(b.pantry) ? b.pantry.filter((p) => p && typeof p.ing === 'string' && p.ing.trim()) : [];

  let addedLog = 0;
  let wroteLineOverrides = 0;
  let wroteOverrides = 0;
  let wrotePlan = 0;
  let wroteList = 0;
  await db.transaction('rw', [db.profiles, db.userRecipes, db.favorites, db.notes, db.cookLog, db.settings, db.lineOverrides, db.userIngredients, db.overrides, db.plans, db.lists, db.pantry], async () => {
    const hadProfiles = (await db.profiles.count()) > 0;
    await db.profiles.bulkPut(profiles);
    await db.userRecipes.bulkPut(recipes);
    await db.userIngredients.bulkPut(userIngredients);
    if (plan) {
      const cur = await db.plans.get(PLAN_ID);
      if (!cur || (cur.updatedAt ?? '') <= (plan.updatedAt ?? '')) {
        await db.plans.put({ ...plan, id: PLAN_ID, updatedAt: plan.updatedAt || nowIso() });
        wrotePlan = 1;
      }
    }
    if (list) {
      const cur = await db.lists.get(LIST_ID);
      if (!cur || (cur.updatedAt ?? '') <= (list.updatedAt ?? '')) {
        await db.lists.put({
          ...list,
          id: LIST_ID,
          extras: Array.isArray(list.extras) ? list.extras : [],
          pinned: Array.isArray(list.pinned) ? list.pinned : [],
          generatedFrom: typeof list.generatedFrom === 'string' ? list.generatedFrom : '',
          generatedAt: list.generatedAt || nowIso(),
          updatedAt: list.updatedAt || nowIso(),
        });
        wroteList = 1;
      }
    }
    if (pantry.length) await db.pantry.bulkPut(pantry.map((p) => (typeof p.until === 'string' ? { ing: p.ing, until: p.until } : { ing: p.ing })));
    for (const o of lineOverrides) {
      const cur = await db.lineOverrides.get([o.recipeId, o.index]);
      if (cur && (cur.updatedAt ?? '') > (o.updatedAt ?? '')) continue;
      await db.lineOverrides.put({ ...o, updatedAt: o.updatedAt || nowIso() });
      wroteLineOverrides++;
    }
    for (const o of overrides) {
      const cur = await db.overrides.get(o.baseId);
      if (cur && (cur.updatedAt ?? '') > (o.updatedAt ?? '')) continue;
      await db.overrides.put({ ...o, rev: Math.max(1, Math.floor(o.rev || 1)), updatedAt: o.updatedAt || nowIso() });
      wroteOverrides++;
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
  return {
    recipes: recipes.length,
    favorites: favorites.length,
    notes: notes.length,
    cookLog: addedLog,
    profiles: profiles.length,
    overrides: wroteOverrides,
    lineOverrides: wroteLineOverrides,
    userIngredients: userIngredients.length,
    plans: wrotePlan,
    lists: wroteList,
    pantry: pantry.length,
  };
}

// --- Week plan (docs/phase-4-spec.md §2) -----------------------------------------------------------

const PLAN_ID = 'current';
const LIST_ID = 'current';

/** Setting 'household.servings' (number, default 4): the servings a new plan slot starts with. */
export const HOUSEHOLD_SERVINGS_KEY = 'household.servings';

export async function getHouseholdServings(): Promise<number> {
  return normalizeServings(await getSetting<unknown>(HOUSEHOLD_SERVINGS_KEY, DEFAULT_SERVINGS));
}

export async function setHouseholdServings(n: number): Promise<void> {
  await setSetting(HOUSEHOLD_SERVINGS_KEY, normalizeServings(n));
}

// --- Household (docs/phase-5-spec.md block A.8) -----------------------------------------------------

/** Setting 'household' ({ name, members }): the household name and the hand-added members (src/domain/household.ts). */
export async function getHousehold(): Promise<HouseholdSetting> {
  return normalizeHousehold(await getSetting<unknown>(HOUSEHOLD_KEY, null));
}

export async function setHousehold(h: HouseholdSetting): Promise<void> {
  await setSetting(HOUSEHOLD_KEY, normalizeHousehold(h));
}

// --- Reset (docs/phase-5-spec.md 30-09 "Reset app") ------------------------------------------------

/**
 * "App resetten": clears EVERY Dexie table (builtins included: `ensureBuiltins` re-seeds them on
 * the next boot because settings.dataVersion is gone too) and every `recepten.*` localStorage key
 * (language, theme mirror, chip selections, device-check answers, fired timers). The service
 * worker and its caches are untouched. The caller reloads to '#/' afterwards: the in-memory
 * signals (profiles, dictionary, theme) are stale until then, and onboarding takes over.
 */
export async function resetEverything(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('recepten.')) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

/** The current plan; an empty one (not stored) when there is none. */
export async function getPlan(): Promise<Plan> {
  const row = await db.plans.get(PLAN_ID);
  if (!row) return emptyPlan();
  return { ...row, id: PLAN_ID, items: Array.isArray(row.items) ? row.items : [] };
}

/** Stores the plan as 'current' with `updatedAt` stamped here. Returns the stored plan. */
export async function savePlan(plan: Plan): Promise<Plan> {
  const items: PlanItem[] = (Array.isArray(plan.items) ? plan.items : [])
    .filter((p) => p && typeof p.id === 'string' && typeof p.recipeId === 'string')
    .map((p) => ({ ...p, servings: normalizeServings(p.servings), addedAt: p.addedAt || nowIso() }));
  const row: Plan = { ...plan, id: PLAN_ID, items, updatedAt: nowIso() };
  const note = typeof plan.note === 'string' ? plan.note.trim() : '';
  if (note) row.note = note;
  else delete row.note;
  await db.plans.put(row);
  return row;
}

/** Read-modify-write of the plan in one transaction. */
async function updatePlan(fn: (plan: Plan) => Plan | void): Promise<Plan> {
  return db.transaction('rw', db.plans, db.settings, async () => {
    const plan = await getPlan();
    const next = fn(plan) ?? plan;
    return savePlan(next);
  });
}

/**
 * Adds a dish (servings default: the household size). A recipe already in the plan is not added
 * twice: its slot is returned instead. Returns the slot.
 */
export async function addToPlan(recipeId: string, servings?: number): Promise<PlanItem> {
  const n = normalizeServings(servings, await getHouseholdServings());
  let item: PlanItem | undefined;
  await updatePlan((plan) => {
    const existing = plan.items.find((p) => p.recipeId === recipeId);
    if (existing) {
      item = existing;
      return;
    }
    item = newPlanItem(recipeId, n);
    return { ...plan, items: [...plan.items, item] };
  });
  return item as PlanItem;
}

export async function removeFromPlan(itemId: string): Promise<void> {
  await updatePlan((plan) => ({ ...plan, items: plan.items.filter((p) => p.id !== itemId) }));
}

export async function setPlanServings(itemId: string, n: number): Promise<void> {
  await updatePlan((plan) => ({ ...plan, items: plan.items.map((p) => (p.id === itemId ? { ...p, servings: normalizeServings(n, p.servings) } : p)) }));
}

/** Toggles the lock and returns the new state. */
export async function togglePlanLock(itemId: string): Promise<boolean> {
  let locked = false;
  await updatePlan((plan) => ({
    ...plan,
    items: plan.items.map((p) => {
      if (p.id !== itemId) return p;
      locked = !p.locked;
      const next = { ...p };
      if (locked) next.locked = true;
      else delete next.locked;
      return next;
    }),
  }));
  return locked;
}

/** "Gekookt" on a slot: the dish stays in the plan but leaves the shopping list. */
export async function markPlanCooked(itemId: string, cooked: boolean): Promise<void> {
  await updatePlan((plan) => ({
    ...plan,
    items: plan.items.map((p) => {
      if (p.id !== itemId) return p;
      const next = { ...p };
      if (cooked) next.cooked = true;
      else delete next.cooked;
      return next;
    }),
  }));
}

/**
 * "Gekookt!" from cook mode: marks the slot(s) of that recipe cooked when the recipe is in the
 * plan (no-op otherwise). Returns true when a slot was marked.
 */
export async function markRecipeCookedInPlan(recipeId: string): Promise<boolean> {
  let hit = false;
  await updatePlan((plan) => {
    if (!plan.items.some((p) => p.recipeId === recipeId && !p.cooked)) return;
    hit = true;
    return { ...plan, items: plan.items.map((p) => (p.recipeId === recipeId ? { ...p, cooked: true } : p)) };
  });
  return hit;
}

export async function clearPlan(): Promise<void> {
  await db.plans.delete(PLAN_ID);
}

// --- Shopping list --------------------------------------------------------------------------------

export async function getList(): Promise<List | undefined> {
  const row = await db.lists.get(LIST_ID);
  if (!row) return undefined;
  return {
    ...row,
    id: LIST_ID,
    items: Array.isArray(row.items) ? row.items : [],
    extras: Array.isArray(row.extras) ? row.extras : [],
    pinned: Array.isArray(row.pinned) ? row.pinned : [],
  };
}

/** Stores the list as 'current' with `updatedAt` stamped here (`pinned` is re-derived from the items). */
export async function saveList(list: List): Promise<List> {
  const items = Array.isArray(list.items) ? list.items.filter((it) => it && typeof it.key === 'string') : [];
  const extras = (Array.isArray(list.extras) ? list.extras : []).filter((it) => it && typeof it.key === 'string');
  const row: List = {
    ...list,
    id: LIST_ID,
    items,
    extras,
    pinned: items.filter((it) => it.pinned).map((it) => it.key),
    generatedFrom: typeof list.generatedFrom === 'string' ? list.generatedFrom : '',
    generatedAt: list.generatedAt || nowIso(),
    updatedAt: nowIso(),
  };
  await db.lists.put(row);
  return row;
}

/** An empty list (not stored): the all-in shopping list before any plan. */
function newList(): List {
  const now = nowIso();
  return { id: LIST_ID, items: [], generatedFrom: '', generatedAt: now, extras: [], pinned: [], updatedAt: now, sharedAt: null };
}

async function updateList(fn: (list: List) => List | void): Promise<List> {
  return db.transaction('rw', db.lists, async () => {
    const list = (await getList()) ?? newList();
    return saveList(fn(list) ?? list);
  });
}

/**
 * Regenerates the list from the current plan: `aggregate` over the dishes that are not cooked,
 * with the effective lines (line overrides applied), the pantry, the extras and the previous
 * list (checks / in-house / adjustments / pins survive by key; new keys are `fresh`). The
 * dictionary is a parameter because the repo knows no signals: pass `dictionary.value`
 * (src/dictionary.ts). Returns the stored list.
 */
export async function generateList(dict: Dictionary): Promise<List> {
  const [plan, previous, pantry, overrides] = await Promise.all([getPlan(), getList(), listPantry(), db.lineOverrides.toArray()]);
  const recipes = new Map<string, Recipe>();
  for (const p of plan.items) {
    if (p.cooked || recipes.has(p.recipeId)) continue;
    const r = await getRecipe(p.recipeId);
    if (r) recipes.set(r.id, r);
  }
  const overridesByRecipe = new Map<string, LineOverride[]>();
  for (const o of overrides) {
    const list = overridesByRecipe.get(o.recipeId) ?? [];
    list.push(o);
    overridesByRecipe.set(o.recipeId, list);
  }
  const items = aggregate({
    plan,
    recipes,
    lines: (id) => {
      const r = recipes.get(id);
      return r ? applyLineOverrides(r.lines, overridesByRecipe.get(id)) : [];
    },
    dict,
    pantry: new Set(pantry.map((p) => p.ing)),
    extras: previous?.extras ?? [],
    ...(previous ? { previous: previous.items } : {}),
  });
  const now = nowIso();
  const list: List = {
    ...(previous ?? newList()),
    id: LIST_ID,
    items,
    generatedFrom: planHash(plan),
    generatedFromAll: planHashAll(plan),
    generatedAt: now,
    extras: previous?.extras ?? [],
    pinned: items.filter((it) => it.pinned).map((it) => it.key),
    updatedAt: now,
  };
  return saveList(list);
}

/**
 * True when the plan changed since the list was generated (no list + dishes in the plan counts
 * too). Ticking "Gekookt" alone does not count: when the full set of dishes + servings
 * (`planHashAll`) is what the list was generated from, nothing needs buying. (Un-ticking a dish
 * that was already cooked at generation is the one case this misses; "Bijwerken" is a tap away.)
 */
export async function isListStale(): Promise<boolean> {
  const [plan, list] = await Promise.all([getPlan(), getList()]);
  const hash = planHash(plan);
  if (!list) return hash !== '';
  if (list.generatedFrom === hash) return false;
  if (typeof list.generatedFromAll !== 'string') return true;
  return list.generatedFromAll !== planHashAll(plan);
}

/** Fields the user may change on an item in place (everything else is the generator's). */
export type ListItemPatch = Partial<Pick<ListItem, 'checked' | 'inHouse' | 'adjusted' | 'pinned' | 'qty' | 'unit' | 'aisle' | 'label' | 'fresh'>>;

/** Merges a patch into the item with that key (also in `extras` when it is one). No-op for an unknown key. */
export async function setListItem(key: string, patch: ListItemPatch): Promise<void> {
  await updateList((list) => {
    const apply = (it: ListItem): ListItem => {
      if (it.key !== key) return it;
      const next = { ...it } as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete next[k];
        else next[k] = v;
      }
      return next as unknown as ListItem;
    };
    return { ...list, items: list.items.map(apply), extras: list.extras.map(apply) };
  });
}

/**
 * Adds a manual item ("+ wc-papier"): key 'x|<id>' unless given, `manual: true`, aisle from the
 * dictionary id when it has one (the caller passes `aisle` for unknown items). Returns the item.
 */
export async function addExtra(item: Partial<ListItem> & { key?: string }): Promise<ListItem> {
  const extra: ListItem = {
    ...item,
    key: item.key && item.key.trim() ? item.key : `x|${newUserId().slice(2)}`,
    aisle: item.aisle || 'overig',
    section: item.section === 'inHouse' ? 'inHouse' : 'main',
    sources: Array.isArray(item.sources) ? item.sources : [],
    manual: true,
  };
  await updateList((list) => {
    const others = list.items.filter((it) => it.key !== extra.key);
    const otherExtras = list.extras.filter((it) => it.key !== extra.key);
    return { ...list, items: [...others, extra], extras: [...otherExtras, extra] };
  });
  return extra;
}

/** Removes an item by key from the list (and from the extras). Works for generated items too ("Verwijder"). */
export async function removeExtra(key: string): Promise<void> {
  await updateList((list) => ({ ...list, items: list.items.filter((it) => it.key !== key), extras: list.extras.filter((it) => it.key !== key) }));
}

/**
 * Undo of "Verwijder": puts the item back exactly as it was. A generated item returns to `items`
 * only (the next regeneration recreates it from the plan); a manual one also to `extras`. An
 * item with the same key is replaced.
 */
export async function restoreListItem(item: ListItem): Promise<void> {
  await updateList((list) => {
    const items = [...list.items.filter((it) => it.key !== item.key), item];
    const extras = item.manual ? [...list.extras.filter((it) => it.key !== item.key), item] : list.extras;
    return { ...list, items, extras };
  });
}

/** "Elke week": toggles the pin and returns the new state. A pinned item survives regeneration. */
export async function togglePinned(key: string): Promise<boolean> {
  let pinned = false;
  await updateList((list) => {
    const flip = (it: ListItem): ListItem => {
      if (it.key !== key) return it;
      pinned = !it.pinned;
      const next = { ...it };
      if (pinned) next.pinned = true;
      else delete next.pinned;
      return next;
    };
    return { ...list, items: list.items.map(flip), extras: list.extras.map(flip) };
  });
  return pinned;
}

/** "Klaar": clears every check (the plan, the pins and the in-house flags stay). */
export async function clearChecks(): Promise<void> {
  await updateList((list) => {
    const clear = (it: ListItem): ListItem => {
      if (!it.checked) return it;
      const next = { ...it };
      delete next.checked;
      return next;
    };
    return { ...list, items: list.items.map(clear), extras: list.extras.map(clear) };
  });
}

/** "Deel lijst" happened: remembers the moment for "gedeeld om hh:mm" / "gewijzigd sinds delen". */
export async function markListShared(atIso: string = nowIso()): Promise<void> {
  // `sharedAt` and `updatedAt` get the SAME stamp: "gewijzigd sinds delen" is then exactly
  // "updatedAt > sharedAt" (saveList would otherwise stamp updatedAt a few ms later).
  await db.transaction('rw', db.lists, async () => {
    const list = (await getList()) ?? newList();
    const row = await saveList({ ...list, sharedAt: atIso });
    await db.lists.put({ ...row, updatedAt: atIso });
  });
}

// --- Pantry ("Heb ik al") -------------------------------------------------------------------------

/** How long a non-perishable "in huis" is remembered. */
export const PANTRY_DAYS = 21;

/** The pantry rows that are still valid (expired ones are removed on read). */
export async function listPantry(now: number = Date.now()): Promise<PantryItem[]> {
  const rows = await db.pantry.toArray();
  const expired = rows.filter((p) => typeof p.until === 'string' && new Date(p.until).getTime() < now).map((p) => p.ing);
  if (expired.length) await db.pantry.bulkDelete(expired);
  return rows.filter((p) => !expired.includes(p.ing)).sort((a, b) => a.ing.localeCompare(b.ing));
}

/**
 * Marks an ingredient in house (or not). Non-perishables are remembered for 21 days
 * (`opts.days` to change); a perishable one (`opts.perishable`, from the dictionary entry) is
 * not remembered at all — the list item's own `inHouse` flag covers this list. Pass `opts.until`
 * for an explicit date.
 */
export async function setInHouse(ing: string, on: boolean, opts: { perishable?: boolean; days?: number; until?: string | null } = {}): Promise<void> {
  if (!on) {
    await db.pantry.delete(ing);
    return;
  }
  if (opts.perishable) return;
  const row: PantryItem = { ing };
  if (opts.until) row.until = opts.until;
  else if (opts.until !== null) {
    const days = typeof opts.days === 'number' && opts.days > 0 ? opts.days : PANTRY_DAYS;
    row.until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }
  await db.pantry.put(row);
}

export async function clearPantry(): Promise<void> {
  await db.pantry.clear();
}

/** Counters for the Storage screen: dishes in the plan, items on the list, pantry rows. */
export async function weekCounts(): Promise<{ plan: number; list: number; pantry: number }> {
  const [plan, list, pantry] = await Promise.all([getPlan(), getList(), db.pantry.count()]);
  return { plan: plan.items.length, list: list?.items.length ?? 0, pantry };
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
