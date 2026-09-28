// Durations in step text (docs/phase-1-spec.md §1), Dutch and English. Framework-free.
//
//   "25-30 minuten" -> {min: 25, max: 30, unit: 'min'}      "ca. 5 min" -> {min: 5, unit: 'min'}
//   "een kwartier"  -> {min: 15, unit: 'min'}                "1½ uur"    -> {min: 1.5, unit: 'hour'}
//   "10 minutes"    -> {min: 10, unit: 'min'}                "an hour"   -> {min: 1, unit: 'hour'}
//
// "minuten" without a number ("nog enkele minuten") is a noun, not a timer, and is ignored.
import type { Lang, TimerSpec } from './model.ts';

type Unit = TimerSpec['unit'];

const NUM = String.raw`(?:\d+(?:[.,]\d+)?(?:\s?[½¼¾])?|[½¼¾])`;
const SEP = String.raw`(?:\s*[-–—]\s*|\s+(?:tot|à|of|to|or)\s+)`;
// Only the abbreviations may carry a period ("5 min."); "20 minutes." keeps its full stop outside.
const UNIT = String.raw`(minuten|minuut|minutes?|mins?\.?|seconden|seconde|seconds?|secs?\.?|uur|uren|uurtje|hours?|hrs?\.?)`;
// Group 1 = the character before the number (so "12 minuten" is never read as "2 minuten").
const NUMERIC_RE = new RegExp(String.raw`(^|[^\d.,½¼¾])(${NUM})(?:${SEP}(${NUM}))?\s*${UNIT}(?!\p{L})`, 'giu');

const WORD_NUMBERS: Record<string, number> = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  elf: 11, twaalf: 12, vijftien: 15, twintig: 20, dertig: 30, veertig: 40, vijfenveertig: 45, zestig: 60,
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60,
};
const WORD_NUM = Object.keys(WORD_NUMBERS).join('|');

interface WordRule {
  re: RegExp;
  make: (m: RegExpExecArray) => { min: number; max?: number; unit: Unit };
}

// Longest phrases first: "an hour and a half" must win over "an hour".
const WORD_RULES: WordRule[] = [
  { re: /an\s+hour\s+and\s+a\s+half/giu, make: () => ({ min: 1.5, unit: 'hour' }) },
  { re: /a\s+quarter\s+of\s+an\s+hour/giu, make: () => ({ min: 15, unit: 'min' }) },
  { re: /half\s+an\s+hour/giu, make: () => ({ min: 30, unit: 'min' }) },
  { re: /anderhalf\s+uur(?:tje)?/giu, make: () => ({ min: 1.5, unit: 'hour' }) },
  { re: /(?:een\s+)?half\s+uur(?:tje)?/giu, make: () => ({ min: 30, unit: 'min' }) },
  { re: /drie\s+kwartier/giu, make: () => ({ min: 45, unit: 'min' }) },
  { re: /(?:een\s+|1\s+)?kwartier(?:tje)?/giu, make: () => ({ min: 15, unit: 'min' }) },
  {
    re: new RegExp(String.raw`(${WORD_NUM})\s+(uur|uren|uurtje|hours?)(?!\p{L})`, 'giu'),
    make: (m) => ({ min: WORD_NUMBERS[(m[1] as string).toLowerCase()] as number, unit: 'hour' }),
  },
  {
    re: new RegExp(String.raw`(${WORD_NUM})\s+(minuten|minuut|minutes?)(?!\p{L})`, 'giu'),
    make: (m) => ({ min: WORD_NUMBERS[(m[1] as string).toLowerCase()] as number, unit: 'min' }),
  },
  {
    re: new RegExp(String.raw`(${WORD_NUM})\s+(seconden|seconde|seconds?)(?!\p{L})`, 'giu'),
    make: (m) => ({ min: WORD_NUMBERS[(m[1] as string).toLowerCase()] as number, unit: 'sec' }),
  },
];

interface Found {
  index: number;
  end: number;
  spec: TimerSpec;
}

function parseNumber(s: string): number {
  const t = s.replace(',', '.').replace(/\s+/g, '');
  let n = 0;
  const digits = /^\d+(?:\.\d+)?/.exec(t);
  if (digits) n = parseFloat(digits[0]);
  if (t.includes('½')) n += 0.5;
  else if (t.includes('¼')) n += 0.25;
  else if (t.includes('¾')) n += 0.75;
  return n;
}

function unitOf(word: string): Unit {
  const w = word.toLowerCase();
  if (w.startsWith('sec')) return 'sec';
  if (w.startsWith('min')) return 'min';
  return 'hour';
}

/** Every duration in the text, in order of appearance. */
export function findTimers(text: string): TimerSpec[] {
  const found: Found[] = [];
  if (!text) return [];

  NUMERIC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMERIC_RE.exec(text)) !== null) {
    const prefix = m[1] as string;
    const index = m.index + prefix.length;
    const end = m.index + m[0].length;
    const min = parseNumber(m[2] as string);
    const max = m[3] ? parseNumber(m[3]) : undefined;
    if (!(min > 0)) continue;
    const spec: TimerSpec = { min, unit: unitOf(m[4] as string), label: text.slice(index, end) };
    if (max !== undefined && max > min) spec.max = max;
    found.push({ index, end, spec });
  }

  for (const rule of WORD_RULES) {
    rule.re.lastIndex = 0;
    let w: RegExpExecArray | null;
    while ((w = rule.re.exec(text)) !== null) {
      // A word phrase must stand on its own ("een uur", not "steen uur").
      const before = text.charAt(w.index - 1);
      if (before && /\p{L}/u.test(before)) continue;
      const { min, max, unit } = rule.make(w);
      const spec: TimerSpec = { min, unit, label: w[0] };
      if (max !== undefined) spec.max = max;
      found.push({ index: w.index, end: w.index + w[0].length, spec });
    }
  }

  // Earliest first; a match that overlaps an earlier (or longer) one is dropped.
  found.sort((a, b) => a.index - b.index || b.end - a.end);
  const out: TimerSpec[] = [];
  let lastEnd = -1;
  for (const f of found) {
    if (f.index < lastEnd) continue;
    out.push(f.spec);
    lastEnd = f.end;
  }
  return out;
}

const UNIT_LABEL: Record<Lang, Record<Unit, string>> = {
  nl: { sec: 'sec', min: 'min', hour: 'uur' },
  en: { sec: 'sec', min: 'min', hour: 'h' },
};

function formatNumber(n: number, lang: Lang): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  const wholeText = whole === 0 ? '' : String(whole);
  if (Math.abs(frac) < 1e-9) return String(whole);
  if (Math.abs(frac - 0.5) < 1e-9) return wholeText + '½';
  if (Math.abs(frac - 0.25) < 1e-9) return wholeText + '¼';
  if (Math.abs(frac - 0.75) < 1e-9) return wholeText + '¾';
  const s = n.toFixed(1);
  return lang === 'nl' ? s.replace('.', ',') : s;
}

/** "25-30 min", "1½ uur" / "1½ h", "30 sec". */
export function formatTimer(t: TimerSpec, lang: Lang): string {
  const l = lang === 'en' ? 'en' : 'nl';
  const range = t.max !== undefined && t.max > t.min ? `${formatNumber(t.min, l)}-${formatNumber(t.max, l)}` : formatNumber(t.min, l);
  return `${range} ${UNIT_LABEL[l][t.unit]}`;
}

const UNIT_MS: Record<Unit, number> = { sec: 1000, min: 60_000, hour: 3_600_000 };

/** Duration in milliseconds; a range uses its maximum. */
export function timerMs(t: TimerSpec): number {
  const value = t.max !== undefined && t.max > t.min ? t.max : t.min;
  return Math.round(value * UNIT_MS[t.unit]);
}
