// App-level dictionary (docs/phase-2-spec.md §5): the bundled dictionary (src/domain/data.ts:
// vocab + data/ingredients.json) with the user-created entries (table `userIngredients`) layered
// on top, as a signal so every screen re-renders after "Nieuw ingrediënt". `lineText` /
// `lineParts` are the convenience wrappers the UI uses to render a structured line in a
// language, scaled by a factor.
import { signal } from '@preact/signals';
import { defaultDictionary } from '@/domain/data';
import { withUserEntries, type Dictionary, type Ingredient } from '@/domain/dictionary';
import type { Lang, Line } from '@/domain/model';
import { renderLine, renderLineParts, type LineParts } from '@/domain/render';
import { listUserIngredients } from '@/db/repo';

/** The bundled dictionary (vocab + data/ingredients.json; memoised, no user entries). */
export function baseDictionary(): Dictionary {
  return defaultDictionary();
}

/** The dictionary every screen renders with: base + user entries. Usable before loadDictionary(). */
export const dictionary = signal<Dictionary>(baseDictionary());

/** The user entries as last read from the database (for the picker's "eigen" badge, backup UI). */
export const userIngredients = signal<Ingredient[]>([]);

/** True once the user entries have been read from the database. */
export const dictionaryLoaded = signal(false);

/** Reads the user ingredients and rebuilds the dictionary signal. Called at boot (src/app.tsx). */
export async function loadDictionary(): Promise<void> {
  let entries: Ingredient[] = [];
  try {
    entries = await listUserIngredients();
  } catch (e) {
    console.error('loadDictionary', e);
  }
  userIngredients.value = entries;
  dictionary.value = withUserEntries(baseDictionary(), entries);
  dictionaryLoaded.value = true;
}

/** Call after saveUserIngredient / deleteUserIngredient (the IngredientPicker does). */
export async function reloadDictionary(): Promise<void> {
  await loadDictionary();
}

/** A user-created id is one the bundled dictionary does not know. */
export function isUserIngredientId(id: string): boolean {
  return !baseDictionary().get(id) && !!dictionary.value.get(id);
}

/** The line as one string in `lang`, scaled by `factor` (servings / base servings). */
export function lineText(line: Line, lang: Lang, factor = 1): string {
  return renderLine(line, dictionary.value, lang, factor);
}

/** The pieces of a rendered line for chips: { qty, unit, name, prep, note, alt, part, packSize, optional, gloss, resolved, text }. */
export function lineParts(line: Line, lang: Lang, factor = 1): LineParts {
  return renderLineParts(line, dictionary.value, lang, factor);
}

export type { Dictionary, Ingredient, LineParts };
