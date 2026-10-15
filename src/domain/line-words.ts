// Words of an unrecognised ingredient name (docs/phase-6-spec.md 6A.16). Framework-free.
//
//   "2 sneetjes knapperig stokbrood of brood [voor erbij]"
//   -> words:     knapperig · stokbrood · (of) brood
//   -> suggested: stokbrood  (the largest word window the dictionary knows = the fewest words to tap away)
//   -> query "stokbrood", note "knapperig"
//   -> "Koppel zo": ing 'stokbrood', prep "knapperig, voor erbij" — the raw line is never touched
//
// The editor shows the words of the name part, and of an "of …" / "or …" alternative, as buttons:
// the green words are the ingredient to look up, the grey words become a note. `wordsToQuery`
// builds both, in the order of the line. The result is a line correction on top of the parsed
// line (`applyWordLink` for a line, `wordLinkOverride` for a classic's LineOverride): `ing` plus
// the grey words as `prep` (the only text field a LineOverride has). The raw line stays as typed
// (CLAUDE.md invariant 2); re-parsing re-reads `raw`.
import type { Dictionary, Ingredient } from './dictionary.ts';
import { hasLang, pickText, type Lang, type Line, type Text } from './model.ts';

export type WordRole = 'name' | 'alt';

export interface Word {
  /** The word as written in the line. */
  text: string;
  /** 'name' = from the name part; 'alt' = from an alternative ("of brood"). */
  role: WordRole;
  /** Alt words: index of the alternative in `line.alt`. */
  alt?: number;
  /** First word of an alternative: the connector that goes in front of it in a note ("of", "or", "en/of"). */
  lead?: string;
  /**
   * Alt words of an alternative the parser already resolved (`alt.ing`): the structured line keeps
   * rendering it as "(of brood)", so these words never go into the note when they are not selected.
   */
  structured?: boolean;
}

/** What "Koppel zo" / "Variant van …" hands to the caller: the ingredient plus the words that were tapped away. */
export interface WordLink {
  /** Dictionary id of the ingredient the green words resolved to. */
  ing: string;
  /** The green words as one string ("stokbrood"). */
  query: string;
  /** The grey words in line order ("knapperig", "knapperig, of 3 dikke broodjes"); '' when every word is green. */
  note: string;
  /** Language the line (and so the note) is written in. */
  lang: Lang;
}

/** `partialMatch`: the known part of a name the dictionary does not know as a whole. */
export interface PartialMatch {
  words: Word[];
  selected: Set<number>;
  query: string;
  note: string;
  found: Ingredient;
}

function otherLang(lang: Lang): Lang {
  return lang === 'nl' ? 'en' : 'nl';
}

/** The language a line is written in: Dutch when present, else English (the parser's own rule). */
export function lineLang(line: Pick<Line, 'raw'>): Lang {
  return line.raw?.nl ? 'nl' : 'en';
}

/** Whitespace-separated words of a text, with one role (no alternatives). */
export function wordsFromText(text: string, role: WordRole = 'name'): Word[] {
  return (text ?? '')
    .split(/\s+/u)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => ({ text: w, role }));
}

/**
 * The connector of an alternative as it reads in a note: the one written in the line when it
 * can be found ("of", "or", "en/of", "and/or"), else the language default.
 */
function connectorOf(raw: string, altMode: Line['altMode'], lang: Lang): string {
  if (altMode === 'and-or') {
    const m = /\b(en\/of|and\/or)\b/iu.exec(raw);
    return m ? (m[1] as string).toLowerCase() : lang === 'nl' ? 'en/of' : 'and/or';
  }
  if (/\bof\b/iu.test(raw)) return 'of';
  if (/\bor\b/iu.test(raw)) return 'or';
  return lang === 'nl' ? 'of' : 'or';
}

/**
 * The words of a line's name part, followed by the words of each alternative (role 'alt', the
 * first one carrying the connector as `lead`). A line without a parsed name falls back to its raw
 * text, so there is always something to tap (better too much than too little).
 */
export function splitNameWords(line: Line, lang: Lang = lineLang(line)): Word[] {
  if (line.kind === 'header') return [];
  const raw = pickText(line.raw, lang);
  const name = (line.name ?? '').trim();
  const out: Word[] = wordsFromText(name || raw, 'name');
  const alts = line.alt ?? [];
  alts.forEach((alt, i) => {
    const text = (pickText(alt.raw, lang) || alt.name || '').trim();
    const words = wordsFromText(text, 'alt');
    if (!words.length) return;
    const structured = !!alt.ing;
    words.forEach((w, k) => {
      w.alt = i;
      if (structured) w.structured = true;
      if (k === 0) w.lead = connectorOf(raw, line.altMode, lang);
    });
    out.push(...words);
  });
  return out;
}

/**
 * The selected words as the ingredient name to look up, the rest as a note, both in the order of
 * the line. Unselected words of the name part form one note segment; the unselected words of an
 * alternative form another, led by its connector ("of brood"); an alternative the parser already
 * resolved is left out of the note (the line keeps rendering it). Segments are joined with ", ".
 */
export function wordsToQuery(words: readonly Word[], selected: ReadonlySet<number>): { query: string; note: string } {
  const query = words
    .filter((_, i) => selected.has(i))
    .map((w) => w.text)
    .join(' ');
  // The connector of each alternative, whether or not its first word is selected.
  const leads = new Map<string, string>();
  for (const w of words) if (w.alt !== undefined && w.lead && !leads.has(`alt${w.alt}`)) leads.set(`alt${w.alt}`, w.lead);
  const segments = new Map<string, string[]>();
  words.forEach((w, i) => {
    if (selected.has(i) || w.structured) return;
    const key = w.alt === undefined ? 'name' : `alt${w.alt}`;
    if (!segments.has(key)) segments.set(key, []);
    (segments.get(key) as string[]).push(w.text);
  });
  const note = [...segments.entries()].map(([key, ws]) => [leads.get(key) ?? '', ...ws].filter(Boolean).join(' ')).join(', ');
  return { query, note };
}

/** Index groups of consecutive words that belong together: the name part, then each alternative. */
function wordGroups(words: readonly Word[]): number[][] {
  const groups = new Map<string, number[]>();
  words.forEach((w, i) => {
    const key = w.alt === undefined ? 'name' : `alt${w.alt}`;
    if (!groups.has(key)) groups.set(key, []);
    (groups.get(key) as number[]).push(i);
  });
  return [...groups.values()];
}

/**
 * The words to preselect: the largest window of consecutive words (within the name part, else
 * within an alternative) that the dictionary recognises as an ingredient — "stokbrood" in
 * "knapperig stokbrood", "Parmezaanse kaas" in "lekkere Parmezaanse kaas" — so as few words as
 * possible are tapped away. Between windows of the same size the scan order decides: Dutch goes
 * left to right (when both words are products, "kip kerrie" is the chicken), English right to
 * left (the head noun comes last: "lemon chicken" is chicken). Every word when nothing matches.
 */
export function suggestSelection(words: readonly Word[], dict: Dictionary, lang: Lang = 'nl'): Set<number> {
  const all = new Set(words.map((_, i) => i));
  if (!words.length) return all;
  const groups = wordGroups(words);
  const longest = Math.max(...groups.map((g) => g.length));
  for (let size = longest; size >= 1; size--) {
    for (const group of groups) {
      if (group.length < size) continue;
      const starts: number[] = [];
      for (let s = 0; s + size <= group.length; s++) starts.push(s);
      if (lang === 'en') starts.reverse();
      for (const s of starts) {
        const idx = group.slice(s, s + size);
        const text = idx.map((i) => (words[i] as Word).text).join(' ');
        if (dict.ingredientByName(text, lang)) return new Set(idx);
      }
    }
  }
  return all;
}

/** `wordsToQuery` plus the dictionary entry the query resolves to (undefined when unknown or empty). */
export function lookupWords(words: readonly Word[], selected: ReadonlySet<number>, dict: Dictionary, lang: Lang): { query: string; note: string; found: Ingredient | undefined } {
  const { query, note } = wordsToQuery(words, selected);
  const found = query ? dict.ingredientByName(query, lang) : undefined;
  return { query, note, found };
}

/** The `WordLink` for a selection, or undefined when the green words resolve to nothing. */
export function wordLinkFor(words: readonly Word[], selected: ReadonlySet<number>, dict: Dictionary, lang: Lang): WordLink | undefined {
  const { query, note, found } = lookupWords(words, selected, dict, lang);
  return found ? { ing: found.id, query, note, lang } : undefined;
}

/**
 * For the "Koppel" button (6A.16): a name the dictionary knows a PART of but not the whole
 * ("knapperig stokbrood" -> stokbrood). Undefined when the whole name resolves (nothing to ask)
 * or when nothing in it does (straight to the search).
 */
export function partialMatch(text: string, dict: Dictionary, lang: Lang): PartialMatch | undefined {
  const words = wordsFromText(text);
  if (words.length < 2) return undefined;
  const selected = suggestSelection(words, dict, lang);
  if (selected.size >= words.length) return undefined;
  const { query, note, found } = lookupWords(words, selected, dict, lang);
  return found ? { words, selected, query, note, found } : undefined;
}

/** ", "-separated segments of a note, trimmed, without empties. */
function segmentsOf(text: string | undefined): string[] {
  return (text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `note` in front of `own`, as one ", "-separated text; a segment already present in `own` is not repeated. */
function joinNote(note: string, own: string | undefined): string {
  const ownSegs = segmentsOf(own);
  const seen = new Set(ownSegs.map((s) => s.toLowerCase()));
  const fresh = segmentsOf(note).filter((s) => !seen.has(s.toLowerCase()));
  return [...fresh, ...ownSegs].join(', ');
}

/**
 * The prep of a line after a word link: the grey words in front of the line's own prep
 * ("knapperig" + "voor erbij" -> "knapperig, voor erbij"). The line's language is always complete;
 * the other language only when every part is known in it (the note via `dict.noteFor`, the own
 * prep as stored) — never half translated (phase-5 A-bis.1). An empty note keeps the prep as it is.
 */
export function linkedPrep(line: Pick<Line, 'prep'>, note: string, lang: Lang, dict: Dictionary): Text | null | undefined {
  const n = note.trim();
  if (!n) return line.prep;
  const noteText = dict.noteFor(n, lang);
  const own = line.prep ?? null;
  const other = otherLang(lang);
  const ownLang = own && hasLang(own, lang) ? (own[lang] as string) : '';
  const ownOther = own && hasLang(own, other) ? (own[other] as string) : undefined;
  const out: Text = {};
  out[lang] = joinNote(noteText[lang] ?? n, ownLang);
  const noteOther = noteText[other];
  if (noteOther) {
    // The other side is complete when the own prep has that language too, or has no text in
    // the line's language that would go missing from it.
    if (ownOther !== undefined || !ownLang) out[other] = joinNote(noteOther, ownOther ?? '');
  } else if (ownOther !== undefined && !ownLang) {
    // A prep that exists only in the other language (typed in the chips, A-bis.1) is kept as it is
    // rather than lost: the raw text never had it.
    out[other] = ownOther;
  }
  return out;
}

/**
 * The corrected line of an own recipe (or an edit row): `ing` and confidence 1, the grey words
 * merged into `prep`, everything else — the raw text above all — as it was.
 */
export function applyWordLink(line: Line, link: WordLink, dict: Dictionary): Line {
  const out: Line = { ...line, ing: link.ing, confidence: 1 };
  const prep = linkedPrep(line, link.note, link.lang, dict);
  if (prep !== undefined) out.prep = prep;
  return out;
}

/**
 * The LineOverride fields of a word link on a classic's line (`setLineOverride({ recipeId, index,
 * ...wordLinkOverride(line, link, dict) })`): `ing`, plus `prep` when there are grey words.
 */
export function wordLinkOverride(line: Line, link: WordLink, dict: Dictionary): { ing: string; prep?: Text } {
  const out: { ing: string; prep?: Text } = { ing: link.ing };
  if (link.note.trim()) {
    const prep = linkedPrep(line, link.note, link.lang, dict);
    if (prep) out.prep = prep;
  }
  return out;
}
