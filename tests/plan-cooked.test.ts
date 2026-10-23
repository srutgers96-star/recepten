// "Gekookt!" from cook mode (and "✓ Gekookt" for today on the recipe page) with side dishes
// (docs/specs/labels-categorieen.md §1d, 6B block 4): the side follows its main dish, so cooking the
// main ticks its sides too and both leave the shopping list. The pure core of
// `markRecipeCookedInPlan` (src/db/repo.ts); no database is opened here: repo.ts is imported for its
// pure exports only, like tests/share-events.test.ts does.
import { describe, expect, it } from 'vitest';
import { cookRecipeInPlanItems } from '../src/db/repo';
import { newPlanItem, newSideItem, planHash, type PlanItem } from '../src/domain/planner';

const MAIN = 'b:kabeljauw-met-notencrumble';
const PUREE = 'b:aardappelpuree-bij-kabeljauw-met-notencrumble';
const SALSA = 'b:tomatensalsa-bij-kabeljauw-met-notencrumble';
const RATA = 'b:ratatouille';
const POLENTA = 'b:polenta-voor-ratatouille';

const cooked = (items: readonly PlanItem[]) => items.map((p) => [p.recipeId, p.cooked === true]);

describe('cookRecipeInPlanItems', () => {
  const kab = newPlanItem(MAIN, 4);
  const puree = newSideItem(kab, PUREE);
  const salsa = newSideItem(kab, SALSA);
  const rata = newPlanItem(RATA, 2);
  const polenta = newSideItem(rata, POLENTA);
  const items = [kab, puree, salsa, rata, polenta];

  it('ticks the main dish and every side under it, and nothing else', () => {
    const out = cookRecipeInPlanItems(items, MAIN);
    expect(out && cooked(out)).toEqual([
      [MAIN, true],
      [PUREE, true],
      [SALSA, true],
      [RATA, false],
      [POLENTA, false],
    ]);
    // The side keeps its link and its servings; only `cooked` changes.
    expect(out?.[1]).toEqual({ ...puree, cooked: true });
  });

  it('takes the cooked sides off the shopping list (planHash skips cooked items)', () => {
    const after = cookRecipeInPlanItems(items, MAIN) ?? [];
    expect(planHash({ items: after })).not.toBe(planHash({ items }));
    expect(planHash({ items: after })).toBe(planHash({ items: [rata, polenta] }));
  });

  it('ticks every slot of that recipe with its own sides', () => {
    const kab2 = newPlanItem(MAIN, 2);
    const puree2 = newSideItem(kab2, PUREE);
    const out = cookRecipeInPlanItems([kab, puree, kab2, puree2, rata], MAIN);
    expect(out && cooked(out)).toEqual([
      [MAIN, true],
      [PUREE, true],
      [MAIN, true],
      [PUREE, true],
      [RATA, false],
    ]);
  });

  it('cooking a side dish on its own ticks only that side, not its main', () => {
    const out = cookRecipeInPlanItems(items, PUREE);
    expect(out && cooked(out)).toEqual([
      [MAIN, false],
      [PUREE, true],
      [SALSA, false],
      [RATA, false],
      [POLENTA, false],
    ]);
  });

  it('also ticks a side that was left open under an already cooked main', () => {
    const out = cookRecipeInPlanItems([{ ...kab, cooked: true }, puree, rata], MAIN);
    expect(out && cooked(out)).toEqual([
      [MAIN, true],
      [PUREE, true],
      [RATA, false],
    ]);
  });

  it('is undefined (no write) when the recipe is not in the plan or everything is cooked already', () => {
    expect(cookRecipeInPlanItems(items, 'b:hutspot')).toBeUndefined();
    const done = cookRecipeInPlanItems(items, MAIN) ?? [];
    expect(cookRecipeInPlanItems(done, MAIN)).toBeUndefined();
    expect(cookRecipeInPlanItems([], MAIN)).toBeUndefined();
  });
});
