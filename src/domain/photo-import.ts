// "Importeer van foto/tekst" (docs/phase-2-spec.md §5, decision §0 photo import; PLAN §0
// "Vertaling eigen recepten" part 2: the prompt asks for BOTH languages). Framework-free.
//
// No OCR and no LLM in the app: "Kopieer instructie-prompt" puts a prompt on the clipboard that
// asks an external AI (with the photo attached) to rewrite the recipe into the app's plain format;
// "Plak het resultaat" parses that format back into the editor fields:
//
//   # Naam                     (or "# Name")
//   Porties: 4                 (or "Servings: 4"; optional)
//   ## Ingrediënten            (or "## Ingredients")
//   400 g aardappelen          (one per line)
//   ## Bereiding               (or "## Method")
//   Kook de aardappelen …      (one step per paragraph)
//
// The default (bilingual) prompt asks for the recipe twice: a block after the line "=== NL ===" in
// Dutch and a block after "=== EN ===" in British English, with the same number of ingredient
// lines and steps. `parseBilingualPlain` reads that form, or a single block without markers.
//
// `parsePlainRecipe` is tolerant: headers with or without '#', bullets and numbers in front of
// ingredient lines, numbered steps, and a name without '#' when it is the first line.
//
// Phase 5 (docs/phase-5-spec.md A.5): optional "Categorie: pasta" / "Category: Pasta" and
// "Labels: vegetarisch, snel" / "Tags: vegetarian, quick" lines per block. Words are mapped to
// categories.json ids and the tag vocabulary through the synonyms tables below (ids, Dutch and
// English labels, tolerant of case and diacritics); unknown words are dropped.
import type { Lang } from './model.ts';

export interface PlainRecipe {
  name: string;
  /** Null when the text had no "Porties:" / "Servings:" line. */
  servings: number | null;
  lines: string[];
  steps: string[];
  /** A categories.json id from a "Categorie:" / "Category:" line; absent when none or unknown. */
  category?: string;
  /** Tag ids from a "Labels:" / "Tags:" line, unknown words dropped; absent when there was no such line. */
  tags?: string[];
}

// --- category and tag words ---------------------------------------------------------------------

/** categories.json ids with the words (nl, en, common variants) that mean them. The id itself always counts. */
const CATEGORY_WORDS: Record<string, string[]> = {
  soep: ['soep', 'soup', 'soepen', 'soups', 'maaltijdsoep'],
  salade: ['salade', 'salad', 'salades', 'salads', 'sla'],
  'hartige-taart': ['hartige taart', 'savoury pie', 'savory pie', 'taart', 'quiche', 'pie', 'tart', 'hartige taarten'],
  pasta: ['pasta', 'pastas', "pasta's", 'noodles pasta'],
  rijst: ['rijst', 'rice', 'risotto', 'couscous'],
  vlees: ['vlees', 'meat', 'vleesgerecht', 'meat dish', 'kip', 'chicken', 'poultry', 'gevogelte'],
  vis: ['vis', 'fish', 'visgerecht', 'fish dish', 'seafood', 'zeevruchten'],
  stamppot: ['stamppot', 'stamppot (dutch mash)', 'dutch mash', 'mash', 'stamp', 'stampot', 'hutspot'],
  oven: ['oven', 'ovenschotel', 'ovengerecht', 'oven dish', 'bake', 'casserole', 'gratin', 'uit de oven'],
  'wok-noedels': ['wok & noedels', 'wok & noodles', 'wok', 'noedels', 'noodles', 'wok en noedels', 'wok and noodles', 'wok-noedels', 'wok noedels', 'wok noodles', 'roerbak', 'stir-fry', 'stir fry'],
  overig: ['overig', 'other', 'overige', 'anders', 'misc', 'miscellaneous', 'diversen'],
};

/** The tag vocabulary (tools/validate-data.ts RECIPE_TAGS) with the words that mean each tag. */
const TAG_WORDS: Record<string, string[]> = {
  vegetarisch: ['vegetarisch', 'vegetarian', 'vega', 'veggie', 'vegetarisch gerecht'],
  'vega-optie': ['vega-optie', 'vega optie', 'veggie option', 'vegetarian option', 'vegetarische optie', 'vegetarisch mogelijk'],
  vegan: ['vegan', 'veganistisch', 'plantaardig', 'plant-based', 'plant based'],
  'vegan-optie': ['vegan-optie', 'vegan optie', 'vegan option', 'veganistische optie', 'vegan mogelijk'],
  glutenvrij: ['glutenvrij', 'gluten-free', 'gluten free', 'glutenfree', 'zonder gluten'],
  'glutenvrij-optie': ['glutenvrij-optie', 'glutenvrij optie', 'gluten-free option', 'gluten free option', 'glutenvrije optie', 'glutenvrij mogelijk'],
  snel: ['snel', 'quick', 'fast', 'snelle', 'easy', 'makkelijk', 'simpel', 'simple', '30 minuten', '30 minutes'],
  oven: ['oven', 'ovenschotel', 'baked', 'uit de oven', 'oven dish'],
  wok: ['wok', 'roerbak', 'stir-fry', 'stir fry', 'wokgerecht'],
  kids: ['kids', 'kinderen', 'kind', 'children', 'kindvriendelijk', 'kid-friendly', 'family', 'gezin'],
  wereld: ['wereld', 'world', 'wereldkeuken', 'world cuisine', 'international', 'internationaal', 'exotisch', 'exotic'],
  feest: ['feest', 'party', 'feestelijk', 'festive', 'celebration', 'special occasion', 'gasten', 'guests'],
  zomer: ['zomer', 'summer', 'zomers', 'summery', 'bbq', 'barbecue'],
  winter: ['winter', 'winters', 'wintry', 'herfst', 'autumn', 'fall', 'comfort food', 'stoof', 'stew'],
};

function foldWord(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[_*#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIndex(table: Record<string, string[]>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [id, words] of Object.entries(table)) {
    for (const w of [id, id.replace(/-/g, ' '), ...words]) {
      const key = foldWord(w);
      if (key && !index.has(key)) index.set(key, id);
    }
  }
  return index;
}

const CATEGORY_INDEX = buildIndex(CATEGORY_WORDS);
const TAG_INDEX = buildIndex(TAG_WORDS);

/** A categories.json id for a word as written ("Pasta", "savoury pie", "hartige-taart"); undefined when unknown. */
export function categoryIdFromWord(word: string): string | undefined {
  const key = foldWord(word);
  if (!key) return undefined;
  const direct = CATEGORY_INDEX.get(key);
  if (direct) return direct;
  // "Categorie: Pasta (vegetarisch)" or "pasta / oven": the first known word wins.
  for (const part of key.split(/[,;/()|]+/)) {
    const hit = CATEGORY_INDEX.get(part.trim());
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Tag ids for a comma-separated list of words ("vegetarisch, snel", "vegetarian; quick; oven");
 * unknown words are dropped, duplicates removed, order kept.
 */
export function tagIdsFromText(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,;/|·•]+|\s+(?:en|and)\s+/u)) {
    const key = foldWord(part);
    if (!key) continue;
    const id = TAG_INDEX.get(key);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** The category and tag vocabularies as the import prompt lists them (ids in data order). */
export const IMPORT_CATEGORY_IDS: readonly string[] = Object.keys(CATEGORY_WORDS);
export const IMPORT_TAG_IDS: readonly string[] = Object.keys(TAG_WORDS);

/** The format block of one language, as the prompt shows it. */
function formatBlock(lang: Lang): string[] {
  return lang === 'nl'
    ? [
        '# Naam van het gerecht',
        'Porties: 4',
        'Categorie: pasta',
        'Labels: vegetarisch, snel',
        '## Ingrediënten',
        'één ingrediënt per regel, hoeveelheid voorop (bv. "400 g aardappelen", "2 el olijfolie", "1 rode ui [gesnipperd]")',
        '## Bereiding',
        'één stap per alinea, gescheiden door een lege regel; geen nummering',
      ]
    : [
        '# Name of the dish',
        'Servings: 4',
        'Category: pasta',
        'Tags: vegetarian, quick',
        '## Ingredients',
        'one ingredient per line, quantity first (e.g. "400 g potatoes", "2 tbsp olive oil", "1 red onion [finely chopped]")',
        '## Method',
        'one step per paragraph, separated by a blank line; no numbering',
      ];
}

const CATEGORY_LIST = IMPORT_CATEGORY_IDS.join(', ');
const TAG_LIST = IMPORT_TAG_IDS.join(', ');

/** The meta rule: which words the "Categorie:" / "Labels:" lines may hold. */
const META_RULE: Record<Lang, string> = {
  nl: `"Categorie:" is één van: ${CATEGORY_LIST}; "Labels:" is een kommagescheiden keuze uit: ${TAG_LIST} (beide regels mogen weggelaten worden als je het niet weet).`,
  en: `"Category:" is one of: ${CATEGORY_LIST}; "Tags:" is a comma-separated choice from: ${TAG_LIST} (leave either line out when unsure).`,
};

const PROMPT: Record<Lang, string> = {
  nl: [
    'Schrijf het recept op deze foto (of in deze tekst) over in precies dit platte formaat, in het Nederlands. Verander geen hoeveelheden.',
    'Antwoord alleen met het recept, zonder inleiding of uitleg.',
    '',
    ...formatBlock('nl'),
    '',
    'Regels: hoeveelheden en eenheden exact overnemen (metrisch, °C); een kopje in de ingrediëntenlijst (zoals "Dressing:") wordt een regel die eindigt op ":"; bewerkingen zoals "fijngehakt" tussen [vierkante haken] achter het ingrediënt. ' +
      META_RULE.nl,
  ].join('\n'),
  en: [
    'Rewrite the recipe in this photo (or in this text) in exactly this plain format, in English. Do not change any quantities.',
    'Answer with the recipe only, no introduction or explanation.',
    '',
    ...formatBlock('en'),
    '',
    'Rules: copy quantities and units exactly (metric, °C); a heading inside the ingredient list (like "Dressing:") becomes a line ending in ":"; preparation notes such as "finely chopped" go in [square brackets] after the ingredient. ' +
      META_RULE.en,
  ].join('\n'),
};

/** Bilingual variant: the same format, returned twice, one block per language. */
const PROMPT_BILINGUAL: Record<Lang, string> = {
  nl: [
    'Schrijf het recept op deze foto (of in deze tekst) over in precies dit platte formaat, TWEE keer: eerst in het Nederlands na een regel "=== NL ===", daarna in Brits Engels na een regel "=== EN ===". Verander geen hoeveelheden.',
    'Antwoord alleen met de twee blokken, zonder inleiding of uitleg.',
    '',
    '=== NL ===',
    ...formatBlock('nl'),
    '',
    '=== EN ===',
    ...formatBlock('en'),
    '',
    'Regels: beide blokken hebben precies evenveel ingrediëntregels en evenveel stappen, in dezelfde volgorde (regel 3 in NL is de vertaling van regel 3 in EN); hoeveelheden, eenheden en temperaturen zijn in beide blokken identiek (metrisch, °C); "Porties:" / "Servings:" staat één keer in elk blok; een kopje in de ingrediëntenlijst (zoals "Dressing:") wordt een regel die eindigt op ":"; bewerkingen zoals "fijngehakt" tussen [vierkante haken] achter het ingrediënt. Engels: tbsp, tsp, tin, clove, courgette, aubergine, coriander. ' +
      META_RULE.nl,
  ].join('\n'),
  en: [
    'Rewrite the recipe in this photo (or in this text) in exactly this plain format, TWICE: first in Dutch after a line "=== NL ===", then in British English after a line "=== EN ===". Do not change any quantities.',
    'Answer with the two blocks only, no introduction or explanation.',
    '',
    '=== NL ===',
    ...formatBlock('nl'),
    '',
    '=== EN ===',
    ...formatBlock('en'),
    '',
    'Rules: both blocks have exactly the same number of ingredient lines and the same number of steps, in the same order (line 3 in NL is the translation of line 3 in EN); quantities, units and temperatures are identical in both blocks (metric, °C); "Porties:" / "Servings:" appears once in each block; a heading inside the ingredient list (like "Dressing:") becomes a line ending in ":"; preparation notes such as "finely chopped" go in [square brackets] after the ingredient. English: tbsp, tsp, tin, clove, courgette, aubergine, coriander. ' +
      META_RULE.en,
  ].join('\n'),
};

/**
 * The prompt for an external AI. `lang` is the language the instructions are written in (the
 * person reads them too). Bilingual by default: the recipe comes back as an NL and an EN block;
 * `{ bilingual: false }` asks for a single block in `lang`. Both forms ask for the optional
 * "Categorie:" / "Category:" and "Labels:" / "Tags:" lines (docs/phase-5-spec.md A.5).
 */
export function buildImportPrompt(lang: Lang, opts: { bilingual?: boolean } = {}): string {
  const bilingual = opts.bilingual ?? true;
  return (bilingual ? PROMPT_BILINGUAL : PROMPT)[lang] + '\n';
}

const NAME_RE = /^\s*#(?!#)\s*(.+?)\s*#*\s*$/u;
const INGREDIENTS_RE = /^\s*(?:#{1,3}\s*)?\**\s*(ingredi[eë]nten|ingredients?)\s*\**\s*:?\s*$/iu;
const METHOD_RE = /^\s*(?:#{1,3}\s*)?\**\s*(bereiding|bereidingswijze|werkwijze|method|instructions|directions|steps|preparation)\s*\**\s*:?\s*$/iu;
const SERVINGS_RE = /^\s*\**\s*(?:porties|personen|voor|servings?|serves|yield)\s*\**\s*:?\s*(\d{1,2})\b/iu;
const BULLET_RE = /^\s*(?:[-*•–]\s+|\d{1,3}\s*[.)]\s+)/u;
const KEY_VALUE_RE = /^\s*\**\s*(?:naam|name|titel|title)\s*\**\s*:\s*(.+)$/iu;
const CATEGORY_LINE_RE = /^\s*\**\s*(?:categorie|category|soort|type)\s*\**\s*:\s*\**\s*(.*?)\s*\**\s*$/iu;
const TAGS_LINE_RE = /^\s*\**\s*(?:labels?|tags?|dieet|diet|kenmerken)\s*\**\s*:\s*\**\s*(.*?)\s*\**\s*$/iu;

/**
 * The plain format back into name, servings, ingredient lines and steps (plus category and tags
 * when the text has those lines). Returns null when the text holds neither a name, nor
 * ingredients, nor steps.
 */
export function parsePlainRecipe(input: string): PlainRecipe | null {
  const raw = (input ?? '').replace(/\r\n?/g, '\n');
  let name = '';
  // A "# Name" line wins over a plain first line that was taken for the name (chatter before it).
  let nameExplicit = false;
  let servings: number | null = null;
  let category: string | undefined;
  let tags: string[] | undefined;
  const lines: string[] = [];
  const stepBlock: string[] = [];
  let section: 'none' | 'lines' | 'steps' = 'none';
  let sawContent = false;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (INGREDIENTS_RE.test(trimmed)) {
      section = 'lines';
      continue;
    }
    if (METHOD_RE.test(trimmed)) {
      section = 'steps';
      continue;
    }
    // "Categorie: pasta" / "Labels: vegetarisch, snel" anywhere outside the method (first one wins).
    if (section !== 'steps') {
      const cat = CATEGORY_LINE_RE.exec(trimmed);
      if (cat) {
        if (category === undefined) category = categoryIdFromWord(cat[1] as string);
        continue;
      }
      const tg = TAGS_LINE_RE.exec(trimmed);
      if (tg) {
        if (tags === undefined) tags = tagIdsFromText(tg[1] as string);
        continue;
      }
    }
    const nm = NAME_RE.exec(line);
    if (nm && !nameExplicit && section === 'none') {
      name = (nm[1] as string).trim();
      nameExplicit = true;
      continue;
    }
    const kv = KEY_VALUE_RE.exec(trimmed);
    if (kv && !nameExplicit && section === 'none') {
      name = (kv[1] as string).trim();
      nameExplicit = true;
      continue;
    }
    const sv = SERVINGS_RE.exec(trimmed);
    if (sv && servings === null && section !== 'steps') {
      servings = Number(sv[1]);
      continue;
    }
    if (section === 'lines') {
      if (!trimmed) continue;
      lines.push(trimmed.replace(BULLET_RE, '').trim());
      sawContent = true;
      continue;
    }
    if (section === 'steps') {
      stepBlock.push(line);
      if (trimmed) sawContent = true;
      continue;
    }
    // Before any section: the first non-empty line without '#' is the name.
    if (trimmed && !name) {
      name = trimmed.replace(/^\**|\**$/gu, '').trim();
    }
  }

  const steps = splitStepBlock(stepBlock);
  if (!name && !sawContent) return null;
  const out: PlainRecipe = { name, servings, lines: lines.filter(Boolean), steps };
  if (category !== undefined) out.category = category;
  if (tags !== undefined) out.tags = tags;
  return out;
}

/**
 * Steps from the method block: numbered lines are one step each; otherwise paragraphs separated
 * by blank lines; a single paragraph of several lines is one step per line.
 */
function splitStepBlock(block: string[]): string[] {
  const text = block.join('\n').trim();
  if (!text) return [];
  const rows = text.split('\n').map((l) => l.trim());
  const numbered = rows.filter(Boolean);
  if (numbered.length > 0 && numbered.every((l) => /^\d{1,3}\s*[.)]\s+/u.test(l) || /^[-*•]\s+/u.test(l))) {
    return numbered.map((l) => l.replace(BULLET_RE, '').trim()).filter(Boolean);
  }
  const paragraphs = text
    .split(/\n[ \t]*\n/)
    .map((p) => p.split('\n').map((l) => l.trim().replace(/^(?:\d{1,3}\s*[.)]|[-*•])\s+/u, '')).filter(Boolean).join(' '))
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  const single = rows.filter(Boolean).map((l) => l.replace(/^(?:\d{1,3}\s*[.)]|[-*•])\s+/u, '').trim());
  return single.filter(Boolean);
}

// --- bilingual form -------------------------------------------------------------------------------

export interface BilingualPlain {
  nl?: PlainRecipe;
  en?: PlainRecipe;
  /** Present when both blocks exist but their counts differ: [nl count, en count]. */
  mismatch?: { lines?: [number, number]; steps?: [number, number] };
  /** The language of the block that came first in the text (the one to trust on a mismatch). */
  first?: Lang;
}

/**
 * A block marker is a line that holds nothing but the language: "=== NL ===" as asked, or what an
 * assistant makes of it ("## NL", "**EN:**", "(NL)", "Nederlands:", "### English"). The two-letter
 * codes must be upper case ("en" alone is a Dutch word); the full names are matched case-insensitively.
 */
const MARKER_TRIM_RE = /^[\s*_#>=[(]+|[\s*_:=\])]+$/gu;

function markerLangOf(row: string): Lang | null {
  const core = row.replace(MARKER_TRIM_RE, '');
  if (core === 'NL') return 'nl';
  if (core === 'EN') return 'en';
  const lower = core.toLowerCase();
  if (lower === 'nederlands' || lower === 'dutch') return 'nl';
  if (lower === 'engels' || lower === 'english') return 'en';
  return null;
}
/** A markdown horizontal rule or a closing code fence ends a block (chatter after it is ignored). */
const BLOCK_END_RE = /^\s*(?:-{3,}|\*{3,}|_{3,}|`{3,}\w*)\s*$/u;
/** Headers that betray the language of a single block without markers. */
const EN_HEADER_RE = /^\s*(?:#{1,3}\s*)?\**\s*(ingredients?|method|instructions|directions|servings?|serves)\s*\**\s*:?/imu;
const NL_HEADER_RE = /^\s*(?:#{1,3}\s*)?\**\s*(ingredi[eë]nten|bereiding|bereidingswijze|werkwijze|porties|personen)\s*\**\s*:?/imu;

/**
 * The bilingual answer back into one PlainRecipe per language. Accepts the two-block form (markers
 * as in `markerLangOf`; prose before the first marker and after a horizontal rule / code fence is
 * ignored) and a single block
 * without markers, whose language is guessed from its headers ("## Ingredients" → en; default nl).
 * When both blocks exist but their line or step counts differ, both are returned with `mismatch`.
 */
export function parseBilingualPlain(input: string): BilingualPlain {
  const rows = (input ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: { lang: Lang; rows: string[] }[] = [];
  let current: { lang: Lang; rows: string[] } | null = null;
  for (const row of rows) {
    const markerLang = markerLangOf(row);
    if (markerLang) {
      current = { lang: markerLang, rows: [] };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    if (BLOCK_END_RE.test(row) && current.rows.some((r) => r.trim() !== '')) {
      current = null;
      continue;
    }
    current.rows.push(row);
  }

  if (blocks.length === 0) {
    const single = parsePlainRecipe(stripFences(rows).join('\n'));
    if (!single) return {};
    const text = rows.join('\n');
    const lang: Lang = EN_HEADER_RE.test(text) && !NL_HEADER_RE.test(text) ? 'en' : 'nl';
    return { [lang]: single, first: lang };
  }

  const out: BilingualPlain = {};
  for (const b of blocks) {
    if (out[b.lang]) continue; // a repeated marker: the first block of a language wins
    const r = parsePlainRecipe(b.rows.join('\n'));
    if (!r) continue;
    out[b.lang] = r;
    if (!out.first) out.first = b.lang;
  }
  if (out.nl && out.en) {
    const mismatch: NonNullable<BilingualPlain['mismatch']> = {};
    if (out.nl.lines.length !== out.en.lines.length) mismatch.lines = [out.nl.lines.length, out.en.lines.length];
    if (out.nl.steps.length !== out.en.steps.length) mismatch.steps = [out.nl.steps.length, out.en.steps.length];
    if (mismatch.lines || mismatch.steps) out.mismatch = mismatch;
  }
  return out;
}

/** Code-fence lines around a pasted answer are not part of the recipe. */
function stripFences(rows: string[]): string[] {
  return rows.filter((r) => !/^\s*`{3,}\w*\s*$/u.test(r));
}
