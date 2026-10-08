// Recipe variants (docs/phase-5-spec.md block F.2): "Maak glutenvrije / vegetarische / vegan
// versie". Framework-free: no preact, no dexie; runs in Node (tests).
//
//   variantDietsFor(recipe, lines, dict)      -> the diets a recipe does not have yet (a line contradicts it)
//   planVariant(recipe, diet, swaps, dict)    -> VariantPlan: per line that breaks the diet the swap from
//                                                data/swaps.json with the NEW raw text (only the ingredient
//                                                name is replaced; amount, unit, qualifiers and [prep] stay —
//                                                except: a counted line of a product sold by weight becomes
//                                                grams, "4 kipfilets" -> "800 g tofu"), `applies: false` when
//                                                the line cannot be rewritten safely (name not found, count
//                                                without a known piece weight, an unparenthesised "of …"
//                                                alternative), and `unresolved` for the lines without a swap
//                                                ("controleer zelf")
//   makeVariant(recipe, plan, diet, opts)     -> a NEW own recipe: fresh id, origin.kind 'user',
//                                                `variantOf: recipe.id`, the diet tag added (vegan implies
//                                                vegetarisch) as a hand-made choice (`metaManual`), "<naam>
//                                                (glutenvrij)" / "(gluten-free)" in both languages, only the
//                                                swaps with `applies: true` applied, each swap's cook's note
//                                                on its line
//
// Which lines break a diet is decided by src/domain/diet.ts (`dietTags` over the single line), so a
// "plantaardige" qualifier, an unresolved line or a glutenUnsure entry behaves exactly as on the
// detail page: only a line whose resolved ingredient CONTRADICTS the diet is a candidate. The name
// replacement works on the raw text per language (CLAUDE.md invariant 2: structure next to raw, and
// re-parsing the new raw resolves the new ingredient). Dutch and English are replaced
// independently; a second language whose text does not contain the old name is left out of the
// new line rather than kept with the old product in it.
import { dutchBaseForms, englishBaseForms, normalizeKey, type Dictionary, type Ingredient } from './dictionary.ts';
import { dietTags, type DietTag } from './diet.ts';
import { hasLang, newUserId, nowIso, type Lang, type Line, type Qty, type Recipe, type Text } from './model.ts';

export type VariantDiet = DietTag;

/** The diets a variant can be made for, in the order the UI offers them. */
export const VARIANT_DIETS: readonly VariantDiet[] = ['glutenvrij', 'vegetarisch', 'vegan'];

/** One entry of data/swaps.json. Unknown keys are preserved. */
export interface Swap {
  /** ingredients.json id of the product that breaks the diet. */
  from: string;
  /** ingredients.json id of the replacement (its flags satisfy every diet in `diets`; tools/validate-data.ts checks). */
  to: string;
  diets: VariantDiet[];
  /** A short cook's note shown under the swap ("tamari: controleer het etiket"). */
  note?: Text;
  [k: string]: unknown;
}

/** One proposed replacement on one line. */
export interface VariantSwap {
  /** Index into `VariantPlan.lines`. */
  index: number;
  fromId: string;
  toId: string;
  /**
   * The new raw text per language. Only the languages the original line has; a language whose text
   * did not contain the old name is left out. The ORIGINAL raw when `applies` is false.
   */
  raw: Text;
  /** The new name part (`Line.name`) in the language the parser reads (nl when present, else en). */
  name?: string;
  /**
   * Set when a counted line of a product sold by weight was converted ("4 kipfilets" -> "800 g tofu",
   * via the old product's weight per piece): the new quantity in grams; `applySwap` sets `unit: 'g'`
   * and drops the pack size.
   */
  grams?: Qty;
  /**
   * False when the line cannot be rewritten safely: the old name is not in the raw text, a counted
   * line has no known weight per piece, or the raw holds an unparenthesised "of …" alternative that
   * would stay in. The line stays and the UI says "controleer zelf".
   */
  applies: boolean;
  note?: Text;
}

export interface VariantPlan {
  diet: VariantDiet;
  /** The lines the plan was computed over (the effective lines, so a classic's line overrides are in). */
  lines: Line[];
  swaps: VariantSwap[];
  /** Indexes of the lines that break the diet but have no swap (or whose swap would still break it). */
  unresolved: number[];
}

export interface MakeVariantOptions {
  /** `origin.author` of the new recipe (the active profile's name). */
  author?: string | null;
  /** The new id (tests); default a fresh 'u:' id. */
  id?: string;
  /** createdAt / updatedAt (tests); default now. */
  now?: string;
}

/** The suffix in the variant's name per language: "Lasagne (glutenvrij)" / "Lasagne (gluten-free)". */
export const DIET_SUFFIX: Readonly<Record<VariantDiet, { nl: string; en: string }>> = {
  glutenvrij: { nl: 'glutenvrij', en: 'gluten-free' },
  vegetarisch: { nl: 'vegetarisch', en: 'vegetarian' },
  vegan: { nl: 'vegan', en: 'vegan' },
};

/** The tags a variant carries for a diet (data/recipes.json tag vocabulary: vegan implies vegetarisch). */
const DIET_TAGS_FOR: Readonly<Record<VariantDiet, readonly string[]>> = {
  glutenvrij: ['glutenvrij'],
  vegetarisch: ['vegetarisch'],
  vegan: ['vegetarisch', 'vegan'],
};

/** The "-optie" tags that stop meaning anything once the variant IS that diet. */
const OPTIE_TAGS_FOR: Readonly<Record<VariantDiet, readonly string[]>> = {
  glutenvrij: ['glutenvrij-optie'],
  vegetarisch: ['vega-optie'],
  vegan: ['vega-optie', 'vegan-optie'],
};

// --- which lines break a diet -----------------------------------------------------------------

/** True when the line's resolved ingredient contradicts the diet (diet.ts semantics: unsure is not a contradiction). */
export function lineBreaksDiet(line: Line, diet: VariantDiet, dict: Dictionary): boolean {
  if (line.kind === 'header') return false;
  return dietTags([line], dict)[diet] === false;
}

/**
 * The diets to offer "Maak … versie" for: a line contradicts the diet and the recipe is not tagged
 * with it by hand. A recipe that is already (probably) vegetarian gets no vegetarian button.
 */
export function variantDietsFor(recipe: Pick<Recipe, 'tags'>, lines: readonly Line[], dict: Dictionary): VariantDiet[] {
  const facts = dietTags(lines, dict);
  const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
  return VARIANT_DIETS.filter((diet) => facts[diet] === false && !tags.includes(diet));
}

// --- name replacement in the raw text ----------------------------------------------------------

/** Lower-case, diacritics folded, SAME length as the input (so indexes map back); null when folding changes the length. */
function foldKeepLength(s: string): string {
  const folded = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return folded.length === s.length ? folded : s.toLowerCase();
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}

interface NameForm {
  text: string;
  plural: boolean;
}

/** Whether a written form of `from` is its plural (its `many`, or a form the dictionary's plural rules reduce to `one`). */
function isPluralForm(text: string, from: Ingredient, lang: Lang): boolean {
  const own = from[lang];
  if (!own?.one) return false;
  const key = normalizeKey(text);
  const one = normalizeKey(own.one);
  if (key === one) return false;
  if (own.many && key === normalizeKey(own.many)) return true;
  const base = lang === 'nl' ? dutchBaseForms(key) : englishBaseForms(key);
  // Diminutives reduce to the base too ("uitje" -> "ui"); only a plural ending counts.
  return base.includes(one) && (lang === 'nl' ? /(?:en|s|'s)$/.test(key) : /s$/.test(key));
}

/** "plakken ontbijtspek", "slices of bacon": an alias that starts with a unit word is unit + name, not a name. */
function startsWithUnit(alias: string, dict: Dictionary, lang: Lang): boolean {
  const first = alias.trim().split(/\s+/)[0] ?? '';
  return first !== '' && dict.unitByAlias(first, lang) !== undefined;
}

/**
 * Every way the old ingredient may be written in this language, longest first. Aliases that carry
 * a unit word ("klontje boter", "sneetje brood") are skipped: matching them would swallow the unit
 * and the raw would say "1 glutenvrij brood" where the structure still says 1 snee.
 */
function nameForms(from: Ingredient, lang: Lang, lineName: string | undefined, dict: Dictionary): NameForm[] {
  const out: NameForm[] = [];
  const seen = new Set<string>();
  const add = (text: string | undefined, plural: boolean) => {
    const t = (text ?? '').trim();
    const key = normalizeKey(t);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ text: t, plural });
  };
  const own = from[lang];
  add(own?.one, false);
  add(own?.many, true);
  for (const a of from.aliases?.[lang] ?? []) if (!startsWithUnit(a, dict, lang)) add(a, isPluralForm(a, from, lang));
  // The name part as the parser saw it ("uien", "sjalotjes"): a heuristic plural, not an exact form.
  if (lineName) add(lineName, isPluralForm(lineName, from, lang));
  return out.sort((a, b) => b.text.length - a.text.length);
}

interface NameHit {
  start: number;
  end: number;
  plural: boolean;
}

/** Whole-word, case- and diacritic-insensitive position of the old name in the raw text. */
function findName(raw: string, from: Ingredient, lang: Lang, lineName: string | undefined, dict: Dictionary): NameHit | null {
  const hay = foldKeepLength(raw);
  for (const form of nameForms(from, lang, lineName, dict)) {
    const needle = foldKeepLength(form.text);
    if (!needle) continue;
    let idx = hay.indexOf(needle);
    while (idx !== -1) {
      const end = idx + needle.length;
      if (!isWordChar(hay[idx - 1]) && !isWordChar(hay[end])) return { start: idx, end, plural: form.plural };
      idx = hay.indexOf(needle, idx + 1);
    }
  }
  return null;
}

/** The replacement's name in a language (plural when the old form was plural and a plural exists). */
function toName(to: Ingredient, lang: Lang, plural: boolean): string {
  const own = to[lang]?.one ? to[lang] : to[lang === 'nl' ? 'en' : 'nl'];
  if (!own?.one) return to.id;
  return plural && own.many ? own.many : own.one;
}

/** "(of kabeljauw)" / "(or cod)" after a swap: the alternative was for the OLD product. */
const ALT_PAREN_RE = /\s*\((?:of|or)\s[^()]*\)/iu;
/** "(400 g)", "(ca. 150 g)": a pack size of the OLD product, moot once the line is in grams. */
const PACK_PAREN_RE = /\s*\(\s*(?:ca\.?\s*)?\d[\d.,]*\s*(?:g|gr|gram|kg|ml|cl|dl|l)\s*\)/iu;
/** A number as written in a line ("4", "1,5", "1/2", "1½", "½"), optionally a range ("2-3"). */
const NUM_SRC = '(?:\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?(?:\\s?[½¼¾⅓⅔⅛])?|[½¼¾⅓⅔⅛])';
const QTY_RE = new RegExp(`${NUM_SRC}(?:\\s*[-–]\\s*${NUM_SRC})?`, 'u');
/** Qualifiers that describe the OLD product's make-up and mean nothing on the replacement ("half-om-half gehakt" -> "vegagehakt"). */
const DROPPED_QUALS: ReadonlySet<string> = new Set(['half-om-half']);

/** A qualifier from DROPPED_QUALS written right before the name: the hit grows to cover it. */
function coverDroppedQual(text: string, hit: NameHit, line: Line, lang: Lang, dict: Dictionary): NameHit {
  const ids = (line.qual ?? []).filter((q) => DROPPED_QUALS.has(q));
  if (!ids.length) return hit;
  const forms = ids.flatMap((id) => {
    const q = dict.qualifiers.find((x) => x.id === id);
    return q ? (lang === 'nl' ? q.nl : [q.en]) : [];
  });
  const before = foldKeepLength(text.slice(0, hit.start)).replace(/\s+$/, '');
  for (const form of forms.sort((a, b) => b.length - a.length)) {
    const needle = foldKeepLength(form);
    const start = before.length - needle.length;
    if (start >= 0 && before.endsWith(needle) && !isWordChar(before[start - 1])) return { ...hit, start };
  }
  return hit;
}

/** True when the product is bought by weight only: a mass default unit and no weight per piece ("tofu", not "gehaktbal"). */
function soldByWeight(ing: Ingredient, dict: Dictionary): boolean {
  const unit = ing.defaultUnit ? dict.unit(ing.defaultUnit) : undefined;
  return unit?.group === 'mass' && !ing.gramsPer?.stuk;
}

/** True when the product is counted in pieces: a count default unit ("stuk", "bol") or a known weight per piece ("kipfilet"). */
function countedProduct(ing: Ingredient, dict: Dictionary): boolean {
  if (ing.gramsPer?.stuk) return true;
  const unit = ing.defaultUnit ? dict.unit(ing.defaultUnit) : undefined;
  return unit?.group === 'count';
}

/** Grams of one piece of the old product: `gramsPer.stuk`, else the weight of its count unit ("1 mozzarella" = 1 bol). */
function gramsPerPiece(ing: Ingredient, dict: Dictionary): number | undefined {
  const byUnit = ing.defaultUnit && dict.unit(ing.defaultUnit)?.group === 'count' ? ing.gramsPer?.[ing.defaultUnit] : undefined;
  const g = ing.gramsPer?.stuk ?? byUnit;
  return typeof g === 'number' && g > 0 ? g : undefined;
}

function gramsQty(q: Qty, perPiece: number): Qty {
  const out: Qty = { min: Math.round(q.min * perPiece) };
  if (q.max !== undefined) out.max = Math.round(q.max * perPiece);
  if (q.approx) out.approx = true;
  return out;
}

function gramsText(q: Qty): string {
  return q.max !== undefined && q.max !== q.min ? `${q.min}-${q.max} g` : `${q.min} g`;
}

/**
 * The raw text with the name replaced (and, for a count turned into grams, the number before it
 * replaced by "<n> g"). Null when the number cannot be found in front of the name.
 */
function replaceInRaw(raw: string, hit: NameHit, replacement: string, opts: { stripAlt: boolean; grams?: Qty; lang: Lang; dict: Dictionary }): string | null {
  let name = replacement;
  // "Kipfilet, 300 g" -> "Vega kipstukjes, 300 g": keep a capital at the start of the line.
  const first = raw.charAt(hit.start);
  if (hit.start === 0 && first !== first.toLowerCase() && name.charAt(0) === name.charAt(0).toLowerCase()) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  let out = raw.slice(0, hit.start) + name + raw.slice(hit.end);
  if (opts.grams) {
    const m = QTY_RE.exec(out);
    if (!m || m.index >= hit.start) return null;
    // "2 stuks kipfilet": a written piece unit goes with the number.
    let end = m.index + m[0].length;
    const unitWord = /^\s+(\S+)/u.exec(out.slice(end));
    if (unitWord && opts.dict.unitByAlias(unitWord[1] as string, opts.lang)?.id === 'stuk') end += unitWord[0].length;
    out = out.slice(0, m.index) + gramsText(opts.grams) + out.slice(end);
    out = out.replace(PACK_PAREN_RE, '');
  }
  if (opts.stripAlt) out = out.replace(ALT_PAREN_RE, '');
  return out.replace(/\s{2,}/g, ' ').trim();
}

interface RawSwap {
  raw: Text;
  name?: string;
  grams?: Qty;
  applies: boolean;
}

/**
 * The new raw text of a line with `from` replaced by `to`, per language. The language the parser
 * reads (nl when present, else en) decides `applies`; the other language is replaced when its text
 * contains the old name and left out otherwise. A counted line ("4 kipfilets", unit null or 'stuk')
 * of a counted product whose replacement is sold by weight becomes grams via the old product's
 * weight per piece; without that weight, or when the line's "of …" alternative is not in
 * parentheses (it would stay in the raw while the structure drops it), the line is not rewritten
 * (`applies: false`). A count of a weight product ("2 gehakt") is the line's own oddity and is
 * replaced by name as before.
 */
function swapRaw(line: Line, from: Ingredient, to: Ingredient, dict: Dictionary): RawSwap {
  const primary: Lang = hasLang(line.raw, 'nl') ? 'nl' : 'en';
  const stripAlt = Array.isArray(line.alt) && line.alt.length > 0;
  const keep: RawSwap = { raw: { ...line.raw }, applies: false };
  let grams: Qty | undefined;
  if (line.qty && (!line.unit || line.unit === 'stuk') && countedProduct(from, dict) && soldByWeight(to, dict)) {
    const perPiece = gramsPerPiece(from, dict);
    if (!perPiece) return keep;
    grams = gramsQty(line.qty, perPiece);
  }
  const out: Text = {};
  let name: string | undefined;
  for (const lang of ['nl', 'en'] as const) {
    if (!hasLang(line.raw, lang)) continue;
    const text = line.raw[lang] as string;
    const found = findName(text, from, lang, lang === primary ? line.name : undefined, dict);
    const hit = found ? coverDroppedQual(text, found, line, lang, dict) : null;
    const replaced = hit && (!stripAlt || ALT_PAREN_RE.test(text)) ? replaceInRaw(text, hit, toName(to, lang, hit.plural), { stripAlt, lang, dict, ...(grams ? { grams } : {}) }) : null;
    if (replaced === null) {
      if (lang === primary) return keep;
      continue;
    }
    out[lang] = replaced;
    if (lang === primary && hit) name = toName(to, lang, hit.plural);
  }
  const result: RawSwap = { raw: out, applies: true };
  if (name !== undefined) result.name = name;
  if (grams) result.grams = grams;
  return result;
}

/**
 * The line with a swap applied: new raw, new `ing` and name, alternatives (for the old product) and
 * the dropped qualifiers gone; a count turned into grams gets the new quantity, `unit: 'g'` and no
 * pack size.
 */
export function applySwap(line: Line, swap: VariantSwap): Line {
  const out: Line = { ...line, raw: { ...swap.raw }, ing: swap.toId, confidence: 1 };
  if (swap.name !== undefined) out.name = swap.name;
  if (swap.grams) {
    out.qty = { ...swap.grams };
    out.unit = 'g';
    delete out.packSize;
  }
  if (Array.isArray(out.qual)) {
    const qual = out.qual.filter((q) => !DROPPED_QUALS.has(q));
    if (qual.length) out.qual = qual;
    else delete out.qual;
  }
  delete out.alt;
  delete out.altMode;
  return out;
}

// --- planning -----------------------------------------------------------------------------------

/**
 * The swaps for one diet over a recipe's lines. Pass the EFFECTIVE lines (line overrides folded
 * in) as `recipe.lines`; the plan keeps them so `makeVariant` copies exactly what was reviewed.
 */
export function planVariant(recipe: Pick<Recipe, 'lines'>, diet: VariantDiet, swaps: readonly Swap[], dict: Dictionary): VariantPlan {
  const lines = Array.isArray(recipe.lines) ? recipe.lines : [];
  const byFrom = new Map<string, Swap[]>();
  for (const s of swaps) {
    if (!s || typeof s.from !== 'string' || typeof s.to !== 'string' || !Array.isArray(s.diets) || !s.diets.includes(diet)) continue;
    const list = byFrom.get(s.from) ?? [];
    list.push(s);
    byFrom.set(s.from, list);
  }
  const plan: VariantPlan = { diet, lines: [...lines], swaps: [], unresolved: [] };
  lines.forEach((line, index) => {
    if (!lineBreaksDiet(line, diet, dict)) return;
    const from = line.ing ? dict.get(line.ing) : undefined;
    const swap = from ? (byFrom.get(from.id) ?? []).find((s) => !!dict.get(s.to)) : undefined;
    const to = swap ? dict.get(swap.to) : undefined;
    // A replacement that would still break the diet (a user dictionary without flags) is no replacement.
    if (!from || !swap || !to || lineBreaksDiet({ ...line, ing: to.id }, diet, dict)) {
      plan.unresolved.push(index);
      return;
    }
    const r = swapRaw(line, from, to, dict);
    const entry: VariantSwap = { index, fromId: from.id, toId: to.id, raw: r.raw, applies: r.applies };
    if (r.name !== undefined) entry.name = r.name;
    if (r.grams) entry.grams = r.grams;
    if (swap.note && (swap.note.nl || swap.note.en)) entry.note = { ...swap.note };
    plan.swaps.push(entry);
  });
  return plan;
}

// --- making the variant -------------------------------------------------------------------------

/** "<naam> (glutenvrij)" / "<name> (gluten-free)" for the languages the name has (invariant 3: never invent the other side). */
export function variantName(name: Text, diet: VariantDiet): Text {
  const out: Text = {};
  for (const lang of ['nl', 'en'] as const) {
    if (hasLang(name, lang)) out[lang] = `${(name[lang] as string).trim()} (${DIET_SUFFIX[diet][lang]})`;
  }
  return out;
}

/** The original's tags plus the diet tag(s), minus the "-optie" tags the variant makes moot. Order kept, new tags appended. */
export function variantTags(tags: readonly string[], diet: VariantDiet): string[] {
  const drop = new Set(OPTIE_TAGS_FOR[diet]);
  const out = tags.filter((t) => !drop.has(t));
  for (const t of DIET_TAGS_FOR[diet]) if (!out.includes(t)) out.push(t);
  return out;
}

function cloneLine(l: Line): Line {
  const out: Line = { ...l, raw: { ...l.raw } };
  if (Array.isArray(l.alt)) out.alt = l.alt.map(cloneLine);
  return out;
}

/** A cook's note as it fits between parentheses: no full stop at the end, no parentheses of its own. */
function parenNote(s: string | undefined): string {
  return (s ?? '')
    .trim()
    .replace(/\s*\(([^()]*)\)/g, ', $1')
    .replace(/\.$/, '')
    .trim();
}

/**
 * The swap's cook's note on the new line ("Sojaroom klopt niet op; …"): in the raw as "(…)" at the
 * end, so the editor shows it and a re-parse reads it back as a note (invariant 2), and in `note`
 * for the renderer, joined to a note the line already had.
 */
function withSwapNote(line: Line, note: Text): Line {
  const out: Line = { ...line, raw: { ...line.raw } };
  const merged: Text = { ...(line.note ?? {}) };
  for (const lang of ['nl', 'en'] as const) {
    const n = parenNote(note[lang]);
    if (!n) continue;
    merged[lang] = merged[lang] ? `${merged[lang]}; ${n}` : n;
    if (hasLang(out.raw, lang)) out.raw[lang] = `${(out.raw[lang] as string).trim()} (${n})`;
  }
  if (merged.nl || merged.en) out.note = merged;
  return out;
}

/**
 * The variant as a new own recipe: the swaps with `applies: true` applied to the plan's lines (each
 * with its cook's note), the rest copied as they are. The original is never touched (ids never
 * change, invariant 1).
 */
export function makeVariant(recipe: Recipe, plan: VariantPlan, diet: VariantDiet, opts: MakeVariantOptions = {}): Recipe {
  const now = opts.now ?? nowIso();
  const applied = new Map<number, VariantSwap>();
  for (const s of plan.swaps) if (s.applies) applied.set(s.index, s);
  const lines = plan.lines.map((l, i) => {
    const s = applied.get(i);
    if (!s) return cloneLine(l);
    const swapped = applySwap(l, s);
    return s.note ? withSwapNote(swapped, s.note) : swapped;
  });
  const out: Recipe = {
    ...recipe,
    schema: 2,
    id: opts.id ?? newUserId(),
    rev: 1,
    createdAt: now,
    updatedAt: now,
    origin: { kind: 'user', author: opts.author ?? null },
    variantOf: recipe.id,
    name: variantName(recipe.name, diet),
    tags: variantTags(recipe.tags, diet),
    // The diet label is the person's own choice (phase-5 A.4 `metaManual`): the check screen's
    // "Alles overnemen" and the editor's suggestion leave it alone, even while a "controleer zelf"
    // line still contradicts it.
    metaManual: true,
    lines,
    steps: recipe.steps.map((s) => ({ ...s, text: { ...s.text }, ...(s.timers ? { timers: s.timers.map((t) => ({ ...t })) } : {}) })),
    goesWith: [...recipe.goesWith],
    // Aliases are other names of the ORIGINAL; a search for them should find the original.
    aliases: [],
  };
  // A builtin read through getRecipe() carries the applied-override marker and a received recipe
  // its receiver-side `sync`; the variant is a plain own recipe. `text.en: 'llm'` is the curator
  // marker of a CLASSIC (the "Machine translation" badge opens the curator for that builtin); an own
  // recipe has no curator path, so the marker would stick forever.
  delete (out as Record<string, unknown>).override;
  delete (out as Record<string, unknown>).sync;
  delete (out as Record<string, unknown>).text;
  return out;
}
