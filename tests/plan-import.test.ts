// Receiving a week plan with side dishes (docs/specs/labels-categorieen.md §1d/§2d, 6B block 4,
// builder C): the pure core of the Inbox's "Overnemen" / "Toevoegen" (src/domain/plan-import.ts,
// called by InboxScreen `takePlan`). A received item with `sideOfRecipeId` hangs under the slot
// just made for that recipe, else it becomes a plain dish.
import { describe, expect, it } from 'vitest';
import { planItemsFromShare, sharedDishCount, sharedPlanRows, type SharedPlanItem } from '../src/domain/plan-import';
import { newPlanItem, newSideItem, type PlanItem } from '../src/domain/planner';
import { buildPlanEnvelope, parseEnvelope } from '../src/domain/share';
import { FROZEN_ENVELOPE_W_SIDE } from './fixtures/frozen-share-tokens';

const MAIN = 'b:kabeljauw-met-notencrumble';
const PUREE = 'b:aardappelpuree-bij-kabeljauw-met-notencrumble';
const SALSA = 'b:tomatensalsa-bij-kabeljauw-met-notencrumble';
const RATA = 'b:ratatouille';
const POLENTA = 'b:polenta-voor-ratatouille';

function main(recipeId: string, servings = 4): SharedPlanItem {
  return { recipeId, servings };
}
function side(recipeId: string, of: string, servings = 4): SharedPlanItem {
  return { recipeId, servings, sideOfRecipeId: of };
}
/** The slot of `recipeId` in `items` (the first one). */
function slot(items: readonly PlanItem[], recipeId: string): PlanItem {
  const found = items.find((p) => p.recipeId === recipeId);
  if (!found) throw new Error(`no slot for ${recipeId}`);
  return found;
}

describe("planItemsFromShare 'replace'", () => {
  it('makes a plain slot for every item without a side dish, keeping order and servings', () => {
    const out = planItemsFromShare([main(MAIN, 4), main(RATA, 2)], 'replace');
    expect(out.map((p) => [p.recipeId, p.servings])).toEqual([
      [MAIN, 4],
      [RATA, 2],
    ]);
    for (const p of out) {
      expect(p.id).toMatch(/^pi:/);
      expect(p.sideOf).toBeUndefined();
      expect(p.cooked).toBeUndefined();
      expect(p.locked).toBeUndefined();
    }
    expect(new Set(out.map((p) => p.id)).size).toBe(2);
  });

  it('gives a side dish sideOf = the id of the slot just made for its main recipe', () => {
    const out = planItemsFromShare([main(MAIN, 3), side(PUREE, MAIN, 3), main(RATA, 4), side(POLENTA, RATA, 4)], 'replace');
    expect(out).toHaveLength(4);
    expect(slot(out, MAIN).sideOf).toBeUndefined();
    expect(slot(out, RATA).sideOf).toBeUndefined();
    expect(slot(out, PUREE).sideOf).toBe(slot(out, MAIN).id);
    expect(slot(out, POLENTA).sideOf).toBe(slot(out, RATA).id);
  });

  it('lets the side follow the servings of its main dish (newSideItem)', () => {
    const out = planItemsFromShare([main(MAIN, 6), side(PUREE, MAIN, 2)], 'replace');
    expect(slot(out, PUREE).servings).toBe(6);
  });

  it('finds the main dish when the share lists the side first, and keeps the received order', () => {
    const out = planItemsFromShare([side(PUREE, MAIN), main(MAIN)], 'replace');
    expect(out.map((p) => p.recipeId)).toEqual([PUREE, MAIN]);
    expect(out[0]?.sideOf).toBe(out[1]?.id);
  });

  it('turns a side whose main recipe is not in this take into a plain dish with its own servings', () => {
    // The caller filters out unknown recipes first; the main dish then is simply absent.
    const out = planItemsFromShare([main(RATA, 4), side(PUREE, MAIN, 2)], 'replace');
    expect(out.map((p) => p.recipeId)).toEqual([RATA, PUREE]);
    expect(slot(out, PUREE).sideOf).toBeUndefined();
    expect(slot(out, PUREE).servings).toBe(2);
  });

  it('never makes a side of a side: a main recipe that only came as a side leaves the item plain', () => {
    const out = planItemsFromShare([main(MAIN), side(PUREE, MAIN), side(SALSA, PUREE)], 'replace');
    expect(slot(out, PUREE).sideOf).toBe(slot(out, MAIN).id);
    expect(slot(out, SALSA).sideOf).toBeUndefined();
  });

  it('adds the same side once under the same main dish, and under two main dishes both times', () => {
    const once = planItemsFromShare([main(MAIN), side(PUREE, MAIN), side(PUREE, MAIN)], 'replace');
    expect(once.filter((p) => p.recipeId === PUREE)).toHaveLength(1);

    const twice = planItemsFromShare([main(MAIN), main(RATA), side(PUREE, MAIN), side(PUREE, RATA)], 'replace');
    const purees = twice.filter((p) => p.recipeId === PUREE);
    expect(purees.map((p) => p.sideOf)).toEqual([slot(twice, MAIN).id, slot(twice, RATA).id]);
  });

  it('ignores the current plan', () => {
    const existing = [newPlanItem(MAIN, 4)];
    const out = planItemsFromShare([main(MAIN), side(PUREE, MAIN)], 'replace', existing);
    expect(out.map((p) => p.recipeId)).toEqual([MAIN, PUREE]);
    expect(slot(out, MAIN).id).not.toBe(existing[0]?.id);
    expect(slot(out, PUREE).sideOf).toBe(slot(out, MAIN).id);
  });

  it('returns nothing for an empty share', () => {
    expect(planItemsFromShare([], 'replace')).toEqual([]);
    expect(planItemsFromShare([], 'append', [newPlanItem(MAIN)])).toEqual([]);
  });
});

describe("planItemsFromShare 'append'", () => {
  it('adds a new main dish with its side under the slot just made', () => {
    const existing = [newPlanItem(RATA, 4)];
    const out = planItemsFromShare([main(MAIN, 2), side(PUREE, MAIN, 2)], 'append', existing);
    expect(out.map((p) => p.recipeId)).toEqual([MAIN, PUREE]);
    expect(slot(out, PUREE).sideOf).toBe(slot(out, MAIN).id);
    expect(slot(out, PUREE).servings).toBe(2);
  });

  it('skips a dish whose recipe is already in the plan, as addToPlan did', () => {
    const existing = [newPlanItem(MAIN, 4)];
    const out = planItemsFromShare([main(MAIN), main(RATA)], 'append', existing);
    expect(out.map((p) => p.recipeId)).toEqual([RATA]);
  });

  it('adds a recipe that the share holds twice only once', () => {
    const out = planItemsFromShare([main(RATA, 4), main(RATA, 2)], 'append', []);
    expect(out.map((p) => [p.recipeId, p.servings])).toEqual([[RATA, 4]]);
  });

  it('makes the side a plain dish when its main dish was already in the plan (no slot was made for it)', () => {
    const existing = [newPlanItem(MAIN, 4)];
    const out = planItemsFromShare([main(MAIN), side(PUREE, MAIN, 3)], 'append', existing);
    expect(out.map((p) => p.recipeId)).toEqual([PUREE]);
    expect(out[0]?.sideOf).toBeUndefined();
    expect(out[0]?.servings).toBe(3);
  });

  it('skips such a plain-dish side when its recipe is already in the plan', () => {
    const existingMain = newPlanItem(MAIN, 4);
    const existing = [existingMain, newSideItem(existingMain, PUREE)];
    expect(planItemsFromShare([main(MAIN), side(PUREE, MAIN)], 'append', existing)).toEqual([]);
  });

  it('still hangs a side under a NEW main dish when that side already sits under another one', () => {
    const existingMain = newPlanItem(RATA, 4);
    const existing = [existingMain, newSideItem(existingMain, PUREE)];
    const out = planItemsFromShare([main(MAIN), side(PUREE, MAIN)], 'append', existing);
    expect(out.map((p) => p.recipeId)).toEqual([MAIN, PUREE]);
    expect(slot(out, PUREE).sideOf).toBe(slot(out, MAIN).id);
  });

  it('never touches the existing items', () => {
    const existing = [newPlanItem(RATA, 4)];
    const before = JSON.stringify(existing);
    planItemsFromShare([main(MAIN), side(PUREE, MAIN), main(RATA)], 'append', existing);
    expect(JSON.stringify(existing)).toBe(before);
  });
});

describe('sharedDishCount', () => {
  it('counts the received items without sideOfRecipeId (the Inbox heading)', () => {
    expect(sharedDishCount([])).toBe(0);
    expect(sharedDishCount([main(MAIN), side(PUREE, MAIN), side(SALSA, MAIN), main(RATA)])).toBe(2);
  });
});

describe('a shared plan with a side dish, end to end (buildPlanEnvelope → parseEnvelope → planItemsFromShare)', () => {
  it('arrives as the same main dish with the same side under it', () => {
    const sentMain = newPlanItem(MAIN, 3);
    const sentSide = newSideItem(sentMain, PUREE);
    const env = buildPlanEnvelope({ id: 'current', items: [sentMain, sentSide], updatedAt: 'x' }, [], { by: 'Stijn', userIngredients: [] });
    const share = parseEnvelope(env).plan;
    expect(share).toBeDefined();
    const items = share?.items ?? [];
    expect(sharedDishCount(items)).toBe(1);
    const out = planItemsFromShare(items, 'replace');
    expect(out.map((p) => [p.recipeId, p.servings])).toEqual([
      [MAIN, 3],
      [PUREE, 3],
    ]);
    expect(slot(out, PUREE).sideOf).toBe(slot(out, MAIN).id);
    // Item ids are local: the receiver makes its own.
    expect(slot(out, MAIN).id).not.toBe(sentMain.id);
  });
});

describe('sharedPlanRows (the Inbox preview: a side dish indented under its main)', () => {
  /** [recipeId, side] per row, the shape the Inbox renders. */
  const shape = (items: readonly SharedPlanItem[]) => sharedPlanRows(items).map((r) => [r.item.recipeId, r.side]);

  it('lists a plan without side dishes unchanged, every row plain', () => {
    expect(shape([main(MAIN), main(RATA)])).toEqual([
      [MAIN, false],
      [RATA, false],
    ]);
  });

  it('puts the sides directly under their main, also when the share lists a side first', () => {
    expect(shape([side(POLENTA, RATA), main(MAIN), side(PUREE, MAIN), main(RATA), side(SALSA, MAIN)])).toEqual([
      [MAIN, false],
      [PUREE, true],
      [SALSA, true],
      [RATA, false],
      [POLENTA, true],
    ]);
  });

  it('keeps a side whose main is not in the share as a plain row in its own place', () => {
    expect(shape([main(RATA), side(PUREE, MAIN)])).toEqual([
      [RATA, false],
      [PUREE, false],
    ]);
  });

  it('hangs the sides under the first main of a recipe that is in the share twice, and a side once per main', () => {
    expect(shape([main(MAIN, 4), main(MAIN, 2), side(PUREE, MAIN), side(PUREE, MAIN)])).toEqual([
      [MAIN, false],
      [PUREE, true],
      [MAIN, false],
    ]);
  });

  it('shows the frozen W_SIDE envelope as the kabeljauw with the puree indented under it', () => {
    const share = parseEnvelope(FROZEN_ENVELOPE_W_SIDE).plan;
    expect(shape(share?.items ?? [])).toEqual([
      [MAIN, false],
      [PUREE, true],
    ]);
  });
});
