// The bilingual dictionary (docs/phase-2-spec.md §1 data files, §3 `dictionary.ts`). Framework-free.
//
// `loadDictionary(data)` builds lookup indexes over the JSON vocab files (units, qualifiers,
// prep-phrases, ingredients, aisles, categories); the result is memoised per data object.
// Lookups are diacritic- and case-insensitive and understand Dutch plurals/diminutives and
// English plurals heuristically, so "sjalotjes" finds `sjalot` even without an alias.
// `withUserEntries(dict, entries)` layers user-created ingredients on top (builtins always win).
import type { Lang, Text } from './model.ts';
import { foldDiacritics } from './recipe-source.ts';

export type UnitGroup = 'mass' | 'volume' | 'count' | 'package' | 'pinch' | 'length';

export interface Unit {
  id: string;
  group: UnitGroup;
  /** Grams per unit (mass units). */
  g?: number;
  /** Millilitres per unit (volume units). */
  ml?: number;
  nl: { one: string; many?: string; long?: string };
  /** `render`/`scale`: show this unit as another one in English ("dl" -> "ml" × 100). */
  en: { one: string; many?: string; long?: string; render?: string; scale?: number };
  aliases?: { nl?: string[]; en?: string[] };
}

export type QualifierKind = 'colour' | 'size' | 'state' | 'variety' | 'fat' | 'other';

export interface Qualifier {
  id: string;
  /** Dutch forms, the first one is used for rendering ("rode", "rood"). */
  nl: string[];
  en: string;
  kind: QualifierKind;
  /** true = a different shopping item (rode ui ≠ ui); false = a note (grote, verse). */
  variant: boolean;
}

/**
 * `{n}` in `nl`/`en` is a number template: "blokjes van {n} cm" -> "{n} cm dice". `enSliced` is
 * the English for ingredients that are sliced rather than chopped (`Ingredient.cut === 'slice'`):
 * "fijngesneden" -> "finely chopped" for herbs, garlic and ginger, "finely sliced" for onion and leek.
 */
export interface PrepPhrase {
  nl: string;
  en: string;
  enSliced?: string;
}

export interface Ingredient {
  id: string;
  nl: { one: string; many?: string };
  en: { one: string; many?: string };
  aliases?: { nl?: string[]; en?: string[] };
  aisle: string;
  /** 'stuk' = counted pieces, a units.json id, or null (no natural unit: "zout en peper"). */
  defaultUnit: string | null;
  buyUnit?: string;
  gramsPer?: Record<string, number>;
  staple: boolean;
  veg: boolean;
  perishable?: boolean;
  gloss?: { en: string };
  /** 'slice' = "fijngesneden" means finely sliced (onion, leek, chicken); default = finely chopped. */
  cut?: 'slice' | 'chop';
  /** How a unit of this ingredient is called: foelie { stuk: { en: { one: 'blade' } } } -> "1 blade mace". */
  unitNames?: Record<string, { nl?: { one: string; many?: string }; en?: { one: string; many?: string } }>;
  [k: string]: unknown;
}

export interface Aisle {
  id: string;
  nl: string;
  en: string;
  order: number;
}

export interface Category {
  id: string;
  nl: string;
  en: string;
  order: number;
}

export interface DictionaryData {
  units: Unit[];
  qualifiers: Qualifier[];
  prepPhrases: PrepPhrase[];
  ingredients: Ingredient[];
  aisles: Aisle[];
  categories: Category[];
}

/** One search hit: the ingredient plus a rank (lower = better) for sorting. */
export interface IngredientMatch {
  ingredient: Ingredient;
  /** 0 exact, 1 prefix, 2 word prefix, 3 substring; +4 when matched in the other language. */
  rank: number;
}

const VULGAR_ASCII: Record<string, string> = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8' };

/**
 * Lookup key: diacritics folded, lowercased, whitespace collapsed, curly quotes and a trailing '.'
 * removed. Vulgar fractions become ASCII ("1½" -> "1 1/2") because NFKD would otherwise turn them
 * into "1⁄2" with a fraction slash.
 */
export function normalizeKey(text: string): string {
  const ascii = text.replace(/(\d)([½¼¾⅓⅔⅛])/g, '$1 $2').replace(/[½¼¾⅓⅔⅛]/g, (c) => VULGAR_ASCII[c] ?? c);
  return foldDiacritics(ascii)
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '');
}

/** "1 1/2" -> "1½", "1/2" -> "½", "2-3" unchanged: numbers in a translated prep note. */
function prettyNumber(n: string): string {
  const glyph: Record<string, string> = { '1/2': '½', '1/4': '¼', '3/4': '¾', '1/3': '⅓', '2/3': '⅔', '1/8': '⅛' };
  return n
    .replace(/(\d+) (\d\/\d)/g, (_m, whole: string, frac: string) => whole + (glyph[frac] ?? ` ${frac}`))
    .replace(/(^|[^\d])(\d\/\d)/g, (_m, pre: string, frac: string) => pre + (glyph[frac] ?? frac));
}

function otherLang(lang: Lang): Lang {
  return lang === 'nl' ? 'en' : 'nl';
}

/**
 * Candidate base forms of a Dutch noun: plural -> singular ("uien" -> "ui", "tomaten" -> "tomaat",
 * "olijven" -> "olijf", "sjalotten" -> "sjalot"), diminutive -> base ("sjalotjes" -> "sjalot",
 * "uitjes" -> "ui", "pepertje" -> "peper"). The caller tries each candidate against the index.
 */
export function dutchBaseForms(key: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    if (s.length >= 2) out.add(s);
  };
  const singularFromEn = (stem: string): void => {
    add(stem);
    // "olijv" -> "olijf", "kaz" -> "kaas"
    let s = stem.replace(/v$/, 'f').replace(/z$/, 's');
    add(s);
    // "sjalott" -> "sjalot"
    const dbl = /([bcdfgklmnprst])\1$/.exec(s);
    if (dbl) add(s.slice(0, -1));
    // "tomat" -> "tomaat", "bon" -> "boon" (single vowel between consonants at the end)
    const m = /^(.*[^aeiou])([aeou])([bcdfgklmnprst])$/.exec(s);
    if (m) add(`${m[1]}${m[2]}${m[2]}${m[3]}`);
  };
  // possessive/apostrophe plural: "avocado's"
  if (/'s$/.test(key)) add(key.slice(0, -2));
  // diminutive plurals and singulars (longest suffix first)
  for (const suf of ['etjes', 'pjes', 'tjes', 'jes', 'etje', 'pje', 'tje', 'je']) {
    if (key.endsWith(suf) && key.length > suf.length + 1) {
      const stem = key.slice(0, -suf.length);
      add(stem);
      if (suf === 'pjes' || suf === 'pje') add(stem + 'm'); // "boompje" -> "boom"
      // "kerstomaatjes" -> "kerstomaat" is direct; "pannetje" -> "pan" (double consonant)
      const dbl = /([bcdfgklmnprst])\1$/.exec(stem);
      if (dbl) add(stem.slice(0, -1));
    }
  }
  // regular plurals
  if (key.endsWith('en') && key.length > 3) singularFromEn(key.slice(0, -2));
  if (key.endsWith('s') && key.length > 3) add(key.slice(0, -1));
  // "eieren" -> "ei"
  if (key.endsWith('eren') && key.length > 5) add(key.slice(0, -4));
  return [...out];
}

/** Candidate base forms of an English noun: "onions" -> "onion", "tomatoes" -> "tomato", "berries" -> "berry". */
export function englishBaseForms(key: string): string[] {
  const out = new Set<string>();
  if (key.endsWith('ies') && key.length > 4) out.add(key.slice(0, -3) + 'y');
  if (key.endsWith('oes') && key.length > 4) out.add(key.slice(0, -2));
  if (key.endsWith('es') && key.length > 3) out.add(key.slice(0, -2));
  if (key.endsWith('s') && key.length > 3) out.add(key.slice(0, -1));
  if (key.endsWith('ves') && key.length > 4) out.add(key.slice(0, -3) + 'f');
  return [...out];
}

interface PrepTemplate {
  re: RegExp;
  en: string;
  nl: string;
}

/** Numbers as they appear in normalised prep notes: "2", "2-3", "1 1/2" (was "1½"), "1/2", "1,5". */
const TEMPLATE_NUMBER = String.raw`((?:\d+\s\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)(?:\s?[-–]\s?(?:\d+\s\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?))?)`;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function templateRe(nl: string): RegExp {
  const parts = normalizeKey(nl).split('{n}').map(escapeRe);
  return new RegExp('^' + parts.join(TEMPLATE_NUMBER) + '$');
}

export class Dictionary {
  readonly units: readonly Unit[];
  readonly qualifiers: readonly Qualifier[];
  readonly prepPhrases: readonly PrepPhrase[];
  readonly ingredients: readonly Ingredient[];
  readonly aisles: readonly Aisle[];
  readonly categories: readonly Category[];

  private readonly ingById = new Map<string, Ingredient>();
  private readonly ingByName: Record<Lang, Map<string, Ingredient>> = { nl: new Map(), en: new Map() };
  private readonly unitById = new Map<string, Unit>();
  private readonly unitByKey: Record<Lang, Map<string, Unit>> = { nl: new Map(), en: new Map() };
  private readonly unitAliasList: Record<Lang, string[]> = { nl: [], en: [] };
  private readonly qualById = new Map<string, Qualifier>();
  private readonly qualByWord: Record<Lang, Map<string, Qualifier>> = { nl: new Map(), en: new Map() };
  private readonly prepExact = new Map<string, PrepPhrase>();
  private readonly prepExactEn = new Map<string, PrepPhrase>();
  private readonly prepTemplates: PrepTemplate[] = [];
  private readonly aisleById = new Map<string, Aisle>();
  private readonly categoryById = new Map<string, Category>();

  constructor(data: DictionaryData) {
    this.units = [...data.units];
    this.qualifiers = [...data.qualifiers];
    this.prepPhrases = [...data.prepPhrases];
    this.ingredients = [...data.ingredients];
    this.aisles = [...data.aisles].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    this.categories = [...data.categories].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

    for (const u of this.units) {
      this.unitById.set(u.id, u);
      const nlKeys = [u.id, u.nl.one, u.nl.many, u.nl.long, ...(u.aliases?.nl ?? [])];
      const enKeys = [u.en.one, u.en.many, u.en.long, ...(u.aliases?.en ?? [])];
      for (const k of nlKeys) if (k) this.setFirst(this.unitByKey.nl, normalizeKey(k), u);
      for (const k of enKeys) if (k) this.setFirst(this.unitByKey.en, normalizeKey(k), u);
    }
    for (const lang of ['nl', 'en'] as const) {
      this.unitAliasList[lang] = [...this.unitByKey[lang].keys()].sort((a, b) => b.length - a.length || a.localeCompare(b));
    }

    for (const q of this.qualifiers) {
      this.qualById.set(q.id, q);
      for (const w of q.nl) this.setFirst(this.qualByWord.nl, normalizeKey(w), q);
      this.setFirst(this.qualByWord.en, normalizeKey(q.en), q);
    }

    for (const p of this.prepPhrases) {
      if (p.nl.includes('{n}')) {
        this.prepTemplates.push({ re: templateRe(p.nl), en: p.en, nl: p.nl });
      } else {
        this.setFirst(this.prepExact, normalizeKey(p.nl), p);
        // English -> Dutch: an unambiguous phrase ("fijngehakt") wins over one whose English
        // depends on the ingredient ("fijngesneden": chopped or sliced), which is indexed after.
        if (!p.enSliced) this.setFirst(this.prepExactEn, normalizeKey(p.en), p);
      }
    }
    for (const p of this.prepPhrases) {
      if (p.nl.includes('{n}') || !p.enSliced) continue;
      this.setFirst(this.prepExactEn, normalizeKey(p.en), p);
      this.setFirst(this.prepExactEn, normalizeKey(p.enSliced), p);
    }

    for (const ing of this.ingredients) this.indexIngredient(ing);
    for (const a of this.aisles) this.aisleById.set(a.id, a);
    for (const c of this.categories) this.categoryById.set(c.id, c);
  }

  private setFirst<T>(map: Map<string, T>, key: string, value: T): void {
    if (key && !map.has(key)) map.set(key, value);
  }

  private indexIngredient(ing: Ingredient): void {
    this.ingById.set(ing.id, ing);
    const nlKeys = [ing.nl.one, ing.nl.many, ...(ing.aliases?.nl ?? [])];
    const enKeys = [ing.en.one, ing.en.many, ...(ing.aliases?.en ?? [])];
    for (const k of nlKeys) if (k) this.setFirst(this.ingByName.nl, normalizeKey(k), ing);
    for (const k of enKeys) if (k) this.setFirst(this.ingByName.en, normalizeKey(k), ing);
    // The id itself as a last-resort Dutch key ("zout-en-peper" typed with dashes).
    this.setFirst(this.ingByName.nl, ing.id, ing);
  }

  // --- ids ------------------------------------------------------------------------------------

  /** Ingredient by id. */
  get(id: string): Ingredient | undefined {
    return this.ingById.get(id);
  }

  unit(id: string): Unit | undefined {
    return this.unitById.get(id);
  }

  qualifier(id: string): Qualifier | undefined {
    return this.qualById.get(id);
  }

  aisle(id: string): Aisle | undefined {
    return this.aisleById.get(id);
  }

  category(id: string): Category | undefined {
    return this.categoryById.get(id);
  }

  // --- names ----------------------------------------------------------------------------------

  /**
   * Ingredient for a name as written ("rode uien", "Tomaten", "onions"): exact key in `lang`, then
   * singular/base forms, then the same in the other language. Undefined when nothing matches.
   */
  ingredientByName(text: string, lang: Lang): Ingredient | undefined {
    const key = normalizeKey(text);
    if (!key) return undefined;
    for (const l of [lang, otherLang(lang)]) {
      const direct = this.ingByName[l].get(key);
      if (direct) return direct;
      const forms = l === 'nl' ? dutchBaseForms(key) : englishBaseForms(key);
      for (const f of forms) {
        const hit = this.ingByName[l].get(f);
        if (hit) return hit;
      }
    }
    // Multi-word names: singularise the last word only ("rode uien" -> "rode ui").
    const words = key.split(' ');
    if (words.length > 1) {
      const last = words[words.length - 1] as string;
      const head = words.slice(0, -1).join(' ');
      const forms = lang === 'nl' ? dutchBaseForms(last) : englishBaseForms(last);
      for (const f of forms) {
        const hit = this.ingByName[lang].get(`${head} ${f}`);
        if (hit) return hit;
      }
    }
    return undefined;
  }

  /** Unit for an alias as written ("el", "eetlepels", "tbsp", "Blikje"). */
  unitByAlias(text: string, lang: Lang): Unit | undefined {
    const key = normalizeKey(text);
    if (!key) return undefined;
    return this.unitByKey[lang].get(key) ?? this.unitByKey[otherLang(lang)].get(key);
  }

  /** All unit aliases of a language, normalised, longest first (for the parser's longest match). */
  unitAliases(lang: Lang): readonly string[] {
    return this.unitAliasList[lang];
  }

  /** Qualifier for one word as written ("rode", "Grote", "red"). */
  qualifierByWord(word: string, lang: Lang): Qualifier | undefined {
    const key = normalizeKey(word);
    if (!key) return undefined;
    return this.qualByWord[lang].get(key);
  }

  /**
   * Translation of a Dutch prep note ("fijngehakt" -> {nl, en: "finely chopped"}). Exact phrases
   * first, then `{n}` templates ("blokjes van 2 cm" -> "2 cm dice"), then compositions: a leading
   * count ("3 fijngesneden"), and parts split on ';', ',' and ' en '. `en` is left out when the
   * note (or one of its parts) is unknown, so the UI can fall back to the Dutch text.
   */
  prepFor(nl: string, opts?: { slice?: boolean }): Text {
    const text = nl.replace(/\s+/g, ' ').trim();
    if (!text) return {};
    const en = this.translatePrep(normalizeKey(text), 0, opts?.slice === true);
    return en === undefined ? { nl: text } : { nl: text, en };
  }

  /** Reverse of `prepFor` for English input: "finely chopped" -> {en, nl: "fijngehakt"} when known. */
  prepFromEn(en: string): Text {
    const text = en.replace(/\s+/g, ' ').trim();
    if (!text) return {};
    const hit = this.prepExactEn.get(normalizeKey(text));
    return hit ? { nl: hit.nl, en: text } : { en: text };
  }

  private translatePrep(key: string, depth: number, slice: boolean): string | undefined {
    if (!key) return undefined;
    const exact = this.prepExact.get(key);
    if (exact) return slice && exact.enSliced ? exact.enSliced : exact.en;
    for (const t of this.prepTemplates) {
      const m = t.re.exec(key);
      if (m) {
        let out = t.en;
        for (let i = 1; i < m.length; i++) {
          const n = prettyNumber((m[i] as string).replace(',', '.').replace(/\s?[-–]\s?/, '-'));
          out = out.replace('{n}', n);
        }
        return out;
      }
    }
    if (depth > 2) return undefined;
    // "3 fijngesneden" -> "3 finely sliced"
    const lead = /^(\d+)\s+(.+)$/.exec(key);
    if (lead) {
      const rest = this.translatePrep(lead[2] as string, depth + 1, slice);
      return rest === undefined ? undefined : `${lead[1]} ${rest}`;
    }
    for (const [sep, joiner] of [
      [';', '; '],
      [',', ', '],
      [' en ', ' and '],
    ] as const) {
      if (!key.includes(sep)) continue;
      const parts = key.split(sep).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const translated = parts.map((p) => this.translatePrep(p, depth + 1, slice));
      if (translated.every((t) => t !== undefined)) return translated.join(joiner);
    }
    return undefined;
  }

  // --- search ---------------------------------------------------------------------------------

  /**
   * Ingredients matching a query in either language, best first: exact name, then prefix, then a
   * word starting with the query, then substring; hits in `lang` before hits in the other one.
   * Diacritic-insensitive; singular, plural and aliases all count.
   */
  search(query: string, lang: Lang): Ingredient[] {
    return this.searchRanked(query, lang).map((m) => m.ingredient);
  }

  searchRanked(query: string, lang: Lang): IngredientMatch[] {
    const q = normalizeKey(query);
    if (!q) return [];
    const best = new Map<string, IngredientMatch>();
    const consider = (ing: Ingredient, name: string, penalty: number): void => {
      const k = normalizeKey(name);
      if (!k) return;
      let rank: number;
      if (k === q) rank = 0;
      else if (k.startsWith(q)) rank = 1;
      else if (k.includes(' ' + q) || k.includes('-' + q)) rank = 2;
      else if (k.includes(q)) rank = 3;
      else return;
      rank += penalty;
      const prev = best.get(ing.id);
      if (!prev || rank < prev.rank) best.set(ing.id, { ingredient: ing, rank });
    };
    for (const ing of this.ingredients) {
      for (const l of ['nl', 'en'] as const) {
        const penalty = l === lang ? 0 : 4;
        consider(ing, ing[l].one, penalty);
        if (ing[l].many) consider(ing, ing[l].many as string, penalty);
        for (const a of ing.aliases?.[l] ?? []) consider(ing, a, penalty);
      }
      consider(ing, ing.id.replace(/-/g, ' '), 4);
    }
    return [...best.values()].sort(
      (a, b) => a.rank - b.rank || a.ingredient[lang].one.localeCompare(b.ingredient[lang].one),
    );
  }

  // --- rendering helpers ----------------------------------------------------------------------

  /** Name of an ingredient in a language (plural when asked and known), falling back to the other language, then the id. */
  ingredientName(id: string, lang: Lang, plural = false): string {
    const ing = this.ingById.get(id);
    if (!ing) return id;
    const own = ing[lang];
    const other = ing[otherLang(lang)];
    const pick = (n: { one: string; many?: string }): string => (plural && n.many ? n.many : n.one);
    if (own?.one) return pick(own);
    if (other?.one) return pick(other);
    return id;
  }

  /** Rendered qualifier ("rode" / "red"), falling back to the id. */
  qualifierName(id: string, lang: Lang): string {
    const q = this.qualById.get(id);
    if (!q) return id;
    return lang === 'nl' ? (q.nl[0] ?? id) : q.en;
  }

  /** A copy of the data with extra ingredients merged in (used by withUserEntries). */
  toData(): DictionaryData {
    return {
      units: [...this.units],
      qualifiers: [...this.qualifiers],
      prepPhrases: [...this.prepPhrases],
      ingredients: [...this.ingredients],
      aisles: [...this.aisles],
      categories: [...this.categories],
    };
  }
}

const cache = new WeakMap<DictionaryData, Dictionary>();

/** Dictionary for a data object; memoised per object identity. */
export function loadDictionary(data: DictionaryData): Dictionary {
  let dict = cache.get(data);
  if (!dict) {
    dict = new Dictionary(data);
    cache.set(data, dict);
  }
  return dict;
}

/**
 * The dictionary plus user-created ingredients (table `userIngredients`; they travel in share
 * tokens later). A user entry never overrides a builtin with the same id (PLAN.md §7 merge rules).
 */
export function withUserEntries(dict: Dictionary, entries: readonly Ingredient[]): Dictionary {
  if (entries.length === 0) return dict;
  const data = dict.toData();
  const known = new Set(data.ingredients.map((i) => i.id));
  for (const e of entries) {
    if (!e || typeof e.id !== 'string' || known.has(e.id)) continue;
    known.add(e.id);
    data.ingredients.push(e);
  }
  return loadDictionary(data);
}
