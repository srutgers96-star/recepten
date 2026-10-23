// Receiving a week plan (`#w=`, docs/phase-4-spec.md §1; side dishes: docs/specs/labels-categorieen.md
// §1d/§2d, 6B block 4): the pure core of the Inbox's "Overnemen" / "Toevoegen" (InboxScreen
// `takePlan`). Framework-free: no preact, no dexie; runs in Node (tests) and in the app.
//
// A received item with `sideOfRecipeId` (the `of` of the token: the RECIPE id of its main dish,
// because item ids are local) becomes a side (`sideOf` = the id of the item just made here for that
// recipe), or a plain dish when no item was made for that recipe in this take.
import { newPlanItem, newSideItem, type PlanItem } from './planner.ts';
import type { PlanShare } from './share.ts';

/** One dish of a received plan (`PlanShare.items[]`). */
export type SharedPlanItem = PlanShare['items'][number];

/**
 * The plan slots a received plan adds, in the received order.
 *
 * - `'replace'` ("Overnemen"): every item becomes a slot, as before side dishes existed; `existing`
 *   is ignored (the current plan is thrown away).
 * - `'append'` ("Toevoegen"): `existing` is the current plan; a dish whose recipe is already in it,
 *   or was already added from this share, is skipped (what `addToPlan` did per dish).
 *
 * Side dishes: an item with `sideOfRecipeId` gets `sideOf` = the id of the slot this call made for
 * that recipe (the first one, when the share holds the recipe twice), via `newSideItem` (servings
 * follow the main dish). A main dish that was not made here (unknown and filtered out by the caller,
 * absent from the share, or, on 'append', skipped because it was already in the plan) leaves the side
 * as a plain dish, which then follows the plain-dish rules above. Within one take the same recipe is
 * never a side twice under the same main dish (the rule of `addSideToPlan`); under two different
 * main dishes it may (two times baguette is a real wish).
 */
export function planItemsFromShare(items: readonly SharedPlanItem[], mode: 'replace' | 'append', existing: readonly PlanItem[] = []): PlanItem[] {
  const append = mode === 'append';
  const have = new Set(append ? existing.map((p) => p.recipeId) : []);
  const out: Array<PlanItem | undefined> = new Array(items.length).fill(undefined);
  const mainFor = new Map<string, PlanItem>();

  const plain = (it: SharedPlanItem): PlanItem | undefined => {
    if (append && have.has(it.recipeId)) return undefined;
    have.add(it.recipeId);
    return newPlanItem(it.recipeId, it.servings);
  };

  // Pass 1: the main dishes, so a side finds its main even when the share lists the side first.
  items.forEach((it, i) => {
    if (it.sideOfRecipeId) return;
    const item = plain(it);
    if (!item) return;
    out[i] = item;
    if (!mainFor.has(item.recipeId)) mainFor.set(item.recipeId, item);
  });

  // Pass 2: the side dishes, under the slot just made for their main recipe, else a plain dish.
  const sideKeys = new Set<string>();
  items.forEach((it, i) => {
    if (!it.sideOfRecipeId) return;
    const main = mainFor.get(it.sideOfRecipeId);
    if (!main) {
      out[i] = plain(it);
      return;
    }
    const key = `${main.id}\u0000${it.recipeId}`;
    if (sideKeys.has(key)) return;
    sideKeys.add(key);
    out[i] = newSideItem(main, it.recipeId);
  });

  return out.filter((p): p is PlanItem => p !== undefined);
}

/** The Inbox heading's "N gerechten": main dishes only (spec 6B §1d), i.e. the received items without
 *  `sideOfRecipeId`. */
export function sharedDishCount(items: readonly SharedPlanItem[]): number {
  return items.filter((it) => !it.sideOfRecipeId).length;
}

/** One row of the Inbox preview of a received plan: `side` = shown indented ("↳") under its main. */
export interface SharedPlanRow {
  item: SharedPlanItem;
  side: boolean;
}

/**
 * The rows of the Inbox preview of a received plan, in display order (spec 6B §1d, §6c punt 9: "the
 * side dish is indented under its main dish"): each main dish followed by the side dishes whose
 * `sideOfRecipeId` names its recipe — under the first main of that recipe, like `planItemsFromShare`,
 * and the same recipe once per main. A side dish whose main recipe is not among the received main
 * dishes stays a plain row in its own place (it arrives as a plain dish). Nothing is dropped except
 * such a repeated side.
 */
export function sharedPlanRows(items: readonly SharedPlanItem[]): SharedPlanRow[] {
  const mains = new Set(items.filter((it) => !it.sideOfRecipeId).map((it) => it.recipeId));
  const sidesFor = new Map<string, SharedPlanItem[]>();
  for (const it of items) {
    if (!it.sideOfRecipeId || !mains.has(it.sideOfRecipeId)) continue;
    const list = sidesFor.get(it.sideOfRecipeId) ?? [];
    if (!list.some((s) => s.recipeId === it.recipeId)) list.push(it);
    sidesFor.set(it.sideOfRecipeId, list);
  }
  const rows: SharedPlanRow[] = [];
  const placed = new Set<string>();
  for (const it of items) {
    if (it.sideOfRecipeId) {
      if (!mains.has(it.sideOfRecipeId)) rows.push({ item: it, side: false });
      continue; // a side of a received main is listed under that main
    }
    rows.push({ item: it, side: false });
    if (placed.has(it.recipeId)) continue;
    placed.add(it.recipeId);
    for (const s of sidesFor.get(it.recipeId) ?? []) rows.push({ item: s, side: true });
  }
  return rows;
}
