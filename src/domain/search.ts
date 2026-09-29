// Bilingual recipe search (docs/phase-2-spec.md §3 `search.ts`). Framework-free.
//
// Matches the recipe name in both languages, ingredient ids through the dictionary (typing
// "onion" finds recipes with `ui`), the raw ingredient text of unresolved lines, categories and
// tags. Diacritic-insensitive. Results come grouped: name matches first, then ingredient matches,
// then category/tag matches; a recipe appears in one group only.
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

/** Every term matches the recipe name (nl or en) or one of its aliases. */
export function matchesName(recipe: Recipe, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = [recipe.name.nl, recipe.name.en, ...recipe.aliases].filter((s): s is string => !!s).map(normalizeKey).join(' | ');
  return terms.every((t) => haystack.includes(t));
}

/** Ingredient ids in the dictionary that match a term (both languages). */
function ingredientIds(term: string, dict: Dictionary, lang: Lang): Set<string> {
  return new Set(dict.search(term, lang).map((i) => i.id));
}

/** Every term matches an ingredient line: a resolved id (via the dictionary) or the raw text. */
export function matchesIngredient(recipe: Recipe, terms: readonly string[], dict: Dictionary, lang: Lang): boolean {
  if (terms.length === 0) return false;
  return terms.every((term) => {
    const ids = ingredientIds(term, dict, lang);
    return recipe.lines.some((line) => {
      if (line.kind === 'header') return false;
      if (line.ing && ids.has(line.ing)) return true;
      if (line.alt?.some((a) => a.ing && ids.has(a.ing))) return true;
      return textHas(line.raw.nl, term) || textHas(line.raw.en, term) || textHas(line.name, term);
    });
  });
}

function matchesCategory(recipe: Recipe, terms: readonly string[], dict: Dictionary): boolean {
  if (!recipe.category || terms.length === 0) return false;
  const cat = dict.category(recipe.category);
  const names = [recipe.category, cat?.nl, cat?.en].filter((s): s is string => !!s).map(normalizeKey).join(' | ');
  return terms.every((t) => names.includes(t));
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
  for (const r of recipes) {
    if (matchesName(r, terms)) groups.name.push(r);
    else if (matchesIngredient(r, terms, dict, lang)) groups.ingredient.push(r);
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
