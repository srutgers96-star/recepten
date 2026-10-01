// Deterministic ingredient-line parser (docs/phase-2-spec.md §3, PLAN.md §5 "Parser"). Framework-free.
//
//   250 g schelvisfilet (of kabeljauw) [stukken van 2-3 cm]
//   -> { qty: {min: 250}, unit: 'g', ing: 'schelvisfilet', name: 'schelvisfilet',
//        alt: [{ing: 'kabeljauw'}], altMode: 'or', prep: {nl: 'stukken van 2-3 cm', en: '2-3 cm pieces'} }
//
// Grammar: [part van] [qty] [unit] [qualifiers…] name [van 150 g] [(paren)…] [[prep]…], with
// alternatives split on "en/of" and " of " ("Rookworst en/of braadworst", "4 dunne preien of 2 dikke
// preien"). Parentheses are classified: "(of X)" -> alt, "(400 g)" -> packSize, "(garnering)" ->
// garnish, anything else -> note. Quantities are NEVER changed: only read.
//
// Name resolution tries the whole remaining name first ("zwarte peper" is its own product), then
// drops leading qualifiers one by one ("rode ui" -> ui + qual rode). Unresolved lines keep the
// name part in `name` (ing: null) so the UI and the dictionary agents can work from it.
//
// Corpus-driven rules on top of the grammar: an alias that starts with a unit word wins ("blik
// tomaten" -> tomaten uit blik); a size word before a slice unit is a cut ("8 dunne sneetjes" ->
// "thinly sliced"), and so is a slice word after a mass unit ("150 g dunne plakjes pancetta"); a
// known prep phrase at the end of the name is kept ("olijven zonder pit" -> pitted); "a/b" names
// become product + alternative ("pinda's/cashewnoten"); "30 g + 40 g boter" adds up; a counted
// "(blokje)" is the stock cube; a note that only repeats the product is dropped; "(baby-)" is a
// qualifier; "fijngesneden" is chopped or sliced depending on the ingredient (`cut`).
//
// English input (lang 'en') uses the English unit/qualifier tables, "juice of", " or ", "to taste",
// "(garnish)" and reads "1.5" as a decimal; "1,5" is accepted in both languages. US units (lb, oz,
// cup, stick) are units.json ids; the renderer converts them for Dutch readers.
//
// Free text is never half-translated (docs/phase-5-spec.md A-bis.1): a parenthetical or comma tail
// is translated as a whole through the prep phrases and note phrases (incl. `,`/`;`/and-parts and
// "{n}" templates), or as "[phrase] quantity unit [phrase]" with the unit converted for the other
// language ("approximately 1 pound" -> "ongeveer 450 g"); anything else stays a note in the SOURCE
// language only, and the renderer marks it (`noteForeign`) when it shows it in the other language.
import type { Lang, Line, LinePart, Qty, Text } from './model.ts';
import type { Dictionary } from './dictionary.ts';
import { normalizeKey } from './dictionary.ts';

export interface QtyMatch {
  qty: Qty;
  /** Characters consumed from the start of the text, including trailing whitespace. */
  length: number;
}

const VULGAR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const VULGAR_CLASS = '[½¼¾⅓⅔⅛]';
const NUMBER = [
  String.raw`\d+\s\d+/\d+`, // 1 1/2
  String.raw`\d+\s?${VULGAR_CLASS}`, // 1½, 1 ½
  String.raw`\d+/\d+`, // 1/2
  String.raw`\d+(?:[.,]\d+)?`, // 400, 1,5, 1.5
  VULGAR_CLASS, // ½
].join('|');
const APPROX = String.raw`(?:ca\.?|circa|±|ongeveer|zo'n|approximately|approx\.?|about|around|roughly)\s*`;
const RANGE_SEP = String.raw`(?:\s?[-–—]\s?|\s+(?:tot|à|of|to|or)\s+)`;
const QTY_RE = new RegExp(
  String.raw`^(${APPROX})?(?:(${NUMBER})${RANGE_SEP}(${NUMBER})|(\d+)\+(\d+)|(${NUMBER}))(?=\s|$|\p{L})\s*`,
  'iu',
);

function parseNumber(s: string): number {
  const t = s.trim();
  const mixed = /^(\d+)\s(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  let n = 0;
  const digits = /^\d+(?:[.,]\d+)?/.exec(t);
  if (digits) n = parseFloat(digits[0].replace(',', '.'));
  const v = /[½¼¾⅓⅔⅛]/.exec(t);
  if (v) n += VULGAR[v[0]] ?? 0;
  return n;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Quantity at the start of a text: "2", "2-3", "2 à 3", "1 of 2", "1 1/2", "1½", "½", "1,5",
 * "ca. 400", "2+1" (= 3), "a"/"an"/"een" (= 1). Null when the text does not start with one.
 */
export function parseQty(text: string, lang: Lang = 'nl'): QtyMatch | null {
  const m = QTY_RE.exec(text);
  if (m) {
    const approx = m[1] !== undefined;
    let qty: Qty;
    if (m[2] !== undefined && m[3] !== undefined) {
      const a = round3(parseNumber(m[2]));
      const b = round3(parseNumber(m[3]));
      qty = a <= b ? { min: a, max: b } : { min: b, max: a };
      if (qty.max === qty.min) delete qty.max;
    } else if (m[4] !== undefined && m[5] !== undefined) {
      qty = { min: Number(m[4]) + Number(m[5]) };
    } else {
      qty = { min: round3(parseNumber(m[6] as string)) };
    }
    if (approx) qty.approx = true;
    return { qty, length: m[0].length };
  }
  const article = lang === 'en' ? /^(?:a|an)\s+(?=\p{L})/iu : /^(?:een|één)\s+(?=\p{L})/iu;
  const am = article.exec(text);
  if (am) return { qty: { min: 1 }, length: am[0].length };
  return null;
}

// --- text helpers ------------------------------------------------------------------------------

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function tidyName(s: string): string {
  return collapse(s).replace(/^[,;.\s]+|[,;.\s]+$/g, '');
}

/**
 * Joins two texts per language. The source language (`source`, the language the line was written in)
 * keeps every part; the other language is only claimed when EVERY part has it, so a reader of that
 * language falls back to the complete source text instead of seeing half a note. Without `source`
 * (legacy) Dutch is treated as the source.
 */
function joinText(a: Text | null | undefined, b: Text, sep: string, source: Lang = 'nl'): Text {
  if (!a) return b;
  const other: Lang = source === 'nl' ? 'en' : 'nl';
  const out: Text = {};
  const src = [a[source], b[source]].filter((s): s is string => !!s);
  const oth = [a[other], b[other]].filter((s): s is string => !!s);
  if (src.length) out[source] = src.join(sep);
  if (oth.length && oth.length === src.length) out[other] = oth.join(sep);
  else if (oth.length && !src.length) out[other] = oth.join(sep);
  return out;
}

const HEADER_RE = /:\s*$/;
const BRACKET_RE = /\s*\[([^\]]*)\]/g;
const PAREN_RE = /\s*\(([^)]*)\)/g;
const PACK_UNIT = String.raw`(?:g|gr|gram|kg|ml|dl|l|ltr|liter|litre)`;
const PACK_SIZE_RE = new RegExp(String.raw`^(?:(ca\.?|circa|approx\.?|about)\s*)?(\d+(?:[.,]\d+)?)\s?(${PACK_UNIT})$`, 'iu');
const PACK_SUFFIX_RE = new RegExp(String.raw`\s+(?:van|of)\s+((?:(?:ca\.?|circa|approx\.?|about)\s*)?\d+(?:[.,]\d+)?\s?${PACK_UNIT})$`, 'iu');

const PART_RE: Record<Lang, RegExp> = {
  nl: /^(rasp en sap|sap en rasp|sap|rasp|het wit|het geel|(?:de )?blaadjes)\s+van\s+/iu,
  en: /^(?:the\s+)?(zest and juice|juice and zest|juice|zest|whites?|yolks?|leaves)\s+of\s+/iu,
};
const PART_ID: Record<string, LinePart> = {
  sap: 'sap',
  rasp: 'rasp',
  'rasp en sap': 'rasp-en-sap',
  'sap en rasp': 'rasp-en-sap',
  'het wit': 'wit',
  'het geel': 'geel',
  blaadjes: 'blaadjes',
  'de blaadjes': 'blaadjes',
  juice: 'sap',
  zest: 'rasp',
  'zest and juice': 'rasp-en-sap',
  'juice and zest': 'rasp-en-sap',
  white: 'wit',
  whites: 'wit',
  yolk: 'geel',
  yolks: 'geel',
  leaves: 'blaadjes',
};

const OPTIONAL_PREFIX_RE = /^(?:optioneel|optional|evt\.?|eventueel|optionally)\s*:?\s+/iu;
const TO_TASTE_RE = /\s*,?\s*(naar smaak|to taste)$/iu;
const OF_CHOICE_RE = /\s*,?\s*(naar keuze|of your choice|of choice)$/iu;
const PURPOSE_RE = /\s+(om (?:in )?te bakken|voor het bakken|om (?:in )?te frituren|om in te vetten|for frying|to fry in|for greasing)$/iu;
const GARNISH_RE = /^(?:garnering|als garnering|ter garnering|garnish|for garnish|to garnish|for garnishing|for decoration)$/iu;
const OPTIONAL_RE = /^(?:optioneel|optional|evt\.?|eventueel|naar wens)$/iu;
const TO_TASTE_PAREN_RE = /^(?:naar smaak|to taste)$/iu;
const ALT_PAREN_RE = /^(?:of|or)\s+(.+)$/iu;

const NOTE_TEXT: Record<'naar smaak' | 'naar keuze' | 'om in te bakken', Text> = {
  'naar smaak': { nl: 'naar smaak', en: 'to taste' },
  'naar keuze': { nl: 'naar keuze', en: 'of your choice' },
  'om in te bakken': { nl: 'om in te bakken', en: 'for frying' },
};

function normalisePackSize(s: string): string {
  const m = PACK_SIZE_RE.exec(collapse(s));
  if (!m) return collapse(s);
  const approx = m[1] ? 'ca. ' : '';
  const unit = (m[3] as string).toLowerCase();
  const unitId = unit === 'gr' || unit === 'gram' ? 'g' : unit === 'ltr' || unit === 'liter' || unit === 'litre' ? 'l' : unit;
  return `${approx}${m[2]} ${unitId}`;
}

// --- the parser --------------------------------------------------------------------------------

interface Body {
  qty: Qty | null;
  unit: string | null;
  ing: string | null;
  name: string;
  qual: string[];
  part: LinePart | null;
  prep: Text | null;
  note: Text | null;
  packSize: string | null;
  alt: Line[];
  altMode: 'or' | 'and-or' | null;
  optional: boolean;
  garnish: boolean;
  /** Unresolved [brackets] / free-text notes lower the confidence. */
  prepOk: boolean;
  parenOk: number;
  hadBrackets: boolean;
  hadParens: boolean;
}

function emptyBody(): Body {
  return {
    qty: null,
    unit: null,
    ing: null,
    name: '',
    qual: [],
    part: null,
    prep: null,
    note: null,
    packSize: null,
    alt: [],
    altMode: null,
    optional: false,
    garnish: false,
    prepOk: true,
    parenOk: 1,
    hadBrackets: false,
    hadParens: false,
  };
}

/** Longest unit alias at the start of `text` (whole word, optional trailing '.'). */
function matchUnit(text: string, dict: Dictionary, lang: Lang): { id: string; rest: string } | null {
  const key = normalizeKey(text);
  for (const alias of dict.unitAliases(lang)) {
    if (!key.startsWith(alias)) continue;
    const after = key.charAt(alias.length);
    if (after !== '' && after !== ' ' && after !== ',' && after !== '.') continue;
    const unit = dict.unitByAlias(alias, lang);
    if (!unit) continue;
    // Consume the same number of source characters (keys only fold diacritics, so lengths match).
    let rest = text.slice(alias.length);
    rest = rest.replace(/^\.?,?\s*/, '');
    if (lang === 'en') rest = rest.replace(/^of\s+/iu, '');
    return { id: unit.id, rest };
  }
  return null;
}

/** Leading qualifier, two words first ("jong belegen"), then one (optionally followed by a comma: "grote, rijpe tomaten"). */
function matchQualifier(text: string, dict: Dictionary, lang: Lang, qualOnly: boolean): { id: string; word: string; rest: string } | null {
  const two = /^(\S+\s+\S+?),?(?:\s+|$)/u.exec(text);
  if (two) {
    const q2 = dict.qualifierByWord(two[1] as string, lang);
    if (q2) {
      const rest = text.slice(two[0].length);
      if (rest || qualOnly) return { id: q2.id, word: two[1] as string, rest };
    }
  }
  const m = /^(\S+?),?(?:\s+|$)/u.exec(text);
  if (!m) return null;
  const word = m[1] as string;
  if (!word || word.endsWith('-')) return null; // "kippen- of kalfsgehakt"
  const q = dict.qualifierByWord(word, lang);
  if (!q) return null;
  const rest = text.slice(m[0].length);
  // A qualifier is never the whole name, except on the left of "of": "1 rode of gele paprika".
  if (!rest && !qualOnly) return null;
  return { id: q.id, word, rest };
}

/**
 * Resolve a name: the whole text, or a slash list whose sides are all the same product
 * ("geelwortel/koenjit"). A slash between different products ("pinda's/cashewnoten") is left to
 * the caller, which turns the other sides into alternatives.
 */
function resolveName(text: string, dict: Dictionary, lang: Lang): string | null {
  const hit = dict.ingredientByName(text, lang);
  if (hit) return hit.id;
  if (text.includes('/')) {
    const ids = text.split('/').map((side) => dict.ingredientByName(side, lang)?.id ?? null);
    if (ids.length > 1 && ids[0] && ids.every((id) => id === ids[0])) return ids[0];
  }
  return null;
}

/** Count units that describe a cut ("8 dunne sneetjes", "150 g dunne plakjes pancetta"). */
const SLICE_UNITS: ReadonlySet<string> = new Set(['plak', 'snee', 'schijf']);
/** A size word in front of a slice unit describes the slices, as a prep phrase (prep-phrases.json). */
const SIZE_BEFORE_SLICE: Record<string, string> = { dunne: 'dun gesneden', dikke: 'dik gesneden' };
/** Words that may stand alone as a trailing prep after the name ("champignons gehalveerd"): Dutch past participles. */
const PARTICIPLE_RE = /^(?:ge|ont|uit|af|ver)\S{2,}(?:d|t|en)$/iu;
const CUBE_NOTE_RE = /^blokjes?$/iu;

function addPrep(body: Body, t: Text, lang: Lang): void {
  if (!t.nl && !t.en) return;
  if (lang === 'nl' ? t.en === undefined : t.nl === undefined) body.prepOk = false;
  body.prep = joinText(body.prep, t, '; ', lang);
}

function prepText(text: string, dict: Dictionary, lang: Lang, body: Body): Text {
  const ing = body.ing ? dict.get(body.ing) : undefined;
  return dict.noteFor(text, lang, { slice: ing?.cut === 'slice' });
}

/** Both languages known for this text. */
function bilingual(t: Text): boolean {
  return t.nl !== undefined && t.en !== undefined;
}

/** Rounded the way the shopping list rounds base amounts: to 1 below 10, 5 below 100, 10 below 1000, 50 above. */
function niceAmount(n: number): number {
  const roundTo = (v: number, step: number) => Math.round(v / step) * step;
  const multiple = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-9;
  if (n < 10) return Math.max(1, Math.round(n));
  if (n < 100) return roundTo(n, 5);
  if (n < 1000) return multiple(n, 5) ? n : roundTo(n, 10);
  return multiple(n, 50) ? n : roundTo(n, 50);
}

const APPROX_PREFIX_RE = new RegExp(`^${APPROX}`, 'iu');

/**
 * A note of the form "[phrase] quantity unit [phrase]" ("approximately 1 pound", "3 cups", "about 4-5
 * lbs total", "28-ounce", "ongeveer 2 dl"), translated with the unit converted for the other language
 * when units.json says so (`nl.render`/`en.render`: lb -> g, cup -> ml, dl -> ml) and otherwise named in
 * that language ("2 cm" stays). The phrases around the amount must be known note/prep phrases.
 * Null when the text is not of this form.
 */
function qtyNote(text: string, dict: Dictionary, lang: Lang): Text | null {
  const other: Lang = lang === 'nl' ? 'en' : 'nl';
  const t = collapse(text).replace(/(\d)-(?=\p{L})/gu, '$1 '); // "28-ounce" -> "28 ounce"
  const words = t.split(' ');
  // Longest leading phrase first, so "approximately" is translated as a phrase, not read as "ca.".
  for (let i = words.length - 1; i >= 0; i--) {
    const prefix = words.slice(0, i).join(' ');
    const prefixOut = prefix ? dict.phraseTranslation(prefix, lang) : '';
    if (prefixOut === undefined) continue;
    const rest = words.slice(i).join(' ');
    const q = parseQty(rest, lang);
    if (!q) continue;
    const u = matchUnit(rest.slice(q.length), dict, lang);
    if (!u) continue;
    const tail = tidyName(u.rest);
    const tailOut = tail ? dict.phraseTranslation(tail, lang) : '';
    if (tailOut === undefined) continue;
    const unit = dict.unit(u.id);
    if (!unit) continue;
    const conv = unit[other];
    const target = conv.render && conv.scale ? dict.unit(conv.render) : undefined;
    const approxWord = other === 'nl' ? 'ca. ' : 'approx. ';
    let amount: string;
    if (target && conv.scale) {
      const scale = conv.scale;
      const min = niceAmount(q.qty.min * scale);
      const max = q.qty.max !== undefined ? niceAmount(q.qty.max * scale) : undefined;
      amount = `${q.qty.approx ? approxWord : ''}${max !== undefined && max !== min ? `${min}-${max}` : `${min}`} ${target[other].one}`;
    } else {
      const number = rest.slice(0, q.length).trim().replace(APPROX_PREFIX_RE, '');
      const plural = (q.qty.max ?? q.qty.min) > 1;
      const names = unit[other];
      amount = `${q.qty.approx ? approxWord : ''}${number} ${plural && names.many ? names.many : names.one}`;
    }
    return { [lang]: collapse(text), [other]: [prefixOut, amount, tailOut].filter(Boolean).join(' ') };
  }
  return null;
}

/**
 * A free-text note in both languages when the whole text is known (prep/note phrases, or a quantity
 * with a unit), else in the source language only (docs/phase-5-spec.md A-bis.1: never a mix).
 */
function noteText(text: string, dict: Dictionary, lang: Lang, body: Body): Text {
  const t = collapse(text);
  const known = prepText(t, dict, lang, body);
  if (bilingual(known)) return known;
  return qtyNote(t, dict, lang) ?? { [lang]: t };
}

/**
 * unit + qualifiers + name of a text that no longer contains qty, parens or brackets.
 * Qualifiers are stripped from the front; resolution tries the longest name first.
 */
function parseNamePart(text: string, dict: Dictionary, lang: Lang, body: Body, qualOnly = false): void {
  let rest = collapse(text);
  /** Leading qualifiers: id plus the word as written ("oud"), so aliases like "oud wit brood" still match. */
  const quals: { id: string; word: string }[] = [];
  let unit: string | null = null;
  /** Prep phrases found inside the name ("dunne plakjes", "zonder pit"), translated once `ing` is known. */
  const preps: string[] = [];
  /** A comma tail ("kidneybonen, afgegoten"), classified after resolution. */
  let commaTail: string | null = null;
  /** The unit as written ("sticks"), for the butter-stick rule below. */
  let unitWord = '';

  // A dictionary alias that starts with a unit word ("blik tomaten" -> tomaten uit blik, "teentje
  // knoflook") beats the unit-first grammar, which would otherwise never let such an alias fire.
  if (!rest.includes(',')) {
    const u0 = matchUnit(rest, dict, lang);
    if (u0 && u0.rest) {
      const hit = resolveName(rest, dict, lang);
      if (hit) {
        body.unit = u0.id;
        body.ing = hit;
        body.qual = [];
        body.name = tidyName(u0.rest);
        return;
      }
    }
  }

  for (let guard = 0; guard < 8 && rest; guard++) {
    if (unit === null) {
      const u = matchUnit(rest, dict, lang);
      if (u) {
        unit = u.id;
        unitWord = rest.slice(0, rest.length - u.rest.length).replace(/[.,\s]+$/u, '');
        rest = u.rest;
        // "8 dunne sneetjes stokbrood": the size word describes the slices, not the bread.
        if (quals.length && SLICE_UNITS.has(unit) && quals.every((q) => SIZE_BEFORE_SLICE[q.id] !== undefined)) {
          for (const q of quals) preps.push(SIZE_BEFORE_SLICE[q.id] as string);
          quals.length = 0;
        }
        continue;
      }
    }
    const q = matchQualifier(rest, dict, lang, qualOnly);
    if (q) {
      quals.push({ id: q.id, word: q.word });
      rest = q.rest;
      continue;
    }
    // "150 g dunne plakjes pancetta", "100 g plakjes ham": after a mass/volume unit a slice word is a
    // cut, not a unit ("thinly sliced" / "sliced"); the size qualifiers in front of it go with it.
    if (unit !== null && lang === 'nl') {
      const g = dict.unit(unit)?.group;
      const f = matchUnit(rest, dict, lang);
      if ((g === 'mass' || g === 'volume') && f && SLICE_UNITS.has(f.id) && f.rest) {
        const word = rest.slice(0, rest.length - f.rest.length).replace(/[.,\s]+$/u, '');
        const size = quals.filter((q) => SIZE_BEFORE_SLICE[q.id] !== undefined);
        for (const q of size) quals.splice(quals.indexOf(q), 1);
        preps.push([...size.map((q) => dict.qualifier(q.id)?.nl[0] ?? q.id), word].join(' '));
        rest = f.rest;
        continue;
      }
    }
    break;
  }
  body.unit = unit;

  let name = tidyName(rest);
  // A comma tail after the name is a prep note when we know it ("kidneybonen, afgegoten"), else a
  // note. Lines without any quantity or unit keep their commas ("kroepoek, atjar en seroendeng").
  if ((body.qty !== null || unit !== null) && name.includes(',')) {
    const idx = name.indexOf(',');
    const head = tidyName(name.slice(0, idx));
    const tail = tidyName(name.slice(idx + 1));
    if (head && tail) {
      name = head;
      commaTail = tail;
    }
  }

  // Resolution: whole name first, then without leading qualifiers one at a time. Two passes: plain
  // names first ("gepelde tomaten uit blik" -> qual + "tomaten uit blik"), the prep-phrase rules
  // only when no candidate resolves as it stands.
  /** The name without the prep phrase the second pass split off ("garlic" of "garlic minced"). */
  let phraseHead: string | null = null;
  const tryResolve = (candidate: string, phrases: boolean): string | null => {
    if (!candidate) return null;
    phraseHead = null;
    if (!phrases) {
      const id = resolveName(candidate, dict, lang);
      if (id) return id;
      const p = PURPOSE_RE.exec(candidate);
      if (p) {
        const bare = tidyName(candidate.slice(0, p.index));
        const id2 = resolveName(bare, dict, lang);
        if (id2) {
          body.note = joinText(body.note, NOTE_TEXT['om in te bakken'], '; ', lang);
          return id2;
        }
      }
      return null;
    }
    // A known prep phrase at the end of the name ("olijven zonder pit", "champignons gehalveerd";
    // US style "garlic minced", "onion chopped"), and in English also in front of it ("minced garlic").
    const words = candidate.split(' ');
    for (let k = 1; k <= Math.min(lang === 'nl' ? 3 : 6, words.length - 1); k++) {
      const tailText = words.slice(-k).join(' ');
      if (lang === 'nl' && k === 1 && !PARTICIPLE_RE.test(tailText)) continue;
      if (dict.phraseTranslation(tailText, lang) === undefined) continue;
      const id3 = resolveName(words.slice(0, -k).join(' '), dict, lang);
      if (id3) {
        preps.push(tailText);
        phraseHead = words.slice(0, -k).join(' ');
        return id3;
      }
    }
    if (lang === 'en') {
      for (let k = 1; k <= Math.min(2, words.length - 1); k++) {
        const headText = words.slice(0, k).join(' ');
        if (dict.phraseTranslation(headText, lang) === undefined) continue;
        const id4 = resolveName(words.slice(k).join(' '), dict, lang);
        if (id4) {
          preps.push(headText);
          phraseHead = words.slice(k).join(' ');
          return id4;
        }
      }
    }
    return null;
  };
  const resolveWith = (nameText: string): boolean => {
    for (const phrases of [false, true]) {
      for (let i = 0; i <= quals.length; i++) {
        const candidate = [...quals.slice(i).map((q) => q.word), nameText].filter(Boolean).join(' ');
        const id = tryResolve(candidate, phrases);
        if (id) {
          body.ing = id;
          body.qual = quals.slice(0, i).map((q) => q.id);
          body.name = phraseHead ?? candidate;
          return true;
        }
      }
    }
    return false;
  };
  let resolved = resolveWith(name);

  // "pinda's/cashewnoten", "witte/rode wijn": the first side is the product, the others alternatives.
  if (!resolved && name.includes('/')) {
    const sides = name.split('/').map(tidyName).filter(Boolean);
    if (sides.length > 1) {
      const longest = sides.reduce((a, b) => (b.split(' ').length > a.split(' ').length ? b : a));
      const shared = longest.split(' ').slice(1);
      const full = sides.map((s) => (shared.length && !s.includes(' ') ? `${s} ${shared.join(' ')}` : s));
      // The first side may start with its own qualifiers ("witte wijn").
      let first = full[0] as string;
      for (let guard = 0; guard < 4; guard++) {
        const q = matchQualifier(first, dict, lang, false);
        if (!q) break;
        quals.push({ id: q.id, word: q.word });
        first = q.rest;
      }
      if (resolveWith(first)) {
        resolved = true;
        for (const side of full.slice(1)) body.alt.push(parseAlt(side, dict, lang));
        if (body.altMode === null) body.altMode = 'or';
      }
    }
  }

  if (!resolved) {
    body.ing = null;
    body.qual = quals.map((q) => q.id);
    body.name = name;
  } else if (body.ing) {
    const ing = dict.get(body.ing);
    // "1 blik zalm" -> the tinned product when the dictionary has one ("zalm uit blik").
    if (unit === 'blik' && lang === 'nl') {
      const tinned = resolveName(`${body.name} uit blik`, dict, lang);
      if (tinned && tinned !== body.ing) body.ing = tinned;
    }
    // "2 sticks butter": "stick(s)" is indexed as the celery stalk unit ("2 sticks celery"); for an
    // ingredient bought by weight it is the US butter stick (units.json 'stick', 113 g).
    if (unit === 'stengel' && lang === 'en' && /^sticks?$/iu.test(unitWord) && ing?.defaultUnit === 'g' && dict.unit('stick')) body.unit = 'stick';
    // "5 selderijstengels", "2 knoflookteentjes": an alias that ends in the ingredient's own count
    // unit ("stengels", "teentjes") sets that unit, unless the product's name itself ends in it
    // ("laurierblad" is not counted in leaves of bay leaf).
    if (unit === null && lang === 'nl' && ing && ing.defaultUnit && ing.defaultUnit !== 'stuk') {
      const u = dict.unit(ing.defaultUnit);
      if (u && u.group === 'count') {
        const keys = [u.nl.one, u.nl.many, ...(u.aliases?.nl ?? [])].filter((k): k is string => !!k).map(normalizeKey);
        const last = normalizeKey(body.name).split(' ').pop() ?? '';
        const own = normalizeKey(ing.nl.one);
        if (keys.some((k) => last.length > k.length && last.endsWith(k)) && !keys.some((k) => own.endsWith(k))) body.unit = ing.defaultUnit;
      }
    }
    // English noun-first counts: "2 garlic cloves", "6 bacon strips", "3 celery sticks" -> the count
    // unit is the last word of the name, unless the product's own name ends in it ("bay leaves").
    if (unit === null && lang === 'en' && ing && body.qty !== null && preps.length === 0) {
      const words = normalizeKey(body.name).split(' ');
      const last = words.length > 1 ? (words[words.length - 1] as string) : '';
      const u = last ? dict.unitByAlias(last, 'en') : undefined;
      if (u && u.group === 'count') {
        const own = [ing.en.one, ing.en.many].filter((n): n is string => !!n).map(normalizeKey);
        const keys = [u.en.one, u.en.many, ...(u.aliases?.en ?? [])].filter((k): k is string => !!k).map(normalizeKey);
        if (!own.some((n) => keys.some((k) => n.endsWith(k)))) body.unit = u.id;
      }
    }
  }

  for (const p of preps) addPrep(body, prepText(p, dict, lang, body), lang);
  if (commaTail !== null) {
    const t = prepText(commaTail, dict, lang, body);
    if (bilingual(t)) body.prep = joinText(body.prep, t, '; ', lang);
    else body.note = joinText(body.note, qtyNote(commaTail, dict, lang) ?? { [lang]: commaTail }, '; ', lang);
  }
}

function classifyParen(text: string, dict: Dictionary, lang: Lang, body: Body): void {
  const t = collapse(text);
  if (!t) return;
  body.hadParens = true;
  if (PACK_SIZE_RE.test(t)) {
    if (body.packSize === null) body.packSize = normalisePackSize(t);
    else body.note = joinText(body.note, noteText(t, dict, lang, body), '; ', lang);
    return;
  }
  const alt = ALT_PAREN_RE.exec(t);
  if (alt) {
    const phrase = noteText(t, dict, lang, body);
    if (bilingual(phrase)) {
      // "(or to taste)", "(of naar behoefte)": a note phrase, not another product.
      body.note = joinText(body.note, phrase, '; ', lang);
      if (/\b(?:to taste|naar smaak)\b/iu.test(`${phrase.nl} ${phrase.en}`)) body.optional = true;
      return;
    }
    body.alt.push(parseAlt(alt[1] as string, dict, lang));
    if (body.altMode === null) body.altMode = 'or';
    return;
  }
  if (GARNISH_RE.test(t)) {
    body.optional = true;
    body.garnish = true;
    return;
  }
  if (OPTIONAL_RE.test(t)) {
    body.optional = true;
    return;
  }
  if (TO_TASTE_PAREN_RE.test(t)) {
    body.optional = true;
    body.note = joinText(body.note, NOTE_TEXT['naar smaak'], '; ', lang);
    return;
  }
  if (body.ing) {
    const ing = dict.get(body.ing);
    // "1 kippenbouillon (blokje)": the counted item is the stock cube when the dictionary has one.
    if (CUBE_NOTE_RE.test(t) && (body.unit === null || dict.unit(body.unit)?.group === 'count')) {
      const cube = resolveName(`${body.name}blokje`, dict, lang) ?? resolveName(`${body.name} blokje`, dict, lang);
      if (cube && cube !== body.ing) {
        body.ing = cube;
        return;
      }
    }
    // "(baby-)spinazie": a lone qualifier word in parentheses qualifies the ingredient.
    const q = dict.qualifierByWord(t, lang);
    if (q) {
      if (!body.qual.includes(q.id)) body.qual.unshift(q.id);
      return;
    }
    // A note that only repeats the product ("1 tl djinten (komijn)", "ketoembar (gemalen
    // koriander)", "trassi (garnalenpasta)") explains the Dutch word; the dictionary name already does.
    if (ing) {
      const key = normalizeKey(t);
      const ownNl = [ing.nl.one, ing.nl.many].filter((n): n is string => !!n).map(normalizeKey);
      if (ownNl.includes(key)) return;
      const same = resolveName(t, dict, lang);
      if (same === body.ing) return;
      const ownEn = [ing.en.one, ing.en.many].filter((n): n is string => !!n).map(normalizeKey);
      const translated = lang === 'nl' ? dict.prepFor(t).en : t;
      if (translated !== undefined && ownEn.includes(normalizeKey(translated))) return;
      if (same) {
        const other = dict.get(same);
        // "ketoembar (koriander)": the plain product named inside the specific one.
        if (other && ownEn.some((n) => n.split(' ').includes(normalizeKey(other.en.one)))) return;
      }
    }
  }
  // A free-text note: both languages when the whole text is known ("ontdooid", "op kamertemperatuur",
  // "approximately 1 pound"), else the source language only (A-bis.1).
  const note = noteText(t, dict, lang, body);
  body.note = joinText(body.note, note, '; ', lang);
  body.parenOk = Math.min(body.parenOk, bilingual(note) ? 1 : 0.5);
}

/** "30 g + 40 g boter": two amounts in the same unit add up; the split is kept as a note. */
const SPLIT_QTY_RE = new RegExp(String.raw`^(${NUMBER})\s?(\p{L}+)\.?\s?\+\s?(${NUMBER})\s?(\p{L}+)\.?(?=\s)\s+`, 'iu');

function parseSplitQty(text: string, dict: Dictionary, lang: Lang, body: Body): string {
  const m = SPLIT_QTY_RE.exec(text);
  if (!m) return text;
  const u1 = dict.unitByAlias(m[2] as string, lang);
  const u2 = dict.unitByAlias(m[4] as string, lang);
  if (!u1 || !u2 || u1.id !== u2.id) return text;
  const a = round3(parseNumber(m[1] as string));
  const b = round3(parseNumber(m[3] as string));
  body.qty = { min: round3(a + b) };
  body.note = joinText(body.note, { nl: `${m[1]} ${u1.nl.one} + ${m[3]} ${u1.nl.one}`, en: `${m[1]} ${u1.en.one} + ${m[3]} ${u1.en.one}` }, '; ', lang);
  return `${m[2]} ${text.slice(m[0].length)}`;
}

function parseAlt(text: string, dict: Dictionary, lang: Lang): Line {
  const b = parseBody(text, dict, lang);
  return toLine({ [lang]: collapse(text) }, b, false);
}

/** The whole grammar over one line body (no header check; used recursively for alternatives). */
function parseBody(input: string, dict: Dictionary, lang: Lang): Body {
  const body = emptyBody();
  let text = collapse(input);

  // 1. [brackets] -> prep
  const brackets: string[] = [];
  text = text.replace(BRACKET_RE, (_m, inner: string) => {
    brackets.push(inner);
    return ' ';
  });
  // 2. (parens) -> classified later
  const parens: string[] = [];
  text = text.replace(PAREN_RE, (_m, inner: string) => {
    parens.push(inner);
    return ' ';
  });
  text = tidyName(text);

  // 3. optional markers around the name
  const opt = OPTIONAL_PREFIX_RE.exec(text);
  if (opt) {
    body.optional = true;
    text = tidyName(text.slice(opt[0].length));
  }
  const taste = TO_TASTE_RE.exec(text);
  if (taste && taste.index > 0) {
    body.optional = true;
    body.note = joinText(body.note, NOTE_TEXT['naar smaak'], '; ', lang);
    text = tidyName(text.slice(0, taste.index));
  }
  const choice = OF_CHOICE_RE.exec(text);
  if (choice && choice.index > 0) {
    body.note = joinText(body.note, NOTE_TEXT['naar keuze'], '; ', lang);
    text = tidyName(text.slice(0, choice.index));
  }

  // 4. "sap van …" / "juice of …"
  const part = PART_RE[lang].exec(text);
  if (part) {
    body.part = PART_ID[(part[1] as string).toLowerCase()] ?? null;
    text = text.slice(part[0].length);
  }

  // 5. "… van 150 g" -> packSize
  const pack = PACK_SUFFIX_RE.exec(text);
  if (pack) {
    body.packSize = normalisePackSize(pack[1] as string);
    text = tidyName(text.slice(0, pack.index));
  }

  // 6. quantity ("30 g + 40 g boter" adds up to one quantity with a note)
  text = parseSplitQty(text, dict, lang, body);
  if (body.qty === null) {
    const q = parseQty(text, lang);
    if (q) {
      body.qty = q.qty;
      text = text.slice(q.length);
    }
  }

  // 7. inline alternatives: "en/of" > " of " (only before the first comma, never after "kippen-")
  let altText: string | null = null;
  const andOr = /\s+(?:en\/of|and\/or)\s+/iu.exec(text);
  if (andOr) {
    body.altMode = 'and-or';
    altText = text.slice(andOr.index + andOr[0].length);
    text = text.slice(0, andOr.index);
  } else {
    const orRe = lang === 'nl' ? /\s+of\s+/iu : /\s+or\s+/iu;
    const or = orRe.exec(text);
    const comma = text.indexOf(',');
    if (or && (comma === -1 || or.index < comma) && !text.slice(0, or.index).endsWith('-')) {
      // "olive oil or as needed", "zout of meer naar smaak": a known phrase after "or" is a note.
      const tail = collapse(text.slice(or.index));
      const phrase = dict.phraseTranslation(tail, lang);
      if (phrase !== undefined) {
        body.note = joinText(body.note, { [lang]: tail, [lang === 'nl' ? 'en' : 'nl']: phrase }, '; ', lang);
        if (/\b(?:to taste|naar smaak)\b/iu.test(`${tail} ${phrase}`)) body.optional = true;
        text = tidyName(text.slice(0, or.index));
      } else {
        body.altMode = 'or';
        altText = text.slice(or.index + or[0].length);
        text = text.slice(0, or.index);
      }
    }
  }

  // 8. unit, qualifiers, name
  parseNamePart(text, dict, lang, body, altText !== null);

  if (altText !== null) {
    const alt = parseAlt(altText, dict, lang);
    // "1 rode of gele paprika": the left side was only qualifiers -> it shares the alternative's name.
    if (!body.name && body.qual.length && alt.name) {
      body.name = alt.name;
      body.ing = alt.ing ?? null;
    }
    body.alt.push(alt);
  }

  // 9. prep from brackets (ingredient-aware: "fijngesneden" is chopped for herbs, sliced for onion)
  if (brackets.length) body.hadBrackets = true;
  for (const b of brackets) addPrep(body, prepText(b, dict, lang, body), lang);

  // 10. parentheses
  for (const p of parens) classifyParen(p, dict, lang, body);

  return body;
}

function confidence(body: Body): number {
  let score = body.ing ? 0.6 : 0.2;
  // A parsed quantity, or a line that simply has none, is fine; digits we could not read are not.
  if (body.qty !== null || !/^\d/.test(body.name)) score += 0.1;
  if (!body.hadBrackets || body.prepOk) score += 0.15;
  score += 0.1 * body.parenOk;
  if (body.ing && body.name) score += 0.05;
  return Math.round(Math.min(1, score) * 100) / 100;
}

function toLine(raw: Text, body: Body, full: boolean): Line {
  const line: Line = { raw };
  if (full) line.kind = 'line';
  line.qty = body.qty;
  line.unit = body.unit;
  line.ing = body.ing;
  line.name = body.name;
  if (body.qual.length) line.qual = body.qual;
  if (body.part) line.part = body.part;
  if (body.prep) line.prep = body.prep;
  if (body.note) line.note = body.note;
  if (body.packSize !== null) line.packSize = body.packSize;
  if (body.alt.length) {
    line.alt = body.alt;
    line.altMode = body.altMode ?? 'or';
  }
  if (body.optional) line.optional = true;
  if (body.garnish) line.role = 'garnish';
  line.confidence = confidence(body);
  return line;
}

/**
 * Parse one raw ingredient line. `raw` is stored as `{ [lang]: raw }` (trimmed); a line ending in
 * ':' without brackets is a header. Everything else follows the grammar above.
 */
export function parseLine(raw: string, dict: Dictionary, lang: Lang): Line {
  const text = collapse(raw ?? '');
  const rawText: Text = { [lang]: text };
  if (!text) return { raw: rawText, kind: 'line', qty: null, unit: null, ing: null, name: '', confidence: 0 };
  if (HEADER_RE.test(text) && !/[[\]]/.test(text)) return { raw: rawText, kind: 'header' };
  const body = parseBody(text, dict, lang);
  return toLine(rawText, body, true);
}

/**
 * Score of a parse for picking the better language: a resolved ingredient counts most, then a
 * recognised unit and quantity, then the parser's own confidence.
 */
function parseScore(line: Line): number {
  if (line.kind === 'header') return 0;
  return (line.ing ? 3 : 0) + (line.unit ? 1 : 0) + (line.qty ? 1 : 0) + (line.confidence ?? 0);
}

/**
 * Parse a line whose language is not certain: the editor's NL/EN mode says where the text is
 * stored, not what language the cook typed ("1 eetlepel olijfolie" in the EN column is still
 * Dutch). Both grammars are tried and the better parse wins; ties go to `preferred`. The raw text
 * always stays in the `preferred` slot so the editor's columns keep their meaning.
 */
export function parseLineAuto(raw: string, dict: Dictionary, preferred: Lang): Line {
  const first = parseLine(raw, dict, preferred);
  if (first.kind === 'header' || !collapse(raw ?? '')) return first;
  const other: Lang = preferred === 'nl' ? 'en' : 'nl';
  const second = parseLine(raw, dict, other);
  if (parseScore(second) > parseScore(first)) return { ...second, raw: first.raw };
  return first;
}

/**
 * Re-parse an existing line from its `raw` (invariant 2), keeping user corrections: an `ing` and
 * `qual` that were set by hand survive when the parser cannot resolve the line itself.
 */
export function reparseLine(line: Line, dict: Dictionary, lang: Lang): Line {
  const source = line.raw[lang] ?? line.raw[lang === 'nl' ? 'en' : 'nl'] ?? '';
  const sourceLang: Lang = line.raw[lang] ? lang : lang === 'nl' ? 'en' : 'nl';
  const parsed = parseLineAuto(source, dict, sourceLang);
  const out: Line = { ...line, ...parsed, raw: line.raw };
  if (parsed.kind === 'header') return out;
  if (!parsed.ing && line.ing && dict.get(line.ing)) {
    out.ing = line.ing;
    if (line.qual) out.qual = line.qual;
    out.confidence = Math.max(parsed.confidence ?? 0, 0.6);
  }
  return out;
}
