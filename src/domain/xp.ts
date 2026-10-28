// XP, levels and the cooking streak (docs/specs/xp-levels.md §2a–§2c). Framework-free.
//
// XP is DERIVED, never added up: deriveXp() recomputes the whole state from facts that exist anyway
// (cook log, photos, own recipes, earned badges). Every reward gets a seed string; the random parts
// (±20 % variation, crits) come from a fixed hash of that seed, so the same facts always give the
// same total on every phone. All numbers live in XP_RULES; nothing below hard-codes them.

import { dayIndexOfIso, isoWeekMondayOf, localDayIndex } from './days';

export const XP_RULES_VERSION = 1 as const;

export interface XpRules {
  version: number;
  cookFirst: number;        // 100: 1st time this recipe
  cookStep: number;         // 10: 2nd time 90, 3rd 80 …
  cookFloor: number;        // 50: never lower
  difficultyPer: number;    // 5 per ingredient line above difficultyFromLines
  difficultyFromLines: number; // 7
  difficultyMax: number;    // 30
  starsBonus: number;       // 5 (stars, also given afterwards)
  photoFirst: number;       // 30: first photo of this dish
  photoNext: number;        // 20: every next one (max 1 rewarded photo per recipe per day)
  ownRecipe: number;        // 10: own recipe; 15 when bilingual
  ownRecipeBilingual: number;
  badgePerLevel: number;    // 50 × tier (tier 1 = 50 … 8 = 400)
  badgeSecret: number;      // 250, fixed
  fullWeek: number;         // 50: cooked on 7 of 7 days of an ISO week
  capFull: number;          // 3: cooks 1–3 of a day count in full
  capHalf: number;          // 5: cooks 4–5 count half; 6+ nothing
  busyDayFrom: number;      // 4: a day with ≥ 4 slot-taking cooks is "busy"
  busyRunDays: number;      // 3: from the 4th busy day in a row no cook XP
  backdateDays: number;     // 7: logged more than 7 days after the cook = no XP
  streak: ReadonlyArray<readonly [minDays: number, mult: number]>; // [[365,2],[100,1.75],[30,1.5],[14,1.3],[7,1.2],[3,1.1]]
  variation: number;        // 0.2 → ±20 %
  critCooked: number;       // 0.05
  critOvercooked: number;   // 0.01
  curveK: number;           // 11
  curveP: number;           // 2.5
  maxLevel: number;         // 100
}

export const XP_RULES: XpRules = Object.freeze({
  version: XP_RULES_VERSION,
  cookFirst: 100,
  cookStep: 10,
  cookFloor: 50,
  difficultyPer: 5,
  difficultyFromLines: 7,
  difficultyMax: 30,
  starsBonus: 5,
  photoFirst: 30,
  photoNext: 20,
  ownRecipe: 10,
  ownRecipeBilingual: 15,
  badgePerLevel: 50,
  badgeSecret: 250,
  fullWeek: 50,
  capFull: 3,
  capHalf: 5,
  busyDayFrom: 4,
  busyRunDays: 3,
  backdateDays: 7,
  streak: Object.freeze([
    Object.freeze([365, 2] as const),
    Object.freeze([100, 1.75] as const),
    Object.freeze([30, 1.5] as const),
    Object.freeze([14, 1.3] as const),
    Object.freeze([7, 1.2] as const),
    Object.freeze([3, 1.1] as const),
  ]),
  variation: 0.2,
  critCooked: 0.05,
  critOvercooked: 0.01,
  curveK: 11,
  curveP: 2.5,
  maxLevel: 100,
});

/**
 * The streak's free day: a skipped day keeps the streak only when it lies at least this many days
 * after the previous skipped day ("één vrije dag per week", §2b). Part of the streak definition,
 * not a field of XpRules.
 */
const FREE_DAY_EVERY = 7;

// ---------------------------------------------------------------------------- seeded random

/** FNV-1a 32 bit over UTF-16 code units, met murmur3-fmix32 als afsluiter (buurseeds delen geen bits). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
export function unitFromSeed(seed: string): number { return hash32(seed) / 4294967296; } // [0, 1)
export type Crit = 'cooked' | 'overcooked';
export function rollReward(base: number, seed: string, r: XpRules = XP_RULES): { xp: number; crit: Crit | null } {
  const variation = 1 - r.variation + 2 * r.variation * unitFromSeed(seed + '|v'); // 0,8 … 1,2
  const c = unitFromSeed(seed + '|c');
  const crit: Crit | null = c < r.critOvercooked ? 'overcooked' : c < r.critOvercooked + r.critCooked ? 'cooked' : null;
  return { xp: Math.round(base * variation) * (crit === 'overcooked' ? 5 : crit === 'cooked' ? 2 : 1), crit };
}

// ---------------------------------------------------------------------------- types

export interface XpCookFact { id?: number; recipeId: string; at: string; stars?: number | null; loggedAt?: string }
export interface XpRecipeFact { lines: number }                 // ingredient lines without kind 'header'
export interface XpPhotoFact { recipeId: string; at: string }
export interface XpOwnRecipeFact { id: string; bilingual: boolean }
/** level ≥ 1 (ladder: the reached tier; one-off: 1); `xp` = Badge.xp of a one-off badge (§2f). */
export interface XpBadgeFact { id: string; level: number; secret: boolean; xp?: number }
export interface XpFacts {
  log: XpCookFact[];                                 // this member only
  recipes: ReadonlyMap<string, XpRecipeFact>;        // all recipes (classics + own + received)
  photos: XpPhotoFact[];                             // this member only (Photo.memberId)
  ownRecipes: XpOwnRecipeFact[];                     // origin.kind 'user', author = this member, no variantOf/basedOn
  badges: XpBadgeFact[];                             // earned on the member's OWN tab (Together does not count)
}
export type XpEventKind = 'cook' | 'week' | 'photo' | 'recipe' | 'badge';
export type XpZeroReason = 'dayCap' | 'sameRecipe' | 'backdated' | 'busyWeek' | 'samePhotoDay';
export interface XpEvent {
  kind: XpEventKind; key: string;                    // key = seed (unique per event)
  at?: string; day?: number; recipeId?: string;      // cook/photo: at + local day index
  base: number; factor: number;                      // factor = cap × streak (1 for non-cook)
  xp: number; crit: Crit | null; reason: XpZeroReason | null;
}
export interface XpStreak { current: number; best: number; lastDay: number | null; freeDayUsed: boolean }
export interface XpState {
  rulesVersion: number; total: number; level: number;
  levelStart: number; nextAt: number | null;         // nextAt null at level 100
  streak: XpStreak; cookDays: number[];              // ascending local day indexes
  events: XpEvent[]; byKey: ReadonlyMap<string, XpEvent>;
}
export interface XpDelta { amount: number; pops: Array<{ xp: number; crit: Crit | null; kind: XpEventKind }>;
  levelFrom: number; levelTo: number; zeroReasons: XpZeroReason[] }

// ---------------------------------------------------------------------------- curve and streak

/** Total XP needed to HAVE `level`: round(curveK · (level − 1)^curveP); level 1 (and below) = 0. */
export function xpForLevel(level: number, rules: XpRules = XP_RULES): number {
  if (!(level > 1)) return 0;
  return Math.round(rules.curveK * Math.pow(level - 1, rules.curveP));
}

/** Highest level ≤ maxLevel whose xpForLevel ≤ total (at least 1). */
export function levelForXp(total: number, rules: XpRules = XP_RULES): number {
  let level = 1;
  while (level < rules.maxLevel && xpForLevel(level + 1, rules) <= total) level++;
  return level;
}

/** Multiplier of a cook day with a streak of `days` cook days (1–2 → ×1 … ≥ 365 → ×2). */
export function streakMultiplier(days: number, rules: XpRules = XP_RULES): number {
  for (const [minDays, mult] of rules.streak) if (days >= minDays) return mult;
  return 1;
}

/** Running state of the streak walk over ascending cook days (§2b "Streak"). */
interface StreakWalk { streak: number; best: number; lastSkip: number | null; lastDay: number | null }

function newWalk(): StreakWalk {
  return { streak: 0, best: 0, lastSkip: null, lastDay: null };
}

/**
 * Advance the walk by one cook day (strictly after w.lastDay): a gap of 1 → streak + 1; a gap of 2
 * (one skipped day) with no earlier skip or the skipped day ≥ 7 days after it → streak + 1 and that
 * day becomes lastSkip; anything else → streak 1, lastSkip cleared.
 */
function stepWalk(w: StreakWalk, day: number): void {
  if (w.lastDay === null) {
    w.streak = 1;
  } else {
    const gap = day - w.lastDay;
    if (gap === 1) {
      w.streak++;
    } else if (gap === 2 && (w.lastSkip === null || day - 1 - w.lastSkip >= FREE_DAY_EVERY)) {
      w.streak++;
      w.lastSkip = day - 1;
    } else {
      w.streak = 1;
      w.lastSkip = null;
    }
  }
  w.lastDay = day;
  if (w.streak > w.best) w.best = w.streak;
}

function walkDays(cookDays: readonly number[]): StreakWalk {
  const w = newWalk();
  for (const day of cookDays) stepWalk(w, day);
  return w;
}

/** The UI streak as of `today`, from a finished walk. */
function streakAsOf(w: StreakWalk, today: number): XpStreak {
  if (w.lastDay !== null) {
    const gap = today - w.lastDay;
    if (gap <= 1) return { current: w.streak, best: w.best, lastDay: w.lastDay, freeDayUsed: false };
    if (gap === 2 && (w.lastSkip === null || today - 1 - w.lastSkip >= FREE_DAY_EVERY)) {
      return { current: w.streak, best: w.best, lastDay: w.lastDay, freeDayUsed: true };
    }
  }
  return { current: 0, best: w.best, lastDay: w.lastDay, freeDayUsed: false };
}

/**
 * Current streak for the UI: last cook day today or yesterday → the streak; the day before
 * yesterday with the free day still available → the streak with `freeDayUsed: true`; else 0.
 * `rules` is accepted for signature symmetry (§2c); the streak rule has no tunables in XpRules.
 */
export function currentStreak(cookDays: readonly number[], today: number, rules: XpRules = XP_RULES): XpStreak {
  void rules;
  return streakAsOf(walkDays(cookDays), today);
}

/** Langste streak over alle kookdagen (zelfde vrije-dag-regel); voor de badge `streakDays` (badges-avatar.md). */
export function longestDayStreak(cookDays: readonly number[], rules: XpRules = XP_RULES): number {
  void rules;
  return walkDays(cookDays).best;
}

// ---------------------------------------------------------------------------- derivation

interface CookRow { c: XpCookFact; day: number }

/** Cook order: local day, then `at`, then `id` (§2b rule 1); recipeId only breaks exact ties. */
function compareCookRows(a: CookRow, b: CookRow): number {
  if (a.day !== b.day) return a.day - b.day;
  if (a.c.at !== b.c.at) return a.c.at < b.c.at ? -1 : 1;
  const ai = a.c.id ?? Number.MAX_SAFE_INTEGER;
  const bi = b.c.id ?? Number.MAX_SAFE_INTEGER;
  if (ai !== bi) return ai - bi;
  return a.c.recipeId < b.c.recipeId ? -1 : a.c.recipeId > b.c.recipeId ? 1 : 0;
}

interface PhotoRow { p: XpPhotoFact; day: number }

function comparePhotoRows(a: PhotoRow, b: PhotoRow): number {
  if (a.day !== b.day) return a.day - b.day;
  if (a.p.at !== b.p.at) return a.p.at < b.p.at ? -1 : 1;
  return a.p.recipeId < b.p.recipeId ? -1 : a.p.recipeId > b.p.recipeId ? 1 : 0;
}

// Status of a cook after the first pass over its day.
const SLOT = 0;      // takes a cap slot (and counts towards a busy day)
const SAME = 1;      // same recipe again on this day → 0 XP, no slot (still counts as a cook: k rises)
const BACKDATED = 2; // logged more than backdateDays after the cook → 0 XP, no slot
const DUPLICATE = 3; // identical recipeId + at = the same cook identity (seed) → ignored

function capFactor(rank: number, rules: XpRules): number {
  return rank <= rules.capFull ? 1 : rank <= rules.capHalf ? 0.5 : 0;
}

/** Recompute the complete XP state from the facts (§2a). Deterministic; input order does not matter. */
export function deriveXp(facts: XpFacts, rules: XpRules = XP_RULES, today: number = localDayIndex(new Date())): XpState {
  const events: XpEvent[] = [];
  const byKey = new Map<string, XpEvent>();
  let total = 0;
  const push = (e: XpEvent): void => {
    events.push(e);
    byKey.set(e.key, e);
    total += e.xp;
  };

  // ---- cooks: one sort, then day by day (streak, cap, rest rule).
  const rows: CookRow[] = [];
  for (const c of facts.log) {
    const day = dayIndexOfIso(c.at);
    if (day !== null) rows.push({ c, day });
  }
  rows.sort(compareCookRows);

  const n = rows.length;
  const status = new Uint8Array(n);
  const rank = new Int32Array(n);
  const entryDay = new Float64Array(n);
  const bases = new Float64Array(n);
  const keys = new Array<string>(n);
  const cookCount = new Map<string, number>();  // recipeId → cooks so far (k)
  const entrySlots = new Map<number, number>(); // entry day (loggedAt, else at) → slots taken so far
  const dayRecipes = new Map<string, string>(); // this day: recipeId → last `at` (one Map, cleared per day)
  const cookDays: number[] = [];
  const walk = newWalk();
  let busyRun = 0;
  let lastBusyDay: number | null = null;

  let i = 0;
  while (i < n) {
    const day = rows[i]!.day;
    let j = i;
    while (j < n && rows[j]!.day === day) j++;

    stepWalk(walk, day);
    cookDays.push(day);
    const mult = streakMultiplier(walk.streak, rules);

    // Pass 1: k, base, same recipe, backdated, cap rank on the cook day.
    dayRecipes.clear();
    let slots = 0;
    for (let x = i; x < j; x++) {
      const c = rows[x]!.c;
      const prevAt = dayRecipes.get(c.recipeId);
      if (prevAt === c.at) {
        status[x] = DUPLICATE;
        continue;
      }
      dayRecipes.set(c.recipeId, c.at);
      const k = (cookCount.get(c.recipeId) ?? 0) + 1;
      cookCount.set(c.recipeId, k);
      const lines = facts.recipes.get(c.recipeId)?.lines ?? 0;
      bases[x] =
        Math.max(rules.cookFloor, rules.cookFirst - rules.cookStep * (k - 1)) +
        Math.min(rules.difficultyMax, rules.difficultyPer * Math.max(0, lines - rules.difficultyFromLines)) +
        (c.stars ? rules.starsBonus : 0);
      keys[x] = 'cook:' + c.recipeId + '|' + c.at;
      if (prevAt !== undefined) {
        status[x] = SAME;
        continue;
      }
      const logged = c.loggedAt !== undefined ? dayIndexOfIso(c.loggedAt) : null;
      if (logged !== null && logged - day > rules.backdateDays) {
        status[x] = BACKDATED;
        continue;
      }
      status[x] = SLOT;
      rank[x] = ++slots;
      entryDay[x] = logged ?? day;
    }

    // Rest rule: from the (busyRunDays + 1)th busy day in a row the day's cooks give nothing.
    const busy = slots >= rules.busyDayFrom;
    if (busy) {
      busyRun = lastBusyDay === day - 1 ? busyRun + 1 : 1;
      lastBusyDay = day;
    } else {
      busyRun = 0;
      lastBusyDay = null;
    }
    const resting = busy && busyRun > rules.busyRunDays;

    // Pass 2: cap on the entry day (rule 1b), factor, roll.
    for (let x = i; x < j; x++) {
      const s = status[x]!;
      if (s === DUPLICATE) continue;
      const c = rows[x]!.c;
      const key = keys[x]!;
      const base = bases[x]!;
      let reason: XpZeroReason | null = null;
      let factor = 0;
      if (s === SAME) {
        reason = 'sameRecipe';
      } else if (s === BACKDATED) {
        reason = 'backdated';
      } else {
        const ed = entryDay[x]!;
        const entryRank = (entrySlots.get(ed) ?? 0) + 1;
        entrySlots.set(ed, entryRank);
        const cap = Math.min(capFactor(rank[x]!, rules), capFactor(entryRank, rules));
        if (cap === 0) reason = 'dayCap';
        else if (resting) reason = 'busyWeek';
        else factor = cap * mult;
      }
      let xp = 0;
      let crit: Crit | null = null;
      if (factor > 0) {
        const roll = rollReward(base * factor, key, rules);
        xp = roll.xp;
        crit = roll.crit;
      }
      push({ kind: 'cook', key, at: c.at, day, recipeId: c.recipeId, base, factor, xp, crit, reason });
    }
    i = j;
  }

  // ---- full weeks: every ISO week (Mon–Sun) with a cook on all 7 days; no streak factor.
  for (let w = 0; w < cookDays.length; ) {
    const monday = isoWeekMondayOf(cookDays[w]!);
    let count = 0;
    while (w < cookDays.length && cookDays[w]! < monday + 7) {
      count++;
      w++;
    }
    if (count === 7) {
      const key = 'week:' + monday;
      const roll = rollReward(rules.fullWeek, key, rules);
      push({ kind: 'week', key, base: rules.fullWeek, factor: 1, xp: roll.xp, crit: roll.crit, reason: null });
    }
  }

  // ---- photos: first of a dish photoFirst, later ones photoNext, max one rewarded per recipe per day.
  const photoRows: PhotoRow[] = [];
  for (const p of facts.photos) {
    const day = dayIndexOfIso(p.at);
    if (day !== null) photoRows.push({ p, day });
  }
  photoRows.sort(comparePhotoRows);
  const lastPhotoDay = new Map<string, number>(); // recipeId → day of its last rewarded photo
  for (const { p, day } of photoRows) {
    const key = 'photo:' + p.recipeId + '|' + p.at;
    if (byKey.has(key)) continue;
    const last = lastPhotoDay.get(p.recipeId);
    const base = last === undefined ? rules.photoFirst : rules.photoNext;
    if (last === day) {
      push({ kind: 'photo', key, at: p.at, day, recipeId: p.recipeId, base, factor: 0, xp: 0, crit: null, reason: 'samePhotoDay' });
      continue;
    }
    lastPhotoDay.set(p.recipeId, day);
    const roll = rollReward(base, key, rules);
    push({ kind: 'photo', key, at: p.at, day, recipeId: p.recipeId, base, factor: 1, xp: roll.xp, crit: roll.crit, reason: null });
  }

  // ---- own recipes.
  for (const r of facts.ownRecipes) {
    const key = 'recipe:' + r.id;
    if (byKey.has(key)) continue;
    const base = r.bilingual ? rules.ownRecipeBilingual : rules.ownRecipe;
    const roll = rollReward(base, key, rules);
    push({ kind: 'recipe', key, base, factor: 1, xp: roll.xp, crit: roll.crit, reason: null });
  }

  // ---- badges (§2f): ladder → one event per reached tier k with base badgePerLevel·k; one-off
  // (explicit xp, or secret) → one event `|1` with base xp ?? badgeSecret. Base 0 (the donate
  // heart, xp: 0) is an event of 0 XP without a roll, so it never pops.
  const addBadge = (key: string, base: number): void => {
    if (byKey.has(key)) return;
    if (base <= 0) {
      push({ kind: 'badge', key, base, factor: 1, xp: 0, crit: null, reason: null });
      return;
    }
    const roll = rollReward(base, key, rules);
    push({ kind: 'badge', key, base, factor: 1, xp: roll.xp, crit: roll.crit, reason: null });
  };
  for (const b of facts.badges) {
    if (b.xp !== undefined || b.secret) {
      addBadge('badge:' + b.id + '|1', b.xp ?? rules.badgeSecret);
    } else {
      const top = Math.max(1, Math.floor(b.level));
      for (let k = 1; k <= top; k++) addBadge('badge:' + b.id + '|' + k, rules.badgePerLevel * k);
    }
  }

  const level = levelForXp(total, rules);
  return {
    rulesVersion: rules.version,
    total,
    level,
    levelStart: xpForLevel(level, rules),
    nextAt: level >= rules.maxLevel ? null : xpForLevel(level + 1, rules),
    streak: streakAsOf(walk, today),
    cookDays,
    events,
    byKey,
  };
}

/**
 * Difference between two states: new keys → pops (only xp > 0; a new 0-XP event adds its reason
 * to zeroReasons, once); a higher xp on an existing key (stars given afterwards) → a pop of the
 * difference, without crit (it is not a new roll). `amount` is the sum of the pops.
 */
export function diffXp(prev: XpState | null, next: XpState): XpDelta {
  const pops: XpDelta['pops'] = [];
  const zeroReasons: XpZeroReason[] = [];
  let amount = 0;
  for (const e of next.events) {
    const old = prev ? prev.byKey.get(e.key) : undefined;
    if (old === undefined) {
      if (e.xp > 0) {
        pops.push({ xp: e.xp, crit: e.crit, kind: e.kind });
        amount += e.xp;
      } else if (e.reason !== null && !zeroReasons.includes(e.reason)) {
        zeroReasons.push(e.reason);
      }
    } else if (e.xp > old.xp) {
      const d = e.xp - old.xp;
      pops.push({ xp: d, crit: null, kind: e.kind });
      amount += d;
    }
  }
  return { amount, pops, levelFrom: prev ? prev.level : 1, levelTo: next.level, zeroReasons };
}
