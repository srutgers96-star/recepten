// "Ontbrekende gegevens aanvullen met AI" in Meer → Woordenboek (docs/specs/labels-categorieen.md
// §1f, block 5). Framework-free.
//
// Like the translation prompt (translate-prompt.ts) the AI never runs in the app: the card puts a
// numbered prompt on the clipboard, the person pastes it into their AI and pastes the answer back.
// The numbers M1, M2 … are the contract that maps every answered line onto what was asked:
//
//   collectMissing(own, recipes, dict)    what to ask: own entries with a gap (English name, aisle,
//                                          diet flags), then the unrecognised lines of the own and
//                                          received recipes, grouped by name; at most 40 at a time
//   buildMissingPrompt(items, lang)       the prompt (NL or EN), one "M<n>." line per item
//   parseMissingAnswer(text)              the answered "M<n>." lines (tolerant: "M1:", "M1)",
//                                          markdown escapes, a code fence, chatter in between)
//   refreshMissingItems(items, own, dict) the items of a prompt copied earlier, held against the
//                                          dictionary as it is now (same numbers)
//   planMissingAnswer(items, rows, …)     what to write: updates of own entries and new entries
//                                          with the recipe lines they get linked to
//
// Decisions of the spec (§1f and the critical reader) this module follows:
// - An own entry ALWAYS has `nl.one` and `en.one` (both forms copy the one name into the other
//   language). "Without an English name" therefore means `en.one` is empty, or equals `nl.one`
//   (case-insensitive) while the entry is otherwise incomplete (aisle missing or `overig`, or one of
//   the flags vegan/gluten/lactose absent): the prompt says `en: ?` and keeps `nl` filled in. Once the
//   aisle and all three flags are filled in, the same name counts as confirmed (Fable, block 5:
//   csipetke, pesto, focaccia are the same in both languages) and the entry is no longer asked
//   about. `nl` of an own entry is never reported missing.
// - The aisle `overig` (the default) counts as missing ("schap: ?").
// - "misschien" (maybe) becomes `false` + `…Unsure: true`; an unknown aisle id keeps the current aisle.
// - A field that is already filled in is never touched; a new entry needs a Dutch AND an English name.
// - A new entry is vegetarian (`veg`) when the answer says "vegan: ja"; else not when its aisle (the
//   answered one, `overig` when unknown) is `vlees-vis`; else vegetarian, the default of the
//   "Nieuw ingrediënt" form (Fable, block 5). No prompt field asks for it.
// - An unrecognised line keeps the name in the language it is written in (invariant 3): a Dutch line
//   is "nl: <name> | en: ?", a line that only has English text is "nl: ? | en: <name>".
// - The answered name is the guard of the numbers: a row whose filled-in name (nl, or en for an
//   English line) is another ingredient's is skipped, so a shifted number never writes into the
//   wrong entry. A yes/no/maybe is read only when the whole value is that word ("no idea", "N/B",
//   "n.v.t." stay "?").
// - Lactose is STRICT (§2a): rule H1 — a plant-based entry (vegan: true) is `lactose: false` without
//   doubt — is applied, and an answer that says both "vegan: yes" and "lactose: yes" keeps the
//   lactose fact and leaves vegan unknown (never a lactose-free claim on a contradiction).
// The raw text of a recipe line is never touched here: linking only sets `ing`, through the repo's
// `linkUserRecipeLine` (invariant 2).
import type { Dictionary, Ingredient } from './dictionary.ts';
import { dutchBaseForms, englishBaseForms, normalizeKey } from './dictionary.ts';
import { pickText, type Lang, type Line, type Text } from './model.ts';
import { cleanPastedText } from './photo-import.ts';
import { slugId } from './recipe-source.ts';

/** How many items one prompt carries (§1f: "Eerst deze 40; daarna verschijnen de volgende."). */
export const MISSING_LIMIT = 40;

/**
 * A field the prompt can ask for, in prompt order. The UI labels them "Nederlands", "Engels",
 * "schap", "vegan", "gluten", "lactose" (`dict.missingRowUpdate`). `nl` is part of the vocabulary
 * but never reported missing for an own entry (decision of the critical reader, §1f); only a line
 * that has English text alone asks for it.
 */
export type MissingField = 'nl' | 'en' | 'aisle' | 'vegan' | 'gluten' | 'lactose';

export const MISSING_FIELDS: readonly MissingField[] = ['nl', 'en', 'aisle', 'vegan', 'gluten', 'lactose'];

/** One line of an own or received recipe: the arguments of `linkUserRecipeLine(recipeId, index, ing)`. */
export interface MissingLineRef {
  recipeId: string;
  /** Index into `recipe.lines`. */
  index: number;
}

/** An own dictionary entry with at least one gap. */
export interface MissingEntryItem {
  kind: 'entry';
  entry: Ingredient;
  /** What is missing, in `MISSING_FIELDS` order (never 'nl'). */
  missing: MissingField[];
}

/** Unrecognised recipe lines with the same name (`normalizeKey(line.name)`), as one would-be new entry. */
export interface MissingLineItem {
  kind: 'line';
  /**
   * The name part as written in the first occurrence (`line.name`, trimmed): the filled-in name of
   * the prompt line, in the language `lang` says.
   */
  name: string;
  /**
   * The language `name` is written in: Dutch when a line of the group has Dutch text (`raw.nl`),
   * English when the lines only have English text (an English or received recipe). The prompt
   * fills in that language and asks for the other one.
   */
  lang: Lang;
  /** `normalizeKey(name)`: the group key. */
  key: string;
  /** Every line with this name, in recipe order. */
  positions: MissingLineRef[];
  /** The first occurrence, for the prompt context: (uit "<recipe>": "<line>"). */
  recipeName: Text;
  raw: string;
  /** The other language's name, aisle, vegan, gluten and lactose: only the name is known. */
  missing: MissingField[];
}

export type MissingItem = MissingEntryItem | MissingLineItem;

/** The part of a recipe `collectMissing` reads (a `Recipe` fits). */
export interface MissingSourceRecipe {
  id: string;
  name: Text;
  lines: readonly Line[];
}

/** An answered yes/no/maybe ("ja"/"nee"/"misschien", "yes"/"no"/"maybe"). */
export type MissingTri = 'yes' | 'no' | 'unsure';

/**
 * One answered "M<n>." line. Fields the answer left as "?" (or did not give) are absent; a row with
 * only `n` had the marker but nothing readable (`dict.missingRowSkipped`).
 */
export interface MissingAnswerRow {
  n: number;
  nl?: string;
  en?: string;
  /** The aisle as written (lower-cased); `planMissingAnswer` maps it onto an aisle id. */
  aisle?: string;
  vegan?: MissingTri;
  gluten?: MissingTri;
  lactose?: MissingTri;
}

/** Fill in the gaps of an own entry (`dict.missingRowUpdate`): `saveUserIngredient(entry)`. */
export interface MissingUpdate {
  /** The M-number. */
  n: number;
  id: string;
  /** The entry with the answered fields filled in; every other field is the entry as it was. */
  entry: Ingredient;
  /** What gets filled in, in `MISSING_FIELDS` order (never empty). */
  fields: MissingField[];
}

/**
 * A new entry from unrecognised lines (`dict.missingRowNew`): `saveUserIngredient(entry)`, then
 * `linkUserRecipeLine(recipeId, index, entry.id)` for every link.
 */
export interface MissingCreate {
  n: number;
  entry: Ingredient;
  /** Every line of the group (the item's `positions`), linked to the new entry. */
  links: MissingLineRef[];
  /** Distinct recipes among `links` ("in {n} recept(en) gekoppeld"). */
  recipes: number;
}

export interface MissingPlan {
  updates: MissingUpdate[];
  creates: MissingCreate[];
  /**
   * M-numbers that give nothing to write (`dict.missingRowSkipped`): a marker without readable
   * fields, a number the prompt did not have, a new entry without an English name, or an answer
   * that only repeats what is already there.
   */
  skipped: number[];
}

// --- collecting -------------------------------------------------------------------------------------

function trimmed(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

/** Case-insensitive equality of two names (the critical reader: "hoofdletterongevoelig gelijk"). */
function sameName(a: string, b: string): boolean {
  return trimmed(a).toLowerCase() === trimmed(b).toLowerCase();
}

/**
 * An English name that is missing: empty, or the copy of the Dutch one while the entry still has
 * another gap (`otherGaps`). With the aisle and the three flags filled in, the same name counts as
 * confirmed (Fable, block 5): an empty `en.one` is always missing.
 */
function enMissing(entry: Ingredient, otherGaps: boolean): boolean {
  const en = trimmed(entry.en?.one);
  return en === '' || (otherGaps && sameName(en, trimmed(entry.nl?.one)));
}

function aisleMissing(aisle: unknown): boolean {
  const a = trimmed(aisle);
  return a === '' || a === 'overig';
}

/**
 * The gaps of an own entry, in `MISSING_FIELDS` order. `nl` is never one of them; `en` is one when
 * `en.one` is empty, or equals `nl.one` (case-insensitive) while one of the other fields is missing.
 */
export function missingFieldsOf(entry: Ingredient): MissingField[] {
  const rest: MissingField[] = [];
  if (aisleMissing(entry.aisle)) rest.push('aisle');
  if (typeof entry.vegan !== 'boolean') rest.push('vegan');
  if (typeof entry.gluten !== 'boolean') rest.push('gluten');
  if (typeof entry.lactose !== 'boolean') rest.push('lactose');
  return enMissing(entry, rest.length > 0) ? ['en', ...rest] : rest;
}

const FLAG_FIELDS: readonly MissingField[] = ['aisle', 'vegan', 'gluten', 'lactose'];

/** What a line item asks for: the name in the other language, the aisle and the three flags. */
function lineMissing(lang: Lang): MissingField[] {
  return [lang === 'nl' ? 'en' : 'nl', ...FLAG_FIELDS];
}

function sortName(entry: Ingredient): string {
  return normalizeKey(trimmed(entry.nl?.one) || trimmed(entry.en?.one) || entry.id);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The raw line as written: the Dutch text, else the English. */
function rawOf(line: Line): string {
  return trimmed(pickText(line.raw, 'nl'));
}

/**
 * The language a line's `name` is written in: the editor and the parser take the name from the
 * Dutch text when there is one, else from the English (`effectiveLine`, `parseLine`).
 */
function lineLang(line: Line): Lang {
  if (trimmed(line.raw?.nl)) return 'nl';
  return trimmed(line.raw?.en) ? 'en' : 'nl';
}

/**
 * What the prompt asks for (§1f, §3 block 5): first the own entries with a gap (`missingFieldsOf`:
 * an English name equal to the Dutch one is a gap only while the entry has another one; sorted by name),
 * then the unrecognised lines of `recipes` (the own and received recipes; classics are skipped),
 * grouped by `normalizeKey(line.name)` and sorted by that key. Skipped: headers, lines whose name
 * is 2 characters or shorter, and lines whose name the dictionary already knows (`findExisting`:
 * not a gap in the dictionary, and a new entry would only duplicate it). `dict` is the dictionary
 * the app renders with (bundled + own entries); a line counts as unrecognised when it has no `ing`
 * or one this dictionary does not know. At most `limit` items; pass `Infinity` for the full count.
 * The prompt numbers the result in order: items[i] is "M<i+1>".
 */
export function collectMissing(own: readonly Ingredient[], recipes: readonly MissingSourceRecipe[], dict: Dictionary, limit = MISSING_LIMIT): MissingItem[] {
  if (!(limit > 0)) return [];
  const entries: MissingEntryItem[] = [];
  for (const entry of own) {
    if (!entry || typeof entry.id !== 'string') continue;
    const missing = missingFieldsOf(entry);
    if (missing.length > 0) entries.push({ kind: 'entry', entry, missing });
  }
  entries.sort((a, b) => compare(sortName(a.entry), sortName(b.entry)) || compare(a.entry.id, b.entry.id));

  const groups = new Map<string, MissingLineItem>();
  for (const recipe of recipes) {
    if (!recipe || typeof recipe.id !== 'string' || recipe.id.startsWith('b:')) continue;
    (recipe.lines ?? []).forEach((line, index) => {
      if (!line || line.kind === 'header') return;
      if (line.ing && dict.get(line.ing)) return;
      const name = trimmed(line.name);
      const key = normalizeKey(name);
      if (key.length <= 2) return;
      const lang = lineLang(line);
      const group = groups.get(key);
      if (group) {
        group.positions.push({ recipeId: recipe.id, index });
        // The same name on a Dutch line: the name is (also) Dutch, so the prompt asks for English.
        if (lang === 'nl' && group.lang === 'en') {
          group.lang = 'nl';
          group.missing = lineMissing('nl');
        }
        return;
      }
      if (dict.findExisting(name, lang)) return;
      groups.set(key, { kind: 'line', name, lang, key, positions: [{ recipeId: recipe.id, index }], recipeName: recipe.name ?? {}, raw: rawOf(line), missing: lineMissing(lang) });
    });
  }
  const lines = [...groups.values()].sort((a, b) => compare(a.key, b.key));
  return [...entries, ...lines].slice(0, limit);
}

// --- the prompt -------------------------------------------------------------------------------------

/** The 17 aisle ids in data/aisles.json order, literally as §1f writes them. */
const AISLE_LIST =
  'groente-fruit, brood-ontbijt, vlees-vis, zuivel-eieren, kaas, droog, blik-pot, kruiden-specerijen, sauzen-olie-azijn, wereld, bakken, diepvries, dranken, snacks-zoet, huishoudelijk, drogisterij, overig';

/** The instructions of §1f (NL literally; EN the same with "aisle" for "schap"). */
const HEAD: Record<Lang, string[]> = {
  nl: [
    'Vul voor elk genummerd ingrediënt de ontbrekende gegevens aan (de vraagtekens). Antwoord ALLEEN met de regels hieronder, in één codeblok, één regel per nummer, in precies dit formaat:',
    'M1. nl: <naam, enkelvoud> | en: <British English name, singular> | schap: <id> | vegan: ja/nee | gluten: ja/nee/misschien | lactose: ja/nee/misschien',
    `Schap is één van: ${AISLE_LIST}. Lactose streng: elk zuivelproduct (ook harde kaas, boter, ghee) is "ja". Verander niets wat al is ingevuld.`,
  ],
  en: [
    'For each numbered ingredient, fill in the missing details (the question marks). Answer ONLY with the lines below, in one code block, one line per number, in exactly this format:',
    'M1. nl: <Dutch name, singular> | en: <British English name, singular> | aisle: <id> | vegan: yes/no | gluten: yes/no/maybe | lactose: yes/no/maybe',
    `Aisle is one of: ${AISLE_LIST}. Lactose strictly: every dairy product (also hard cheese, butter, ghee) is "yes". Do not change anything that is already filled in.`,
  ],
};

const WORDS: Record<Lang, { aisle: string; yes: string; no: string; maybe: string; from: string }> = {
  nl: { aisle: 'schap', yes: 'ja', no: 'nee', maybe: 'misschien', from: 'uit' },
  en: { aisle: 'aisle', yes: 'yes', no: 'no', maybe: 'maybe', from: 'from' },
};

/** A value on one prompt line: one line, no field separator inside. */
function value(s: string): string {
  const v = trimmed(s).replace(/\|/g, '/');
  return v === '' ? '?' : v;
}

function flagWord(on: boolean | undefined, unsure: boolean | undefined, lang: Lang): string {
  const w = WORDS[lang];
  if (on === true) return w.yes;
  if (on === false) return unsure === true ? w.maybe : w.no;
  return '?';
}

function promptLine(item: MissingItem, n: number, lang: Lang): string {
  const w = WORDS[lang];
  const ask = new Set(item.missing);
  if (item.kind === 'line') {
    const context = `(${w.from} "${value(pickText(item.recipeName, lang))}": "${value(item.raw)}") `;
    const nl = item.lang === 'en' ? '?' : value(item.name);
    const en = item.lang === 'en' ? value(item.name) : '?';
    return `M${n}. ${context}nl: ${nl} | en: ${en} | ${w.aisle}: ? | vegan: ? | gluten: ? | lactose: ?`;
  }
  const e = item.entry;
  const nl = value(e.nl?.one ?? '');
  const en = ask.has('en') ? '?' : value(e.en?.one ?? '');
  const aisle = ask.has('aisle') ? '?' : value(e.aisle ?? '');
  const vegan = ask.has('vegan') ? '?' : flagWord(e.vegan, false, lang);
  const gluten = ask.has('gluten') ? '?' : flagWord(e.gluten, e.glutenUnsure, lang);
  const lactose = ask.has('lactose') ? '?' : flagWord(e.lactose, e.lactoseUnsure, lang);
  return `M${n}. nl: ${nl} | en: ${en} | ${w.aisle}: ${aisle} | vegan: ${vegan} | gluten: ${gluten} | lactose: ${lactose}`;
}

/**
 * The prompt for an external AI (§1f), in the UI language: the instructions, a blank line, then one
 * "M<n>." line per item (items[i] = M<i+1>). Filled-in fields are written out, `?` is what is
 * missing; an unrecognised line carries its recipe and raw text as context.
 */
export function buildMissingPrompt(items: readonly MissingItem[], lang: Lang): string {
  return [...HEAD[lang], '', ...items.map((item, i) => promptLine(item, i + 1, lang))].join('\n') + '\n';
}

// --- reading the answer -----------------------------------------------------------------------------

/** "M1.", "M1:", "M1)", "**M1.**", "- M1 -", "| M1 |" at the start of a line. */
const MARKER_RE = /^[\s*_>#|•-]*M\s?(\d{1,3})\s*(?:[.:)\]|]|-(?=\s)|(?=\s)|$)\**\s*(.*)$/u;
/** A field key: "nl:", "**en:**", "schap:", "aisle:", "vegan:", "gluten:", "lactose:". */
const KEY_RE = /(?<![\p{L}\p{N}])(nl|en|schap|aisle|vegan|gluten|lactose)\**\s*:\**/giu;
/** A continuation line (the AI wrapped a row): starts with a field key. */
const CONTINUATION_RE = /^[\s|*_]*(?:nl|en|schap|aisle|vegan|gluten|lactose)\**\s*:/iu;
const FENCE_RE = /^\s*`{3,}/u;
/** A value that says "not known": ?, …, -, n/a, onbekend, unknown. */
const EMPTY_RE = /^(?:\?+|…|\.{3}|-+|—|n\/a|onbekend|unknown)$/iu;
/** The format line of the prompt itself ("ja/nee", "<id>", "<naam, enkelvoud>"): a placeholder, never an answer. */
const PLACEHOLDER_RE = /^(?:<.*>|(?:ja|yes)\s*\/\s*(?:nee|no)(?:\s*\/\s*(?:misschien|maybe))?)$/iu;

/**
 * The whole value must be one of these words (after an explanation in brackets and a full stop are
 * taken off): "no idea", "N/B", "n.v.t." or "nee/misschien" are not a "no" (§2a: never a sure
 * lactose-free or gluten-free claim on doubt); they stay "?".
 */
const YES_WORDS: ReadonlySet<string> = new Set(['ja', 'yes', 'true', 'waar']);
const NO_WORDS: ReadonlySet<string> = new Set(['nee', 'no', 'false', 'onwaar']);
/** A doubt word at the start ("misschien", "maybe wel") is "maybe" (= `false` + unsure). */
const MAYBE_RE = /^(?:misschien|maybe|perhaps|possibly|unsure|onzeker|mogelijk|soms|sometimes)(?![\p{L}\p{N}])/iu;

/** Leading "(uit "Recept": "regel")" context the AI may copy along: skipped with balanced brackets. */
function skipContext(body: string): string {
  const s = body.replace(/^\s+/u, '');
  if (!s.startsWith('(')) return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return s.slice(i + 1);
    }
  }
  return s;
}

/** A field value without separators, markdown, quotes or angle brackets; undefined for "?" and placeholders. */
function cleanValue(raw: string): string | undefined {
  let v = raw.trim().replace(/[|;,]+$/u, '').trim();
  v = v.replace(/^[*_`]+|[*_`]+$/gu, '').trim();
  const pairs: [string, string][] = [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’'], ['„', '”']];
  for (const [open, close] of pairs) {
    if (v.length >= 2 && v.startsWith(open) && v.endsWith(close)) {
      v = v.slice(open.length, v.length - close.length).trim();
      break;
    }
  }
  if (v === '' || EMPTY_RE.test(v) || PLACEHOLDER_RE.test(v)) return undefined;
  return v;
}

function triOf(v: string | undefined): MissingTri | undefined {
  if (!v) return undefined;
  const word = v
    .replace(/\s*\([^()]*\)\s*$/u, '')
    .replace(/[.!]+$/u, '')
    .trim()
    .toLowerCase();
  if (MAYBE_RE.test(word)) return 'unsure';
  if (YES_WORDS.has(word)) return 'yes';
  if (NO_WORDS.has(word)) return 'no';
  return undefined;
}

/** The fields of one row body ("nl: … | en: … | schap: …"); the first value of a key wins. */
function readFields(body: string, row: MissingAnswerRow): void {
  const text = skipContext(body);
  const keys = [...text.matchAll(KEY_RE)];
  keys.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < keys.length ? (keys[i + 1]?.index ?? text.length) : text.length;
    const v = cleanValue(text.slice(start, end));
    if (v === undefined) return;
    const key = (m[1] as string).toLowerCase();
    if (key === 'nl' || key === 'en') {
      if (row[key] === undefined) row[key] = v;
    } else if (key === 'schap' || key === 'aisle') {
      if (row.aisle === undefined) row.aisle = v.toLowerCase();
    } else {
      const k = key as 'vegan' | 'gluten' | 'lactose';
      const tri = triOf(v);
      if (tri && row[k] === undefined) row[k] = tri;
    }
  });
}

/**
 * The answered lines, by M-number (ascending). Tolerant (§6a): `cleanPastedText` first (markdown
 * escapes, zero-width characters), code fences and chatter between the rows are ignored, the
 * marker may be "M1.", "M1:" or "M1)", a row the AI wrapped continues on a line that starts with a
 * field key, and the "(uit …)" context may be copied along. A number that occurs twice (the prompt
 * pasted along with the answer) is merged: the first value of each field wins, and the prompt's own
 * lines only hold "?" and placeholders. A row with only `n` had a marker but nothing readable.
 */
export function parseMissingAnswer(text: string): MissingAnswerRow[] {
  const rows = new Map<number, MissingAnswerRow>();
  let current: MissingAnswerRow | null = null;
  for (const rawLine of cleanPastedText(text ?? '').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || FENCE_RE.test(line)) {
      current = null;
      continue;
    }
    const m = MARKER_RE.exec(line);
    if (m) {
      const n = Number(m[1]);
      if (!(n > 0)) continue;
      let row = rows.get(n);
      if (!row) {
        row = { n };
        rows.set(n, row);
      }
      current = row;
      readFields(m[2] ?? '', row);
      continue;
    }
    if (current && CONTINUATION_RE.test(line)) readFields(line.replace(/^[\s|]+/u, ''), current);
    // Anything else is chatter.
  }
  return [...rows.values()].sort((a, b) => a.n - b.n);
}

// --- planning the writes ----------------------------------------------------------------------------

/** The aisle id for an answered aisle: the id itself, its slug, or the aisle's Dutch/English name. */
function aisleIdOf(answer: string | undefined, dict: Dictionary): string | undefined {
  if (!answer) return undefined;
  const direct = answer.trim().toLowerCase();
  if (dict.aisle(direct)) return direct;
  const slug = slugId(answer);
  if (slug && dict.aisle(slug)) return slug;
  const key = normalizeKey(answer);
  return dict.aisles.find((a) => normalizeKey(a.nl) === key || normalizeKey(a.en) === key)?.id;
}

interface FlagWrite {
  vegan?: boolean;
  gluten?: { gluten: boolean; unsure: boolean };
  lactose?: { lactose: boolean; unsure: boolean };
}

/**
 * The diet flags an answer may write into `base`, only for the fields in `ask`. Lactose is strict
 * (§2a): rule H1 — vegan (already true, or answered yes) means `lactose: false` without doubt; an
 * answer of vegan yes + lactose yes keeps the lactose fact and leaves vegan unknown; vegan yes is
 * also dropped when it would clash with a filled-in fact (`veg: false`, `lactose: true` or a
 * "misschien lactose" that may not be touched).
 */
function flagWrites(base: Partial<Ingredient>, row: MissingAnswerRow, ask: ReadonlySet<MissingField>): FlagWrite {
  const out: FlagWrite = {};
  if (ask.has('vegan')) {
    if (row.vegan === 'no') out.vegan = false;
    else if (row.vegan === 'yes' && base.veg !== false) {
      const lactoseCanBeFalse = ask.has('lactose') ? row.lactose !== 'yes' : base.lactose === false && base.lactoseUnsure !== true;
      if (lactoseCanBeFalse) out.vegan = true;
    }
  }
  if (ask.has('gluten') && row.gluten) out.gluten = { gluten: row.gluten === 'yes', unsure: row.gluten === 'unsure' };
  if (ask.has('lactose')) {
    const vegan = out.vegan ?? base.vegan;
    if (vegan === true) out.lactose = { lactose: false, unsure: false };
    else if (row.lactose) out.lactose = { lactose: row.lactose === 'yes', unsure: row.lactose === 'unsure' };
  }
  return out;
}

function applyFlags(entry: Ingredient, w: FlagWrite): void {
  if (w.vegan !== undefined) {
    entry.vegan = w.vegan;
    // Vegan implies vegetarian (the same rule as the dictionary form).
    if (w.vegan) entry.veg = true;
  }
  if (w.gluten) {
    entry.gluten = w.gluten.gluten;
    if (w.gluten.unsure) entry.glutenUnsure = true;
    else delete entry.glutenUnsure;
  }
  if (w.lactose) {
    entry.lactose = w.lactose.lactose;
    if (w.lactose.unsure) entry.lactoseUnsure = true;
    else delete entry.lactoseUnsure;
  }
}

/** The English name object for a filled-in `en`: a plural is kept only when it is not the Dutch copy. */
function enName(entry: Ingredient, one: string): { one: string; many?: string } {
  const many = trimmed(entry.en?.many);
  const copy = many === '' || sameName(many, trimmed(entry.nl?.many)) || sameName(many, trimmed(entry.nl?.one)) || sameName(many, trimmed(entry.en?.one));
  return copy ? { one } : { one, many };
}

function planUpdate(item: MissingEntryItem, row: MissingAnswerRow, dict: Dictionary): MissingUpdate | null {
  const base = item.entry;
  // Only what is missing NOW may be written: a field that is filled in is never touched.
  const ask = new Set(missingFieldsOf(base).filter((f) => item.missing.includes(f)));
  const next: Ingredient = { ...base };
  const fields = new Set<MissingField>();
  if (ask.has('en') && row.en && !sameName(row.en, trimmed(base.nl?.one))) {
    next.en = enName(base, row.en);
    fields.add('en');
  }
  if (ask.has('aisle')) {
    const aisle = aisleIdOf(row.aisle, dict);
    // An unknown aisle id keeps the current aisle (§1f).
    if (aisle && aisle !== base.aisle) {
      next.aisle = aisle;
      fields.add('aisle');
    }
  }
  const w = flagWrites(base, row, ask);
  applyFlags(next, w);
  if (w.vegan !== undefined) fields.add('vegan');
  if (w.gluten) fields.add('gluten');
  if (w.lactose) fields.add('lactose');
  if (fields.size === 0) return null;
  return { n: row.n, id: base.id, entry: next, fields: MISSING_FIELDS.filter((f) => fields.has(f)) };
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function hasAnyField(row: MissingAnswerRow): boolean {
  return [row.nl, row.en, row.aisle, row.vegan, row.gluten, row.lactose].some((v) => v !== undefined);
}

/** A name with the singular of its (last) word: "sultana's" → "sultana", "chorizo sausages" → "chorizo sausage". */
function nameForms(name: string, lang: Lang): Set<string> {
  const out = new Set<string>();
  const key = normalizeKey(trimmed(name));
  if (!key) return out;
  out.add(key);
  const base = lang === 'nl' ? dutchBaseForms : englishBaseForms;
  for (const f of base(key)) out.add(f);
  const words = key.split(' ');
  if (words.length > 1) {
    const head = words.slice(0, -1).join(' ');
    for (const f of base(words[words.length - 1] as string)) out.add(`${head} ${f}`);
  }
  return out;
}

/**
 * Whether the answered name belongs to the asked one (the guard against shifted numbers): the same
 * name (`normalizeKey`), or the singular of it — the prompt asks for "<naam, enkelvoud>". A row
 * without that name cannot be checked and passes; so does an item without a name.
 */
function sameIngredient(answer: string | undefined, asked: string, lang: Lang): boolean {
  if (answer === undefined) return true;
  const want = nameForms(asked, lang);
  if (want.size === 0) return true;
  for (const f of nameForms(answer, lang)) if (want.has(f)) return true;
  return false;
}

/** The filled-in name of an item and its language: what the row must repeat. */
function askedName(item: MissingItem): { name: string; lang: Lang } {
  if (item.kind === 'entry') return { name: trimmed(item.entry.nl?.one), lang: 'nl' };
  return { name: item.name, lang: item.lang };
}

function planCreate(item: MissingLineItem, row: MissingAnswerRow, dict: Dictionary, newId: (nl: string, en: string) => string, taken: Set<string>): MissingCreate | null {
  // The line's own name is filled in and never changed (in its own language, invariant 3); the
  // name in the other language must be answered.
  const nl = trimmed(item.lang === 'en' ? row.nl : item.name);
  const en = trimmed(item.lang === 'en' ? item.name : row.en);
  if (!nl || !en) return null;
  let base = newId(nl, en);
  if (typeof base !== 'string' || !ID_RE.test(base)) base = slugId(nl) || slugId(en) || 'ingredient';
  let id = base;
  for (let k = 2; taken.has(id) || dict.get(id); k++) id = `${base}-${k}`;
  taken.add(id);
  // The defaults of the dictionary's own "Nieuw ingrediënt" form (IngredientPicker): counted pieces,
  // not a staple, vegetarian. Vegetarian is not asked (Fable, block 5): "vegan: ja" means yes, else
  // the aisle `vlees-vis` means no, else the form's default (yes).
  const aisle = aisleIdOf(row.aisle, dict) ?? 'overig';
  const veg = row.vegan === 'yes' || aisle !== 'vlees-vis';
  const entry: Ingredient = { id, nl: { one: nl }, en: { one: en }, aisle, defaultUnit: 'stuk', staple: false, veg };
  applyFlags(entry, flagWrites({}, row, new Set(FLAG_FIELDS)));
  const links = item.positions.map((p) => ({ ...p }));
  return { n: row.n, entry, links, recipes: new Set(links.map((p) => p.recipeId)).size };
}

/**
 * The items of a prompt that was copied earlier, held against the dictionary as it is now, so an
 * answer fills in what its number asked for (items[i] stays M<i+1>, whatever was added or
 * completed since) without writing over a change made in between: an own entry becomes its
 * current version (`planMissingAnswer` then writes only what is still missing), an own entry that
 * was deleted and a line whose name the dictionary knows by now (`collectMissing` leaves those
 * out) become undefined, so their answers are skipped.
 */
export function refreshMissingItems(items: readonly MissingItem[], own: readonly Ingredient[], dict: Dictionary): (MissingItem | undefined)[] {
  const byId = new Map(own.filter((e) => e && typeof e.id === 'string').map((e) => [e.id, e] as const));
  return items.map((item) => {
    if (item.kind === 'entry') {
      const current = byId.get(item.entry.id);
      return current ? { ...item, entry: current } : undefined;
    }
    return dict.findExisting(item.name, item.lang) ? undefined : item;
  });
}

/**
 * What to write for an answer (§1f, §3 block 5): `items` exactly as the prompt was built from
 * (items[i] = M<i+1>; `refreshMissingItems` for a prompt copied earlier, undefined = skip),
 * `rows` from `parseMissingAnswer`. A row whose filled-in name (nl; en for an English line) is not
 * the item's is skipped: the numbers no longer match. An own entry gets an update with only the
 * fields that were missing (a filled-in field is never touched; an answered English name that is
 * the Dutch one again does not count); unrecognised lines become a new entry — only with a Dutch
 * AND an English name — linked to every line in the group. `newId(nl, en)` proposes an id for a new
 * entry (the app passes `uniqueIngredientId`); ids are kept unique against `dict` and each other.
 * Lactose strict, "misschien" = `false` + unsure, an unknown aisle keeps the current one. A new
 * entry's `veg`: true on "vegan: ja", else false when its aisle is `vlees-vis`, else true.
 */
export function planMissingAnswer(items: readonly (MissingItem | undefined)[], rows: readonly MissingAnswerRow[], dict: Dictionary, newId: (nl: string, en: string) => string): MissingPlan {
  const plan: MissingPlan = { updates: [], creates: [], skipped: [] };
  const taken = new Set<string>();
  const seen = new Set<number>();
  for (const row of [...rows].sort((a, b) => a.n - b.n)) {
    if (seen.has(row.n)) continue;
    seen.add(row.n);
    const item = Number.isInteger(row.n) && row.n >= 1 ? items[row.n - 1] : undefined;
    // A marker without one readable field is skipped, even where a rule could derive a value.
    if (!item || !hasAnyField(row)) {
      plan.skipped.push(row.n);
      continue;
    }
    // The answer is for another ingredient (the numbers shifted, or the AI changed the name).
    const asked = askedName(item);
    if (!sameIngredient(asked.lang === 'nl' ? row.nl : row.en, asked.name, asked.lang)) {
      plan.skipped.push(row.n);
      continue;
    }
    if (item.kind === 'entry') {
      const update = planUpdate(item, row, dict);
      if (update) plan.updates.push(update);
      else plan.skipped.push(row.n);
    } else {
      const create = planCreate(item, row, dict, newId, taken);
      if (create) plan.creates.push(create);
      else plan.skipped.push(row.n);
    }
  }
  return plan;
}
