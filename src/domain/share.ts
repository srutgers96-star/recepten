// Share envelopes (docs/phase-3-spec.md §1): the contract between the two phones on top of the
// token codec in token.ts (which stays unchanged). Framework-free: no preact, no dexie.
//
//   t: 'r'  r: Recipe                                        one recipe (`#r=`)
//   t: 'p'  p: { baseId, rev, patch, lineOverrides?, name? } an edited classic (`#p=`), applied as an
//                                                            override on the receiver, never a duplicate
//   t: 'b'  b: { title?, recipes, patches, since? }          a bundle (`#b=` token or a .json file)
//
// Every envelope may carry `dict: { ing: Ingredient[] }`: the USER ingredients (ids the bundled
// dictionary does not know) the payload references, so the receiver can add the missing ones.
// Unknown keys are preserved everywhere; a codec change gets a NEW fragment key.
import type { Ingredient } from './dictionary.ts';
import { nowIso, type Lang, type Line, type Recipe, type Text } from './model.ts';
import { applyLineOverrides, type LineOverride, type RecipeOverride, type RecipePatch } from './overrides.ts';
import { normalizeRecipe } from './recipe-io.ts';
import { buildMultiShareHeader, buildPatchShareMessage, buildShareMessageFor, openLine } from './message.ts';
import { buildShareUrl, encodeToken, parseEnvelope as validateEnvelope, type Envelope, type TokenKey } from './token.ts';

// --- Types --------------------------------------------------------------------------------------

/** The dictionary delta: user-created ingredient entries the payload references. */
export interface DictDelta {
  ing: Ingredient[];
}

/** The `p` payload: an override of a classic as it travels. Unknown keys are preserved. */
export interface PatchPayload {
  baseId: string;
  rev: number;
  patch: RecipePatch;
  lineOverrides?: LineOverride[];
  /** The classic's (effective) name, so a message or the landing page can say which one without a database. */
  name?: Text;
  /** ISO timestamp of the sender's last save of the override. */
  updatedAt?: string;
  [k: string]: unknown;
}

export interface BundlePayload {
  title?: string;
  recipes: Recipe[];
  patches: PatchPayload[];
  /** ISO timestamp: the bundle holds changes since then (delta share). */
  since?: string;
  [k: string]: unknown;
}

export type ShareKind = 'recipe' | 'patch' | 'bundle';

/** What parseEnvelope makes of any envelope: a flat list of recipes and patches plus the delta. */
export interface ParsedShare {
  kind: ShareKind;
  by?: string;
  at?: string;
  msg?: string;
  title?: string;
  since?: string;
  dict: DictDelta;
  recipes: Recipe[];
  patches: PatchPayload[];
}

export interface ShareContext {
  by: string;
  /** All user-created dictionary entries; only the referenced ones travel. */
  userIngredients: Ingredient[];
  /** Line overrides of the recipe / classic being shared (folded into the lines, or sent with the patch). */
  lineOverrides?: LineOverride[];
}

export interface BundleOptions {
  title?: string;
  since?: string;
}

export interface MessagePlanOptions {
  /** Character budget of one WhatsApp text (default 3500). */
  limit?: number;
  /** Language of the sender's UI for the header lines (default 'nl'). */
  lang?: Lang;
  /** Sender name for headers when the envelopes carry none. */
  by?: string;
  /** Recipient name for the bundle file name ("recepten-<name>-YYYY-MM-DD.json"). */
  name?: string;
  /** Date for the file name (default today). */
  date?: Date;
}

export type MessagePlan =
  | { text: string; tokens: number; chars: number }
  | { file: { name: string; json: string }; reason: 'too-large' };

export const DEFAULT_MESSAGE_LIMIT = 3500;

// --- Helpers ------------------------------------------------------------------------------------

type Dict = Record<string, unknown>;

function isRecord(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

/** Ingredient ids a list of lines references (`ing` and the `alt` lines). */
export function referencedIngredientIds(lines: readonly Line[]): Set<string> {
  const ids = new Set<string>();
  const visit = (l: Line) => {
    if (typeof l.ing === 'string' && l.ing) ids.add(l.ing);
    for (const a of l.alt ?? []) visit(a);
  };
  for (const l of lines) visit(l);
  return ids;
}

/** The user entries (by id) that the given ids reference, sorted by id. */
function dictDeltaFor(ids: ReadonlySet<string>, userIngredients: readonly Ingredient[]): DictDelta | undefined {
  const byId = new Map<string, Ingredient>();
  for (const e of userIngredients) if (e && typeof e.id === 'string') byId.set(e.id, e);
  const ing: Ingredient[] = [];
  for (const id of [...ids].sort()) {
    const e = byId.get(id);
    if (e) ing.push(e);
  }
  return ing.length ? { ing } : undefined;
}

/** Ids referenced by a line override (`ing`), for the patch delta. */
function lineOverrideIds(overrides: readonly LineOverride[] | undefined): string[] {
  const ids: string[] = [];
  for (const o of overrides ?? []) if (typeof o.ing === 'string' && o.ing) ids.push(o.ing);
  return ids;
}

/** The recipe as it travels: line overrides folded in, receiver-side bookkeeping stripped. */
function travelRecipe(recipe: Recipe, lineOverrides: readonly LineOverride[] | undefined): Recipe {
  const out: Recipe = { ...recipe, lines: applyLineOverrides(recipe.lines, lineOverrides) };
  delete (out as Dict).sync;
  delete (out as Dict).override;
  return out;
}

function baseEnvelope(t: TokenKey, by: string): Envelope {
  const env: Envelope = { v: 2, t, at: nowIso() };
  const sender = by.trim();
  if (sender) env.by = sender;
  return env;
}

// --- Builders -----------------------------------------------------------------------------------

/** `{v: 2, t: 'r', by, at, r, dict?}`: one recipe with its line overrides folded in. */
export function buildRecipeEnvelope(recipe: Recipe, ctx: ShareContext): Envelope {
  const r = travelRecipe(recipe, ctx.lineOverrides);
  const env = baseEnvelope('r', ctx.by);
  env.r = r;
  const dict = dictDeltaFor(referencedIngredientIds(r.lines), ctx.userIngredients);
  if (dict) env.dict = dict;
  return env;
}

/** `{v: 2, t: 'p', by, at, p, dict?}`: an edited classic as a patch (plus its line overrides). */
export function buildPatchEnvelope(override: RecipeOverride, ctx: ShareContext & { name?: Text }): Envelope {
  const p: PatchPayload = { baseId: override.baseId, rev: override.rev, patch: override.patch };
  if (ctx.lineOverrides && ctx.lineOverrides.length) p.lineOverrides = ctx.lineOverrides.map((o) => ({ ...o }));
  if (ctx.name && (ctx.name.nl || ctx.name.en)) p.name = { ...ctx.name };
  if (override.updatedAt) p.updatedAt = override.updatedAt;
  const env = baseEnvelope('p', ctx.by);
  env.p = p;
  const ids = referencedIngredientIds(Array.isArray(override.patch.lines) ? override.patch.lines : []);
  for (const id of lineOverrideIds(ctx.lineOverrides)) ids.add(id);
  const dict = dictDeltaFor(ids, ctx.userIngredients);
  if (dict) env.dict = dict;
  return env;
}

export interface BundleItems {
  recipes: Recipe[];
  patches: RecipeOverride[];
  /** Line overrides of the patched classics, by baseId (folded into the patches). */
  lineOverrides?: LineOverride[];
  /** The effective names of the patched classics, by baseId. */
  names?: Record<string, Text>;
}

/** `{v: 2, t: 'b', by, at, b: {title?, recipes, patches, since?}, dict?}`. */
export function buildBundleEnvelope(items: BundleItems, ctx: ShareContext, opts: BundleOptions = {}): Envelope {
  const byBase = new Map<string, LineOverride[]>();
  for (const o of [...(items.lineOverrides ?? []), ...(ctx.lineOverrides ?? [])]) {
    const list = byBase.get(o.recipeId) ?? [];
    list.push(o);
    byBase.set(o.recipeId, list);
  }
  const ids = new Set<string>();
  const recipes = items.recipes.map((r) => {
    const out = travelRecipe(r, byBase.get(r.id));
    for (const id of referencedIngredientIds(out.lines)) ids.add(id);
    return out;
  });
  const patches = items.patches.map((o) => {
    const p: PatchPayload = { baseId: o.baseId, rev: o.rev, patch: o.patch };
    const lo = byBase.get(o.baseId);
    if (lo && lo.length) p.lineOverrides = lo.map((x) => ({ ...x }));
    const name = items.names?.[o.baseId];
    if (name && (name.nl || name.en)) p.name = { ...name };
    if (o.updatedAt) p.updatedAt = o.updatedAt;
    for (const id of referencedIngredientIds(Array.isArray(o.patch.lines) ? o.patch.lines : [])) ids.add(id);
    for (const id of lineOverrideIds(lo)) ids.add(id);
    return p;
  });
  const b: BundlePayload = { recipes, patches };
  const title = cleanString(opts.title);
  if (title) b.title = title;
  const since = cleanString(opts.since);
  if (since) b.since = since;
  const env = baseEnvelope('b', ctx.by);
  env.b = b;
  const dict = dictDeltaFor(ids, ctx.userIngredients);
  if (dict) env.dict = dict;
  return env;
}

// --- Parsing ------------------------------------------------------------------------------------

function readIngredient(v: unknown): Ingredient | null {
  if (!isRecord(v) || typeof v.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(v.id)) return null;
  const nl = isRecord(v.nl) && typeof v.nl.one === 'string' ? v.nl : undefined;
  const en = isRecord(v.en) && typeof v.en.one === 'string' ? v.en : undefined;
  if (!nl && !en) return null;
  const out = { ...v } as Ingredient;
  out.nl = (nl ?? { one: '' }) as Ingredient['nl'];
  out.en = (en ?? { one: '' }) as Ingredient['en'];
  if (typeof out.aisle !== 'string') out.aisle = 'overig';
  if (out.defaultUnit !== null && typeof out.defaultUnit !== 'string') out.defaultUnit = null;
  out.staple = out.staple === true;
  out.veg = out.veg !== false;
  return out;
}

function readDict(v: unknown): DictDelta {
  const ing: Ingredient[] = [];
  const list = isRecord(v) && Array.isArray(v.ing) ? v.ing : Array.isArray(v) ? v : [];
  for (const e of list) {
    const i = readIngredient(e);
    if (i) ing.push(i);
  }
  return { ing };
}

function readLineOverride(v: unknown): LineOverride | null {
  if (!isRecord(v) || typeof v.recipeId !== 'string' || !Number.isInteger(v.index) || (v.index as number) < 0) return null;
  const o: LineOverride = { recipeId: v.recipeId, index: v.index as number, updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '' };
  if (v.ing === null || typeof v.ing === 'string') o.ing = v.ing;
  if (Array.isArray(v.qual)) o.qual = v.qual.filter((q): q is string => typeof q === 'string');
  if (v.prep === null) o.prep = null;
  else if (isRecord(v.prep)) o.prep = v.prep as Text;
  return o;
}

/** A patch payload (also accepts a stored RecipeOverride row shape). */
export function readPatchPayload(v: unknown): PatchPayload | null {
  if (!isRecord(v)) return null;
  const baseId = cleanString(v.baseId);
  if (!baseId || !isRecord(v.patch)) return null;
  const out: PatchPayload = { ...(v as object), baseId, rev: 1, patch: v.patch as RecipePatch } as PatchPayload;
  out.rev = typeof v.rev === 'number' && Number.isFinite(v.rev) && v.rev > 0 ? Math.floor(v.rev) : 1;
  if (Array.isArray(v.lineOverrides)) {
    const list = v.lineOverrides.map(readLineOverride).filter((o): o is LineOverride => o !== null && o.recipeId === baseId);
    if (list.length) out.lineOverrides = list;
    else delete out.lineOverrides;
  } else delete out.lineOverrides;
  if (isRecord(v.name) && (typeof v.name.nl === 'string' || typeof v.name.en === 'string')) out.name = v.name as Text;
  else delete out.name;
  if (typeof v.updatedAt === 'string' && v.updatedAt.trim()) out.updatedAt = v.updatedAt;
  else delete out.updatedAt;
  return out;
}

/** A recipe in any shape the app ever produced, with receiver-side bookkeeping stripped. */
function readRecipe(v: unknown): Recipe | null {
  const r = normalizeRecipe(v);
  if (!r) return null;
  delete (r as Dict).sync;
  delete (r as Dict).override;
  return r;
}

/**
 * Any envelope (`r`, `p`, `b`; also a legacy backup file with `userRecipes`) -> a ParsedShare.
 * Tolerant: phase-0/1 recipe shapes go through normalizeRecipe, unusable items are dropped,
 * unknown keys stay on the items. Throws Error('invalid-token') for anything that is not an
 * envelope and Error('unsupported-version') for a newer `v` (same as decodeToken).
 */
export function parseEnvelope(env: unknown): ParsedShare {
  const e = validateEnvelope(env);
  const out: ParsedShare = { kind: 'bundle', dict: readDict(e.dict), recipes: [], patches: [] };
  const by = cleanString(e.by);
  if (by) out.by = by;
  const at = cleanString(e.at);
  if (at) out.at = at;
  const msg = cleanString(e.msg);
  if (msg) out.msg = msg;

  if (e.t === 'r') {
    out.kind = 'recipe';
    const r = readRecipe(e.r);
    if (r) out.recipes.push(r);
    return out;
  }
  if (e.t === 'p') {
    out.kind = 'patch';
    const p = readPatchPayload(e.p);
    if (p) out.patches.push(p);
    return out;
  }
  if (e.t === 'b') {
    const b = isRecord(e.b) ? e.b : null;
    const recipes = b ? b.recipes : e.userRecipes; // legacy backup: userRecipes at the top level
    const patches = b ? b.patches : e.overrides;
    if (Array.isArray(recipes)) for (const v of recipes) {
      const r = readRecipe(v);
      if (r) out.recipes.push(r);
    }
    if (Array.isArray(patches)) for (const v of patches) {
      const p = readPatchPayload(v);
      if (p) out.patches.push(p);
    }
    if (!b && Array.isArray(e.userIngredients)) out.dict = readDict(e.userIngredients);
    const title = cleanString(b?.title);
    if (title) out.title = title;
    const since = cleanString(b?.since);
    if (since) out.since = since;
    return out;
  }
  throw new Error('invalid-token');
}

// --- Message planning ---------------------------------------------------------------------------

/** Number of recipes/patches an envelope carries (for the "3 recepten" header). */
export function envelopeItemCount(env: Envelope): number {
  if (env.t === 'r') return 1;
  if (env.t === 'p') return 1;
  if (env.t === 'b' && isRecord(env.b)) {
    const b = env.b;
    return (Array.isArray(b.recipes) ? b.recipes.length : 0) + (Array.isArray(b.patches) ? b.patches.length : 0);
  }
  return 0;
}

/** "Stijn & co" -> "stijn-co" for the file name; empty -> "export". */
function fileSlug(name: string | undefined): string {
  const s = (name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'export';
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "recepten-<name>-YYYY-MM-DD.json" (§3). */
export function bundleFileName(name: string | undefined, date = new Date()): string {
  return `recepten-${fileSlug(name)}-${isoDate(date)}.json`;
}

/**
 * Several envelopes (r/p/b) -> ONE bundle envelope: recipes and patches concatenated, dict
 * deltas merged by id, by/at from the first envelope that has them.
 */
export function combineEnvelopes(envelopes: readonly Envelope[], opts: BundleOptions = {}): Envelope {
  const recipes: Recipe[] = [];
  const patches: PatchPayload[] = [];
  const ing = new Map<string, Ingredient>();
  let by: string | undefined;
  for (const env of envelopes) {
    if (!by) by = cleanString(env.by);
    const parsed = parseEnvelope(env);
    recipes.push(...parsed.recipes);
    patches.push(...parsed.patches);
    for (const e of parsed.dict.ing) if (!ing.has(e.id)) ing.set(e.id, e);
  }
  const b: BundlePayload = { recipes, patches };
  const title = cleanString(opts.title);
  if (title) b.title = title;
  const since = cleanString(opts.since);
  if (since) b.since = since;
  const out = baseEnvelope('b', by ?? '');
  out.b = b;
  if (ing.size) out.dict = { ing: [...ing.values()].sort((a, c) => a.id.localeCompare(c.id)) };
  return out;
}

/** Name of the recipe/classic an envelope is about (for the message header). */
function envelopeName(env: Envelope): Text {
  if (env.t === 'r' && isRecord(env.r) && isRecord(env.r.name)) return env.r.name as Text;
  if (env.t === 'p' && isRecord(env.p) && isRecord(env.p.name)) return env.p.name as Text;
  return {};
}

/**
 * The WhatsApp text for the envelopes: a single recipe gets the four-line message from
 * message.ts, a single patch its "(aangepast)" variant, several items a compact header
 * ("🍲 3 recepten van Stijn"), the open line and one URL per line. Each URL is `#r=`/`#p=`/`#b=`.
 * When the text is longer than `limit` characters the result is a bundle FILE instead (pretty
 * JSON, not compressed), named "recepten-<name>-YYYY-MM-DD.json".
 */
export async function planMessages(envelopes: readonly Envelope[], appUrl: string, opts: MessagePlanOptions = {}): Promise<MessagePlan> {
  const limit = typeof opts.limit === 'number' && opts.limit > 0 ? opts.limit : DEFAULT_MESSAGE_LIMIT;
  const lang: Lang = opts.lang === 'en' ? 'en' : 'nl';
  const by = cleanString(opts.by) ?? cleanString(envelopes.find((e) => cleanString(e.by))?.by) ?? '';
  const urls: string[] = [];
  for (const env of envelopes) urls.push(buildShareUrl(appUrl, env.t, await encodeToken(env)));

  let text: string;
  const first = envelopes[0];
  if (envelopes.length === 1 && first && first.t === 'r' && urls[0]) {
    const r = readRecipe(first.r);
    text = r
      ? buildShareMessageFor(r, { by, url: urls[0], lang })
      : [buildMultiShareHeader(1, by, lang), openLine(lang), urls[0]].join('\n');
  } else if (envelopes.length === 1 && first && first.t === 'p' && urls[0]) {
    const name = envelopeName(first);
    const input = { nameNl: name.nl ?? '', by, url: urls[0], lang } as Parameters<typeof buildPatchShareMessage>[0];
    if (name.en) input.nameEn = name.en;
    text = buildPatchShareMessage(input);
  } else {
    const count = envelopes.reduce((n, e) => n + envelopeItemCount(e), 0);
    text = [buildMultiShareHeader(count, by, lang), openLine(lang), ...urls].join('\n');
  }

  if (text.length <= limit) return { text, tokens: urls.length, chars: text.length };

  const bundle = envelopes.length === 1 && first && first.t === 'b' ? first : combineEnvelopes(envelopes);
  return {
    file: { name: bundleFileName(opts.name, opts.date), json: JSON.stringify(bundle, null, 2) },
    reason: 'too-large',
  };
}
