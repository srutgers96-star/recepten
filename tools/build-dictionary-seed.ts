// tools/build-dictionary-seed.ts — the parser WITHOUT ingredient resolution over the source corpus.
//
// Reads:  data/source/recipes-recepten2.json + data/{units,qualifiers,prep-phrases,aisles,categories}.json
// Writes: data/work/name-parts.json = every unique name part (quantity, unit, qualifiers, part, prep
//         and parentheses stripped) with its count, the qualifiers/units seen with it and up to 3
//         example raw lines, sorted by count desc then name. Input for the dictionary agents who
//         write data/ingredients.json (docs/phase-2-spec.md §4).
//
// Run:   node --experimental-strip-types tools/build-dictionary-seed.ts
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { loadDictionary, normalizeKey, type Dictionary, type DictionaryData, type Ingredient } from '../src/domain/dictionary.ts';
import { parseLine } from '../src/domain/parser.ts';
import { normalizeSource } from '../src/domain/recipe-source.ts';

export interface NamePart {
  /** The name part as most often written (first seen spelling). */
  name: string;
  /** Lookup key (diacritics folded, lowercase). */
  key: string;
  count: number;
  /** Qualifier ids that preceded this name in the corpus. */
  qual: string[];
  /** Unit ids that preceded this name in the corpus (empty = counted or no quantity). */
  units: string[];
  examples: string[];
}

export interface NamePartsFile {
  source: string;
  lines: number;
  uniqueLines: number;
  parts: NamePart[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/**
 * The dictionary data as the Node tools see it: the six vocab files (incl. note-phrases.json) plus data/ingredients.json
 * when it exists (empty list otherwise). `withIngredients: false` forces the empty list.
 */
export function readDictionaryData(root: string, withIngredients = true): DictionaryData {
  const d = (name: string) => join(root, 'data', name);
  const ingredientsPath = d('ingredients.json');
  return {
    units: readJson(d('units.json')) as DictionaryData['units'],
    qualifiers: readJson(d('qualifiers.json')) as DictionaryData['qualifiers'],
    prepPhrases: readJson(d('prep-phrases.json')) as DictionaryData['prepPhrases'],
    ingredients: withIngredients && existsSync(ingredientsPath) ? (readJson(ingredientsPath) as Ingredient[]) : [],
    aisles: readJson(d('aisles.json')) as DictionaryData['aisles'],
    categories: readJson(d('categories.json')) as DictionaryData['categories'],
    notePhrases: readJson(d('note-phrases.json')) as DictionaryData['notePhrases'],
  };
}

/** All raw ingredient lines of the source corpus, in order. */
export function sourceLines(root: string): string[] {
  const raw: unknown = readJson(join(root, 'data', 'source', 'recipes-recepten2.json'));
  return normalizeSource(raw).flatMap((r) => r.ingredients);
}

/** Pure: unique name parts of a list of raw lines, parsed without ingredient resolution. */
export function buildNameParts(lines: readonly string[], dict: Dictionary): NamePart[] {
  const parts = new Map<string, NamePart>();
  const collator = new Intl.Collator('nl');
  for (const raw of lines) {
    const line = parseLine(raw, dict, 'nl');
    if (line.kind === 'header') continue;
    const visit = (l: typeof line): void => {
      const name = (l.name ?? '').trim();
      if (!name) return;
      const key = normalizeKey(name);
      let part = parts.get(key);
      if (!part) {
        part = { name, key, count: 0, qual: [], units: [], examples: [] };
        parts.set(key, part);
      }
      part.count++;
      for (const q of l.qual ?? []) if (!part.qual.includes(q)) part.qual.push(q);
      if (l.unit && !part.units.includes(l.unit)) part.units.push(l.unit);
      if (part.examples.length < 3 && !part.examples.includes(raw)) part.examples.push(raw);
    };
    visit(line);
    for (const alt of line.alt ?? []) visit(alt);
  }
  for (const p of parts.values()) {
    p.qual.sort();
    p.units.sort();
  }
  return [...parts.values()].sort((a, b) => b.count - a.count || collator.compare(a.key, b.key));
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sourceRel = 'data/source/recipes-recepten2.json';
  const dict = loadDictionary(readDictionaryData(root, false));
  const lines = sourceLines(root);
  const unique = new Set(lines.map((l) => l.trim()));
  const parts = buildNameParts(lines, dict);

  const file: NamePartsFile = { source: sourceRel, lines: lines.length, uniqueLines: unique.size, parts };
  const outDir = join(root, 'data', 'work');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'name-parts.json');
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  const withQual = parts.filter((p) => p.qual.length > 0).length;
  console.log(`data/work/name-parts.json: ${parts.length} unique name parts from ${lines.length} lines (${unique.size} unique), ${withQual} seen with qualifiers`);
  console.log('top 15:');
  for (const p of parts.slice(0, 15)) console.log(`  ${String(p.count).padStart(4)}  ${p.name}${p.qual.length ? `  [${p.qual.join(', ')}]` : ''}`);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
