import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultDictionary } from '../src/domain/data';
import type { Recipe } from '../src/domain/model';
import { matchesCategory, matchesCuisine, matchesName, queryTerms, searchRecipes, termVariants, type SearchGroup } from '../src/domain/search';
import { BUILTIN_TIMESTAMP, type RecipesFile } from '../tools/migrate-from-recepten2.ts';

function recipe(nl: string, en = nl, aliases: string[] = []): Recipe {
  return {
    schema: 2,
    id: 'u:test',
    rev: 1,
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
    origin: { kind: 'user' },
    name: { nl, en },
    tags: [],
    servings: 4,
    lines: [],
    steps: [],
    goesWith: [],
    aliases,
  };
}

describe('spelling variants of dish names', () => {
  it('finds "Dino\'s Gulyás" when searching "goulash" (Stijn, 16 Oct 2026)', () => {
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('goulash'))).toBe(true);
  });

  it('still finds the classics named goulash', () => {
    expect(matchesName(recipe('Hongaarse goulash', 'Hungarian goulash'), queryTerms('goulash'))).toBe(true);
    expect(matchesName(recipe('Hongaarse goulash', 'Hungarian goulash'), queryTerms('gulyás'))).toBe(true);
  });

  it('matches a typed prefix of four or more letters', () => {
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('goul'))).toBe(true);
    expect(termVariants('gou')).toEqual(['gou']);
  });

  it('works in both directions for other dishes', () => {
    expect(matchesName(recipe('Shoarma met knoflooksaus'), queryTerms('shawarma'))).toBe(true);
    expect(matchesName(recipe('Kip saté', 'Chicken satay'), queryTerms('sate'))).toBe(true);
    expect(matchesName(recipe('Lasagne met courgette'), queryTerms('lasagna'))).toBe(true);
  });

  it('keeps every term required', () => {
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('dino goulash'))).toBe(true);
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('stijn goulash'))).toBe(false);
  });

  it('does not invent matches for unrelated words', () => {
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('lasagne'))).toBe(false);
    expect(termVariants('pasta')).toEqual(['pasta']);
  });
});

// docs/specs/labels-categorieen.md §1b + §6a: the cuisine (data/cuisines.json) is searchable by id and
// by its Dutch/English name; a cuisine hit goes to the category group BEFORE the ingredient check
// (decision of the critical reader), plain category and tag hits keep their place.
describe('cuisine search over the real classics', () => {
  const dict = defaultDictionary();
  const file = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8')) as RecipesFile;
  const classics = file.recipes.filter((r) => r.createdAt === BUILTIN_TIMESTAMP);
  const ids = (groups: readonly SearchGroup[], kind: SearchGroup['kind']): string[] => groups.find((g) => g.kind === kind)?.recipes.map((r) => r.id) ?? [];

  for (const q of ['italiaans', 'italian', 'Italiaans', 'ITALIAN']) {
    it(`"${q}" puts Spaghetti Bolognese in the category group, not in the ingredient group`, () => {
      for (const lang of ['nl', 'en'] as const) {
        const groups = searchRecipes(classics, q, dict, lang);
        expect(ids(groups, 'category')).toContain('b:spaghetti-bolognese');
        expect(ids(groups, 'ingredient')).not.toContain('b:spaghetti-bolognese');
        // A recipe without that cuisine but with (Italiaanse) peterselie stays an ingredient hit.
        expect(ids(groups, 'ingredient')).toContain('b:boeuf-stroganoff');
        expect(ids(groups, 'category')).not.toContain('b:boeuf-stroganoff');
        // Every Italian classic is found, and only those land in the category group.
        const italian = classics.filter((r) => r.cuisine === 'italiaans').map((r) => r.id);
        const found = [...ids(groups, 'name'), ...ids(groups, 'category')];
        for (const id of italian) expect(found).toContain(id);
        for (const id of ids(groups, 'category')) expect(italian).toContain(id);
      }
    });
  }

  for (const q of ['hollands', 'dutch']) {
    it(`"${q}" puts Hutspot in the category group`, () => {
      const groups = searchRecipes(classics, q, dict, 'nl');
      expect(ids(groups, 'category')).toContain('b:hutspot');
      expect(ids(groups, 'ingredient')).not.toContain('b:hutspot');
    });
  }

  it('does not search by flag emoji', () => {
    expect(searchRecipes(classics, '🇮🇹', dict, 'nl').flatMap((g) => g.recipes.map((r) => r.id))).not.toContain('b:spaghetti-bolognese');
  });

  it('"pasta" gives exactly the groups it gave before cuisines existed', () => {
    // Fixed expectation recorded before the change (22 Oct 2026 data, the 196 classics).
    const groups = searchRecipes(classics, 'pasta', dict, 'nl');
    expect(groups.map((g) => [g.kind, g.recipes.length])).toEqual([['name', 6], ['ingredient', 22], ['category', 25]]);
    // And identical, recipe by recipe, to the same search without any cuisine on the recipes.
    const withoutCuisine = classics.map((r) => {
      const { cuisine: _drop, ...rest } = r;
      return rest as Recipe;
    });
    for (const lang of ['nl', 'en'] as const) {
      const before = searchRecipes(withoutCuisine, 'pasta', dict, lang).map((g) => ({ kind: g.kind, ids: g.recipes.map((r) => r.id) }));
      const after = searchRecipes(classics, 'pasta', dict, lang).map((g) => ({ kind: g.kind, ids: g.recipes.map((r) => r.id) }));
      expect(after).toEqual(before);
    }
  });

  it('matchesCuisine / matchesCategory read the cuisine id and both names', () => {
    const r = { ...recipe('Testpasta'), category: 'pasta', cuisine: 'italiaans' };
    expect(matchesCuisine(r, queryTerms('italiaans'), dict)).toBe(true);
    expect(matchesCuisine(r, queryTerms('Italian'), dict)).toBe(true);
    expect(matchesCuisine(r, queryTerms('pasta'), dict)).toBe(false);
    expect(matchesCuisine(r, queryTerms('frans'), dict)).toBe(false);
    expect(matchesCuisine({ ...r, cuisine: null }, queryTerms('italiaans'), dict)).toBe(false);
    expect(matchesCuisine(recipe('Geen keuken'), queryTerms('italiaans'), dict)).toBe(false);
    // A mixed query: one term for the category, one for the cuisine.
    expect(matchesCategory(r, queryTerms('italiaans pasta'), dict)).toBe(true);
    expect(matchesCategory({ ...r, cuisine: null }, queryTerms('italiaans pasta'), dict)).toBe(false);
    expect(matchesCategory({ ...r, category: null }, queryTerms('italian'), dict)).toBe(true);
  });
});
