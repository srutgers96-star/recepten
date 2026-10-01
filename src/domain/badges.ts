// Badge evaluation (docs/phase-5-spec.md Block C item 1). Framework-free: no preact, no dexie;
// runs in Node (tests) and in the app. The badge definitions live in data/badges.json and arrive
// here as `unknown` through `normalizeBadges`, which keeps only valid entries (same requirements
// as the data validator: id, both languages, icon, a valid rule) — nothing from that file is
// hardcoded here; this module works on any valid badge array.
//
// Semantics (pinned by tests/badges.test.ts):
// - cookCount        = log.length
// - distinctRecipes  = distinct recipeIds in the log
// - reviews          = log entries with stars 1–5; oneStar = entries with stars === 1
// - streakWeeks      = LONGEST run of consecutive ISO weeks (ISO 8601, Monday start, LOCAL
//                      calendar day — a cook at 00:30 local Monday counts in the new week) with
//                      at least one entry
// - letters          = target 26; current = distinct first letters A–Z (diacritics folded, first
//                      letter character) of the NL name (else EN) of cooked recipes
// - category/tag/ingredient = number of LOG ENTRIES (cooks, not distinct) whose recipe has that
//                      category / that tag in tags / a line with ing === id
// - allClassics      = current: distinct cooked classics (id starts with 'b:'), target: classicsTotal
// - halfClassics     = same current, target: ceil(classicsTotal / 2)
// - ownRecipes/received/shared/photos come straight from the facts (household-wide counters)
// An unknown recipeId in the log only counts for cookCount/distinctRecipes/reviews/oneStar/
// streakWeeks. `current` is capped at `target`; earned = current >= target.
import { pickText, type CookLogEntry, type Recipe } from './model.ts';

export type BadgeRule =
  | { kind: 'cookCount' | 'distinctRecipes' | 'ownRecipes' | 'reviews' | 'oneStar' | 'photos' | 'shared' | 'received' | 'streakWeeks'; n: number }
  | { kind: 'category' | 'tag' | 'ingredient'; id: string; n: number }
  | { kind: 'letters' | 'allClassics' | 'halfClassics' };

export interface Badge {
  id: string;
  nl: { name: string; description: string };
  en: { name: string; description: string };
  icon: string;
  rule: BadgeRule;
  tier?: 1 | 2 | 3;
}

export interface BadgeFacts {
  /** Already filtered to the member; all entries for "Samen" (the whole household). */
  log: CookLogEntry[];
  /** Classics + own + received, by id. */
  recipes: ReadonlyMap<string, Recipe>;
  /** Number of built-in classics (196). */
  classicsTotal: number;
  /** Household-wide counters. */
  ownRecipes: number;
  received: number;
  shared: number;
  photos: number;
}

export interface BadgeStatus {
  badge: Badge;
  earned: boolean;
  current: number;
  target: number;
}

type CountKind = 'cookCount' | 'distinctRecipes' | 'ownRecipes' | 'reviews' | 'oneStar' | 'photos' | 'shared' | 'received' | 'streakWeeks';
type IdKind = 'category' | 'tag' | 'ingredient';
type PlainKind = 'letters' | 'allClassics' | 'halfClassics';

const COUNT_KINDS: ReadonlySet<string> = new Set<CountKind>([
  'cookCount', 'distinctRecipes', 'ownRecipes', 'reviews', 'oneStar', 'photos', 'shared', 'received', 'streakWeeks',
]);
const ID_KINDS: ReadonlySet<string> = new Set<IdKind>(['category', 'tag', 'ingredient']);
const PLAIN_KINDS: ReadonlySet<string> = new Set<PlainKind>(['letters', 'allClassics', 'halfClassics']);

const DAY_MS = 86_400_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non-empty string (whitespace-only counts as empty), else null. */
function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** A positive integer target, else null. */
function target(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

function normalizeName(value: unknown): { name: string; description: string } | null {
  if (!isRecord(value)) return null;
  const name = nonEmptyString(value['name']);
  const description = nonEmptyString(value['description']);
  return name !== null && description !== null ? { name, description } : null;
}

function normalizeRule(value: unknown): BadgeRule | null {
  if (!isRecord(value)) return null;
  const kind = value['kind'];
  if (typeof kind !== 'string') return null;
  if (COUNT_KINDS.has(kind)) {
    const n = target(value['n']);
    return n === null ? null : { kind: kind as CountKind, n };
  }
  if (ID_KINDS.has(kind)) {
    const id = nonEmptyString(value['id']);
    const n = target(value['n']);
    return id === null || n === null ? null : { kind: kind as IdKind, id, n };
  }
  if (PLAIN_KINDS.has(kind)) return { kind: kind as PlainKind };
  return null;
}

/**
 * Normalize the raw contents of data/badges.json. Tolerant: invalid entries are skipped (never an
 * exception, never console output), so one bad badge can not take the screen down. A badge is valid
 * when it has an id, both languages (name + description), an icon and a valid rule; an invalid
 * `tier` is dropped but the badge is kept.
 */
export function normalizeBadges(data: unknown): Badge[] {
  if (!Array.isArray(data)) return [];
  const out: Badge[] = [];
  for (const raw of data) {
    if (!isRecord(raw)) continue;
    const id = nonEmptyString(raw['id']);
    const nl = normalizeName(raw['nl']);
    const en = normalizeName(raw['en']);
    const icon = nonEmptyString(raw['icon']);
    const rule = normalizeRule(raw['rule']);
    if (id === null || nl === null || en === null || icon === null || rule === null) continue;
    const badge: Badge = { id, nl, en, icon, rule };
    const tier = raw['tier'];
    if (tier === 1 || tier === 2 || tier === 3) badge.tier = tier;
    out.push(badge);
  }
  return out;
}

/**
 * Epoch-day index of the LOCAL calendar day of `date` (1970-01-01 = day 0). Log timestamps are
 * UTC (nowIso), but the user lives in local time: a cook at 00:30 local Monday belongs to the
 * new local week, not to UTC's Sunday. Same convention as isoWeekNumber in aggregate.ts (the
 * local calendar day decides the week).
 */
function localDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/**
 * Day index of the Monday that starts the ISO week containing day index `days`.
 * 1970-01-01 was a Thursday, hence the +3. Two ISO weeks are consecutive exactly when their
 * Mondays are 7 days apart, which is what the streak below compares.
 */
function isoWeekMonday(days: number): number {
  const dow = (((days + 3) % 7) + 7) % 7; // Mon = 0 … Sun = 6
  return days - dow;
}

/**
 * ISO 8601 week key, 'YYYY-Www' (Monday start, local calendar day): the Thursday of the week
 * decides the ISO year, and week 1 is the week containing January 4th. Year boundaries are the
 * tricky part: 2025-12-29 → '2026-W01' and 2027-01-01 → '2026-W53' (pinned in tests).
 */
export function isoWeekKey(date: Date): string {
  const monday = isoWeekMonday(localDayIndex(date));
  const isoYear = new Date((monday + 3) * DAY_MS).getUTCFullYear(); // the week's Thursday
  const week1Monday = isoWeekMonday(Math.floor(Date.UTC(isoYear, 0, 4) / DAY_MS));
  const week = Math.round((monday - week1Monday) / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Longest run of consecutive ISO weeks with at least one log entry. */
function longestWeekStreak(log: CookLogEntry[]): number {
  const weeks = new Set<number>();
  for (const entry of log) {
    const t = Date.parse(entry.at);
    if (Number.isFinite(t)) weeks.add(isoWeekMonday(localDayIndex(new Date(t))));
  }
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const monday of sorted) {
    run = prev !== null && monday === prev + 7 ? run + 1 : 1;
    if (run > best) best = run;
    prev = monday;
  }
  return best;
}

/**
 * First letter character A–Z of a name, diacritics folded ('É' → 'E'); non-letter characters are
 * skipped ("'t Stoofpotje" → 'T'). NFKD also unfolds the 'Ĳ' ligature to 'I'+'J' → 'I'. Returns
 * null when the name contains no A–Z letter at all.
 */
function firstLetter(name: string): string | null {
  const folded = name.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  for (const ch of folded) {
    if (/[a-z]/i.test(ch)) return ch.toUpperCase();
  }
  return null;
}

/** Everything derivable from the log + recipes in one pass, shared by all badges. */
interface Derived {
  cookCount: number;
  distinctRecipes: number;
  reviews: number;
  oneStar: number;
  streakWeeks: number;
  /** Distinct first letters A–Z of cooked recipe names. */
  letters: ReadonlySet<string>;
  /** Distinct cooked classics ('b:' ids that exist in the recipe map). */
  classicsCooked: number;
  /** Log-entry counts (cooks, not distinct) per category / tag / ingredient id. */
  categoryCounts: ReadonlyMap<string, number>;
  tagCounts: ReadonlyMap<string, number>;
  ingredientCounts: ReadonlyMap<string, number>;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function derive(facts: BadgeFacts): Derived {
  const distinctIds = new Set<string>();
  let reviews = 0;
  let oneStar = 0;
  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const ingredientCounts = new Map<string, number>();
  // Distinct ingredient ids per recipe, cached: a recipe cooked ten times is only scanned once.
  const ingsByRecipe = new Map<string, ReadonlySet<string>>();

  for (const entry of facts.log) {
    distinctIds.add(entry.recipeId);
    const stars = entry.stars;
    if (typeof stars === 'number' && stars >= 1 && stars <= 5) reviews++;
    if (stars === 1) oneStar++;

    // Everything below needs the recipe; unknown ids only count for the counters above.
    const recipe = facts.recipes.get(entry.recipeId);
    if (!recipe) continue;
    if (typeof recipe.category === 'string' && recipe.category !== '') bump(categoryCounts, recipe.category);
    for (const tag of new Set(recipe.tags ?? [])) bump(tagCounts, tag);
    let ings = ingsByRecipe.get(entry.recipeId);
    if (!ings) {
      const set = new Set<string>();
      for (const line of recipe.lines ?? []) {
        if (typeof line.ing === 'string' && line.ing !== '') set.add(line.ing);
      }
      ings = set;
      ingsByRecipe.set(entry.recipeId, ings);
    }
    for (const ing of ings) bump(ingredientCounts, ing);
  }

  const letters = new Set<string>();
  let classicsCooked = 0;
  for (const id of distinctIds) {
    const recipe = facts.recipes.get(id);
    if (!recipe) continue;
    if (id.startsWith('b:')) classicsCooked++;
    const letter = firstLetter(pickText(recipe.name, 'nl')); // NL name, else EN
    if (letter !== null) letters.add(letter);
  }

  return {
    cookCount: facts.log.length,
    distinctRecipes: distinctIds.size,
    reviews,
    oneStar,
    streakWeeks: longestWeekStreak(facts.log),
    letters,
    classicsCooked,
    categoryCounts,
    tagCounts,
    ingredientCounts,
  };
}

function progress(rule: BadgeRule, facts: BadgeFacts, d: Derived): { current: number; target: number } {
  switch (rule.kind) {
    case 'cookCount':
      return { current: d.cookCount, target: rule.n };
    case 'distinctRecipes':
      return { current: d.distinctRecipes, target: rule.n };
    case 'ownRecipes':
      return { current: facts.ownRecipes, target: rule.n };
    case 'received':
      return { current: facts.received, target: rule.n };
    case 'shared':
      return { current: facts.shared, target: rule.n };
    case 'photos':
      return { current: facts.photos, target: rule.n };
    case 'reviews':
      return { current: d.reviews, target: rule.n };
    case 'oneStar':
      return { current: d.oneStar, target: rule.n };
    case 'streakWeeks':
      return { current: d.streakWeeks, target: rule.n };
    case 'category':
      return { current: d.categoryCounts.get(rule.id) ?? 0, target: rule.n };
    case 'tag':
      return { current: d.tagCounts.get(rule.id) ?? 0, target: rule.n };
    case 'ingredient':
      return { current: d.ingredientCounts.get(rule.id) ?? 0, target: rule.n };
    case 'letters':
      return { current: d.letters.size, target: 26 };
    case 'allClassics':
      return { current: d.classicsCooked, target: facts.classicsTotal };
    case 'halfClassics':
      return { current: d.classicsCooked, target: Math.ceil(facts.classicsTotal / 2) };
  }
}

/** One status per badge, in badge order. `current` is capped at `target`; earned = reached it. */
export function evaluateBadges(badges: Badge[], facts: BadgeFacts): BadgeStatus[] {
  const d = derive(facts);
  return badges.map((badge) => {
    const p = progress(badge.rule, facts, d);
    return {
      badge,
      earned: p.current >= p.target,
      current: Math.min(p.current, p.target),
      target: p.target,
    };
  });
}
