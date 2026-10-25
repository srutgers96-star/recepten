// "Leeg de lijst" on the shopping screen (25 Oct 2026): the pure core of `clearShoppingList`
// (src/db/repo.ts). The emptied list has no items, no extras and no trace of the plan it was made
// for, so the screen offers "Maak de lijst" again; the original stays untouched for "Ongedaan".
// No database is opened here: repo.ts is imported for its pure exports only, like
// tests/plan-cooked.test.ts does.
import { describe, expect, it } from 'vitest';
import { emptiedList } from '../src/db/repo';
import type { List } from '../src/db/model';
import type { ListItem } from '../src/domain/aggregate';

const milk: ListItem = { key: 'x|melk', label: { nl: 'melk', en: 'milk' }, aisle: 'zuivel', section: 'main', sources: [], manual: true, checked: true };
const loo: ListItem = { key: 'x|wc', label: { nl: 'wc-papier', en: 'loo roll' }, aisle: 'overig', section: 'main', sources: [], manual: true, pinned: true };
const onion: ListItem = { key: 'ui||stuk', ing: 'ui', qty: 2, unit: null, aisle: 'groente', section: 'main', sources: [] };

const before: List = {
  id: 'current',
  items: [onion, milk, loo],
  generatedFrom: 'b:stamppot@4',
  generatedFromAll: 'b:stamppot@4',
  generatedAt: '2026-10-20T10:00:00.000Z',
  extras: [milk, loo],
  pinned: ['x|wc'],
  updatedAt: '2026-10-24T18:00:00.000Z',
  sharedAt: '2026-10-24T17:00:00.000Z',
};

describe('emptiedList ("Leeg de lijst")', () => {
  const now = '2026-10-25T09:00:00.000Z';
  const out = emptiedList(before, now);

  it('empties items, extras and pins', () => {
    expect(out.items).toEqual([]);
    expect(out.extras).toEqual([]);
    expect(out.pinned).toEqual([]);
  });

  it('forgets the plan it was made for, like a list that was never generated', () => {
    expect(out.generatedFrom).toBe('');
    expect('generatedFromAll' in out).toBe(false);
    expect(out.sharedAt).toBeNull();
    expect(out.id).toBe('current');
    expect(out.generatedAt).toBe(now);
    expect(out.updatedAt).toBe(now);
  });

  it('leaves the original untouched (that is what "Ongedaan" puts back)', () => {
    expect(before.items).toHaveLength(3);
    expect(before.extras).toHaveLength(2);
    expect(before.generatedFrom).toBe('b:stamppot@4');
    expect(before.generatedFromAll).toBe('b:stamppot@4');
    expect(before.sharedAt).toBe('2026-10-24T17:00:00.000Z');
  });

  it('keeps fields it does not know (forward compatible rows)', () => {
    const row = { ...before, futureField: 7 } as List & { futureField: number };
    expect((emptiedList(row, now) as List & { futureField?: number }).futureField).toBe(7);
  });
});
