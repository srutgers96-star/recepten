// The in-app handbook (docs/specs/handbook.md, block Z). Framework-free: no preact, no dexie, no
// i18n signal — runs in Node (tools/handbook-md.ts, tests) as well as in the app.
//
// Data: one file per topic, data/handbook/<nn>-<id>.json (§3). `normalizeHandbook` reads the raw
// JSON tolerantly into `HandbookSection[]` sorted by `order` (the strict checks live in
// tools/validate-data.ts `validateHandbook`); `searchHandbook` filters rows the same way the recipe
// search normalises terms (lower case, no diacritics: `queryTerms`); `handbookToMarkdown` renders
// docs/HANDLEIDING.md (nl) and docs/HANDBOOK.md (en).
//
// The only markup in the texts is `**bold**` around button and screen names.
import { normalizeKey } from './dictionary.ts';
import type { Lang } from './model.ts';

export type HandbookPlatform = 'all' | 'android' | 'ios';

/** A text that the handbook always has in both languages (missing → ''). */
export interface HandbookText {
  nl: string;
  en: string;
}

/** A list per language (steps, keywords). */
export interface HandbookList {
  nl: string[];
  en: string[];
}

export interface HandbookEntry {
  /** `<section id>.<kebab-case>`, e.g. 'recepten.zoeken'. */
  id: string;
  title: HandbookText;
  /** "Wat het doet" — 1–3 sentences. */
  what: HandbookText;
  /** "Waar je tikt" — numbered steps, one action per step. */
  where: HandbookList;
  /** "Wat je dan ziet" — 1–3 sentences. */
  see: HandbookText;
  /** "Goed om te weten" — optional (honest limits, platform differences). */
  know?: HandbookText;
  /** Route opened by "Open", without the '#', e.g. '/shopping'. */
  route?: string;
  platform: HandbookPlatform;
  keywords: HandbookList;
}

export interface HandbookSection {
  id: string;
  order: number;
  title: HandbookText;
  intro: HandbookText;
  entries: HandbookEntry[];
}

/** The fixed topics in their fixed order (§2); the validator checks the files against this list. */
export const HANDBOOK_SECTION_IDS: readonly string[] = [
  'eerste-keer',
  'recepten',
  'koken',
  'week-en-boodschappen',
  'delen-en-ontvangen',
  'woordenboek',
  'badges-xp',
  'instellingen-en-opslag',
  'iphone-vs-android',
  'hulp',
];

/**
 * The fixed labels of the handbook in both languages. They mirror the i18n keys `handbook.*`
 * (src/i18n/settings.ts; tests/handbook.test.ts keeps both equal): the Markdown tool runs in Node
 * without the i18n signal.
 */
export const HANDBOOK_LABELS: Readonly<Record<Lang, { title: string; intro: string; what: string; where: string; see: string; know: string; android: string; ios: string }>> = {
  nl: {
    title: 'Handleiding',
    intro: 'Alles wat de app kan, per onderwerp. Typ een woord om te zoeken.',
    what: 'Wat het doet',
    where: 'Waar je tikt',
    see: 'Wat je dan ziet',
    know: 'Goed om te weten',
    android: 'Android',
    ios: 'iPhone',
  },
  en: {
    title: 'Handbook',
    intro: 'Everything the app can do, by topic. Type a word to search.',
    what: 'What it does',
    where: 'Where you tap',
    see: 'What you then see',
    know: 'Good to know',
    android: 'Android',
    ios: 'iPhone',
  },
};

// --- Normalising (tolerant) -----------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function text(v: unknown): HandbookText {
  if (!isRecord(v)) return { nl: '', en: '' };
  return { nl: str(v['nl']), en: str(v['en']) };
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function list(v: unknown): HandbookList {
  if (!isRecord(v)) return { nl: [], en: [] };
  return { nl: strings(v['nl']), en: strings(v['en']) };
}

function hasAny(t: HandbookText): boolean {
  return t.nl !== '' || t.en !== '';
}

function normalizeEntry(raw: unknown): HandbookEntry | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id']);
  const title = text(raw['title']);
  if (!id || !hasAny(title)) return null;
  const entry: HandbookEntry = {
    id,
    title,
    what: text(raw['what']),
    where: list(raw['where']),
    see: text(raw['see']),
    platform: raw['platform'] === 'android' || raw['platform'] === 'ios' ? raw['platform'] : 'all',
    keywords: list(raw['keywords']),
  };
  const know = text(raw['know']);
  if (hasAny(know)) entry.know = know;
  const route = str(raw['route']);
  if (route.startsWith('/')) entry.route = route;
  return entry;
}

/**
 * Raw topic files (parsed JSON, any order) → sections sorted by `order` (then id). Anything that is
 * not a section with an id is skipped; entries without an id or title are skipped; missing texts
 * become '' and a missing platform 'all'. Never throws.
 */
export function normalizeHandbook(files: readonly unknown[]): HandbookSection[] {
  const out: HandbookSection[] = [];
  for (const raw of files) {
    if (!isRecord(raw)) continue;
    const id = str(raw['id']);
    if (!id) continue;
    const order = typeof raw['order'] === 'number' && Number.isFinite(raw['order']) ? raw['order'] : Number.MAX_SAFE_INTEGER;
    const entries = Array.isArray(raw['entries']) ? raw['entries'].map(normalizeEntry).filter((e): e is HandbookEntry => e !== null) : [];
    out.push({ id, order, title: text(raw['title']), intro: text(raw['intro']), entries });
  }
  return out.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// --- Search -----------------------------------------------------------------------------------

/** All searchable text of a row in one language, normalised (lower case, no diacritics). */
function haystack(e: HandbookEntry, lang: Lang): string {
  const parts = [e.title[lang], e.what[lang], e.see[lang], e.know?.[lang] ?? '', ...e.where[lang], ...e.keywords[lang]];
  return parts
    .filter(Boolean)
    .map((p) => normalizeKey(p.replace(/\*\*/g, '')))
    .join(' | ');
}

/**
 * The rows that match every term of `query` in `lang` (title, what, see, know, steps or keywords),
 * grouped per section in the original order; sections without a match are left out. An empty query
 * (no terms) returns the sections unchanged.
 */
export function searchHandbook(sections: readonly HandbookSection[], query: string, lang: Lang): HandbookSection[] {
  const terms = normalizeKey(query).split(' ').filter(Boolean);
  if (terms.length === 0) return sections.slice();
  const out: HandbookSection[] = [];
  for (const s of sections) {
    const entries = s.entries.filter((e) => {
      const hay = haystack(e, lang);
      return terms.every((term) => hay.includes(term));
    });
    if (entries.length > 0) out.push({ ...s, entries });
  }
  return out;
}

// --- Small text helpers (shared with the screen) -----------------------------------------------

/**
 * The first sentence of a text (up to and including the first . ! or ? that follows a non-space
 * character and is followed by a space or the end). A lone mark such as the "?" in "The ? button"
 * is a button name, not a sentence end.
 */
export function firstSentence(s: string): string {
  const m = /^.*?\S[.!?](?=\s|$)/s.exec(s);
  return (m ? m[0] : s).trim();
}

/** Split a text on `**…**` into plain and bold parts (odd indexes are bold). */
export function boldParts(s: string): string[] {
  return s.split('**');
}

// --- Markdown -----------------------------------------------------------------------------------

/** Anchor of a section in the Markdown (its id is already kebab-case). */
function anchor(id: string): string {
  return id.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}

/**
 * The handbook as one Markdown document in `lang`: title, one line of explanation, a table of
 * contents with anchors (topics only), per topic `##` with its intro, per row `###` with the four
 * headings and the steps numbered; a platform row gets "(Android)"/"(iPhone)" after its title and
 * a row with a route gets the route as `#/…` in brackets. Every row title appears exactly once as a
 * `###` heading.
 */
export function handbookToMarkdown(sections: readonly HandbookSection[], lang: Lang): string {
  const L = HANDBOOK_LABELS[lang];
  const lines: string[] = [];
  lines.push(`# ${L.title}`, '', L.intro, '');
  for (const s of sections) lines.push(`- [${s.title[lang]}](#${anchor(s.id)})`);
  lines.push('');
  for (const s of sections) {
    lines.push(`<a id="${anchor(s.id)}"></a>`, '', `## ${s.title[lang]}`, '');
    if (s.intro[lang]) lines.push(s.intro[lang], '');
    for (const e of s.entries) {
      const chip = e.platform === 'android' ? ` (${L.android})` : e.platform === 'ios' ? ` (${L.ios})` : '';
      lines.push(`### ${e.title[lang]}${chip}`, '');
      lines.push(`#### ${L.what}`, '', e.what[lang], '');
      lines.push(`#### ${L.where}`, '');
      e.where[lang].forEach((step, i) => lines.push(`${i + 1}. ${step}`));
      lines.push('');
      lines.push(`#### ${L.see}`, '', e.see[lang], '');
      if (e.know && e.know[lang]) lines.push(`#### ${L.know}`, '', e.know[lang], '');
      if (e.route) lines.push(`(\`#${e.route}\`)`, '');
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
