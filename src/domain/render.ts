// Rendering a structured ingredient line in a language (docs/phase-2-spec.md §3 `render.ts`).
// Framework-free.
//
//   NL  250 g schelvisfilet (of kabeljauw), stukken van 2-3 cm
//   EN  250 g haddock fillet (or cod), 2-3 cm pieces
//
// Only names change between languages: el -> tbsp, teentje -> clove, dl -> ml × 100 (units.json
// `en.render`/`en.scale`); grams, ml and °C stay. Unresolved lines (ing null) render their raw text,
// scaled only when the quantity was parsed. Pinches never scale.
import { pickText, type Lang, type Line, type LinePart, type Qty } from './model.ts';
import type { Dictionary, Ingredient, Unit } from './dictionary.ts';
import { parseQty } from './parser.ts';
import { scaleKindOf, scaleQty } from './scale.ts';

export interface LineParts {
  /** "2", "1½", "2-3", "" when there is no quantity. */
  qty: string;
  /** "el" / "tbsp", "" for counted pieces. */
  unit: string;
  /** Qualifiers + name: "rode ui" / "red onion"; the raw name part for unresolved lines. */
  name: string;
  prep: string;
  note: string;
  /** "(of kabeljauw)" / "and/or frying sausage". */
  alt: string;
  /** "sap van" / "juice of" for part lines. */
  part: string;
  /** "150 g" pack size, "" when none. */
  packSize: string;
  /** "(garnering)", "(optioneel)", "" */
  optional: string;
  /** English gloss for Dutch-only products ("Dutch smoked sausage"), "" when none. */
  gloss: string;
  /** False when the line renders its raw text. */
  resolved: boolean;
  /** The full line as `renderLine` returns it. */
  text: string;
}

const FRACTIONS: [number, string][] = [
  [0.5, '½'],
  [0.25, '¼'],
  [0.75, '¾'],
  [1 / 3, '⅓'],
  [2 / 3, '⅔'],
  [0.125, '⅛'],
];

function formatNumber(n: number, lang: Lang): string {
  if (!Number.isFinite(n)) return '';
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 1e-6) return String(whole);
  for (const [value, glyph] of FRACTIONS) {
    if (Math.abs(frac - value) < 0.01) return (whole === 0 ? '' : String(whole)) + glyph;
  }
  const s = (Math.round(n * 100) / 100).toString();
  return lang === 'nl' ? s.replace('.', ',') : s;
}

/** "½", "1½", "2-3", "ca. 400" / "approx. 400"; decimals only for non-fraction values. */
export function formatQty(min: number, max?: number, lang: Lang = 'nl', approx = false): string {
  const a = formatNumber(min, lang);
  const text = max !== undefined && max > min ? `${a}-${formatNumber(max, lang)}` : a;
  if (!approx) return text;
  return (lang === 'nl' ? 'ca. ' : 'approx. ') + text;
}

function qtyText(q: Qty, lang: Lang): string {
  return formatQty(q.min, q.max, lang, q.approx === true);
}

function isPlural(q: Qty | null | undefined): boolean {
  if (!q) return false;
  return (q.max ?? q.min) > 1;
}

/**
 * Unit label in a language; `qty` picks singular/plural. dl renders in EN as ml (scaled by the
 * caller). An ingredient may name its own units (`unitNames`: "1 stukje foelie" -> "1 blade mace").
 */
export function unitLabel(unit: Unit, lang: Lang, qty?: Qty | null, ing?: Ingredient): string {
  const plural = isPlural(qty);
  const own = ing?.unitNames?.[unit.id]?.[lang];
  if (own) return plural && own.many ? own.many : own.one;
  if (lang === 'en') {
    if (unit.en.render) return unit.en.render;
    return plural && unit.en.many ? unit.en.many : unit.en.one;
  }
  return plural && unit.nl.many ? unit.nl.many : unit.nl.one;
}

/**
 * The unit's own name in a language, WITHOUT the English display conversion (dl stays "dl", not
 * "ml") and without an ingredient's own unit names: what the raw text of a line should say so
 * that parsing it back yields the same unit (the editor's `rawFromLine`).
 */
export function unitName(unit: Unit, lang: Lang, qty?: Qty | null): string {
  const plural = isPlural(qty);
  const n = lang === 'en' ? unit.en : unit.nl;
  return plural && n.many ? n.many : n.one;
}

function multiplyQty(q: Qty, s: number): Qty {
  const out: Qty = { min: Math.round(q.min * s * 1000) / 1000 };
  if (q.max !== undefined) out.max = Math.round(q.max * s * 1000) / 1000;
  if (q.approx) out.approx = true;
  return out;
}

function isQuarterStep(n: number): boolean {
  return Math.abs(n * 4 - Math.round(n * 4)) < 1e-9;
}

/**
 * The unit and quantity to show: a metric unit that scaled below 1 (½ kg, ¾ l) or, for dl, off
 * the ¼ steps (0,65 dl) is shown in its base unit (500 g, 65 ml); in English dl always becomes ml
 * (units.json `en.render`/`en.scale`).
 */
function displayUnit(q: Qty | null, unit: Unit | undefined, dict: Dictionary, lang: Lang): { q: Qty | null; unit: Unit | undefined } {
  if (!q || !unit) return { q, unit };
  let shownQ = q;
  let shownUnit = unit;
  const conv = unit.group === 'mass' ? unit.g : unit.group === 'volume' ? unit.ml : undefined;
  if (conv && conv > 1 && scaleKindOf(unit) !== 'spoon') {
    const offGrid = conv <= 100 && (!isQuarterStep(q.min) || (q.max !== undefined && !isQuarterStep(q.max)));
    if (q.min < 1 || offGrid) {
      const base = dict.unit(unit.group === 'mass' ? 'g' : 'ml');
      if (base) {
        shownQ = multiplyQty(q, conv);
        shownUnit = base;
      }
    }
  }
  if (lang === 'en' && shownUnit.en.render && shownUnit.en.scale) {
    const target = dict.unit(shownUnit.en.render);
    shownQ = multiplyQty(shownQ, shownUnit.en.scale);
    if (target) shownUnit = target;
  }
  return { q: shownQ, unit: shownUnit };
}

const PART_LABEL: Record<LinePart, { nl: string; en: string; enPlural?: string }> = {
  sap: { nl: 'sap van', en: 'juice of' },
  rasp: { nl: 'rasp van', en: 'zest of' },
  'rasp-en-sap': { nl: 'rasp en sap van', en: 'zest and juice of' },
  wit: { nl: 'het wit van', en: 'the white of', enPlural: 'the whites of' },
  geel: { nl: 'het geel van', en: 'the yolk of', enPlural: 'the yolks of' },
  blaadjes: { nl: 'blaadjes van', en: 'leaves of' },
};

function partLabel(part: LinePart, lang: Lang, qty: Qty | null | undefined): string {
  const l = PART_LABEL[part];
  if (lang === 'nl') return l.nl;
  return isPlural(qty) && l.enPlural ? l.enPlural : l.en;
}

function capitaliseLike(raw: string, text: string): string {
  if (!raw || !text) return text;
  const first = raw.charAt(0);
  if (first !== first.toLowerCase() && text.charAt(0) === text.charAt(0).toLowerCase()) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return text;
}

function scaled(line: Line, dict: Dictionary, factor: number): Qty | null {
  if (!line.qty) return null;
  const unit = line.unit ? dict.unit(line.unit) : null;
  return scaleQty(line.qty, factor, unit);
}

/** "rode ui" / "red onion" (qualifiers + dictionary name, plural when the line counts more than one). */
function nameText(line: Line, dict: Dictionary, lang: Lang, q: Qty | null, unit: Unit | undefined): string {
  // Plural: "2 uien" / "2 onions" when counted; "400 g aardappelen", "1 blik kidneybonen" for
  // mass/volume/package units whenever the dictionary has a plural form (it omits one for mass
  // nouns such as "room"); count units keep the singular ("2 teentjes knoflook").
  let plural = false;
  if (line.ing) {
    if (!unit) plural = isPlural(q);
    else if (unit.group === 'mass' || unit.group === 'volume' || unit.group === 'package') plural = true;
  }
  let name = line.ing ? dict.ingredientName(line.ing, lang, plural) : (line.name ?? '');
  // "1 blik tomaten uit blik" / "1 tin tinned salmon": the unit already says it.
  if (unit?.id === 'blik' && line.ing) {
    name = lang === 'nl' ? name.replace(/\s+(?:uit|in) blik$/iu, '') : name.replace(/^(?:tinned|canned)\s+/iu, '');
  }
  const words: string[] = [];
  for (const id of line.qual ?? []) {
    const w = dict.qualifierName(id, lang);
    // "grote winterpeen" -> "large carrot", not "large large carrot".
    if (name.toLowerCase().startsWith(w.toLowerCase() + ' ')) continue;
    words.push(w);
  }
  words.push(name);
  return words.filter(Boolean).join(' ');
}

function altText(line: Line, dict: Dictionary, lang: Lang, factor: number): string {
  if (!line.alt || line.alt.length === 0) return '';
  const items = line.alt.map((a) => renderAlt(a, dict, lang, factor, line)).filter(Boolean);
  if (items.length === 0) return '';
  const joined = items.join(', ');
  if (line.altMode === 'and-or') return (lang === 'nl' ? 'en/of ' : 'and/or ') + joined;
  return `(${lang === 'nl' ? 'of' : 'or'} ${joined})`;
}

function renderAlt(alt: Line, dict: Dictionary, lang: Lang, factor: number, parent: Line): string {
  if (!alt.ing || !dict.get(alt.ing)) {
    // Unresolved alternative: its own raw text (scaled when its qty parsed).
    return rawText(alt, dict, lang, factor);
  }
  const p = renderLineParts(alt, dict, lang, factor);
  // "250 g pinda's (of cashewnoten)": an alternative without its own amount shares the line's.
  if (!alt.qty && !alt.unit && (parent.qty || parent.unit)) {
    const unit = parent.unit ? dict.unit(parent.unit) : undefined;
    p.name = nameText(alt, dict, lang, scaled(parent, dict, factor), unit);
  }
  return [p.part, p.qty, p.unit, p.name, p.packSize ? `(${p.packSize})` : ''].filter(Boolean).join(' ') + (p.prep ? `, ${p.prep}` : '');
}

/** Raw text of a line in a language (fallback other language), with the leading qty scaled when parsed. */
function rawText(line: Line, dict: Dictionary, lang: Lang, factor: number): string {
  const raw = pickText(line.raw, lang);
  if (!raw || factor === 1 || !line.qty) return raw;
  const q = scaled(line, dict, factor);
  if (!q) return raw;
  const rawLang: Lang = line.raw[lang] ? lang : lang === 'nl' ? 'en' : 'nl';
  // The quantity sits at the start, or after "sap van " / "juice of ".
  const prefix = /^(?:(?:rasp en sap|sap en rasp|sap|rasp|het wit|het geel|(?:de )?blaadjes)\s+van\s+|(?:the\s+)?(?:zest and juice|juice and zest|juice|zest|whites?|yolks?|leaves)\s+of\s+)/iu.exec(raw);
  const start = prefix ? prefix[0].length : 0;
  const m = parseQty(raw.slice(start), rawLang);
  if (!m) return raw;
  const consumed = raw.slice(start, start + m.length);
  const trailing = /\s*$/.exec(consumed)?.[0] ?? '';
  return raw.slice(0, start) + qtyText(q, lang) + trailing + raw.slice(start + m.length);
}

/**
 * The pieces of a rendered line for the UI chips: `[2] [el] [olijfolie ✓]`. `text` is the full
 * line. Unresolved lines return `resolved: false` with the raw text in `text` and whatever was
 * parsed (qty, unit, name part) in the fields. A line whose `ing` this dictionary does not know
 * (a received recipe linked to a user entry on the other phone) counts as unresolved too: the
 * slug is never shown as a product name.
 */
export function renderLineParts(line: Line, dict: Dictionary, lang: Lang, factor = 1): LineParts {
  const empty: LineParts = { qty: '', unit: '', name: '', prep: '', note: '', alt: '', part: '', packSize: '', optional: '', gloss: '', resolved: false, text: '' };
  if (line.kind === 'header') {
    const text = pickText(line.raw, lang);
    return { ...empty, name: text, text };
  }
  const unit = line.unit ? dict.unit(line.unit) : undefined;
  const q = scaled(line, dict, factor);
  const shown = displayUnit(q, unit, dict, lang);
  const qShown = shown.q;
  const unitShown = shown.unit;
  const prep = line.prep ? pickText(line.prep, lang) : '';
  const note = line.note ? pickText(line.note, lang) : '';
  const optional = line.role === 'garnish'
    ? lang === 'nl' ? '(garnering)' : '(garnish)'
    : line.optional && !(line.note && line.note.nl === 'naar smaak')
      ? lang === 'nl' ? '(optioneel)' : '(optional)'
      : '';

  const ing = line.ing ? dict.get(line.ing) : undefined;
  if (!line.ing || !ing) {
    const text = rawText(line, dict, lang, factor);
    return {
      ...empty,
      qty: qShown ? qtyText(qShown, lang) : '',
      unit: unitShown ? unitLabel(unitShown, lang, qShown) : '',
      name: line.name ?? '',
      prep,
      note,
      part: line.part ? partLabel(line.part, lang, q) : '',
      packSize: line.packSize ?? '',
      optional,
      text,
    };
  }

  const parts: LineParts = {
    qty: qShown ? qtyText(qShown, lang) : '',
    unit: unitShown ? unitLabel(unitShown, lang, qShown, ing) : '',
    name: nameText(line, dict, lang, q, unit),
    prep,
    note,
    alt: altText(line, dict, lang, factor),
    part: line.part ? partLabel(line.part, lang, q) : '',
    packSize: line.packSize ?? '',
    optional,
    gloss: lang === 'en' ? (ing.gloss?.en ?? '') : '',
    resolved: true,
    text: '',
  };
  let packText = '';
  if (parts.packSize) {
    const each = !unit && isPlural(q);
    packText = each ? `(${parts.packSize} ${lang === 'nl' ? 'per stuk' : 'each'})` : `(${parts.packSize})`;
  }
  let text = [parts.part, parts.qty, parts.unit, parts.name, packText, parts.alt].filter(Boolean).join(' ');
  if (parts.prep) text += `, ${parts.prep}`;
  if (parts.note) text += ` (${parts.note})`;
  if (parts.optional) text += ` ${parts.optional}`;
  parts.text = capitaliseLike(pickText(line.raw, lang), text);
  return parts;
}

/** The line as one string in a language, scaled by `factor` (servings / base servings). */
export function renderLine(line: Line, dict: Dictionary, lang: Lang, factor = 1): string {
  return renderLineParts(line, dict, lang, factor).text;
}
