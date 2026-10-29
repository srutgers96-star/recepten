// Badge evaluation (docs/phase-5-spec.md Block C item 1; extended by docs/specs/badges-avatar.md
// §2a–§2c, block 6D-2a). Framework-free: no preact, no dexie, no clock (everything comes from
// `facts`); runs in Node (tests) and in the app. The badge definitions live in data/badges.json and
// arrive here as `unknown` through `normalizeBadges`, which keeps only usable entries — nothing from
// that file is hardcoded here; this module works on any valid badge array.
//
// Two shapes of badge:
// - one-off: `rule.n` (or a plain kind with its own target); tier 0/1, maxTier 1;
// - ladder:  `tiers` = exactly 8 ascending thresholds (yellow … platinum), `rule` has no `n`;
//            tier 0..8, maxTier 8; current/target show the way to the NEXT tier (on platinum the
//            last threshold). `earned` = tier ≥ 1.
// `retired` badges only exist because `badges.earned` knows their id: never evaluated, never shown.
//
// Semantics (pinned by tests/badges.test.ts). "Cook" = a CookLogEntry of the member (all of them on
// "Samen"); "local day" = the calendar day in the phone's time zone (days.ts).
// - cookCount        = log.length
// - distinctRecipes  = distinct recipeIds in the log
// - reviews          = entries with stars 1–5; oneStar = stars === 1; fiveStar = stars === 5
// - streakWeeks      = LONGEST run of consecutive ISO weeks (Monday start, local day) with a cook
// - streakDays       = longestDayStreak (src/domain/xp.ts, one forgiven gap day per 7 days) over the
//                      sorted unique local cook days
// - fullWeeks        = ISO weeks with cooks on all 7 local days
// - letters          = target 26; distinct first letters A–Z (diacritics folded) of the NL name
//                      (else EN) of cooked recipes
// - category/tag/ingredient/cuisine = number of LOG ENTRIES (cooks, not distinct) whose recipe has
//                      that category / tag / a line with ing === id / cuisine
// - cuisines         = distinct non-empty `cuisine` values among cooked recipes
// - classics         = distinct cooked classics ('b:' ids that exist in `recipes`); allClassics
//                      (target classicsTotal) and halfClassics (target ceil(classicsTotal / 2)) share it
// - allCategories    = distinct categories among cooked recipes, target facts.categoriesTotal
// - seasonCooks      = cooks whose local month-day lies in badge.season (inclusive, may wrap the year)
// - weekdayCooks     = cooks on the given local weekdays (0 = Sunday … 6 = Saturday)
// - cookHour         = cooks whose local hour lies in [from, to], EXCEPT rows at exactly 12:00:00.000
//                      local: the marker of cookedAtForDay (src/cooklog.ts) for a backdated day
// - sameRecipeDays   = the longest run of consecutive local days with a cook of ONE recipe (max over
//                      all recipes); target n
// - calendar         = cooks on a Friday the 13th / on 29 February (local)
// - feature          = facts.features[id] ?? 0 (src/domain/features.ts)
// - retryAfterOneStar = recipes that were cooked again after a cook with stars === 1 (by `at`)
// - comeback         = cooks whose previous cook of the same recipe was more than `days` local days earlier
// - overcooked       = XP events with crit 'overcooked' in facts.xp (0 without facts.xp)
// - ownRecipes/received/shared come straight from the facts (household-wide counters)
// - photos = rows in facts.photoRows (already filtered to the member); photoRecipes = distinct
//   recipeIds there; photosOfOneRecipe = the most rows of one recipeId
// - householdMembers / donor = facts.householdMembers / facts.donorLevel; cooks = distinct
//   profileIds in the log
// - fullCycle        = own recipes (origin.kind 'user') made through the AI prompt (origin.via 'ai')
//                      that are in facts.sharedRecipeIds AND facts.boughtRecipeIds AND have a cook
//                      in facts.log AND a row in facts.photoRows (block 6D-2c, "Hele cirkel"). The
//                      first three are household-wide; log and photoRows are already filtered to the
//                      member ('all' = everyone, so a cook and a photo by different members count)
// A recipeId that is not in `recipes` only counts for the kinds that need nothing but the log
// itself (counts, stars, dates, streaks, per-recipeId runs); never for the kinds that read the
// recipe (category, tag, ingredient, cuisine(s), letters, classics, allCategories). An unparsable
// `at` only counts where no date is needed. `current` is capped at `target`.
import { pickText, type CookLogEntry, type Recipe } from './model.ts';
import { dayIndexOfIso, isoWeekMondayOf, localDayIndex } from './days.ts';
import { isFeatureId, type FeatureId } from './features.ts';
import { XP_RULES, longestDayStreak, type XpState } from './xp.ts';

// ---------------------------------------------------------------------------- model

export type BadgeGroup = 'koken' | 'ontdekken' | 'keukens' | 'seizoenen' | 'samen' | 'foto' | 'reeksen' | 'geheim';

/** The eight groups in page order (§1a). */
export const BADGE_GROUPS: readonly BadgeGroup[] = ['koken', 'ontdekken', 'keukens', 'seizoenen', 'samen', 'foto', 'reeksen', 'geheim'];

/** The eight ladder colours, tier 1 … 8 (§1a; the UI translates them via `badges.tier.<k>`). */
export const TIER_COLOURS = ['geel', 'groen', 'blauw', 'rood', 'brons', 'zilver', 'goud', 'platina'] as const;

/** 'MM-DD' … 'MM-DD', inclusive; `to` < `from` wraps the turn of the year ('12-21' … '03-19'). */
export interface BadgeSeason {
  from: string;
  to: string;
}

/** A badge unlocks an avatar part: a one-off as soon as it is earned, a ladder once tier `tier` is
 *  reached (required on a ladder). */
export interface BadgeUnlock {
  part: string;
  tier?: number;
}

type CountKind =
  | 'cookCount'
  | 'distinctRecipes'
  | 'ownRecipes'
  | 'reviews'
  | 'oneStar'
  | 'fiveStar'
  | 'photos'
  | 'photoRecipes'
  | 'photosOfOneRecipe'
  | 'shared'
  | 'received'
  | 'streakWeeks'
  | 'streakDays'
  | 'fullWeeks'
  | 'classics'
  | 'cuisines'
  | 'householdMembers'
  | 'cooks'
  | 'donor';
type IdKind = 'category' | 'tag' | 'ingredient' | 'cuisine';
type PlainKind = 'letters' | 'allClassics' | 'halfClassics' | 'allCategories';
type CalendarWhen = 'friday-13' | 'leap-day';

export type BadgeRule =
  | { kind: CountKind; n?: number } // no n = ladder (tiers on the badge)
  | { kind: IdKind; id: string; n?: number }
  | { kind: PlainKind }
  | { kind: 'seasonCooks'; n?: number } // window = badge.season
  | { kind: 'weekdayCooks'; days: number[]; n?: number } // 0 = Sunday … 6 = Saturday
  | { kind: 'cookHour'; from: number; to: number; n?: number } // hours 0–23, inclusive
  | { kind: 'sameRecipeDays'; n: number } // n consecutive local days, the same recipe
  | { kind: 'calendar'; when: CalendarWhen; n?: number }
  | { kind: 'feature'; id: FeatureId; n?: number }
  | { kind: 'retryAfterOneStar'; n?: number }
  | { kind: 'comeback'; days: number; n?: number }
  | { kind: 'overcooked'; n?: number } // counts facts.xp?.events with crit 'overcooked'
  | { kind: 'fullCycle'; n?: number }; // AI prompt → share → groceries → cook → photo, per recipe (6D-2c)

export interface Badge {
  id: string;
  nl: { name: string; description: string };
  en: { name: string; description: string };
  icon: string;
  rule: BadgeRule;
  group: BadgeGroup;
  /** Ladder: exactly 8 ascending thresholds (yellow, green, blue, red, bronze, silver, gold,
   *  platinum). Then `rule` has no `n`, and both descriptions contain the placeholder `{n}`. */
  tiers?: number[];
  /** Invisible until earned (group 'geheim' is always hidden; other groups may be too). */
  hidden?: boolean;
  /** Only for rule.kind 'seasonCooks': the window in which cooks count. */
  season?: BadgeSeason;
  unlock?: BadgeUnlock;
  /** XP override for a ONE-OFF badge (default 50; hidden default 250). Ladders: 50 × tier, never
   *  an override (docs/specs/xp-levels.md). 0 = cosmetic (the heart). */
  xp?: number;
  /** Only still here because `badges.earned` knows the id: not shown, not evaluated, no XP.
   *  `replacedBy` points at the ladder that took over. */
  retired?: boolean;
  replacedBy?: string;
  /** Phase-5 field; still valid, ignored by the new UI (the colour comes from the tier). */
  tier?: 1 | 2 | 3;
}

/** Local structural type (no import from src/db in the domain); src/badges.ts fills it from Photo rows. */
export interface PhotoRow {
  recipeId: string;
  memberId: string;
  at: string;
}

export interface BadgeFacts {
  /** Already filtered to the member; all entries for "Samen" (the whole household). */
  log: CookLogEntry[];
  /** Classics + own + received, by id. */
  recipes: ReadonlyMap<string, Recipe>;
  /** Number of built-in classics. */
  classicsTotal: number;
  /** Length of data/categories.json. */
  categoriesTotal: number;
  /** Household-wide counters. */
  ownRecipes: number;
  received: number;
  shared: number;
  /** = photoRows.length (kept for older callers; the rules read photoRows). */
  photos: number;
  /** Filtered to the member; all rows for 'all'. */
  photoRows: ReadonlyArray<PhotoRow>;
  /** featureCounts(log, memberId) from src/domain/features.ts. */
  features: Record<string, number>;
  /** membersFrom(profiles, household).length. */
  householdMembers: number;
  /** Setting 'donate.hearts'[memberId] ?? 0; 'all' = max. */
  donorLevel: number;
  /** XP state of this member (docs/specs/xp-levels.md), for the rule kind 'overcooked'; undefined on 'all'. */
  xp?: XpState;
  /** Household-wide (6D-2c): every recipe id in an 'out' row of the In & uit log, any kind. */
  sharedRecipeIds: ReadonlySet<string>;
  /** Household-wide (6D-2c): the recipes on the shopping trail (`shop.bought`): a line of theirs was ticked off. */
  boughtRecipeIds: ReadonlySet<string>;
}

export interface BadgeStatus {
  badge: Badge;
  /** One-off: earned. Ladder: tier ≥ 1. */
  earned: boolean;
  /** Progress towards the NEXT tier (ladder) or the goal (one-off); on platinum = target. */
  current: number;
  target: number;
  /** 0..8 (ladder) or 0/1 (one-off). */
  tier: number;
  /** 8 (ladder) or 1. */
  maxTier: number;
}

// ---------------------------------------------------------------------------- normalize

const COUNT_KINDS: ReadonlySet<string> = new Set<CountKind>([
  'cookCount',
  'distinctRecipes',
  'ownRecipes',
  'reviews',
  'oneStar',
  'fiveStar',
  'photos',
  'photoRecipes',
  'photosOfOneRecipe',
  'shared',
  'received',
  'streakWeeks',
  'streakDays',
  'fullWeeks',
  'classics',
  'cuisines',
  'householdMembers',
  'cooks',
  'donor',
]);
const ID_KINDS: ReadonlySet<string> = new Set<IdKind>(['category', 'tag', 'ingredient', 'cuisine']);
const PLAIN_KINDS: ReadonlySet<string> = new Set<PlainKind>(['letters', 'allClassics', 'halfClassics', 'allCategories']);
/** Kinds whose only parameter (besides n) is nothing at all. */
const BARE_KINDS: ReadonlySet<string> = new Set(['seasonCooks', 'retryAfterOneStar', 'overcooked', 'fullCycle']);
const CALENDAR_WHENS: ReadonlySet<string> = new Set<CalendarWhen>(['friday-13', 'leap-day']);
const GROUP_SET: ReadonlySet<string> = new Set<string>(BADGE_GROUPS);

/** Number of ladder thresholds. */
const LADDER_LENGTH = TIER_COLOURS.length;

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

function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function normalizeName(value: unknown): { name: string; description: string } | null {
  if (!isRecord(value)) return null;
  const name = nonEmptyString(value['name']);
  const description = nonEmptyString(value['description']);
  return name !== null && description !== null ? { name, description } : null;
}

/** Exactly 8 strictly ascending integers ≥ 1, else null. */
function normalizeTiers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== LADDER_LENGTH) return null;
  const out: number[] = [];
  for (const v of value) {
    const t = target(v);
    if (t === null) return null;
    const prev = out[out.length - 1];
    if (prev !== undefined && t <= prev) return null;
    out.push(t);
  }
  return out;
}

/** Rule kinds that take a threshold (`n`, or `tiers` on the badge). */
function takesThreshold(kind: string): boolean {
  return !PLAIN_KINDS.has(kind);
}

/** Rule kinds that can be a ladder (a threshold kind whose `n` is optional). */
function canLadder(kind: string): boolean {
  return takesThreshold(kind) && kind !== 'sameRecipeDays';
}

function normalizeRule(value: unknown): BadgeRule | null {
  if (!isRecord(value)) return null;
  const kind = value['kind'];
  if (typeof kind !== 'string') return null;
  if (PLAIN_KINDS.has(kind)) return { kind: kind as PlainKind };
  // A present but unusable n makes the rule unusable (never silently a ladder).
  const rawN = value['n'];
  const n = rawN === undefined ? undefined : target(rawN);
  if (n === null) return null;
  const withN = n === undefined ? {} : { n };
  if (COUNT_KINDS.has(kind)) return { kind: kind as CountKind, ...withN };
  if (ID_KINDS.has(kind)) {
    const id = nonEmptyString(value['id']);
    return id === null ? null : { kind: kind as IdKind, id, ...withN };
  }
  if (BARE_KINDS.has(kind)) return { kind: kind as 'seasonCooks' | 'retryAfterOneStar' | 'overcooked' | 'fullCycle', ...withN };
  switch (kind) {
    case 'weekdayCooks': {
      const raw = value['days'];
      if (!Array.isArray(raw) || raw.length === 0) return null;
      const days: number[] = [];
      for (const d of raw) {
        const day = intIn(d, 0, 6);
        if (day === null) return null;
        if (!days.includes(day)) days.push(day);
      }
      return { kind, days, ...withN };
    }
    case 'cookHour': {
      const from = intIn(value['from'], 0, 23);
      const to = intIn(value['to'], 0, 23);
      return from === null || to === null || from > to ? null : { kind, from, to, ...withN };
    }
    case 'sameRecipeDays':
      return n === undefined ? null : { kind, n };
    case 'calendar': {
      const when = value['when'];
      return typeof when === 'string' && CALENDAR_WHENS.has(when) ? { kind, when: when as CalendarWhen, ...withN } : null;
    }
    case 'feature': {
      const id = value['id'];
      return isFeatureId(id) ? { kind, id, ...withN } : null;
    }
    case 'comeback': {
      const days = target(value['days']);
      return days === null ? null : { kind, days, ...withN };
    }
  }
  return null;
}

/** 'MM-DD' → [month, day] when it is a real day of the year (29 February included), else null. */
function parseMonthDay(value: unknown): [number, number] | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(2000, month, 0)).getUTCDate(); // 2000 is a leap year
  return day <= daysInMonth ? [month, day] : null;
}

function normalizeSeason(value: unknown): BadgeSeason | null {
  if (!isRecord(value)) return null;
  const from = value['from'];
  const to = value['to'];
  if (parseMonthDay(from) === null || parseMonthDay(to) === null) return null;
  return { from: from as string, to: to as string };
}

function normalizeUnlock(value: unknown): BadgeUnlock | null {
  if (!isRecord(value)) return null;
  const part = nonEmptyString(value['part']);
  if (part === null) return null;
  const tier = intIn(value['tier'], 1, LADDER_LENGTH);
  return tier === null ? { part } : { part, tier };
}

/**
 * Normalize the raw contents of data/badges.json. Tolerant: unusable entries are skipped (never an
 * exception, never console output), so one bad badge can not take the screen down. A badge is
 * usable when it has an id, both languages (name + description), an icon and a valid rule with a
 * threshold where its kind needs one (`rule.n`, or valid `tiers`). Optional fields that are invalid
 * are dropped and the badge is kept: an unknown `group` becomes 'koken'; `tiers` that are not
 * exactly 8 strictly ascending integers ≥ 1 (or sit on a kind that can not be a ladder) are left
 * out; `hidden`/`retired` only count when `true` (group 'geheim' is always hidden); `season` needs
 * two valid 'MM-DD' strings; `unlock` a non-empty `part` (its `tier` only 1..8); `xp` an integer
 * ≥ 0. With valid `tiers` the badge is a ladder and `rule.n` is dropped. The strict checks are the
 * validator's (tools/validate-data.ts); the data always passes `npm run validate:data` first.
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
    let rule = normalizeRule(raw['rule']);
    if (id === null || nl === null || en === null || icon === null || rule === null) continue;

    const tiers = canLadder(rule.kind) ? normalizeTiers(raw['tiers']) : null;
    if (tiers !== null) {
      if ('n' in rule) {
        const copy: { n?: number } = { ...rule };
        delete copy.n;
        rule = copy as BadgeRule;
      }
    } else if (takesThreshold(rule.kind) && !('n' in rule && typeof rule.n === 'number')) {
      continue; // a threshold kind without n and without tiers can never be evaluated
    }

    const rawGroup = raw['group'];
    const group: BadgeGroup = typeof rawGroup === 'string' && GROUP_SET.has(rawGroup) ? (rawGroup as BadgeGroup) : 'koken';
    const badge: Badge = { id, nl, en, icon, rule, group };
    if (tiers !== null) badge.tiers = tiers;
    if (raw['hidden'] === true || group === 'geheim') badge.hidden = true;
    const season = normalizeSeason(raw['season']);
    if (season !== null) badge.season = season;
    const unlock = normalizeUnlock(raw['unlock']);
    if (unlock !== null) badge.unlock = unlock;
    const xp = intIn(raw['xp'], 0, Number.MAX_SAFE_INTEGER);
    if (xp !== null) badge.xp = xp;
    if (raw['retired'] === true) badge.retired = true;
    const replacedBy = nonEmptyString(raw['replacedBy']);
    if (replacedBy !== null) badge.replacedBy = replacedBy;
    const tier = raw['tier'];
    if (tier === 1 || tier === 2 || tier === 3) badge.tier = tier;
    out.push(badge);
  }
  return out;
}

// ---------------------------------------------------------------------------- ladders, XP, seasons

export function isLadder(b: Badge): b is Badge & { tiers: number[] } {
  return Array.isArray(b.tiers) && b.tiers.length === LADDER_LENGTH;
}

/**
 * The tier (0..8) that `current` reaches on the ladder; 0/1 for a one-off badge (against `rule.n`,
 * or against `target` for the plain kinds whose goal comes from the facts — without it they give 0).
 */
export function tierFor(b: Badge, current: number, target?: number): number {
  if (isLadder(b)) {
    let k = 0;
    for (const threshold of b.tiers) {
      if (current >= threshold) k++;
      else break;
    }
    return k;
  }
  const goal = target ?? ('n' in b.rule && typeof b.rule.n === 'number' ? b.rule.n : undefined);
  return goal !== undefined && current >= goal ? 1 : 0;
}

/**
 * The nominal XP this status is worth (docs/specs/xp-levels.md §2f; the derivation there adds its
 * seeded variation on top): ladder Σ 50·k for k ≤ tier; one-off `b.xp ?? (hidden ? 250 : 50)` when
 * earned; 0 when not earned and for a retired badge.
 */
export function badgeXp(s: BadgeStatus): number {
  const b = s.badge;
  if (b.retired === true) return 0;
  if (isLadder(b)) {
    const tier = Math.max(0, Math.min(LADDER_LENGTH, Math.floor(s.tier)));
    return (XP_RULES.badgePerLevel * tier * (tier + 1)) / 2;
  }
  if (!s.earned) return 0;
  return b.xp ?? (b.hidden === true ? XP_RULES.badgeSecret : XP_RULES.badgePerLevel);
}

/** Both ends of the window as [month, day], or null when one of them is not a valid 'MM-DD'. */
export function parseSeasonWindow(s: BadgeSeason): { from: [number, number]; to: [number, number] } | null {
  const from = parseMonthDay(s.from);
  const to = parseMonthDay(s.to);
  return from !== null && to !== null ? { from, to } : null;
}

/** Is [month, day] inside the window (inclusive; `to` before `from` wraps the turn of the year)? */
export function inSeason(monthDay: [number, number], s: BadgeSeason): boolean {
  const w = parseSeasonWindow(s);
  if (w === null) return false;
  const x = monthDay[0] * 100 + monthDay[1];
  const from = w.from[0] * 100 + w.from[1];
  const to = w.to[0] * 100 + w.to[1];
  return from <= to ? x >= from && x <= to : x >= from || x <= to;
}

// ---------------------------------------------------------------------------- weeks and letters

const DAY_MS = 86_400_000;

/**
 * ISO 8601 week key, 'YYYY-Www' (Monday start, local calendar day): the Thursday of the week
 * decides the ISO year, and week 1 is the week containing January 4th. Year boundaries are the
 * tricky part: 2025-12-29 → '2026-W01' and 2027-01-01 → '2026-W53' (pinned in tests).
 */
export function isoWeekKey(date: Date): string {
  const monday = isoWeekMondayOf(localDayIndex(date));
  const isoYear = new Date((monday + 3) * DAY_MS).getUTCFullYear(); // the week's Thursday
  const week1Monday = isoWeekMondayOf(Math.floor(Date.UTC(isoYear, 0, 4) / DAY_MS));
  const week = Math.round((monday - week1Monday) / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Longest run of consecutive ISO weeks (Mondays 7 days apart) among the given cook days. */
function longestWeekStreak(cookDays: readonly number[]): number {
  const mondays = [...new Set(cookDays.map(isoWeekMondayOf))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const monday of mondays) {
    run = prev !== null && monday === prev + 7 ? run + 1 : 1;
    if (run > best) best = run;
    prev = monday;
  }
  return best;
}

/** ISO weeks with a cook on all 7 days (same Monday logic as streakWeeks). */
function countFullWeeks(cookDays: readonly number[]): number {
  const perWeek = new Map<number, number>();
  for (const day of cookDays) {
    const monday = isoWeekMondayOf(day);
    perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1);
  }
  let full = 0;
  for (const days of perWeek.values()) if (days === 7) full++;
  return full;
}

/** Length of the longest run of consecutive numbers in an ascending list of unique day indexes. */
function longestConsecutive(days: readonly number[]): number {
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of days) {
    run = prev !== null && day === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
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

// ---------------------------------------------------------------------------- derivation

/** A log entry with a readable `at`: its moment, the local Date and the local day index. */
interface TimedEntry {
  entry: CookLogEntry;
  t: number;
  date: Date;
  day: number;
}

/** Everything derivable from the facts once, shared by all badges. */
interface Derived {
  cookCount: number;
  distinctRecipes: number;
  reviews: number;
  oneStar: number;
  fiveStar: number;
  cooks: number;
  /** Entries with a readable `at`, in log order. */
  timed: readonly TimedEntry[];
  /** Sorted unique local cook days. */
  cookDays: readonly number[];
  /** Per recipeId: the timed entries, ascending by moment. */
  timedByRecipe: ReadonlyMap<string, readonly TimedEntry[]>;
  /** Distinct first letters A–Z of cooked recipe names. */
  letters: ReadonlySet<string>;
  /** Distinct cooked classics ('b:' ids that exist in the recipe map). */
  classicsCooked: number;
  /** Distinct categories / cuisines among cooked recipes. */
  categoriesCooked: ReadonlySet<string>;
  cuisinesCooked: ReadonlySet<string>;
  /** Log-entry counts (cooks, not distinct) per category / tag / ingredient / cuisine id. */
  categoryCounts: ReadonlyMap<string, number>;
  tagCounts: ReadonlyMap<string, number>;
  ingredientCounts: ReadonlyMap<string, number>;
  cuisineCounts: ReadonlyMap<string, number>;
  /** Photo rows: total, distinct recipes, most rows of one recipe. */
  photos: number;
  photoRecipes: number;
  photosOfOneRecipe: number;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function derive(facts: BadgeFacts): Derived {
  const distinctIds = new Set<string>();
  const profiles = new Set<string>();
  let reviews = 0;
  let oneStar = 0;
  let fiveStar = 0;
  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const ingredientCounts = new Map<string, number>();
  const cuisineCounts = new Map<string, number>();
  const timed: TimedEntry[] = [];
  const timedByRecipe = new Map<string, TimedEntry[]>();
  // Distinct ingredient ids per recipe, cached: a recipe cooked ten times is only scanned once.
  const ingsByRecipe = new Map<string, ReadonlySet<string>>();

  for (const entry of facts.log) {
    distinctIds.add(entry.recipeId);
    profiles.add(entry.profileId);
    const stars = entry.stars;
    if (typeof stars === 'number' && stars >= 1 && stars <= 5) reviews++;
    if (stars === 1) oneStar++;
    if (stars === 5) fiveStar++;

    const day = dayIndexOfIso(entry.at);
    if (day !== null) {
      const t = Date.parse(entry.at);
      const row: TimedEntry = { entry, t, date: new Date(t), day };
      timed.push(row);
      const list = timedByRecipe.get(entry.recipeId);
      if (list) list.push(row);
      else timedByRecipe.set(entry.recipeId, [row]);
    }

    // Everything below needs the recipe; unknown ids only count for the log-only kinds.
    const recipe = facts.recipes.get(entry.recipeId);
    if (!recipe) continue;
    if (typeof recipe.category === 'string' && recipe.category !== '') bump(categoryCounts, recipe.category);
    if (typeof recipe.cuisine === 'string' && recipe.cuisine !== '') bump(cuisineCounts, recipe.cuisine);
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
  for (const list of timedByRecipe.values()) list.sort((a, b) => a.t - b.t);

  const letters = new Set<string>();
  const categoriesCooked = new Set<string>();
  const cuisinesCooked = new Set<string>();
  let classicsCooked = 0;
  for (const id of distinctIds) {
    const recipe = facts.recipes.get(id);
    if (!recipe) continue;
    if (id.startsWith('b:')) classicsCooked++;
    const letter = firstLetter(pickText(recipe.name, 'nl')); // NL name, else EN
    if (letter !== null) letters.add(letter);
    if (typeof recipe.category === 'string' && recipe.category !== '') categoriesCooked.add(recipe.category);
    if (typeof recipe.cuisine === 'string' && recipe.cuisine !== '') cuisinesCooked.add(recipe.cuisine);
  }

  const photoCounts = new Map<string, number>();
  for (const row of facts.photoRows) bump(photoCounts, row.recipeId);
  let photosOfOneRecipe = 0;
  for (const c of photoCounts.values()) if (c > photosOfOneRecipe) photosOfOneRecipe = c;

  return {
    cookCount: facts.log.length,
    distinctRecipes: distinctIds.size,
    reviews,
    oneStar,
    fiveStar,
    cooks: profiles.size,
    timed,
    cookDays: [...new Set(timed.map((r) => r.day))].sort((a, b) => a - b),
    timedByRecipe,
    letters,
    classicsCooked,
    categoriesCooked,
    cuisinesCooked,
    categoryCounts,
    tagCounts,
    ingredientCounts,
    cuisineCounts,
    photos: facts.photoRows.length,
    photoRecipes: photoCounts.size,
    photosOfOneRecipe,
  };
}

/** A finite count from the facts (anything else = 0). */
function factCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Exactly 12:00:00.000 local: cookedAtForDay's marker for a backdated day (the real hour is unknown). */
function isNoonMarker(date: Date): boolean {
  return date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}

function countTimed(d: Derived, test: (row: TimedEntry) => boolean): number {
  let n = 0;
  for (const row of d.timed) if (test(row)) n++;
  return n;
}

/** Longest run of consecutive local days with a cook of one and the same recipe (max over recipes). */
function sameRecipeRun(d: Derived): number {
  let best = 0;
  for (const rows of d.timedByRecipe.values()) {
    const days = [...new Set(rows.map((r) => r.day))].sort((a, b) => a - b);
    best = Math.max(best, longestConsecutive(days));
  }
  return best;
}

/** Recipes that were cooked again after (a later `at` than) a cook with stars === 1. */
function retriesAfterOneStar(d: Derived): number {
  let n = 0;
  for (const rows of d.timedByRecipe.values()) {
    const firstOneStar = rows.find((r) => r.entry.stars === 1);
    const last = rows[rows.length - 1];
    if (firstOneStar && last && last.t > firstOneStar.t) n++;
  }
  return n;
}

/** Cooks whose previous cook of the same recipe was more than `days` local days earlier. */
function comebacks(d: Derived, days: number): number {
  let n = 0;
  for (const rows of d.timedByRecipe.values()) {
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1] as TimedEntry;
      const cur = rows[i] as TimedEntry;
      if (cur.day - prev.day > days) n++;
    }
  }
  return n;
}

/**
 * Recipes that went the whole way (6D-2c): own, created through the AI prompt, shared, on the
 * shopping trail, cooked (a log entry) and photographed (a photo row). Log and photo rows arrive
 * filtered to the member; the shared and bought sets are household-wide.
 */
function fullCycles(facts: BadgeFacts): number {
  const shared = facts.sharedRecipeIds;
  const bought = facts.boughtRecipeIds;
  if (!shared || !bought) return 0;
  const cooked = new Set(facts.log.map((e) => e.recipeId));
  const photographed = new Set(facts.photoRows.map((r) => r.recipeId));
  let n = 0;
  for (const r of facts.recipes.values()) {
    if (r.origin?.kind !== 'user' || r.origin.via !== 'ai') continue;
    if (shared.has(r.id) && bought.has(r.id) && cooked.has(r.id) && photographed.has(r.id)) n++;
  }
  return n;
}

/** The raw count of a badge's rule (not capped). */
function measure(badge: Badge, facts: BadgeFacts, d: Derived): number {
  const rule = badge.rule;
  switch (rule.kind) {
    case 'cookCount':
      return d.cookCount;
    case 'distinctRecipes':
      return d.distinctRecipes;
    case 'ownRecipes':
      return factCount(facts.ownRecipes);
    case 'received':
      return factCount(facts.received);
    case 'shared':
      return factCount(facts.shared);
    case 'reviews':
      return d.reviews;
    case 'oneStar':
      return d.oneStar;
    case 'fiveStar':
      return d.fiveStar;
    case 'photos':
      return d.photos;
    case 'photoRecipes':
      return d.photoRecipes;
    case 'photosOfOneRecipe':
      return d.photosOfOneRecipe;
    case 'streakWeeks':
      return longestWeekStreak(d.cookDays);
    case 'streakDays':
      return longestDayStreak(d.cookDays);
    case 'fullWeeks':
      return countFullWeeks(d.cookDays);
    case 'classics':
    case 'allClassics':
    case 'halfClassics':
      return d.classicsCooked;
    case 'cuisines':
      return d.cuisinesCooked.size;
    case 'householdMembers':
      return factCount(facts.householdMembers);
    case 'cooks':
      return d.cooks;
    case 'donor':
      return factCount(facts.donorLevel);
    case 'category':
      return d.categoryCounts.get(rule.id) ?? 0;
    case 'tag':
      return d.tagCounts.get(rule.id) ?? 0;
    case 'ingredient':
      return d.ingredientCounts.get(rule.id) ?? 0;
    case 'cuisine':
      return d.cuisineCounts.get(rule.id) ?? 0;
    case 'letters':
      return d.letters.size;
    case 'allCategories':
      return d.categoriesCooked.size;
    case 'seasonCooks': {
      const season = badge.season;
      if (!season || parseSeasonWindow(season) === null) return 0;
      return countTimed(d, (r) => inSeason([r.date.getMonth() + 1, r.date.getDate()], season));
    }
    case 'weekdayCooks': {
      const days = new Set(rule.days);
      return countTimed(d, (r) => days.has(r.date.getDay()));
    }
    case 'cookHour':
      return countTimed(d, (r) => {
        if (isNoonMarker(r.date)) return false;
        const h = r.date.getHours();
        return h >= rule.from && h <= rule.to;
      });
    case 'sameRecipeDays':
      return sameRecipeRun(d);
    case 'calendar':
      return rule.when === 'friday-13'
        ? countTimed(d, (r) => r.date.getDay() === 5 && r.date.getDate() === 13)
        : countTimed(d, (r) => r.date.getMonth() === 1 && r.date.getDate() === 29);
    case 'feature':
      return factCount(facts.features[rule.id]);
    case 'retryAfterOneStar':
      return retriesAfterOneStar(d);
    case 'comeback':
      return comebacks(d, rule.days);
    case 'overcooked':
      return facts.xp ? facts.xp.events.filter((e) => e.crit === 'overcooked').length : 0;
    case 'fullCycle':
      return fullCycles(facts);
  }
}

/** The goal of a one-off badge: `rule.n`, or the plain kinds' own target. */
function oneOffTarget(rule: BadgeRule, facts: BadgeFacts): number {
  switch (rule.kind) {
    case 'letters':
      return 26;
    case 'allClassics':
      return facts.classicsTotal;
    case 'halfClassics':
      return Math.ceil(facts.classicsTotal / 2);
    case 'allCategories':
      return facts.categoriesTotal;
    default:
      // normalizeBadges keeps a non-ladder threshold kind only with n; 1 guards hand-built badges.
      return rule.n ?? 1;
  }
}

/**
 * One status per badge, in badge order; `retired` badges are skipped (they are not in the output).
 * Ladder: tier = thresholds reached, current/target towards the next tier (on platinum the last
 * threshold). One-off: tier 0/1 against its goal. `current` is always capped at `target`.
 */
export function evaluateBadges(badges: Badge[], facts: BadgeFacts): BadgeStatus[] {
  const d = derive(facts);
  const out: BadgeStatus[] = [];
  for (const badge of badges) {
    if (badge.retired === true) continue;
    const raw = measure(badge, facts, d);
    if (isLadder(badge)) {
      const tier = tierFor(badge, raw);
      const goal = badge.tiers[Math.min(tier, LADDER_LENGTH - 1)] as number;
      out.push({ badge, earned: tier >= 1, current: Math.min(raw, goal), target: goal, tier, maxTier: LADDER_LENGTH });
    } else {
      const goal = oneOffTarget(badge.rule, facts);
      const earned = raw >= goal;
      out.push({ badge, earned, current: Math.min(raw, goal), target: goal, tier: earned ? 1 : 0, maxTier: 1 });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------- merge helpers (§2g)

/**
 * The stored `badges.earned` value (any shape) → a valid record of member id ('all' = Samen) →
 * registered strings (`id` for a one-off, `id@k` for ladder tier k). Tolerant: anything else is dropped.
 */
export function normalizeEarned(v: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!isRecord(v)) return out;
  for (const [key, ids] of Object.entries(v)) {
    if (Array.isArray(ids)) out[key] = ids.filter((x): x is string => typeof x === 'string');
  }
  return out;
}

/**
 * Restore merge of `badges.earned` (§2g): the union per member key, order kept (local first, then
 * what only the file has), duplicates removed. Strings stay strings (`id@k` is never parsed here).
 */
export function mergeEarned(local: unknown, incoming: unknown): Record<string, string[]> {
  const a = normalizeEarned(local);
  const b = normalizeEarned(incoming);
  const out: Record<string, string[]> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = [...new Set([...(a[key] ?? []), ...(b[key] ?? [])])];
  }
  return out;
}

/** The stored `donate.hearts` value (any shape) → member id → integer level ≥ 0. */
function normalizeHearts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const [key, level] of Object.entries(v)) {
    const n = intIn(level, 0, Number.MAX_SAFE_INTEGER);
    if (n !== null) out[key] = n;
  }
  return out;
}

/** Restore merge of `donate.hearts` (§2g): the max per member. */
export function mergeDonateHearts(local: unknown, incoming: unknown): Record<string, number> {
  const out = normalizeHearts(local);
  for (const [key, level] of Object.entries(normalizeHearts(incoming))) out[key] = Math.max(out[key] ?? 0, level);
  return out;
}
