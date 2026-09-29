// Servings scaling with the rounding rules of PLAN.md §8 step 5 / docs/phase-2-spec.md §3.
// Framework-free.
//
//   pieces (no unit, count units): below 1 -> ¼ steps; 1 and up -> ½ steps (rounded up when scaling up)
//   spoons/cups (el, tl, kop, glas: household volume measures): ¼ steps below 4, ½ steps above
//                                                                          1½ el × ½ -> ¾ el
//   g / ml (metric units with a conversion): rounded in the base unit by magnitude: to 1 below 10,
//     to 5 below 100, to 10 below 1000 (a multiple of 5 is kept: 250 g × ½ = 125 g), to 50 above
//   pinches (mp, snuf, scheut, klont, druppel) never scale
import type { Qty } from './model.ts';
import type { Unit } from './dictionary.ts';

export type ScaleKind = 'pieces' | 'spoon' | 'mass' | 'volume' | 'pinch';

/** servings / base (default 4); never 0 or negative. */
export function scaleFactor(servings: number, base = 4): number {
  if (!(servings > 0) || !(base > 0)) return 1;
  return servings / base;
}

/** How a unit scales. null/undefined (counted pieces) -> 'pieces'. */
export function scaleKindOf(unit: Unit | null | undefined): ScaleKind {
  if (!unit) return 'pieces';
  switch (unit.group) {
    case 'pinch':
      return 'pinch';
    case 'mass':
      return typeof unit.g === 'number' && unit.g > 0 ? 'mass' : 'pieces';
    case 'volume': {
      const ml = unit.ml;
      if (typeof ml !== 'number' || !(ml > 0)) return 'pieces';
      // ml, cl, dl, l are metric; everything else up to a cup is a household measure.
      const metric = ml === 1 || ml === 10 || ml === 100 || ml === 1000;
      return !metric && ml <= 250 ? 'spoon' : 'volume';
    }
    default:
      return 'pieces';
  }
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function isMultiple(value: number, step: number): boolean {
  return Math.abs(value / step - Math.round(value / step)) < 1e-9;
}

function roundBase(base: number): number {
  if (base < 10) return Math.max(1, Math.round(base));
  if (base < 100) return roundTo(base, 5);
  if (base < 1000) return isMultiple(base, 5) ? base : roundTo(base, 10);
  return isMultiple(base, 50) ? base : roundTo(base, 50);
}

function clean(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** One scaled number with the rounding rule of its kind. */
export function roundScaled(value: number, kind: ScaleKind, unit?: Unit | null, scalingUp = false): number {
  if (!(value > 0)) return value;
  switch (kind) {
    case 'pinch':
      return value;
    case 'pieces': {
      if (value < 1) return Math.max(0.25, roundTo(value, 0.25));
      const halves = scalingUp ? Math.ceil(value * 2 - 1e-9) / 2 : roundTo(value, 0.5);
      return clean(Math.max(1, halves));
    }
    case 'spoon': {
      if (value < 4) return Math.max(0.25, roundTo(value, 0.25));
      return clean(roundTo(value, 0.5));
    }
    case 'mass':
    case 'volume': {
      const conv = kind === 'mass' ? (unit?.g ?? 1) : (unit?.ml ?? 1);
      const base = roundBase(value * conv);
      return clean(base / conv);
    }
  }
}

/**
 * A quantity scaled by `factor` and rounded for the kind of unit ("2-3" scales both ends).
 * Pinches and a factor of 1 return the quantity unchanged.
 */
export function scaleQty(q: Qty, factor: number, unit?: Unit | null): Qty {
  const kind = scaleKindOf(unit);
  if (factor === 1 || !(factor > 0) || kind === 'pinch') return q;
  const up = factor > 1;
  const out: Qty = { min: roundScaled(q.min * factor, kind, unit, up) };
  if (q.max !== undefined) {
    const max = roundScaled(q.max * factor, kind, unit, up);
    if (max > out.min) out.max = max;
  }
  if (q.approx) out.approx = true;
  return out;
}
