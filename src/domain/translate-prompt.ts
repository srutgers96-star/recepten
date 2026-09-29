// "Kopieer voor vertaling" / "Plak vertaling" (docs/phase-2-spec.md §5 "Language pair"). Framework-free.
//
// The LLM never runs in the app: the editor puts a fixed, numbered prompt on the clipboard, the
// person pastes it into ChatGPT/Claude, and pastes the numbered answer back. Numbering is the
// contract that lets the answer be mapped onto the other language's fields without guessing:
//
//   1. <name>
//   I1. <ingredient line>   … In.
//   S1. <step>              … Sn.
//
// `parseTranslationAnswer` is tolerant: markdown bold/bullets around the markers, "I1:" or "I1)"
// instead of "I1.", chatter before/after the list, a missing name, and continuation lines (a step
// that spans several lines joins the previous item). Missing numbers are filled in order of
// appearance, so "I1, I2, I4" yields three lines (the caller compares counts and refuses a
// mismatch for steps).
import type { Lang, Text } from './model.ts';

const LANG_NAME: Record<Lang, string> = { nl: 'Dutch', en: 'British English' };

/** The part of a recipe the prompt needs: any object with `name`, `lines[].raw` and `steps[].text`. */
export interface TranslatableRecipe {
  name: Text;
  lines: { raw: Text; kind?: string }[];
  steps: { text: Text }[];
}

export interface TranslationAnswer {
  /** The translated name, when the answer had a "1." line. */
  name?: string;
  /** Ingredient lines in order (I1..In). */
  lines: string[];
  /** Steps in order (S1..Sn). */
  steps: string[];
}

function text(t: Text | null | undefined, lang: Lang): string {
  const s = t?.[lang];
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

/**
 * The numbered prompt for an external AI: instructions (always in English, every assistant reads
 * that) + the name, the ingredient lines and the steps in `from`. Header lines ("Dressing:")
 * are numbered like any other line so the indexes stay aligned with the editor rows.
 */
export function buildTranslationPrompt(recipe: TranslatableRecipe, from: Lang, to: Lang): string {
  const lines = recipe.lines.map((l) => text(l.raw, from));
  const steps = recipe.steps.map((s) => text(s.text, from));
  const head = [
    `Translate this recipe from ${LANG_NAME[from]} to ${LANG_NAME[to]}.`,
    'Rules:',
    `- Answer ONLY with the numbered list below, translated, keeping every marker exactly (1., I1., I2., S1., S2., …). No introduction, no notes.`,
    '- Keep every quantity, unit and temperature exactly as written (metric, °C). Do not convert or round.',
    to === 'en'
      ? '- Use British cooking English: tbsp, tsp, tin, clove, bunch, sprig, courgette, aubergine, coriander. Keep the tone of the original; one step stays one step.'
      : '- Use natural Dutch cooking language: el, tl, blik, teentje, bosje, takje. Keep the tone of the original; one step stays one step.',
    '- A line that is only a heading ending in ":" (like "Dressing:") stays a heading. Text in [brackets] or (parentheses) keeps its brackets.',
    '- If a line is empty, answer with the marker only.',
    '',
    `1. ${text(recipe.name, from)}`,
  ];
  const body = [...lines.map((l, i) => `I${i + 1}. ${l}`), ...steps.map((s, i) => `S${i + 1}. ${s}`)];
  return [...head, ...body].join('\n') + '\n';
}

/** Marker at the start of a line: "I3.", "**S2:**", "- I1)", "1." (name). */
const MARKER_RE = /^[\s*_\-•>#]*(?:(1)\s*[.:)]|([IS])\s?(\d{1,3})\s*[.:)\]-]?)\**\s*(.*)$/iu;
/** Section headers some assistants add anyway: "Ingredients:" / "Method:" / "Ingrediënten" / "Bereiding". */
const SECTION_RE = /^[\s*_#]*(ingredients?|ingredi[eë]nten|method|steps?|instructions|bereiding|stappen)\s*:?\**\s*$/iu;

interface Item {
  kind: 'name' | 'line' | 'step';
  index: number;
  text: string;
}

/**
 * Parses the numbered answer back. Items are ordered by their marker number (missing numbers
 * keep the order of appearance); lines without a marker join the previous item, chatter before
 * the first marker is ignored.
 */
export function parseTranslationAnswer(answer: string): TranslationAnswer {
  const items: Item[] = [];
  let current: Item | null = null;
  let section: 'line' | 'step' | null = null;
  let autoIndex = 0;
  for (const rawLine of (answer ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\s+$/u, '');
    if (line.trim() === '') {
      // A blank line ends a continuation: the next unmarked line is not glued on.
      current = null;
      continue;
    }
    const sec = SECTION_RE.exec(line);
    if (sec) {
      section = /^(ingredi)/iu.test(sec[1] as string) ? 'line' : 'step';
      current = null;
      autoIndex = 0;
      continue;
    }
    const m = MARKER_RE.exec(line);
    if (m && (m[1] !== undefined || m[2] !== undefined)) {
      const body = (m[4] ?? '').replace(/\*+$/u, '').trim();
      if (m[1] !== undefined && m[2] === undefined) {
        // "1." at the start is the name — but only once; later "1." lines are plain numbering.
        if (!items.some((it) => it.kind === 'name') && section === null) {
          current = { kind: 'name', index: 0, text: body };
          items.push(current);
          continue;
        }
        if (section) {
          autoIndex = 1;
          current = { kind: section, index: 1, text: body };
          items.push(current);
          continue;
        }
      }
      if (m[2] !== undefined) {
        const kind = (m[2] as string).toUpperCase() === 'I' ? 'line' : 'step';
        current = { kind, index: Number(m[3]), text: body };
        items.push(current);
        continue;
      }
    }
    // Plain numbered list inside a section ("2. Fry the onions"): the number is positional.
    const plain = /^[\s*\-•]*(\d{1,3})\s*[.:)]\s+(.*)$/u.exec(line);
    if (plain && section) {
      autoIndex = Number(plain[1]);
      current = { kind: section, index: autoIndex, text: (plain[2] ?? '').trim() };
      items.push(current);
      continue;
    }
    // Unmarked line: inside a section a bullet (or the first line) starts a new item, anything
    // else continues the current one.
    const bullet = /^[-*•]\s+/u.test(line.trim());
    if (section && (bullet || !current)) {
      autoIndex += 1;
      current = { kind: section, index: autoIndex, text: line.trim().replace(/^[-*•]\s+/u, '') };
      items.push(current);
    } else if (current) {
      current.text = current.text ? `${current.text}\n${line.trim()}` : line.trim();
    }
  }

  const ordered = (kind: 'line' | 'step'): string[] =>
    items
      .filter((it) => it.kind === kind)
      .map((it, order) => ({ it, order }))
      .sort((a, b) => a.it.index - b.it.index || a.order - b.order)
      .map(({ it }) => it.text.trim());

  const out: TranslationAnswer = { lines: ordered('line'), steps: ordered('step') };
  const name = items.find((it) => it.kind === 'name');
  if (name && name.text.trim()) out.name = name.text.trim();
  return out;
}
