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
//   - 400 g aardappelen        (one per line, "- " in front)
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
//
// Phase 6 (docs/phase-6-spec.md 6A.10, 6A.14, 6A.16, 13C):
//  - The prompt asks for the WHOLE answer in one code block, so ChatGPT/Gemini show "Copy code"
//    and the text arrives with its line breaks and without markdown escapes. It also teaches the
//    ingredient-line shape the parser reads best — "quantity unit shortest-shop-name [everything
//    else]": one ingredient per line ("zout en peper" becomes two lines), a vague amount never in
//    front and never invented ("koosjer zout [naar smaak]", not "1 snuf koosjer zout": an invented
//    number would scale and land on the shopping list), descriptive words and alternatives in the
//    brackets ("2 sneetjes stokbrood [knapperig; of brood; voor erbij]") and preparations too
//    ("1 sjalotje [gesnipperd]"). src/domain/parser.ts `parseBody` lifts [brackets] out of the name.
//  - `normalizePastedAnswer` repairs what copying a rendered answer does to it: backslash escapes
//    ("\[in plakken\]"), lost line breaks (the whole block on one line, every ingredient on one
//    line, numbered steps run together) and chatter outside the code block. `parsePlainRecipe` and
//    `parseBilingualPlain` call it themselves, so the UI hands over the clipboard text as is.
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
  // docs/specs/labels-categorieen.md §3 blok 2 (lactose STRICT: no dairy product at all).
  lactosevrij: ['lactosevrij', 'lactose-free', 'lactose free', 'lactosefree', 'zuivelvrij', 'dairy-free', 'dairy free'],
  'lactosevrij-optie': ['lactosevrij-optie', 'lactosevrij optie', 'lactose-free option', 'lactosevrije optie', 'lactosevrij mogelijk'],
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

// --- the prompt -----------------------------------------------------------------------------------

/** The format block of one language, as the prompt shows it (inside the code block). */
function formatBlock(lang: Lang): string[] {
  return lang === 'nl'
    ? [
        '# Naam van het gerecht',
        'Porties: 4',
        'Categorie: pasta',
        'Labels: vegetarisch, snel',
        '## Ingrediënten',
        '- 400 g aardappelen',
        '- 2 el olijfolie',
        '- 1 sjalotje [gesnipperd]',
        '- koosjer zout [naar smaak]',
        '- 2 sneetjes stokbrood [knapperig; of brood; voor erbij]',
        '## Bereiding',
        'De eerste stap als één alinea, zonder nummer.',
        '',
        'De tweede stap, na een lege regel.',
      ]
    : [
        '# Name of the dish',
        'Servings: 4',
        'Category: pasta',
        'Tags: vegetarian, quick',
        '## Ingredients',
        '- 400 g potatoes',
        '- 2 tbsp olive oil',
        '- 1 shallot [finely chopped]',
        '- kosher salt [to taste]',
        '- 2 slices baguette [crusty; or bread; to serve]',
        '## Method',
        'The first step as one paragraph, no number.',
        '',
        'The second step, after a blank line.',
      ];
}

const CATEGORY_LIST = IMPORT_CATEGORY_IDS.join(', ');
const TAG_LIST = IMPORT_TAG_IDS.join(', ');

/** The meta rule: which words the "Categorie:" / "Labels:" lines may hold. */
const META_RULE: Record<Lang, string> = {
  nl: `"Categorie:" is één van: ${CATEGORY_LIST}; "Labels:" is een kommagescheiden keuze uit: ${TAG_LIST} (beide regels mogen weggelaten worden als je het niet weet).`,
  en: `"Category:" is one of: ${CATEGORY_LIST}; "Tags:" is a comma-separated choice from: ${TAG_LIST} (leave either line out when unsure).`,
};

/**
 * The ingredient-line rules (6A.10, 6A.14, 6A.16): the shape "quantity unit shortest-shop-name
 * [everything else]" that the parser reads best. Numbered so an assistant treats each as a rule.
 */
export const LINE_RULES: Record<Lang, string> = {
  nl:
    'Ingrediëntregels: elke regel begint met "- "; ' +
    '(1) één ingrediënt per regel — "zout en peper" wordt twee regels, "- zout" en "- peper"; ' +
    '(2) een vage hoeveelheid ("naar smaak", "een snufje", "een beetje") staat nooit vooraan en wordt nooit een verzonnen getal: schrijf alleen de naam en zet de omschrijving achteraan tussen rechte haken ("- koosjer zout [naar smaak]", niet "- 1 snuf koosjer zout"); ' +
    '(3) het ingrediënt is de kortste naam waaronder je het in de winkel koopt; beschrijvende woorden (knapperig, vers, rijp), alternatieven ("of brood") en waar het voor dient komen achteraan tussen rechte haken, gescheiden door ";" ("- 2 sneetjes stokbrood [knapperig; of brood; voor erbij]"); ' +
    '(4) bewerkingen zoals "gesnipperd" of "fijngehakt" staan ook tussen rechte haken achter het ingrediënt ("- 1 sjalotje [gesnipperd]").',
  en:
    'Ingredient lines: every line starts with "- "; ' +
    '(1) one ingredient per line — "salt and pepper" becomes two lines, "- salt" and "- pepper"; ' +
    '(2) a vague amount ("to taste", "a pinch", "a little") never comes first and never becomes an invented number: write only the name and put the description at the end in square brackets ("- kosher salt [to taste]", not "- 1 pinch kosher salt"); ' +
    '(3) the ingredient is the shortest name you buy it under in a shop; descriptive words (crusty, fresh, ripe), alternatives ("or bread") and what it is for go at the end in square brackets, separated by ";" ("- 2 slices baguette [crusty; or bread; to serve]"); ' +
    '(4) preparations such as "finely chopped" or "diced" also go in square brackets after the ingredient ("- 1 shallot [finely chopped]").',
};

/** The code-block rule (13C): the whole answer inside one fence, so "Copy code" copies it exactly. */
const CODE_BLOCK_RULE: Record<Lang, string> = {
  nl: 'Zet het HELE antwoord in één codeblok: begin met een regel ``` en eindig met een regel ```; geen tekst ervoor of erna, geen opmaak (geen vet, geen opsommingstekens behalve "- " voor de ingrediënten).',
  en: 'Put the WHOLE answer in one code block: start with a line ``` and end with a line ```; no text before or after it, no formatting (no bold, no bullets other than "- " in front of the ingredients).',
};

const FENCE = '```';

/** The common rules for the single-block prompt. */
const SINGLE_RULES: Record<Lang, string> = {
  nl: 'Regels: hoeveelheden en eenheden exact overnemen (metrisch, °C); een kopje in de ingrediëntenlijst (zoals "Dressing:") wordt een regel die eindigt op ":". ',
  en: 'Rules: copy quantities and units exactly (metric, °C); a heading inside the ingredient list (like "Dressing:") becomes a line ending in ":". ',
};

const PROMPT: Record<Lang, string> = {
  nl: [
    'Schrijf het recept op deze foto (of in deze tekst) over in precies dit platte formaat, in het Nederlands. Verander geen hoeveelheden.',
    'Antwoord alleen met het recept, zonder inleiding of uitleg. ' + CODE_BLOCK_RULE.nl,
    '',
    FENCE,
    ...formatBlock('nl'),
    FENCE,
    '',
    SINGLE_RULES.nl + LINE_RULES.nl + ' ' + META_RULE.nl,
  ].join('\n'),
  en: [
    'Rewrite the recipe in this photo (or in this text) in exactly this plain format, in English. Do not change any quantities.',
    'Answer with the recipe only, no introduction or explanation. ' + CODE_BLOCK_RULE.en,
    '',
    FENCE,
    ...formatBlock('en'),
    FENCE,
    '',
    SINGLE_RULES.en + LINE_RULES.en + ' ' + META_RULE.en,
  ].join('\n'),
};

/** Bilingual variant: the same format, returned twice, one block per language, in ONE code block. */
const PROMPT_BILINGUAL: Record<Lang, string> = {
  nl: [
    'Schrijf het recept op deze foto (of in deze tekst) over in precies dit platte formaat, TWEE keer: eerst in het Nederlands na een regel "=== NL ===", daarna in Brits Engels na een regel "=== EN ===". Verander geen hoeveelheden.',
    'Antwoord alleen met de twee blokken, zonder inleiding of uitleg. ' + CODE_BLOCK_RULE.nl,
    '',
    FENCE,
    '=== NL ===',
    ...formatBlock('nl'),
    '',
    '=== EN ===',
    ...formatBlock('en'),
    FENCE,
    '',
    'Regels: beide blokken hebben precies evenveel ingrediëntregels en evenveel stappen, in dezelfde volgorde (regel 3 in NL is de vertaling van regel 3 in EN); hoeveelheden, eenheden en temperaturen zijn in beide blokken identiek (metrisch, °C); "Porties:" / "Servings:" staat één keer in elk blok; een kopje in de ingrediëntenlijst (zoals "Dressing:") wordt een regel die eindigt op ":". Engels: tbsp, tsp, tin, clove, courgette, aubergine, coriander. ' +
      LINE_RULES.nl +
      ' ' +
      META_RULE.nl,
  ].join('\n'),
  en: [
    'Rewrite the recipe in this photo (or in this text) in exactly this plain format, TWICE: first in Dutch after a line "=== NL ===", then in British English after a line "=== EN ===". Do not change any quantities.',
    'Answer with the two blocks only, no introduction or explanation. ' + CODE_BLOCK_RULE.en,
    '',
    FENCE,
    '=== NL ===',
    ...formatBlock('nl'),
    '',
    '=== EN ===',
    ...formatBlock('en'),
    FENCE,
    '',
    'Rules: both blocks have exactly the same number of ingredient lines and the same number of steps, in the same order (line 3 in NL is the translation of line 3 in EN); quantities, units and temperatures are identical in both blocks (metric, °C); "Porties:" / "Servings:" appears once in each block; a heading inside the ingredient list (like "Dressing:") becomes a line ending in ":". English: tbsp, tsp, tin, clove, courgette, aubergine, coriander. ' +
      LINE_RULES.en +
      ' ' +
      META_RULE.en,
  ].join('\n'),
};

/**
 * The prompt for an external AI. `lang` is the language the instructions are written in (the
 * person reads them too). Bilingual by default: the recipe comes back as an NL and an EN block;
 * `{ bilingual: false }` asks for a single block in `lang`. Both forms ask for the optional
 * "Categorie:" / "Category:" and "Labels:" / "Tags:" lines (docs/phase-5-spec.md A.5) and for the
 * whole answer in one code block (13C: the person taps "Copy code" under the answer).
 */
export function buildImportPrompt(lang: Lang, opts: { bilingual?: boolean } = {}): string {
  const bilingual = opts.bilingual ?? true;
  return (bilingual ? PROMPT_BILINGUAL : PROMPT)[lang] + '\n';
}

// --- repairing a pasted answer (13C) --------------------------------------------------------------

const ZERO_WIDTH_RE = /[​-‍⁠﻿]/g;
/** Markdown backslash escapes as a rendered answer copies them: "\[", "\]", "\*", "\_", "\#", "\-" … */
const ESCAPE_RE = /\\([\\`*_{}[\]()#+\-.!|>~<])/g;
/** A line that is only a code fence (opening, possibly with a language, or closing). */
const FENCE_LINE_RE = /^\s*`{3,}[\w-]*\s*$/u;

/**
 * The cheap, lossless clean-up every paste box applies first: Windows line ends, no-break spaces,
 * zero-width characters and markdown backslash escapes ("\[in plakken\]" -> "[in plakken]").
 * Code fences are left in place (see `normalizePastedAnswer`, which also uses them).
 */
export function cleanPastedText(input: string): string {
  return (input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(ZERO_WIDTH_RE, '')
    .replace(ESCAPE_RE, '$1');
}

/**
 * The lines INSIDE code fences when the text has any (chatter outside them is dropped, language
 * marker lines outside them are kept so "=== NL ===" + fenced block + "=== EN ===" + fenced block
 * still reads); the text as is when there are no fences. Fence lines themselves never survive.
 */
function unfence(text: string): string {
  const rows = text.split('\n');
  if (!rows.some((r) => FENCE_LINE_RE.test(r))) return rows.map(stripInlineFence).join('\n');
  const out: string[] = [];
  let inside = false;
  let sawClose = false;
  for (const row of rows) {
    if (FENCE_LINE_RE.test(row)) {
      if (inside) sawClose = true;
      inside = !inside;
      continue;
    }
    if (inside) out.push(stripInlineFence(row));
    else if (markerLangOf(row)) out.push(row);
  }
  // An opening fence without a closing one: everything after it was inside.
  if (!sawClose && out.length === 0) return rows.filter((r) => !FENCE_LINE_RE.test(r)).join('\n');
  return out.join('\n');
}

/** "```Kook." / "Kook.```": a fence glued to a line of text. */
function stripInlineFence(row: string): string {
  return row.replace(/^\s*`{3,}[ \t]*/u, '').replace(/[ \t]*`{3,}\s*$/u, '');
}

const ING_WORDS = String.raw`(?:Ingrediënten|Ingredienten|Ingredients)`;
const METHOD_WORDS = String.raw`(?:Bereiding|Bereidingswijze|Werkwijze|Method|Instructions|Directions)`;
const HEAD_WORDS = String.raw`(?:${ING_WORDS}|${METHOD_WORDS})`;
const META_WORDS = String.raw`(?:Porties|Servings|Categorie|Category|Labels?|Tags)`;

/** Markers that a copied answer may have pulled into the middle of a line, back on their own line. */
function resplitMarkers(text: string): string {
  let t = text;
  // A break goes in front of a marker only after real text: never after the "##" / "***" / "===" of
  // a marker that already stands at the start of its line.
  const before = String.raw`([^\s#*_=])[ \t]+`;
  // "=== NL ===" / "**=== EN ===**" in the middle of a line.
  t = t.replace(new RegExp(String.raw`${before}(?=\*{0,2}={2,}\s*(?:NL|EN)\s*={2,})`, 'g'), '$1\n');
  t = t.replace(/(\*{0,2}={2,}\s*(?:NL|EN)\s*={2,}\*{0,2})[ \t]+(?=\S)/g, '$1\n');
  // "# Naam" / "## Ingrediënten" in the middle of a line, and text glued after a "## heading".
  t = t.replace(new RegExp(String.raw`${before}(?=#{1,3}[ \t]+\S)`, 'g'), '$1\n');
  t = t.replace(new RegExp(String.raw`^(\s*#{1,3}\s*${HEAD_WORDS}\s*:?)[ \t]+(?=\S)`, 'gm'), '$1\n');
  // Plain headings without '#', capitalised and mid-line, only when the list itself follows:
  // "Ingrediënten - 400 g broccoli" (a bullet or a quantity), "Bereiding Verwarm de oven" / "Bereiding
  // 1. Verwarm" (a numbered step or a sentence start). "de Bereiding van de saus" or "Volg de
  // Instructions op de verpakking" inside a step is left alone.
  t = t.replace(new RegExp(String.raw`${before}(?=${ING_WORDS}\s*:?[ \t]+(?:[-•*][ \t]|\d|[½¼¾⅓⅔⅛]))`, 'gu'), '$1\n');
  t = t.replace(new RegExp(String.raw`${before}(?=${METHOD_WORDS}\s*:?[ \t]+(?:\d{1,2}[.)][ \t]|\p{Lu}))`, 'gu'), '$1\n');
  t = t.replace(new RegExp(String.raw`^(${HEAD_WORDS}\s*:?)[ \t]+(?=\S)`, 'gm'), '$1\n');
  // "Porties: 4 Categorie: pasta Labels: snel": each meta key on its own line.
  t = t.replace(new RegExp(String.raw`${before}(?=\*{0,2}${META_WORDS}\*{0,2}\s*:)`, 'g'), '$1\n');
  // The translation format (src/domain/translate-prompt.ts): "I1. … I2. …" / "S1. … S2. …" on one line.
  if (/^\s*[IS]1\s*[.:)]/m.test(t)) t = t.replace(/[ \t]+(?=[IS]\d{1,3}\s*[.:)]\s)/g, '\n');
  return t;
}

const INGREDIENTS_RE = /^\s*(?:#{1,3}\s*)?\**\s*(ingredi[eë]nten|ingredients?)\s*\**\s*:?\s*$/iu;
const METHOD_RE = /^\s*(?:#{1,3}\s*)?\**\s*(bereiding|bereidingswijze|werkwijze|method|instructions|directions|steps|preparation)\s*\**\s*:?\s*$/iu;
const NAME_RE = /^\s*#(?!#)\s*(.+?)\s*#*\s*$/u;

const NUMBER_TOKEN = String.raw`(?:\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?|\d+\s?[½¼¾⅓⅔⅛]|\d+/\d+|[½¼¾⅓⅔⅛])`;
/** A word before a mid-line number that means the number belongs to the same ingredient. */
const KEEP_BEFORE_NUMBER = new Set([
  'van', 'of', 'x', 'à', 'a', 'tot', 'en', 'and', 'or', 'to', 'ca', 'ca.', 'circa', 'ongeveer', 'about', 'approx', 'approx.',
  'plus', '+', 'per', 'voor', 'for', 'met', 'with', 'in', 'op', 'bij', 'uit', 'from', 'at', 'type', 'nr', 'nr.', 'no', 'no.',
  'maat', 'size', 'grade', 'minimaal', 'minstens', 'at least', 'max', 'maximaal', 'stukken', 'blokjes', 'plakjes', 'reepjes',
]);
/** Words after which a bare "zout" / "salt" is still the same ingredient ("grof zout", "zeezout" is one word anyway). */
const KEEP_BEFORE_SALT = new Set([
  'en', 'and', 'of', 'or', '&', '+', 'grof', 'fijn', 'fijne', 'grove', 'koosjer', 'kosher', 'gerookt', 'smoked', 'zee', 'sea', 'table', 'coarse',
  'fine', 'flaky', 'celery', 'garlic', 'onion', 'selderij', 'knoflook', 'het', 'de', 'the', 'a', 'wat', 'beetje', 'little', 'some', 'snuf', 'snufje',
  'pinch', 'mespunt', 'mespuntje', 'tl', 'el', 'theelepel', 'eetlepel', 'tsp', 'tbsp', 'teaspoon', 'tablespoon', 'g', 'gram', 'extra', 'meer',
  'more', 'weinig', 'iets', 'genoeg', 'voldoende', 'smaak', 'wens', 'taste', 'liking', 'behoefte', 'needed', 'flaked', 'rock', 'himalaya',
]);
/** Words after which a bare "peper" / "pepper" belongs to the previous word; only "zout peper" is split. */
const SPLIT_BEFORE_PEPPER = new Set(['zout', 'salt']);

/** The unit words a quantity may carry on an ingredient line (for the split heuristics only). */
const UNIT_WORDS = String.raw`(?:kg|g|gr|gram|ml|dl|l|ltr|liter|el|tl|eetlepels?|theelepels?|tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|lbs|cm|bol|bollen|teen|tenen|teentjes?|takjes?|snufjes?|scheutjes?|blik|blikjes?|pot|potjes?|pak|pakjes?|zakjes?|stuks?|plakjes?|sneetjes?|bosjes?|handjes?|mespuntjes?|stengels?|cloves?|bunch|sprigs?|pinch|tins?|cans?|slices?|sticks?|pint|stalks?|heads?|handfuls?|knobs?|splash|dash)`;
/** Quantity + unit groups and "]" tails say a line holds several ingredients. */
const QTY_UNIT_RE = new RegExp(String.raw`(?:^|\s)${NUMBER_TOKEN}\s?${UNIT_WORDS}\b`, 'giu');
const UNIT_TOKEN_RE = new RegExp(`^${UNIT_WORDS}$`, 'iu');

/**
 * One ingredient line of a copied answer that holds several ingredients ("1,5 kg uien [in plakken]
 * 1 bol knoflook [in plakjes] 75 g boter zout peper 1 tl suiker …"), split back into one per line:
 * after every "]" tail, before every quantity that follows a word, and bare "zout"/"peper" after a
 * product word ("boter zout peper" -> boter / zout / peper; "zout en peper" and "grof zout" stay).
 * A line with a single ingredient is returned as is; brackets and parentheses are never split. A
 * quantity that ends the line ("1 blik kokosmelk 400 ml") is the pack size, "(optioneel)" or
 * "of 2 sjalotjes" after a "]" belongs to the same ingredient, and "1 - 2 tl" is a range, not two
 * bullets.
 */
export function splitCollapsedIngredients(line: string): string[] {
  const text = line.trim();
  if (!text) return [];
  // "- 1 ui - 2 el olie": bullets run together ("- 1 - 2 tl sambal" is a range).
  if (/^[-•*]\s/.test(text) && /(?<!\d)\s[-•*]\s(?=\S)/.test(text)) {
    return text
      .split(/(?<!\d)\s+[-•*]\s+(?=\S)/)
      .map((s) => s.replace(/^[-•*]\s+/, '').trim())
      .filter(Boolean)
      .flatMap(splitCollapsedIngredients);
  }
  // Tokenise, keeping [brackets] and (parentheses) whole.
  const tokens = text.match(/\[[^\]]*\]|\([^)]*\)|\S+/gu) ?? [];
  if (tokens.length < 2) return [text];
  const starts = new Set<number>();
  const isNumber = (t: string) => new RegExp(`^${NUMBER_TOKEN}$`, 'u').test(t);
  const isWord = (t: string) => /\p{L}/u.test(t) && !t.endsWith(':') && !isNumber(t) && !t.startsWith('(') && !t.startsWith('[');
  /** "… kokosmelk 400 ml", "… kikkererwten 400 g [uitgelekt]": a quantity + unit that ends the line (brackets/parens aside) is the pack size. */
  const isPackTail = (i: number) => {
    const unit = tokens[i + 1];
    if (!unit || !UNIT_TOKEN_RE.test(unit)) return false;
    return tokens.slice(i + 2).every((t) => t.startsWith('[') || t.startsWith('('));
  };
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i] as string;
    const prev = tokens[i - 1] as string;
    if (prev.startsWith('[') && prev.endsWith(']')) {
      starts.add(i);
      continue;
    }
    if (isNumber(tok) && isWord(prev) && !KEEP_BEFORE_NUMBER.has(prev.toLowerCase()) && !isPackTail(i)) starts.add(i);
  }
  const qtyUnits = (text.match(QTY_UNIT_RE) ?? []).length;
  // A tail after a "]" counts only when a quantity opens it ("[gesnipperd] 2 el olie"), not for
  // "[gehakt] (optioneel)" or "[gesnipperd] of 2 sjalotjes".
  const hasTail = /\]\s+(?:\d|[½¼¾⅓⅔⅛])/u.test(text);
  if (!(starts.size >= 2 || (starts.size >= 1 && (hasTail || qtyUnits >= 2)))) return [text];
  // Salt and pepper on the same line as the previous product.
  for (let i = 1; i < tokens.length; i++) {
    const tok = (tokens[i] as string).toLowerCase().replace(/[.,;]+$/, '');
    const prev = (tokens[i - 1] as string).toLowerCase().replace(/[.,;]+$/, '');
    if (starts.has(i) || !isWord(tokens[i - 1] as string)) continue;
    if ((tok === 'zout' || tok === 'salt') && !KEEP_BEFORE_SALT.has(prev)) starts.add(i);
    if ((tok === 'peper' || tok === 'pepper') && SPLIT_BEFORE_PEPPER.has(prev)) starts.add(i);
  }
  const out: string[] = [];
  let current: string[] = [];
  tokens.forEach((tok, i) => {
    if (starts.has(i) && current.length) {
      out.push(current.join(' '));
      current = [];
    }
    current.push(tok);
  });
  if (current.length) out.push(current.join(' '));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** "1. Verwarm de oven. 2. Snijd de ui. 3. …" on one line: numbered steps run together, split at 2., 3., … in order. */
function splitCollapsedSteps(line: string): string[] {
  const m = /^\s*(\d{1,2})[.)]\s/.exec(line);
  if (!m) return [line];
  const out: string[] = [];
  let rest = line;
  let next = Number(m[1]) + 1;
  for (let guard = 0; guard < 60; guard++) {
    const re = new RegExp(String.raw`\s+(?=${next}[.)]\s+\S)`, 'u');
    const hit = re.exec(rest);
    if (!hit) break;
    out.push(rest.slice(0, hit.index));
    rest = rest.slice(hit.index + hit[0].length);
    next++;
  }
  out.push(rest);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * A pasted AI answer with the damage of copying a rendered answer undone (13C): escapes and zero-width
 * characters removed, only the text inside code fences kept (chatter outside dropped), markers that
 * landed in the middle of a line ("=== NL ===", "# Naam", "Porties:", "Categorie:", "Labels:",
 * "## Ingrediënten", "## Bereiding", "I1.", "S1.") back on their own line, an ingredient list that
 * collapsed into one line split before every quantity and after every "]", and numbered steps that
 * ran together split again. A clean answer comes back unchanged. `parsePlainRecipe` and
 * `parseBilingualPlain` apply this themselves.
 */
export function normalizePastedAnswer(input: string): string {
  const text = resplitMarkers(unfence(cleanPastedText(input)));
  const out: string[] = [];
  let section: 'none' | 'lines' | 'steps' = 'none';
  for (const row of text.split('\n')) {
    const trimmed = row.trim();
    if (INGREDIENTS_RE.test(trimmed)) section = 'lines';
    else if (METHOD_RE.test(trimmed)) section = 'steps';
    else if (NAME_RE.test(row) || markerLangOf(row)) section = 'none';
    else if (section === 'lines' && trimmed) {
      const bullet = /^[-•*]\s+/.test(trimmed);
      for (const part of splitCollapsedIngredients(trimmed)) out.push(bullet && !/^[-•*]\s/.test(part) ? `- ${part}` : part);
      continue;
    } else if (section === 'steps' && trimmed) {
      out.push(...splitCollapsedSteps(row));
      continue;
    }
    out.push(row);
  }
  return out.join('\n');
}

// --- the plain format back into fields ------------------------------------------------------------

const SERVINGS_RE = /^\s*\**\s*(?:porties|personen|voor|servings?|serves|yield)\s*\**\s*:?\s*\**\s*(\d{1,2})\b/iu;
const BULLET_RE = /^\s*(?:[-*•–]\s+|\d{1,3}\s*[.)]\s+)/u;
const KEY_VALUE_RE = /^\s*\**\s*(?:naam|name|titel|title)\s*\**\s*:\s*(.+)$/iu;
const CATEGORY_LINE_RE = /^\s*\**\s*(?:categorie|category|soort|type)\s*\**\s*:\s*\**\s*(.*?)\s*\**\s*$/iu;
const TAGS_LINE_RE = /^\s*\**\s*(?:labels?|tags?|dieet|diet|kenmerken)\s*\**\s*:\s*\**\s*(.*?)\s*\**\s*$/iu;

/**
 * The plain format back into name, servings, ingredient lines and steps (plus category and tags
 * when the text has those lines). Returns null when the text holds neither a name, nor
 * ingredients, nor steps. The text is repaired first (`normalizePastedAnswer`).
 */
export function parsePlainRecipe(input: string): PlainRecipe | null {
  const raw = normalizePastedAnswer(input ?? '');
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
/** A markdown horizontal rule ends a block (chatter after it is ignored; code fences are handled by `unfence`). */
const BLOCK_END_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u;
/** Headers that betray the language of a single block without markers. */
const EN_HEADER_RE = /^\s*(?:#{1,3}\s*)?\**\s*(ingredients?|method|instructions|directions|servings?|serves)\s*\**\s*:?/imu;
const NL_HEADER_RE = /^\s*(?:#{1,3}\s*)?\**\s*(ingredi[eë]nten|bereiding|bereidingswijze|werkwijze|porties|personen)\s*\**\s*:?/imu;

/**
 * The bilingual answer back into one PlainRecipe per language. Accepts the two-block form (markers
 * as in `markerLangOf`; prose before the first marker, outside the code block and after a horizontal
 * rule is ignored) and a single block without markers, whose language is guessed from its headers
 * ("## Ingredients" → en; default nl). When both blocks exist but their line or step counts differ,
 * both are returned with `mismatch`. The text is repaired first (`normalizePastedAnswer`).
 */
export function parseBilingualPlain(input: string): BilingualPlain {
  const rows = normalizePastedAnswer(input ?? '').split('\n');
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
    const single = parsePlainRecipe(rows.join('\n'));
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
