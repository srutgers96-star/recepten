// rewriteIngredientId (docs/phase-5-spec.md A-bis.6 "Fuseer met bestaand"): every reference to a
// user-created ingredient id is rewritten to the existing entry's id; untouched records are left out.
import { describe, expect, it } from 'vitest';
import { rewriteIngredientId, rewriteLinesIngredientId } from '../src/domain/merge-ingredients';
import type { Line, Recipe } from '../src/domain/model';

function recipe(id: string, lines: Line[]): Recipe {
  return {
    schema: 2, id, rev: 1, createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
    origin: { kind: 'user' }, name: { en: 'Stew' }, tags: [], servings: 4, lines, steps: [], goesWith: [], aliases: [],
  };
}

const eggplantLine: Line = { raw: { en: '1 medium eggplant' }, qty: { min: 1 }, unit: null, ing: 'eggplant', name: 'eggplant' };
const onionLine: Line = { raw: { en: '1 onion' }, qty: { min: 1 }, unit: null, ing: 'ui', name: 'onion' };
const altLine: Line = { raw: { en: '250 g cod (or eggplant)' }, ing: 'kabeljauw', alt: [{ raw: { en: 'eggplant' }, ing: 'eggplant', name: 'eggplant' }], altMode: 'or' };

describe('rewriteIngredientId', () => {
  it('rewrites lines, alternatives, overrides, list items and pantry rows that point at the old id', () => {
    const recipes = [recipe('u:1', [eggplantLine, onionLine]), recipe('u:2', [onionLine]), recipe('u:3', [altLine])];
    const overrides = [
      { recipeId: 'b:x', index: 0, ing: 'eggplant', updatedAt: 't' },
      { recipeId: 'b:y', index: 2, ing: 'ui', updatedAt: 't' },
    ];
    const items = [
      { key: 'eggplant||stuk', ing: 'eggplant', aisle: 'overig', section: 'main', sources: [] },
      { key: 'ui||stuk', ing: 'ui', aisle: 'groente-fruit', section: 'main', sources: [] },
    ];
    const pantry = [{ ing: 'eggplant', until: '2026-10-10' }, { ing: 'ui' }];
    const r = rewriteIngredientId(recipes, overrides, items, pantry, 'eggplant', 'aubergine');

    expect(r.recipes.map((x) => x.id)).toEqual(['u:1', 'u:3']);
    expect(r.recipes[0]?.lines[0]?.ing).toBe('aubergine');
    expect(r.recipes[0]?.lines[1]).toBe(onionLine); // untouched line: same object
    expect(r.recipes[1]?.lines[0]?.alt?.[0]?.ing).toBe('aubergine');
    expect(r.lineRefs).toBe(2);
    expect(r.lineOverrides).toEqual([{ recipeId: 'b:x', index: 0, ing: 'aubergine', updatedAt: 't' }]);
    expect(r.listItems).toEqual([{ key: 'aubergine||stuk', ing: 'aubergine', aisle: 'overig', section: 'main', sources: [] }]);
    expect(r.pantry).toEqual([{ ing: 'aubergine', until: '2026-10-10' }]);
    expect(r.pantryDelete).toEqual(['eggplant']);
    // Inputs are not mutated.
    expect(recipes[0]?.lines[0]?.ing).toBe('eggplant');
    expect(pantry[0]?.ing).toBe('eggplant');
  });

  it('merges a pantry row with an existing row of the new id: no date beats a date, else the later date', () => {
    const later = rewriteIngredientId([], [], [], [{ ing: 'old', until: '2026-10-10' }, { ing: 'new', until: '2026-10-20' }], 'old', 'new');
    expect(later.pantry).toEqual([{ ing: 'new', until: '2026-10-20' }]);
    const forever = rewriteIngredientId([], [], [], [{ ing: 'old' }, { ing: 'new', until: '2026-10-20' }], 'old', 'new');
    expect(forever.pantry).toEqual([{ ing: 'new' }]);
    expect(forever.pantryDelete).toEqual(['old']);
  });

  it('returns nothing for the same id, a missing id or records that do not reference it', () => {
    const empty = { recipes: [], lineOverrides: [], listItems: [], pantry: [], pantryDelete: [], lineRefs: 0 };
    expect(rewriteIngredientId([recipe('u:1', [eggplantLine])], [], [], [], 'eggplant', 'eggplant')).toEqual(empty);
    expect(rewriteIngredientId([recipe('u:1', [onionLine])], [{ recipeId: 'b', index: 0, ing: 'ui', updatedAt: 't' }], [], [{ ing: 'ui' }], 'eggplant', 'aubergine')).toEqual(empty);
  });

  it('rewriteLinesIngredientId returns the same array when nothing changed', () => {
    const lines = [onionLine];
    expect(rewriteLinesIngredientId(lines, 'eggplant', 'aubergine').lines).toBe(lines);
    const r = rewriteLinesIngredientId([eggplantLine, altLine], 'eggplant', 'aubergine');
    expect(r.changed).toBe(2);
    expect(r.lines.map((l) => l.ing)).toEqual(['aubergine', 'kabeljauw']);
  });
});
