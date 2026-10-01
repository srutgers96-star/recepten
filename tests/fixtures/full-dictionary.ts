// The complete bundled dictionary (incl. data/note-phrases.json, which `defaultDictionaryData()`
// now carries) for the block A-bis tests: US units, US aliases, note translation.
import { defaultDictionary } from '../../src/domain/data';
import type { Dictionary } from '../../src/domain/dictionary';

export function fullDictionary(): Dictionary {
  return defaultDictionary();
}
