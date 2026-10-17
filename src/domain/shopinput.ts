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
import { normalizeKey, type Dictionary, type Unit } from './dictionary.ts';
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

/** A comma separates items, except between two digits ("1,5 liter melk" is one item). */
const LIST_COMMA = /(?<!\d),|,(?!\d)/u;

/** "melk, 2 eieren,1,5 l room" -> ["melk", "2 eieren", "1,5 l room"]. */
export function splitShopList(text: string): string[] {
  return text
    .split(LIST_COMMA)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when the text holds more than one item (a comma that is not a decimal comma). */
export function isShopList(text: string): boolean {
  return LIST_COMMA.test(text);
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
