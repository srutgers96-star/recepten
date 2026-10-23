// Bilingual recipe search (docs/phase-2-spec.md §3 `search.ts`). Framework-free.
//
// Matches the recipe name in both languages, ingredient ids through the dictionary (typing
// "onion" finds recipes with `ui`), the raw ingredient text of unresolved lines, categories,
// cuisines (data/cuisines.json, docs/specs/labels-categorieen.md §1b) and tags. Diacritic-insensitive.
// Results come grouped: name matches first, then ingredient matches, then category/tag matches; a
// recipe appears in one group only. One exception to that order: a recipe whose CUISINE matches goes
// to the category group even when an ingredient matches too ("italiaans" puts Spaghetti Bolognese
// under the cuisine heading, not under Italiaanse peterselie); plain category and tag hits keep
// their place after the ingredient group, so "pasta" is unchanged.
import type { Lang, Recipe } from './model.ts';
import type { Dictionary } from './dictionary.ts';
import { normalizeKey } from './dictionary.ts';

export type SearchGroupKind = 'name' | 'ingredient' | 'category' | 'tag';

export interface SearchGroup {
  kind: SearchGroupKind;
  recipes: Recipe[];
}

/** Query terms: normalised words, empty for a blank query. */
export function queryTerms(query: string): string[] {
  return normalizeKey(query).split(' ').filter(Boolean);
}

function textHas(text: string | undefined, term: string): boolean {
  return !!text && normalizeKey(text).includes(term);
}

/**
 * Spelling variants of dish names (normalised: lower case, no diacritics). A recipe named
 * "Dino's Gulyás" must turn up for "goulash", and "shawarma" must find "Shoarma".
 */
const SPELLING_VARIANTS: readonly (readonly string[])[] = [
  ['goulash', 'gulyas', 'goulasch', 'gulasch', 'gulas'],
  ['shoarma', 'shawarma', 'shwarma'],
  ['lasagne', 'lasagna'],
  ['bolognese', 'bolognaise'],
  ['stroganoff', 'stroganov'],
  ['tagine', 'tajine'],
  ['hummus', 'houmous', 'humus', 'hoemoes'],
  ['tzatziki', 'tsatsiki', 'tzaziki'],
  ['chili', 'chilli'],
  ['curry', 'kerrie'],
  ['sate', 'satay', 'satee'],
  ['bami', 'bahmi'],
  ['nasi', 'nassi'],
  ['couscous', 'koeskoes'],
  ['kebab', 'kebap', 'kabab'],
  ['ketjap', 'kecap'],
  ['yoghurt', 'yogurt'],
  ['pannenkoek', 'pannekoek'],
];

/** A term plus its spelling variants. A term of 4+ letters that starts a variant also counts ("goul"). */
export function termVariants(term: string): string[] {
  for (const group of SPELLING_VARIANTS) {
    if (group.some((v) => v === term || (term.length >= 4 && v.startsWith(term)))) return [term, ...group.filter((v) => v !== term)];
  }
  return [term];
}

/** Every term (or one of its spelling variants) matches the recipe name (nl or en) or one of its aliases. */
export function matchesName(recipe: Recipe, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = [recipe.name.nl, recipe.name.en, ...recipe.aliases].filter((s): s is string => !!s).map(normalizeKey).join(' | ');
  return terms.every((t) => termVariants(t).some((v) => haystack.includes(v)));
}

/** Ingredient ids in the dictionary that match a term (both languages). */
function ingredientIds(term: string, dict: Dictionary, lang: Lang): Set<string> {
  return new Set(dict.search(term, lang).map((i) => i.id));
}

/**
 * Every term matches an ingredient line: a resolved id (via the dictionary) or the raw text.
 * `idsPerTerm` (one id set per term, from `ingredientIds`) lets `searchRecipes` scan the
 * dictionary once per query instead of once per recipe.
 */
export function matchesIngredient(recipe: Recipe, terms: readonly string[], dict: Dictionary, lang: Lang, idsPerTerm?: readonly Set<string>[]): boolean {
  if (terms.length === 0) return false;
  return terms.every((term, i) => {
    const ids = idsPerTerm?.[i] ?? ingredientIds(term, dict, lang);
    return recipe.lines.some((line) => {
      if (line.kind === 'header') return false;
      if (line.ing && ids.has(line.ing)) return true;
      if (line.alt?.some((a) => a.ing && ids.has(a.ing))) return true;
      return textHas(line.raw.nl, term) || textHas(line.raw.en, term) || textHas(line.name, term);
    });
  });
}

/** The cuisine id plus its Dutch and English name (normalised), empty without a cuisine. */
function cuisineNames(recipe: Recipe, dict: Dictionary): string[] {
  if (typeof recipe.cuisine !== 'string' || !recipe.cuisine) return [];
  const c = dict.cuisine(recipe.cuisine);
  return [recipe.cuisine, c?.nl, c?.en].filter((s): s is string => !!s).map(normalizeKey);
}

/** Every term matches the recipe's cuisine (id, nl or en name; "italiaans", "italian", "dutch"). No emoji search. */
export function matchesCuisine(recipe: Recipe, terms: readonly string[], dict: Dictionary): boolean {
  if (terms.length === 0) return false;
  const names = cuisineNames(recipe, dict).join(' | ');
  return !!names && terms.every((t) => names.includes(t));
}

/** Every term matches the category (id, nl or en name) or the cuisine ("italiaans pasta"). */
export function matchesCategory(recipe: Recipe, terms: readonly string[], dict: Dictionary): boolean {
  if (terms.length === 0) return false;
  const cat = recipe.category ? dict.category(recipe.category) : undefined;
  const names = [recipe.category, cat?.nl, cat?.en]
    .filter((s): s is string => !!s)
    .map(normalizeKey)
    .concat(cuisineNames(recipe, dict))
    .join(' | ');
  return !!names && terms.every((t) => names.includes(t));
}

function matchesTag(recipe: Recipe, terms: readonly string[]): boolean {
  if (terms.length === 0 || recipe.tags.length === 0) return false;
  const tags = recipe.tags.map(normalizeKey).join(' | ');
  return terms.every((t) => tags.includes(t));
}

/**
 * Grouped search results. A blank query returns every recipe in the `name` group (the caller's
 * own ordering is kept: this function never sorts).
 */
export function searchRecipes(recipes: readonly Recipe[], query: string, dict: Dictionary, lang: Lang): SearchGroup[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return recipes.length ? [{ kind: 'name', recipes: [...recipes] }] : [];
  const groups: Record<SearchGroupKind, Recipe[]> = { name: [], ingredient: [], category: [], tag: [] };
  // One dictionary scan per term for the whole query, not per recipe.
  const idsPerTerm = terms.map((term) => ingredientIds(term, dict, lang));
  for (const r of recipes) {
    if (matchesName(r, terms)) groups.name.push(r);
    // The cuisine jumps ahead of the ingredients (docs/specs/labels-categorieen.md §1b, decision of the critical reader).
    else if (matchesCuisine(r, terms, dict)) groups.category.push(r);
    else if (matchesIngredient(r, terms, dict, lang, idsPerTerm)) groups.ingredient.push(r);
    else if (matchesCategory(r, terms, dict)) groups.category.push(r);
    else if (matchesTag(r, terms)) groups.tag.push(r);
  }
  return (['name', 'ingredient', 'category', 'tag'] as const)
    .filter((k) => groups[k].length > 0)
    .map((k) => ({ kind: k, recipes: groups[k] }));
}

/** Flat list of the grouped results, in group order. */
export function flattenResults(groups: readonly SearchGroup[]): Recipe[] {
  return groups.flatMap((g) => g.recipes);
}
