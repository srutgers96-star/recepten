// Diet tags and editor meta suggestions derived from the ingredients (docs/phase-5-spec.md block
// A.2, PLAN.md §0 "Dieet-categorieën" / "Categorie & dieet in de editor"). Framework-free.
//
//   dietTags(lines, dict)   -> { vegetarisch, vegan, glutenvrij, unsure, unresolved }
//   suggestMeta(recipe, dict) -> { category?, tags, unsure }
//   applyDietTags(recipe, dict) -> the recipe with the three fact-based tags set/removed
//
// Facts come from the dictionary flags: `veg` (vegetarian), `vegan`, `gluten` (+ `glutenUnsure`).
// A recipe is vegetarian when no resolved ingredient has veg false, vegan when every resolved
// ingredient has vegan true, gluten-free when none has gluten true. A contradiction is a fact
// (false, never "unsure"). A line the dictionary cannot judge — `ing` null, an id this dictionary
// does not know, or a missing / unsure flag — makes the answer for that dimension "unsure": the
// tag is still suggested (true) when nothing contradicts it, and its name is listed in `unsure`
// so the UI can say "waarschijnlijk" / "probably". Optional and garnish lines count like any
// other line (a recipe with optional Parmesan is not vegan); alternatives ("of kabeljauw") are
// not consulted, only the main ingredient of a line. A "plantaardige" / "vegetarische" qualifier
// on the line overrides the ingredient's veg/vegan flags (DIET_QUALIFIERS below).
import type { Line, Recipe } from './model.ts';
import type { Dictionary, Ingredient } from './dictionary.ts';

export type DietTag = 'vegetarisch' | 'vegan' | 'glutenvrij';

export const DIET_TAGS: readonly DietTag[] = ['vegetarisch', 'vegan', 'glutenvrij'];

export interface DietTags {
  /** True (sure or probable, see `unsure`), false (a resolved ingredient contradicts it), or absent (nothing to judge). */
  vegetarisch?: boolean;
  vegan?: boolean;
  glutenvrij?: boolean;
  /** The dimensions whose true answer rests on lines the dictionary could not judge. */
  unsure: DietTag[];
  /** The lines that could not be judged (their name part or raw text), for "why unsure". */
  unresolved: string[];
}

export interface MetaSuggestion {
  /** A categories.json id, or absent when nothing in the name or the ingredients points at one. */
  category?: string;
  /** Diet tags (sure and probable) plus 'snel' / 'oven' / 'wok' from time, steps and name. */
  tags: string[];
  /** The diet tags among `tags` that are only probable. */
  unsure: DietTag[];
}

type Verdict = { contradicted: boolean; unknown: boolean };

function newVerdict(): Verdict {
  return { contradicted: false, unknown: false };
}

/**
 * Qualifiers that change the diet facts of a line's ingredient (data/qualifiers.json ids, kept by
 * the parser in `line.qual`): "plantaardige room" is plant-based whatever `room` says; "vegetarische
 * worst" is vegetarian, and whether it is also vegan is then unknown rather than contradicted.
 */
const DIET_QUALIFIERS: Record<string, { vegan: boolean }> = {
  plantaardige: { vegan: true },
  vegetarische: { vegan: false },
};

/**
 * The ingredient of a line as far as this dictionary knows it (an unknown id counts as unresolved),
 * with its `veg` / `vegan` flags adjusted for a diet qualifier on the line.
 */
function ingredientOf(line: Line, dict: Dictionary): Ingredient | undefined {
  const ing = line.ing ? dict.get(line.ing) : undefined;
  if (!ing) return undefined;
  let out = ing;
  for (const id of line.qual ?? []) {
    const q = DIET_QUALIFIERS[id];
    if (!q) continue;
    out = { ...out, veg: true };
    if (q.vegan) out.vegan = true;
    else if (out.vegan === false) delete out.vegan;
  }
  return out;
}

function lineLabel(line: Line): string {
  const name = typeof line.name === 'string' ? line.name.trim() : '';
  if (name) return name;
  return (line.raw?.nl ?? line.raw?.en ?? '').trim();
}

/** Every line that is an ingredient (headers left out). */
function ingredientLines(lines: readonly Line[]): Line[] {
  return lines.filter((l) => l.kind !== 'header');
}

/** Vegetarian / vegan / gluten-free facts over a recipe's lines. */
export function dietTags(lines: readonly Line[], dict: Dictionary): DietTags {
  const v: Record<DietTag, Verdict> = { vegetarisch: newVerdict(), vegan: newVerdict(), glutenvrij: newVerdict() };
  const unresolved: string[] = [];
  let judged = 0;

  for (const line of ingredientLines(lines)) {
    const ing = ingredientOf(line, dict);
    if (!ing) {
      unresolved.push(lineLabel(line));
      for (const tag of DIET_TAGS) v[tag].unknown = true;
      continue;
    }
    judged++;
    if (ing.veg === false) {
      v.vegetarisch.contradicted = true;
      v.vegan.contradicted = true;
    }
    if (ing.vegan === false) v.vegan.contradicted = true;
    else if (ing.vegan !== true) v.vegan.unknown = true;
    if (ing.gluten === true) v.glutenvrij.contradicted = true;
    else if (ing.gluten !== false || ing.glutenUnsure === true) v.glutenvrij.unknown = true;
  }

  const out: DietTags = { unsure: [], unresolved };
  for (const tag of DIET_TAGS) {
    const { contradicted, unknown } = v[tag];
    if (contradicted) out[tag] = false;
    else if (judged > 0) {
      out[tag] = true;
      if (unknown) out.unsure.push(tag);
    } else if (unknown) out.unsure.push(tag);
  }
  return out;
}

/**
 * `recipe.tags` with the three fact-based diet tags set (sure true) or removed (sure false);
 * unsure dimensions keep whatever the recipe had, and every other tag ("vega-optie", "snel", …)
 * is untouched. Order: existing tags in their order, new diet tags appended.
 */
export function applyDietTags(recipe: Pick<Recipe, 'lines' | 'tags'>, dict: Dictionary): string[] {
  const facts = dietTags(recipe.lines, dict);
  const current = Array.isArray(recipe.tags) ? recipe.tags : [];
  const tags = current.filter((t) => !(DIET_TAGS as readonly string[]).includes(t) || facts[t as DietTag] !== false);
  for (const tag of DIET_TAGS) {
    if (facts[tag] === true && !facts.unsure.includes(tag) && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

// --- category heuristics ---------------------------------------------------------------------

const PASTA_RE = /(?:^|-)(?:pasta|spaghetti|penne|tagliatelle|lasagne|lasagnebladen|macaroni|fusilli|farfalle|linguine|pappardelle|rigatoni|tortellini|ravioli|gnocchi|cannelloni|bavette|orzo|fettuccine|orecchiette|conchiglie|vermicelli)(?:$|-)|macaroni$|tortellini$/;
const NOODLE_RE = /(?:^|-)(?:mie|noedels?|noodles?|ramen|udon|soba|bami)(?:$|-)|mie$/;
const RICE_RE = /(?:^|-)(?:rijst|risotto|risottorijst|basmati|couscous|bulgur|quinoa)(?:$|-)|rijst$/;
const FISH_RE = /(?:^|-)(?:vis|zalm|kabeljauw|schelvis|tonijn|makreel|garnaal|garnalen|gamba|gambas|scampi|forel|haring|mosselen?|inktvis|koolvis|pangasius|tilapia|sardines?|surimi|krab|kreeft|schol|zeebaars|wijting|heilbot|dorade|calamares|coquilles?|zeevruchten|visstick|vissticks)(?:$|-)|(?:zalm|vis|tonijn|kabeljauw|schelvis|garnaal|makreel)[a-z]*$/;
/** Products that only taste of fish (a sauce, a paste) do not make a fish dish. */
const NOT_A_FISH_RE = /(?:saus|pasta|trassi|fond|bouillon|olie)$/;

function isPastaId(id: string): boolean {
  return PASTA_RE.test(id) && !/saus$/.test(id);
}

function isNoodleId(id: string): boolean {
  return NOODLE_RE.test(id);
}

function isRiceId(id: string): boolean {
  return RICE_RE.test(id) && !/(?:azijn|papier|wijn|melk|olie|bloem|noedel)/.test(id);
}

function isFish(ing: Ingredient): boolean {
  return ing.veg === false && FISH_RE.test(ing.id) && !NOT_A_FISH_RE.test(ing.id);
}

function isMeat(ing: Ingredient): boolean {
  return ing.veg === false && ing.aisle === 'vlees-vis' && !isFish(ing);
}

function foldName(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * The category a recipe's name and ingredients point at (docs/phase-5-spec.md A.2): name words
 * first (soep, salade, taart/quiche, stamppot, wok/roerbak/noedels, oven/gratin/schotel), then
 * the ingredients (pasta → pasta, rijst/couscous → rijst, fish without meat → vis, meat → vlees).
 * Undefined when nothing matches; the caller keeps the current category then.
 */
export function suggestCategory(recipe: Pick<Recipe, 'name' | 'lines'>, dict: Dictionary): string | undefined {
  const name = foldName(`${recipe.name?.nl ?? ''} ${recipe.name?.en ?? ''}`);
  const has = (re: RegExp) => re.test(name);
  const ings = ingredientLines(recipe.lines).map((l) => ingredientOf(l, dict)).filter((i): i is Ingredient => !!i);
  const pasta = ings.some((i) => isPastaId(i.id));
  const noodles = ings.some((i) => isNoodleId(i.id));
  const rice = ings.some((i) => isRiceId(i.id));
  const fish = ings.some(isFish);
  const meat = ings.some(isMeat);

  const riceName = /rijst|risotto|\brice\b|couscous|nasi|paella|pilaf/;
  const fishName = /\bvis|zalm|tonijn|kabeljauw|schelvis|garnal|makreel|forel|\bfish\b|salmon|tuna|\bcod\b|haddock|prawn|shrimp|mackerel|trout/;

  if (has(/soep\b|\bsoup\b/)) return 'soep';
  if (has(/salade|\bsalad\b|\bslaw\b/)) return 'salade';
  if (has(/taart|quiche|\bpie\b|\btart\b|flammkuchen/)) return 'hartige-taart';
  // Not `puree`/`mash`: "Aardappelpuree (bij kabeljauw …)" or "Zalm met doperwtenpuree" are a side
  // dish or a fish dish, not a stamppot.
  if (has(/stamppot|\bstamp\b|stampot|hutspot/)) return 'stamppot';
  if (has(riceName) && has(/roerbak|roergebakken|stir-?fr/)) return 'rijst';
  if (has(/\bwok|roerbak|roergebakken|stir-?fr|noedels?|noodles?|\bmie\b|\bbami\b|ramen/)) return 'wok-noedels';
  if (pasta || has(/\bpasta\b|spaghetti|macaroni|lasagne|tagliatelle|penne|fusilli|tortellini|gnocchi|linguine|rigatoni|farfalle|pappardelle|cannelloni/)) return 'pasta';
  if (has(fishName) && !meat) return 'vis';
  if (has(/\boven\b|gratin|schotel|\bbake\b|\bbaked\b|casserole|\broast\b|croute|croûte|bladerdeeg|tortilla\b|omelet|frittata|moussaka/)) return 'oven';
  if (rice || has(riceName)) return 'rijst';
  if (noodles) return 'wok-noedels';
  if (fish && !meat) return 'vis';
  if (meat) return 'vlees';
  return undefined;
}

const OVEN_STEP_RE = /\boven\b|°\s?c\b|graden|\bgrill|gratineer|gratin|bak(?:je|t|ken)?\s+(?:het|de|ze|hem|in)\s+(?:de\s+)?oven|\bbake\b|\broast\b/iu;
const WOK_STEP_RE = /\bwok|roerbak|roerbakken|stir-?fry/iu;

function stepText(recipe: Pick<Recipe, 'steps'>): string {
  return (recipe.steps ?? []).map((s) => `${s.text?.nl ?? ''} ${s.text?.en ?? ''}`).join('\n');
}

/** "snel": time.total ≤ 30 minutes, or at most 3 short steps (≤ 400 characters in all). */
export function isQuick(recipe: Pick<Recipe, 'time' | 'steps'>): boolean {
  const total = recipe.time?.total;
  if (typeof total === 'number' && total > 0) return total <= 30;
  const steps = recipe.steps ?? [];
  if (steps.length === 0 || steps.length > 3) return false;
  const chars = steps.reduce((n, s) => n + (s.text?.nl ?? s.text?.en ?? '').length, 0);
  return chars <= 400;
}

/**
 * Category and tags to propose for a recipe (the editor pre-fills them, "Controleer mijn
 * recepten" compares them with the current ones). Diet tags come from `dietTags` (probable ones
 * are listed in `unsure`); 'snel', 'oven' and 'wok' from time, steps and name. Tags the heuristic
 * has no opinion about ('kids', 'wereld', '-optie', …) are never in the answer: the caller keeps
 * them.
 */
export function suggestMeta(recipe: Pick<Recipe, 'name' | 'lines' | 'steps' | 'time'>, dict: Dictionary): MetaSuggestion {
  const diet = dietTags(recipe.lines, dict);
  const tags: string[] = [];
  for (const tag of DIET_TAGS) if (diet[tag] === true) tags.push(tag);
  if (isQuick(recipe)) tags.push('snel');
  const steps = stepText(recipe);
  const name = foldName(`${recipe.name?.nl ?? ''} ${recipe.name?.en ?? ''}`);
  if (OVEN_STEP_RE.test(steps) || /\boven\b|gratin|ovenschotel/.test(name)) tags.push('oven');
  if (WOK_STEP_RE.test(steps) || /\bwok|roerbak|roergebakken|stir-?fr/.test(name)) tags.push('wok');
  const out: MetaSuggestion = { tags, unsure: diet.unsure };
  const category = suggestCategory(recipe, dict);
  if (category) out.category = category;
  return out;
}

/** Tags the heuristics decide about; everything else on a recipe is the user's (or the LLM's). */
export const SUGGESTED_TAGS: readonly string[] = [...DIET_TAGS, 'snel', 'oven', 'wok'];
