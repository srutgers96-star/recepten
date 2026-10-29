// The shopping trail `shop.bought` (docs/specs/badges-avatar.md block 6D-2c, "Boodschappenspoor"):
// the pure core in src/domain/shopbought.ts. `normalizeShopBought` is tolerant (garbage is left
// out, never an exception); `recordBought` puts every source recipe in `recipes` (the first moment
// wins) and counts a resolved ingredient household-wide and per member. repo.setListItem calls it
// only on the transition not-ticked → ticked; no database is opened here.
import { describe, expect, it } from 'vitest';
import type { ListItem } from '../src/domain/aggregate';
import { emptyShopBought, normalizeShopBought, recordBought, type ShopBought } from '../src/domain/shopbought';

const ANNA = 'p:aaaaaaaa';
const BRAM = 'p:bbbbbbbb';
const T1 = '2026-10-29T10:00:00.000Z';
const T2 = '2026-10-30T11:00:00.000Z';

const source = (recipeId: string) => ({ recipeId, name: { nl: recipeId }, raw: '2 uien', scaled: '2 uien' });

/** A resolved list item (onion) from two recipes. */
const onion: ListItem = { key: 'ui||stuk', ing: 'ui', qty: 2, unit: null, aisle: 'groente', section: 'main', sources: [source('u:curry'), source('b:stamppot')] };
/** An unresolved line: no ingredient id, one source. */
const raw: ListItem = { key: 'raw|u:curry|3', ing: null, aisle: 'overig', section: 'main', sources: [source('u:curry')], label: { nl: 'snufje liefde' } };
/** A manual extra without a dictionary id and without sources. */
const loo: ListItem = { key: 'x|wc', label: { nl: 'wc-papier' }, aisle: 'overig', section: 'main', sources: [], manual: true };

describe('normalizeShopBought', () => {
  it('anything that is not an object → an empty trail, never a throw', () => {
    for (const junk of [undefined, null, 'x', 3, [], [['u:a', T1]], true]) expect(normalizeShopBought(junk)).toEqual(emptyShopBought());
  });

  it('keeps valid entries and leaves out what does not fit', () => {
    const out = normalizeShopBought({
      recipes: { 'u:curry': T1, 'b:soep': '', 'u:x': 5, '': T1, 'u:y': null },
      ings: {
        ui: { n: 3, by: { [ANNA]: 2, [BRAM]: 1, '': 4, 'p:c': 0, 'p:d': 1.5, 'p:e': 'twee' } },
        prei: { n: 0, by: {} },
        knoflook: { n: 2.5 },
        peper: 'x',
        zout: { by: { [ANNA]: 1 } },
        rijst: { n: 1 },
        '': { n: 1 },
      },
      extra: 'ignored',
    });
    expect(out).toEqual({
      recipes: { 'u:curry': T1 },
      ings: { ui: { n: 3, by: { [ANNA]: 2, [BRAM]: 1 } }, rijst: { n: 1, by: {} } },
    });
  });

  it('a wrong shape of recipes or ings empties only that part', () => {
    expect(normalizeShopBought({ recipes: ['u:a'], ings: { ui: { n: 1, by: {} } } })).toEqual({ recipes: {}, ings: { ui: { n: 1, by: {} } } });
    expect(normalizeShopBought({ recipes: { 'u:a': T1 }, ings: 'ui' })).toEqual({ recipes: { 'u:a': T1 }, ings: {} });
  });
});

describe('recordBought', () => {
  it('every source recipe goes into recipes; the first moment wins', () => {
    const once = recordBought(emptyShopBought(), onion, ANNA, T1);
    expect(once.recipes).toEqual({ 'u:curry': T1, 'b:stamppot': T1 });
    const twice = recordBought(once, raw, BRAM, T2);
    expect(twice.recipes).toEqual({ 'u:curry': T1, 'b:stamppot': T1 });
    const third = recordBought(twice, { ing: 'rijst', sources: [{ recipeId: 'u:nasi' }] }, ANNA, T2);
    expect(third.recipes).toEqual({ 'u:curry': T1, 'b:stamppot': T1, 'u:nasi': T2 });
  });

  it('a resolved ingredient counts n + 1 and by[member] + 1, per member', () => {
    let s: ShopBought = emptyShopBought();
    s = recordBought(s, onion, ANNA, T1);
    expect(s.ings).toEqual({ ui: { n: 1, by: { [ANNA]: 1 } } });
    s = recordBought(s, onion, ANNA, T2);
    s = recordBought(s, onion, BRAM, T2);
    expect(s.ings).toEqual({ ui: { n: 3, by: { [ANNA]: 2, [BRAM]: 1 } } });
  });

  it('without a member only n counts', () => {
    const s = recordBought(recordBought(emptyShopBought(), onion, null, T1), onion, undefined, T2);
    expect(s.ings).toEqual({ ui: { n: 2, by: {} } });
  });

  it('an unresolved line and a manual extra without an id leave the ingredients alone', () => {
    const s = recordBought(recordBought(emptyShopBought(), raw, ANNA, T1), loo, ANNA, T1);
    expect(s).toEqual({ recipes: { 'u:curry': T1 }, ings: {} });
  });

  it('returns a new trail and leaves its input untouched', () => {
    const before = normalizeShopBought({ recipes: { 'u:curry': T1 }, ings: { ui: { n: 1, by: { [ANNA]: 1 } } } });
    const copy = JSON.parse(JSON.stringify(before)) as ShopBought;
    const after = recordBought(before, onion, BRAM, T2);
    expect(before).toEqual(copy);
    expect(after).not.toBe(before);
    expect(after.ings['ui']).toEqual({ n: 2, by: { [ANNA]: 1, [BRAM]: 1 } });
  });
});
