// 13D block 4 (docs/specs/varianten-tabs.md §1g, §6 check 13): the share screen's "send my note as
// the maker's tip" switch. Without the switch the envelope carries no tip from the note; with it,
// `r.tip` (own recipe, `#r=`) or `p.patch.tip` (adjusted classic, `#p=`) carries it, added to an
// existing tip with an empty line between. The loaded recipe/override objects are never mutated
// (the stored recipe and the notes table stay as they were). No DOM, no database.
import { describe, expect, it } from 'vitest';
import type { Recipe } from '../src/domain/model';
import type { LineOverride, RecipeOverride } from '../src/domain/overrides';
import { buildReadableRecipe } from '../src/domain/message';
import { parseEnvelope } from '../src/domain/share';
import { planImport } from '../src/domain/merge';
import { buildShareEnvelope, withNoteTip, type Loaded } from '../src/screens/ShareScreen';

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    schema: 2,
    id: 'u:abc12345',
    rev: 3,
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    origin: { kind: 'user', author: 'Stijn' },
    name: { nl: 'Pasta pesto', en: 'Pesto pasta' },
    tags: ['snel'],
    servings: 2,
    lines: [{ raw: { nl: '400 g pasta', en: '400 g pasta' }, qty: { min: 400 }, unit: 'g', ing: 'pasta' }],
    steps: [{ text: { nl: 'Kook de pasta.', en: 'Boil the pasta.' } }],
    goesWith: [],
    aliases: [],
    ...over,
  };
}

function loadedOwn(r: Recipe): Loaded {
  return { base: r, effective: r, lineOverrides: [], userIngredients: [], override: undefined, linksOnly: false };
}

function loadedClassic(r: Recipe, override: RecipeOverride): Loaded {
  return { base: r, effective: r, lineOverrides: [], userIngredients: [], override, linksOnly: false };
}

describe('withNoteTip', () => {
  it('a blank note sends nothing', () => {
    expect(withNoteTip(undefined, '   ', 'nl')).toBeNull();
    expect(withNoteTip({ nl: 'Bestaand' }, '', 'nl')).toBeNull();
  });

  it('the note alone in the UI language when there is no tip', () => {
    expect(withNoteTip(undefined, ' Extra knoflook. ', 'nl')).toEqual({ nl: 'Extra knoflook.' });
    expect(withNoteTip(null, 'More garlic.', 'en')).toEqual({ en: 'More garlic.' });
  });

  it('appended to an existing tip with an empty line; the other language is kept', () => {
    const existing = { nl: 'Nog lekkerder na een dag.', en: 'Better after a day.' };
    expect(withNoteTip(existing, 'Extra knoflook.', 'nl')).toEqual({ nl: 'Nog lekkerder na een dag.\n\nExtra knoflook.', en: 'Better after a day.' });
    expect(existing).toEqual({ nl: 'Nog lekkerder na een dag.', en: 'Better after a day.' });
  });
});

describe('buildShareEnvelope (#r=)', () => {
  it('without the switch the envelope has no tip from the note', () => {
    const env = buildShareEnvelope(loadedOwn(recipe()), 'Stijn', null);
    expect(env.t).toBe('r');
    expect((env.r as Recipe).tip).toBeUndefined();
  });

  it('without the switch an existing maker tip travels unchanged', () => {
    const env = buildShareEnvelope(loadedOwn(recipe({ tip: { nl: 'Bestaand' } })), 'Stijn', null);
    expect((env.r as Recipe).tip).toEqual({ nl: 'Bestaand' });
  });

  it('with the switch r.tip carries the note; the loaded recipe is not mutated', () => {
    const r = recipe({ tip: { en: 'Better after a day.' } });
    const loaded = loadedOwn(r);
    const before = JSON.stringify(loaded);
    const tip = withNoteTip(r.tip, 'Extra knoflook.', 'nl');
    const env = buildShareEnvelope(loaded, 'Stijn', tip);
    expect((env.r as Recipe).tip).toEqual({ en: 'Better after a day.', nl: 'Extra knoflook.' });
    expect(JSON.stringify(loaded)).toBe(before);
    expect(r.tip).toEqual({ en: 'Better after a day.' });
  });

  it('the readable text shows the tip only when it is on the effective copy', () => {
    const r = recipe();
    const tip = withNoteTip(r.tip, 'Extra knoflook.', 'nl');
    expect(buildReadableRecipe(r, ['nl'])).not.toContain('Extra knoflook.');
    expect(buildReadableRecipe({ ...r, tip: tip ?? undefined }, ['nl'])).toContain('Extra knoflook.');
  });
});

describe('buildShareEnvelope (#p=)', () => {
  const base = recipe({ id: 'b:uiensoep', origin: { kind: 'builtin' } as Recipe['origin'], name: { nl: 'Uiensoep', en: 'French onion soup' } });
  const override: RecipeOverride = { baseId: 'b:uiensoep', rev: 2, patch: { servingTip: { nl: 'Met stokbrood.' } }, updatedAt: '2026-10-22T18:00:00.000Z' };

  it('without the switch the patch has no tip', () => {
    const env = buildShareEnvelope(loadedClassic(base, override), 'Gabi', null);
    expect(env.t).toBe('p');
    const p = env.p as { patch: Record<string, unknown> };
    expect('tip' in p.patch).toBe(false);
  });

  it('with the switch p.patch.tip carries the note; the stored override is not mutated', () => {
    const before = JSON.stringify(override);
    const env = buildShareEnvelope(loadedClassic(base, override), 'Gabi', { en: 'Grate the cheese yourself.' });
    const p = env.p as { patch: Record<string, unknown> };
    expect(p.patch.tip).toEqual({ en: 'Grate the cheese yourself.' });
    expect(p.patch.servingTip).toEqual({ nl: 'Met stokbrood.' });
    expect(JSON.stringify(override)).toBe(before);
  });

  it('a classic with only line links gets the tip in its empty patch', () => {
    const lo: LineOverride = { recipeId: 'b:uiensoep', index: 0, ing: 'pasta', updatedAt: '2026-10-22T18:00:00.000Z' };
    const loaded: Loaded = { base, effective: base, lineOverrides: [lo], userIngredients: [], override: undefined, linksOnly: true };
    const env = buildShareEnvelope(loaded, 'Gabi', { nl: 'Kaas zelf raspen.' });
    const p = env.p as { patch: Record<string, unknown> };
    expect(p.patch).toEqual({ tip: { nl: 'Kaas zelf raspen.' } });
  });

  it('an unadjusted classic (no override, no links) still sends the tip as #p= patch.tip', () => {
    const loaded: Loaded = { base, effective: base, lineOverrides: [], userIngredients: [], override: undefined, linksOnly: false };
    const env = buildShareEnvelope(loaded, 'Gabi', withNoteTip(undefined, 'alleen voor mij', 'nl'));
    expect(env.t).toBe('p');
    const p = env.p as { baseId: string; patch: Record<string, unknown> };
    expect(p.baseId).toBe('b:uiensoep');
    expect(p.patch).toEqual({ tip: { nl: 'alleen voor mij' } });
    // The receiver has the same classic: the patch is planned (not 'present'), so the tip arrives.
    const plan = planImport(parseEnvelope(env), { recipes: [base], overrides: [], userIngredients: [] });
    const item = plan.items.find((i) => i.id === 'p:b:uiensoep');
    expect(item?.kind).toBe('patch');
    expect(item?.status).toBe('new');
  });

  it('an unadjusted classic without the switch still travels as #r= (unchanged)', () => {
    const loaded: Loaded = { base, effective: base, lineOverrides: [], userIngredients: [], override: undefined, linksOnly: false };
    expect(buildShareEnvelope(loaded, 'Gabi', null).t).toBe('r');
  });
});
