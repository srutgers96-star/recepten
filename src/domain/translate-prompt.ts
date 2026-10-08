// "Kopieer voor vertaling" / "Plak vertaling" (docs/phase-2-spec.md §5 "Language pair",
// docs/phase-5-spec.md A-bis.2 and A-bis.7). Framework-free.
//
// The LLM never runs in the app: the editor puts a fixed, numbered prompt on the clipboard, the
// person pastes it into ChatGPT/Claude, and pastes the numbered answer back. Numbering is the
// contract that lets the answer be mapped onto the other language's fields without guessing.
//
// The prompt only asks for what the app cannot do itself (A-bis.2): resolved ingredient lines are
// rendered from the dictionary in either language, so only their free text goes out:
//
//   1. <name>                     only when the target language has no name yet
//   D. <description>              only when present
//   T. <serving tip>              only when present
//   I3. <ingredient line>         unresolved lines (and headers), numbered by their ROW (1-based)
//   N5. <note>                    the (parenthesised) note of row 5 that has no translation yet
//   P5. <prep>                    the preparation note of row 5 that has no translation yet
//   S3. <step>                    steps without target text, numbered by their ROW (1-based)
//
// `parseTranslationAnswer` is tolerant: markdown bold/bullets around the markers, "I1:" or "I1)"
// instead of "I1.", chatter before/after the list, a missing name (or the name as "Title:" /
// "Naam:" / the first line), and continuation lines (a step that spans several lines joins the
// previous item). Assistants also like to answer with the original AND the translation, each under a
// language heading ("Nederlands:", "## English", "=== EN ===", "Original:" / "Translation:"); with the
// target language given (docs/phase-6-spec.md 6A.1) only the items of the target block are used, so a
// Dutch original that comes first never lands in the English fields. `applyTranslationAnswer` writes
// the answer into the target language only and never overwrites text that is already there.
import { hasLang, type Lang, type Line, type Text } from './model.ts';

const LANG_NAME: Record<Lang, string> = { nl: 'Dutch', en: 'British English' };

/** An ingredient line as the prompt needs it: a `Line` (or an editor row with the same fields). */
export interface TranslatableLine {
  raw: Text;
  kind?: string;
  ing?: string | null;
  note?: Text | null;
  prep?: Text | null;
  [k: string]: unknown;
}

/** The part of a recipe the prompt needs. */
export interface TranslatableRecipe {
  name: Text;
  description?: Text | null;
  servingTip?: Text | null;
  lines: TranslatableLine[];
  steps: { text: Text }[];
}

export interface TranslationOptions {
  /**
   * Whether a line renders from the dictionary (its `ing` is known to the dictionary in use). The
   * default is `!!line.ing`; the app passes `(l) => !!l.ing && !!dict.get(l.ing)`.
   */
  isResolved?: (line: TranslatableLine, index: number) => boolean;
}

/** What a prompt asks for, so the caller can check the answer against it ("expected 3 lines"). */
export interface TranslationPlan {
  /** Whether the name is sent as "1." (no name in the target language yet). */
  name: boolean;
  /** 1-based row numbers sent as I-items (unresolved lines and headers without target text). */
  lines: number[];
  /** 1-based row numbers sent as N-items (notes without target text). */
  notes: number[];
  /** 1-based row numbers sent as P-items (prep notes without target text). */
  preps: number[];
  description: boolean;
  servingTip: boolean;
  /** 1-based step numbers sent as S-items (steps without target text). */
  steps: number[];
}

export interface TranslationAnswer {
  /** The translated name, when the answer had a "1." line, a "Title:"/"Naam:" line or a clear first line. */
  name?: string;
  description?: string;
  servingTip?: string;
  /** Ingredient lines (I-items) in marker order (legacy shape; `lineByNumber` has the numbers). */
  lines: string[];
  /** I-items by their marker number ("I3." -> 3). */
  lineByNumber: Record<number, string>;
  /** N-items by row number. */
  notes: Record<number, string>;
  /** P-items by row number. */
  preps: Record<number, string>;
  /** Steps in marker order (legacy shape; `stepByNumber` has the numbers). */
  steps: string[];
  /** S-items by their marker number ("S3." -> 3). */
  stepByNumber: Record<number, string>;
}

function text(t: Text | null | undefined, lang: Lang): string {
  const s = t?.[lang];
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

function isResolvedDefault(line: TranslatableLine): boolean {
  return !!line.ing;
}

/** Which parts of the recipe the prompt sends (A-bis.2: only what the app cannot translate itself). */
export function planTranslation(recipe: TranslatableRecipe, from: Lang, to: Lang, opts: TranslationOptions = {}): TranslationPlan {
  const isResolved = opts.isResolved ?? isResolvedDefault;
  const plan: TranslationPlan = { name: false, lines: [], notes: [], preps: [], description: false, servingTip: false, steps: [] };
  recipe.lines.forEach((line, i) => {
    const n = i + 1;
    if (line.kind === 'header' || !isResolved(line, i)) {
      if (!hasLang(line.raw, to)) plan.lines.push(n);
      return;
    }
    if (line.note && hasLang(line.note, from) && !hasLang(line.note, to)) plan.notes.push(n);
    if (line.prep && hasLang(line.prep, from) && !hasLang(line.prep, to)) plan.preps.push(n);
  });
  plan.description = hasLang(recipe.description, from) && !hasLang(recipe.description, to);
  plan.servingTip = hasLang(recipe.servingTip, from) && !hasLang(recipe.servingTip, to);
  plan.name = !hasLang(recipe.name, to);
  recipe.steps.forEach((step, i) => {
    if (!hasLang(step.text, to)) plan.steps.push(i + 1);
  });
  return plan;
}

/**
 * The numbered prompt for an external AI: instructions (always in English, every assistant reads
 * that) + the name, description, serving tip, the free text of the ingredient lines and the steps
 * in `from`. Row numbers of I/N/P items are the editor rows (1-based), so they may be sparse.
 */
export function buildTranslationPrompt(recipe: TranslatableRecipe, from: Lang, to: Lang, opts: TranslationOptions = {}): string {
  const plan = planTranslation(recipe, from, to, opts);
  const head = [
    `Translate this recipe from ${LANG_NAME[from]} to ${LANG_NAME[to]}.`,
    'Rules:',
    '- Answer ONLY with the numbered list below, translated, keeping every marker exactly (1., D., T., I3., N5., P5., S1., …). No introduction, no notes, do not renumber.',
    '- Markers: 1. = the recipe name, D. = description, T. = serving tip, I<n>. = one whole ingredient line, N<n>. = a short note that belongs to ingredient line n (translate the note only), P<n>. = how ingredient n is prepared (e.g. "finely chopped"), S<n>. = one step.',
    '- Keep every quantity, unit and temperature exactly as written (metric, °C). Do not convert or round.',
    to === 'en'
      ? '- Use British cooking English: tbsp, tsp, tin, clove, bunch, sprig, courgette, aubergine, coriander. Keep the tone of the original; one step stays one step.'
      : '- Use natural Dutch cooking language: el, tl, blik, teentje, bosje, takje. Keep the tone of the original; one step stays one step.',
    '- A line that is only a heading ending in ":" (like "Dressing:") stays a heading. Text in [brackets] or (parentheses) keeps its brackets.',
    '- If a line is empty, answer with the marker only.',
    '',
  ];
  const body: string[] = [];
  if (plan.name) body.push(`1. ${text(recipe.name, from)}`);
  if (plan.description) body.push(`D. ${text(recipe.description, from)}`);
  if (plan.servingTip) body.push(`T. ${text(recipe.servingTip, from)}`);
  const items: { n: number; kind: 'I' | 'N' | 'P'; text: string }[] = [];
  for (const n of plan.lines) items.push({ n, kind: 'I', text: text(recipe.lines[n - 1]?.raw, from) });
  for (const n of plan.notes) items.push({ n, kind: 'N', text: text(recipe.lines[n - 1]?.note, from) });
  for (const n of plan.preps) items.push({ n, kind: 'P', text: text(recipe.lines[n - 1]?.prep, from) });
  items.sort((a, b) => a.n - b.n || a.kind.localeCompare(b.kind));
  for (const it of items) body.push(`${it.kind}${it.n}. ${it.text}`);
  for (const n of plan.steps) body.push(`S${n}. ${text(recipe.steps[n - 1]?.text, from)}`);
  return [...head, ...body].join('\n') + '\n';
}

/** Marker at the start of a line: "I3.", "**S2:**", "- N1)", "P4 -", "D.", "T:", "1." (name). */
const MARKER_RE = /^[\s*_\-•>#]*(?:(1)\s*[.:)]|([INPS])\s?(\d{1,3})\s*[.:)\]-]?|([DT])\s*[.:)])\**\s*(.*)$/iu;
/** Section headers some assistants add anyway: "Ingredients:" / "Method:" / "Ingrediënten" / "Bereiding". */
const SECTION_RE = /^[\s*_#]*(ingredients?|ingredi[eë]nten|method|steps?|instructions|bereiding|stappen)\s*:?\**\s*$/iu;
/** "Title: Onion soup" / "Naam: Uiensoep" (A-bis.7). */
const NAME_LINE_RE = /^[\s*_#>-]*(?:name|naam|title|titel|recipe|recept|recipe name|receptnaam)\s*:\s*\**\s*(.+?)\**\s*$/iu;
/** Chatter that must never become the recipe name. */
const CHATTER_RE = /\b(translation|translated|translate|vertaling|vertaald|vertalen|here|hier|sure|certainly|of course)\b/iu;

/**
 * The block an item came from: a language ("=== NL ===", "English:"), or the role when the heading
 * only says which text is which ("Origineel:" = the source, "Translation:" = the target).
 */
type BlockTag = Lang | 'source' | 'target';

/** What a block heading is wrapped in: "=== NL ===", "## EN", "**Nederlands:**", "(NL)", "### English". */
const BLOCK_TRIM_RE = /^[\s*_#>=[(]+|[\s*_:=\])]+$/gu;
/**
 * The words a heading may hold (lower-cased, after the trim): a language, or original/translation,
 * optionally followed by one noun ("English translation", "Nederlandse versie", "Original recipe").
 * The two-letter codes are matched separately and only in upper case ("en" alone is a Dutch word).
 */
const BLOCK_WORD_RE = /^(nederlands|nederlandse|dutch|engels|engelse|english|origineel|originele|original|bron|brontekst|source|vertaling|translation|vertaald|translated)(?:\s+(?:versie|version|vertaling|translation|origineel|original|tekst|text|recept|recipe))?$/u;

/**
 * A language-block heading: a line that holds nothing but the language (the same set as
 * `markerLangOf` in photo-import.ts, which the import prompt teaches: "=== NL ===", "## EN",
 * "**Nederlands:**", "English", "Dutch", "Engels") or the role of the block ("Origineel" /
 * "Original" = source, "Vertaling" / "Translation" = target). Null for any other line.
 */
function blockTagOf(line: string): BlockTag | null {
  const core = line.replace(BLOCK_TRIM_RE, '');
  if (core === 'NL') return 'nl';
  if (core === 'EN') return 'en';
  const m = BLOCK_WORD_RE.exec(core.toLowerCase());
  if (!m) return null;
  const word = m[1] as string;
  if (/^(nederlands|nederlandse|dutch)$/u.test(word)) return 'nl';
  if (/^(engels|engelse|english)$/u.test(word)) return 'en';
  if (/^(origineel|originele|original|bron|brontekst|source)$/u.test(word)) return 'source';
  return 'target';
}

interface Item {
  kind: 'name' | 'description' | 'servingTip' | 'line' | 'note' | 'prep' | 'step';
  index: number;
  text: string;
  /** The language block the item was found in; absent before the first (or without any) heading. */
  block?: BlockTag;
}

function cleanName(s: string): string {
  return s.replace(/^[\s*_#>-]+|[\s*_]+$/gu, '').trim();
}

/**
 * Parses the numbered answer back. Items are ordered by their marker number (missing numbers
 * keep the order of appearance); lines without a marker join the previous item, chatter before
 * the first marker is ignored — unless it is exactly one plain line, which is then the name
 * (A-bis.7: a missing "1." never blocks the rest).
 *
 * Language blocks (6A.1): a heading such as "Nederlands:", "## English", "=== EN ===" or
 * "Translation:" starts a new block, in which the name, D. and T. may appear once more. With `to`
 * given, an answer that has items in the target language's block (or a "Translation" block) uses
 * ONLY those items; without a target block, items of the source block are dropped. Without `to`
 * only the "Original"/"Translation" roles are resolved (the legacy callers and tests).
 */
export function parseTranslationAnswer(answer: string, to?: Lang): TranslationAnswer {
  const items: Item[] = [];
  let current: Item | null = null;
  let section: 'line' | 'step' | null = null;
  let autoIndex = 0;
  /** The language block the parser is in (null before the first heading). */
  let block: BlockTag | null = null;
  /** True when the item came from the block the parser is in (one name / D. / T. per block). */
  const inBlock = (it: Item) => (it.block ?? null) === block;
  const push = (it: Item): Item => {
    if (block) it.block = block;
    items.push(it);
    return it;
  };
  /** Non-empty lines before the first marker or section header (a possible name). */
  const preamble: string[] = [];
  let sawMarker = false;
  for (const rawLine of (answer ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\s+$/u, '');
    if (line.trim() === '') {
      // A blank line ends a continuation: the next unmarked line is not glued on.
      current = null;
      continue;
    }
    const tag = blockTagOf(line);
    if (tag) {
      // A language heading never glues onto the step above it, even without a blank line between.
      block = tag;
      current = null;
      section = null;
      autoIndex = 0;
      sawMarker = true;
      continue;
    }
    const sec = SECTION_RE.exec(line);
    if (sec) {
      section = /^(ingredi)/iu.test(sec[1] as string) ? 'line' : 'step';
      current = null;
      autoIndex = 0;
      sawMarker = true;
      continue;
    }
    const named = NAME_LINE_RE.exec(line);
    if (named && !items.some((it) => it.kind === 'name' && inBlock(it))) {
      current = push({ kind: 'name', index: 0, text: cleanName(named[1] as string) });
      sawMarker = true;
      continue;
    }
    const m = MARKER_RE.exec(line);
    if (m && (m[1] !== undefined || m[2] !== undefined || m[4] !== undefined)) {
      const body = (m[5] ?? '').replace(/\*+$/u, '').trim();
      if (m[1] !== undefined && m[2] === undefined && m[4] === undefined) {
        // "1." at the start is the name — but only once per block; later "1." lines are plain numbering.
        if (!items.some((it) => it.kind === 'name' && inBlock(it)) && section === null) {
          current = push({ kind: 'name', index: 0, text: cleanName(body) });
          sawMarker = true;
          continue;
        }
        if (section) {
          autoIndex = 1;
          current = push({ kind: section, index: 1, text: body });
          sawMarker = true;
          continue;
        }
      }
      if (m[4] !== undefined) {
        const kind = (m[4] as string).toUpperCase() === 'D' ? 'description' : 'servingTip';
        if (!items.some((it) => it.kind === kind && inBlock(it))) {
          current = push({ kind, index: 0, text: body });
          sawMarker = true;
          continue;
        }
      }
      if (m[2] !== undefined) {
        const letter = (m[2] as string).toUpperCase();
        const kind = letter === 'I' ? 'line' : letter === 'N' ? 'note' : letter === 'P' ? 'prep' : 'step';
        current = push({ kind, index: Number(m[3]), text: body });
        sawMarker = true;
        continue;
      }
    }
    // Plain numbered list inside a section ("2. Fry the onions"): the number is positional.
    const plain = /^[\s*\-•]*(\d{1,3})\s*[.:)]\s+(.*)$/u.exec(line);
    if (plain && section) {
      autoIndex = Number(plain[1]);
      current = push({ kind: section, index: autoIndex, text: (plain[2] ?? '').trim() });
      continue;
    }
    // Unmarked line: inside a section a bullet (or the first line) starts a new item, anything
    // else continues the current one.
    const bullet = /^[-*•]\s+/u.test(line.trim());
    if (section && (bullet || !current)) {
      autoIndex += 1;
      current = push({ kind: section, index: autoIndex, text: line.trim().replace(/^[-*•]\s+/u, '') });
    } else if (current) {
      current.text = current.text ? `${current.text}\n${line.trim()}` : line.trim();
    } else if (!sawMarker) {
      preamble.push(line.trim());
    }
  }

  // 6A.1: keep the target language's block when there is one, else drop the source block's items.
  const other: Lang | undefined = to === undefined ? undefined : to === 'nl' ? 'en' : 'nl';
  const isTarget = (it: Item) => it.block === 'target' || (to !== undefined && it.block === to);
  const isSource = (it: Item) => it.block === 'source' || (other !== undefined && it.block === other);
  const kept = items.some(isTarget) ? items.filter(isTarget) : items.filter((it) => !isSource(it));

  const ordered = (kind: Item['kind']): Item[] =>
    kept
      .filter((it) => it.kind === kind)
      .map((it, order) => ({ it, order }))
      .sort((a, b) => a.it.index - b.it.index || a.order - b.order)
      .map(({ it }) => it);
  const byNumber = (kind: Item['kind']): Record<number, string> => {
    const out: Record<number, string> = {};
    for (const it of ordered(kind)) if (out[it.index] === undefined) out[it.index] = it.text.trim();
    return out;
  };

  const out: TranslationAnswer = {
    lines: ordered('line').map((it) => it.text.trim()),
    lineByNumber: byNumber('line'),
    notes: byNumber('note'),
    preps: byNumber('prep'),
    steps: ordered('step').map((it) => it.text.trim()),
    stepByNumber: byNumber('step'),
  };
  const name = kept.find((it) => it.kind === 'name');
  if (name && name.text.trim()) out.name = name.text.trim();
  else if (preamble.length === 1 && !items.some((it) => it.kind === 'name')) {
    // "Uiensoep" on its own above the list: the name without its "1." (A-bis.7). Not when the
    // answer did name the recipe in a block that was dropped: that preamble is then chatter.
    const candidate = cleanName(preamble[0] as string);
    if (candidate && candidate.length <= 100 && !/[:!?]$/u.test(candidate) && !CHATTER_RE.test(candidate)) out.name = candidate;
  }
  const description = kept.find((it) => it.kind === 'description');
  if (description && description.text.trim()) out.description = description.text.trim();
  const tip = kept.find((it) => it.kind === 'servingTip');
  if (tip && tip.text.trim()) out.servingTip = tip.text.trim();
  return out;
}

export interface ApplyOptions extends TranslationOptions {
  /**
   * The I-numbers the prompt asked for (`planTranslation(...).lines`). When the answer has exactly
   * that many I-items but under other numbers (an assistant that renumbered 1..n), they are mapped
   * in order; otherwise by number.
   */
  lineNumbers?: number[];
}

export interface ApplyResult {
  lines: Line[];
  /** How many lines were changed (raw, note or prep in `to`). */
  changed: number;
  /** How many answered items were left out because that text already existed in `to` (the status line says so). */
  skipped: number;
}

/**
 * Writes an answer into the ingredient lines in language `to` (A-bis.2): `raw.{to}` for unresolved
 * lines and headers, `note.{to}` and `prep.{to}` for resolved lines. Existing text in `to` is never
 * overwritten and resolved lines never get a `raw.{to}` (the dictionary renders them). Returns a new
 * array; untouched lines are the same objects. The name, description, serving tip and steps are the
 * caller's (they are plain texts; steps are positional like before).
 */
export function applyTranslationAnswer(lines: readonly Line[], answer: TranslationAnswer, to: Lang, opts: ApplyOptions = {}): ApplyResult {
  const isResolved = opts.isResolved ?? isResolvedDefault;
  let byNumber = answer.lineByNumber;
  const asked = opts.lineNumbers;
  if (asked && asked.length > 0 && answer.lines.length === asked.length && !asked.every((n) => byNumber[n] !== undefined)) {
    byNumber = {};
    asked.forEach((n, i) => {
      byNumber[n] = answer.lines[i] as string;
    });
  }
  let changed = 0;
  let skipped = 0;
  const out = lines.map((line, i) => {
    const n = i + 1;
    let next: Line | null = null;
    const resolved = line.kind !== 'header' && isResolved(line, i);
    const rawText = byNumber[n];
    if (!resolved && rawText) {
      if (!hasLang(line.raw, to)) next = { ...line, raw: { ...line.raw, [to]: rawText } };
      else skipped++;
    }
    if (resolved) {
      const note = answer.notes[n];
      if (note && line.note) {
        if (!hasLang(line.note, to)) next = { ...(next ?? line), note: { ...line.note, [to]: note } };
        else skipped++;
      }
      const prep = answer.preps[n];
      if (prep && line.prep) {
        if (!hasLang(line.prep, to)) next = { ...(next ?? line), prep: { ...line.prep, [to]: prep } };
        else skipped++;
      }
    }
    if (next) changed++;
    return next ?? line;
  });
  return { lines: out, changed, skipped };
}

/**
 * The answered steps by step number (A-bis.2): `stepByNumber` when the answer uses the numbers the
 * prompt asked for; when it has exactly as many S-items as were asked but under other numbers (an
 * assistant that renumbered 1..n), they are mapped onto `asked` in order.
 */
export function answeredSteps(answer: TranslationAnswer, asked: readonly number[]): Record<number, string> {
  if (asked.length > 0 && answer.steps.length === asked.length && !asked.every((n) => answer.stepByNumber[n] !== undefined)) {
    const out: Record<number, string> = {};
    asked.forEach((n, i) => {
      out[n] = answer.steps[i] as string;
    });
    return out;
  }
  return answer.stepByNumber;
}
