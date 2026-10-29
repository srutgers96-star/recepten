// Local calendar-day helpers for the XP derivation (docs/specs/xp-levels.md §2c) and the badges
// (badges.ts imports them since 6D-2a; no private copies left). Framework-free.
//
// A "day index" is the LOCAL calendar day encoded as days since 1970-01-01. Log timestamps are UTC
// ISO strings, but a cook at 00:30 local Monday belongs to Monday.

const DAY_MS = 86_400_000;

/** Local calendar day of `d` as days since 1970-01-01 (1970-01-01 = day 0). */
export function localDayIndex(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** Local day index of an ISO timestamp; null when the string does not parse. */
export function dayIndexOfIso(iso: string): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return localDayIndex(new Date(t));
}

/** Day index of the Monday of the ISO week (Mon–Sun) containing `day`. 1970-01-01 was a Thursday. */
export function isoWeekMondayOf(day: number): number {
  const dow = (((day + 3) % 7) + 7) % 7; // Mon = 0 … Sun = 6
  return day - dow;
}

/** 'yyyy-mm-dd' of a day index (the index already encodes the local calendar day). */
export function dayKey(day: number): string {
  const d = new Date(day * DAY_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  return `${String(y).padStart(4, '0')}-${m < 10 ? '0' : ''}${m}-${dd < 10 ? '0' : ''}${dd}`;
}

/** Inverse of dayKey; null for anything that is not a real 'yyyy-mm-dd' date. */
export function dayFromKey(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return Math.floor(ms / DAY_MS);
}
