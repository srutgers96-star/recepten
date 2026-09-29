# Phase 4 — "Kies N & boodschappen" — build spec

Goal (PLAN.md §8, §10 phase 4, decisions §0 "Weekplanner", "Boodschappenlijst", "Gangpaden"): the family
ritual — pick the dishes for the coming days, get one shopping list, tick it off in the shop, share it —
built on the structured lines and the dictionary. No days, no server.

Decisions that bind (PLAN.md §0):
- The plan is a **free list of 1..N dishes, no days**. "Kies N" with three kinds of randomness: all
  slots, one slot, one slot **within a filter** (category chips / vegetarisch / snel / a search query — the
  filtered recipe set is the pool). "Verras me" rules: max 2 pasta, max 2 rijst, ≥ 1 vegetarisch when N ≥ 4,
  nothing cooked in the last 6 weeks (cookLog), no duplicates; per slot reroll and lock.
- **Proto list before confirming**: every quantity computed, per item − / + (step: pieces 1; g 10 under
  100, 25 under 500, 50 above; ml 10 / 50 / 100 likewise; spoons ½); staples (zout, peper, olie, boter,
  suiker, bloem, azijn, sojasaus, bouillon, dried herbs) start at **0** and are shown small — tap to set
  to 1 ("even meenemen"); loose items can be added (autocomplete over the dictionary + previous extras;
  unknown → creates a user ingredient via the picker); then "Maak de lijst".
- **One standard aisle order for everyone**, `data/aisles.json` order, including aisles without recipe
  ingredients (ontbijt/beleg, dranken, snacks, huishoudelijk, drogisterij) so the list works as a plain
  weekly shopping list too (extras land in their aisle; "elke week" pins items).
- Servings default 4 per slot (household size setting `household.servings`, default 4).
- Filter chips (Kies N sheet, Verras me, Recipes list) are **generic over the tags present in the data** (plus categories): a new tag such as `glutenvrij` or `vegan` (planned) must appear without code changes — read the tag ids from the recipes and label them via i18n with a fallback to the id.

## 1. Domain — CONTRACT (`src/domain/`, framework-free, unit-tested)

`planner.ts`
```ts
export interface PlanItem { id: string; recipeId: string; servings: number; locked?: boolean; cooked?: boolean; addedAt: string }
export interface Plan { id: 'current'; items: PlanItem[]; updatedAt: string; note?: string }
export interface PickOptions { count: number; pool: Recipe[]; recentIds: Set<string> /* cooked in last 6 weeks */; existing: PlanItem[]; rng?: () => number }
export function pickRecipes(o: PickOptions): Recipe[]      // variation rules above; never duplicates existing; falls back gracefully when the pool is small
export function planHash(plan: Plan): string                // stable hash of recipeId+servings pairs — the list's "generatedFrom"
```

`aggregate.ts` (PLAN.md §8 "Merge-algoritme", one unit test per rule; worked examples from the plan)
```ts
export type ListSection = 'main' | 'inHouse' | 'staples' | 'check'
export interface ListSource { recipeId: string; name: Text; raw: string; scaled: string }
export interface ListItem {
  key: string;                 // 'ing|variant|unitGroup' or 'x|<manual id>' or 'raw|<recipeId>|<index>'
  ing?: string | null; variant?: string | null; qualifiers?: string[];
  qty?: number | null; unit?: string | null;   // display unit after folding (buyUnit when known)
  baseQty?: number | null; baseUnit?: 'g' | 'ml' | 'stuk' | string | null;
  aisle: string; section: ListSection;
  sources: ListSource[];
  checked?: boolean; inHouse?: boolean; manual?: boolean; pinned?: boolean; adjusted?: number | null /* user −/+ delta in display units */;
  label?: Text;                // manual items without a dictionary id
}
export interface AggregateInput { plan: Plan; recipes: Map<string, Recipe>; lines: (recipeId: string) => Line[]; dict: Dictionary; pantry: Set<string> /* ing ids in house */; extras: ListItem[]; previous?: ListItem[] /* keep checks/inHouse/adjusted by key */ }
export function aggregate(i: AggregateInput): ListItem[]
export function renderListItem(it: ListItem, dict: Dictionary, lang: Lang): string   // "4 uien (1 grote)" / "7 cloves garlic (≈1 bulb)"
export function listAsText(items: ListItem[], dict: Dictionary, lang: Lang, opts: { title: string; hideChecked?: boolean; hideInHouse?: boolean }): string   // PLAN.md §8 "Delen van de lijst" format, ☐ per line, aisle headers, "Controleer zelf" last, dishes at the bottom
export function adjustStep(unit: string | null, qty: number): number   // the − / + step rule above
export function roundForDisplay(qty: number, unit: string | null, dict: Dictionary): number  // PLAN.md §8 step 5
```
Rules recap: skip cooked/locked? (no — cooked items stay in the plan but are excluded from the list once
`cooked`); factor = item.servings / recipe.servings; unresolved lines (ing null) → section `check`, raw ×N,
never scaled; qty = max ?? min; `null` qty → "pm" (no number); scaling then base unit via units.json (g/ml/
stuk; package units count per piece); key = ing | variant (qualifier ids with `variant: true`) | unit group;
sum per key; fold across groups towards `buyUnit` via `gramsPer`/`buy.per` (teen→bol per 10, stuk↔g when
gramsPer known); rounding table for display; routing: pantry has ing → `inHouse`; staple → `staples`
(qty 0 unless the user adjusted); unresolved → `check`; else `main`; group by aisle in data order; keep
`checked/inHouse/adjusted` from `previous` by key; vanished keys drop unless manual/pinned; new keys are
flagged `new` (via a returned side channel or a `fresh?: boolean` field).

`share.ts` (extend): envelope `t: 'w'` — `w: { items: [{ rid, srv }], recipes: Recipe[] /* own recipes the partner may lack */, note?: string }`;
`buildPlanEnvelope(plan, recipes, ctx)`, `parseEnvelope` returns `kind: 'plan'` with `plan` and `recipes`.
Frozen `#w=` token in tests. Merge: a received plan is offered in the Inbox as "Weekplan van <naam>: N
gerechten" with **Overnemen** (replace current plan) or **Toevoegen** (append missing); the embedded
recipes go through the normal import plan.

## 2. Database & repo — CONTRACT

Dexie **version 5**: `plans: 'id'` (one row 'current'), `lists: 'id'` (one row 'current': `{ id, items: ListItem[], generatedFrom: string, generatedAt, extras: ListItem[], pinned: string[] /* keys */, updatedAt }`), `pantry: 'ing'` (`{ ing, until?: string }`), settings `household.servings`.
Repo additions: `getPlan()`, `savePlan(plan)`, `addToPlan(recipeId, servings?)`, `removeFromPlan(itemId)`, `setPlanServings(itemId, n)`, `togglePlanLock(itemId)`, `markPlanCooked(itemId, cooked)` (also called by "Gekookt!" when the recipe is in the plan), `clearPlan()`; `getList()`, `saveList(list)`, `generateList(): Promise<List>` (aggregate over the current plan with pantry + extras + previous list), `setListItem(key, patch)`, `addExtra(item)`, `removeExtra(key)`, `togglePinned(key)`, `clearChecks()`; `listPantry()`, `setInHouse(ing, on)`; `isListStale(): Promise<boolean>` (plan hash ≠ list.generatedFrom). Backup bundle includes plans/lists/pantry.

## 3. Screens & navigation

**Bottom nav (5)** becomes **Home · Recepten · Week · Boodschappen · Meer**. "Toevoegen" moves to a **+**
button in the Recepten header (and the Home "Eigen & ontvangen" card); **Inbox** moves under Meer (first
row, with the unseen badge) and keeps its Home card when there is something unseen. Routes: `/week`,
`/shopping`, `/inbox` unchanged, `/add` unchanged.

**Week (`/week`)** — hero when empty: big **Kies N** (N stepper 1..14, default 7) → multi-select sheet
with search + category/vegetarisch/snel chips, sort "lang niet gegeten" first (cookLog), counter x/N,
"Verras me" fills the remaining slots with `pickRecipes`; the list of slots: name (active language),
servings stepper, lock, reroll (🎲, honours lock + active filter of the sheet), remove, "Gekookt" tick
(strikes through; also set by cook mode's Gekookt!). Header actions: "Verras me" (all unlocked),
"Boodschappenlijst maken" (primary, → `/shopping` proto step), "Deel weekplan" (`#w=` token via
navigator.share({text}); wa.me fallback), "Leeg". Recipe detail gets **"+ Deze week"** (with servings =
household default) and shows "staat in je week" when present.

**Boodschappen (`/shopping`)** — three states:
1. *No list yet / stale*: card "Weekplan: N gerechten" + **Maak de lijst** (→ proto). With no plan the
   screen is a plain list (extras + pinned) with an add field — the all-in shopping list.
2. *Proto list* (after Maak de lijst, before confirming): grouped by aisle, each row `[−] qty unit name [+]`
   with the sources on tap ("Waarvoor is dit?": 3 uien — 2× Pasta met spek, 1× Erwtensoep); staples at 0 in a
   small "Voorraad" block (tap → 1); "Controleer zelf" block for unresolved lines; add field for extras
   (autocomplete; new → IngredientPicker "Nieuw ingrediënt"); **Bevestig lijst**.
3. *The list*: aisle sections in the standard order (collapsible, counter, collapse when complete), tap =
   check (strike-through, stays in place), "Verberg afgevinkt", undo snackbar, long-press → Heb ik al (in
   huis; hidden from the shared text; remembered in pantry for 21 days for non-perishables) / Aantal
   aanpassen / Waarvoor is dit? / Verwijder / Elke week (pin); extras field always visible; **stale
   banner** "Weekplan gewijzigd — Bijwerken" (regenerate keeping checks) — never auto; "Deel lijst"
   (plain text NL/EN choice, `navigator.share({text})`, Kopieer fallback) with "gedeeld om hh:mm" and
   "gewijzigd sinds delen"; "Klaar" (clear checks, keep plan + pinned); wake lock while the screen is open
   ("winkelstand" toggle).

**Home**: "Deze week" card replaces the teaser: names of the plan (max 5 + "+N"), "Boodschappenlijst"
button; empty → "Kies 7 voor deze week" hero link. **Inbox**: handles `#w=` (see §1).

**Storage**: counters for plan/list/pantry; backup includes them.

## 4. Non-negotiables

CLAUDE.md invariants; no new dependencies; NL + EN for every string; 44 px targets; `navigator.share`
single field; `npm run check`, `npm test`, `npm run build`, `npm run build:next`, `npm run validate:data`
green. Tests: `tests/aggregate.test.ts` (every rule + the four worked examples from PLAN.md §8:
knoflook 6½ teentjes → "7 teentjes knoflook (≈1 bol)", uien "4 uien (1 grote)" with rode ui separate,
tomaten 15 stuks with blik separate, boter → Voorraadcheck ≈ 80 g; rode peper never black pepper),
`tests/planner.test.ts` (variation rules, locks, small pools), `tests/share.test.ts` (`#w=`).
`docs/DEVICE-TEST.md`: phase-4 rows (Kies 7 → lijst → delen → afvinken; plan sharing to the iPhone).
