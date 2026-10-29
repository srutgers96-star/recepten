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

export interface FeatureCount {
  /** How often it happened, all members together. */
  n: number;
  /** ISO moment of the first and the last time. */
  first: string;
  last: string;
  /** Count per member id ('anon' without an active profile). */
  by: Record<string, number>;
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

function normalizeCount(value: unknown): FeatureCount | null {
  if (!isRecord(value)) return null;
  const n = count(value['n']);
  if (n === null) return null;
  const first = nonEmptyString(value['first']);
  const last = nonEmptyString(value['last']);
  // One moment missing: the other stands in for it; both missing → not a usable counter.
  if (first === null && last === null) return null;
  return { n, first: first ?? (last as string), last: last ?? (first as string), by: normalizeBy(value['by']) };
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
 */
export function bumpFeature(log: FeatureLog, id: FeatureId, memberId: string, at: string): FeatureLog {
  const prev = log[id];
  const next: FeatureCount = prev
    ? {
        n: prev.n + 1,
        first: minIso(prev.first, at),
        last: maxIso(prev.last, at),
        by: { ...prev.by, [memberId]: (prev.by[memberId] ?? 0) + 1 },
      }
    : { n: 1, first: at, last: at, by: { [memberId]: 1 } };
  return { ...log, [id]: next };
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
      out[id] = { n: Math.max(x.n, y.n), first: minIso(x.first, y.first), last: maxIso(x.last, y.last), by };
    } else if (x || y) {
      const only = (x ?? y) as FeatureCount;
      out[id] = { n: only.n, first: only.first, last: only.last, by: { ...only.by } };
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
