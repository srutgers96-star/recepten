// The parser golden fixture (docs/phase-2-spec.md §4): every unique raw line of the corpus, parsed
// with the real dictionary and rendered NL/EN, must match tests/parser.golden.json. A difference is
// a regression or an intentional change — regenerate with
//   node --experimental-strip-types tools/gen-golden.ts
// and commit the fixture together with the parser/dictionary change.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadDictionary } from '../src/domain/dictionary';
import { readDictionaryData, sourceLines } from '../tools/build-dictionary-seed.ts';
import { goldenEntry, uniqueSorted, type GoldenFile } from '../tools/gen-golden.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REGENERATE = 'regenerate with: node --experimental-strip-types tools/gen-golden.ts';
const golden = JSON.parse(readFileSync(new URL('./parser.golden.json', import.meta.url), 'utf8')) as GoldenFile;
const dict = loadDictionary(readDictionaryData(ROOT));

describe('parser golden fixture', () => {
  it('covers every unique raw line of the source corpus', () => {
    const expected = uniqueSorted(sourceLines(ROOT));
    expect(golden.count, REGENERATE).toBe(expected.length);
    expect(golden.lines.map((e) => e.raw), REGENERATE).toEqual(expected);
  });

  it('was generated with the current dictionary size', () => {
    expect(golden.dictionary, REGENERATE).toEqual({
      ingredients: dict.ingredients.length,
      units: dict.units.length,
      qualifiers: dict.qualifiers.length,
      prepPhrases: dict.prepPhrases.length,
    });
  });

  it('parses and renders every line exactly as committed', () => {
    const mismatches: string[] = [];
    for (const entry of golden.lines) {
      const now = goldenEntry(entry.raw, dict);
      const a = JSON.stringify(now);
      const b = JSON.stringify(entry);
      if (a !== b) mismatches.push(`${entry.raw}\n    now: ${a}\n    was: ${b}`);
    }
    expect(mismatches.length, `${mismatches.length} line(s) differ from the golden fixture (${REGENERATE}):\n  ${mismatches.slice(0, 10).join('\n  ')}`).toBe(0);
  });

  it('keeps the resolution rate (ingredient id found) at or above the committed one', () => {
    let resolved = 0;
    let body = 0;
    for (const entry of golden.lines) {
      if (entry.line.kind === 'header') continue;
      body++;
      if (entry.line.ing) resolved++;
    }
    expect(resolved).toBe(golden.resolved);
    expect(resolved / body).toBeGreaterThan(0.95);
  });
});
