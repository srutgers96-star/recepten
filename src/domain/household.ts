// One household (docs/phase-5-spec.md, 30-09 additions + block A.8). Framework-free: no preact,
// no dexie. The setting `household` holds `{ name, members }`; the profiles on this phone are
// members automatically (`local: true`, id = profile id), other people are typed by hand here or
// arrive as a member card (`#f=`, block F) and are stored in the setting with `local: false`.
// Cook-log entries keep `profileId`, which IS the member id of a local member. Received recipes
// map their `by` name to a member with `memberByName` (case-insensitive) when possible.
import type { Lang, Profile } from './model.ts';
import { randomId } from './model.ts';

export interface Member {
  /** A profile id ('p:…') for a local member, else 'm:…' (typed by hand) or the id from a member card. */
  id: string;
  name: string;
  /** CSS colour (the profile swatches). */
  color: string;
  lang?: Lang;
  /** True for a profile on this phone (edited via Profiles, never via the household setting). */
  local: boolean;
  /** Set by a member card that came from another phone (block F). */
  deviceId?: string;
}

export interface HouseholdSetting {
  name: string;
  /** The members that are NOT profiles on this phone (local ones are derived from the profiles). */
  members: Member[];
}

export const HOUSEHOLD_KEY = 'household';
/**
 * The default household name per language ("Thuis" / "Home"). It is never stored: an empty
 * `name` in the setting means "the default", and the UI renders it in the active language
 * (i18n `household.defaultName`, or `householdName` below) so the English edition never sees
 * a Dutch name.
 */
export const DEFAULT_HOUSEHOLD_NAME: Readonly<Record<Lang, string>> = { nl: 'Thuis', en: 'Home' };
export const DEFAULT_MEMBER_COLOR = '#2b4fa8';

/** The household name to show: the stored one, else the default in `lang`. */
export function householdName(h: Pick<HouseholdSetting, 'name'> | null | undefined, lang: Lang): string {
  const name = h?.name?.trim() ?? '';
  return name || DEFAULT_HOUSEHOLD_NAME[lang];
}

/** Id of a hand-added member: 'm:' + 8 chars [a-z0-9]. */
export function newMemberId(): string {
  return randomId('m:');
}

function isLang(v: unknown): v is Lang {
  return v === 'nl' || v === 'en';
}

/** One stored member, or null when the value is not usable. Local members are never stored. */
function normalizeMember(v: unknown): Member | null {
  const o = v as Partial<Member> | null;
  if (!o || typeof o !== 'object') return null;
  if (typeof o.id !== 'string' || !o.id.trim() || typeof o.name !== 'string' || !o.name.trim()) return null;
  if (o.local === true) return null;
  const m: Member = { id: o.id, name: o.name.trim(), color: typeof o.color === 'string' && o.color.trim() ? o.color : DEFAULT_MEMBER_COLOR, local: false };
  if (isLang(o.lang)) m.lang = o.lang;
  if (typeof o.deviceId === 'string' && o.deviceId.trim()) m.deviceId = o.deviceId;
  return m;
}

/** The setting as stored (any shape) → a valid HouseholdSetting (an empty name = the default, see `householdName`). */
export function normalizeHousehold(v: unknown): HouseholdSetting {
  const o = (v && typeof v === 'object' ? v : {}) as { name?: unknown; members?: unknown };
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const seen = new Set<string>();
  const members: Member[] = [];
  for (const raw of Array.isArray(o.members) ? o.members : []) {
    const m = normalizeMember(raw);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    members.push(m);
  }
  return { name, members };
}

/** A profile on this phone as a member (id = profile id). */
export function memberFromProfile(p: Profile): Member {
  return { id: p.id, name: p.name, color: p.color, lang: p.lang, local: true };
}

/**
 * Every member of the household: the local profiles first (in their order), then the stored
 * members whose id is not a profile here. A stored member with the same NAME as a local profile
 * is left out too: that is the same person, seen from this phone (their card arrived before the
 * profile was made, or vice versa).
 */
export function membersFrom(profiles: readonly Profile[], setting: HouseholdSetting | unknown): Member[] {
  const h = isHouseholdSetting(setting) ? setting : normalizeHousehold(setting);
  const out: Member[] = profiles.map(memberFromProfile);
  const ids = new Set(out.map((m) => m.id));
  const names = new Set(out.map((m) => foldName(m.name)));
  for (const m of h.members) {
    if (ids.has(m.id) || names.has(foldName(m.name))) continue;
    ids.add(m.id);
    names.add(foldName(m.name));
    out.push(m);
  }
  return out;
}

function isHouseholdSetting(v: unknown): v is HouseholdSetting {
  const o = v as HouseholdSetting | null;
  return !!o && typeof o === 'object' && typeof o.name === 'string' && Array.isArray(o.members) && o.members.every((m) => m && typeof m.id === 'string' && typeof m.local === 'boolean');
}

function foldName(s: string): string {
  return s.trim().normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The member with that name (trimmed, case- and accent-insensitive), local members first. */
export function memberByName(members: readonly Member[], name: string | null | undefined): Member | undefined {
  const wanted = foldName(name ?? '');
  if (!wanted) return undefined;
  return members.find((m) => m.local && foldName(m.name) === wanted) ?? members.find((m) => foldName(m.name) === wanted);
}

export function memberById(members: readonly Member[], id: string | null | undefined): Member | undefined {
  return id ? members.find((m) => m.id === id) : undefined;
}

/** Adds or replaces a hand-added member in the setting (by id); the name is trimmed. */
export function putMember(h: HouseholdSetting, m: Member): HouseholdSetting {
  const member: Member = { ...m, name: m.name.trim(), local: false };
  const members = h.members.some((x) => x.id === member.id) ? h.members.map((x) => (x.id === member.id ? member : x)) : [...h.members, member];
  return { ...h, members };
}

export function removeMember(h: HouseholdSetting, id: string): HouseholdSetting {
  return { ...h, members: h.members.filter((m) => m.id !== id) };
}
