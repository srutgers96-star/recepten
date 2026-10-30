// "Sync mijn voortgang" and the cooking calendar (docs/specs/xp-levels.md §1h–§1j, §2h, block 6D-4).
// Framework-free: no preact, no dexie, no clock (`today` and the month come in as arguments).
//
// - progressCardFor  what the sender puts in a `#x=` token: the member-card fields plus level, XP,
//                    streak, badges and the cook days of the last 90 days (aggregates only: no notes,
//                    no stars, no photos). The card travels through buildProgressEnvelope (share.ts).
// - ProgressSnapshot what the receiver stores in the setting `progress.snapshots` (key = card id):
//                    the card as it arrived plus when it arrived and whether it was saved as a friend.
//                    A snapshot is a moment, not a sync: there is no server (invariant 14).
// - calendarMonth    one month of the cooking calendar: local cooks from the cook log, the others
//                    from their snapshots; the same person locally and in a snapshot → local wins.
import { dayFromKey, dayIndexOfIso, dayKey } from './days.ts';
import { DEFAULT_MEMBER_COLOR, type Member } from './household.ts';
import { normalizeAvatarSpec } from './avatar.ts';
import {
  PROGRESS_BADGE_RE,
  PROGRESS_MAX_BADGES,
  PROGRESS_MAX_DAYS,
  PROGRESS_MAX_DAY_RECIPES,
  readProgressPayload,
  type ProgressCard,
} from './share.ts';
import type { XpBadgeFact, XpCookFact, XpState } from './xp.ts';

/** A received `#x=` card as stored in `progress.snapshots` (§2h). */
export interface ProgressSnapshot extends ProgressCard {
  /** ISO timestamp of the moment this phone saved the card. */
  receivedAt: string;
  /** Saved with "Bewaar als vriend": not a household member, only in the calendar and under Friends. */
  friend: boolean;
}

/** An id as it travels (share.ts SAFE_ID): no whitespace, at most 64 characters. */
const SAFE_ID = /^\S{1,64}$/;
const MAX_LEVEL = 100;
const DAY_MS = 86_400_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function intAtLeast(v: number, min: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  const n = Math.round(v);
  return n >= min ? n : fallback;
}

/**
 * A badge fact as a card string, the `badges.earned` format: a reached tier k ≥ 2 → `id@k`, tier 1
 * → `id` (a one-off badge, or the first tier of a ladder, as in the frozen `#x=` envelope).
 */
function badgeString(b: XpBadgeFact): string | null {
  if (!b || typeof b.id !== 'string' || !Number.isInteger(b.level) || b.level < 1) return null;
  const s = b.level >= 2 ? `${b.id}@${b.level}` : b.id;
  return PROGRESS_BADGE_RE.test(s) ? s : null;
}

/**
 * The sender's progress card (§2h): the member-card fields (`deviceId` and `avatar` only when
 * usable), `rv` = the rules version of `state`, level, total XP, the current streak, the badges
 * of the member's own tab (`id` / `id@k`, unique, at most 400) and the cook days of the last 90
 * days up to and including `today` (a local day index): ascending, one entry per day with at least
 * one cook, `r` = the recipe ids of that day in cooking order (unique, at most 5). Nothing else:
 * no stars, no notes, no photos.
 */
export function progressCardFor(i: {
  member: Pick<Member, 'id' | 'name' | 'color' | 'lang'>;
  deviceId?: string;
  state: XpState;
  badges: XpBadgeFact[];
  log: XpCookFact[];
  today: number;
  avatar?: ProgressCard['avatar'];
}): ProgressCard {
  const badges: string[] = [];
  const seenBadges = new Set<string>();
  for (const b of i.badges) {
    const s = badgeString(b);
    if (s === null || seenBadges.has(s)) continue;
    seenBadges.add(s);
    badges.push(s);
    if (badges.length >= PROGRESS_MAX_BADGES) break;
  }

  // The last 90 local days up to today; the cooks of a day in the order they were cooked.
  const from = i.today - (PROGRESS_MAX_DAYS - 1);
  const cooks = i.log
    .map((c, index) => ({ c, index, t: Date.parse(c.at) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t || a.index - b.index);
  const byDay = new Map<number, string[]>();
  for (const { c } of cooks) {
    const day = dayIndexOfIso(c.at);
    if (day === null || day < from || day > i.today) continue;
    const ids = byDay.get(day) ?? [];
    byDay.set(day, ids);
    const id = typeof c.recipeId === 'string' ? c.recipeId : '';
    if (SAFE_ID.test(id) && !ids.includes(id) && ids.length < PROGRESS_MAX_DAY_RECIPES) ids.push(id);
  }
  const cookDays = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, r]) => ({ d: dayKey(day), r }));

  const deviceId = typeof i.deviceId === 'string' ? i.deviceId.trim() : '';
  const avatar = normalizeAvatarSpec(i.avatar);
  const level = Math.min(MAX_LEVEL, intAtLeast(i.state.level, 1, 1));
  return {
    id: i.member.id.trim(),
    name: i.member.name.trim(),
    color: (i.member.color ?? '').trim() || DEFAULT_MEMBER_COLOR,
    lang: i.member.lang === 'en' ? 'en' : 'nl',
    ...(deviceId ? { deviceId } : {}),
    rv: intAtLeast(i.state.rulesVersion, 1, 1),
    level,
    xp: intAtLeast(i.state.total, 0, 0),
    streak: intAtLeast(i.state.streak.current, 0, 0),
    badges,
    cookDays,
    ...(avatar ? { avatar } : {}),
  };
}

/**
 * The stored `progress.snapshots` value (any shape) → card id → snapshot. Every entry goes through
 * `readProgressPayload` (the same tolerance as a received token); an entry without a usable card or
 * without a parseable `receivedAt` is dropped; `friend` is true only when it says `true`. The key is
 * always the card's id (the first entry per id wins). Unknown keys on a card stay.
 */
export function normalizeSnapshots(v: unknown): Record<string, ProgressSnapshot> {
  const out: Record<string, ProgressSnapshot> = {};
  if (!isRecord(v)) return out;
  for (const value of Object.values(v)) {
    if (!isRecord(value)) continue;
    const card = readProgressPayload(value);
    if (!card || card.id === '__proto__' || Object.prototype.hasOwnProperty.call(out, card.id)) continue;
    const receivedAt = typeof value['receivedAt'] === 'string' ? value['receivedAt'].trim() : '';
    if (!receivedAt || !Number.isFinite(Date.parse(receivedAt))) continue;
    out[card.id] = { ...card, receivedAt, friend: value['friend'] === true };
  }
  return out;
}

/** One day of the cooking calendar: `day` = day of the month (1…31), the cooks of that day. */
export interface CalendarDay {
  day: number;
  /** One entry per cook; `recipeId` null for a day a snapshot names without a recipe. */
  cooks: Array<{ memberId: string; recipeId: string | null }>;
}

/**
 * One month of the cooking calendar (§1j); `month` is 1…12 (January = 1), the days are local
 * calendar days. The result has one CalendarDay per day of that month (1…28/29/30/31), cooks of other
 * months are left out. Local cooks (the cook log, `at` read as a local day) come first in the input;
 * each snapshot adds its cook days, one cook per recipe id of the day (`recipeId: null` for a day
 * without one). The same person locally and in a snapshot → local wins: a snapshot of a member in
 * `localMemberIds` is skipped, and a member who has a local cook on a day gets no snapshot cooks on
 * that day. The cooks of a day are ordered by member, in the order the members first appear in the
 * input (local first, then the snapshots), and per member in input order.
 */
export function calendarMonth(i: {
  year: number;
  month: number;
  local: Array<{ memberId: string; recipeId: string; at: string }>;
  snapshots: readonly ProgressSnapshot[];
  localMemberIds: ReadonlySet<string>;
}): CalendarDay[] {
  if (!Number.isInteger(i.year) || !Number.isInteger(i.month) || i.month < 1 || i.month > 12) return [];
  const first = Math.floor(Date.UTC(i.year, i.month - 1, 1) / DAY_MS);
  const length = new Date(Date.UTC(i.year, i.month, 0)).getUTCDate();
  const buckets: Array<Array<{ memberId: string; recipeId: string | null; rank: number }>> = Array.from({ length }, () => []);
  const rankOf = new Map<string, number>();
  const rank = (memberId: string): number => {
    let r = rankOf.get(memberId);
    if (r === undefined) {
      r = rankOf.size;
      rankOf.set(memberId, r);
    }
    return r;
  };
  const inMonth = (day: number | null): day is number => day !== null && day >= first && day < first + length;

  const localOnDay = new Set<string>();
  for (const c of i.local) {
    if (!c || typeof c.memberId !== 'string' || c.memberId === '' || typeof c.at !== 'string') continue;
    const r = rank(c.memberId);
    const day = dayIndexOfIso(c.at);
    if (!inMonth(day)) continue;
    localOnDay.add(day + '|' + c.memberId);
    buckets[day - first]!.push({ memberId: c.memberId, recipeId: typeof c.recipeId === 'string' && c.recipeId ? c.recipeId : null, rank: r });
  }

  const seenSnapshots = new Set<string>();
  for (const s of i.snapshots) {
    if (!s || typeof s.id !== 'string' || s.id === '' || seenSnapshots.has(s.id)) continue;
    seenSnapshots.add(s.id);
    if (i.localMemberIds.has(s.id)) continue;
    const r = rank(s.id);
    for (const cd of Array.isArray(s.cookDays) ? s.cookDays : []) {
      if (!cd || typeof cd.d !== 'string') continue;
      const day = dayFromKey(cd.d);
      if (!inMonth(day) || localOnDay.has(day + '|' + s.id)) continue;
      const ids = Array.isArray(cd.r) ? cd.r.filter((x): x is string => typeof x === 'string' && x !== '') : [];
      const bucket = buckets[day - first]!;
      if (ids.length === 0) bucket.push({ memberId: s.id, recipeId: null, rank: r });
      else for (const recipeId of ids) bucket.push({ memberId: s.id, recipeId, rank: r });
    }
  }

  return buckets.map((cooks, k) => ({
    day: k + 1,
    // Array.prototype.sort is stable: per member the input order stays.
    cooks: cooks.sort((a, b) => a.rank - b.rank).map(({ memberId, recipeId }) => ({ memberId, recipeId })),
  }));
}
