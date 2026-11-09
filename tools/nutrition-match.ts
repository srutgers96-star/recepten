// tools/nutrition-match.ts — food tables (USDA now, NEVO later) to candidate lists for the matching round
// (docs/specs/verbeterronde-9b.md §1a).
//
//   node --experimental-strip-types tools/nutrition-match.ts --normalize usda      (or: npm run nutrition-match -- --normalize usda)
//   node --experimental-strip-types tools/nutrition-match.ts --candidates usda     (or: … -- --candidates nevo)
//
// --normalize usda: reads data/work/tables/usda/food.csv, food_nutrient.csv (36 MB, streamed line by line) and
// food_category.csv, and writes the normalised table data/work/tables/usda.csv. Energy = nutrient 1008, else
// 2047, else empty. Brand, fast-food, restaurant, baby-food, meal, quality-control and American Indian/Alaska
// Native categories are skipped (they never match an ingredient). NEVO is normalised by a separate python
// script of Fable's; this tool only knows the normalised form:
//
//   code,name,name2,category,kcal,protein,fat,carbs,fibre,sodium_mg,alcohol,state
//
// (`name` the primary name — USDA description, NEVO Dutch name; `name2` the second name — USDA empty, NEVO
// English name; numbers per 100 g, empty = unknown; `state` raw | cooked | canned | dried | other, from the name.)
//
// --candidates <source>: reads data/work/tables/<source>.csv, data/ingredients.json and data/nutrition.json and
// writes, for every food ingredient (not aisle huishoudelijk / drogisterij), the eight best candidates by
// `scoreCandidate` to data/llm/nutrition/match-input-<source>-NN.json (80 ids per batch, in id order). Earlier
// match-input-<source>-NN.json files are removed first.
//
// CSV is read with an own parser (quotes, commas inside fields, CRLF): no dependency (CLAUDE.md invariant 15).
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { createReadStream, existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import type { Ingredient } from '../src/domain/dictionary.ts';
import { NON_FOOD_AISLES, type NutritionItem } from '../src/domain/nutrition.ts';

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * An incremental CSV parser: `push` text chunks, get the complete records back; `end` flushes the last one.
 * Handles quoted fields with commas, doubled quotes ("") and line breaks inside, and LF or CRLF line ends.
 * Empty lines are skipped.
 */
export class CsvReader {
  private field = '';
  private record: string[] = [];
  private quoted = false;
  /** The previous chunk ended on a quote inside a quoted field: it may be the first of a doubled "". */
  private pendingQuote = false;
  /** The current record has content (so an empty line is not a record). */
  private started = false;

  push(chunk: string): string[][] {
    const out: string[][] = [];
    let i = 0;
    const n = chunk.length;
    if (this.pendingQuote) {
      this.pendingQuote = false;
      if (n > 0 && chunk[0] === '"') {
        this.field += '"';
        i = 1;
      } else this.quoted = false;
    }
    while (i < n) {
      const c = chunk[i] as string;
      if (this.quoted) {
        if (c === '"') {
          if (i + 1 >= n) {
            this.pendingQuote = true;
            i++;
            continue;
          }
          if (chunk[i + 1] === '"') {
            this.field += '"';
            i += 2;
            continue;
          }
          this.quoted = false;
          i++;
          continue;
        }
        // Copy a run of plain characters at once.
        const next = chunk.indexOf('"', i);
        const end = next === -1 ? n : next;
        this.field += chunk.slice(i, end);
        i = end;
        continue;
      }
      if (c === '"') {
        this.quoted = true;
        this.started = true;
        i++;
      } else if (c === ',') {
        this.record.push(this.field);
        this.field = '';
        this.started = true;
        i++;
      } else if (c === '\n' || c === '\r') {
        if (this.started || this.field !== '') {
          this.record.push(this.field);
          out.push(this.record);
        }
        this.record = [];
        this.field = '';
        this.started = false;
        i++;
      } else {
        this.field += c;
        this.started = true;
        i++;
      }
    }
    return out;
  }

  end(): string[][] {
    this.pendingQuote = false;
    this.quoted = false;
    if (this.started || this.field !== '') {
      this.record.push(this.field);
      const last = this.record;
      this.record = [];
      this.field = '';
      this.started = false;
      return [last];
    }
    return [];
  }
}

/** All records of a CSV text (the first record is the header row, if the file has one). */
export function parseCsv(text: string): string[][] {
  const r = new CsvReader();
  const out = r.push(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  out.push(...r.end());
  return out;
}

/** Rows of a CSV text with a header row, as objects keyed by the header names. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  return rows.map((r) => {
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = r[i] ?? ''));
    return o;
  });
}

/** One CSV field: quoted when it holds a comma, a quote or a line break. */
export function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// ---------------------------------------------------------------------------
// The normalised table
// ---------------------------------------------------------------------------

export type TableState = 'raw' | 'cooked' | 'canned' | 'dried' | 'other';

export const TABLE_COLUMNS = ['code', 'name', 'name2', 'category', 'kcal', 'protein', 'fat', 'carbs', 'fibre', 'sodium_mg', 'alcohol', 'state'] as const;

export interface TableRow {
  code: string;
  name: string;
  name2: string;
  category: string;
  /** Per 100 g; null = unknown (empty in the CSV). */
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fibre: number | null;
  sodium_mg: number | null;
  alcohol: number | null;
  state: TableState;
}

const STATES: ReadonlySet<string> = new Set(['raw', 'cooked', 'canned', 'dried', 'other']);

/** Lower case, diacritics removed, split on everything that is not a letter. */
function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((w) => w !== '');
}

// When a name holds words of several states, the first state of this list wins: "Onions, cooked, boiled,
// drained" is cooked (not canned), "Chickpeas, canned, drained solids" canned, "Pasta, dry" dried.
const STATE_WORDS: readonly [TableState, ReadonlySet<string>][] = [
  ['cooked', new Set(['cooked', 'boiled', 'gekookt', 'bereid'])],
  ['canned', new Set(['canned', 'blik', 'drained'])],
  ['dried', new Set(['dried', 'dry', 'gedroogd'])],
  ['raw', new Set(['raw', 'rauw'])],
];

/** The state of a table product from its name: raw / cooked / canned / dried by the words in it, else other. */
export function stateFromName(name: string): TableState {
  const ws = new Set(words(name));
  for (const [state, set] of STATE_WORDS) for (const w of set) if (ws.has(w)) return state;
  return 'other';
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const t = v.trim();
  if (t === '') return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

/** The rows of a normalised table CSV (data/work/tables/<source>.csv). */
export function parseTable(text: string): TableRow[] {
  return parseCsvObjects(text).map((o) => {
    const state = o['state'] ?? '';
    const name = o['name'] ?? '';
    return {
      code: o['code'] ?? '',
      name,
      name2: o['name2'] ?? '',
      category: o['category'] ?? '',
      kcal: num(o['kcal']),
      protein: num(o['protein']),
      fat: num(o['fat']),
      carbs: num(o['carbs']),
      fibre: num(o['fibre']),
      sodium_mg: num(o['sodium_mg']),
      alcohol: num(o['alcohol']),
      state: (STATES.has(state) ? state : stateFromName(name)) as TableState,
    };
  });
}

/** The normalised table as CSV text (header row, LF line ends). */
export function formatTable(rows: readonly TableRow[]): string {
  const lines = [TABLE_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(
      TABLE_COLUMNS.map((k) => {
        const v = r[k];
        return v === null ? '' : csvField(String(v));
      }).join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// --normalize usda
// ---------------------------------------------------------------------------

/** USDA categories that never match an ingredient (brand and meal products). */
export const USDA_SKIPPED_CATEGORIES: ReadonlySet<string> = new Set([
  'Branded Food Products Database',
  'Fast Foods',
  'Restaurant Foods',
  'Baby Foods',
  'Meals, Entrees, and Side Dishes',
  'Quality Control Materials',
  'American Indian/Alaska Native Foods',
]);

/** USDA nutrient ids (SR Legacy). */
export const USDA_NUTRIENTS = {
  kcal: '1008',
  kcalAtwater: '2047',
  protein: '1003',
  fat: '1004',
  carbs: '1005',
  fibre: '1079',
  sodium_mg: '1093',
  alcohol: '1018',
} as const;

const USDA_ID_TO_KEY: ReadonlyMap<string, string> = new Map(Object.entries(USDA_NUTRIENTS).map(([k, v]) => [v, k]));

type UsdaAmounts = Partial<Record<keyof typeof USDA_NUTRIENTS, number>>;

/** A normalised row from one USDA food, its category text and its nutrient amounts. */
export function usdaRow(code: string, description: string, category: string, a: UsdaAmounts): TableRow {
  return {
    code,
    name: description,
    name2: '',
    category,
    kcal: a.kcal ?? a.kcalAtwater ?? null,
    protein: a.protein ?? null,
    fat: a.fat ?? null,
    carbs: a.carbs ?? null,
    fibre: a.fibre ?? null,
    sodium_mg: a.sodium_mg ?? null,
    alcohol: a.alcohol ?? null,
    state: stateFromName(description),
  };
}

/** Stream a CSV file record by record (the header row first). */
async function streamCsv(path: string, onRecord: (r: string[]) => void): Promise<void> {
  const reader = new CsvReader();
  let first = true;
  const stream = createReadStream(path, { encoding: 'utf8', highWaterMark: 1 << 20 });
  for await (const chunk of stream) {
    let text = chunk as string;
    if (first) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      first = false;
    }
    for (const r of reader.push(text)) onRecord(r);
  }
  for (const r of reader.end()) onRecord(r);
}

export async function normalizeUsda(root: string): Promise<{ written: number; skipped: number; path: string }> {
  const dir = join(root, 'data', 'work', 'tables', 'usda');
  for (const f of ['food.csv', 'food_nutrient.csv', 'food_category.csv']) {
    if (!existsSync(join(dir, f))) throw new Error(`missing ${join('data', 'work', 'tables', 'usda', f)}`);
  }
  const categories = new Map<string, string>();
  for (const o of parseCsvObjects(readFileSync(join(dir, 'food_category.csv'), 'utf8'))) categories.set(o['id'] ?? '', o['description'] ?? '');

  const foods: { code: string; description: string; category: string }[] = [];
  let skipped = 0;
  for (const o of parseCsvObjects(readFileSync(join(dir, 'food.csv'), 'utf8'))) {
    const category = categories.get(o['food_category_id'] ?? '') ?? '';
    if (USDA_SKIPPED_CATEGORIES.has(category)) {
      skipped++;
      continue;
    }
    foods.push({ code: o['fdc_id'] ?? '', description: o['description'] ?? '', category });
  }
  const wanted = new Set(foods.map((f) => f.code));

  const amounts = new Map<string, UsdaAmounts>();
  let head: string[] | null = null;
  let iFdc = -1;
  let iNut = -1;
  let iAmount = -1;
  await streamCsv(join(dir, 'food_nutrient.csv'), (r) => {
    if (!head) {
      head = r;
      iFdc = r.indexOf('fdc_id');
      iNut = r.indexOf('nutrient_id');
      iAmount = r.indexOf('amount');
      if (iFdc < 0 || iNut < 0 || iAmount < 0) throw new Error('food_nutrient.csv: expected the columns fdc_id, nutrient_id, amount');
      return;
    }
    const key = USDA_ID_TO_KEY.get(r[iNut] ?? '');
    if (!key) return;
    const fdc = r[iFdc] ?? '';
    if (!wanted.has(fdc)) return;
    const v = num(r[iAmount]);
    if (v === null) return;
    let a = amounts.get(fdc);
    if (!a) amounts.set(fdc, (a = {}));
    a[key as keyof UsdaAmounts] = v;
  });

  const rows = foods.map((f) => usdaRow(f.code, f.description, f.category, amounts.get(f.code) ?? {}));
  const path = join(root, 'data', 'work', 'tables', 'usda.csv');
  writeFileSync(path, formatTable(rows), 'utf8');
  return { written: rows.length, skipped, path };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

// English/Dutch function words plus NEVO's filler abbreviations ("Worst rook- gekookt gem", "Kaas Goudse 48+ gem",
// "bereid", "av" = average): they say nothing about the product and must not cost −2 in a head part.
const STOPWORDS: ReadonlySet<string> = new Set(['the', 'and', 'with', 'of', 'or', 'zonder', 'met', 'gem', 'gemiddeld', 'bereid', 'av', 'ca', 'excl', 'incl', 'ed']);

/** A crude English singular: tomatoes → tomato, cherries → cherry, peaches → peach, onions → onion; "ss" stays. */
export function singular(w: string): string {
  if (w.length <= 3 || !w.endsWith('s') || w.endsWith('ss')) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (/(oes|ches|shes|xes|zes)$/.test(w)) return w.slice(0, -2);
  return w.slice(0, -1);
}

/** Tokens for matching: lower case, split on non-letters, stopwords removed, a final "s" ignored. */
export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const w of words(text)) {
    if (STOPWORDS.has(w)) continue;
    const t = singular(w);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** What we search with for one ingredient. */
export interface MatchQuery {
  /** Tokens of our names and aliases (see `queryOf`). */
  tokens: ReadonlySet<string>;
  /**
   * Tokens of the primary name only (English `one`; for a Dutch-named table also Dutch `one`): a row that shares
   * none of them is never a candidate, whatever its aliases match (decision Fable after the V9b lens: the alias
   * "ground cinnamon" otherwise put "Emu, ground, raw" above "Spices, cinnamon, ground").
   */
  anchors: ReadonlySet<string>;
  /**
   * The ingredient itself is a preparation or a tinned / jarred form (its id or Dutch name holds blik,
   * ingeblikt, uit-blik, gedroogd or gekookt, or its defaultUnit is blik / pot): the state that then scores +2.
   */
  prepared: 'canned' | 'dried' | 'cooked' | null;
}

/** The minimal candidate `scoreCandidate` needs. */
export interface CandidateLike {
  name: string;
  name2?: string;
  state: TableState;
}

/** The prepared state of an ingredient (see MatchQuery.prepared). */
export function preparedState(id: string, nlName: string, defaultUnit: string | null | undefined): MatchQuery['prepared'] {
  const text = `${id} ${nlName}`.toLowerCase();
  if (text.includes('blik') || defaultUnit === 'blik' || defaultUnit === 'pot') return 'canned';
  if (text.includes('gedroogd')) return 'dried';
  if (text.includes('gekookt')) return 'cooked';
  return null;
}

/**
 * The query of one ingredient: tokens of the English name (singular and plural) and English aliases; for a
 * table with Dutch names (NEVO) also the Dutch name and Dutch aliases.
 */
export function queryOf(ing: Ingredient, withDutch: boolean): MatchQuery {
  const texts: string[] = [ing.en.one, ing.en.many ?? '', ...(ing.aliases?.en ?? [])];
  if (withDutch) texts.push(ing.nl.one, ing.nl.many ?? '', ...(ing.aliases?.nl ?? []));
  const set = new Set<string>();
  for (const t of texts) for (const w of tokens(t)) set.add(w);
  const anchors = new Set<string>(tokens(ing.en.one));
  if (withDutch) for (const w of tokens(ing.nl.one)) anchors.add(w);
  return { tokens: set, anchors, prepared: preparedState(ing.id, ing.nl.one, ing.defaultUnit) };
}

/**
 * The score of one table row for a query (docs/specs/verbeterronde-9b.md §1a, revised after the lens): +3 per
 * query token in the head comma part of `name`, +1 per query token elsewhere (the other parts, `name2`); −2 per
 * token of the head part that is not in the query; state raw +2, cooked −2, canned and dried −1 — but when the
 * ingredient is itself prepared (MatchQuery.prepared): that state +2 and raw 0. A row without any anchor token
 * scores −Infinity (never a candidate).
 */
export function scoreCandidate(query: MatchQuery, row: CandidateLike): number {
  // Decision Fable after the V9b lens (9 Nov 2026). USDA writes the food group first ("Spices, cinnamon,
  // ground", "Nuts, pine nuts, dried", "Cheese, gouda"), so the head is the comma part with the MOST query
  // tokens (a tie goes to the earlier part); the other parts cost nothing. And a row that shares no token with
  // the primary name (`anchors`) is out, whatever an alias matched.
  const all = tokens(row.name + ' ' + (row.name2 ?? ''));
  if (query.anchors.size > 0 && !all.some((w) => query.anchors.has(w))) return Number.NEGATIVE_INFINITY;
  // The comma parts of the name, then each ";"-separated synonym of name2 (NEVO: "Sausage smoked cooked av;
  // Rookworst gekookt gem") as a part of its own, so a synonym can be the head too.
  const parts = [...row.name.split(','), ...(row.name2 ? row.name2.split(';') : [])].map((p) => tokens(p));
  let head = 0;
  let best = -1;
  parts.forEach((ws, k) => {
    const hits = ws.filter((w) => query.tokens.has(w)).length;
    if (hits > best) {
      best = hits;
      head = k;
    }
  });
  const firstPart = new Set(parts[head]);
  const elsewhere = new Set(parts.flatMap((ws, k) => (k === head ? [] : ws)));
  let score = 0;
  for (const t of query.tokens) {
    if (firstPart.has(t)) score += 3;
    else if (elsewhere.has(t)) score += 1;
  }
  for (const t of firstPart) if (!query.tokens.has(t)) score -= 2;
  score += stateScore(query.prepared, row.state);
  return score;
}

function stateScore(prepared: MatchQuery['prepared'], state: TableState): number {
  if (prepared !== null) {
    if (state === prepared) return 2;
    if (state === 'raw') return 0;
  }
  switch (state) {
    case 'raw':
      return 2;
    case 'cooked':
      return -2;
    case 'canned':
    case 'dried':
      return -1;
    default:
      return 0;
  }
}

/** Number of candidates per ingredient. */
export const CANDIDATES_PER_ID = 8;
/** Ingredients per match-input batch. */
export const IDS_PER_BATCH = 80;

/**
 * A brand row: SR Legacy writes brand and company names in capitals inside ordinary categories ("Beverages,
 * Energy drink, RED BULL", "Kefir, lowfat, plain, LIFEWAY", "Gravy, HEINZ Home Style"). The app promises
 * "never brand values", so such a row is never a candidate (decision Fable after the V9b lens, 9 Nov 2026).
 */
export function isBrandRow(name: string): boolean {
  return /(^|[^A-Za-z])[A-Z][A-Z'&.-]{2,}(?![a-z])/.test(name);
}

/** The best rows (score > 0, no brand rows), highest score first; equal scores: shorter name first, then by code. */
export function bestCandidates<T extends CandidateLike & { code: string }>(query: MatchQuery, rows: readonly T[], n = CANDIDATES_PER_ID): T[] {
  const scored: { row: T; score: number }[] = [];
  for (const row of rows) {
    if (isBrandRow(row.name)) continue;
    const score = scoreCandidate(query, row);
    if (score > 0) scored.push({ row, score });
  }
  scored.sort((a, b) => b.score - a.score || a.row.name.length - b.row.name.length || (a.row.code < b.row.code ? -1 : a.row.code > b.row.code ? 1 : 0));
  return scored.slice(0, n).map((s) => s.row);
}

// ---------------------------------------------------------------------------
// --candidates <source>
// ---------------------------------------------------------------------------

export interface MatchInputCandidate {
  code: string;
  name: string;
  /** The second name of the table row (NEVO: the English name and synonyms); absent when the table has none. */
  name2?: string;
  category: string;
  state: TableState;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

export interface MatchInputItem {
  id: string;
  nl: string;
  en: string;
  aliasesEn: string[];
  defaultUnit: string | null;
  aisle: string;
  current: { kcal: number; protein: number; fat: number; carbs: number; source: string } | null;
  candidates: MatchInputCandidate[];
}

export interface MatchInputBatch {
  batch: string;
  source: string;
  items: MatchInputItem[];
}

/** Sources whose `name` is Dutch: the query then also holds our Dutch names. */
const DUTCH_NAMED_SOURCES: ReadonlySet<string> = new Set(['nevo']);

/** The match-input batches for one source (pure). */
export function buildMatchInput(
  source: string,
  rows: readonly TableRow[],
  ingredients: readonly Ingredient[],
  nutrition: Readonly<Record<string, NutritionItem>>,
): MatchInputBatch[] {
  const food = ingredients.filter((i) => !NON_FOOD_AISLES.has(i.aisle)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const withDutch = DUTCH_NAMED_SOURCES.has(source);
  const items: MatchInputItem[] = food.map((ing) => {
    const cur = nutrition[ing.id];
    return {
      id: ing.id,
      nl: ing.nl.one,
      en: ing.en.one,
      aliasesEn: [...(ing.aliases?.en ?? [])],
      defaultUnit: ing.defaultUnit ?? null,
      aisle: ing.aisle,
      current: cur ? { kcal: cur.kcal, protein: cur.protein, fat: cur.fat, carbs: cur.carbs, source: cur.source ?? 'estimate' } : null,
      candidates: bestCandidates(queryOf(ing, withDutch), rows).map((r) => ({
        code: r.code,
        name: r.name,
        ...(r.name2 ? { name2: r.name2 } : {}),
        category: r.category,
        state: r.state,
        kcal: r.kcal,
        protein: r.protein,
        fat: r.fat,
        carbs: r.carbs,
      })),
    };
  });
  const batches: MatchInputBatch[] = [];
  for (let i = 0; i < items.length; i += IDS_PER_BATCH) {
    batches.push({ batch: String(batches.length + 1).padStart(2, '0'), source, items: items.slice(i, i + IDS_PER_BATCH) });
  }
  return batches;
}

/** A match-input batch as text: the header keys, then one item per line block, candidates one per line. */
export function formatMatchInput(b: MatchInputBatch): string {
  const item = (it: MatchInputItem): string => {
    const { candidates, ...head } = it;
    const headText = JSON.stringify(head).slice(0, -1);
    if (candidates.length === 0) return `    ${headText}, "candidates": [] }`;
    return `    ${headText}, "candidates": [\n${candidates.map((c) => `      ${JSON.stringify(c)}`).join(',\n')}\n    ] }`;
  };
  return `{\n  "batch": ${JSON.stringify(b.batch)},\n  "source": ${JSON.stringify(b.source)},\n  "items": [\n${b.items.map(item).join(',\n')}\n  ]\n}\n`;
}

const SOURCE_RE = /^[a-z][a-z0-9]{0,15}$/;

export function writeCandidates(root: string, source: string): { batches: number; ids: number; empty: number } {
  const tablePath = join(root, 'data', 'work', 'tables', `${source}.csv`);
  if (!existsSync(tablePath)) throw new Error(`missing data/work/tables/${source}.csv (run --normalize first)`);
  const rows = parseTable(readFileSync(tablePath, 'utf8'));
  const ingredients = JSON.parse(readFileSync(join(root, 'data', 'ingredients.json'), 'utf8')) as Ingredient[];
  const nutritionPath = join(root, 'data', 'nutrition.json');
  const nutrition = existsSync(nutritionPath)
    ? ((JSON.parse(readFileSync(nutritionPath, 'utf8')) as { items?: Record<string, NutritionItem> }).items ?? {})
    : {};
  const batches = buildMatchInput(source, rows, ingredients, nutrition);
  const dir = join(root, 'data', 'llm', 'nutrition');
  const stale = new RegExp(`^match-input-${source}-\\d+\\.json$`);
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (stale.test(f)) unlinkSync(join(dir, f));
  for (const b of batches) writeFileSync(join(dir, `match-input-${source}-${b.batch}.json`), formatMatchInput(b), 'utf8');
  let ids = 0;
  let empty = 0;
  for (const b of batches) {
    ids += b.items.length;
    empty += b.items.filter((i) => i.candidates.length === 0).length;
  }
  return { batches: batches.length, ids, empty };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(argv: string[]): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const [mode, source] = argv;
  if ((mode !== '--normalize' && mode !== '--candidates') || !source || !SOURCE_RE.test(source)) {
    console.error('usage: nutrition-match.ts --normalize usda | --candidates <source>');
    process.exit(2);
  }
  if (mode === '--normalize') {
    if (source !== 'usda') {
      console.error(`--normalize knows only usda (NEVO is normalised by a separate script into data/work/tables/${source}.csv).`);
      process.exit(2);
    }
    const r = await normalizeUsda(root);
    console.log(`written: data/work/tables/usda.csv — ${r.written} row(s); ${r.skipped} food(s) of skipped categories left out`);
    return;
  }
  const r = writeCandidates(root, source);
  console.log(`written: data/llm/nutrition/match-input-${source}-01…${String(r.batches).padStart(2, '0')}.json — ${r.batches} batch(es), ${r.ids} id(s), ${r.empty} without any candidate`);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href && basename(process.argv[1]) === 'nutrition-match.ts';
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
