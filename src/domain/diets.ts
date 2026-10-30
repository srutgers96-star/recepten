// The diet values of the variant tabs (docs/specs/varianten-tabs.md, 13D) as plain constants, in a
// module with NO runtime imports. src/domain/share.ts and src/domain/recipe-io.ts (the Safari landing's
// shared chunk) need `VARIANT_DIETS` to read `variants` and `vr`; importing it from variants.ts pulled
// the whole swap planner, diet.ts and the dictionary helpers into that chunk ("Besluiten Fable na
// blok 1", point 6). src/domain/variants.ts re-exports everything here, so existing imports keep working.
import type { DietTag } from './diet.ts';

export type VariantDiet = DietTag;

/**
 * The diets a variant can be made for, in the order the UI offers them (the tab order of the
 * variants spec 13D; docs/specs/README.md §2b). Not the chip order of `DIET_TAGS`.
 */
export const VARIANT_DIETS: readonly VariantDiet[] = ['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij'];

/** The suffix in the variant's name per language: "Lasagne (glutenvrij)" / "Lasagne (gluten-free)". */
export const DIET_SUFFIX: Readonly<Record<VariantDiet, { nl: string; en: string }>> = {
  glutenvrij: { nl: 'glutenvrij', en: 'gluten-free' },
  vegetarisch: { nl: 'vegetarisch', en: 'vegetarian' },
  vegan: { nl: 'vegan', en: 'vegan' },
  lactosevrij: { nl: 'lactosevrij', en: 'lactose-free' },
};

/** The tags a variant carries for a diet (data/recipes.json tag vocabulary: vegan implies vegetarisch). */
export const DIET_TAGS_FOR: Readonly<Record<VariantDiet, readonly string[]>> = {
  glutenvrij: ['glutenvrij'],
  vegetarisch: ['vegetarisch'],
  vegan: ['vegetarisch', 'vegan'],
  lactosevrij: ['lactosevrij'],
};

/** The "-optie" tags that stop meaning anything once the variant IS that diet. */
export const OPTIE_TAGS_FOR: Readonly<Record<VariantDiet, readonly string[]>> = {
  glutenvrij: ['glutenvrij-optie'],
  vegetarisch: ['vega-optie'],
  vegan: ['vega-optie', 'vegan-optie'],
  lactosevrij: ['lactosevrij-optie'],
};
