// What someone types into the "+ wc-papier, melk …" field of the shopping list, split into an
// amount and a name (docs/phase-4-spec.md §3; Stijn 17 Oct 2026: "200 gram boter" landed under
// Overig as "gram boter" because only a bare leading number was recognised). Framework-free: no
// preact, no dexie; runs in Node (tests/shopinput.test.ts).
//
//   "200 gram boter" -> { qty: 200, unit: 'g', name: 'boter' }
//   "200g boter"     -> { qty: 200, unit: 'g', name: 'boter' }
//   "1,5 liter melk" -> { qty: 1.5, unit: 'l', name: 'melk' }   (splitShopList keeps the decimal comma)
//   "2 pakken melk"  -> { qty: 2, unit: 'pak', name: 'melk' }
//   "2 cans of chickpeas" -> { qty: 2, unit: 'blik', name: 'chickpeas' }
//   "3 melk", "3x melk", "3 × melk", "3× melk" -> { qty: 3, unit: null, name: 'melk' }
//   "3 x 200 gram boter" -> { qty: 600, unit: 'g', name: 'boter' }
//   "2 ons ham"      -> { qty: 200, unit: 'g', name: 'ham' }      (ons/pond: shop words, not recipe units)
//   "een zak chips"  -> { qty: 1, unit: 'zak', name: 'chips' }
//   "2-3 uien"       -> { qty: 3, unit: null, name: 'uien' }      (a range buys the upper end)
//   "2 blik tomaten" -> { qty: 2, unit: null, name: 'blik tomaten' } (the product's own name starts with a unit word)
//   "7up", "een paar bananen", "200 gram" -> kept as typed (no amount)
//
// The number comes from the ingredient parser's `parseQty` (fractions, "1,5", ranges, "een"/"a").
// A unit is the first word after it when the dictionary knows it as a unit in the TYPING language,
// a name follows, and that word is not the start of the product's own name ("blik tomaten",
// "pak choi", "hand cream"). The caller looks the name up (dictionary search / ingredientByName).
import { normalizeKey, type Dictionary, type Ingredient, type Unit } from './dictionary.ts';
import type { Lang } from './model.ts';
import { parseQty } from './parser.ts';

export interface ShopInput {
  /** The amount, null when the text does not start with one. */
  qty: number | null;
  /** units.json id ("g", "pak", "zak"), null for counted pieces or no amount. */
  unit: string | null;
  /** The rest: what to look up in the dictionary, or the label of a plain-text item. */
  name: string;
}

/**
 * Item separators: a comma, except between two digits ("1,5 liter melk" is one item); a line break
 * (a list pasted from WhatsApp); and " · " (spec V6 §1a, "Coco acqua · Beetroot · Check ketchup").
 */
const LIST_SEPARATOR = /(?<!\d),|,(?!\d)|\r?\n|\r|\s+·\s+/u;

/** "melk, 2 eieren,1,5 l room" -> ["melk", "2 eieren", "1,5 l room"]; also splits on line breaks and " · ". */
export function splitShopList(text: string): string[] {
  return text
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when the text holds more than one item (a separator that is not a decimal comma). */
export function isShopList(text: string): boolean {
  return LIST_SEPARATOR.test(text);
}

/** Unit words that mean something else on a shopping list: "1 blok kaas" is a piece, "1 strip paracetamol" no slice. */
const SKIP_UNIT_WORDS: Readonly<Record<Lang, ReadonlySet<string>>> = {
  nl: new Set(['blok', 'blokken']),
  en: new Set(['strip', 'strips']),
};

/** Dutch weight words of the deli counter, as grams (not recipe units, so not in data/units.json). */
const NL_WEIGHT_WORDS: Readonly<Record<string, number>> = { ons: 100, onsje: 100, onsjes: 100, pond: 500, pondje: 500, pondjes: 500 };

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * The unit a word names in the typing language only ("drop" is a Dutch sweet, not the English
 * unit), preferring a unit's own forms over another unit's alias ("stick" is the stick unit, not an
 * alias of stengel).
 */
function shopUnit(word: string, dict: Dictionary, lang: Lang): Unit | undefined {
  const key = normalizeKey(word);
  if (!key || SKIP_UNIT_WORDS[lang].has(key)) return undefined;
  const own = dict.units.find((u) => [lang === 'nl' ? u.id : '', u[lang].one, u[lang].many, u[lang].long].some((f) => !!f && normalizeKey(f) === key));
  if (own) return own;
  return dict.unitAliases(lang).includes(key) ? dict.unitByAlias(word, lang) : undefined;
}

/** Dutch spellings normalised before the number is read: "1.000" (thousands), "2×" (glued sign), "een stuk of 5", "een halve kilo". */
function preNormalize(text: string, lang: Lang): string {
  let t = text.replace(/^(\d+(?:[.,]\d+)?)\s*×\s*/u, '$1 x ');
  if (lang === 'nl') {
    t = t.replace(/^(\d{1,3}(?:\.\d{3})+)(?![\d,])/u, (m) => m.replace(/\./g, ''));
    t = t.replace(/^(?:een|één)\s+stuk\s+of\s+(?=\d)/iu, '');
    t = t.replace(/^(?:een\s+)?halve\s+(?=\S+\s)/iu, '½ ');
  }
  return t;
}

export function parseShopInput(text: string, dict: Dictionary, lang: Lang): ShopInput {
  const typed = text.trim();
  const plain: ShopInput = { qty: null, unit: null, name: typed };
  if (!typed) return plain;
  const t = preNormalize(typed, lang);
  const q = parseQty(t, lang);
  if (!q) return plain;
  const qty = q.qty.max ?? q.qty.min;
  if (!(qty > 0) || !Number.isFinite(qty)) return plain;
  // "een"/"a" counts as 1 only when a unit or a known product follows ("een zak chips", "an apple"),
  // never in "een paar bananen" / "a few apples".
  const article = !/^[\d½¼¾⅓⅔⅛]/u.test(t);
  const head = t.slice(0, q.length);
  let rest = t.slice(q.length);
  // "200g", "3x": the number runs straight into a word (parseQty consumed no space after it).
  const glued = !/\s$/u.test(head) && /^\p{L}/u.test(rest);

  // "3x melk", "3 x melk", "3x200 gram boter": a count, or a multiple of an amount with a unit.
  const times = /^[x×](?:\s+|$|(?=\d))/iu.exec(rest);
  if (times && !article) {
    rest = rest.slice(times[0].length).trim();
    if (!rest) return plain;
    const inner = parseShopInput(rest, dict, lang);
    if (inner.qty !== null && inner.unit) return { qty: round3(qty * inner.qty), unit: inner.unit, name: inner.name };
    return { qty, unit: null, name: rest };
  }

  const word = /^(\S+)\s+(\S.*)$/u.exec(rest);
  if (word) {
    const unitWord = word[1] as string;
    let name = (word[2] as string).trim();
    // "2 ons ham", "een pond gehakt": deli weights in grams.
    const grams = lang === 'nl' ? NL_WEIGHT_WORDS[normalizeKey(unitWord)] : undefined;
    if (grams) return { qty: round3(qty * grams), unit: 'g', name };
    const unit = shopUnit(unitWord, dict, lang);
    if (unit) {
      // "a pint of milk", "2 cans of chickpeas" (Dutch "of" means "or": left alone).
      if (lang === 'en') name = name.replace(/^of\s+/iu, '');
      // The unit word may be the start of the product's own name: "2 blik tomaten" (tinned
      // tomatoes), "1 pak choi", "1 hand cream", "1 tin foil". Then it stays in the name.
      const own = dict.ingredientByName(rest.trim(), lang) ?? dict.ingredientByName(`${unitWord} ${name}`, lang);
      const tail = dict.ingredientByName(name, lang);
      if (own && own.id !== tail?.id) {
        const ownName = dict.ingredientByName(rest.trim(), lang) ? rest.trim() : `${unitWord} ${name}`;
        return { qty, unit: null, name: ownName };
      }
      return { qty, unit: unit.id, name };
    }
  }

  // "7up", "4seizoenen": a number glued to a word that is no unit belongs to the name.
  if (glued) return plain;
  const name = rest.trim();
  if (!name) return plain;
  const known = dict.ingredientByName(name, lang);
  // A known product wins over a unit with the same name: "1 drop" (liquorice), "10 cloves".
  if (known) return { qty, unit: null, name };
  // "2 kg" or "200 gram" alone: an amount without a name is kept as typed.
  if (shopUnit(name, dict, lang) || dict.unitByAlias(name, lang)) return plain;
  // "een paar bananen", "a few apples": the article is no amount here.
  if (article) return plain;
  return { qty, unit: null, name };
}

// --- Suggestions for a pasted list (spec V6 §1a) -------------------------------------------------
//
// Gabi's WhatsApp list "Coco acqua · Beetroot · Check ketchup · Pickles · Bread for breakfast" on
// Stijn's Dutch list: every line gets a proposal. Words like "check" or "for breakfast" become a
// note; the name is looked up in what this device learned, then by exact name in both languages,
// then by search in both languages. The raw line is always kept, so the caller can always place it
// as plain text.

export type ShopSuggestionStatus = 'sure' | 'maybe' | 'unknown';

export interface ShopSuggestion {
  /** The line as typed or pasted (trimmed), never changed. */
  raw: string;
  qty: number | null;
  unit: string | null;
  /** What was looked up: the line without amount, unit and note words. */
  name: string;
  /** Note words taken off the front or back ("check", "for breakfast"), lowercased; null when none. */
  note: string | null;
  /** Ingredient id of the proposal; null when unknown. */
  match: string | null;
  /** Other ingredient ids to offer (at most two for maybe, three for unknown, none for sure). */
  alternatives: string[];
  status: ShopSuggestionStatus;
}

/** Note words (spec V6 §1a; both languages are always tried). Longest first so "see if" beats nothing shorter. */
const NOTE_PHRASES: readonly string[] = [
  // NL
  'check', 'controleer', 'kijken of', 'misschien', 'evt.', 'eventueel', 'als het kan',
  // EN
  'maybe', 'if possible', 'optional', 'see if', 'for breakfast', 'for lunch', 'for dinner',
].sort((a, b) => b.length - a.length);

const NOTE_ALT = NOTE_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
/** A note phrase at the start, then a space or ':' / '-' ("Check ketchup", "check: ketchup"). */
const NOTE_FRONT = new RegExp(`^(${NOTE_ALT})(?:\\s*[:\\-–]\\s*|\\s+)`, 'iu');
/** A note phrase at the end, after a space or ',' / '-' ("Bread for breakfast", "ketchup - maybe"). */
const NOTE_BACK = new RegExp(`(?:\\s*[,\\-–]\\s*|\\s+)(${NOTE_ALT})[!?]?$`, 'iu');

/** Takes note phrases off both ends of a line; the name never becomes empty ("Check" alone stays the name). */
export function splitShopNote(text: string): { name: string; note: string | null } {
  let name = text.trim();
  const notes: string[] = [];
  for (;;) {
    const front = NOTE_FRONT.exec(name);
    if (front && name.slice(front[0].length).trim()) {
      notes.push((front[1] as string).toLowerCase());
      name = name.slice(front[0].length).trim();
      continue;
    }
    const back = NOTE_BACK.exec(name);
    if (back && name.slice(0, back.index).trim()) {
      notes.push((back[1] as string).toLowerCase());
      name = name.slice(0, back.index).trim();
      continue;
    }
    break;
  }
  return { name, note: notes.length ? notes.join(', ') : null };
}

/** Status boundaries (spec V6 §1a; Stijn decides changes, not the builder). */
const MAYBE_SCORE = 0.85;
const CLEAR_FACTOR = 1.5;
/** The containment ratio never reaches the word-start score (0.9). */
const SHOP_RATIO_CAP = 0.8;
/** A single hit (no second to compare with) is a maybe only from this score on. */
const SINGLE_HIT_SCORE = 0.5;

/**
 * How well a search query covers an ingredient, 0..1 (Fable, V6 lens), over every name, alias and
 * the id in BOTH languages (`lang` is the list language; the score does not depend on it):
 * - 1.0: the normalised query equals a name or alias (normally caught earlier by ingredientByName);
 * - 0.9: a WORD of a name or alias starts with the query ("beet" -> "beetroot", "kip" -> "kipfilet");
 * - otherwise the query's share of the shortest name, alias or id that contains it, capped at 0.8
 *   ("kip" in "soepkip" = 0.43); 0 when nothing contains it.
 * searchRanked only gives a rank, so this is the score the 0.85 / 1.5x boundaries are measured on.
 */
export function shopMatchScore(query: string, ing: Ingredient, lang: Lang): number {
  const q = normalizeKey(query);
  if (!q) return 0;
  const names: string[] = [];
  for (const l of [lang, otherLang(lang)]) {
    const n = ing[l];
    if (n?.one) names.push(n.one);
    if (n?.many) names.push(n.many);
    for (const a of ing.aliases?.[l] ?? []) names.push(a);
  }
  let best = 0;
  for (const name of names) {
    const k = normalizeKey(name);
    if (!k) continue;
    if (k === q) return 1;
    if (k.startsWith(q) || k.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(q))) best = Math.max(best, 0.9);
  }
  if (best > 0) return best;
  for (const name of [ing.id.replace(/-/g, ' '), ...names]) {
    const k = normalizeKey(name);
    if (k && k.includes(q)) best = Math.max(best, Math.min(SHOP_RATIO_CAP, q.length / k.length));
  }
  return best;
}

function otherLang(lang: Lang): Lang {
  return lang === 'nl' ? 'en' : 'nl';
}

/** searchRanked in both languages, merged per ingredient, best score first (then rank, then name). */
function rankedBoth(name: string, dict: Dictionary, lang: Lang): { id: string; score: number }[] {
  const merged = new Map<string, { id: string; score: number; rank: number; label: string }>();
  for (const l of [lang, otherLang(lang)]) {
    for (const m of dict.searchRanked(name, l)) {
      const prev = merged.get(m.ingredient.id);
      if (prev) prev.rank = Math.min(prev.rank, m.rank);
      else {
        const label = m.ingredient[lang]?.one ?? m.ingredient.id;
        merged.set(m.ingredient.id, { id: m.ingredient.id, score: shopMatchScore(name, m.ingredient, lang), rank: m.rank, label });
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.score - a.score || a.rank - b.rank || a.label.localeCompare(b.label));
}

/** One line: note words, amount (in `lang`, else the other language), then the lookup. */
function suggestLine(raw: string, dict: Dictionary, lang: Lang, learned: Readonly<Record<string, string>>): ShopSuggestion {
  const { name: bare, note } = splitShopNote(raw);
  // The other language also wins when it reads a unit that `lang` missed ("2 cans of chickpeas" on
  // a Dutch list), unless the `lang` reading already names a known product ("2 blik tomaten").
  let parsed = parseShopInput(bare, dict, lang);
  if (parsed.qty === null || parsed.unit === null) {
    const other = parseShopInput(bare, dict, otherLang(lang));
    if (parsed.qty === null ? other.qty !== null : other.unit !== null && !dict.ingredientByName(parsed.name, lang)) parsed = other;
  }
  const { qty, unit, name } = parsed;
  const base = { raw, qty, unit, name, note };
  const key = normalizeKey(name);

  // (1) What this device learned from earlier lists (an id that no longer exists is ignored).
  const learnedId = key ? learned[key] : undefined;
  if (learnedId && dict.get(learnedId)) return { ...base, match: learnedId, alternatives: [], status: 'sure' };

  // (2) An exact name or alias, in `lang` or the other language.
  const exact = dict.ingredientByName(name, lang) ?? dict.ingredientByName(name, otherLang(lang));
  if (exact) return { ...base, match: exact.id, alternatives: [], status: 'sure' };

  // A word of one or two letters is too short to guess at.
  if (key.replace(/[^\p{L}\p{N}]/gu, '').length <= 2) return { ...base, match: null, alternatives: [], status: 'unknown' };

  // (3) Search in both languages: a clear winner is a "maybe", otherwise only alternatives.
  const hits = rankedBoth(name, dict, lang);
  const first = hits[0];
  const second = hits[1];
  const clear = second ? first !== undefined && first.score >= CLEAR_FACTOR * second.score : (first?.score ?? 0) >= SINGLE_HIT_SCORE;
  if (first && first.score > 0 && (first.score >= MAYBE_SCORE || clear)) {
    return { ...base, match: first.id, alternatives: hits.slice(1, 3).map((h) => h.id), status: 'maybe' };
  }
  return { ...base, match: null, alternatives: hits.slice(0, 3).map((h) => h.id), status: 'unknown' };
}

/**
 * Proposals for a pasted or typed list, one per item in the order of the text (spec V6 §1a).
 * `learned` maps normalizeKey(name) -> ingredient id (the device setting `shop.learned`).
 */
export function suggestShopLines(
  text: string,
  dict: Dictionary,
  lang: Lang,
  learned: Readonly<Record<string, string>> = {},
): ShopSuggestion[] {
  return splitShopList(text).map((raw) => suggestLine(raw, dict, lang, learned));
}
