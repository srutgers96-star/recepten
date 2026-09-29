// Phase-2 UI strings owned by the home / list / settings agent (categories shelf, filter chips,
// search groups). Merged LAST in index.ts, so a key here wins over the same key in
// common/browse/edit/settings. Every key needs both nl and en. The picker keys live in common.ts
// (shared component); the "Meer" toggles live in settings.ts.
import type { Dict } from './index';

export const phase2: Dict = {
  // --- Home: categories shelf + dice filters ---
  'home.categories': { nl: 'Categorieën', en: 'Categories' },
  'home.surpriseFilters': { nl: 'Filters voor de dobbelsteen', en: 'Filters for the dice' },
  'home.noMatch': { nl: 'Geen recept past bij deze filters.', en: 'No recipe matches these filters.' },

  // --- Filter chips (list + dice) ---
  'filter.label': { nl: 'Filters', en: 'Filters' },
  'filter.clear': { nl: 'Filters wissen', en: 'Clear filters' },
  'filter.vegetarisch': { nl: 'Vegetarisch', en: 'Vegetarian' },
  'filter.snel': { nl: 'Snel', en: 'Quick' },
  'filter.oven': { nl: 'Oven', en: 'Oven' },
  'filter.vis': { nl: 'Vis', en: 'Fish' },
  'filter.kip': { nl: 'Kip', en: 'Chicken' },
  'filter.wereld': { nl: 'Wereld', en: 'World' },

  // --- Recipes list: search placeholder (bilingual now), groups + filtered count ---
  'list.search': { nl: 'Zoek op naam of ingrediënt', en: 'Search by name or ingredient' },
  'list.filtered': { nl: '{n} van {total} recepten', en: '{n} of {total} recipes' },
  'search.name': { nl: 'Op naam', en: 'By name' },
  'search.ingredient': { nl: 'Met dit ingrediënt', en: 'With this ingredient' },
  'search.category': { nl: 'Categorie', en: 'Category' },
  'search.tag': { nl: 'Kenmerk', en: 'Tag' },
};
