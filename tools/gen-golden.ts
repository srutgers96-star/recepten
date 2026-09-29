// tools/gen-golden.ts — regenerates the parser golden fixture (docs/phase-2-spec.md §4).
//
// Every unique raw ingredient line of data/source/recipes-recepten2.json is parsed with the
// dictionary in data/*.json and rendered in both languages; tests/parser.golden.json stores
// `{ raw, line, nl, en }` per line, sorted by raw text (code-point order, so the file is stable on
// every machine). tests/parser.golden.test.ts compares the current parser + dictionary against it:
// a difference is either a regression or an intentional change — then regenerate and commit.
//
// Run:   node --experimental-strip-types tools/gen-golden.ts
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { loadDictionary, type Dictionary } from '../src/domain/dictionary.ts';
import type { Line } from '../src/domain/model.ts';
import { parseLine } from '../src/domain/parser.ts';
import { renderLine } from '../src/domain/render.ts';
import { readDictionaryData, sourceLines } from './build-dictionary-seed.ts';

export interface GoldenEntry {
  raw: string;
  line: Line;
  nl: string;
  en: string;
}

export interface GoldenFile {
  generatedBy: string;
  source: string;
  /** Size of the dictionary the fixture was made with (a hint when the test fails). */
  dictionary: { ingredients: number; units: number; qualifiers: number; prepPhrases: number };
  count: number;
  resolved: number;
  lines: GoldenEntry[];
}

/** Unique, trimmed, non-empty lines in code-point order. */
export function uniqueSorted(lines: readonly string[]): string[] {
  return [...new Set(lines.map((l) => l.trim()).filter(Boolean))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function goldenEntry(raw: string, dict: Dictionary): GoldenEntry {
  const line = parseLine(raw, dict, 'nl');
  return { raw, line, nl: renderLine(line, dict, 'nl'), en: renderLine(line, dict, 'en') };
}

export function buildGolden(lines: readonly string[], dict: Dictionary, source: string): GoldenFile {
  const entries = uniqueSorted(lines).map((raw) => goldenEntry(raw, dict));
  return {
    generatedBy: 'node --experimental-strip-types tools/gen-golden.ts',
    source,
    dictionary: {
      ingredients: dict.ingredients.length,
      units: dict.units.length,
      qualifiers: dict.qualifiers.length,
      prepPhrases: dict.prepPhrases.length,
    },
    count: entries.length,
    resolved: entries.filter((e) => e.line.kind !== 'header' && !!e.line.ing).length,
    lines: entries,
  };
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dict = loadDictionary(readDictionaryData(root));
  const golden = buildGolden(sourceLines(root), dict, 'data/source/recipes-recepten2.json');
  const outPath = join(root, 'tests', 'parser.golden.json');
  writeFileSync(outPath, JSON.stringify(golden, null, 2) + '\n', 'utf8');
  const headers = golden.lines.filter((e) => e.line.kind === 'header').length;
  const body = golden.count - headers;
  console.log(
    `tests/parser.golden.json: ${golden.count} unique lines (${headers} headers), ${golden.resolved}/${body} resolved ` +
      `(${((100 * golden.resolved) / Math.max(1, body)).toFixed(1)}%), dictionary ${golden.dictionary.ingredients} ingredients`,
  );
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
