// Typed access to the bundled vocab files in data/ and the default dictionary built from them.
// The app and the tests import this module (Vite / vitest resolve the JSON imports); the Node
// tools read the same files with `readFileSync` (Node needs import attributes for JSON) and call
// `loadDictionary` directly.
import unitsJson from '../../data/units.json';
import qualifiersJson from '../../data/qualifiers.json';
import prepPhrasesJson from '../../data/prep-phrases.json';
import categoriesJson from '../../data/categories.json';
import aislesJson from '../../data/aisles.json';
import {
  loadDictionary,
  type Aisle,
  type Category,
  type Dictionary,
  type DictionaryData,
  type Ingredient,
  type PrepPhrase,
  type Qualifier,
  type Unit,
} from './dictionary.ts';

export const unitsData: Unit[] = unitsJson as Unit[];
export const qualifiersData: Qualifier[] = qualifiersJson as Qualifier[];
export const prepPhrasesData: PrepPhrase[] = prepPhrasesJson as PrepPhrase[];
export const categoriesData: Category[] = categoriesJson as Category[];
export const aislesData: Aisle[] = aislesJson as Aisle[];

/**
 * data/ingredients.json is written by the dictionary agents (docs/phase-2-spec.md §1). Until it
 * exists the bundled dictionary has no ingredients: the parser then returns `ing: null` with the
 * name part in `name`. Switch this to `import ingredientsJson from '../../data/ingredients.json'`
 * once the file is in the repo.
 */
export const ingredientsData: Ingredient[] = [];

let data: DictionaryData | undefined;

/** The bundled vocab as one DictionaryData object (same object on every call, so loadDictionary memoises). */
export function defaultDictionaryData(): DictionaryData {
  if (!data) {
    data = {
      units: unitsData,
      qualifiers: qualifiersData,
      prepPhrases: prepPhrasesData,
      ingredients: ingredientsData,
      aisles: aislesData,
      categories: categoriesData,
    };
  }
  return data;
}

/** The dictionary built from the bundled data files; memoised. */
export function defaultDictionary(): Dictionary {
  return loadDictionary(defaultDictionaryData());
}
