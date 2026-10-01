// Voice-command grammar for cook mode (docs/phase-5-spec.md Block B). Framework-free: no preact,
// no dexie; runs in Node (tests) and in the browser. `parseVoiceCommand` turns a speech-recognition
// transcript — often a whole sentence with filler words and punctuation — into a command, matching
// whole words only ("stopcontact" is not "stop"). `pickSpoken` is `pickText` (src/domain/model.ts)
// with the language the text is actually in made explicit, so speechSynthesis picks a fitting voice.
import type { Lang, Text } from './model.ts';

export type VoiceCommand =
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'read' }
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

// All command keywords of both languages: a duration scan stops at these so
// "timer stop" never reads "stop" as a number and falls through to the stop command.
const COMMAND_WORDS = new Set([
  'volgende', 'next', 'vorige', 'terug', 'previous', 'back', 'stop', 'lees', 'voorlezen', 'read', 'timer',
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

/**
 * Parse a recognition transcript ("volgende", "ga maar terug", "timer 10 minuten",
 * "set a timer for five minutes") into a command. Case-insensitive, tolerant of
 * punctuation and filler words; matches whole words only. When a transcript could
 * hold several commands the first clear one wins. Null when nothing matches.
 */
export function parseVoiceCommand(transcript: string, lang: Lang): VoiceCommand | null {
  const tokens = tokenize(transcript);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === undefined) continue;
    if (lang === 'nl') {
      if (tok === 'volgende') return { kind: 'next' };
      if (tok === 'vorige' || (tok === 'terug' && goWordBefore(tokens, i, 'ga'))) return { kind: 'prev' };
      if (tok === 'lees' || tok === 'voorlezen') return { kind: 'read' };
    } else {
      if (tok === 'next') return { kind: 'next' };
      if (tok === 'previous' || (tok === 'back' && goWordBefore(tokens, i, 'go'))) return { kind: 'prev' };
      if (tok === 'read') return { kind: 'read' };
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
