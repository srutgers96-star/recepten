// tools/measure-parse.ts — reproducible corpus measurement over the source recipe file.
//
// Replaces the unverifiable "raw count" in PLAN.md §5 ("Ruwe telling"). It classifies every
// ingredient line with a regex-only grammar (no dictionary lookup) and reports the distribution.
// This is an ESTIMATE of the shape of the corpus, not a parse-success rate: whether a line also
// receives a dictionary id only shows in the golden fixture of phase 2.
//
// Run:   node --experimental-strip-types tools/measure-parse.ts   (or: npm run measure-parse)
// Reads: data/source/recipes-recepten2.json
// Writes: docs/measure-parse.md (the same report that is printed to stdout)
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Classification (pure, exported for the vitest suite in tests/measure-parse.test.ts)
// ---------------------------------------------------------------------------

export type LineKind = 'header' | 'empty' | 'qty-known-unit' | 'qty-count-or-name' | 'no-qty';

export interface LineClass {
  kind: LineKind;
  /** Known unit (normalised: lowercase, trailing '.' removed), only for kind 'qty-known-unit'. */
  unit?: string;
  /** The quantity text as written (incl. an optional 'ca.'/'circa'/'±' prefix), only for qty-* kinds. */
  qty?: string;
  /** Line contains a [prep] note in square brackets. */
  hasPrep: boolean;
  /** Line contains a (parenthesised) note. */
  hasParen: boolean;
}

/** Known units in the Dutch corpus (PLAN.md §5 "Eenheden"). Matched as a whole word after the quantity. */
export const KNOWN_UNITS: ReadonlySet<string> = new Set([
  'g', 'kg', 'ml', 'dl', 'l', 'ltr', 'el', 'tl', 'mp', 'kop', 'kopje', 'blik', 'blikje', 'pak', 'pakje',
  'zak', 'zakje', 'pot', 'potje', 'bos', 'bosje', 'takje', 'takjes', 'stengel', 'stengels', 'plak', 'plakje',
  'plakjes', 'snee', 'sneetje', 'scheut', 'scheutje', 'snuf', 'snufje', 'beker', 'bekertje', 'bakje', 'klont',
  'klontje', 'hand', 'handje', 'teen', 'teentje', 'teentjes', 'blaadje', 'blaadjes', 'cm', 'fles', 'flesje',
  'glas', 'druppel', 'eetlepel', 'theelepel', 'mespunt', 'stuk', 'stuks',
]);

// Quantity grammar (PLAN.md §5 "Parser"), longest alternatives first so "2-3" is not read as "2":
//   \d+\s?(-|–|of|tot|à)\s?\d+   range        "2-3", "2–3", "1 of 2", "60 à 70"
//   \d+\s\d+/\d+                 mixed        "1 1/2"
//   \d+\s?[½¼¾⅓⅔]                mixed        "1½", "1 ½"
//   \d+/\d+                      fraction     "1/2"  (corpus extension: 12 lines are written this way)
//   \d+([.,]\d+)?                decimal      "400", "1,5", "0.5"
//   [½¼¾⅓⅔]                      vulgar       "½"
// with an optional 'ca.' / 'circa' / '±' prefix. The quantity must be followed by whitespace, end of
// line, or a letter ("400g" counts as a quantity followed by the unit "g").
const VULGAR = '[½¼¾⅓⅔]';
const QTY_CORE = [
  `\\d+\\s?(?:-|–|of|tot|à)\\s?\\d+`,
  `\\d+\\s\\d+/\\d+`,
  `\\d+\\s?${VULGAR}`,
  `\\d+/\\d+`,
  `\\d+(?:[.,]\\d+)?`,
  VULGAR,
].join('|');
const QTY_RE = new RegExp(`^((?:ca\\.|circa|±)\\s*)?(${QTY_CORE})(?=\\s|$|\\p{L})`, 'iu');

// First word after the quantity, optionally followed by a '.', then a word boundary.
const UNIT_RE = /^(\p{L}+)\.?(?=\s|$|[,(\[])/u;

const HEADER_RE = /:\s*$/;
const PREP_RE = /\[[^\]]*\]/;
const PAREN_RE = /\([^)]*\)/;

/** Classify one raw ingredient line. Deterministic and dictionary-free. */
export function classifyLine(line: string): LineClass {
  const text = line.trim();
  const hasPrep = PREP_RE.test(text);
  const hasParen = PAREN_RE.test(text);

  if (text === '') return { kind: 'empty', hasPrep, hasParen };
  if (HEADER_RE.test(text)) return { kind: 'header', hasPrep, hasParen };

  const qtyMatch = QTY_RE.exec(text);
  if (!qtyMatch) return { kind: 'no-qty', hasPrep, hasParen };

  const qty = qtyMatch[0].trim();
  const rest = text.slice(qtyMatch[0].length).trimStart();
  const unitMatch = UNIT_RE.exec(rest);
  const unitWord = unitMatch?.[1]?.toLowerCase();
  if (unitWord !== undefined && KNOWN_UNITS.has(unitWord)) {
    return { kind: 'qty-known-unit', unit: unitWord, qty, hasPrep, hasParen };
  }
  return { kind: 'qty-count-or-name', qty, hasPrep, hasParen };
}

// ---------------------------------------------------------------------------
// Corpus measurement
// ---------------------------------------------------------------------------

interface SourceRecipe {
  name?: unknown;
  ingredients?: unknown;
  instructions?: unknown;
}

interface Tally {
  total: number;
  unique: number;
  kindsAll: Record<LineKind, number>;
  kindsUnique: Record<LineKind, number>;
  unitsAll: Map<string, number>;
  unitsUnique: Map<string, number>;
  prepAll: number;
  prepUnique: number;
  parenAll: number;
  parenUnique: number;
  samplesNoQty: string[];
  samplesCountOrName: string[];
}

const KINDS: readonly LineKind[] = ['qty-known-unit', 'qty-count-or-name', 'no-qty', 'header', 'empty'];
const SAMPLE_SIZE = 25;
const TOP_UNITS = 40;

function emptyKinds(): Record<LineKind, number> {
  return { header: 0, empty: 0, 'qty-known-unit': 0, 'qty-count-or-name': 0, 'no-qty': 0 };
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Deterministic, evenly spaced sample of n items from a list (keeps the corpus variety visible). */
export function evenSample<T>(items: readonly T[], n: number): T[] {
  if (items.length <= n) return [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor((i * items.length) / n);
    const item = items[idx];
    if (item !== undefined) out.push(item);
  }
  return out;
}

export function collectLines(recipes: readonly SourceRecipe[]): string[] {
  const lines: string[] = [];
  for (const recipe of recipes) {
    if (!Array.isArray(recipe.ingredients)) continue;
    for (const entry of recipe.ingredients) {
      if (typeof entry === 'string') lines.push(entry);
    }
  }
  return lines;
}

export function measure(lines: readonly string[]): Tally {
  const tally: Tally = {
    total: lines.length,
    unique: 0,
    kindsAll: emptyKinds(),
    kindsUnique: emptyKinds(),
    unitsAll: new Map(),
    unitsUnique: new Map(),
    prepAll: 0,
    prepUnique: 0,
    parenAll: 0,
    parenUnique: 0,
    samplesNoQty: [],
    samplesCountOrName: [],
  };

  const seen = new Set<string>();
  const noQty: string[] = [];
  const countOrName: string[] = [];

  for (const line of lines) {
    const c = classifyLine(line);
    tally.kindsAll[c.kind]++;
    if (c.unit) bump(tally.unitsAll, c.unit);
    if (c.hasPrep) tally.prepAll++;
    if (c.hasParen) tally.parenAll++;

    const trimmed = line.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    tally.kindsUnique[c.kind]++;
    if (c.unit) bump(tally.unitsUnique, c.unit);
    if (c.hasPrep) tally.prepUnique++;
    if (c.hasParen) tally.parenUnique++;
    if (c.kind === 'no-qty') noQty.push(trimmed);
    if (c.kind === 'qty-count-or-name') countOrName.push(trimmed);
  }

  tally.unique = seen.size;
  const collator = new Intl.Collator('nl');
  tally.samplesNoQty = evenSample(noQty.sort(collator.compare), SAMPLE_SIZE);
  tally.samplesCountOrName = evenSample(countOrName.sort(collator.compare), SAMPLE_SIZE);
  return tally;
}

function pct(part: number, whole: number): string {
  return whole === 0 ? '0.0%' : `${((100 * part) / whole).toFixed(1)}%`;
}

function sortedUnits(map: Map<string, number>): [string, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function renderMarkdown(tally: Tally, sourcePath: string): string {
  const out: string[] = [];
  out.push('# Corpus measurement: ingredient lines');
  out.push('');
  out.push(`Source: \`${sourcePath}\` — generated by \`npm run measure-parse\` (tools/measure-parse.ts).`);
  out.push('Regex-only classification, no dictionary lookup. This estimates the *shape* of the corpus,');
  out.push('not parse success (that is what the phase-2 golden fixture measures). Re-run to reproduce.');
  out.push('');
  out.push('## Totals');
  out.push('');
  out.push(`- Total ingredient lines: **${tally.total}**`);
  out.push(`- Unique lines (after trim): **${tally.unique}** (of which non-empty: **${tally.unique - tally.kindsUnique.empty}**)`);
  out.push(`- Lines with a \`[prep]\` note: **${tally.prepUnique}** unique (${tally.prepAll} total)`);
  out.push(`- Lines with a \`(paren)\` note: **${tally.parenUnique}** unique (${tally.parenAll} total)`);
  out.push('');
  out.push('## Kinds');
  out.push('');
  out.push('| Kind | Unique | % of unique | All | % of all |');
  out.push('|---|---:|---:|---:|---:|');
  for (const kind of KINDS) {
    const u = tally.kindsUnique[kind];
    const a = tally.kindsAll[kind];
    out.push(`| ${kind} | ${u} | ${pct(u, tally.unique)} | ${a} | ${pct(a, tally.total)} |`);
  }
  out.push('');
  out.push('Kinds: `qty-known-unit` = quantity + known unit ("400 g …"); `qty-count-or-name` = quantity');
  out.push('followed by a count word or the name itself ("2 eieren", "1 rode ui"); `no-qty` = no leading');
  out.push('quantity ("zout en peper"); `header` = trailing colon ("Dressing:").');
  out.push('');
  out.push(`## Top ${TOP_UNITS} units`);
  out.push('');
  out.push('| # | Unit | Unique lines | All lines |');
  out.push('|---:|---|---:|---:|');
  const unitRows = sortedUnits(tally.unitsUnique).slice(0, TOP_UNITS);
  unitRows.forEach(([unit, count], i) => {
    out.push(`| ${i + 1} | ${unit} | ${count} | ${tally.unitsAll.get(unit) ?? 0} |`);
  });
  out.push('');
  out.push(`## ${SAMPLE_SIZE} sample lines: no-qty`);
  out.push('');
  for (const s of tally.samplesNoQty) out.push(`- \`${s}\``);
  out.push('');
  out.push(`## ${SAMPLE_SIZE} sample lines: qty-count-or-name`);
  out.push('');
  for (const s of tally.samplesCountOrName) out.push(`- \`${s}\``);
  out.push('');
  out.push('Samples are evenly spaced over the alphabetically sorted unique lines of that kind (deterministic).');
  out.push('');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry (does not run when the module is imported by the tests)
// ---------------------------------------------------------------------------

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const sourceRel = 'data/source/recipes-recepten2.json';
  const sourcePath = join(root, sourceRel);
  const docsDir = join(root, 'docs');
  const outPath = join(docsDir, 'measure-parse.md');

  const raw = readFileSync(sourcePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    console.error(`Expected an array of recipes in ${sourceRel}`);
    process.exit(1);
  }
  const recipes = parsed as SourceRecipe[];
  const lines = collectLines(recipes);
  const tally = measure(lines);
  const report = renderMarkdown(tally, sourceRel);

  mkdirSync(docsDir, { recursive: true });
  writeFileSync(outPath, report, 'utf8');

  process.stdout.write(report);
  process.stdout.write(`\n(recipes: ${recipes.length}; report written to docs/measure-parse.md)\n`);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
