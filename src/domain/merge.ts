// Merge rules for incoming shares (docs/phase-3-spec.md §2). Pure and framework-free: `planImport`
// classifies every incoming recipe/patch against the local state, `resolveImport` turns a plan plus
// the user's choices into the rows to write; the repository (src/db/repo.ts) does the writing in
// one transaction and keeps the undo snapshot.
//
//   same id, same content (name + lines + steps)       -> present   (skip)
//   same id, newer rev, local untouched since receipt  -> update    (replace, per-language merge)
//   same id, older/same rev, local untouched           -> present   (an older version than the one
//                                                                    already received: nothing new)
//   same id, both changed                              -> conflict  (per field mine / theirs / both)
//   other id, same fingerprint                         -> similar   (replace / both / skip)
//   unknown id                                         -> new       (origin received + sync)
//   patch of a classic                                 -> new / update / conflict on the override,
//                                                        with the same "untouched since receipt"
//                                                        rule (RecipeOverride.sync); a patch with
//                                                        no fields carries line links only
//   dictionary delta: builtin ids never overwritten; user entries: newer updatedAt wins
//   deletions never travel
//
// "Legacy" rows: a received recipe without `sync` (phase 1) counts as untouched, and an incoming
// rev >= its rev is an update; a local override without `sync` was made here, so a differing
// incoming patch is a conflict.
import { ingredientsData } from './data.ts';
import type { Ingredient } from './dictionary.ts';
import { newUserId, nowIso, type Line, type Recipe, type RecipeSync, type Step, type Text } from './model.ts';
import { mergeText, type LineOverride, type RecipeOverride, type RecipePatch } from './overrides.ts';
import { recipeFingerprint } from './recipe-io.ts';
import type { DictDelta, ParsedShare, PatchPayload } from './share.ts';

// --- Types --------------------------------------------------------------------------------------

export interface LocalState {
  /** All recipes the receiver has: builtins (override applied) and own/received ones. */
  recipes: Recipe[];
  /**
   * The bundled classics as shipped, WITHOUT the receiver's override (repo `db.builtins`). A
   * "both" copy of an incoming patch starts from these, so it is their version and not a blend
   * with my override. Falls back to `recipes` when absent.
   */
  bases?: Recipe[];
  overrides: RecipeOverride[];
  userIngredients: Ingredient[];
  /** Ids of the bundled dictionary (never overwritten). Falls back to the bundled data when absent. */
  builtinIngredientIds?: ReadonlySet<string>;
}

export type ImportStatus = 'new' | 'present' | 'update' | 'conflict' | 'similar';

/** The fields of a conflict card. `meta` = description, serving tip, category, tags, servings, time. */
export type ConflictField = 'name' | 'lines' | 'steps' | 'meta';

export const CONFLICT_FIELDS: readonly ConflictField[] = ['name', 'lines', 'steps', 'meta'];

export interface RecipeImportItem {
  kind: 'recipe';
  /** Key for the choices map: the incoming recipe id. */
  id: string;
  incoming: Recipe;
  existing?: Recipe;
  status: ImportStatus;
  similarTo?: Recipe;
  fields?: ConflictField[];
}

export interface PatchImportItem {
  kind: 'patch';
  /** Key for the choices map: 'p:' + baseId (a bundle may hold a recipe and a patch of the same classic). */
  id: string;
  incoming: PatchPayload;
  existing?: RecipeOverride;
  /**
   * The classic the patch belongs to (undefined = unknown classic): as shipped when the local
   * state has `bases`, else as the receiver sees it (override applied).
   */
  base?: Recipe;
  status: ImportStatus;
  fields?: ConflictField[];
  /** The receiver does not have this classic: the patch cannot be applied. */
  problem?: 'unknown-base';
  /** The patch has no fields, only "Koppel ingrediënt" line links: no override row is written. */
  linksOnly?: boolean;
}

export type ImportItem = RecipeImportItem | PatchImportItem;

export interface ImportPlan {
  items: ImportItem[];
  dict: { add: Ingredient[]; skip: string[] };
  by?: string;
  at?: string;
}

export type FieldChoice = 'mine' | 'theirs' | 'both';

/**
 * The user's decision per item (by item id). `apply` = take the default action of the status
 * (add / update); `replace` (similar) overwrites the look-alike; `both` (similar) adds the
 * incoming one as well, (conflict) keeps mine and imports theirs as a copy; `fields` (conflict)
 * decides per field.
 */
export type ImportChoice =
  | { action: 'skip' }
  | { action: 'apply' }
  | { action: 'replace' }
  | { action: 'both' }
  | { action: 'fields'; fields: Partial<Record<ConflictField, FieldChoice>> };

export type ImportChoices = Record<string, ImportChoice>;

/** The rows an import writes (all "put" by key) plus what to report. */
export interface ImportWrites {
  recipes: Recipe[];
  overrides: RecipeOverride[];
  lineOverrides: LineOverride[];
  /** Recipe ids whose lines were replaced: their line overrides no longer match (saveUserRecipe does the same). */
  clearLineOverridesFor: string[];
  userIngredients: Ingredient[];
  /** Ids of recipes / 'p:'+baseId of overrides that were added. */
  added: string[];
  updated: string[];
  skipped: string[];
  /** Ids of the copies made by a "both" choice. */
  copies: string[];
}

export interface ResolveOptions {
  now?: string;
  newId?: () => string;
}

// --- Helpers ------------------------------------------------------------------------------------

type Dict = Record<string, unknown>;

function isBuiltinId(id: string): boolean {
  return id.startsWith('b:');
}

function key(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function textKey(t: Text | null | undefined): string {
  return key(t?.nl) + '|' + key(t?.en);
}

function linesKey(lines: readonly Line[]): string {
  return lines.map((l) => textKey(l.raw) + '|' + (l.kind ?? 'line')).join('\n');
}

function stepsKey(steps: readonly Step[]): string {
  return steps.map((s) => textKey(s.text)).join('\n');
}

function metaKey(r: Recipe): string {
  return JSON.stringify([textKey(r.description), textKey(r.servingTip), r.category ?? null, [...r.tags].sort(), r.servings, r.time ?? null]);
}

/** 32-bit FNV-1a as 8 hex chars. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The "same version" key of the merge table (name + sorted raw lines + steps): `recipeFingerprint`
 * (which ignores steps, for "similar") extended with the step texts. Stored as
 * `sync.receivedFingerprint`.
 */
export function contentFingerprint(r: Recipe): string {
  return recipeFingerprint(r) + fnv1a(stepsKey(r.steps));
}

/** The conflict fields in which two recipes differ. */
export function differingFields(mine: Recipe, theirs: Recipe): ConflictField[] {
  const out: ConflictField[] = [];
  if (textKey(mine.name) !== textKey(theirs.name)) out.push('name');
  if (linesKey(mine.lines) !== linesKey(theirs.lines)) out.push('lines');
  if (stepsKey(mine.steps) !== stepsKey(theirs.steps)) out.push('steps');
  if (metaKey(mine) !== metaKey(theirs)) out.push('meta');
  return out;
}

/** "Untouched since it was received": rev still equals the received rev (legacy received rows without sync count as untouched). */
export function isUntouchedSinceReceipt(local: Recipe): boolean {
  const sync = local.sync;
  if (sync && typeof sync.receivedRev === 'number') return local.rev === sync.receivedRev;
  return local.origin.kind === 'received';
}

function mergeSteps(base: readonly Step[], patch: readonly Step[]): Step[] {
  if (patch.length !== base.length) return patch.map((s) => ({ ...s, text: { ...(s.text ?? {}) } }));
  return patch.map((s, i) => {
    const b = base[i] as Step;
    const out: Step = { ...b, ...s, text: mergeText(b.text, s.text) ?? {} };
    if (s.timers === undefined && b.timers) out.timers = b.timers;
    return out;
  });
}

function mergeLines(base: readonly Line[], patch: readonly Line[]): Line[] {
  const sameLength = patch.length === base.length;
  return patch.map((l, i) => {
    const b = sameLength ? (base[i] as Line) : undefined;
    const out: Line = b ? { ...b, ...l } : { ...l };
    const raw = mergeText(b?.raw, l.raw) ?? {};
    // Invariant 2: a raw line is never deleted.
    out.raw = key(raw.nl) || key(raw.en) ? raw : { ...(b?.raw ?? {}) };
    return out;
  });
}

/**
 * Field-level merge of `theirs` into `mine` for the given fields (invariant 3: an incoming
 * language only touches that language). Steps and lines merge per index when the count is the
 * same, else theirs replace mine. Unknown keys of theirs are copied along with `meta`.
 */
export function mergeRecipeFields(mine: Recipe, theirs: Recipe, fields: readonly ConflictField[]): Recipe {
  const out: Recipe = { ...mine };
  if (fields.includes('name')) out.name = mergeText(mine.name, theirs.name) ?? mine.name;
  if (fields.includes('lines')) out.lines = mergeLines(mine.lines, theirs.lines);
  if (fields.includes('steps')) out.steps = mergeSteps(mine.steps, theirs.steps);
  if (fields.includes('meta')) {
    const description = mergeText(mine.description, theirs.description);
    if (description) out.description = description;
    else delete (out as Dict).description;
    const tip = mergeText(mine.servingTip, theirs.servingTip);
    if (tip) out.servingTip = tip;
    else delete (out as Dict).servingTip;
    out.category = theirs.category ?? null;
    out.tags = [...theirs.tags];
    out.servings = theirs.servings;
    if (theirs.time !== undefined) out.time = theirs.time;
    out.goesWith = [...theirs.goesWith];
    out.aliases = [...theirs.aliases];
    if (theirs.text !== undefined) out.text = theirs.text;
  }
  return out;
}

/** "<name> (<by>s versie)" / "<name> (<by>'s version)", per language that the name has. */
export function copyName(name: Text, by: string | undefined): Text {
  const who = (by ?? '').trim();
  const out: Text = {};
  if (key(name.nl)) out.nl = `${name.nl} (${who ? `${who}s versie` : 'andere versie'})`;
  if (key(name.en)) out.en = `${name.en} (${who ? `${who}'s version` : 'other version'})`;
  if (!out.nl && !out.en) out.nl = who ? `${who}s versie` : 'Andere versie';
  return out;
}

function receivedOrigin(r: Recipe, by: string | undefined, now: string): Recipe['origin'] {
  return { ...r.origin, kind: 'received', receivedFrom: by ?? null, receivedAt: now };
}

function syncFor(incoming: Recipe, now: string): RecipeSync {
  return { receivedRev: incoming.rev, receivedAt: now, receivedFingerprint: contentFingerprint(incoming) };
}

function stripBookkeeping(r: Recipe): Recipe {
  const out = { ...r };
  delete (out as Dict).sync;
  delete (out as Dict).override;
  return out;
}

// --- Patch helpers ------------------------------------------------------------------------------

/** Stable hash-free key of a patch's content (order-insensitive keys). */
function patchKey(patch: RecipePatch): string {
  const keys = Object.keys(patch).sort();
  return JSON.stringify(keys.map((k) => [k, patch[k]]));
}

function patchFields(mine: RecipePatch | undefined, theirs: RecipePatch): ConflictField[] {
  const out = new Set<ConflictField>();
  const keys = new Set([...Object.keys(mine ?? {}), ...Object.keys(theirs)]);
  for (const k of keys) {
    if (JSON.stringify(mine?.[k] ?? null) === JSON.stringify(theirs[k] ?? null)) continue;
    if (k === 'name' || k === 'lines' || k === 'steps') out.add(k);
    else out.add('meta');
  }
  return CONFLICT_FIELDS.filter((f) => out.has(f));
}

/** Per-language merge of a patch into a patch for the given fields. */
function mergePatchFields(mine: RecipePatch, theirs: RecipePatch, fields: readonly ConflictField[]): RecipePatch {
  const out: RecipePatch = { ...mine };
  for (const [k, v] of Object.entries(theirs)) {
    const field: ConflictField = k === 'name' || k === 'lines' || k === 'steps' ? k : 'meta';
    if (!fields.includes(field)) continue;
    if (k === 'name' || k === 'description' || k === 'servingTip') {
      const merged = mergeText(mine[k] as Text | null | undefined, v as Text | null);
      if (k === 'name') out.name = merged ?? undefined;
      else out[k] = merged;
    } else if (k === 'steps' && Array.isArray(v) && Array.isArray(mine.steps)) {
      out.steps = mergeSteps(mine.steps, v as Step[]);
    } else if (k === 'lines' && Array.isArray(v) && Array.isArray(mine.lines)) {
      out.lines = mergeLines(mine.lines, v as Line[]);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// --- planImport ---------------------------------------------------------------------------------

let bundledIds: ReadonlySet<string> | undefined;

/** The bundled dictionary ids (data/ingredients.json), used when the caller passes none. */
function builtinIds(local: LocalState): ReadonlySet<string> {
  if (local.builtinIngredientIds) return local.builtinIngredientIds;
  if (!bundledIds) bundledIds = new Set(ingredientsData.map((i) => i.id));
  return bundledIds;
}

function planDict(dict: DictDelta, local: LocalState): ImportPlan['dict'] {
  const add: Ingredient[] = [];
  const skip: string[] = [];
  const builtin = builtinIds(local);
  const mine = new Map<string, Ingredient>();
  for (const e of local.userIngredients) mine.set(e.id, e);
  for (const e of dict.ing) {
    if (builtin.has(e.id)) {
      skip.push(e.id);
      continue;
    }
    const cur = mine.get(e.id);
    if (cur && (cur.updatedAt ?? '') >= (e.updatedAt ?? '')) {
      skip.push(e.id);
      continue;
    }
    add.push(e);
  }
  return { add, skip };
}

function planRecipe(incoming: Recipe, byId: Map<string, Recipe>, byFingerprint: Map<string, Recipe>): RecipeImportItem {
  const fp = recipeFingerprint(incoming);
  const existing = byId.get(incoming.id);
  if (existing) {
    if (isBuiltinId(incoming.id)) return { kind: 'recipe', id: incoming.id, incoming, existing, status: 'present' };
    const content = contentFingerprint(incoming);
    if (contentFingerprint(existing) === content || existing.sync?.receivedFingerprint === content) {
      return { kind: 'recipe', id: incoming.id, incoming, existing, status: 'present' };
    }
    if (isUntouchedSinceReceipt(existing)) {
      // A phase-1 row (no sync) never recorded the received rev: its own rev is the sender's.
      const receivedRev = existing.sync?.receivedRev ?? existing.rev;
      const newer = existing.sync ? incoming.rev > receivedRev : incoming.rev >= receivedRev;
      if (newer) {
        return { kind: 'recipe', id: incoming.id, incoming, existing, status: 'update', fields: differingFields(existing, incoming) };
      }
      // An older version than the one already received: nothing new.
      return { kind: 'recipe', id: incoming.id, incoming, existing, status: 'present' };
    }
    return { kind: 'recipe', id: incoming.id, incoming, existing, status: 'conflict', fields: differingFields(existing, incoming) };
  }
  const twin = byFingerprint.get(fp);
  if (twin) return { kind: 'recipe', id: incoming.id, incoming, status: 'similar', similarTo: twin };
  return { kind: 'recipe', id: incoming.id, incoming, status: 'new' };
}

/** "Untouched since it was received": the override's rev still equals the received rev (no sync = made here). */
export function isOverrideUntouchedSinceReceipt(o: RecipeOverride): boolean {
  return typeof o.sync?.receivedRev === 'number' && o.rev === o.sync.receivedRev;
}

function planPatch(incoming: PatchPayload, byId: Map<string, Recipe>, bases: Map<string, Recipe>, overrides: Map<string, RecipeOverride>): PatchImportItem {
  const id = 'p:' + incoming.baseId;
  const base = bases.get(incoming.baseId) ?? byId.get(incoming.baseId);
  if (!base || !isBuiltinId(incoming.baseId)) return { kind: 'patch', id, incoming, status: 'present', problem: 'unknown-base' };
  if (Object.keys(incoming.patch).length === 0) {
    // "Koppel ingrediënt" links of a classic without an override: line overrides only, my own
    // override (if any) stays untouched.
    if (!incoming.lineOverrides?.length) return { kind: 'patch', id, incoming, base, status: 'present', linksOnly: true };
    return { kind: 'patch', id, incoming, base, status: 'new', linksOnly: true };
  }
  const existing = overrides.get(incoming.baseId);
  if (!existing) return { kind: 'patch', id, incoming, base, status: 'new' };
  if (patchKey(existing.patch) === patchKey(incoming.patch)) return { kind: 'patch', id, incoming, existing, base, status: 'present' };
  const fields = patchFields(existing.patch, incoming.patch);
  if (isOverrideUntouchedSinceReceipt(existing)) {
    if (incoming.rev > existing.rev) return { kind: 'patch', id, incoming, existing, base, status: 'update', fields };
    // An older version of the patch than the one already received: nothing new.
    return { kind: 'patch', id, incoming, existing, base, status: 'present' };
  }
  return { kind: 'patch', id, incoming, existing, base, status: 'conflict', fields };
}

/** Classifies every incoming recipe and patch against the local state (see the table at the top). */
export function planImport(incoming: ParsedShare, local: LocalState): ImportPlan {
  const byId = new Map<string, Recipe>();
  const byFingerprint = new Map<string, Recipe>();
  for (const r of local.recipes) {
    byId.set(r.id, r);
    const fp = recipeFingerprint(r);
    if (!byFingerprint.has(fp)) byFingerprint.set(fp, r);
  }
  const bases = new Map<string, Recipe>();
  for (const r of local.bases ?? []) bases.set(r.id, r);
  const overrides = new Map<string, RecipeOverride>();
  for (const o of local.overrides) overrides.set(o.baseId, o);

  const items: ImportItem[] = [];
  const seen = new Set<string>();
  for (const r of incoming.recipes) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    items.push(planRecipe(stripBookkeeping(r), byId, byFingerprint));
  }
  for (const p of incoming.patches) {
    const id = 'p:' + p.baseId;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(planPatch(p, byId, bases, overrides));
  }
  const plan: ImportPlan = { items, dict: planDict(incoming.dict ?? { ing: [] }, local) };
  if (incoming.by) plan.by = incoming.by;
  if (incoming.at) plan.at = incoming.at;
  return plan;
}

// --- Choices ------------------------------------------------------------------------------------

/** The default action per status: new/update -> apply, present/similar/conflict -> skip (the user decides). */
export function defaultChoice(item: ImportItem): ImportChoice {
  switch (item.status) {
    case 'new':
    case 'update':
      return { action: 'apply' };
    default:
      return { action: 'skip' };
  }
}

export function defaultChoices(plan: ImportPlan): ImportChoices {
  const out: ImportChoices = {};
  for (const item of plan.items) out[item.id] = defaultChoice(item);
  return out;
}

/** Choices that mirror the phase-1 importer: conflicts take theirs, look-alikes are added anyway. */
export function legacyChoices(plan: ImportPlan): ImportChoices {
  const out: ImportChoices = {};
  for (const item of plan.items) {
    if (item.status === 'conflict') out[item.id] = { action: 'fields', fields: { name: 'theirs', lines: 'theirs', steps: 'theirs', meta: 'theirs' } };
    else if (item.status === 'similar') out[item.id] = { action: 'both' };
    else out[item.id] = defaultChoice(item);
  }
  return out;
}

// --- resolveImport ------------------------------------------------------------------------------

function fieldChoices(choice: ImportChoice, fields: readonly ConflictField[]): { theirs: ConflictField[]; both: boolean } {
  if (choice.action === 'both') return { theirs: [], both: true };
  if (choice.action === 'replace' || choice.action === 'apply') return { theirs: [...fields], both: false };
  if (choice.action === 'fields') {
    const theirs: ConflictField[] = [];
    let both = false;
    for (const f of fields) {
      const c = choice.fields[f] ?? 'mine';
      if (c === 'theirs') theirs.push(f);
      if (c === 'both') both = true;
    }
    return { theirs, both };
  }
  return { theirs: [], both: false };
}

function resolveRecipe(item: RecipeImportItem, choice: ImportChoice, plan: ImportPlan, w: ImportWrites, now: string, newId: () => string): void {
  const by = plan.by;
  const incoming = item.incoming;
  const fresh = (r: Recipe, id: string): Recipe => ({
    ...stripBookkeeping(r),
    id,
    origin: receivedOrigin(r, by, now),
    updatedAt: now,
    sync: syncFor(incoming, now),
  });

  if (choice.action === 'skip' || item.status === 'present') {
    w.skipped.push(item.id);
    return;
  }

  switch (item.status) {
    case 'new': {
      w.recipes.push(fresh(incoming, incoming.id));
      w.clearLineOverridesFor.push(incoming.id);
      w.added.push(incoming.id);
      return;
    }
    case 'update': {
      const mine = item.existing as Recipe;
      const merged = mergeRecipeFields(mine, incoming, item.fields ?? CONFLICT_FIELDS);
      w.recipes.push({
        ...merged,
        rev: incoming.rev,
        createdAt: mine.createdAt,
        updatedAt: now,
        origin: receivedOrigin(mine, by ?? mine.origin.receivedFrom ?? undefined, now),
        sync: syncFor(incoming, now),
      });
      w.clearLineOverridesFor.push(incoming.id);
      w.updated.push(incoming.id);
      return;
    }
    case 'conflict': {
      const mine = item.existing as Recipe;
      const fields = item.fields ?? differingFields(mine, incoming);
      const { theirs, both } = fieldChoices(choice, fields);
      const allTheirs = theirs.length === fields.length && !both;
      if (theirs.length) {
        const merged = mergeRecipeFields(mine, incoming, theirs);
        w.recipes.push({
          ...merged,
          rev: allTheirs ? incoming.rev : Math.max(mine.rev, incoming.rev) + 1,
          createdAt: mine.createdAt,
          updatedAt: now,
          sync: syncFor(incoming, now),
        });
        w.clearLineOverridesFor.push(mine.id);
        w.updated.push(mine.id);
      } else if (!both) {
        w.skipped.push(item.id);
        return;
      }
      if (both) {
        const id = newId();
        const copy = fresh(incoming, id);
        copy.name = copyName(incoming.name, by);
        copy.rev = 1;
        copy.createdAt = now;
        copy.origin = { ...copy.origin, basedOn: incoming.id };
        w.recipes.push(copy);
        w.added.push(id);
        w.copies.push(id);
        if (!theirs.length) {
          // Mine stays as it is, but remember that this version was seen. Only the fingerprint:
          // taking over receivedRev would make mine "untouched since receipt" again (rev equal
          // to the received one) and the sender's next version would silently replace my edits.
          const sync: RecipeSync = { ...(mine.sync ?? {}), receivedFingerprint: contentFingerprint(incoming), receivedAt: now };
          w.recipes.push({ ...mine, sync });
        }
      }
      return;
    }
    case 'similar': {
      const twin = item.similarTo as Recipe;
      if (choice.action === 'replace' && !isBuiltinId(twin.id)) {
        w.recipes.push({ ...fresh(incoming, twin.id), createdAt: twin.createdAt });
        w.clearLineOverridesFor.push(twin.id);
        w.updated.push(twin.id);
        return;
      }
      // 'both' (and 'replace' of a classic, which cannot be replaced): add as its own recipe.
      w.recipes.push(fresh(incoming, incoming.id));
      w.clearLineOverridesFor.push(incoming.id);
      w.added.push(incoming.id);
      return;
    }
    default:
      w.skipped.push(item.id);
  }
}

function resolvePatch(item: PatchImportItem, choice: ImportChoice, plan: ImportPlan, w: ImportWrites, now: string, newId: () => string): void {
  const by = plan.by;
  const incoming = item.incoming;
  if (choice.action === 'skip' || item.status === 'present' || !item.base) {
    w.skipped.push(item.id);
    return;
  }
  const lineOverrides = (incoming.lineOverrides ?? []).map((o) => ({ ...o, recipeId: incoming.baseId, updatedAt: o.updatedAt || now }));
  /** Writes the override with `rev`; `receivedRev` = the rev this row counts as "received at" (equal to `rev` = untouched). */
  const put = (patch: RecipePatch, rev: number, receivedRev: number) => {
    w.overrides.push({ baseId: incoming.baseId, rev, patch, updatedAt: now, by: by ?? item.existing?.by ?? null, sync: { receivedRev, receivedAt: now } });
    w.lineOverrides.push(...lineOverrides);
  };

  if (item.linksOnly) {
    // Line links only: no override row, my own override (if any) stays as it is.
    w.lineOverrides.push(...lineOverrides);
    w.updated.push(item.id);
    return;
  }

  switch (item.status) {
    case 'new':
      put(incoming.patch, incoming.rev, incoming.rev);
      w.added.push(item.id);
      return;
    case 'update': {
      const mine = item.existing as RecipeOverride;
      const rev = Math.max(incoming.rev, mine.rev + 1);
      put(mergePatchFields(mine.patch, incoming.patch, item.fields ?? CONFLICT_FIELDS), rev, rev);
      w.updated.push(item.id);
      return;
    }
    case 'conflict': {
      const mine = item.existing as RecipeOverride;
      const fields = item.fields ?? patchFields(mine.patch, incoming.patch);
      const { theirs, both } = fieldChoices(choice, fields);
      if (theirs.length) {
        // A merge is a fork: rev moves past both and differs from the received rev.
        put(mergePatchFields(mine.patch, incoming.patch, theirs), Math.max(incoming.rev, mine.rev) + 1, incoming.rev);
        w.updated.push(item.id);
      } else if (!both) {
        w.skipped.push(item.id);
        return;
      }
      if (both) {
        // Their version of the classic as an own copy next to my override: the incoming patch
        // on the classic as shipped (local.bases), never on my overridden view of it.
        const base = item.base;
        const theirsRecipe = applyPatchToBase(base, incoming);
        const id = newId();
        const copy: Recipe = {
          ...theirsRecipe,
          id,
          rev: 1,
          createdAt: now,
          updatedAt: now,
          origin: { kind: 'received', receivedFrom: by ?? null, receivedAt: now, basedOn: base.id },
          name: copyName(theirsRecipe.name, by),
        };
        delete (copy as Dict).override;
        delete (copy as Dict).sync;
        w.recipes.push(copy);
        w.added.push(id);
        w.copies.push(id);
      }
      return;
    }
    default:
      w.skipped.push(item.id);
  }
}

/** The classic with an incoming patch (and its line overrides) applied: a plain recipe, for copies. */
function applyPatchToBase(base: Recipe, p: PatchPayload): Recipe {
  const patch = p.patch;
  const out: Recipe = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'name') out.name = mergeText(base.name, v as Text | null) ?? base.name;
    else if (k === 'description' || k === 'servingTip') out[k] = mergeText(base[k], v as Text | null);
    else if (k === 'steps' && Array.isArray(v)) out.steps = mergeSteps(base.steps, v as Step[]);
    else if (k === 'lines' && Array.isArray(v)) out.lines = mergeLines(base.lines, v as Line[]);
    else if (k === 'tags' && Array.isArray(v)) out.tags = (v as unknown[]).filter((x): x is string => typeof x === 'string');
    else if (k === 'category') out.category = typeof v === 'string' ? v : null;
    else out[k] = v;
  }
  if (p.lineOverrides?.length) {
    const byIndex = new Map<number, LineOverride>();
    for (const o of p.lineOverrides) byIndex.set(o.index, o);
    out.lines = out.lines.map((l, i) => {
      const o = byIndex.get(i);
      if (!o) return l;
      const line: Line = { ...l };
      if (o.ing !== undefined) {
        line.ing = o.ing;
        if (o.ing) line.confidence = 1;
      }
      if (o.qual !== undefined) line.qual = [...o.qual];
      if (o.prep !== undefined) line.prep = o.prep === null ? null : { ...o.prep };
      return line;
    });
  }
  return out;
}

/**
 * A plan plus the user's choices -> the rows to write. Items without a choice get
 * `defaultChoice`. Pure: `now` and `newId` are injectable for tests.
 */
export function resolveImport(plan: ImportPlan, choices: ImportChoices = {}, opts: ResolveOptions = {}): ImportWrites {
  const now = opts.now ?? nowIso();
  const newId = opts.newId ?? newUserId;
  const w: ImportWrites = {
    recipes: [],
    overrides: [],
    lineOverrides: [],
    clearLineOverridesFor: [],
    userIngredients: plan.dict.add.map((e) => ({ ...e, updatedAt: e.updatedAt ?? now })),
    added: [],
    updated: [],
    skipped: [],
    copies: [],
  };
  for (const item of plan.items) {
    const choice = choices[item.id] ?? defaultChoice(item);
    if (item.kind === 'recipe') resolveRecipe(item, choice, plan, w, now, newId);
    else resolvePatch(item, choice, plan, w, now, newId);
  }
  return w;
}

/** "3 nieuw · 1 bijgewerkt · 2 overgeslagen" counts. */
export function summarizeWrites(w: Pick<ImportWrites, 'added' | 'updated' | 'skipped' | 'copies'>): { added: number; updated: number; skipped: number; copies: number } {
  return { added: w.added.length, updated: w.updated.length, skipped: w.skipped.length, copies: w.copies.length };
}
