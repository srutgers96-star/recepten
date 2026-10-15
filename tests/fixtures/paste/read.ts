// The paste fixtures (docs/phase-6-spec.md 6A.17): real copies of recipe pages as a person pastes
// them. Each file starts with two comment lines ("# source: <url>" and "# method truncated: …")
// that are not part of the paste; `readPasteFixture` drops them.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('./', import.meta.url));

/** A fixture as the person pasted it: the two comment lines removed. */
export function readPasteFixture(file: string): string {
  return readFileSync(DIR + file, 'utf8')
    .split('\n')
    .filter((l) => !/^# (?:source|method truncated):/.test(l))
    .join('\n');
}

/** Every fixture file name, sorted (nl-* and en-*). */
export const PASTE_FIXTURES: string[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.txt'))
  .sort();
