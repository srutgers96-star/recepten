// scaleFactor / scaleQty / scaleKindOf (docs/phase-2-spec.md §3, PLAN.md §8 step 5 rounding rules).
import { describe, expect, it } from 'vitest';
import { defaultDictionary } from '../src/domain/data';
import { roundScaled, scaleFactor, scaleKindOf, scaleQty } from '../src/domain/scale';

const dict = defaultDictionary();
const u = (id: string) => dict.unit(id)!;

describe('scaleFactor', () => {
  it('divides by the base servings (default 4) and never returns 0', () => {
    expect(scaleFactor(2)).toBe(0.5);
    expect(scaleFactor(4)).toBe(1);
    expect(scaleFactor(6)).toBe(1.5);
    expect(scaleFactor(8)).toBe(2);
    expect(scaleFactor(3, 6)).toBe(0.5);
    expect(scaleFactor(0)).toBe(1);
    expect(scaleFactor(2, 0)).toBe(1);
  });
});

describe('scaleKindOf', () => {
  it('classifies the units', () => {
    expect(scaleKindOf(null)).toBe('pieces');
    expect(scaleKindOf(u('g'))).toBe('mass');
    expect(scaleKindOf(u('kg'))).toBe('mass');
    expect(scaleKindOf(u('ml'))).toBe('volume');
    expect(scaleKindOf(u('dl'))).toBe('volume');
    expect(scaleKindOf(u('l'))).toBe('volume');
    expect(scaleKindOf(u('el'))).toBe('spoon');
    expect(scaleKindOf(u('tl'))).toBe('spoon');
    expect(scaleKindOf(u('kop'))).toBe('spoon');
    expect(scaleKindOf(u('mp'))).toBe('pinch');
    expect(scaleKindOf(u('snuf'))).toBe('pinch');
    expect(scaleKindOf(u('scheut'))).toBe('pinch');
    expect(scaleKindOf(u('teen'))).toBe('pieces');
    expect(scaleKindOf(u('blik'))).toBe('pieces');
  });
});

describe('scaleQty', () => {
  it('returns the quantity unchanged for factor 1 and for pinches', () => {
    const q = { min: 2, max: 3 };
    expect(scaleQty(q, 1, u('el'))).toBe(q);
    expect(scaleQty({ min: 1 }, 2, u('mp'))).toEqual({ min: 1 });
    expect(scaleQty({ min: 1 }, 0.5, u('snuf'))).toEqual({ min: 1 });
  });

  it('pieces: quarter steps below 1, half steps above, ceil when scaling up', () => {
    expect(scaleQty({ min: 1 }, 0.5, null)).toEqual({ min: 0.5 });
    expect(scaleQty({ min: 0.5 }, 0.5, null)).toEqual({ min: 0.25 });
    expect(scaleQty({ min: 0.25 }, 0.5, null)).toEqual({ min: 0.25 });
    expect(scaleQty({ min: 3 }, 0.5, null)).toEqual({ min: 1.5 });
    expect(scaleQty({ min: 1 }, 1.5, null)).toEqual({ min: 1.5 });
    expect(scaleQty({ min: 3 }, 1.5, null)).toEqual({ min: 4.5 });
    expect(scaleQty({ min: 1 }, 1.25, null)).toEqual({ min: 1.5 });
    expect(scaleQty({ min: 2 }, 0.75, null)).toEqual({ min: 1.5 });
    expect(scaleQty({ min: 2 }, 0.6, u('teen'))).toEqual({ min: 1 });
  });

  it('spoons: quarter steps below 4, half steps above', () => {
    expect(scaleQty({ min: 1.5 }, 0.5, u('el'))).toEqual({ min: 0.75 });
    expect(scaleQty({ min: 1 }, 0.5, u('tl'))).toEqual({ min: 0.5 });
    expect(scaleQty({ min: 1 }, 0.25, u('tl'))).toEqual({ min: 0.25 });
    expect(scaleQty({ min: 3 }, 1.5, u('el'))).toEqual({ min: 4.5 });
    expect(scaleQty({ min: 3 }, 0.6, u('el'))).toEqual({ min: 1.75 });
    expect(scaleQty({ min: 1 }, 0.5, u('kop'))).toEqual({ min: 0.5 });
  });

  it('grams and millilitres round by magnitude in the base unit', () => {
    expect(scaleQty({ min: 250 }, 0.5, u('g'))).toEqual({ min: 125 });
    expect(scaleQty({ min: 250 }, 0.75, u('g'))).toEqual({ min: 190 });
    expect(scaleQty({ min: 250 }, 1.5, u('g'))).toEqual({ min: 375 });
    expect(scaleQty({ min: 15 }, 0.5, u('g'))).toEqual({ min: 8 });
    expect(scaleQty({ min: 75 }, 0.5, u('g'))).toEqual({ min: 40 });
    expect(scaleQty({ min: 1 }, 0.5, u('kg'))).toEqual({ min: 0.5 });
    expect(scaleQty({ min: 1.5 }, 1.5, u('kg'))).toEqual({ min: 2.25 });
    expect(scaleQty({ min: 1 }, 0.6, u('kg'))).toEqual({ min: 0.6 });
    expect(scaleQty({ min: 1 }, 0.55, u('kg'))).toEqual({ min: 0.55 });
    expect(scaleQty({ min: 1.25 }, 0.5, u('dl'))).toEqual({ min: 0.65 });
    expect(scaleQty({ min: 400 }, 0.75, u('ml'))).toEqual({ min: 300 });
    expect(scaleQty({ min: 1 }, 0.5, u('l'))).toEqual({ min: 0.5 });
  });

  it('scales ranges and keeps approx', () => {
    expect(scaleQty({ min: 2, max: 3 }, 0.5, u('el'))).toEqual({ min: 1, max: 1.5 });
    expect(scaleQty({ min: 2, max: 3 }, 2, null)).toEqual({ min: 4, max: 6 });
    expect(scaleQty({ min: 400, approx: true }, 0.75, u('g'))).toEqual({ min: 300, approx: true });
    // a range that collapses after rounding drops its max
    expect(scaleQty({ min: 1, max: 1.1 }, 0.5, null)).toEqual({ min: 0.5 });
  });

  it('roundScaled guards non-positive values', () => {
    expect(roundScaled(0, 'mass', u('g'))).toBe(0);
    expect(roundScaled(-1, 'pieces')).toBe(-1);
  });
});
