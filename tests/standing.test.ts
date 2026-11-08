// The standing shopping list (docs/specs/vaste-lijst.md §6 "tests/standing.test.ts"): normalisation,
// default unit, stepper step, list lines, the pin migration, the backup merge, rendering and sorting.
// Uses the REAL dictionary (data/ingredients.json, data/units.json), like aggregate.test.ts.
import { describe, expect, it } from 'vitest';
import type { ListItem } from '../src/domain/aggregate';
import { defaultDictionary } from '../src/domain/data';
import {
  absorbPins,
  defaultStandingUnit,
  emptyStandingList,
  findSameStanding,
  isStandingKey,
  mergeStandingLists,
  newStandingId,
  normalizeStandingList,
  renderStandingItem,
  sortStandingItems,
  standingFromListItem,
  standingKey,
  standingStep,
  standingToListItem,
  STANDING_UNITS,
  type StandingItem,
  type StandingList,
} from '../src/domain/standing';

const dict = defaultDictionary();
const NOW = '2026-11-08T10:00:00.000Z';

function st(p: Partial<StandingItem> & { id: string }): StandingItem {
  return { ing: null, qty: null, unit: null, aisle: 'overig', enabled: true, addedAt: NOW, ...p };
}

function list(items: StandingItem[], updatedAt = NOW): StandingList {
  return { v: 1, items, updatedAt };
}

function line(p: Partial<ListItem> & { key: string }): ListItem {
  return { aisle: 'overig', section: 'main', sources: [], ...p };
}

describe('ids and keys', () => {
  it('newStandingId is s: + 8 [a-z0-9]; standingKey / isStandingKey', () => {
    const id = newStandingId();
    expect(id).toMatch(/^s:[a-z0-9]{8}$/);
    expect(standingKey('s:k3m9x2ab')).toBe('s|k3m9x2ab');
    expect(isStandingKey('s|k3m9x2ab')).toBe(true);
    expect(isStandingKey('x|abc')).toBe(false);
    expect(isStandingKey('melk||ml')).toBe(false);
  });

  it('STANDING_UNITS: ten ids in order, all in the dictionary', () => {
    expect(STANDING_UNITS).toEqual([null, 'pot', 'pak', 'fles', 'zak', 'blik', 'g', 'kg', 'ml', 'l']);
    for (const u of STANDING_UNITS) if (u) expect(dict.unit(u)).toBeDefined();
  });
});

describe('normalizeStandingList', () => {
  it('null / {} / [] -> empty, v 1', () => {
    for (const v of [null, {}, [], undefined, 'x', 3]) {
      const n = normalizeStandingList(v);
      expect(n.v).toBe(1);
      expect(n.items).toEqual([]);
    }
    expect(emptyStandingList()).toEqual({ v: 1, items: [], updatedAt: '' });
  });

  it('an item without an id drops; qty 0 -> null; enabled defaults to true; unknown fields drop; v always 1', () => {
    const n = normalizeStandingList({
      v: 7,
      updatedAt: NOW,
      extra: 'gone',
      items: [
        { ing: 'melk', qty: 2, unit: 'l', aisle: 'zuivel-eieren', enabled: true, addedAt: NOW },
        { id: 's:aaaaaaaa', ing: 'melk', qty: 0, unit: 'l', aisle: 'zuivel-eieren', addedAt: NOW, junk: 1 },
        { id: 's:bbbbbbbb', ing: 'pindakaas', qty: -1, unit: 'pot', aisle: 'brood-ontbijt', enabled: false, addedAt: NOW },
        { id: 's:cccccccc', ing: 'boter', qty: 'x', unit: 'g', aisle: 'zuivel-eieren', addedAt: NOW },
        'nonsense',
        { id: 's:aaaaaaaa', ing: 'kaas', qty: 1, unit: 'g', aisle: 'kaas', addedAt: NOW },
      ],
    });
    expect(n.v).toBe(1);
    expect(n.updatedAt).toBe(NOW);
    expect(n).not.toHaveProperty('extra');
    expect(n.items.map((s) => s.id)).toEqual(['s:aaaaaaaa', 's:bbbbbbbb', 's:cccccccc']);
    expect(n.items[0]).toEqual({ id: 's:aaaaaaaa', ing: 'melk', qty: null, unit: 'l', aisle: 'zuivel-eieren', enabled: true, addedAt: NOW });
    expect(n.items[1]?.qty).toBeNull();
    expect(n.items[1]?.enabled).toBe(false);
    expect(n.items[2]?.qty).toBeNull();
  });

  it('keeps a unit outside STANDING_UNITS (decision C); a non-string unit -> null', () => {
    const n = normalizeStandingList({
      items: [
        { id: 's:aaaaaaaa', ing: 'mayonaise', qty: 3, unit: 'el', aisle: 'sauzen-olie-azijn' },
        { id: 's:bbbbbbbb', ing: 'mayonaise', qty: 3, unit: 7, aisle: 'sauzen-olie-azijn' },
      ],
    });
    expect(n.items[0]?.unit).toBe('el');
    expect(n.items[1]?.unit).toBeNull();
  });

  it('free text keeps its label; no ing and no label text drops', () => {
    const n = normalizeStandingList({
      items: [
        { id: 's:aaaaaaaa', ing: null, label: { nl: 'postzegels', en: '', x: 1 }, qty: null, unit: null, aisle: 'overig' },
        { id: 's:bbbbbbbb', ing: null, label: { nl: ' ', en: '' }, aisle: 'overig' },
      ],
    });
    expect(n.items).toHaveLength(1);
    expect(n.items[0]?.label).toEqual({ nl: 'postzegels', en: '' });
  });
});

describe('defaultStandingUnit', () => {
  const unitOf = (id: string) => defaultStandingUnit(dict.get(id), dict);
  it('buyUnit, package gramsPer, defaultUnit, else pieces', () => {
    expect(unitOf('pindakaas')).toBe('pot');
    expect(unitOf('boter')).toBe('pak');
    expect(unitOf('melk')).toBe('l');
    expect(unitOf('ei')).toBeNull();
    expect(unitOf('kaas')).toBe('g');
    expect(unitOf('mayonaise')).toBeNull();
    expect(unitOf('wc-papier')).toBeNull();
    expect(defaultStandingUnit(undefined, dict)).toBeNull();
  });
});

describe('standingStep', () => {
  it('l 1 · kg 0,5 · g 50 · ml 100 · anything else 1', () => {
    expect(standingStep('l')).toBe(1);
    expect(standingStep('kg')).toBe(0.5);
    expect(standingStep('g')).toBe(50);
    expect(standingStep('ml')).toBe(100);
    expect(standingStep('pot')).toBe(1);
    expect(standingStep(null)).toBe(1);
    expect(standingStep('el')).toBe(1);
  });
});

describe('standingToListItem', () => {
  it("key s|…, section main, standing true, sources [], aisle 'overig' for ''", () => {
    const it = standingToListItem(st({ id: 's:k3m9x2ab', ing: 'melk', qty: 3, unit: 'l', aisle: '' }));
    expect(it.key).toBe('s|k3m9x2ab');
    expect(it.section).toBe('main');
    expect(it.standing).toBe(true);
    expect(it.sources).toEqual([]);
    expect(it.aisle).toBe('overig');
    expect(it.ing).toBe('melk');
    expect(it.qty).toBe(3);
    expect(it.unit).toBe('l');
  });
});

describe('standingFromListItem', () => {
  it('recipe line "4 uien" with adjusted +2 -> qty 6, unit null', () => {
    const s = standingFromListItem(line({ key: 'ui||stuk', ing: 'ui', qty: 4, unit: null, adjusted: 2, aisle: 'groente-fruit' }), NOW);
    expect(s).not.toBeNull();
    expect(s?.id).toMatch(/^s:[a-z0-9]{8}$/);
    expect(s?.ing).toBe('ui');
    expect(s?.qty).toBe(6);
    expect(s?.unit).toBeNull();
    expect(s?.aisle).toBe('groente-fruit');
    expect(s?.enabled).toBe(true);
    expect(s?.addedAt).toBe(NOW);
    expect(s?.label).toBeUndefined();
  });

  it('extra without a dictionary id keeps its label', () => {
    const s = standingFromListItem(line({ key: 'x|abcdefgh', ing: null, manual: true, label: { nl: 'postzegels', en: '' }, qty: null }), NOW);
    expect(s?.ing).toBeNull();
    expect(s?.label).toEqual({ nl: 'postzegels', en: '' });
    expect(s?.qty).toBeNull();
  });

  it('extra "wc-papier" keeps ing, no label', () => {
    const s = standingFromListItem(
      line({ key: 'x|wcwcwcwc', ing: 'wc-papier', manual: true, label: { nl: 'wc-papier' }, qty: 1, unit: 'pak', aisle: 'huishoudelijk' }),
      NOW,
    );
    expect(s?.ing).toBe('wc-papier');
    expect(s?.label).toBeUndefined();
    expect(s?.qty).toBe(1);
    expect(s?.unit).toBe('pak');
  });

  it('staple line at 0 -> qty null', () => {
    const s = standingFromListItem(line({ key: 'boter||g', ing: 'boter', qty: 0, unit: 'pak', section: 'staples', baseQty: 85, baseUnit: 'g' }), NOW);
    expect(s?.qty).toBeNull();
  });

  it("'check' line -> null", () => {
    expect(standingFromListItem(line({ key: 'raw|r1|0', section: 'check', label: { nl: 'iets vaags' } }), NOW)).toBeNull();
  });

  it("variant 'rode' drops", () => {
    const s = standingFromListItem(line({ key: 'ui|rode|stuk', ing: 'ui', variant: 'rode', qty: 2, aisle: 'groente-fruit' }), NOW);
    expect(s?.ing).toBe('ui');
    expect(s).not.toHaveProperty('variant');
    expect(renderStandingItem(s as StandingItem, dict, 'nl')).toBe('2 uien');
  });
});

describe('findSameStanding', () => {
  const items = [
    st({ id: 's:aaaaaaaa', ing: 'melk', qty: 2, unit: 'l', aisle: 'zuivel-eieren' }),
    st({ id: 's:bbbbbbbb', ing: null, label: { nl: 'postzegels', en: '' } }),
  ];
  it('same ing', () => {
    expect(findSameStanding(items, { ing: 'melk' })?.id).toBe('s:aaaaaaaa');
    expect(findSameStanding(items, { ing: 'boter' })).toBeUndefined();
  });
  it('same normalised label, also via the other language', () => {
    expect(findSameStanding(items, { ing: null, label: { nl: 'Postzegels ' } })?.id).toBe('s:bbbbbbbb');
    expect(findSameStanding(items, { ing: null, label: { nl: '', en: 'Postzegels' } })?.id).toBe('s:bbbbbbbb');
    expect(findSameStanding(items, { ing: null, label: { en: 'stamps' } })).toBeUndefined();
  });
});

describe('absorbPins', () => {
  const pinnedExtra = line({ key: 'x|pinextra', ing: 'pindakaas', manual: true, pinned: true, qty: 1, unit: 'pot', aisle: 'brood-ontbijt', checked: true, inHouse: true, adjusted: 1 });
  const pinnedRecipe = line({ key: 'melk||ml', ing: 'melk', pinned: true, qty: 250, unit: 'ml', aisle: 'zuivel-eieren', sources: [{ recipeId: 'r1', name: { nl: 'Pap' }, raw: '250 ml melk', scaled: '250 ml melk' }] });
  const plain = line({ key: 'ui||stuk', ing: 'ui', qty: 2, aisle: 'groente-fruit' });

  it('pinned extra -> out of items and extras, an s| line with checked / inHouse / adjusted', () => {
    const r = absorbPins(emptyStandingList(), { items: [plain, pinnedExtra], extras: [pinnedExtra] }, NOW);
    expect(r.moved).toBe(1);
    expect(r.extras).toEqual([]);
    expect(r.items.some((it) => it.key === 'x|pinextra')).toBe(false);
    expect(r.standing.items).toHaveLength(1);
    const s = r.standing.items[0] as StandingItem;
    expect(s.ing).toBe('pindakaas');
    expect(s.qty).toBe(2);
    expect(s.unit).toBe('pot');
    expect(r.standing.updatedAt).toBe(NOW);
    const sLine = r.items.find((it) => isStandingKey(it.key));
    expect(sLine?.key).toBe(standingKey(s.id));
    expect(sLine?.standing).toBe(true);
    expect(sLine?.checked).toBe(true);
    expect(sLine?.inHouse).toBe(true);
    expect(sLine?.adjusted).toBe(1);
    expect(r.items[0]).toBe(plain);
  });

  it('pinned recipe line -> stays without pinned, plus an s| line', () => {
    const r = absorbPins(emptyStandingList(), { items: [pinnedRecipe], extras: [] }, NOW);
    expect(r.moved).toBe(1);
    const kept = r.items.find((it) => it.key === 'melk||ml');
    expect(kept).toBeDefined();
    expect(kept?.pinned).toBeUndefined();
    expect(kept?.sources).toHaveLength(1);
    expect(r.items.filter((it) => isStandingKey(it.key))).toHaveLength(1);
    expect(r.standing.items[0]?.qty).toBe(250);
    expect(r.standing.items[0]?.unit).toBe('ml');
  });

  it('second run moves 0', () => {
    const first = absorbPins(emptyStandingList(), { items: [plain, pinnedRecipe, pinnedExtra], extras: [pinnedExtra] }, NOW);
    expect(first.moved).toBe(2);
    const second = absorbPins(first.standing, { items: first.items, extras: first.extras }, '2026-11-09T10:00:00.000Z');
    expect(second.moved).toBe(0);
    expect(second.standing).toBe(first.standing);
    expect(second.items).toEqual(first.items);
    expect(second.extras).toEqual(first.extras);
  });

  it('without pins: identical result', () => {
    const standing = list([st({ id: 's:aaaaaaaa', ing: 'melk', qty: 2, unit: 'l', aisle: 'zuivel-eieren' })]);
    const items = [plain];
    const extras = [line({ key: 'x|e1', ing: null, manual: true, label: { nl: 'postzegels' } })];
    const r = absorbPins(standing, { items, extras }, NOW);
    expect(r.moved).toBe(0);
    expect(r.standing).toBe(standing);
    expect(r.items).toEqual(items);
    expect(r.extras).toEqual(extras);
  });

  it('a pin whose item is already on the standing list adds nothing, only loses pinned', () => {
    const standing = list([st({ id: 's:aaaaaaaa', ing: 'melk', qty: 2, unit: 'l', aisle: 'zuivel-eieren' })]);
    const r = absorbPins(standing, { items: [pinnedRecipe], extras: [] }, NOW);
    expect(r.moved).toBe(0);
    expect(r.standing.items).toHaveLength(1);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.pinned).toBeUndefined();
  });
});

describe('mergeStandingLists', () => {
  it('union on id, local wins, incoming same ing skipped, updatedAt max', () => {
    const local = list(
      [st({ id: 's:aaaaaaaa', ing: 'melk', qty: 2, unit: 'l', aisle: 'zuivel-eieren' }), st({ id: 's:bbbbbbbb', ing: null, label: { nl: 'postzegels' } })],
      '2026-11-01T00:00:00.000Z',
    );
    const incoming = list(
      [
        st({ id: 's:aaaaaaaa', ing: 'melk', qty: 5, unit: 'l', aisle: 'zuivel-eieren' }),
        st({ id: 's:cccccccc', ing: 'melk', qty: 1, unit: 'l', aisle: 'zuivel-eieren' }),
        st({ id: 's:dddddddd', ing: null, label: { nl: '', en: 'Postzegels' } }),
        st({ id: 's:eeeeeeee', ing: 'pindakaas', qty: 1, unit: 'pot', aisle: 'brood-ontbijt' }),
      ],
      '2026-11-05T00:00:00.000Z',
    );
    const m = mergeStandingLists(local, incoming);
    expect(m.v).toBe(1);
    expect(m.items.map((s) => s.id)).toEqual(['s:aaaaaaaa', 's:bbbbbbbb', 's:eeeeeeee']);
    expect(m.items[0]?.qty).toBe(2);
    expect(m.updatedAt).toBe('2026-11-05T00:00:00.000Z');
    expect(mergeStandingLists(incoming, local).updatedAt).toBe('2026-11-05T00:00:00.000Z');
  });
});

describe('renderStandingItem', () => {
  const r = (p: Partial<StandingItem>, lang: 'nl' | 'en') => renderStandingItem(st({ id: 's:aaaaaaaa', ...p }), dict, lang);
  it('amounts, units, plurals, no "(pm)"', () => {
    expect(r({ ing: 'melk', qty: 3, unit: 'l', aisle: 'zuivel-eieren' }, 'nl')).toBe('3 l melk');
    expect(r({ ing: 'melk', qty: 3, unit: 'l', aisle: 'zuivel-eieren' }, 'en')).toBe('3 l milk');
    expect(r({ ing: 'mayonaise', qty: 1, unit: 'pot', aisle: 'sauzen-olie-azijn' }, 'nl')).toBe('1 pot mayonaise');
    expect(r({ ing: 'mayonaise', qty: 1, unit: 'pot', aisle: 'sauzen-olie-azijn' }, 'en')).toBe('1 jar mayonnaise');
    expect(r({ ing: 'mayonaise', qty: 2, unit: 'pot', aisle: 'sauzen-olie-azijn' }, 'nl')).toBe('2 potten mayonaise');
    expect(r({ ing: 'mayonaise', qty: 2, unit: 'pot', aisle: 'sauzen-olie-azijn' }, 'en')).toBe('2 jars mayonnaise');
    expect(r({ ing: 'boter', qty: 200, unit: 'g', aisle: 'zuivel-eieren' }, 'nl')).toBe('200 g boter');
    expect(r({ ing: 'boter', qty: 200, unit: 'g', aisle: 'zuivel-eieren' }, 'en')).toBe('200 g butter');
    expect(r({ ing: 'melk', qty: null, unit: 'l', aisle: 'zuivel-eieren' }, 'nl')).toBe('melk');
    expect(r({ ing: null, label: { nl: 'postzegels', en: '' } }, 'nl')).toBe('postzegels');
  });
});

describe('sortStandingItems', () => {
  it('dairy before other; paused last within the aisle', () => {
    const items = [
      st({ id: 's:aaaaaaaa', ing: null, label: { nl: 'postzegels' }, aisle: 'overig' }),
      st({ id: 's:bbbbbbbb', ing: 'boter', qty: 1, unit: 'pak', aisle: 'zuivel-eieren', enabled: false }),
      st({ id: 's:cccccccc', ing: 'melk', qty: 2, unit: 'l', aisle: 'zuivel-eieren' }),
      st({ id: 's:dddddddd', ing: 'ei', qty: 6, aisle: 'zuivel-eieren' }),
    ];
    expect(sortStandingItems(items, dict, 'nl').map((s) => s.id)).toEqual(['s:dddddddd', 's:cccccccc', 's:bbbbbbbb', 's:aaaaaaaa']);
  });
});
