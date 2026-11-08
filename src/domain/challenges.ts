// Challenges (docs/specs/challenges.md, block 6E): free on level 20. Framework-free: no preact, no
// dexie, no clock (the moment comes in through `facts.now` / the arguments); runs in Node (tests) and
// in the app. The definitions live in data/challenges.json and arrive here as `unknown` through
// `normalizeChallenges`, which keeps only usable entries.
//
// Progress is DERIVED, never added up (§1f, §4.3): `progressFor` recomputes it from the facts every
// time. Only facts with a moment inside the window [startedAt, min(deadline, now)] count. A finished
// challenge lives on in the history (`DoneChallenge`), which is the only source of the bonus XP
// (src/domain/xp.ts, event kind 'challenge').
//
// Semantics per rule kind (pinned by tests/challenges.test.ts). "Cook" = a CookLogEntry of the member
// (`facts.log` holds the member's WHOLE log: the "new" rules look before the start); "in the window" =
// Date.parse(at) within [startedAt, min(deadline, now)].
// - cooks            = cooks in the window
// - cooksWithTag     = cooks in the window whose recipe has the tag: tagsWithVariants(recipe) plus the
//                      tags of a cooked diet tab (entry.variant, DIET_TAGS_FOR), as the badges do
// - cooksInCategory  = cooks in the window whose recipe has that category
// - newCuisines      = distinct cuisines cooked in the window that the member never cooked before startedAt
// - newRecipes       = distinct recipeIds cooked in the window that the member never cooked before startedAt
// - photos           = photo rows in the window whose recipe the member has cooked (any cook in the log)
// - distinctDays     = distinct local days with at least one cook in the window (any term); target n
// - categories       = listed categories with at least one cook in the window; target = their number
// - plannedCooks     = the member's cooks in the window of a dish that is on the week plan: each cook is
//                      matched to one week dish (`facts.plannedCooks`: a plan slot ticked cooked, same
//                      recipeId, added to the week at or before the cook); every plan dish counts at most
//                      once. It counts any planned dish, by hand or by Verras me (PlanItem has no origin).
// A recipeId that is not in `recipes` only counts for the kinds that need nothing but the log
// (cooks, newRecipes, distinctDays, plannedCooks). `current` is capped at `target`.

import { DIET_TAGS_FOR, VARIANT_DIETS, type VariantDiet } from './diets.ts';
import { dayIndexOfIso, isoWeekMondayOf, localDayIndex } from './days.ts';
import { inSeason, isoWeekKey, parseSeasonWindow, type BadgeSeason } from './badges.ts';
import type { CookLogEntry, Recipe } from './model.ts';
import { tagsWithVariants } from './variants.ts';
import { hash32 } from './xp.ts';

// ---------------------------------------------------------------------------- model (§2)

/** week = Mon–Sun of the start; month = through the end of the month; season = through the end of the season. */
export type ChallengeTerm = 'week' | 'month' | 'season';

export type ChallengeRule =
  | { kind: 'cooks'; n: number }
  | { kind: 'cooksWithTag'; tag: string; n: number }
  | { kind: 'cooksInCategory'; category: string; n: number }
  | { kind: 'newCuisines'; n: number }
  | { kind: 'newRecipes'; n: number }
  | { kind: 'photos'; n: number }
  | { kind: 'distinctDays'; n: number } // n >= 2 (validator)
  | { kind: 'categories'; categories: string[] }
  | { kind: 'plannedCooks'; n: number };

export interface Challenge {
  id: string;
  nl: { name: string; description: string };
  en: { name: string; description: string };
  rule: ChallengeRule;
  term: ChallengeTerm;
  xp: number;
  weight: 1 | 2 | 3;
  icon: string;
}

export interface ActiveChallenge {
  id: string;
  memberId: string;
  startedAt: string;
  deadline: string;
  /** The reward as computed at the start (`rewardFor`, V1b §1f); missing on challenges started before V1b. */
  xp?: number;
}

export interface DoneChallenge {
  id: string;
  memberId: string;
  startedAt: string;
  finishedAt: string;
  xp: number;
}

export interface ChallengeFacts {
  /** The member's whole cook log (not only the window: newCuisines/newRecipes look before the start). */
  log: CookLogEntry[];
  /** Classics + own + received, by id. */
  recipes: ReadonlyMap<string, Recipe>;
  /** The member's photo rows. */
  photoRows: ReadonlyArray<{ recipeId: string; at: string }>;
  /** Feature events with their moment (§2). Not read by any rule: `features.log` keeps no moment per
   *  event (see plannedCooks); the app passes an empty array. */
  features: ReadonlyArray<{ id: string; at: string }>;
  /** The week dishes ticked cooked (main dishes and side dishes) with the moment they were added to
   *  the week; read by plannedCooks. Absent = none. */
  plannedCooks?: ReadonlyArray<{ recipeId: string; addedAt: string }>;
  /** ISO moment "now": nothing later counts. */
  now: string;
}

/**
 * The season windows a 'season' term ends with (badges-avatar seizoensvensters): the `season`
 * windows of data/badges.json. termDeadline uses the LONGEST window that contains the start day, so
 * passing every badge season (the four seasons plus single feast days) picks the season itself.
 */
export type SeasonWindows = ReadonlyArray<BadgeSeason>;

export const CHALLENGE_TERMS: readonly ChallengeTerm[] = ['week', 'month', 'season'];

/** Rule kinds with only `{ n }`. */
const N_KINDS: ReadonlySet<string> = new Set(['cooks', 'newCuisines', 'newRecipes', 'photos', 'plannedCooks', 'distinctDays']);

// ---------------------------------------------------------------------------- normalize

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

function normalizeName(value: unknown): { name: string; description: string } | null {
  if (!isRecord(value)) return null;
  const name = nonEmptyString(value['name']);
  const description = nonEmptyString(value['description']);
  return name !== null && description !== null ? { name, description } : null;
}

function normalizeRule(value: unknown): ChallengeRule | null {
  if (!isRecord(value)) return null;
  const kind = value['kind'];
  if (typeof kind !== 'string') return null;
  if (kind === 'categories') {
    const raw = value['categories'];
    if (!Array.isArray(raw)) return null;
    const categories: string[] = [];
    for (const c of raw) {
      const id = nonEmptyString(c);
      if (id === null) return null;
      if (!categories.includes(id)) categories.push(id);
    }
    return categories.length > 0 ? { kind, categories } : null;
  }
  const n = positiveInt(value['n']);
  if (n === null) return null;
  if (N_KINDS.has(kind)) return { kind: kind as 'cooks' | 'newCuisines' | 'newRecipes' | 'photos' | 'plannedCooks' | 'distinctDays', n };
  if (kind === 'cooksWithTag') {
    const tag = nonEmptyString(value['tag']);
    return tag === null ? null : { kind, tag, n };
  }
  if (kind === 'cooksInCategory') {
    const category = nonEmptyString(value['category']);
    return category === null ? null : { kind, category, n };
  }
  return null;
}

/**
 * Normalize the raw contents of data/challenges.json. Tolerant like normalizeBadges: unusable entries
 * are skipped (never an exception). Usable = an id, both languages (name + description), a valid
 * rule, a known term, xp a positive integer and weight 1/2/3. A
 * missing icon falls back to '🎯' (the card's own emoji, §1b); the validator demands one. Duplicate
 * ids: the first one stays.
 */
export function normalizeChallenges(v: unknown): Challenge[] {
  if (!Array.isArray(v)) return [];
  const out: Challenge[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!isRecord(raw)) continue;
    const id = nonEmptyString(raw['id']);
    const nl = normalizeName(raw['nl']);
    const en = normalizeName(raw['en']);
    const rule = normalizeRule(raw['rule']);
    const term = raw['term'];
    const xp = positiveInt(raw['xp']);
    const weight = raw['weight'];
    if (id === null || nl === null || en === null || rule === null || xp === null) continue;
    if (term !== 'week' && term !== 'month' && term !== 'season') continue;
    if (weight !== 1 && weight !== 2 && weight !== 3) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, nl, en, rule, term, xp, weight, icon: nonEmptyString(raw['icon']) ?? '🎯' });
  }
  return out;
}

/**
 * The reward of a challenge for a member on `level` (V1b §1f, Stijn 8 nov: "1% per level"): +1 % per
 * level above 20 (the level where challenges come free), rounded to tens. Level 20 and below → the
 * base. Fixed at the start (`ActiveChallenge.xp`), so a level-up during the term changes nothing.
 */
export function rewardFor(baseXp: number, level: number): number {
  // Same formula as the spec, in whole percents so a half ten rounds up: 1500 × 1.13 is
  // 1694.999… in floating point (→ 1690), while 1500 × 113 / 100 is exactly 1695 (→ 1700).
  const percent = 100 + Math.max(0, level - 20);
  return Math.round((baseXp * percent) / 100 / 10) * 10;
}

/** The stored `challenges.done` (any shape) → valid rows, deduplicated on id + startedAt (first one stays). */
export function normalizeDoneChallenges(v: unknown): DoneChallenge[] {
  if (!Array.isArray(v)) return [];
  const out: DoneChallenge[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!isRecord(raw)) continue;
    const id = nonEmptyString(raw['id']);
    const memberId = nonEmptyString(raw['memberId']);
    const startedAt = nonEmptyString(raw['startedAt']);
    const finishedAt = nonEmptyString(raw['finishedAt']);
    const xp = raw['xp'];
    if (id === null || memberId === null || startedAt === null || finishedAt === null) continue;
    if (typeof xp !== 'number' || !Number.isInteger(xp) || xp < 0) continue;
    const key = doneKey({ id, startedAt });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, memberId, startedAt, finishedAt, xp });
  }
  return out;
}

/** Restore merge of `challenges.done`: the history only grows (local first, then what only the file has). */
export function mergeDoneChallenges(local: unknown, incoming: unknown): DoneChallenge[] {
  return normalizeDoneChallenges([...normalizeDoneChallenges(local), ...normalizeDoneChallenges(incoming)]);
}

/** The stored `challenges.active` (any shape) → memberId → a valid ActiveChallenge or null. */
export function normalizeActiveChallenges(v: unknown): Record<string, ActiveChallenge | null> {
  const out: Record<string, ActiveChallenge | null> = {};
  if (!isRecord(v)) return out;
  for (const [member, raw] of Object.entries(v)) {
    if (member === '') continue;
    if (!isRecord(raw)) {
      out[member] = null;
      continue;
    }
    const id = nonEmptyString(raw['id']);
    const memberId = nonEmptyString(raw['memberId']);
    const startedAt = nonEmptyString(raw['startedAt']);
    const deadline = nonEmptyString(raw['deadline']);
    const xp = raw['xp'];
    if (id === null || memberId === null || startedAt === null || deadline === null) {
      out[member] = null;
      continue;
    }
    const active: ActiveChallenge = { id, memberId, startedAt, deadline };
    // The reward fixed at the start (V1b): kept only when it is a usable amount, else the base applies.
    if (typeof xp === 'number' && Number.isInteger(xp) && xp >= 0) active.xp = xp;
    out[member] = active;
  }
  return out;
}

/** The identity of a done challenge (dedupe and the XP seed): id + startedAt. */
export function doneKey(d: { id: string; startedAt: string }): string {
  return d.id + '|' + d.startedAt;
}

// ---------------------------------------------------------------------------- terms and weeks

const DAY_MS = 86_400_000;

/** Local 23:59:59.999 of the calendar day (y, m 0-based, d) as an ISO string. */
function endOfLocalDay(y: number, m: number, d: number): string {
  return new Date(y, m, d, 23, 59, 59, 999).toISOString();
}

/** [y, m 0-based, d] of a day index (the index already encodes the local calendar day). */
function ymdOfDay(day: number): [number, number, number] {
  const d = new Date(day * DAY_MS);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** Length in days of a season window (inclusive, wrapping the turn of the year), in a leap year. */
function seasonLength(s: BadgeSeason): number {
  const w = parseSeasonWindow(s);
  if (w === null) return -1;
  const from = Date.UTC(2000, w.from[0] - 1, w.from[1]);
  let to = Date.UTC(2000, w.to[0] - 1, w.to[1]);
  if (to < from) to = Date.UTC(2001, w.to[0] - 1, w.to[1]);
  return Math.round((to - from) / DAY_MS) + 1;
}

/**
 * The ISO end of the window, local time (23:59:59.999 of its last day):
 * - week:   the Sunday of the ISO week (Mon–Sun) that holds the start;
 * - month:  the last day of the start's month;
 * - season: the last day of the longest window in `seasons` that holds the start day, in the first
 *           year at or after the start (a winter window '12-21'…'03-19' started in December ends in
 *           March of the next year). No window holds the start day → the end of the month.
 * An unreadable startedAt is returned as it is (the challenge is then over at once).
 */
export function termDeadline(term: ChallengeTerm, startedAt: string, seasons: SeasonWindows): string {
  const t = Date.parse(startedAt);
  if (!Number.isFinite(t)) return startedAt;
  const start = new Date(t);
  const y = start.getFullYear();
  const m = start.getMonth();
  const d = start.getDate();
  if (term === 'week') {
    const [sy, sm, sd] = ymdOfDay(isoWeekMondayOf(localDayIndex(start)) + 6);
    return endOfLocalDay(sy, sm, sd);
  }
  if (term === 'season') {
    let best: BadgeSeason | null = null;
    let bestLength = -1;
    for (const s of seasons) {
      if (!inSeason([m + 1, d], s)) continue;
      const length = seasonLength(s);
      if (length > bestLength) {
        best = s;
        bestLength = length;
      }
    }
    const w = best ? parseSeasonWindow(best) : null;
    if (w !== null) {
      const [tm, td] = w.to;
      const endYear = tm * 100 + td >= (m + 1) * 100 + d ? y : y + 1;
      return endOfLocalDay(endYear, tm - 1, Math.min(td, daysInMonth(endYear, tm - 1)));
    }
  }
  return endOfLocalDay(y, m, daysInMonth(y, m));
}

/** 'YYYY-Www', ISO week with Monday as the start (local calendar day); the offer changes with it. */
export function weekKey(date: Date): string {
  return isoWeekKey(date);
}

/** Day index of the Monday of an ISO week key 'YYYY-Www'; null for anything else. */
function mondayOfWeekKey(key: string): number | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const week1Monday = isoWeekMondayOf(Math.floor(Date.UTC(year, 0, 4) / DAY_MS));
  return week1Monday + (week - 1) * 7;
}

/** "Not done in the last 8 weeks" (§2): from the Monday 8 weeks before the offer's week on. */
const RECENT_WEEKS = 8;

/**
 * The offer of the week (§1b, §2): three challenges, one of each weight (1, 2, 3, in that order),
 * none that this member finished in the last 8 weeks (finishedAt on or after the Monday 8 weeks
 * before the week of `key`; the current week counts as recent, so a challenge done this week leaves
 * the offer). Deterministic: per weight the candidates in pool order, index hash32(key + memberId) mod
 * their number. When every challenge of a weight was done recently, the ones whose last finish is the
 * oldest are the candidates (the offer never runs dry). A weight without any challenge in the pool is
 * left out.
 */
export function offerFor(pool: readonly Challenge[], key: string, memberId: string, recentDone: readonly DoneChallenge[]): Challenge[] {
  const monday = mondayOfWeekKey(key);
  const since = monday === null ? Number.NEGATIVE_INFINITY : monday - RECENT_WEEKS * 7;
  // id → local day of the member's latest finish.
  const lastDone = new Map<string, number>();
  for (const d of recentDone) {
    if (d.memberId !== memberId) continue;
    const day = dayIndexOfIso(d.finishedAt);
    if (day === null) continue;
    const prev = lastDone.get(d.id);
    if (prev === undefined || day > prev) lastDone.set(d.id, day);
  }
  const h = hash32(key + memberId);
  const out: Challenge[] = [];
  for (const weight of [1, 2, 3] as const) {
    const bucket = pool.filter((c) => c.weight === weight);
    if (bucket.length === 0) continue;
    let candidates = bucket.filter((c) => {
      const day = lastDone.get(c.id);
      return day === undefined || day < since;
    });
    if (candidates.length === 0) {
      const oldest = Math.min(...bucket.map((c) => lastDone.get(c.id) ?? Number.NEGATIVE_INFINITY));
      candidates = bucket.filter((c) => (lastDone.get(c.id) ?? Number.NEGATIVE_INFINITY) === oldest);
    }
    out.push(candidates[h % candidates.length]!);
  }
  return out;
}

// ---------------------------------------------------------------------------- progress

function tagsOfCook(entry: CookLogEntry, recipe: Recipe): Set<string> {
  const tags = new Set(tagsWithVariants(recipe));
  const variant = entry.variant;
  if (typeof variant === 'string' && (VARIANT_DIETS as readonly string[]).includes(variant)) {
    for (const tag of DIET_TAGS_FOR[variant as VariantDiet]) tags.add(tag);
  }
  return tags;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * The progress of an active challenge, recomputed from the facts (§1f): `current` capped at
 * `target`, `done` = current ≥ target. Only facts with a moment inside [startedAt, min(deadline,
 * now)] count; the rule semantics are in the header of this module.
 */
export function progressFor(c: Challenge, active: ActiveChallenge, facts: ChallengeFacts): { current: number; target: number; done: boolean } {
  const startMs = Date.parse(active.startedAt);
  const deadlineMs = Date.parse(active.deadline);
  const nowMs = Date.parse(facts.now);
  const endMs = Number.isFinite(nowMs) ? Math.min(deadlineMs, nowMs) : deadlineMs;
  const valid = Number.isFinite(startMs) && Number.isFinite(endMs);
  const inWindow = (at: string): boolean => {
    if (!valid) return false;
    const t = Date.parse(at);
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  };
  const before = (at: string): boolean => {
    const t = Date.parse(at);
    return Number.isFinite(t) && Number.isFinite(startMs) && t < startMs;
  };

  const windowCooks = facts.log.filter((e) => inWindow(e.at));
  const rule = c.rule;
  let current = 0;
  let target = 0;

  switch (rule.kind) {
    case 'cooks':
      target = rule.n;
      current = windowCooks.length;
      break;
    case 'cooksWithTag':
      target = rule.n;
      for (const e of windowCooks) {
        const r = facts.recipes.get(e.recipeId);
        if (r && tagsOfCook(e, r).has(rule.tag)) current++;
      }
      break;
    case 'cooksInCategory':
      target = rule.n;
      for (const e of windowCooks) if (facts.recipes.get(e.recipeId)?.category === rule.category) current++;
      break;
    case 'newCuisines': {
      target = rule.n;
      const old = new Set<string>();
      for (const e of facts.log) {
        if (!before(e.at)) continue;
        const cuisine = nonEmpty(facts.recipes.get(e.recipeId)?.cuisine);
        if (cuisine !== null) old.add(cuisine);
      }
      const fresh = new Set<string>();
      for (const e of windowCooks) {
        const cuisine = nonEmpty(facts.recipes.get(e.recipeId)?.cuisine);
        if (cuisine !== null && !old.has(cuisine)) fresh.add(cuisine);
      }
      current = fresh.size;
      break;
    }
    case 'newRecipes': {
      target = rule.n;
      const old = new Set(facts.log.filter((e) => before(e.at)).map((e) => e.recipeId));
      current = new Set(windowCooks.filter((e) => !old.has(e.recipeId)).map((e) => e.recipeId)).size;
      break;
    }
    case 'photos': {
      target = rule.n;
      const cooked = new Set(facts.log.map((e) => e.recipeId));
      for (const p of facts.photoRows) if (inWindow(p.at) && cooked.has(p.recipeId)) current++;
      break;
    }
    case 'distinctDays': {
      target = rule.n;
      const days = new Set<number>();
      for (const e of windowCooks) {
        const day = dayIndexOfIso(e.at);
        if (day !== null) days.add(day);
      }
      current = days.size;
      break;
    }
    case 'categories': {
      target = rule.categories.length;
      const wanted = new Set(rule.categories);
      const hit = new Set<string>();
      for (const e of windowCooks) {
        const category = facts.recipes.get(e.recipeId)?.category;
        if (typeof category === 'string' && wanted.has(category)) hit.add(category);
      }
      current = hit.size;
      break;
    }
    case 'plannedCooks': {
      target = rule.n;
      // Each week dish (a cooked plan slot) can carry one cook: the earliest cook in the window of that
      // recipe at or after the moment the dish was added to the week.
      const slots = (facts.plannedCooks ?? [])
        .map((p) => ({ recipeId: p.recipeId, added: Date.parse(p.addedAt) }))
        .filter((p) => Number.isFinite(p.added))
        .sort((a, b) => a.added - b.added);
      const used = new Set<number>();
      const cooks = windowCooks.map((e) => ({ recipeId: e.recipeId, t: Date.parse(e.at) })).sort((a, b) => a.t - b.t);
      for (const cook of cooks) {
        // The latest-added free slot that was already in the week: keeps earlier slots for earlier cooks.
        let pick = -1;
        for (let k = 0; k < slots.length; k++) {
          const slot = slots[k]!;
          if (!used.has(k) && slot.recipeId === cook.recipeId && slot.added <= cook.t) pick = k;
        }
        if (pick >= 0) {
          used.add(pick);
          current++;
        }
      }
      break;
    }
  }
  return { current: Math.min(current, target), target, done: target > 0 && current >= target };
}
