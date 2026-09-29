// Effective ingredient lines of a recipe (docs/phase-2-spec.md §5): the parsed lines with the
// user's line overrides ("Koppel ingrediënt", table `lineOverrides`) merged in. User recipes
// carry corrections in the line itself, so the overrides are normally empty for them.
import { useMemo } from 'preact/hooks';
import type { Line, Recipe } from '@/domain/model';
import { applyLineOverrides, type LineOverride } from '@/domain/overrides';
import { useLive } from '@/db/live';
import { listLineOverrides } from '@/db/repo';

/** `recipe.lines` with the overrides of that recipe applied by index. */
export function effectiveLines(recipe: Pick<Recipe, 'lines'>, overridesForRecipe: readonly LineOverride[] | null | undefined): Line[] {
  return applyLineOverrides(recipe.lines, overridesForRecipe);
}

/**
 * Hook: the effective lines of a recipe, live (re-renders when a line override is saved). Until
 * the overrides are read the plain `recipe.lines` are returned, so nothing flashes empty.
 */
export function useRecipeLines(recipe: Pick<Recipe, 'id' | 'lines'> | null | undefined): Line[] {
  const id = recipe?.id ?? '';
  const overrides = useLive(() => listLineOverrides(id), [id]);
  return useMemo(() => (recipe ? effectiveLines(recipe, overrides) : []), [recipe, overrides]);
}

/** Hook: the raw line overrides of a recipe, live (undefined until read). */
export function useLineOverrides(recipeId: string): LineOverride[] | undefined {
  return useLive(() => listLineOverrides(recipeId), [recipeId]);
}
