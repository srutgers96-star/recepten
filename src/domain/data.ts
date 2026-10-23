// Typed access to the bundled vocab files in data/ and the default dictionary built from them.
// The app and the tests import this module (Vite / vitest resolve the JSON imports); the Node
// tools read the same files with `readFileSync` (Node needs import attributes for JSON) and call
// `loadDictionary` directly.
import unitsJson from '../../data/units.json';
import qualifiersJson from '../../data/qualifiers.json';
import prepPhrasesJson from '../../data/prep-phrases.json';
import categoriesJson from '../../data/categories.json';
import aislesJson from '../../data/aisles.json';
import ingredientsJson from '../../data/ingredients.json';
import notePhrasesJson from '../../data/note-phrases.json';
import cuisinesJson from '../../data/cuisines.json';
import {
  loadDictionary,
  type Aisle,
  type Category,
  type Cuisine,
  type Dictionary,
  type DictionaryData,
  type Ingredient,
  type NotePhrase,
  type PrepPhrase,
  type Qualifier,
  type Unit,
} from './dictionary.ts';

export const unitsData: Unit[] = unitsJson as Unit[];
export const qualifiersData: Qualifier[] = qualifiersJson as Qualifier[];
export const prepPhrasesData: PrepPhrase[] = prepPhrasesJson as PrepPhrase[];
export const categoriesData: Category[] = categoriesJson as Category[];
export const aislesData: Aisle[] = aislesJson as Aisle[];
/** data/cuisines.json (docs/specs/labels-categorieen.md §2c): the 18 regular cuisines with their flags, then the 43 reserve ones (`rare: true`, "Blok 6 — keukens wereldwijd"). */
export const cuisinesData: Cuisine[] = cuisinesJson as Cuisine[];

/** data/ingredients.json (docs/phase-2-spec.md §1): the ~380 bundled ingredients. Tests that need
 * a dictionary WITHOUT ingredients build one with `loadDictionary({ ...defaultDictionaryData(), ingredients: [] })`. */
export const ingredientsData: Ingredient[] = ingredientsJson as Ingredient[];

/** data/note-phrases.json (docs/phase-5-spec.md A-bis.1): bilingual note phrases ("approximately" ↔ "ongeveer"). */
export const notePhrasesData: NotePhrase[] = notePhrasesJson as NotePhrase[];

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
      notePhrases: notePhrasesData,
      cuisines: cuisinesData,
    };
  }
  return data;
}

/** The dictionary built from the bundled data files; memoised. */
export function defaultDictionary(): Dictionary {
  return loadDictionary(defaultDictionaryData());
}
