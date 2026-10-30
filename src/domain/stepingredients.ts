// The recipe's own ingredients inside a step's text (docs/phase-6-spec.md 13I). Framework-free.
//
//   "Roer bloem, paprikapoeder en cayennepeper erdoor."
//    -> [bloem] -> line 7 (2 el)   [paprikapoeder] -> line 8 (2 el)   [cayennepeper] -> line 9 (1 tl)
//
// Only the names of THIS recipe's lines are looked for, in the language of the step: the dictionary
// entry's singular, plural and aliases, the names of resolved alternatives, and `line.name` when the
// line is written in that language. Matching is case-insensitive and diacritic-insensitive, on whole
// words only, longest name first, never overlapping. Precision over recall (a wrong green word is
// worse than a missed one), so a name is left out when:
//   - it is directly glued to a hyphen ("ui-paprikamengsel" is not "ui");
//   - the words around it name a DIFFERENT dictionary ingredient ("olive oil" is not "oil",
//     "zure room" is not "room", "egg yolk" is not "egg", "cheese sauce" is not "cheese");
//   - it names two different ingredients of the recipe, or it is also the name of a staple from
//     another aisle that the recipe does not list ("pepper" for a bell pepper: "salt and pepper");
//   - a kitchen tool or "mixture" follows ("potato masher", "the egg mixture") or it is an
//     ordinary word in that language (STOP);
//   - a preparation made with it follows in English ("the courgette sauce", "the garlic oil", "the
//     nut crumble"), or it opens a sentence as a verb ("Butter a dish", "Flour the worktop").
// "Ruim water", "de helft van de boter", "wat witte wijn", "a little more olive oil", "the butter left
// in the pan", "2 el olie", "the third tbsp of olive oil": the amount is in the text (`qtyInText`).
// Offsets are UTF-16 offsets into the text exactly as passed in, so the UI can slice it.
// 13D (docs/specs/varianten-tabs.md §3): on a diet tab a swapped line carries `swappedFrom` (the old
// ingredient id, display-only, src/domain/variants.ts `applyStoredSwap`) and, when the old line had an
// alternative, `swappedAlt` (its id: "farfalle (of een andere pastasoort)" -> 'pasta'). Step texts are
// never rewritten, so the names of both are looked for too; such a match gets `viaSwap: true` and
// "hoeveel?" says what it became ("400 g glutenvrije pasta" behind "spaghetti" or "pasta").
// Corpus sweep (196 classics, 16 Oct 2026, after review): 585 of 659 Dutch and 581 of 659 English steps
// (89% / 88%) get at least one match.
import { normalizeKey, dutchBaseForms, englishBaseForms, type Dictionary, type Ingredient } from './dictionary.ts';
import type { Lang, Line } from './model.ts';
import { isTasteNote, renderLineParts } from './render.ts';
import { scaleKindOf } from './scale.ts';

export interface StepIngredientMatch {
  /** UTF-16 offset of the first character of the name in the text that was passed in. */
  start: number;
  /** UTF-16 offset just past the name (exclusive): `text.slice(start, end)` is the green word(s). */
  end: number;
  /**
   * Indexes into the `lines` array, ascending. Usually one; more when the recipe has the ingredient
   * on several lines (butter for the dough and for the sauce; a green and a red pepper).
   */
  lines: number[];
  /**
   * True when the step text itself already says how much, right before the name ("voeg 15 g
   * paprikapoeder toe", "2 el olie", "1 ui", "a pinch of salt") or that only part of it, or an
   * unmeasured amount, is meant ("de helft van de boter", "the remaining butter", "ruim water"):
   * the UI then adds no quantity.
   */
  qtyInText: boolean;
  /**
   * Present only when the text names an ALTERNATIVE of a line ("boter" for "3 el olijfolie of 30 g
   * boter"): same length as `lines`, the index in that line's `alt` array, -1 = the line's own
   * ingredient. `matchQuantityText` / `spokenStepQuantities` then use the alternative's amount.
   */
  alt?: number[];
  /**
   * 13D: present (true) only when the text named the OLD product of a swapped line of a diet tab
   * (`line.swappedFrom`, or its dropped alternative `line.swappedAlt`): "spaghetti" for "400 g
   * glutenvrije pasta". `matchQuantityText` then adds the new name to the amount.
   */
  viaSwap?: boolean;
}

/** A piece of a step text for rendering: plain text, or a recognised ingredient. */
export interface StepSegment {
  text: string;
  match: StepIngredientMatch | null;
}

// --- folding ---------------------------------------------------------------------------------

/**
 * The text lowercased with diacritics removed, whitespace runs collapsed to one space and curly
 * quotes straightened, plus for every UTF-16 unit of the folded text the range of the original
 * text it came from. Matching happens on the folded text; offsets are mapped back through
 * `from`/`to`, so "crème fraîche" (precomposed or decomposed) keeps its exact original offsets.
 */
interface Folded {
  s: string;
  from: number[];
  to: number[];
}

const MARK = /\p{M}/u;
const MARKS = /\p{M}+/gu;
const SPACE = /\s/u;
const QUOTE = /[’‘`´]/u;
const DASH = /[‐‑‒–—]/u;

function foldText(text: string): Folded {
  let s = '';
  const from: number[] = [];
  const to: number[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = String.fromCodePoint(text.codePointAt(i) as number);
    const next = i + ch.length;
    let f: string;
    if (SPACE.test(ch)) f = s === '' || s.endsWith(' ') ? '' : ' ';
    else if (QUOTE.test(ch)) f = "'";
    else if (DASH.test(ch)) f = '-';
    else f = ch.toLowerCase().normalize('NFD').replace(MARKS, '');
    for (let k = 0; k < f.length; k++) {
      s += f[k];
      from.push(i);
      to.push(next);
    }
    i = next;
  }
  return { s, from, to };
}

/** A candidate name folded the same way as a step text. */
function foldKey(name: string): string {
  return foldText(name).s.trim();
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && WORD_CHAR.test(c);
}

// --- per-dictionary index ---------------------------------------------------------------------

interface DictIndex {
  /** Folded name (one, many, alias) -> ids of the ingredients that use it, per language. */
  names: Record<Lang, Map<string, Set<string>>>;
}

const indexCache = new WeakMap<Dictionary, DictIndex>();

function dictIndex(dict: Dictionary): DictIndex {
  let idx = indexCache.get(dict);
  if (idx) return idx;
  idx = { names: { nl: new Map(), en: new Map() } };
  for (const ing of dict.ingredients) {
    for (const lang of ['nl', 'en'] as const) {
      for (const name of ingredientForms(ing, lang)) {
        const key = foldKey(name);
        if (!key) continue;
        let set = idx.names[lang].get(key);
        if (!set) idx.names[lang].set(key, (set = new Set()));
        set.add(ing.id);
      }
    }
  }
  indexCache.set(dict, idx);
  return idx;
}

function ingredientForms(ing: Ingredient, lang: Lang): string[] {
  const n = ing[lang];
  const out: string[] = [];
  if (n?.one) out.push(n.one);
  if (n?.many) out.push(n.many);
  for (const a of ing.aliases?.[lang] ?? []) if (a) out.push(a);
  return out;
}

/** Ids of the dictionary ingredients a folded phrase names in `lang` (exact, or with the last word singularised). */
function namedBy(phrase: string, idx: DictIndex, lang: Lang): Set<string> | undefined {
  const direct = idx.names[lang].get(phrase);
  if (direct) return direct;
  const sp = phrase.lastIndexOf(' ');
  const head = sp < 0 ? '' : phrase.slice(0, sp + 1);
  const last = sp < 0 ? phrase : phrase.slice(sp + 1);
  for (const f of lang === 'nl' ? dutchBaseForms(last) : englishBaseForms(last)) {
    const hit = idx.names[lang].get(head + f);
    if (hit) return hit;
  }
  return undefined;
}

// --- word lists -------------------------------------------------------------------------------

/**
 * Names that are ordinary words in the step language and so are never made green, even when a line
 * of the recipe has that name or alias. Filled from the corpus sweep over the 196 classics.
 */
const STOP: Record<Lang, ReadonlySet<string>> = {
  // "een smeuïge puree" is the mash being made, not the "(of instant puree)" alternative;
  // "bak de lasagne" is the dish, not the sheets.
  nl: new Set<string>(['puree', 'lasagne']),
  // "drain the potatoes and mash them": a verb; "bake the lasagne": the dish.
  en: new Set<string>(['mash', 'lasagne']),
};

/**
 * A name followed by one of these is a kitchen tool ("potato masher", "garlic press") or a mixture
 * made with it ("pour the egg mixture over", "the onion mixture", "kippenfond mengsel"; 37 steps in
 * the corpus, 16 Oct 2026), not the ingredient itself: its whole amount would be wrong there. In
 * English a name also works as a modifier of a preparation made from part of it ("stir in the
 * courgette sauce", "the garlic oil", "the nut crumble"); Dutch writes those as one compound word
 * ("courgettesaus"), which never matches. Full names such as "soy sauce" or "olive oil" are matched
 * first (longest first) or blocked by `otherIngredientAround`, so they stay green.
 */
const TOOL_AFTER: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['pers', 'stamper', 'schiller', 'snijder', 'molen', 'wekker', 'mengsel']),
  en: new Set([
    'masher', 'ricer', 'peeler', 'press', 'slicer', 'grater', 'cutter', 'crusher', 'mill', 'grinder', 'timer', 'knife', 'scissors', 'mixture',
    'sauce', 'oil', 'crumble', 'dressing', 'marinade',
  ]),
};

/** English articles after a sentence-initial name that make it a verb: "Butter a large ovenproof dish". */
const ARTICLES_EN: ReadonlySet<string> = new Set(['a', 'an', 'the']);

/** Words between which a dictionary phrase is not looked for ("zout en peper" is two lines' names). */
const CONJ = new Set(['en', 'of', 'and', 'or', '&', 'met', 'with', 'in', 'op', 'on', 'to', 'tot']);

/**
 * Partial or unmeasured amounts: "de helft van de boter", "the remaining butter", "de rest van de
 * saus", "kook de pasta in ruim water" (cooking water, not the 1,25 dl of the sauce), "met een klein
 * beetje olijfolie", "nog wat olijfolie", "met wat witte wijn", "in de achtergebleven boter", "a
 * little (more) olive oil", "a little of the Cajun seasoning", "a few olives", "enkele olijven".
 */
const PARTIAL: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['helft', 'rest', 'resterende', 'overige', 'overgebleven', 'achtergebleven', 'achtergehouden', 'bewaarde', 'andere', 'ruim', 'extra', 'beetje', 'wat', 'enkele', 'paar']),
  en: new Set(['half', 'rest', 'remaining', 'remainder', 'reserved', 'leftover', 'other', 'extra', 'little', 'more', 'few', 'several']),
};
/** The same, only with "van"/"of": "een deel van de kaas", "some of the cheese", "plenty of water", "two thirds of the chives". */
const PARTIAL_OF: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['deel', 'kwart', 'derde', 'beetje']),
  en: new Set(['some', 'part', 'quarter', 'quarters', 'third', 'thirds', 'bit', 'most', 'plenty', 'lots']),
};
/** An ordinal before a unit names one portion, not an amount to add: "de derde el olijfolie", "the third tbsp of olive oil". */
const ORDINALS: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['tweede', 'derde', 'vierde', 'laatste']),
  en: new Set(['second', 'third', 'fourth', 'last']),
};
/** A word right after the name that makes it a leftover: "the butter left in the pan". */
const LEFT_AFTER: Record<Lang, ReadonlySet<string>> = {
  nl: new Set<string>(),
  en: new Set(['left']),
};
/** Words skipped while looking back for a partial amount. */
const FILLER: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['de', 'het', 'van']),
  en: new Set(['the', 'of']),
};
/** Vague counts that still give an amount together with a unit: "a few knobs of butter", "een paar takjes tijm". */
const VAGUE_WITH_UNIT: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['paar', 'enkele', 'wat', 'aantal', 'flinke', 'flink']),
  en: new Set(['few', 'some', 'couple', 'several', 'generous', 'good']),
};
/** Number words that count as an amount in the text ("een ui", "twee eieren", "a pinch of salt"); folded ("één" -> "een"). */
const NUMBER_WORDS: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'half', 'halve', 'anderhalf', 'anderhalve']),
  en: new Set(['a', 'an', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'half']),
};

const NUMBER_TOKEN = /^(?:ca\.?|±|~)?[\d½¼¾⅓⅔⅛][\d½¼¾⅓⅔⅛.,/\-x]*$/u;
const GLUED_NUMBER_UNIT = /^[\d½¼¾⅓⅔⅛][\d½¼¾⅓⅔⅛.,/\-]*(\p{L}+)$/u;
const TOKEN_CHAR = /[\p{L}\p{N}½¼¾⅓⅔⅛/.,'±~-]/u;

// --- candidates -------------------------------------------------------------------------------

interface Candidate {
  line: number;
  /** -1 = the line's own ingredient; else the index in `line.alt` ("30 g boter" in "3 el olijfolie of 30 g boter"). */
  alt: number;
  /** Identity of the ingredient: 'i:<id>' for a dictionary entry, 'n:<name>' for free text. */
  who: string;
  /** 0 = the entry's own name or the name as written in the line; 1 = an alias. */
  rank: number;
  /** 13D: a name of the line's `swappedFrom` / `swappedAlt` ingredient (the old product of a swapped line). */
  via?: boolean;
}

/** The language a line is written in: Dutch when present, else English (src/domain/line-words.ts `lineLang`). */
function lineLang(line: Line): Lang {
  return line.raw?.nl ? 'nl' : 'en';
}

/** "citroen" + part 'sap' -> "citroensap" / "lemon juice": what a step calls a part of an ingredient. */
function partForms(line: Line, ing: Ingredient | undefined, lang: Lang): string[] {
  if (!line.part || !ing) return [];
  const one = ing[lang]?.one;
  if (!one) return [];
  const out: string[] = [];
  const juice = line.part === 'sap' || line.part === 'rasp-en-sap';
  const zest = line.part === 'rasp' || line.part === 'rasp-en-sap';
  if (lang === 'nl') {
    if (juice) out.push(`${one}sap`);
    if (zest) out.push(`${one}rasp`, `${one}schil`);
  } else {
    if (juice) out.push(`${one} juice`);
    if (zest) out.push(`${one} zest`);
  }
  if (ing.id === 'ei') {
    if (line.part === 'geel') out.push(...(lang === 'nl' ? ['eigeel', 'eidooier', 'eidooiers', 'dooier', 'dooiers'] : ['egg yolk', 'egg yolks', 'yolk', 'yolks']));
    if (line.part === 'wit') out.push(...(lang === 'nl' ? ['eiwit', 'eiwitten'] : ['egg white', 'egg whites']));
  }
  return out;
}

/** An alternative as a line of its own: its raw text falls back to the parent's (for `lineLang`). */
function altLine(parent: Line, alt: Line): Line {
  return { ...alt, raw: alt.raw ?? parent.raw };
}

function collectCandidates(lines: readonly Line[], dict: Dictionary, lang: Lang): Map<string, Candidate[]> {
  const out = new Map<string, Candidate[]>();
  const add = (name: string | null | undefined, c: Candidate): void => {
    if (!name) return;
    const key = foldKey(name);
    if (key.length < 2 || STOP[lang].has(key)) return;
    let list = out.get(key);
    if (!list) out.set(key, (list = []));
    const prev = list.find((x) => x.line === c.line && x.who === c.who);
    if (!prev) list.push(c);
    else if (c.rank < prev.rank || (c.rank === prev.rank && c.alt < prev.alt)) {
      Object.assign(prev, c);
      if (!c.via) delete prev.via;
    }
  };
  /** The dictionary forms of `ing` (singular, plural, aliases, part forms) as names of `c.line`. */
  const addForms = (ing: Ingredient, src: Line, c: Omit<Candidate, 'rank'>): void => {
    const n = ing[lang];
    add(n?.one, { ...c, rank: 0 });
    add(n?.many, { ...c, rank: 0 });
    for (const a of ing.aliases?.[lang] ?? []) add(a, { ...c, rank: 1 });
    for (const p of partForms(src, ing, lang)) add(p, { ...c, rank: 0 });
  };
  const addLine = (src: Line, line: number, alt: number): void => {
    const ing = src.ing ? dict.get(src.ing) : undefined;
    const who = ing ? `i:${ing.id}` : `n:${normalizeKey(src.name ?? '')}`;
    if (ing) addForms(ing, src, { line, alt, who });
    // The name as written, only in the language it was written in ("gezeefde tomaten").
    if (src.name && lineLang(src) === lang) add(src.name, { line, alt, who, rank: 0 });
  };
  lines.forEach((line, i) => {
    if (line.kind === 'header') return;
    addLine(line, i, -1);
    (line.alt ?? []).forEach((alt, k) => addLine(altLine(line, alt), i, k));
    // 13D: the step text still names the old product of a swapped line ("Kook de spaghetti.") or
    // the alternative the swap dropped ("Voeg de pasta toe." for "farfalle (of een andere pastasoort)").
    for (const old of swappedOf(line, dict)) addForms(old, line, { line: i, alt: -1, who: `i:${old.id}`, via: true });
  });
  return out;
}

/** The ids a swapped line of a diet tab replaced: `line.swappedFrom` and `line.swappedAlt` (display-only). */
function swappedIds(line: Line): string[] {
  const out: string[] = [];
  for (const id of [line.swappedFrom, line.swappedAlt]) if (typeof id === 'string' && id && !out.includes(id)) out.push(id);
  return out;
}

/** The old products of a swapped line of a diet tab that the dictionary knows. */
function swappedOf(line: Line, dict: Dictionary): Ingredient[] {
  return swappedIds(line)
    .map((id) => dict.get(id))
    .filter((x): x is Ingredient => !!x);
}

/** Dictionary ids of every line and alternative of the recipe (and the old products of a swapped line). */
function recipeIngredients(lines: readonly Line[]): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    if (line.kind === 'header') continue;
    if (line.ing) out.add(line.ing);
    for (const alt of line.alt ?? []) if (alt.ing) out.add(alt.ing);
    for (const id of swappedIds(line)) out.add(id);
  }
  return out;
}

// --- matching ---------------------------------------------------------------------------------

/** The word right before folded offset `pos` (one space in between), or null. */
function wordBefore(s: string, pos: number): { word: string; start: number } | null {
  if (pos < 2 || s[pos - 1] !== ' ' || !isWordChar(s[pos - 2])) return null;
  let k = pos - 1;
  while (k > 0 && (isWordChar(s[k - 1]) || s[k - 1] === "'")) k--;
  if (k > 0 && s[k - 1] === '-') return null;
  return { word: s.slice(k, pos - 1), start: k };
}

/** Up to `n` words right before `pos`, nearest first, stopping at punctuation and conjunctions. */
function neighboursBefore(s: string, pos: number, n: number): string[] {
  const out: string[] = [];
  let at = pos;
  while (out.length < n) {
    const w = wordBefore(s, at);
    if (!w || CONJ.has(w.word)) break;
    out.push(w.word);
    at = w.start;
  }
  return out;
}

/** Up to `n` words right after `pos`, nearest first, stopping at punctuation and conjunctions. */
function neighboursAfter(s: string, pos: number, n: number): string[] {
  const out: string[] = [];
  let at = pos;
  while (out.length < n) {
    if (s[at] !== ' ' || !isWordChar(s[at + 1])) break;
    let k = at + 1;
    while (k < s.length && (isWordChar(s[k]) || s[k] === "'")) k++;
    if (s[k] === '-') break;
    const word = s.slice(at + 1, k);
    if (CONJ.has(word)) break;
    out.push(word);
    at = k;
  }
  return out;
}

/**
 * True when the name plus the words around it name a different dictionary ingredient than the
 * match's lines ("olive oil" around "oil", "zure room" around "room", "chicken stock" around "chicken").
 */
function otherIngredientAround(s: string, start: number, end: number, key: string, ids: ReadonlySet<string>, idx: DictIndex, lang: Lang): boolean {
  const before = neighboursBefore(s, start, 2);
  const after = neighboursAfter(s, end, 2);
  const phrases: string[] = [];
  if (before[0]) phrases.push(`${before[0]} ${key}`);
  if (before[1]) phrases.push(`${before[1]} ${before[0]} ${key}`);
  if (after[0]) phrases.push(`${key} ${after[0]}`);
  if (after[1]) phrases.push(`${key} ${after[0]} ${after[1]}`);
  if (before[0] && after[0]) phrases.push(`${before[0]} ${key} ${after[0]}`);
  for (const p of phrases) {
    const named = namedBy(p, idx, lang);
    if (named && ![...named].some((id) => ids.has(id))) return true;
  }
  return false;
}

/**
 * A name the step may well mean for an ingredient that is NOT on the list: another dictionary entry
 * with the same name, from another aisle, that is a staple (recipes often leave staples out).
 * "pepper" in a recipe with a bell pepper is black pepper in "salt and pepper"; "breadcrumbs" for
 * a recipe with paneermeel is fine (the other "breadcrumbs", broodkruim, is no staple), and
 * "caster sugar" for suiker is fine (basterdsuiker is a staple, but from the same aisle).
 */
function ambiguousInDictionary(key: string, ids: ReadonlySet<string>, recipeIngs: ReadonlySet<string>, dict: Dictionary, idx: DictIndex, lang: Lang): boolean {
  const named = idx.names[lang].get(key);
  if (!named || named.size < 2) return false;
  const aisles = new Set<string>();
  for (const id of ids) aisles.add(dict.get(id)?.aisle ?? '');
  for (const id of named) {
    if (ids.has(id) || recipeIngs.has(id)) continue;
    const other = dict.get(id);
    if (other?.staple && !aisles.has(other.aisle)) return true;
  }
  return false;
}

/** Tokens before folded offset `pos`, nearest first, within the clause (stops at . , ; : ! ? and brackets). */
function tokensBefore(s: string, pos: number, max: number): string[] {
  const out: string[] = [];
  let i = pos;
  while (out.length < max) {
    let j = i;
    while (j > 0 && s[j - 1] === ' ') j--;
    if (j === 0 || !TOKEN_CHAR.test(s[j - 1] as string)) break;
    let k = j;
    while (k > 0 && TOKEN_CHAR.test(s[k - 1] as string)) k--;
    const tok = s.slice(k, j);
    // "olie, ui" / "pan. Bak": the clause ends here (but "ca." and "1,5" are tokens of their own).
    if (/[.,]$/.test(tok) && !/^(?:ca|approx|ong)\.$/.test(tok)) break;
    out.push(tok);
    if (k > 0 && s[k - 1] !== ' ') break;
    i = k;
  }
  return out;
}

function isAdjective(tok: string, dict: Dictionary, lang: Lang): boolean {
  if (PARTIAL[lang].has(tok)) return false;
  if (dict.qualifierByWord(tok, lang)) return true;
  if (lang === 'nl') return /^\p{L}*ge\p{L}{2,}(?:d|t|de|te|en)$/u.test(tok);
  return /^\p{L}{3,}ed$/u.test(tok) || tok === 'fresh';
}

function isUnitWord(tok: string, dict: Dictionary, lang: Lang): boolean {
  return /^\p{L}/u.test(tok) && dict.unitByAlias(tok, lang) !== undefined;
}

/** Does the text right before folded offset `pos` give an amount for the name that starts there? */
function amountBefore(s: string, pos: number, dict: Dictionary, lang: Lang): boolean {
  const toks = tokensBefore(s, pos, 8);
  let i = 0;
  // "1 grote ui", "200 g geraspte kaas", "2 tbsp chopped parsley"
  for (let n = 0; n < 2 && i < toks.length && isAdjective(toks[i] as string, dict, lang); n++) i++;
  // "de helft van de boter", "the rest of the butter", "the remaining oil", "some of the cheese"
  {
    let j = i;
    let of = false;
    for (let n = 0; n < 3 && j < toks.length && FILLER[lang].has(toks[j] as string); n++) {
      if (toks[j] === 'van' || toks[j] === 'of') of = true;
      j++;
    }
    const t = toks[j];
    // ("beetje bij beetje de melk" is how to add it, not how much: the whole amount still applies)
    const littleByLittle = t === 'beetje' && toks[j + 1] === 'bij';
    if (t !== undefined && !littleByLittle && (PARTIAL[lang].has(t) || (of && PARTIAL_OF[lang].has(t)))) return true;
  }
  // "2 tbsp of oil", "2 tbsp of the oil", "2 el van de olie"
  if (lang === 'en' && toks[i] === 'the' && toks[i + 1] === 'of') i += 2;
  else if (lang === 'en' && toks[i] === 'of') i++;
  else if (lang === 'nl' && (toks[i] === 'de' || toks[i] === 'het') && toks[i + 1] === 'van') i += 2;
  let unit = false;
  if (i < toks.length && isUnitWord(toks[i] as string, dict, lang)) {
    i++;
    unit = true;
  } else if (i + 1 < toks.length && isUnitWord(`${toks[i + 1]} ${toks[i]}`, dict, lang)) {
    i += 2; // "fl oz"
    unit = true;
  }
  const t = toks[i];
  if (t === undefined) return false;
  if (NUMBER_TOKEN.test(t)) return true;
  if (!unit) {
    const glued = GLUED_NUMBER_UNIT.exec(t); // "200g", "2el"
    if (glued && isUnitWord(glued[1] as string, dict, lang)) return true;
  }
  return NUMBER_WORDS[lang].has(t) || (unit && (VAGUE_WITH_UNIT[lang].has(t) || ORDINALS[lang].has(t)));
}

/**
 * English only: a capitalised name that opens a sentence and is followed by an article is a verb
 * ("Butter a large ovenproof dish", "Flour the worktop"), not the ingredient. `at`/`end` are folded
 * offsets of the name.
 */
function imperativeVerb(text: string, folded: Folded, at: number, end: number, lang: Lang): boolean {
  if (lang !== 'en') return false;
  const s = folded.s;
  const sentenceStart = at === 0 || /[.!?:] ?$/u.test(s.slice(Math.max(0, at - 2), at));
  if (!sentenceStart) return false;
  const first = text[folded.from[at] as number] as string;
  if (first === first.toLowerCase()) return false;
  const next = neighboursAfter(s, end, 1)[0];
  return next !== undefined && ARTICLES_EN.has(next);
}

interface RawMatch {
  fs: number;
  fe: number;
  /** [line index, alt index (-1 = the line itself)], ascending by line. */
  refs: [number, number][];
  /** Line indexes reached through a swapped line's old product (13D). */
  via: ReadonlySet<number>;
}

/**
 * The recipe's ingredients named in a step text, sorted by position. `lang` is the language the
 * text is written in (the displayed text: `pickSpoken(step.text, lang).lang`, not the app language
 * when the step falls back to the other one). Header lines are skipped.
 */
export function findStepIngredients(text: string, lines: readonly Line[], dict: Dictionary, lang: Lang): StepIngredientMatch[] {
  if (!text || lines.length === 0) return [];
  const folded = foldText(text);
  const s = folded.s;
  const idx = dictIndex(dict);
  const cands = collectCandidates(lines, dict, lang);
  const recipeIngs = recipeIngredients(lines);
  const keys = [...cands.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  const taken = new Uint8Array(s.length);
  const raw: RawMatch[] = [];

  for (const key of keys) {
    const list = cands.get(key) as Candidate[];
    // Which ingredient does this name mean? Own names beat aliases; two different ones = ambiguous.
    const best = Math.min(...list.map((c) => c.rank));
    const chosen = list.filter((c) => c.rank === best);
    const whos = new Set(chosen.map((c) => c.who));
    const ids = new Set<string>();
    for (const c of chosen) if (c.who.startsWith('i:')) ids.add(c.who.slice(2));
    const blocked = whos.size > 1 || ambiguousInDictionary(key, ids, recipeIngs, dict, idx, lang);
    const refs = new Map<number, number>();
    for (const c of chosen) refs.set(c.line, Math.min(refs.get(c.line) ?? c.alt, c.alt));
    const sortedRefs = [...refs].sort((a, b) => a[0] - b[0]);
    const via = new Set<number>();
    for (const c of chosen) if (c.via) via.add(c.line);

    let from = 0;
    for (;;) {
      const at = s.indexOf(key, from);
      if (at < 0) break;
      from = at + 1;
      let end = at + key.length;
      const before = s[at - 1];
      const after = s[end];
      if (isWordChar(before) || isWordChar(after)) continue;
      if (before === '-' && isWordChar(s[at - 2])) continue; // "lente-ui"
      if (after === '-' && isWordChar(s[end + 1])) continue; // "knoflook-gemberpasta"
      if (after === "'" && isWordChar(s[end + 1])) {
        // "paprika's", "avocado's": the Dutch plural belongs to the word
        if (s[end + 1] === 's' && !isWordChar(s[end + 2])) end += 2;
        else continue;
      }
      let free = true;
      for (let k = at; k < end; k++) if (taken[k]) free = false;
      if (!free) continue;
      // An ambiguous name or one that is part of another ingredient's name still claims its
      // place, so a shorter name inside it is not matched either.
      for (let k = at; k < end; k++) taken[k] = 1;
      if (blocked) continue;
      const next = neighboursAfter(s, end, 1)[0];
      if (next !== undefined && TOOL_AFTER[lang].has(next)) continue;
      if (imperativeVerb(text, folded, at, end, lang)) continue;
      if (ids.size > 0 && otherIngredientAround(s, at, end, key, ids, idx, lang)) continue;
      raw.push({ fs: at, fe: end, refs: sortedRefs, via });
    }
  }

  raw.sort((a, b) => a.fs - b.fs);
  const out: StepIngredientMatch[] = [];
  for (const m of raw) {
    let fs = m.fs;
    let refs = m.refs;
    // "rode paprika" when the recipe has a red and a green one: the qualifier picks the line
    // and becomes part of the green words.
    for (let n = 0; n < 2; n++) {
      const prev = wordBefore(s, fs);
      if (!prev || taken[prev.start]) break;
      const q = dict.qualifierByWord(prev.word, lang);
      if (!q) break;
      const having = refs.filter(([li, alt]) => {
        const line = lines[li];
        const src = alt < 0 ? line : line?.alt?.[alt];
        return (src?.qual ?? []).includes(q.id);
      });
      if (having.length === 0) break;
      refs = having;
      fs = prev.start;
    }
    const start = folded.from[fs] as number;
    let end = folded.to[m.fe - 1] as number;
    while (end < text.length && MARK.test(text[end] as string)) end++;
    const after = neighboursAfter(s, m.fe, 1)[0];
    const left = after !== undefined && LEFT_AFTER[lang].has(after);
    const match: StepIngredientMatch = { start, end, lines: refs.map(([li]) => li), qtyInText: left || amountBefore(s, fs, dict, lang) };
    if (refs.some(([, alt]) => alt >= 0)) match.alt = refs.map(([, alt]) => alt);
    if (refs.some(([li]) => m.via.has(li))) match.viaSwap = true;
    out.push(match);
  }
  return out;
}

// --- rendering helpers ------------------------------------------------------------------------

/** The step text cut into plain pieces and recognised ingredients, in order (no empty pieces). */
export function stepSegments(text: string, matches: readonly StepIngredientMatch[]): StepSegment[] {
  const out: StepSegment[] = [];
  let at = 0;
  for (const m of matches) {
    if (m.start < at || m.end <= m.start) continue;
    if (m.start > at) out.push({ text: text.slice(at, m.start), match: null });
    out.push({ text: text.slice(m.start, m.end), match: m });
    at = m.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), match: null });
  return out;
}

/**
 * A line with a small-measure unit but no number ("snufje nootmuskaat", "scheutje gembersiroop",
 * "klontje boter"): the unit alone is the amount. Other units without a number ("partjes citroen",
 * "enkele toefjes peterselie", "blikje kooksaus") say how it is cut or packed, not how much, and
 * the singular label would even read wrong ("citroen (partje)"), so they give no amount.
 */
function unitOnly(line: Line, dict: Dictionary): boolean {
  return !line.qty && !!line.unit && dict.unit(line.unit)?.group === 'pinch';
}

/**
 * The scaled quantity of a line as the UI shows it after a green word: "1 tl", "15 g", "2" for
 * counted pieces, "1 citroen" for a part line ("sap van 1 citroen" behind "citroensap"), the unit
 * alone for a pinch-like unit without a number ("snufje", "pinch", "scheut"); '' when the line has
 * no quantity (or is a header).
 */
export function lineQuantityText(line: Line, dict: Dictionary, lang: Lang, factor = 1): string {
  if (line.kind === 'header') return '';
  if (unitOnly(line, dict)) return renderLineParts(line, dict, lang, factor).unit;
  if (!line.qty) return '';
  const p = renderLineParts(line, dict, lang, factor);
  const amount = [p.qty, p.unit].filter(Boolean).join(' ');
  if (!amount) return '';
  return line.part && p.name ? `${amount} ${p.name}` : amount;
}

/**
 * The line a match points at: the line itself, or the alternative the text named, as a line of its
 * own. An alternative without its own amount shares the line's ("250 g pinda's (of cashewnoten)"),
 * as the rendered line says it.
 */
function referredLine(lines: readonly Line[], match: StepIngredientMatch, k: number): Line | undefined {
  const line = lines[match.lines[k] as number];
  const alt = match.alt?.[k] ?? -1;
  if (!line || alt < 0) return line;
  const a = line.alt?.[alt];
  if (!a) return line;
  const own = altLine(line, a);
  return own.qty || own.unit ? own : { ...own, qty: line.qty ?? null, unit: line.unit ?? null };
}

/**
 * What the UI shows after a green word, scaled by `factor`: '' when the text already gives the
 * amount (`qtyInText`) or no line has a quantity; else the quantity of its line ("1 tl"), or of
 * its lines joined with " + ", each with its qualifiers when the lines differ in them
 * ("1 groene + 1 rode"). Lines without a quantity are left out of the sum. When the word named the
 * old product of a swapped line (`viaSwap`, 13D), that line's piece is the quantity plus the NEW
 * name ("400 g glutenvrije pasta" behind "spaghetti").
 */
export function matchQuantityText(match: StepIngredientMatch, lines: readonly Line[], dict: Dictionary, lang: Lang, factor = 1): string {
  if (match.qtyInText) return '';
  const own = match.lines.map((_, k) => referredLine(lines, match, k)).filter((l): l is Line => !!l);
  const quals = new Set(own.map((l) => (l.qual ?? []).join(' ')));
  const pieces: string[] = [];
  for (const line of own) {
    const q = lineQuantityText(line, dict, lang, factor);
    if (!q) continue;
    // 13D: say what the old product became; a part line's quantity already carries its name ("1 citroen").
    if (match.viaSwap && typeof line.swappedFrom === 'string' && !line.part) {
      const name = renderLineParts(line, dict, lang, factor).name.trim();
      pieces.push(name ? `${q} ${name}` : q);
      continue;
    }
    const words = quals.size > 1 ? (line.qual ?? []).map((id) => dict.qualifierName(id, lang)) : [];
    pieces.push([q, ...words].join(' '));
  }
  return pieces.join(' + ');
}

/** "ca. 400" -> "ongeveer 400", "2-3" -> "2 tot 3": quantities as a voice should say them. */
function spokenQty(qty: string, lang: Lang): string {
  return qty
    .replace(/^ca\.\s*/u, lang === 'nl' ? 'ongeveer ' : 'about ')
    .replace(/^approx\.\s*/u, 'about ')
    .replace(/(\S)-(\S)/gu, `$1 ${lang === 'nl' ? 'tot' : 'to'} $2`);
}

/** More than one: "2", "1½", "2-3" (not "1", "½"). */
function moreThanOne(qty: string): boolean {
  if (/\d\s*-\s*\d/.test(qty)) return true;
  const m = /(\d+(?:[.,]\d+)?)([½¼¾⅓⅔⅛])?/u.exec(qty);
  if (!m) return false;
  const n = Number((m[1] as string).replace(',', '.'));
  return n > 1 || (n === 1 && m[2] !== undefined);
}

/** The unit as a voice should say it: the long name where units.json has one ("gram", "theelepel", "tablespoons"). */
function spokenUnit(label: string, qty: string, dict: Dictionary, lang: Lang): string {
  const unit = dict.unitByAlias(label, lang);
  const long = unit?.[lang].long;
  if (!unit || !long) return label;
  if (!moreThanOne(qty)) return long;
  // English plurals: "grams", "tablespoons", "litres". Dutch keeps measures singular ("15 gram",
  // "2 liter", "200 milliliter") but counts spoons ("2 eetlepels", "3 theelepels").
  if (lang === 'en') return `${long}s`;
  return scaleKindOf(unit) === 'spoon' ? `${long}s` : long;
}

/** One line as a voice says it, in pieces so that two lines of the same ingredient can share the name. */
interface SpokenLine {
  /** "paprikapoeder" for "paprikapoeder 15 gram"; '' for the other shapes. */
  name: string;
  /** "15 gram"; or the whole piece ("2 uien", "sap van 1 citroen", "zout naar smaak") when `name` is ''. */
  amount: string;
}

/** One line as a voice says it: "paprikapoeder 15 gram", "2 uien", "sap van 1 citroen", "zout naar smaak". */
function spokenLine(line: Line, dict: Dictionary, lang: Lang, factor: number): SpokenLine | null {
  const p = renderLineParts(line, dict, lang, factor);
  const name = p.name.trim();
  // A pinch-like unit without a number: "een snufje nootmuskaat", "a pinch of nutmeg".
  if (unitOnly(line, dict) && p.unit && name) return { name: '', amount: lang === 'nl' ? `een ${p.unit} ${name}` : `a ${p.unit} of ${name}` };
  if (!p.qty) {
    if (!name) return null;
    return { name: '', amount: isTasteNote(line.note) ? `${name} ${lang === 'nl' ? 'naar smaak' : 'to taste'}` : name };
  }
  const qty = spokenQty(p.qty, lang);
  const unit = p.unit ? spokenUnit(p.unit, p.qty, dict, lang) : '';
  if (p.part) return { name: '', amount: [p.part, qty, unit, name].filter(Boolean).join(' ') };
  if (unit && name) return { name, amount: `${qty} ${unit}` };
  return { name: '', amount: [qty, unit, name].filter(Boolean).join(' ') };
}

/**
 * "Hoeveel?" / "How much?" (voice, Android): the scaled amounts of the ingredients named in a
 * step, one piece per line (or named alternative), in the order they first appear in the text,
 * each once: ["paprikapoeder 15 gram", "karwijzaad 1 theelepel", "knoflook 2 teentjes", "1 grote
 * ui"]. Units are said in full where units.json has a long name; counted pieces read number first
 * ("2 uien"); a line without a quantity reads its name ("zout naar smaak"); two lines of the same
 * ingredient named by one word share it ("boter 50 gram en 75 gram"). Lines whose amount the text
 * already gives are read too: the question is "how much of this does the recipe use". The caller
 * joins the pieces with ", "; [] = no ingredient from the list in this step.
 */
export function spokenStepQuantities(matches: readonly StepIngredientMatch[], lines: readonly Line[], dict: Dictionary, lang: Lang, factor = 1): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const and = lang === 'nl' ? ' en ' : ' and ';
  for (const m of matches) {
    const pieces: SpokenLine[] = [];
    m.lines.forEach((li, k) => {
      const key = `${li}:${m.alt?.[k] ?? -1}`;
      if (seen.has(key)) return;
      seen.add(key);
      const line = referredLine(lines, m, k);
      if (!line || line.kind === 'header') return;
      const piece = spokenLine(line, dict, lang, factor);
      if (!piece) return;
      const same = piece.name ? pieces.find((x) => x.name === piece.name) : undefined;
      if (same) same.amount += and + piece.amount;
      else pieces.push(piece);
    });
    for (const x of pieces) out.push(x.name ? `${x.name} ${x.amount}` : x.amount);
  }
  return out;
}
