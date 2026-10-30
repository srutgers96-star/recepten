// Share envelopes (docs/phase-3-spec.md §1): the contract between the two phones on top of the
// token codec in token.ts (which stays unchanged). Framework-free: no preact, no dexie.
//
//   t: 'r'  r: Recipe                                        one recipe (`#r=`)
//   t: 'p'  p: { baseId, rev, patch, lineOverrides?, name? } an edited classic (`#p=`), applied as an
//                                                            override on the receiver, never a duplicate
//   t: 'b'  b: { title?, recipes, patches, since? }          a bundle (`#b=` token or a .json file)
//   t: 'w'  w: { items: [{rid, srv, of?, vr?}], recipes, note? }
//                                                            a week plan (`#w=`, docs/phase-4-spec.md §1):
//                                                            the dishes with their servings plus the own
//                                                            recipes the partner may lack (normal import);
//                                                            `of` = recipe id of the main dish a side dish
//                                                            belongs to (docs/specs/labels-categorieen.md
//                                                            §2d; an older app shows it as a plain dish);
//                                                            `vr` = the chosen diet version of the dish
//                                                            (docs/specs/varianten-tabs.md §2d, 13D; an
//                                                            older app shows the original)
//   t: 'f'  f: { id, name, color, lang, deviceId?, avatar? }  a member card (`#f=`, docs/phase-5-spec.md
//                                                            block F): who the sender is on their phone,
//                                                            so the receiver can add them to the household;
//                                                            `avatar` (6D-3, docs/specs/badges-avatar.md
//                                                            §2g) is optional: an older app ignores it
//   t: 'x'  x: ProgressCard                                  shared progress (`#x=`, "Sync mijn voortgang",
//                                                            docs/specs/xp-levels.md §2h, block 6D-4): the
//                                                            card fields plus level, XP, streak, badges and
//                                                            the cook days of the last 90 days; aggregates
//                                                            only (no notes, no stars, no photos)
//
// Every envelope may carry `dict: { ing: Ingredient[] }`: the USER ingredients (ids the bundled
// dictionary does not know) the payload references, so the receiver can add the missing ones.
// Unknown keys are preserved everywhere; a codec change gets a NEW fragment key.
// 13D (docs/specs/varianten-tabs.md §2d): `r.variants`/`r.tip` and `p.patch.variants`/`p.patch.tip`
// are ordinary optional keys in `v: 2` (normalised on the way in); an older app ignores them.
import { normalizeAvatarSpec, type AvatarSpec } from './avatar.ts';
import type { Ingredient } from './dictionary.ts';
import { nowIso, type Lang, type Line, type Recipe, type Text } from './model.ts';
import { applyLineOverrides, type LineOverride, type RecipeOverride, type RecipePatch } from './overrides.ts';
import { normalizeServings, type Plan } from './planner.ts';
import { normalizeRecipe, readOptionalText, readVariants } from './recipe-io.ts';
import { VARIANT_DIETS, type VariantDiet } from './diets.ts';
import { dayFromKey } from './days.ts';
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

/** One dish of a shared week plan as it travels: recipe id + servings. */
export interface PlanPayloadItem {
  rid: string;
  srv: number;
  /**
   * "+ bijgerecht" (docs/specs/labels-categorieen.md §2d): the RECIPE id of the main dish this side
   * dish belongs to (item ids are local to a phone). Absent = a main dish. Optional key in `v: 2`:
   * an older app ignores it and shows the side dish as a dish of its own.
   */
  of?: string;
  /**
   * 13D (docs/specs/varianten-tabs.md §2d): the approved diet version chosen for this dish (a
   * VARIANT_DIETS value). Absent = the original. Optional key in `v: 2`: an older app ignores it;
   * the receiver keeps it only when its own recipe has that tab approved (UI, block 3).
   */
  vr?: string;
  [k: string]: unknown;
}

/** The `w` payload (docs/phase-4-spec.md §1). Unknown keys are preserved. */
export interface PlanPayload {
  items: PlanPayloadItem[];
  /** Own / received recipes of the plan the partner may lack (builtins never travel). */
  recipes: Recipe[];
  note?: string;
  [k: string]: unknown;
}

/** A received plan, as the Inbox offers it ("Overnemen" / "Toevoegen"). */
export interface PlanShare {
  /**
   * The dishes in the sender's order. `sideOfRecipeId` (from `of`) marks a side dish: the receiver
   * hangs it under the item it makes for that recipe, or keeps it as a plain dish when that recipe
   * is not in the plan (docs/specs/labels-categorieen.md §2d). `variant` (from `vr`, 13D) is the
   * diet version the sender chose; only a VARIANT_DIETS value is read, anything else is left out.
   */
  items: Array<{ recipeId: string; servings: number; sideOfRecipeId?: string; variant?: VariantDiet }>;
  note?: string;
}

/**
 * A member card as it travels (`#f=`, phase 5 block F): the sender as a household member. The
 * receiver stores it with `local: false` (src/domain/household.ts) and maps received `by` names
 * onto it. Unknown keys are preserved.
 */
export interface MemberCard {
  /** The sender's profile id ('p:…') on their phone; it is the member id on the receiver. */
  id: string;
  name: string;
  /** CSS colour (the profile swatch). */
  color: string;
  lang: Lang;
  /**
   * A stable random id of the sender's phone (setting 'device.id'). Stored on the member (the UI
   * says "via kaartje"); a re-sent card finds its member by id or name (`matchMemberForCard`).
   */
  deviceId?: string;
  /**
   * The sender's avatar (docs/specs/badges-avatar.md §2f/§2g, block 6D-3): ids and palette colours
   * only. Optional in `v: 2` (no new fragment key): an older app ignores it and shows the initial.
   * Read through `normalizeAvatarSpec`; an unusable avatar is left out, the card stays valid.
   */
  avatar?: AvatarSpec;
  [k: string]: unknown;
}

/**
 * Shared progress as it travels (`#x=`, docs/specs/xp-levels.md §2h, block 6D-4): the member-card
 * fields plus aggregates of the sender's XP. No notes, no stars, no photos. It is a snapshot: the
 * receiver sees what was shared then, nothing syncs afterwards (there is no server). Unknown keys
 * are preserved. Read through `readProgressPayload`.
 */
export interface ProgressCard {
  /** = MemberCard fields: the sender's profile id ('p:…'), name, colour, language, phone id. */
  id: string;
  name: string;
  color: string;
  lang: Lang;
  deviceId?: string;
  /** The sender's XP rules version (XP_RULES_VERSION), integer ≥ 1. */
  rv: number;
  /** 1…100. */
  level: number;
  /** Total XP, integer ≥ 0. */
  xp: number;
  /** Current streak in cook days, integer ≥ 0. */
  streak: number;
  /**
   * Badges earned on the sender's own tab, the `badges.earned` string format: `id` for a one-off
   * badge, `id@k` for ladder tier k (`PROGRESS_BADGE_RE`), at most 400.
   */
  badges: string[];
  /**
   * 'yyyy-mm-dd' local days of the last 90 days with at least one cook, ascending; `r` = the recipe
   * ids cooked that day (unique, at most 5).
   */
  cookDays: Array<{ d: string; r: string[] }>;
  /** The sender's avatar (docs/specs/badges-avatar.md), through `normalizeAvatarSpec`. */
  avatar?: AvatarSpec;
  [k: string]: unknown;
}

export type ShareKind = 'recipe' | 'patch' | 'bundle' | 'plan' | 'member' | 'progress';

/**
 * What parseEnvelope makes of any envelope: a flat list of recipes and patches plus the delta.
 * A plan (`kind: 'plan'`) adds `plan`; its embedded recipes sit in `recipes` and go through the
 * normal import plan. A member card (`kind: 'member'`) adds `member` and carries no recipes.
 */
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
  plan?: PlanShare;
  /** The member card of a `#f=` envelope (absent when the card was unreadable). */
  member?: MemberCard;
  /** The shared progress of a `#x=` envelope (absent when it was unreadable). */
  progress?: ProgressCard;
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

/**
 * The main dish's recipe id of a travelling plan item (`of`, labels-categorieen.md §2d), or
 * undefined for a main dish. A side dish can never belong to itself: `of` equal to `rid` is ignored.
 */
function sideOfIn(v: Record<string, unknown>): string | undefined {
  const of = cleanString(v.of);
  return of && of !== cleanString(v.rid) ? of : undefined;
}

/** Mirrors household.DEFAULT_MEMBER_COLOR (cobalt) without importing the household module here. */
const DEFAULT_CARD_COLOR = '#2b4fa8';
/** A colour the UI may put in an inline style: hex, a CSS colour name, or rgb()/hsl() with plain numbers. */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|(?:rgb|hsl)a?\(\s*[\d.%\s,/]+\s*\))$/i;
/** An id as it travels: no whitespace, at most 64 characters. */
const SAFE_ID = /^\S{1,64}$/;
const MAX_MEMBER_NAME = 60;
/** A badge on a progress card: `id` or `id@k` (ladder tier 1…8), the `badges.earned` format (§2h). */
export const PROGRESS_BADGE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:@[1-8])?$/;
/** Limits of a progress card (§2h): badges, cook days, recipe ids per cook day. */
export const PROGRESS_MAX_BADGES = 400;
export const PROGRESS_MAX_DAYS = 90;
export const PROGRESS_MAX_DAY_RECIPES = 5;
const PROGRESS_MAX_LEVEL = 100;

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
  // 6D-2c: how the recipe entered THIS app (`origin.via`) is local provenance, not recipe content.
  if (out.origin && 'via' in out.origin) {
    const origin = { ...out.origin };
    delete (origin as Dict).via;
    out.origin = origin;
  }
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

/**
 * `{v: 2, t: 'w', by, at, w: {items, recipes, note?}, dict?}`: the plan's dishes (cooked ones
 * left out) with their servings, plus `recipes`: the own/received recipes of the plan the partner
 * may lack (the caller passes them; builtins are dropped here). Line overrides in `ctx` are
 * folded into those recipes by id. `note` from `plan.note`.
 * A side dish (`sideOf`, labels-categorieen.md §2d) travels with `of` = the recipe id of its main
 * dish; the side of a cooked main stays home like the main itself. A side whose main item is gone
 * travels as a plain dish (as `savePlan` would make it). A dish with a chosen diet version
 * (`PlanItem.variant`, 13D) travels with `vr`.
 */
export function buildPlanEnvelope(plan: Plan, recipes: readonly Recipe[], ctx: ShareContext): Envelope {
  const byItemId = new Map(plan.items.map((p) => [p.id, p]));
  const items: PlanPayloadItem[] = [];
  for (const p of plan.items) {
    if (p.cooked) continue;
    const main = p.sideOf ? byItemId.get(p.sideOf) : undefined;
    if (main?.cooked) continue;
    const item: PlanPayloadItem = { rid: p.recipeId, srv: normalizeServings(p.servings) };
    if (main) item.of = main.recipeId;
    // 13D: the chosen diet version travels as `vr`, only when one is set.
    if (p.variant) item.vr = p.variant;
    items.push(item);
  }
  const wanted = new Set(items.map((p) => p.rid));
  const byRecipe = new Map<string, LineOverride[]>();
  for (const o of ctx.lineOverrides ?? []) {
    const list = byRecipe.get(o.recipeId) ?? [];
    list.push(o);
    byRecipe.set(o.recipeId, list);
  }
  const ids = new Set<string>();
  const seen = new Set<string>();
  const embedded: Recipe[] = [];
  for (const r of recipes) {
    if (!r || typeof r.id !== 'string' || r.id.startsWith('b:') || !wanted.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    const out = travelRecipe(r, byRecipe.get(r.id));
    for (const id of referencedIngredientIds(out.lines)) ids.add(id);
    embedded.push(out);
  }
  const w: PlanPayload = { items, recipes: embedded };
  const note = cleanString(plan.note);
  if (note) w.note = note;
  const env = baseEnvelope('w', ctx.by);
  env.w = w;
  const dict = dictDeltaFor(ids, ctx.userIngredients);
  if (dict) env.dict = dict;
  return env;
}

/**
 * `{v: 2, t: 'f', by, at, f: {id, name, color, lang, deviceId?, avatar?}}`: the sender as a member
 * card. `by` is the card's name so the Inbox header and the landing page can say who without
 * looking inside. Nothing else travels: no recipes, no dictionary delta. An avatar travels only
 * when it is usable (`normalizeAvatarSpec`); anything else under `avatar` is left out.
 */
export function buildMemberEnvelope(card: MemberCard): Envelope {
  const f: MemberCard = {
    ...card,
    id: card.id.trim(),
    name: card.name.trim(),
    color: cleanString(card.color) ?? DEFAULT_CARD_COLOR,
    lang: card.lang === 'en' ? 'en' : 'nl',
  };
  const deviceId = cleanString(card.deviceId);
  if (deviceId) f.deviceId = deviceId;
  else delete f.deviceId;
  const avatar = normalizeAvatarSpec(card.avatar);
  if (avatar) f.avatar = avatar;
  else delete f.avatar;
  const env = baseEnvelope('f', f.name);
  env.f = f;
  return env;
}

/**
 * `{v: 2, t: 'x', by, at, x: ProgressCard}`: the sender's progress ("Sync mijn voortgang", §2h).
 * `by` is the card's name, like a member card. The card fields are trimmed as in
 * buildMemberEnvelope and the numbers and lists are held to the same limits the receiver applies
 * (`readProgressFields`), so what travels is exactly what the other phone reads.
 */
export function buildProgressEnvelope(card: ProgressCard): Envelope {
  const x: ProgressCard = {
    ...card,
    id: card.id.trim(),
    name: card.name.trim(),
    color: cleanString(card.color) ?? DEFAULT_CARD_COLOR,
    lang: card.lang === 'en' ? 'en' : 'nl',
  };
  const deviceId = cleanString(card.deviceId);
  if (deviceId) x.deviceId = deviceId;
  else delete x.deviceId;
  readProgressFields(x, card);
  const avatar = normalizeAvatarSpec(card.avatar);
  if (avatar) x.avatar = avatar;
  else delete x.avatar;
  const env = baseEnvelope('x', x.name);
  env.x = x;
  return env;
}

// --- Parsing ------------------------------------------------------------------------------------

/**
 * A member card payload, tolerantly: `id` and `name` are required (trimmed; the name is cut at 60
 * characters), `color` falls back to cobalt unless it is a plain CSS colour, `lang` is 'nl' unless
 * it says 'en', a `deviceId` with whitespace or over 64 characters is dropped, an `avatar` that
 * `normalizeAvatarSpec` can not use is dropped (the card itself stays valid). Unknown keys stay.
 */
export function readMemberPayload(v: unknown): MemberCard | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v.id);
  const name = cleanString(v.name);
  if (!id || !name || !SAFE_ID.test(id)) return null;
  const color = cleanString(v.color);
  const out: MemberCard = {
    ...(v as object),
    id,
    name: name.slice(0, MAX_MEMBER_NAME).trim(),
    color: color && SAFE_COLOR.test(color) ? color : DEFAULT_CARD_COLOR,
    lang: v.lang === 'en' ? 'en' : 'nl',
  } as MemberCard;
  const deviceId = cleanString(v.deviceId);
  if (deviceId && SAFE_ID.test(deviceId)) out.deviceId = deviceId;
  else delete out.deviceId;
  const avatar = normalizeAvatarSpec(v.avatar);
  if (avatar) out.avatar = avatar;
  else delete out.avatar;
  return out;
}

/** An integer in [min, max], else `fallback`. */
function intOr(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
}

/**
 * The aggregate fields of a progress card, tolerantly, written onto `out` (§2h): level an integer
 * 1…100 else 1, xp an integer ≥ 0 else 0, rv an integer ≥ 1 else 1, streak an integer ≥ 0 else 0;
 * badges only strings matching PROGRESS_BADGE_RE (unique, the first 400); cookDays only entries
 * with a real 'yyyy-mm-dd' day (`dayFromKey`), ascending, one entry per day (the first), the last
 * 90; per day `r` only ids matching SAFE_ID (unique, the first 5). Unknown keys on a day stay.
 */
function readProgressFields(out: ProgressCard, v: Dict): void {
  out.rv = intOr(v.rv, 1, Number.MAX_SAFE_INTEGER, 1);
  out.level = intOr(v.level, 1, PROGRESS_MAX_LEVEL, 1);
  out.xp = intOr(v.xp, 0, Number.MAX_SAFE_INTEGER, 0);
  out.streak = intOr(v.streak, 0, Number.MAX_SAFE_INTEGER, 0);
  const badges = Array.isArray(v.badges)
    ? v.badges.filter((b): b is string => typeof b === 'string' && PROGRESS_BADGE_RE.test(b))
    : [];
  out.badges = [...new Set(badges)].slice(0, PROGRESS_MAX_BADGES);
  const days: Array<{ day: number; entry: ProgressCard['cookDays'][number] }> = [];
  const seenDays = new Set<number>();
  if (Array.isArray(v.cookDays)) for (const item of v.cookDays) {
    if (!isRecord(item) || typeof item.d !== 'string') continue;
    const day = dayFromKey(item.d);
    if (day === null || seenDays.has(day)) continue;
    seenDays.add(day);
    const ids = Array.isArray(item.r) ? item.r.filter((r): r is string => typeof r === 'string' && SAFE_ID.test(r)) : [];
    days.push({ day, entry: { ...item, d: item.d, r: [...new Set(ids)].slice(0, PROGRESS_MAX_DAY_RECIPES) } });
  }
  days.sort((a, b) => a.day - b.day);
  out.cookDays = days.slice(-PROGRESS_MAX_DAYS).map((x) => x.entry);
}

/**
 * A progress payload (`#x=`, §2h), tolerantly: `id` and `name` are required and the card fields
 * follow the rules of `readMemberPayload` (colour, language, deviceId, avatar); the aggregates
 * follow `readProgressFields`. Unknown keys stay. Null when it is no usable card.
 */
export function readProgressPayload(v: unknown): ProgressCard | null {
  if (!isRecord(v)) return null;
  const card = readMemberPayload(v);
  if (!card) return null;
  const out = card as ProgressCard;
  readProgressFields(out, v);
  return out;
}

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

/**
 * The patch as it came, with the two 13D keys normalised (docs/specs/varianten-tabs.md §2e, besluit
 * kritische lezer) so a `#p=` never puts rubbish in the override: `variants` through `readVariants`
 * and `tip` through `readOptionalText` (undefined → the key is left out). Other keys are untouched;
 * a patch without either key is returned as it is.
 */
function readPatch(v: Dict): RecipePatch {
  const patch = v as RecipePatch;
  if (!('variants' in patch) && !('tip' in patch)) return patch;
  const out: RecipePatch = { ...patch };
  if ('variants' in out) {
    const variants = readVariants(out.variants);
    if (variants === undefined) delete out.variants;
    else out.variants = variants;
  }
  if ('tip' in out) {
    const tip = readOptionalText(out.tip);
    if (tip === undefined) delete out.tip;
    else out.tip = tip;
  }
  return out;
}

/** A patch payload (also accepts a stored RecipeOverride row shape). */
export function readPatchPayload(v: unknown): PatchPayload | null {
  if (!isRecord(v)) return null;
  const baseId = cleanString(v.baseId);
  if (!baseId || !isRecord(v.patch)) return null;
  const out: PatchPayload = { ...(v as object), baseId, rev: 1, patch: readPatch(v.patch) } as PatchPayload;
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
 * Any envelope (`r`, `p`, `b`, `w`, `f`, `x`; also a legacy backup file with `userRecipes`) -> a
 * ParsedShare. Tolerant: phase-0/1 recipe shapes go through normalizeRecipe, unusable items are
 * dropped, unknown keys stay on the items. Throws Error('invalid-token') for anything that is not
 * an envelope and Error('unsupported-version') for a newer `v` (same as decodeToken).
 * NB: a kind this app does not know (a future key) is 'invalid-token', not 'unsupported-version',
 * because `v` stays 2 — so an app from before block F answers a `#f=` link with "no readable
 * recipe", never with "update the app" (pinned in tests/token.test.ts). The same holds for `#x=`
 * on an app from before block 6D-4 (which does not even see `#x=` as a token).
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
  if (e.t === 'w') {
    // A `w` without a payload object is not a plan (a stray "#w=" someone typed).
    if (!isRecord(e.w)) throw new Error('invalid-token');
    out.kind = 'plan';
    const w = e.w;
    const items: PlanShare['items'] = [];
    if (Array.isArray(w.items)) for (const v of w.items) {
      if (!isRecord(v)) continue;
      const recipeId = cleanString(v.rid);
      if (!recipeId) continue;
      const item: PlanShare['items'][number] = { recipeId, servings: normalizeServings(v.srv) };
      const sideOfRecipeId = sideOfIn(v);
      if (sideOfRecipeId) item.sideOfRecipeId = sideOfRecipeId;
      // 13D: `vr` only as one of the VARIANT_DIETS values; anything else is left out.
      if (typeof v.vr === 'string' && (VARIANT_DIETS as readonly string[]).includes(v.vr)) item.variant = v.vr as VariantDiet;
      items.push(item);
    }
    const plan: PlanShare = { items };
    const note = cleanString(w.note);
    if (note) plan.note = note;
    out.plan = plan;
    if (Array.isArray(w.recipes)) for (const v of w.recipes) {
      const r = readRecipe(v);
      if (r) out.recipes.push(r);
    }
    return out;
  }
  if (e.t === 'f') {
    // An `f` without a payload object is not a card (a stray "#f=" someone typed).
    if (!isRecord(e.f)) throw new Error('invalid-token');
    out.kind = 'member';
    const member = readMemberPayload(e.f);
    if (member) {
      out.member = member;
      if (!out.by) out.by = member.name;
    }
    return out;
  }
  if (e.t === 'x') {
    // An `x` without a payload object is no progress (a stray "#x=" someone typed).
    if (!isRecord(e.x)) throw new Error('invalid-token');
    out.kind = 'progress';
    const progress = readProgressPayload(e.x);
    if (progress) {
      out.progress = progress;
      if (!out.by) out.by = progress.name;
    }
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
  // A plan counts its embedded recipes (what the import writes); the dishes are in planDishCount.
  if (env.t === 'w' && isRecord(env.w)) return Array.isArray(env.w.recipes) ? env.w.recipes.length : 0;
  // A member card and shared progress carry no recipes.
  return 0;
}

/**
 * Number of dishes a plan envelope carries (0 for other kinds): the main dishes only, so an item
 * with `of` (a side dish, labels-categorieen.md §1d) does not count as one of the "N gerechten".
 */
export function planDishCount(env: Envelope): number {
  if (env.t !== 'w' || !isRecord(env.w) || !Array.isArray(env.w.items)) return 0;
  return env.w.items.filter((v: unknown) => !isRecord(v) || !sideOfIn(v)).length;
}

/**
 * The WhatsApp text for a plan: "🗓️ Weekplan van Stijn: 7 gerechten", the open line and the
 * `#w=` URL alone on the last line (one tappable link). The words are {nl, en} literals here
 * rather than src/i18n keys because the domain layer is framework-free (the message.ts trade-off).
 */
export function buildPlanShareMessage(i: { dishes: number; by: string; url: string; lang: Lang }): string {
  const lang: Lang = i.lang === 'en' ? 'en' : 'nl';
  const n = Math.max(0, Math.floor(i.dishes));
  const by = i.by.trim();
  const what = lang === 'nl' ? (n === 1 ? 'gerecht' : 'gerechten') : n === 1 ? 'dish' : 'dishes';
  const head = lang === 'nl' ? `🗓️ Weekplan${by ? ` van ${by}` : ''}: ${n} ${what}` : `🗓️ Week plan${by ? ` from ${by}` : ''}: ${n} ${what}`;
  return [head, openLine(lang), i.url].join('\n');
}

/**
 * The WhatsApp text for a member card: one sentence and the `#f=` URL alone on the last line.
 * It says "open the link in the app OR paste it into Inbox" because on an iPhone a link never
 * opens the installed app (CLAUDE.md invariant 5): there the card arrives by copy → app → paste.
 * {nl, en} literals, like the other message builders (the domain layer is framework-free).
 */
export function buildMemberShareMessage(i: { name: string; url: string; lang: Lang }): string {
  const lang: Lang = i.lang === 'en' ? 'en' : 'nl';
  const name = i.name.trim() || (lang === 'nl' ? 'iemand' : 'someone');
  const head =
    lang === 'nl'
      ? `👋 Kaartje van ${name} voor Rutgers' Recepten — open de link in de app of plak hem bij In & uit om ${name} aan je huishouden toe te voegen.`
      : `👋 ${name}'s card for Rutgers' Recipes — open the link in the app or paste it into In & out to add ${name} to your household.`;
  return [head, i.url].join('\n');
}

/**
 * The WhatsApp text for shared progress (§2h): one sentence and the `#x=` URL alone on the last
 * line: NL "📈 Voortgang van Stijn — Level 12 · Soepkoker. Open de link in de app of plak hem bij
 * In & uit." / EN "📈 Stijn's progress — Level 12 · Soup Stirrer. Open the link in the app or paste
 * it into In & out." (an iPhone never opens the app from a link, invariant 5). `title` is the level
 * title in `lang` (data/levels.json, `titleFor`); {nl, en} literals like the other builders.
 */
export function buildProgressShareMessage(i: { name: string; level: number; title: string; url: string; lang: Lang }): string {
  const lang: Lang = i.lang === 'en' ? 'en' : 'nl';
  const name = i.name.trim() || (lang === 'nl' ? 'iemand' : 'someone');
  const level = intOr(i.level, 1, PROGRESS_MAX_LEVEL, 1);
  const title = i.title.trim();
  const levelText = `Level ${level}${title ? ` · ${title}` : ''}`;
  const head =
    lang === 'nl'
      ? `📈 Voortgang van ${name} — ${levelText}. Open de link in de app of plak hem bij In & uit.`
      : `📈 ${name}'s progress — ${levelText}. Open the link in the app or paste it into In & out.`;
  return [head, i.url].join('\n');
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
 * deltas merged by id, by/at from the first envelope that has them. A member card (`f`) and shared
 * progress (`x`) carry no recipes, so they drop out (a bundle has no place for them).
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
 * message.ts, a single patch its "(aangepast)" variant, a single plan "🗓️ Weekplan van Stijn:
 * 7 gerechten", a single member card its one-sentence text, a single progress envelope
 * "📈 Voortgang van Stijn — Level 12 · …" (the title in `opts.lang`), several items a compact
 * header ("🍲 3 recepten van Stijn"), the open line and one URL per line. Each URL is
 * `#r=`/`#p=`/`#w=`/`#b=`/`#f=`/`#x=`. (A plan, a card or progress combined with other envelopes
 * into a bundle file keeps the recipes but loses the plan / the card / the progress itself.)
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
  } else if (envelopes.length === 1 && first && first.t === 'w' && urls[0]) {
    text = buildPlanShareMessage({ dishes: planDishCount(first), by, url: urls[0], lang });
  } else if (envelopes.length === 1 && first && first.t === 'f' && urls[0]) {
    const card = readMemberPayload(first.f);
    text = buildMemberShareMessage({ name: card?.name ?? by, url: urls[0], lang });
  } else if (envelopes.length === 1 && first && first.t === 'x' && urls[0]) {
    const card = readProgressPayload(first.x);
    const level = card?.level ?? 1;
    // Lazy: the level titles stay out of the Safari landing bundle, which shares this module.
    const { titleFor } = await import('./levels.ts');
    text = buildProgressShareMessage({ name: card?.name ?? by, level, title: titleFor(level, lang), url: urls[0], lang });
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
