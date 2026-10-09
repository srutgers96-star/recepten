// Voice-command grammar for cook mode (docs/phase-5-spec.md Block B; phase 6 block 6A.8 adds
// repeat / ingredients / timeLeft). Framework-free: no preact, no dexie; runs in Node (tests) and
// in the browser. `parseVoiceCommand` turns a speech-recognition transcript — often a whole
// sentence with filler words and punctuation — into a command, matching whole words only
// ("stopcontact" is not "stop", "opnieuw" never matches inside another word). `pickSpoken` is
// `pickText` (src/domain/model.ts) with the language the text is actually in made explicit, so
// speechSynthesis picks a fitting voice.
import type { Lang, Text } from './model.ts';

export type VoiceCommand =
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'read' }
  /** Say the last thing the app read aloud once more ("herhaal", "wat zeg je?", "say that again"). */
  | { kind: 'repeat' }
  /** Read the (scaled) ingredient list ("ingrediënten", "boodschappen", "ingredients"). */
  | { kind: 'ingredients' }
  /** Speak the remaining time of this recipe's running timer(s) ("hoe lang nog", "how long left"). */
  | { kind: 'timeLeft' }
  | { kind: 'stop' }
  | { kind: 'timer'; minutes: number };

/** Timer durations are clamped to this range (minutes). */
export const TIMER_MIN_MINUTES = 1;
export const TIMER_MAX_MINUTES = 180;

// ---------------------------------------------------------------------------
// Tokenisation: lowercase, fold diacritics ("één" -> "een"), split digits from
// letters ("10min" -> "10 min"), then split on anything that is not [a-z0-9].
// Working on word tokens gives word-boundary matching for free.
// ---------------------------------------------------------------------------

function tokenize(transcript: string): string[] {
  const folded = transcript
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const spaced = folded.replace(/(\d)(?=[a-z])/g, '$1 ').replace(/([a-z])(?=\d)/g, '$1 ');
  return spaced.split(/[^a-z0-9]+/).filter((t) => t !== '');
}

// Number words 1-20 plus the common tens; both languages are always accepted (a
// recogniser set to one language can still return the other's number words).
const NUMBER_WORDS: Record<string, number> = {
  // Dutch
  een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17,
  achttien: 18, negentien: 19, twintig: 20, vijfentwintig: 25, dertig: 30, veertig: 40,
  vijfenveertig: 45, vijftig: 50, zestig: 60,
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

// "forty five" / "twenty five" (hyphens are split by tokenize): tens + ones.
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const EN_ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};

const MINUTE_WORDS = new Set(['minuut', 'minuten', 'minuutje', 'minuutjes', 'minute', 'minutes', 'min', 'mins']);
const HOUR_WORDS = new Set(['uur', 'uren', 'hour', 'hours']);
const SECOND_WORDS = new Set(['seconde', 'seconden', 'second', 'seconds', 'sec', 'secs']);

// Single-word "read the ingredient list" per language ("ingrediënten" folds to "ingredienten").
const INGREDIENT_WORDS: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['ingredienten', 'ingredient', 'ingredientenlijst', 'boodschappen', 'boodschappenlijst']),
  en: new Set(['ingredients', 'ingredient']),
};

// Single-word "say that again" per language. 'herhaal', 'nogmaals' (the everyday synonym of
// "opnieuw"), 'repeat' and 'pardon' are distinct enough to count anywhere. 'opnieuw' / 'again' and
// the Dutch "nog eens" / "nog een keer" are everyday recipe words ("bak nog eens 30 minuten",
// "bring back to the boil again") that kitchen talk — or the app's own read-aloud — says all the
// time, so like 'terug'/'back' (goWordBefore) they only count as the whole transcript ("Opnieuw.",
// "Nog eens?") or shortly after a say-/read-word ("zeg dat nog eens", "say that again"; "lees
// opnieuw voor" goes through readKindAt). 'wat'/'what'/'sorry' are only a command when they are the
// whole transcript ("Wat?") or part of a fixed phrase ("wat zeg je"), for the same reason.
const REPEAT_WORDS: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['herhaal', 'nogmaals', 'pardon']),
  en: new Set(['repeat', 'pardon']),
};
const GUARDED_REPEAT_WORDS: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['opnieuw']),
  en: new Set(['again']),
};
const SAY_WORDS: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['zeg', 'lees']),
  en: new Set(['say', 'read']),
};
const ALONE_REPEAT_WORDS: Record<Lang, ReadonlySet<string>> = {
  nl: new Set(['wat', 'sorry']),
  en: new Set(['what', 'sorry']),
};

// All command keywords of both languages: a duration scan stops at these so
// "timer stop" never reads "stop" as a number and falls through to the stop command.
// The repeat words are left out on purpose: "timer opnieuw 5 minuten" is a timer, not a repeat.
const COMMAND_WORDS = new Set([
  'volgende', 'next', 'vorige', 'terug', 'previous', 'back', 'stop', 'lees', 'voorlezen', 'read', 'timer',
  'ingredienten', 'ingredients', 'boodschappen',
]);

function clampMinutes(n: number): number {
  return Math.min(TIMER_MAX_MINUTES, Math.max(TIMER_MIN_MINUTES, Math.round(n)));
}

/**
 * 'terug'/'back' are everyday recipe words ("zet de pan terug", "bring back to the boil") that
 * kitchen talk — or the app's own read-aloud — says all the time, so they only count as a command
 * shortly after a go-word: "ga terug", "ga maar terug", "go back". 'vorige'/'previous' stay bare.
 */
function goWordBefore(tokens: string[], i: number, go: string): boolean {
  return tokens[i - 1] === go || tokens[i - 2] === go;
}

/**
 * A plain number at `i`: digits ("10"), a number word ("tien", "five"), or an
 * English tens+ones pair ("forty five"). Returns the value and the index of the
 * token after it, or null.
 */
function numberAt(tokens: string[], i: number): { value: number; next: number } | null {
  const tok = tokens[i];
  if (tok === undefined) return null;
  if (/^\d{1,4}$/.test(tok)) return { value: parseInt(tok, 10), next: i + 1 };
  const tens = EN_TENS[tok];
  if (tens !== undefined) {
    const after = tokens[i + 1];
    const ones = after === undefined ? undefined : EN_ONES[after];
    if (ones !== undefined) return { value: tens + ones, next: i + 2 };
  }
  const word = NUMBER_WORDS[tok];
  if (word !== undefined) return { value: word, next: i + 1 };
  return null;
}

/** Apply the unit word (if any) that follows a number: hours ×60, seconds rounded up to ≥1 minute. */
function applyUnit(value: number, unit: string | undefined): number {
  if (unit !== undefined && HOUR_WORDS.has(unit)) return value * 60;
  if (unit !== undefined && SECOND_WORDS.has(unit)) return Math.max(1, Math.ceil(value / 60));
  return value;
}

/**
 * Duration in minutes spoken after "timer": "10 minuten", "voor tien minuten",
 * "for five minutes", "2 uur", "een half uur", "half an hour", "an hour",
 * "kwartier", "quarter of an hour". Scans a small window, skipping filler words
 * ("voor", "van", "for", "the", …); stops at another command word. Null when no
 * clear duration is found.
 */
function durationAfter(tokens: string[], start: number): number | null {
  const end = Math.min(tokens.length, start + 6);
  for (let i = start; i < end; i++) {
    const tok = tokens[i];
    if (tok === undefined) break;
    if (COMMAND_WORDS.has(tok)) return null;
    if (tok === 'kwartier' || tok === 'quarter') return 15;
    if (tok === 'halfuur') return 30;
    if (tok === 'half' || tok === 'halve') {
      const n1 = tokens[i + 1];
      const n2 = tokens[i + 2];
      if (n1 !== undefined && HOUR_WORDS.has(n1)) return 30;
      if (n1 === 'an' && n2 !== undefined && HOUR_WORDS.has(n2)) return 30;
      continue; // "half" without an hour: filler
    }
    // Articles: "a"/"an" count as 1 only right before a unit ("an hour", "a minute");
    // "een"/"one" before "half" is the article of "een half uur", not the number 1.
    if (tok === 'a' || tok === 'an') {
      const n1 = tokens[i + 1];
      if (n1 !== undefined && HOUR_WORDS.has(n1)) return 60;
      if (n1 !== undefined && MINUTE_WORDS.has(n1)) return 1;
      continue;
    }
    // "een"/"one" before a special duration word is an article ("een half uur",
    // "een kwartier"), not the number 1.
    if (tok === 'een' || tok === 'one') {
      const n1 = tokens[i + 1];
      if (n1 === 'half' || n1 === 'halve' || n1 === 'halfuur' || n1 === 'kwartier' || n1 === 'quarter') {
        continue;
      }
    }
    const n = numberAt(tokens, i);
    if (n !== null) return applyUnit(n.value, tokens[n.next]);
    // anything else is filler ("voor", "van", "op", "for", "the", …)
  }
  return null;
}

/**
 * Duration spoken before "timer": "ten minute timer", "10 minuten timer",
 * "two hour timer". Walks back over unit words to a number. Null when none.
 */
function durationBefore(tokens: string[], timerIdx: number): number | null {
  // A number only counts with a unit word between it and "timer" ("ten minute
  // timer"), so the article in "zet een timer" / "set a timer" is never read as 1.
  let multiplier: number | null = null;
  const stop = Math.max(0, timerIdx - 3);
  for (let i = timerIdx - 1; i >= stop; i--) {
    const tok = tokens[i];
    if (tok === undefined) break;
    if (MINUTE_WORDS.has(tok)) {
      multiplier = 1;
      continue;
    }
    if (HOUR_WORDS.has(tok)) {
      multiplier = 60;
      continue;
    }
    if (multiplier === null) return null;
    if (/^\d{1,4}$/.test(tok)) return parseInt(tok, 10) * multiplier;
    const word = NUMBER_WORDS[tok];
    if (word !== undefined) {
      const before = i > 0 ? tokens[i - 1] : undefined;
      const tens = before === undefined ? undefined : EN_TENS[before];
      // "forty five minute timer": combine tens + ones
      if (tens !== undefined && EN_ONES[tok] !== undefined) return (tens + word) * multiplier;
      return word * multiplier;
    }
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 6 (6A.8): repeat / ingredients / timeLeft phrases
// ---------------------------------------------------------------------------

/**
 * Token length (2 or 3) of the Dutch "nog een keer" / "nog 'n keer" / "nog een keertje" / "nog
 * eens" starting at `i`, 0 when there is none. A bare "nog" is never a command ("nog vijf minuten").
 */
function nlAgainPhraseAt(tokens: string[], i: number): number {
  if (tokens[i] !== 'nog') return 0;
  const a = tokens[i + 1];
  const b = tokens[i + 2];
  if (a === 'eens') return 2;
  if ((a === 'een' || a === 'n' || a === '1') && (b === 'keer' || b === 'keertje')) return 3;
  return 0;
}

/** Token length of a guarded repeat word or phrase ('opnieuw', 'again', "nog eens", …) at `i`, 0 when none. */
function guardedRepeatAt(tokens: string[], i: number, lang: Lang): number {
  const tok = tokens[i];
  if (tok === undefined) return 0;
  if (GUARDED_REPEAT_WORDS[lang].has(tok)) return 1;
  return lang === 'nl' ? nlAgainPhraseAt(tokens, i) : 0;
}

/** A say-/read-word one or two tokens before `i` ("zeg dat nog eens", "say again"), cf. goWordBefore. */
function sayWordBefore(tokens: string[], i: number, lang: Lang): boolean {
  const a = tokens[i - 1];
  const b = tokens[i - 2];
  return (a !== undefined && SAY_WORDS[lang].has(a)) || (b !== undefined && SAY_WORDS[lang].has(b));
}

/**
 * A "say that again" word or phrase that starts at `i`. 'herhaal' / 'repeat' / … count anywhere;
 * 'opnieuw' / 'again' / "nog eens" / "nog een keer" only as the whole transcript or right after a
 * say-/read-word (they are ordinary recipe words otherwise); "wat zeg je" / "wat zei je" / "what
 * did you say" / "what was that" are fixed phrases; "wat?", "what?", "sorry?", "pardon?" count when
 * they are the whole transcript.
 */
function repeatAt(tokens: string[], i: number, lang: Lang): boolean {
  const tok = tokens[i];
  if (tok === undefined) return false;
  if (REPEAT_WORDS[lang].has(tok)) return true;
  if (tokens.length === 1 && ALONE_REPEAT_WORDS[lang].has(tok)) return true;
  const guarded = guardedRepeatAt(tokens, i, lang);
  if (guarded > 0 && ((i === 0 && tokens.length === guarded) || sayWordBefore(tokens, i, lang))) return true;
  if (lang === 'nl') {
    if (tok === 'wat' && (tokens[i + 1] === 'zeg' || tokens[i + 1] === 'zei')) return true;
  } else {
    const a = tokens[i + 1];
    const b = tokens[i + 2];
    if (tok === 'what' && a === 'did' && (b === 'you' || b === 'u')) return true;
    if (tok === 'what' && a === 'was' && b === 'that') return true;
  }
  return false;
}

/**
 * "How long is left" starting at `i`: NL "hoe lang nog", "hoelang nog", "hoeveel tijd (nog)",
 * "hoeveel minuten nog"; EN "how long left", "how long is left", "how long to go", "how much
 * time", "how much longer". A bare "hoe lang" / "how long" is a question about the recipe, not
 * about the timer, so it needs the "nog"/"left" part.
 */
function timeLeftAt(tokens: string[], i: number, lang: Lang): boolean {
  const tok = tokens[i];
  if (tok === undefined) return false;
  const within = (from: number, word: string, span: number): boolean => {
    for (let k = from; k < Math.min(tokens.length, from + span); k++) if (tokens[k] === word) return true;
    return false;
  };
  if (lang === 'nl') {
    if (tok === 'hoelang' && within(i + 1, 'nog', 3)) return true;
    if (tok === 'hoe' && tokens[i + 1] === 'lang' && within(i + 2, 'nog', 3)) return true;
    if (tok === 'hoeveel' && tokens[i + 1] === 'tijd') return true;
    if (tok === 'hoeveel' && tokens[i + 1] === 'minuten' && within(i + 2, 'nog', 2)) return true;
    return false;
  }
  if (tok === 'how' && tokens[i + 1] === 'long') {
    if (within(i + 2, 'left', 4)) return true;
    if (tokens[i + 2] === 'to' && tokens[i + 3] === 'go') return true;
    return false;
  }
  if (tok === 'how' && tokens[i + 1] === 'much' && (tokens[i + 2] === 'time' || tokens[i + 2] === 'longer')) return true;
  return false;
}

/**
 * The read-word ("lees", "voorlezen", "read") may be the start of "lees opnieuw voor" / "read
 * that again" (= repeat) or "lees de ingrediënten" / "read the ingredients" (= ingredients):
 * look a few tokens ahead before settling on a plain read.
 */
function readKindAt(tokens: string[], i: number, lang: Lang): 'read' | 'repeat' | 'ingredients' {
  const end = Math.min(tokens.length, i + 4);
  for (let k = i + 1; k < end; k++) {
    const tok = tokens[k];
    if (tok === undefined) break;
    if (REPEAT_WORDS[lang].has(tok) || guardedRepeatAt(tokens, k, lang) > 0) return 'repeat';
    if (INGREDIENT_WORDS[lang].has(tok)) return 'ingredients';
    if (COMMAND_WORDS.has(tok)) break; // "read the next step": a plain read
  }
  return 'read';
}

/**
 * Parse a recognition transcript ("volgende", "ga maar terug", "timer 10 minuten",
 * "set a timer for five minutes", "wat zeg je?", "hoe lang nog") into a command.
 * Case-insensitive, tolerant of punctuation and filler words; matches whole words only. When a
 * transcript could hold several commands the first clear one wins. Null when nothing matches.
 */
export function parseVoiceCommand(transcript: string, lang: Lang): VoiceCommand | null {
  const tokens = tokenize(transcript);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === undefined) continue;
    // Multi-word questions first: "hoe lang nog" must not fall through on its "nog".
    if (timeLeftAt(tokens, i, lang)) return { kind: 'timeLeft' };
    if (repeatAt(tokens, i, lang)) return { kind: 'repeat' };
    if (INGREDIENT_WORDS[lang].has(tok)) return { kind: 'ingredients' };
    if (lang === 'nl') {
      if (tok === 'volgende') return { kind: 'next' };
      if (tok === 'vorige' || (tok === 'terug' && goWordBefore(tokens, i, 'ga'))) return { kind: 'prev' };
      if (tok === 'lees' || tok === 'voorlezen') return { kind: readKindAt(tokens, i, lang) };
    } else {
      if (tok === 'next') return { kind: 'next' };
      if (tok === 'previous' || (tok === 'back' && goWordBefore(tokens, i, 'go'))) return { kind: 'prev' };
      if (tok === 'read') return { kind: readKindAt(tokens, i, lang) };
    }
    if (tok === 'stop') return { kind: 'stop' };
    if (tok === 'timer') {
      const minutes = durationAfter(tokens, i + 1) ?? durationBefore(tokens, i);
      if (minutes !== null) return { kind: 'timer', minutes: clampMinutes(minutes) };
      // "timer" without a clear duration is not a command; keep scanning
      // so "de timer stop" still reaches "stop".
    }
  }
  return null;
}

/**
 * Text to speak plus the language it is actually in: the `pickText` fallback
 * (src/domain/model.ts) made explicit so speechSynthesis can pick a voice that
 * matches the text. Empty text -> { text: '', lang: prefer }.
 */
export function pickSpoken(t: Text | null | undefined, prefer: Lang): { text: string; lang: Lang } {
  if (t) {
    const own = t[prefer];
    if (typeof own === 'string' && own.trim() !== '') return { text: own, lang: prefer };
    const otherLang: Lang = prefer === 'nl' ? 'en' : 'nl';
    const other = t[otherLang];
    if (typeof other === 'string' && other.trim() !== '') return { text: other, lang: otherLang };
  }
  return { text: '', lang: prefer };
}
