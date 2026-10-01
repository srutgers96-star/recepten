// The complete bundled dictionary INCLUDING data/note-phrases.json, for the block A-bis tests
// (US units, US aliases, note translation). `defaultDictionaryData()` carries the note phrases once
// src/domain/data.ts imports them; until then this fixture adds them explicitly.
import notePhrasesJson from '../../data/note-phrases.json';
import { defaultDictionaryData } from '../../src/domain/data';
import { loadDictionary, type Dictionary, type NotePhrase } from '../../src/domain/dictionary';

let cached: Dictionary | undefined;

export function fullDictionary(): Dictionary {
  if (!cached) cached = loadDictionary({ ...defaultDictionaryData(), notePhrases: notePhrasesJson as NotePhrase[] });
  return cached;
}
