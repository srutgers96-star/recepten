// Instruction text <-> cooking steps (docs/phase-1-spec.md §1). Framework-free.
//
// splitSteps: blank lines are the author's step boundaries. A paragraph longer than ~350 characters
// is split further at sentence boundaries, grouped so that a step starts at a cooking verb where
// possible; a step is never shorter than ~40 characters (short tails join the previous step).
// joinSteps is the inverse (blank-line separated), used by the editor's "paste whole method" box.

/** A paragraph longer than this is split at sentence boundaries. */
export const MAX_STEP_CHARS = 350;
/** A step shorter than this joins its neighbour. */
export const MIN_STEP_CHARS = 40;
/** Inside a long paragraph a new step may start at a cooking verb once the current one is this long. */
const VERB_BREAK_CHARS = 120;

/** Abbreviations that never end a sentence, whatever follows. */
const NEVER_END = new Set(['ca', 'evt', 'bijv', 'bv', 'o.a', 'zgn', 'incl', 'excl', 'ong', 'ongev', 'approx', 'e.g', 'i.e', 'etc']);
/** Units that end a sentence only when the next word starts with a capital ("Laat 5 min. Roer …"). */
const UNIT_END = new Set(['min', 'ml', 'el', 'tl', 'dl', 'cl', 'sec', 'gr', 'kg', 'ltr', 'st', 'mp', '°c', 'c', 'uur']);

/** Imperative cooking verbs a step ideally starts with (NL from the spec, plus common EN). */
const COOKING_VERBS = new Set(
  [
    'kook', 'bak', 'verhit', 'voeg', 'meng', 'roer', 'laat', 'serveer', 'snijd', 'snij', 'schep', 'giet',
    'breng', 'doe', 'zet', 'verwarm', 'fruit', 'smoor', 'stoof', 'pureer', 'klop', 'bestrooi', 'leg',
    'verdeel', 'dek', 'haal', 'was', 'schil', 'rasp', 'hak', 'pers', 'braad', 'grill', 'gril', 'rooster',
    'blancheer', 'marineer', 'bestrijk', 'vet', 'vul', 'strooi', 'neem', 'maak', 'warm', 'gratineer',
    'cook', 'boil', 'fry', 'heat', 'add', 'mix', 'stir', 'let', 'serve', 'cut', 'slice', 'chop', 'pour',
    'bring', 'put', 'place', 'preheat', 'season', 'sprinkle', 'cover', 'remove', 'simmer', 'blend',
    'whisk', 'divide', 'drain', 'melt', 'roast', 'bake', 'grate', 'peel', 'wash', 'take', 'make',
  ],
);

/** Split instruction text into steps. Never returns empty strings; returns [] for empty input. */
export function splitSteps(instructions: string): string[] {
  const text = (instructions ?? '').replace(/\r\n?/g, '\n');
  const paragraphs = text
    .split(/\n[ \t]*\n/)
    .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join('\n'))
    .filter(Boolean);

  // Each entry remembers whether it came from a paragraph break (joined with '\n' when merged)
  // or from a sentence split (joined with ' ').
  const parts: Array<{ text: string; para: boolean }> = [];
  for (const p of paragraphs) {
    if (p.length <= MAX_STEP_CHARS) {
      parts.push({ text: p, para: true });
      continue;
    }
    const chunks = groupSentences(splitSentences(p));
    chunks.forEach((c, i) => parts.push({ text: c, para: i === 0 }));
  }

  // Short tails join the previous step; a short first step joins the next one.
  const out: Array<{ text: string; para: boolean }> = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev && (part.text.length < MIN_STEP_CHARS || prev.text.length < MIN_STEP_CHARS)) {
      prev.text = prev.text + (part.para ? '\n' : ' ') + part.text;
    } else {
      out.push({ ...part });
    }
  }
  return out.map((p) => p.text);
}

/** Inverse of splitSteps: blank-line separated. */
export function joinSteps(steps: string[]): string {
  return steps
    .map((s) => (s ?? '').replace(/\r\n?/g, '\n').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** First word of a sentence, lowercased, without punctuation ("Kook," -> "kook"). */
function firstWord(sentence: string): string {
  const m = /^[^\p{L}]*(\p{L}+)/u.exec(sentence);
  return m ? (m[1] as string).toLowerCase() : '';
}

export function startsWithCookingVerb(sentence: string): boolean {
  return COOKING_VERBS.has(firstWord(sentence));
}

/**
 * Sentences of a paragraph. A boundary is `.`, `!` or `?` followed by whitespace, unless the word
 * before it is an abbreviation that never ends a sentence, or a unit abbreviation followed by a
 * lowercase word or a digit. Decimals ("1.5 kg") are not followed by whitespace, so they never match.
 */
export function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?]+(?=\s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraph)) !== null) {
    const end = m.index + m[0].length;
    const before = paragraph.slice(start, m.index);
    const wordMatch = /(\S+)$/.exec(before);
    const word = wordMatch ? (wordMatch[1] as string).toLowerCase().replace(/^[^\p{L}°]+/u, '') : '';
    const after = paragraph.slice(end).trimStart();
    const nextIsCapital = /^[\p{Lu}0-9"'(]/u.test(after) && !/^[0-9]/.test(after);
    if (m[0] === '.' && word !== '') {
      if (NEVER_END.has(word)) continue;
      if (UNIT_END.has(word) && !nextIsCapital) continue;
      // A single letter before the period ("o.") is part of a spaced abbreviation.
      if (word.length === 1 && !nextIsCapital) continue;
    }
    const sentence = paragraph.slice(start, end).trim();
    if (sentence) out.push(sentence);
    start = end;
  }
  const tail = paragraph.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/** Group sentences into steps: start a new step at a cooking verb once the current one is long
 * enough, and always before the step would exceed MAX_STEP_CHARS. */
function groupSentences(sentences: string[]): string[] {
  const steps: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (!current) {
      current = s;
      continue;
    }
    const wouldExceed = current.length + 1 + s.length > MAX_STEP_CHARS;
    const verbBreak = current.length >= VERB_BREAK_CHARS && startsWithCookingVerb(s);
    if (wouldExceed || verbBreak) {
      steps.push(current);
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current) steps.push(current);
  return steps;
}
