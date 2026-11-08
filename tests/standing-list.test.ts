// 6C blok 3 (docs/specs/vaste-lijst.md §1d, §4 "Blok 3", §6): the standing list INSIDE the week
// list, end to end over the pure parts. Standing items (src/domain/standing.ts) become list lines with
// `standingToListItem`, enabled only (as `generateList` in src/db/repo.ts passes them), go through
// `aggregate` with and without a week plan, and come out as the shared text (`listAsText`).
// "Heb ik al" on a standing line is its own flag for this list only; "Ook voortaan" makes the adjusted
// amount the usual one; "Klaar" (`clearChecks`) clears both. The repo functions write Dexie, so
// their effect on a line is spelled out here (`klaar`, `adopt`) from the rules of §1d and §3.
// Uses the REAL dictionary, like aggregate.test.ts and standing.test.ts.
import { describe, expect, it } from 'vitest';
import { adjustStep, aggregate, effectiveQty, listAsText, renderListItem, type AggregateInput, type ListItem } from '../src/domain/aggregate';
import { defaultDictionary } from '../src/domain/data';
import type { Recipe } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import type { Plan } from '../src/domain/planner';
import { renderStandingItem, standingKey, standingToListItem, type StandingItem } from '../src/domain/standing';

const dict = defaultDictionary();
const NOW = '2026-11-08T10:00:00.000Z';

function st(p: Partial<StandingItem> & { id: string }): StandingItem {
  return { ing: null, qty: null, unit: null, aisle: 'overig', enabled: true, addedAt: NOW, ...p };
}

const melk = st({ id: 's:k3m9x2ab', ing: 'melk', qty: 3, unit: 'l', aisle: 'zuivel-eieren' });
const mayo = st({ id: 's:q7p1zz0c', ing: 'mayonaise', qty: 1, unit: 'pot', aisle: 'sauzen-olie-azijn' });
const zegels = st({ id: 's:e5f6g7h8', label: { nl: 'postzegels', en: 'stamps' } });
const pindakaas = st({ id: 's:p4n1d4k5', ing: 'pindakaas', qty: 1, unit: 'pot', aisle: 'brood-ontbijt', enabled: false });
const ALL = [melk, mayo, zegels, pindakaas];

function rec(id: string, nameNl: string, raws: string[]): Recipe {
  return {
    schema: 2,
    id,
    rev: 1,
    createdAt: 'x',
    updatedAt: 'x',
    origin: { kind: 'builtin' },
    name: { nl: nameNl },
    tags: [],
    servings: 4,
    lines: raws.map((raw) => parseLine(raw, dict, 'nl')),
    steps: [],
    goesWith: [],
    aliases: [],
  };
}

/** What generateList does: the enabled standing items as lines, into aggregate. */
function week(standing: readonly StandingItem[], over: Partial<AggregateInput> = {}, recipes: Recipe[] = []): ListItem[] {
  const plan: Plan = { id: 'current', items: recipes.map((r) => ({ id: `pi:${r.id}`, recipeId: r.id, servings: 4, addedAt: 'x' })), updatedAt: 'x' };
  const map = new Map(recipes.map((r) => [r.id, r]));
  return aggregate({
    plan,
    recipes: map,
    lines: (id) => map.get(id)?.lines ?? [],
    dict,
    pantry: new Set(),
    extras: [],
    standing: standing.filter((s) => s.enabled).map(standingToListItem),
    ...over,
  });
}

const line = (items: ListItem[], s: StandingItem): ListItem => {
  const hit = items.find((it) => it.key === standingKey(s.id));
  if (!hit) throw new Error(`no line for ${s.id}`);
  return hit;
};
const patch = (items: ListItem[], key: string, p: Partial<ListItem>): ListItem[] => items.map((it) => (it.key === key ? { ...it, ...p } : it));

/** "Klaar" (§1d): ticks go; on standing lines also inHouse and adjusted, back to 'main'. */
const klaar = (items: ListItem[]): ListItem[] =>
  items.map((it) => {
    const next = { ...it };
    delete next.checked;
    if (it.standing) {
      delete next.inHouse;
      delete next.adjusted;
      if (next.section === 'inHouse') next.section = 'main';
    }
    return next;
  });

/** "Ook voortaan" (§3 adoptStandingAdjustment): the usual amount := effectiveQty(line), null for 0. */
const adopt = (s: StandingItem, it: ListItem): StandingItem => {
  const eff = effectiveQty(it);
  return { ...s, qty: eff === null || eff === 0 ? null : eff };
};

describe('the standing list in the week list (6C blok 3)', () => {
  it('only enabled items come in, as standing lines in main with the usual amount', () => {
    const items = week(ALL);
    expect(items.map((it) => it.key).sort()).toEqual([melk, mayo, zegels].map((s) => standingKey(s.id)).sort());
    for (const s of [melk, mayo, zegels]) {
      const it = line(items, s);
      expect(it).toMatchObject({ standing: true, section: 'main', sources: [] });
      expect(renderListItem(it, dict, 'nl')).toBe(renderStandingItem(s, dict, 'nl'));
      expect(renderListItem(it, dict, 'en')).toBe(renderStandingItem(s, dict, 'en'));
    }
  });

  it('"Heb ik al" on a standing line holds for this list only and never touches a recipe line of the same ingredient', () => {
    const r = rec('b:pap', 'Pap', ['250 ml melk']);
    const first = week(ALL, {}, [r]);
    const have = patch(first, standingKey(melk.id), { inHouse: true, section: 'inHouse' });
    const again = week(ALL, { previous: have }, [r]);
    expect(line(again, melk)).toMatchObject({ inHouse: true, section: 'inHouse' });
    const recipeMelk = again.find((it) => it.ing === 'melk' && !it.standing);
    expect(recipeMelk?.section).toBe('main');
    expect(recipeMelk?.inHouse).toBeUndefined();
  });

  it('"+" in the proto block adjusts this list only; "Ook voortaan" makes it the usual amount', () => {
    const first = week(ALL);
    const m = line(first, mayo);
    const step = adjustStep(m.unit ?? null, m.qty as number);
    const plus = patch(first, m.key, { adjusted: step });
    const adjusted = line(week(ALL, { previous: plus }), mayo);
    // The "Ook voortaan" button shows only while adjusted is a number other than 0 (§3 StandingProtoRow).
    expect(typeof adjusted.adjusted === 'number' && adjusted.adjusted !== 0).toBe(true);
    // The snack text ("Nieuw standaardaantal: {text}") is the line as rendered now.
    expect(renderListItem(adjusted, dict, 'nl')).toBe('2 potten mayonaise');
    expect(renderListItem(adjusted, dict, 'en')).toBe('2 jars mayonnaise');
    // The standing item now says the same in the Every week tab ...
    const kept = adopt(mayo, adjusted);
    expect(renderStandingItem(kept, dict, 'nl')).toBe('2 potten mayonaise');
    // ... and the next list starts from it, without an adjustment (and without the button).
    const after = line(week([melk, kept, zegels], { previous: klaar(week(ALL, { previous: plus })) }), kept);
    expect(after.adjusted).toBeUndefined();
    expect(renderListItem(after, dict, 'nl')).toBe('2 potten mayonaise');
  });

  it('"Ook voortaan" after bringing the amount down to 0 keeps the item without a number (never 0)', () => {
    const first = week(ALL);
    const m = line(first, melk);
    const zero = line(week(ALL, { previous: patch(first, m.key, { adjusted: -3 }) }), melk);
    expect(effectiveQty(zero)).toBe(0);
    const kept = adopt(melk, zero);
    expect(kept.qty).toBeNull();
    expect(renderStandingItem(kept, dict, 'nl')).toBe('melk');
  });

  it('Klaar resets "Heb ik al" and the adjusted amount of standing lines: the next list has the usual amounts', () => {
    const first = week(ALL);
    const marked = patch(patch(patch(first, standingKey(melk.id), { inHouse: true, section: 'inHouse' }), standingKey(mayo.id), { adjusted: 1, checked: true }), standingKey(zegels.id), { checked: true });
    const before = week(ALL, { previous: marked });
    const after = week(ALL, { previous: klaar(before) });
    for (const s of [melk, mayo, zegels]) {
      const it = line(after, s);
      expect(it.section).toBe('main');
      expect(it.inHouse).toBeUndefined();
      expect(it.adjusted).toBeUndefined();
      expect(it.checked).toBeUndefined();
      expect(renderListItem(it, dict, 'nl')).toBe(renderStandingItem(s, dict, 'nl'));
    }
    // Undo of Klaar puts the old lines back: aggregate carries everything again.
    const undone = week(ALL, { previous: before });
    expect(line(undone, melk)).toMatchObject({ inHouse: true, section: 'inHouse' });
    expect(line(undone, mayo)).toMatchObject({ adjusted: 1, checked: true });
  });

  it('without a week plan the shared text lists the standing lines per aisle, no paused item, no "— …" line', () => {
    const items = week(ALL);
    const nl = listAsText(items, dict, 'nl', { title: '🛒 Boodschappen wk 45', hideInHouse: true }).split('\n');
    expect(nl[0]).toBe('🛒 Boodschappen wk 45');
    expect(nl).toContain('☐ 3 l melk');
    expect(nl).toContain('☐ 1 pot mayonaise');
    expect(nl).toContain('☐ postzegels');
    expect(nl.join('\n')).not.toContain('pindakaas');
    expect(nl.join('\n')).not.toContain('(pm)');
    expect(nl.some((l) => l.startsWith('—'))).toBe(false);
    const en = listAsText(items, dict, 'en', { title: '🛒 Shopping wk 45' }).split('\n');
    expect(en).toContain('☐ 3 l milk');
    expect(en).toContain('☐ 1 jar mayonnaise');
    expect(en).toContain('☐ stamps');
    expect(en.some((l) => l.startsWith('—'))).toBe(false);
  });

  it('the shared text leaves out a standing line marked "Heb ik al" when in-house lines are hidden', () => {
    const first = week(ALL);
    const items = week(ALL, { previous: patch(first, standingKey(melk.id), { inHouse: true, section: 'inHouse' }) });
    expect(listAsText(items, dict, 'nl', { title: 'T' })).toContain('☐ 3 l melk (in huis)');
    expect(listAsText(items, dict, 'nl', { title: 'T', hideInHouse: true })).not.toContain('melk');
  });
});
