// "Importeer van foto/tekst" (docs/phase-2-spec.md §5, decision §0 photo import). Framework-free.
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
// `parsePlainRecipe` is tolerant: headers with or without '#', bullets and numbers in front of
// ingredient lines, numbered steps, and a name without '#' when it is the first line.
import type { Lang } from './model.ts';

export interface PlainRecipe {
  name: string;
  /** Null when the text had no "Porties:" / "Servings:" line. */
  servings: number | null;
  lines: string[];
  steps: string[];
}

const PROMPT: Record<Lang, string> = {
  nl: [
    'Schrijf het recept op deze foto (of in deze tekst) over in precies dit platte formaat, in het Nederlands. Verander geen hoeveelheden.',
    'Antwoord alleen met het recept, zonder inleiding of uitleg.',
    '',
    '# Naam van het gerecht',
    'Porties: 4',
    '## Ingrediënten',
    'één ingrediënt per regel, hoeveelheid voorop (bv. "400 g aardappelen", "2 el olijfolie", "1 rode ui [gesnipperd]")',
    '## Bereiding',
    'één stap per alinea, gescheiden door een lege regel; geen nummering',
    '',
    'Regels: hoeveelheden en eenheden exact overnemen (metrisch, °C); een kopje in de ingrediëntenlijst (zoals "Dressing:") wordt een regel die eindigt op ":"; bewerkingen zoals "fijngehakt" tussen [vierkante haken] achter het ingrediënt.',
  ].join('\n'),
  en: [
    'Rewrite the recipe in this photo (or in this text) in exactly this plain format, in English. Do not change any quantities.',
    'Answer with the recipe only, no introduction or explanation.',
    '',
    '# Name of the dish',
    'Servings: 4',
    '## Ingredients',
    'one ingredient per line, quantity first (e.g. "400 g potatoes", "2 tbsp olive oil", "1 red onion [finely chopped]")',
    '## Method',
    'one step per paragraph, separated by a blank line; no numbering',
    '',
    'Rules: copy quantities and units exactly (metric, °C); a heading inside the ingredient list (like "Dressing:") becomes a line ending in ":"; preparation notes such as "finely chopped" go in [square brackets] after the ingredient.',
  ].join('\n'),
};

/** The prompt for an external AI, in the language the recipe should come back in. */
export function buildImportPrompt(lang: Lang): string {
  return PROMPT[lang] + '\n';
}

const NAME_RE = /^\s*#(?!#)\s*(.+?)\s*#*\s*$/u;
const INGREDIENTS_RE = /^\s*(?:#{1,3}\s*)?\**\s*(ingredi[eë]nten|ingredients?)\s*\**\s*:?\s*$/iu;
const METHOD_RE = /^\s*(?:#{1,3}\s*)?\**\s*(bereiding|bereidingswijze|werkwijze|method|instructions|directions|steps|preparation)\s*\**\s*:?\s*$/iu;
const SERVINGS_RE = /^\s*\**\s*(?:porties|personen|voor|servings?|serves|yield)\s*\**\s*:?\s*(\d{1,2})\b/iu;
const BULLET_RE = /^\s*(?:[-*•–]\s+|\d{1,3}\s*[.)]\s+)/u;
const KEY_VALUE_RE = /^\s*\**\s*(?:naam|name|titel|title)\s*\**\s*:\s*(.+)$/iu;

/**
 * The plain format back into name, servings, ingredient lines and steps. Returns null when the
 * text holds neither a name, nor ingredients, nor steps.
 */
export function parsePlainRecipe(input: string): PlainRecipe | null {
  const raw = (input ?? '').replace(/\r\n?/g, '\n');
  let name = '';
  let servings: number | null = null;
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
    const nm = NAME_RE.exec(line);
    if (nm && !name) {
      name = (nm[1] as string).trim();
      continue;
    }
    const kv = KEY_VALUE_RE.exec(trimmed);
    if (kv && !name && section === 'none') {
      name = (kv[1] as string).trim();
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
  return { name, servings, lines: lines.filter(Boolean), steps };
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
