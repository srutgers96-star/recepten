// "Sync mijn voortgang" and the cooking calendar (docs/specs/xp-levels.md §1h–§1j, §2h, §6a; block
// 6D-4, src/domain/progress.ts): the card the sender builds (last 90 days, unique ids per day, at
// most 5, nothing but aggregates), the stored snapshots (tolerant), and one month of the calendar
// (local wins over a snapshot of the same person, a snapshot day without a recipe, other months
// left out, the order of the cooks). Days are LOCAL calendar days: every timestamp is built from a
// local wall-clock time, so the tests hold in any time zone (Stijn's PC, CI in UTC, UTC+13 …).
import { describe, expect, it } from 'vitest';
import type { AvatarSpec } from '../src/domain/avatar';
import { dayFromKey, dayKey } from '../src/domain/days';
import { calendarMonth, normalizeSnapshots, progressCardFor, type ProgressSnapshot } from '../src/domain/progress';
import { buildProgressEnvelope, parseEnvelope, type ProgressCard } from '../src/domain/share';
import { decodeToken, encodeToken } from '../src/domain/token';
import { deriveXp, XP_RULES, type XpBadgeFact, type XpCookFact, type XpState } from '../src/domain/xp';
import { FROZEN_ENVELOPE_X } from './fixtures/frozen-share-tokens';

const TODAY = dayFromKey('2026-10-22')!;
const MEMBER = { id: 'p:k3x9w2qa', name: 'Stijn', color: '#2b4fa8', lang: 'nl' as const };
const AVATAR: AvatarSpec = { v: 1, parts: ['face-round', 'eyes-happy', 'mouth-grin', 'body-apron'], tone: '#e0b08a' };

/** ISO timestamp of a LOCAL wall-clock time on 'yyyy-mm-dd'. */
function local(key: string, hour = 12, minute = 0): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, minute).toISOString();
}

/** Local 12:xx on local day index `day`. */
function noon(day: number, minute = 0): string {
  return local(dayKey(day), 12, minute);
}

function cook(recipeId: string, at: string, extra: Partial<XpCookFact> = {}): XpCookFact {
  return { recipeId, at, ...extra };
}

function state(over: Partial<XpState> = {}): XpState {
  return {
    rulesVersion: 2,
    total: 4512,
    level: 12,
    levelStart: 3200,
    nextAt: 4800,
    streak: { current: 5, best: 9, lastDay: TODAY, freeDayUsed: false },
    cookDays: [],
    events: [],
    byKey: new Map(),
    ...over,
  };
}

function card(over: Partial<Parameters<typeof progressCardFor>[0]> = {}): ProgressCard {
  return progressCardFor({ member: MEMBER, state: state(), badges: [], log: [], today: TODAY, ...over });
}

describe('progressCardFor', () => {
  it('builds exactly the frozen #x= card from matching facts', () => {
    const badges: XpBadgeFact[] = [
      { id: 'eerste-hap', level: 1, secret: false },
      { id: 'huiskok', level: 1, secret: false },
      { id: 'proever', level: 1, secret: false },
    ];
    const log = [
      cook('b:uiensoep', local('2026-10-22', 19, 30)),
      cook('b:afwasmachinezalm', local('2026-10-20', 11), { stars: 5 }),
      cook('b:uiensoep', local('2026-10-19', 12)),
      cook('u:abc12345', local('2026-10-20', 13), { loggedAt: local('2026-10-21', 8) }),
    ];
    const out = progressCardFor({
      member: MEMBER,
      deviceId: ' d:7m4qz81c ',
      state: state({ rulesVersion: 1 }),
      badges,
      log,
      today: TODAY,
    });
    expect(out).toEqual(FROZEN_ENVELOPE_X['x']);
  });

  it('takes only the last 90 days up to today (no future days)', () => {
    const out = card({
      log: [
        cook('b:a', noon(TODAY - 90)),
        cook('b:b', noon(TODAY - 89)),
        cook('b:c', noon(TODAY)),
        cook('b:d', noon(TODAY + 1)),
        cook('b:e', 'not a date'),
      ],
    });
    expect(out.cookDays).toEqual([
      { d: dayKey(TODAY - 89), r: ['b:b'] },
      { d: dayKey(TODAY), r: ['b:c'] },
    ]);
  });

  it('one entry per day, ascending; ids unique, in cooking order, at most 5', () => {
    const d = TODAY - 3;
    const out = card({
      log: [
        cook('b:r6', noon(d, 6)),
        cook('b:r1', noon(d, 1)),
        cook('b:r3', noon(d, 3)),
        cook('b:r1', noon(d, 2)), // the same recipe again that day
        cook('b:r5', noon(d, 5)),
        cook('b:r2', noon(d, 0)),
        cook('b:r4', noon(d, 4)),
        cook('b:old', noon(d - 10)),
        cook('has space', noon(TODAY - 1)), // not an id that can travel; the day still counts
      ],
    });
    expect(out.cookDays).toEqual([
      { d: dayKey(d - 10), r: ['b:old'] },
      { d: dayKey(d), r: ['b:r2', 'b:r1', 'b:r3', 'b:r4', 'b:r5'] },
      { d: dayKey(TODAY - 1), r: [] },
    ]);
  });

  it('reads `at` as a LOCAL calendar day (a cook at 00:30 local belongs to that day)', () => {
    const out = card({ log: [cook('b:late', new Date(2026, 9, 22, 0, 30).toISOString()), cook('b:early', new Date(2026, 9, 21, 23, 45).toISOString())] });
    expect(out.cookDays).toEqual([
      { d: '2026-10-21', r: ['b:early'] },
      { d: '2026-10-22', r: ['b:late'] },
    ]);
  });

  it('has exactly the keys of §2h: no stars, no notes, no photos', () => {
    const log = [cook('b:a', noon(TODAY), { stars: 4, id: 7, loggedAt: noon(TODAY) })];
    const full = card({ deviceId: 'd:1', avatar: AVATAR, log });
    expect(Object.keys(full)).toEqual(['id', 'name', 'color', 'lang', 'deviceId', 'rv', 'level', 'xp', 'streak', 'badges', 'cookDays', 'avatar']);
    expect(full.avatar).toEqual(AVATAR);
    const bare = card({ log });
    expect(Object.keys(bare)).toEqual(['id', 'name', 'color', 'lang', 'rv', 'level', 'xp', 'streak', 'badges', 'cookDays']);
    for (const c of [full, bare]) {
      const json = JSON.stringify(c);
      for (const word of ['stars', 'note', 'photo', 'loggedAt', 'events']) expect(json).not.toContain(word);
      expect(Object.keys(c.cookDays[0]!)).toEqual(['d', 'r']);
    }
    // An empty deviceId and an unusable avatar stay home.
    expect(card({ deviceId: '  ', avatar: { v: 2 } as unknown as AvatarSpec, log })).toEqual(bare);
  });

  it('takes rv, level, xp and streak from the state; badges as `id` / `id@k`', () => {
    const out = card({
      state: state({ rulesVersion: 2, level: 37, total: 104_000, streak: { current: 0, best: 40, lastDay: null, freeDayUsed: false } }),
      badges: [
        { id: 'eerste-hap', level: 1, secret: false },
        { id: 'huiskok', level: 3, secret: false },
        { id: 'geheim', level: 1, secret: true, xp: 250 },
        { id: 'Bad Id', level: 1, secret: false },
        { id: 'huiskok', level: 3, secret: false },
        { id: 'nog-niet', level: 0, secret: false },
      ],
    });
    expect(out).toMatchObject({ rv: 2, level: 37, xp: 104_000, streak: 0, badges: ['eerste-hap', 'huiskok@3', 'geheim'] });
    expect(card({ member: { ...MEMBER, color: '', lang: undefined } })).toMatchObject({ color: '#2b4fa8', lang: 'nl' });
    expect(card({ member: { ...MEMBER, name: '  Gabi ', lang: 'en' } })).toMatchObject({ name: 'Gabi', lang: 'en' });
  });

  it('works on a real deriveXp state and survives the codec unchanged', async () => {
    const log = [cook('b:a', noon(TODAY - 2)), cook('b:b', noon(TODAY - 1)), cook('b:c', noon(TODAY))];
    const xp = deriveXp({ log, recipes: new Map(), photos: [], ownRecipes: [], badges: [] }, XP_RULES, TODAY);
    const out = progressCardFor({ member: MEMBER, state: xp, badges: [], log, today: TODAY, avatar: AVATAR });
    expect(out).toMatchObject({ rv: XP_RULES.version, level: xp.level, xp: xp.total, streak: xp.streak.current });
    expect(out.streak).toBe(3);
    const parsed = parseEnvelope(await decodeToken(await encodeToken(buildProgressEnvelope(out))));
    expect(parsed.kind).toBe('progress');
    expect(parsed.progress).toEqual(out);
  });
});

describe('normalizeSnapshots', () => {
  const SNAP: ProgressSnapshot = { ...card({ deviceId: 'd:1' }), receivedAt: '2026-10-23T08:00:00.000Z', friend: false };

  it('turns junk into an empty record', () => {
    for (const junk of [null, undefined, 'x', 42, [], [SNAP], { a: null }, { a: 'x' }, { a: [] }, { a: { id: 'p:1' } }, { a: { name: 'A' } }]) {
      expect(normalizeSnapshots(junk)).toEqual({});
    }
    // A usable card without a (parseable) receivedAt is no snapshot.
    expect(normalizeSnapshots({ a: { ...SNAP, receivedAt: undefined } })).toEqual({});
    expect(normalizeSnapshots({ a: { ...SNAP, receivedAt: 'gisteren' } })).toEqual({});
    expect(normalizeSnapshots({ a: { ...SNAP, receivedAt: 7 } })).toEqual({});
  });

  it('keeps usable snapshots under their card id, read like a received card', () => {
    const out = normalizeSnapshots({
      wrongKey: { ...SNAP, friend: true },
      'p:other': { ...SNAP, id: 'p:other', name: 'Gabi', level: 500, badges: ['ok', 'Not OK'], friend: 'yes', mood: 'cat' },
      broken: { id: 'p:x' },
    });
    expect(Object.keys(out)).toEqual([SNAP.id, 'p:other']);
    expect(out[SNAP.id]).toEqual({ ...SNAP, friend: true });
    expect(out['p:other']).toMatchObject({ name: 'Gabi', level: 1, badges: ['ok'], friend: false, mood: 'cat', receivedAt: SNAP.receivedAt });
    // The first entry per card id wins.
    const twice = normalizeSnapshots({ a: SNAP, b: { ...SNAP, name: 'Later' } });
    expect(Object.keys(twice)).toEqual([SNAP.id]);
    expect(twice[SNAP.id]!.name).toBe('Stijn');
  });

  it('never lets a card id touch the prototype', () => {
    const out = normalizeSnapshots({ x: { ...SNAP, id: '__proto__' } });
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
});

describe('calendarMonth', () => {
  const OCT = { year: 2026, month: 10 };
  function snap(id: string, cookDays: ProgressCard['cookDays']): ProgressSnapshot {
    return { ...card({ member: { ...MEMBER, id, name: id } }), cookDays, receivedAt: '2026-10-23T08:00:00.000Z', friend: false };
  }
  const at = (d: string, minute = 0) => local(d, 12, minute);
  const day = (days: ReturnType<typeof calendarMonth>, n: number) => days.find((x) => x.day === n)!.cooks;

  it('one CalendarDay per day of the month (day = 1…31); other months are left out', () => {
    const days = calendarMonth({
      ...OCT,
      local: [
        { memberId: 'p:a', recipeId: 'b:sep', at: at('2026-09-30') },
        { memberId: 'p:a', recipeId: 'b:nov', at: at('2026-11-01') },
        { memberId: 'p:a', recipeId: 'b:okt', at: at('2026-10-31') },
        { memberId: 'p:a', recipeId: 'b:bad', at: 'never' },
      ],
      snapshots: [snap('p:far', [{ d: '2026-11-02', r: ['b:x'] }, { d: '2025-10-05', r: ['b:y'] }, { d: '2026-10-01', r: ['b:z'] }])],
      localMemberIds: new Set(['p:a']),
    });
    expect(days.map((d) => d.day)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    const all = days.flatMap((d) => d.cooks.map((c) => c.recipeId));
    expect(all.sort()).toEqual(['b:okt', 'b:z']);
    expect(day(days, 31)).toEqual([{ memberId: 'p:a', recipeId: 'b:okt' }]);
    expect(day(days, 1)).toEqual([{ memberId: 'p:far', recipeId: 'b:z' }]);
    expect(calendarMonth({ year: 2028, month: 2, local: [], snapshots: [], localMemberIds: new Set() })).toHaveLength(29);
    expect(calendarMonth({ year: 2026, month: 2, local: [], snapshots: [], localMemberIds: new Set() })).toHaveLength(28);
    expect(calendarMonth({ year: 2026, month: 13, local: [], snapshots: [], localMemberIds: new Set() })).toEqual([]);
    expect(calendarMonth({ year: 2026, month: 0, local: [], snapshots: [], localMemberIds: new Set() })).toEqual([]);
  });

  it('local and a snapshot of the same memberId → one dot: local wins', () => {
    const days = calendarMonth({
      ...OCT,
      local: [{ memberId: 'p:a', recipeId: 'b:local', at: at('2026-10-05') }],
      snapshots: [snap('p:a', [{ d: '2026-10-05', r: ['b:remote'] }, { d: '2026-10-06', r: ['b:remote2'] }])],
      localMemberIds: new Set(['p:a']),
    });
    expect(day(days, 5)).toEqual([{ memberId: 'p:a', recipeId: 'b:local' }]);
    expect(day(days, 6)).toEqual([]);
    // Also for a member that is not a profile here: on a day with a local cook, the local one counts.
    const mixed = calendarMonth({
      ...OCT,
      local: [{ memberId: 'p:b', recipeId: 'b:here', at: at('2026-10-07') }],
      snapshots: [snap('p:b', [{ d: '2026-10-07', r: ['b:there'] }, { d: '2026-10-08', r: ['b:there2'] }])],
      localMemberIds: new Set(),
    });
    expect(day(mixed, 7)).toEqual([{ memberId: 'p:b', recipeId: 'b:here' }]);
    expect(day(mixed, 8)).toEqual([{ memberId: 'p:b', recipeId: 'b:there2' }]);
  });

  it('a snapshot day without a recipe → one cook with recipeId null; with ids → one cook per id', () => {
    const days = calendarMonth({
      ...OCT,
      local: [],
      snapshots: [snap('p:gabi', [{ d: '2026-10-08', r: [] }, { d: '2026-10-09', r: ['b:a', 'u:b'] }])],
      localMemberIds: new Set(['p:a']),
    });
    expect(day(days, 8)).toEqual([{ memberId: 'p:gabi', recipeId: null }]);
    expect(day(days, 9)).toEqual([{ memberId: 'p:gabi', recipeId: 'b:a' }, { memberId: 'p:gabi', recipeId: 'u:b' }]);
  });

  it('cooks of a day are ordered by member in the order of the input (local first), per member in input order', () => {
    const days = calendarMonth({
      ...OCT,
      local: [
        { memberId: 'p:b', recipeId: 'b:1', at: at('2026-10-10', 30) },
        { memberId: 'p:a', recipeId: 'b:2', at: at('2026-10-10', 10) },
        { memberId: 'p:b', recipeId: 'b:3', at: at('2026-10-10', 0) },
        { memberId: 'p:a', recipeId: 'b:4', at: at('2026-10-11') },
      ],
      snapshots: [snap('p:c', [{ d: '2026-10-10', r: ['b:5'] }]), snap('p:c', [{ d: '2026-10-10', r: ['b:dup'] }])],
      localMemberIds: new Set(['p:a', 'p:b']),
    });
    expect(day(days, 10)).toEqual([
      { memberId: 'p:b', recipeId: 'b:1' },
      { memberId: 'p:b', recipeId: 'b:3' },
      { memberId: 'p:a', recipeId: 'b:2' },
      { memberId: 'p:c', recipeId: 'b:5' },
    ]);
    expect(day(days, 11)).toEqual([{ memberId: 'p:a', recipeId: 'b:4' }]);
  });

  it('reads local timestamps as LOCAL days (00:30 local on the 1st is in this month, on the 1st of next month not)', () => {
    const days = calendarMonth({
      ...OCT,
      local: [
        { memberId: 'p:a', recipeId: 'b:first', at: new Date(2026, 9, 1, 0, 30).toISOString() },
        { memberId: 'p:a', recipeId: 'b:last', at: new Date(2026, 9, 31, 23, 30).toISOString() },
        { memberId: 'p:a', recipeId: 'b:next', at: new Date(2026, 10, 1, 0, 30).toISOString() },
      ],
      snapshots: [],
      localMemberIds: new Set(['p:a']),
    });
    expect(day(days, 1)).toEqual([{ memberId: 'p:a', recipeId: 'b:first' }]);
    expect(day(days, 31)).toEqual([{ memberId: 'p:a', recipeId: 'b:last' }]);
    expect(days.flatMap((d) => d.cooks).map((c) => c.recipeId)).not.toContain('b:next');
  });
});
