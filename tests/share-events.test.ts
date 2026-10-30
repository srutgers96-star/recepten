// Phase 6 (docs/phase-6-spec.md 13A-2): the pure helpers behind "In & uit" and the sort row of
// the recipe list. (1) src/recent.ts: the recently-viewed list (`pushRecent`) and the order of the
// four sort modes (`orderRecipes`, `keepOrder`); (2) src/db/repo.ts: the identity and dedupe of
// `events` rows across backups (`shareEventKey`, `dedupeShareEvents`) and the backup-file decoder
// (`decodeShareEvent`), which must never let a malformed row into the database. No database is
// opened here: repo.ts is imported for its pure exports only, like tests/photos.test.ts does.
import { describe, expect, it } from 'vitest';
import type { ShareEvent } from '../src/db/model';
import { decodeShareEvent, dedupeShareEvents, shareEventKey } from '../src/db/repo';
import type { Recipe } from '../src/domain/model';
import { isListSort, keepOrder, LIST_SORTS, orderRecipes, pushRecent, RECENT_MAX } from '../src/recent';

/** Only id, origin.kind and updatedAt matter to the sort helpers; the rest of a Recipe is not read. */
function recipe(id: string, kind: Recipe['origin']['kind'], updatedAt: string): Recipe {
  return { id, origin: { kind }, updatedAt } as unknown as Recipe;
}

const CLASSIC = recipe('b:soep', 'builtin', '2026-01-01T00:00:00.000Z');
const OWN_OLD = recipe('u:aaa', 'user', '2026-09-01T10:00:00.000Z');
const OWN_NEW = recipe('u:bbb', 'user', '2026-10-01T10:00:00.000Z');
const RECEIVED = recipe('u:ccc', 'received', '2026-09-15T10:00:00.000Z');
const OWN_TIE = recipe('u:abb', 'user', '2026-10-01T10:00:00.000Z');
const LIST = [CLASSIC, OWN_OLD, OWN_NEW, RECEIVED, OWN_TIE];

describe('recent.ts — recently viewed', () => {
  it('pushRecent moves the id to the front and keeps the rest in order', () => {
    expect(pushRecent([], 'a')).toEqual(['a']);
    expect(pushRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
    expect(pushRecent(['a', 'b'], 'z')).toEqual(['z', 'a', 'b']);
  });

  it('pushRecent drops duplicates and junk, and trims to the maximum', () => {
    expect(pushRecent(['a', 'a', '', 'b'] as string[], 'a')).toEqual(['a', 'b']);
    const many = Array.from({ length: RECENT_MAX + 10 }, (_, i) => 'r' + i);
    const out = pushRecent(many, 'new');
    expect(out).toHaveLength(RECENT_MAX);
    expect(out[0]).toBe('new');
    expect(out[RECENT_MAX - 1]).toBe('r' + (RECENT_MAX - 2));
    // A custom maximum is honoured too (the id itself always fits).
    expect(pushRecent(['a', 'b', 'c'], 'z', 2)).toEqual(['z', 'a']);
    expect(pushRecent(['a'], 'z', 1)).toEqual(['z']);
  });
});

describe('recent.ts — sort modes of the recipe list', () => {
  it('exposes exactly the four modes and recognises them', () => {
    expect(LIST_SORTS).toEqual(['az', 'recent', 'own', 'ownReceived']);
    expect(isListSort('recent')).toBe(true);
    expect(isListSort('AZ')).toBe(false);
    expect(isListSort(null)).toBe(false);
    expect(isListSort(3)).toBe(false);
  });

  it("'recent' follows the viewed order and skips ids that are not in the list", () => {
    const out = orderRecipes(LIST, 'recent', ['u:ccc', 'u:gone', 'b:soep', 'u:ccc', 'u:aaa']);
    expect(out.map((r) => r.id)).toEqual(['u:ccc', 'b:soep', 'u:aaa']);
    expect(orderRecipes(LIST, 'recent', [])).toEqual([]);
    expect(orderRecipes(LIST, 'recent')).toEqual([]);
  });

  it("'own' = origin user only, newest change first, ties broken by id", () => {
    expect(orderRecipes(LIST, 'own').map((r) => r.id)).toEqual(['u:abb', 'u:bbb', 'u:aaa']);
  });

  it("'ownReceived' = user + received, newest change first; classics never", () => {
    expect(orderRecipes(LIST, 'ownReceived').map((r) => r.id)).toEqual(['u:abb', 'u:bbb', 'u:ccc', 'u:aaa']);
  });

  it("'az' hands the list back unchanged (the screen groups it) as a copy", () => {
    const out = orderRecipes(LIST, 'az');
    expect(out).toEqual(LIST);
    expect(out).not.toBe(LIST);
  });

  it('orderRecipes never mutates its input', () => {
    const copy = [...LIST];
    orderRecipes(LIST, 'own');
    orderRecipes(LIST, 'ownReceived');
    expect(LIST).toEqual(copy);
  });

  it('keepOrder returns the subset in the order of the ordered list', () => {
    const ordered = orderRecipes(LIST, 'ownReceived');
    expect(keepOrder(ordered, [OWN_OLD, RECEIVED, CLASSIC]).map((r) => r.id)).toEqual(['u:ccc', 'u:aaa']);
    expect(keepOrder(ordered, [])).toEqual([]);
  });
});

// --- The events log: identity, dedupe, decode ------------------------------------------------------

const AT = '2026-10-13T18:30:00.000Z';
const OUT_TO_GABI: ShareEvent = { id: 7, at: AT, direction: 'out', kind: 'recipes', who: 'Gabi', count: 2, recipeIds: ['u:aaa', 'u:bbb'] };
const IN_FROM_GABI: ShareEvent = { id: 8, at: AT, direction: 'in', kind: 'recipes', who: 'Gabi', count: 1, recipeIds: ['u:ccc'] };

describe('share events — identity across backups', () => {
  it('shareEventKey = moment + direction + partner (trimmed; null and empty are the same)', () => {
    expect(shareEventKey(OUT_TO_GABI)).toBe(`${AT}|out|Gabi`);
    expect(shareEventKey({ at: AT, direction: 'out', who: '  Gabi ' })).toBe(shareEventKey(OUT_TO_GABI));
    expect(shareEventKey({ at: AT, direction: 'out', who: null })).toBe(shareEventKey({ at: AT, direction: 'out', who: '' }));
    // The same moment in the other direction is another event (a round trip at one second).
    expect(shareEventKey(IN_FROM_GABI)).not.toBe(shareEventKey(OUT_TO_GABI));
  });

  it('dedupeShareEvents skips rows already here, keeps a repeated incoming key once, strips ids', () => {
    const incoming: ShareEvent[] = [
      OUT_TO_GABI, // already here
      IN_FROM_GABI, // new
      { ...IN_FROM_GABI, id: 99, count: 5 }, // same key again in the file: kept once (the first wins)
      { id: 3, at: '2026-10-14T08:00:00.000Z', direction: 'out', kind: 'member', who: null, count: 1, recipeIds: [] },
    ];
    const fresh = dedupeShareEvents([{ at: AT, direction: 'out', who: 'Gabi' }], incoming);
    expect(fresh).toHaveLength(2);
    expect(fresh[0]).toEqual({ at: AT, direction: 'in', kind: 'recipes', who: 'Gabi', count: 1, recipeIds: ['u:ccc'] });
    expect(fresh[1]).toEqual({ at: '2026-10-14T08:00:00.000Z', direction: 'out', kind: 'member', who: null, count: 1, recipeIds: [] });
    for (const row of fresh) expect(row).not.toHaveProperty('id');
  });

  it('dedupeShareEvents with nothing here returns every distinct row in file order', () => {
    const fresh = dedupeShareEvents([], [IN_FROM_GABI, OUT_TO_GABI]);
    expect(fresh.map((e) => e.direction)).toEqual(['in', 'out']);
  });
});

describe('share events — decoding a backup row', () => {
  it('accepts a well-formed row and normalises it (trimmed who, deduped ids, note dropped when empty)', () => {
    const row = decodeShareEvent({ id: 12, at: AT, direction: 'out', kind: 'bundle', who: ' Gabi ', count: 3, recipeIds: ['u:a', 'u:a', 'u:b', 7, ''], note: '  ' });
    expect(row).toEqual({ at: AT, direction: 'out', kind: 'bundle', who: 'Gabi', count: 3, recipeIds: ['u:a', 'u:b'] });
    expect(row).not.toHaveProperty('id');
    expect(row).not.toHaveProperty('note');
  });

  it('falls back to the number of ids (at least 1) when count is missing or nonsense', () => {
    expect(decodeShareEvent({ at: AT, direction: 'in', kind: 'recipes', who: null, recipeIds: ['u:a', 'u:b'] })?.count).toBe(2);
    expect(decodeShareEvent({ at: AT, direction: 'out', kind: 'member', who: null, count: -4, recipeIds: [] })?.count).toBe(1);
    expect(decodeShareEvent({ at: AT, direction: 'out', kind: 'recipes', who: 'X', count: 2.9, recipeIds: ['u:a'] })?.count).toBe(2);
  });

  it("accepts the kind 'progress' (6D-4b: a \"Sync mijn voortgang\" sent or saved)", () => {
    expect(decodeShareEvent({ at: AT, direction: 'out', kind: 'progress', who: null, count: 1, recipeIds: [] })).toEqual({ at: AT, direction: 'out', kind: 'progress', who: null, count: 1, recipeIds: [] });
    expect(decodeShareEvent({ at: AT, direction: 'in', kind: 'progress', who: 'Gabi', count: 1, recipeIds: [] })?.kind).toBe('progress');
  });

  it('keeps a real note and a null who', () => {
    const row = decodeShareEvent({ at: AT, direction: 'out', kind: 'member', who: null, count: 1, recipeIds: [], note: 'Stijn' });
    expect(row?.who).toBeNull();
    expect(row?.note).toBe('Stijn');
  });

  it('returns null for anything malformed, so a restore never writes garbage', () => {
    expect(decodeShareEvent(null)).toBeNull();
    expect(decodeShareEvent('x')).toBeNull();
    expect(decodeShareEvent({})).toBeNull();
    expect(decodeShareEvent({ at: 'not a date', direction: 'in', kind: 'recipes', who: null, count: 1, recipeIds: [] })).toBeNull();
    expect(decodeShareEvent({ at: AT, direction: 'sideways', kind: 'recipes', who: null, count: 1, recipeIds: [] })).toBeNull();
    expect(decodeShareEvent({ at: AT, direction: 'in', kind: 'photos', who: null, count: 1, recipeIds: [] })).toBeNull();
    expect(decodeShareEvent({ at: AT, direction: 'in', kind: 'recipes', who: 42, count: 1, recipeIds: [] })).toBeNull();
  });

  it('round-trips through dedupe: a decoded row and its stored twin share one key', () => {
    const decoded = decodeShareEvent(OUT_TO_GABI);
    expect(decoded).not.toBeNull();
    expect(dedupeShareEvents([OUT_TO_GABI], [decoded as ShareEvent])).toEqual([]);
  });
});
