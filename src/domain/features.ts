// Feature events (docs/specs/badges-avatar.md §2c). Framework-free: no preact, no dexie; runs in
// Node (tests, tools) and in the app.
//
// A light registration without a table: the setting `features.log` holds, per feature id, how often
// it happened (`n`), the first and last moment (ISO) and a count per member id (`by`; 'anon' when no
// profile was active). The app layer (src/features.ts `recordFeature`) bumps it after an action
// succeeded; the badges read it through `featureCounts` (rule kind 'feature'). Only ACTIONS are ids
// here, never looking at something (§5b "geen beloning voor kijken").
//
// 'overcooked' is NOT a feature event: that badge reads the XP state (BadgeFacts.xp, rule kind
// 'overcooked' in badges.ts).
//
// V1c-11 (Stijn, 15 Nov 2026: "365 keer Verras me spammen speelt alle levels vrij"): the actions that
// cost nothing to repeat have a cap per LOCAL day (DAILY_CAPS). A bump past the cap on the same day is
// dropped: the log does not change, so the badge does not count it and the XP behind the badge tiers
// stays honest. Each counter remembers the day of its last counted event and how many counted that
// day (`day`); older logs without it simply start counting on the next bump. Nothing in the UI says
// so (Stijn: "zonder dat te laten weten").

import { dayIndexOfIso, dayKey } from './days.ts';

export const FEATURE_IDS = [
  'voice',
  'print',
  'qrShown',
  'theme',
  'amounts',
  'readAloud',
  'langToggle',
  'fahrenheit',
  'pasteRecipe',
  'aiImport',
  'backup',
  'restore',
  'story',
  'pick7',
  'pantry',
  'wordPicker',
  'scaled',
  'standingList',
  'sort',
  'cookSwipe',
  'cookMode',
  'timer',
  'planCook',
  'listMade',
  'surprise',
  'dictEdit',
  'variant',
  'planShared',
  'listShared',
  'deltaShared',
  'cardShared',
  'feedback',
] as const;
// 32 ids.

export type FeatureId = (typeof FEATURE_IDS)[number];

/**
 * Counted events per local day, for the actions that are free to repeat (V1c-11). Ids absent here
 * have no cap. Only the tiered badges are listed: a one-off badge needs one event anyway.
 */
export const DAILY_CAPS: Readonly<Partial<Record<FeatureId, number>>> = {
  surprise: 10, // Verras me (Stijn: "max 10 per dag")
  timer: 10,
  cookMode: 5,
  planCook: 5,
  listMade: 3,
  standingList: 10,
  dictEdit: 25,
  variant: 5,
  planShared: 5,
  listShared: 5,
  deltaShared: 5,
};

export interface FeatureDay {
  /** Local calendar day ('yyyy-mm-dd') of the last counted event. */
  d: string;
  /** Events counted on that day. */
  n: number;
}

export interface FeatureCount {
  /** How often it happened, all members together. */
  n: number;
  /** ISO moment of the first and the last time. */
  first: string;
  last: string;
  /** Count per member id ('anon' without an active profile). */
  by: Record<string, number>;
  /** V1c-11: the last counted day and its count (missing in logs from before the caps). */
  day?: FeatureDay;
}

export type FeatureLog = Partial<Record<FeatureId, FeatureCount>>;

const FEATURE_ID_SET: ReadonlySet<string> = new Set<string>(FEATURE_IDS);

export function isFeatureId(v: unknown): v is FeatureId {
  return typeof v === 'string' && FEATURE_ID_SET.has(v);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A positive integer, else null. */
function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Order of two ISO moments: by time when both parse, else as strings (never throws). */
function compareIso(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return a < b ? -1 : a > b ? 1 : 0;
}

function minIso(a: string, b: string): string {
  return compareIso(a, b) <= 0 ? a : b;
}

function maxIso(a: string, b: string): string {
  return compareIso(a, b) >= 0 ? a : b;
}

function normalizeBy(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(value)) return out;
  for (const [member, raw] of Object.entries(value)) {
    const c = count(raw);
    if (member !== '' && c !== null) out[member] = c;
  }
  return out;
}

function normalizeDay(value: unknown): FeatureDay | null {
  if (!isRecord(value)) return null;
  const d = value['d'];
  const n = count(value['n']);
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && n !== null ? { d, n } : null;
}

function normalizeCount(value: unknown): FeatureCount | null {
  if (!isRecord(value)) return null;
  const n = count(value['n']);
  if (n === null) return null;
  const first = nonEmptyString(value['first']);
  const last = nonEmptyString(value['last']);
  // One moment missing: the other stands in for it; both missing → not a usable counter.
  if (first === null && last === null) return null;
  const out: FeatureCount = { n, first: first ?? (last as string), last: last ?? (first as string), by: normalizeBy(value['by']) };
  const day = normalizeDay(value['day']);
  if (day) out.day = day;
  return out;
}

/** The local calendar day of an ISO moment ('yyyy-mm-dd'); the date part of the string when it does not parse. */
export function featureDayOf(at: string): string {
  const idx = dayIndexOfIso(at);
  return idx === null ? at.slice(0, 10) : dayKey(idx);
}

/**
 * The stored `features.log` value (any shape) → a valid log. Tolerant like normalizeEarned: unknown
 * ids and broken counters are dropped, never an exception.
 */
export function normalizeFeatureLog(v: unknown): FeatureLog {
  const out: FeatureLog = {};
  if (!isRecord(v)) return out;
  for (const [id, raw] of Object.entries(v)) {
    if (!isFeatureId(id)) continue;
    const c = normalizeCount(raw);
    if (c !== null) out[id] = c;
  }
  return out;
}

/**
 * One more `id` by `memberId` at `at` (ISO). Returns a NEW log; the input is not changed. A new
 * counter starts at n 1, first = last = at; an existing one gets n + 1, `last` moves forward and
 * `first` stays (min/max, so a clock that went back never breaks the order).
 *
 * V1c-11: with a cap for `id` (`caps`, default DAILY_CAPS) and the cap already reached on the local
 * day of `at`, nothing changes and the SAME log comes back (`===`), so the caller can skip the write.
 */
export function bumpFeature(log: FeatureLog, id: FeatureId, memberId: string, at: string, caps: Readonly<Partial<Record<FeatureId, number>>> = DAILY_CAPS): FeatureLog {
  const prev = log[id];
  const cap = caps[id];
  const d = featureDayOf(at);
  const sameDay = prev?.day !== undefined && prev.day.d === d;
  if (cap !== undefined && sameDay && (prev?.day?.n ?? 0) >= cap) return log;
  const day: FeatureDay = { d, n: sameDay ? (prev?.day?.n ?? 0) + 1 : 1 };
  const next: FeatureCount = prev
    ? {
        n: prev.n + 1,
        first: minIso(prev.first, at),
        last: maxIso(prev.last, at),
        by: { ...prev.by, [memberId]: (prev.by[memberId] ?? 0) + 1 },
        day,
      }
    : { n: 1, first: at, last: at, by: { [memberId]: 1 }, day };
  return { ...log, [id]: next };
}

/** The later of two day records (V1c-11): the later day wins; the same day keeps the higher count. */
function laterDay(a: FeatureDay | undefined, b: FeatureDay | undefined): FeatureDay | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.d === b.d) return { d: a.d, n: Math.max(a.n, b.n) };
  return a.d > b.d ? a : b;
}

/**
 * Merge two logs (restore: local + file, §2g): per id n = max, first = min, last = max, and per
 * member the max. Never adds counts up: restoring the same backup twice changes nothing.
 */
export function mergeFeatureLogs(a: FeatureLog, b: FeatureLog): FeatureLog {
  const out: FeatureLog = {};
  for (const id of FEATURE_IDS) {
    const x = a[id];
    const y = b[id];
    if (x && y) {
      const by: Record<string, number> = { ...x.by };
      for (const [member, c] of Object.entries(y.by)) by[member] = Math.max(by[member] ?? 0, c);
      const merged: FeatureCount = { n: Math.max(x.n, y.n), first: minIso(x.first, y.first), last: maxIso(x.last, y.last), by };
      const day = laterDay(x.day, y.day);
      if (day) merged.day = day;
      out[id] = merged;
    } else if (x || y) {
      const only = (x ?? y) as FeatureCount;
      const copy: FeatureCount = { n: only.n, first: only.first, last: only.last, by: { ...only.by } };
      if (only.day) copy.day = { ...only.day };
      out[id] = copy;
    }
  }
  return out;
}

/**
 * Counts per feature id for the badges (BadgeFacts.features): 'all' = n, a member = by[member] ?? 0.
 * Ids that never happened are absent (the rule reads `features[id] ?? 0`).
 */
export function featureCounts(log: FeatureLog, memberId: string | 'all'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of FEATURE_IDS) {
    const c = log[id];
    if (!c) continue;
    out[id] = memberId === 'all' ? c.n : (c.by[memberId] ?? 0);
  }
  return out;
}
