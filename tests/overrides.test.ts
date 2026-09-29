// applyOverride / mergeLineOverride / applyLineOverrides (docs/phase-2-spec.md §5, src/domain/overrides.ts).
import { describe, expect, it } from 'vitest';
import type { Line, Recipe } from '../src/domain/model';
import { applyLineOverrides, applyOverride, mergeLineOverride, mergeText, type LineOverride, type RecipeOverride } from '../src/domain/overrides';

function recipe(): Recipe {
  return {
    schema: 2,
    id: 'b:uiensoep',
    rev: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    origin: { kind: 'builtin' },
    name: { nl: 'Uiensoep', en: 'Onion soup' },
    description: { nl: 'Klassiek.' },
    category: 'soep',
    tags: ['winter'],
    servings: 4,
    lines: [
      { raw: { nl: '4 uien' }, qty: { min: 4 }, unit: null, ing: 'ui', name: 'uien', confidence: 1 },
      { raw: { nl: '1 l bouillon' }, qty: { min: 1 }, unit: 'l', ing: null, name: 'bouillon', confidence: 0.4 },
    ],
    steps: [
      { text: { nl: 'Snipper de uien.', en: 'Slice the onions.' } },
      { text: { nl: 'Kook 20 minuten.', en: 'Simmer for 20 minutes.' }, timers: [{ min: 20, unit: 'min' }] },
    ],
    servingTip: { nl: 'Met kaasbrood.' },
    goesWith: [],
    aliases: [],
    text: { en: 'llm' },
    extra: 'kept',
  };
}

function override(patch: RecipeOverride['patch'], rev = 1): RecipeOverride {
  return { baseId: 'b:uiensoep', rev, patch, updatedAt: '2026-09-29T10:00:00.000Z', by: 'Stijn' };
}

describe('mergeText', () => {
  it('merges per language, clears with an empty string or null', () => {
    expect(mergeText({ nl: 'a', en: 'b' }, { en: 'c' })).toEqual({ nl: 'a', en: 'c' });
    expect(mergeText({ nl: 'a' }, { en: '' })).toEqual({ nl: 'a', en: '' });
    expect(mergeText({ nl: 'a' }, null)).toBeNull();
    expect(mergeText({ nl: 'a' }, undefined)).toEqual({ nl: 'a' });
    expect(mergeText(undefined, { en: 'x' })).toEqual({ en: 'x' });
  });
});

describe('applyOverride', () => {
  it('returns the same object without an override or for another id', () => {
    const r = recipe();
    expect(applyOverride(r, null)).toBe(r);
    expect(applyOverride(r, undefined)).toBe(r);
    expect(applyOverride(r, { ...override({ name: { en: 'X' } }), baseId: 'b:ander' })).toBe(r);
  });

  it('replaces patch fields, keeps unknown keys and bumps rev', () => {
    const r = recipe();
    const out = applyOverride(r, override({ category: 'stamppot', tags: ['snel', 'kids'], weird: 42 }, 3));
    expect(out).not.toBe(r);
    expect(out.category).toBe('stamppot');
    expect(out.tags).toEqual(['snel', 'kids']);
    expect(out.weird).toBe(42);
    expect(out.extra).toBe('kept');
    expect(out.rev).toBe(4);
    expect(out.updatedAt).toBe('2026-09-29T10:00:00.000Z');
    expect(out.override).toEqual({ rev: 3, updatedAt: '2026-09-29T10:00:00.000Z', by: 'Stijn' });
    // the builtin itself is untouched
    expect(r.category).toBe('soep');
    expect(r.rev).toBe(1);
    expect(r.override).toBeUndefined();
  });

  it('an English name edit never wipes the Dutch (invariant 3)', () => {
    const out = applyOverride(recipe(), override({ name: { en: 'French onion soup' }, servingTip: { en: 'With cheese toast.' } }));
    expect(out.name).toEqual({ nl: 'Uiensoep', en: 'French onion soup' });
    expect(out.servingTip).toEqual({ nl: 'Met kaasbrood.', en: 'With cheese toast.' });
    expect(out.description).toEqual({ nl: 'Klassiek.' });
  });

  it('description: null clears it', () => {
    expect(applyOverride(recipe(), override({ description: null })).description).toBeNull();
  });

  it('steps with the same count merge per language and keep timers', () => {
    const out = applyOverride(recipe(), override({ steps: [{ text: { en: 'Finely slice the onions.' } }, { text: { en: 'Simmer 20 min.' } }] }));
    expect(out.steps[0]).toEqual({ text: { nl: 'Snipper de uien.', en: 'Finely slice the onions.' } });
    expect(out.steps[1]).toEqual({ text: { nl: 'Kook 20 minuten.', en: 'Simmer 20 min.' }, timers: [{ min: 20, unit: 'min' }] });
  });

  it('steps with another count replace the list', () => {
    const out = applyOverride(recipe(), override({ steps: [{ text: { nl: 'Alles in één pan.', en: 'Everything in one pan.' } }] }));
    expect(out.steps).toHaveLength(1);
    expect(out.steps[0]?.text).toEqual({ nl: 'Alles in één pan.', en: 'Everything in one pan.' });
  });

  it('lines with the same count merge per index and never lose raw (invariant 2)', () => {
    const out = applyOverride(recipe(), override({ lines: [{ raw: { en: '4 onions' }, ing: 'ui' }, { raw: {}, ing: 'bouillon', confidence: 1 }] }));
    expect(out.lines[0]).toMatchObject({ raw: { nl: '4 uien', en: '4 onions' }, qty: { min: 4 }, ing: 'ui' });
    expect(out.lines[1]).toMatchObject({ raw: { nl: '1 l bouillon' }, unit: 'l', ing: 'bouillon', confidence: 1 });
  });

  it('lines with another count replace the list (raw required)', () => {
    const out = applyOverride(recipe(), override({ lines: [{ raw: { nl: '2 uien' }, ing: 'ui' }, { raw: { nl: '1 l water' } }, { raw: { nl: 'zout' } }] }));
    expect(out.lines).toHaveLength(3);
    expect(out.lines[2]?.raw).toEqual({ nl: 'zout' });
  });

  it('rev falls back to +1 for a bogus override rev', () => {
    expect(applyOverride(recipe(), override({ category: 'vis' }, 0)).rev).toBe(2);
    expect(applyOverride(recipe(), override({ category: 'vis' }, Number.NaN)).rev).toBe(2);
  });
});

describe('mergeLineOverride', () => {
  const line: Line = { raw: { nl: '1 l bouillon' }, qty: { min: 1 }, unit: 'l', ing: null, name: 'bouillon', confidence: 0.4 };
  const o = (extra: Partial<LineOverride>): LineOverride => ({ recipeId: 'b:uiensoep', index: 1, updatedAt: '2026-09-29T10:00:00.000Z', ...extra });

  it('returns the same line without an override or with an empty one', () => {
    expect(mergeLineOverride(line, null)).toBe(line);
    expect(mergeLineOverride(line, o({}))).toBe(line);
  });

  it('links an ingredient with confidence 1 and keeps everything else', () => {
    const out = mergeLineOverride(line, o({ ing: 'bouillon', qual: ['kippen'] }));
    expect(out).toMatchObject({ raw: { nl: '1 l bouillon' }, qty: { min: 1 }, unit: 'l', ing: 'bouillon', qual: ['kippen'], confidence: 1 });
    expect(line.ing).toBeNull();
  });

  it('null unlinks / clears; absent keys leave the line alone', () => {
    const linked: Line = { ...line, ing: 'ui', qual: ['rode'], prep: { nl: 'gesnipperd', en: 'finely diced' }, confidence: 1 };
    const out = mergeLineOverride(linked, o({ ing: null, prep: null }));
    expect(out.ing).toBeNull();
    expect(out.prep).toBeNull();
    expect(out.qual).toEqual(['rode']);
    expect(out.confidence).toBe(1);
    expect(mergeLineOverride(linked, o({ prep: { nl: 'fijngehakt', en: 'finely chopped' } })).prep).toEqual({ nl: 'fijngehakt', en: 'finely chopped' });
  });
});

describe('applyLineOverrides', () => {
  it('merges by index and ignores indexes outside the recipe', () => {
    const r = recipe();
    const out = applyLineOverrides(r.lines, [
      { recipeId: r.id, index: 1, ing: 'bouillon', updatedAt: '2026-09-29T10:00:00.000Z' },
      { recipeId: r.id, index: 7, ing: 'zout', updatedAt: '2026-09-29T10:00:00.000Z' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(r.lines[0]);
    expect(out[1]?.ing).toBe('bouillon');
    expect(applyLineOverrides(r.lines, [])).toEqual(r.lines);
  });
});
