// The handbook (docs/specs/handbook.md §6, block Z): normalising, search, Markdown and the validator.
// Fixture tests run on their own; the "real data" block reads the ten files in data/handbook/
// (written by the four writers) and stays red until they are all there.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HANDBOOK_LABELS, HANDBOOK_SECTION_IDS, handbookToMarkdown, normalizeHandbook, searchHandbook, firstSentence, type HandbookSection } from '../src/domain/handbook';
import { settings } from '../src/i18n/settings';
import { readHandbook } from '../tools/handbook-md';
import { readHandbookFiles, readI18nValues, validateHandbook, type HandbookFile } from '../tools/validate-data';

const ROOT = join(__dirname, '..');

// --- Fixtures -----------------------------------------------------------------------------------

function entry(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    title: { nl: `Titel ${id}`, en: `Title ${id}` },
    what: { nl: 'Dit doet het. En nog meer.', en: 'This is what it does. And more.' },
    where: { nl: ['Tik onderaan op **Boodschappen**.'], en: ['Tap **Shopping** at the bottom.'] },
    see: { nl: 'Je ziet de lijst.', en: 'You see the list.' },
    route: '/shopping',
    platform: 'all',
    keywords: { nl: ['een', 'twee', 'drie'], en: ['one', 'two', 'three'] },
    ...over,
  };
}

function section(id: string, order: number, entries: Record<string, unknown>[]): Record<string, unknown> {
  return { id, order, title: { nl: `Onderwerp ${id}`, en: `Topic ${id}` }, intro: { nl: 'Inleiding.', en: 'Intro.' }, entries };
}

const FIXTURE: unknown[] = [
  // Deliberately out of order: normalizeHandbook sorts on `order`.
  section('week-en-boodschappen', 4, [
    entry('week-en-boodschappen.afvinken', {
      title: { nl: 'Afvinken', en: 'Tick items' },
      keywords: { nl: ['afvinken', 'vinkje', 'streep'], en: ['tick', 'done', 'cross off'] },
    }),
    entry('week-en-boodschappen.delen', {
      title: { nl: 'De lijst delen', en: 'Share the list' },
      what: { nl: 'Deel je lijst als QR of link.', en: 'Share your list as a QR code or link.' },
      platform: 'android',
    }),
  ]),
  section('recepten', 2, [
    entry('recepten.zoeken', {
      title: { nl: 'Een recept zoeken', en: 'Find a recipe' },
      what: { nl: 'Zoek op naam of ingrediënt.', en: 'Search by name or ingredient.' },
      route: '/recipes',
      know: { nl: 'Ook op **Recepten**.', en: 'Also on **Recipes**.' },
    }),
    entry('recepten.qr', { title: { nl: 'Een QR maken', en: 'Make a QR code' }, platform: 'ios' }),
  ]),
  'not a section',
  { order: 3 },
];

describe('normalizeHandbook', () => {
  const s = normalizeHandbook(FIXTURE);
  it('sorts by order and skips what is not a section', () => {
    expect(s.map((x) => x.id)).toEqual(['recepten', 'week-en-boodschappen']);
  });
  it('fills defaults tolerantly', () => {
    const raw = section('hulp', 10, [{ id: 'hulp.x', title: { nl: 'X' } }, { title: { nl: 'no id' } }]);
    const [h] = normalizeHandbook([raw]);
    expect(h!.entries).toHaveLength(1);
    const e = h!.entries[0]!;
    expect(e.platform).toBe('all');
    expect(e.title).toEqual({ nl: 'X', en: '' });
    expect(e.where).toEqual({ nl: [], en: [] });
    expect(e.know).toBeUndefined();
    expect(e.route).toBeUndefined();
  });
});

describe('searchHandbook', () => {
  const s = normalizeHandbook(FIXTURE);
  it('returns everything for an empty query', () => {
    expect(searchHandbook(s, '  ', 'nl')).toEqual(s);
  });
  it('finds "afvinken" (nl) and "tick" (en) in the shopping topic', () => {
    expect(searchHandbook(s, 'afvinken', 'nl').map((x) => x.id)).toEqual(['week-en-boodschappen']);
    expect(searchHandbook(s, 'tick', 'en')[0]!.entries.map((e) => e.id)).toEqual(['week-en-boodschappen.afvinken']);
  });
  it('is accent- and case-insensitive', () => {
    expect(searchHandbook(s, 'INGREDIENT', 'nl')[0]!.entries.map((e) => e.id)).toEqual(['recepten.zoeken']);
    expect(searchHandbook(s, 'ingrediënt', 'nl')[0]!.entries.map((e) => e.id)).toEqual(['recepten.zoeken']);
  });
  it('needs every term, only in the current language', () => {
    expect(searchHandbook(s, 'lijst link', 'nl')[0]!.entries.map((e) => e.id)).toEqual(['week-en-boodschappen.delen']);
    expect(searchHandbook(s, 'tick', 'nl')).toEqual([]);
  });
  it('gives nothing for nonsense', () => {
    expect(searchHandbook(s, 'xqzvw', 'nl')).toEqual([]);
  });
  it('keeps the order of topics and rows', () => {
    const r = searchHandbook(s, 'qr', 'nl');
    expect(r.map((x) => x.id)).toEqual(['recepten', 'week-en-boodschappen']);
    expect(r[0]!.entries.map((e) => e.id)).toEqual(['recepten.qr']);
  });
  it('searches steps, see and know as well', () => {
    expect(searchHandbook(s, 'boodschappen', 'nl').flatMap((x) => x.entries).length).toBe(4);
    expect(searchHandbook(s, 'ook op recepten', 'nl')[0]!.entries.map((e) => e.id)).toEqual(['recepten.zoeken']);
  });
});

describe('firstSentence', () => {
  it('cuts after the first sentence', () => {
    expect(firstSentence('Dit doet het. En nog meer.')).toBe('Dit doet het.');
    expect(firstSentence('Geen punt')).toBe('Geen punt');
  });
  it('does not cut at a lone ? that names a button', () => {
    expect(firstSentence('The ? button shows all commands. More.')).toBe('The ? button shows all commands.');
    expect(firstSentence('Zin in iets anders? Kies er een.')).toBe('Zin in iets anders?');
  });
});

describe('handbookToMarkdown', () => {
  const s = normalizeHandbook(FIXTURE);
  it('starts with the title and has every row title exactly once as a heading', () => {
    for (const lang of ['nl', 'en'] as const) {
      const md = handbookToMarkdown(s, lang);
      expect(md.startsWith(`# ${HANDBOOK_LABELS[lang].title}\n`)).toBe(true);
      for (const e of s.flatMap((x) => x.entries)) {
        const heading = new RegExp(`^### ${e.title[lang].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\(|$)`, 'gm');
        expect(md.match(heading)?.length ?? 0).toBe(1);
      }
    }
  });
  it('has a table of contents, the four headings, numbered steps, platform chips and the route', () => {
    const md = handbookToMarkdown(s, 'nl');
    expect(md).toContain('- [Onderwerp recepten](#recepten)');
    expect(md).toContain('<a id="recepten"></a>');
    expect(md).toContain('#### Wat het doet');
    expect(md).toContain('#### Waar je tikt');
    expect(md).toContain('#### Wat je dan ziet');
    expect(md).toContain('#### Goed om te weten');
    expect(md).toContain('1. Tik onderaan op **Boodschappen**.');
    expect(md).toContain('### De lijst delen (Android)');
    expect(md).toContain('### Een QR maken (iPhone)');
    expect(md).toContain('(`#/recipes`)');
  });
});

describe('labels', () => {
  it('HANDBOOK_LABELS mirrors the i18n keys', () => {
    for (const lang of ['nl', 'en'] as const) {
      const L = HANDBOOK_LABELS[lang];
      expect(L.title).toBe(settings['handbook.title']![lang]);
      expect(L.intro).toBe(settings['handbook.intro']![lang]);
      expect(L.what).toBe(settings['handbook.what']![lang]);
      expect(L.where).toBe(settings['handbook.where']![lang]);
      expect(L.see).toBe(settings['handbook.see']![lang]);
      expect(L.know).toBe(settings['handbook.know']![lang]);
      expect(L.android).toBe(settings['handbook.platform.android']![lang]);
      expect(L.ios).toBe(settings['handbook.platform.ios']![lang]);
    }
  });
});

// --- Validator ------------------------------------------------------------------------------------

function validFile(): HandbookFile {
  return { file: '02-recepten.json', data: section('recepten', 2, [entry('recepten.zoeken', { route: '/recipes' })]) };
}

function withEntry(over: Record<string, unknown>): HandbookFile {
  return { file: '02-recepten.json', data: section('recepten', 2, [entry('recepten.zoeken', over)]) };
}

describe('validateHandbook', () => {
  it('accepts a valid file', () => {
    const r = validateHandbook([validFile()]);
    expect(r.errors).toEqual([]);
    expect(r.stats).toEqual({ recipes: 1, lines: 1 });
  });
  it('jargon → error (both languages; "sheet" as a word)', () => {
    expect(validateHandbook([withEntry({ see: { nl: 'De service worker ververst.', en: 'It refreshes.' } })]).errors.join('\n')).toMatch(/service worker/);
    expect(validateHandbook([withEntry({ what: { nl: 'Ok.', en: 'Open the sheet.' } })]).errors.join('\n')).toMatch(/"sheet"/);
    expect(validateHandbook([withEntry({ what: { nl: 'Ok.', en: 'A deeltoken.' } })]).errors.join('\n')).toMatch(/"token"/);
    expect(validateHandbook([withEntry({ what: { nl: 'Ok.', en: 'Sheetpan dinner.' } })]).errors).toEqual([]);
  });
  it('missing English → error', () => {
    expect(validateHandbook([withEntry({ title: { nl: 'Zoeken' } })]).errors.join('\n')).toMatch(/title\.en is missing/);
    expect(validateHandbook([withEntry({ know: { nl: 'Alleen NL.', en: '' } })]).errors.join('\n')).toMatch(/know\.en/);
  });
  it('route outside the list → error', () => {
    expect(validateHandbook([withEntry({ route: '/recipe/b:soep' })]).errors.join('\n')).toMatch(/"route"/);
    expect(validateHandbook([withEntry({ route: '/more/calendar' })]).errors).toEqual([]);
  });
  it('unequal number of steps → error', () => {
    const r = validateHandbook([withEntry({ where: { nl: ['Een.', 'Twee.'], en: ['One.'] } })]);
    expect(r.errors.join('\n')).toMatch(/2 step\(s\) in nl and 1 in en/);
  });
  it('steps and keywords outside their ranges, a bad platform, a bad id → error', () => {
    expect(validateHandbook([withEntry({ where: { nl: [], en: [] } })]).errors.join('\n')).toMatch(/1–8 expected/);
    expect(validateHandbook([withEntry({ keywords: { nl: ['a', 'b'], en: ['a', 'b', 'c'] } })]).errors.join('\n')).toMatch(/3–8 expected/);
    expect(validateHandbook([withEntry({ platform: 'windows' })]).errors.join('\n')).toMatch(/platform/);
    const badId = { file: '02-recepten.json', data: section('recepten', 2, [entry('koken.zoeken')]) };
    expect(validateHandbook([badId]).errors.join('\n')).toMatch(/"id" must be "recepten\./);
  });
  it('duplicate ids over files, duplicate order and a wrong file name → error', () => {
    const a = validFile();
    const b = { file: '03-koken.json', data: section('koken', 2, [entry('recepten.zoeken')]) };
    const errs = validateHandbook([a, b]).errors.join('\n');
    expect(errs).toMatch(/"order" must be 3/);
    expect(errs).toMatch(/"order" 2 is also used/);
    expect(errs).toMatch(/duplicate id/);
    expect(validateHandbook([{ ...validFile(), file: 'recepten.json' }]).errors.join('\n')).toMatch(/file name must be 02-recepten\.json/);
    expect(validateHandbook([{ file: '11-x.json', data: section('extra', 11, [entry('extra.a')]) }]).errors.join('\n')).toMatch(/ten topics/);
  });
  it('a bold name that is not in the UI texts → warning (not an error)', () => {
    const i18n = { nl: ['Boodschappen', 'Recepten'], en: ['Shopping', 'Recipes'] };
    expect(validateHandbook([validFile()], i18n).warnings).toEqual([]);
    const r = validateHandbook([withEntry({ where: { nl: ['Tik op **Bestaat Niet**.'], en: ['Tap **Shopping**.'] } })], i18n);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/"Bestaat Niet"/);
  });
  it('reads the i18n values of src/i18n', () => {
    const v = readI18nValues(ROOT);
    expect(v.nl).toContain('Handleiding');
    expect(v.en).toContain('Search the handbook');
    expect(v.nl).toContain("Niets gevonden voor '{q}'. Probeer een ander woord.");
  });
});

// --- Real data (the ten files of the writers) ---------------------------------------------------

describe('the real handbook (data/handbook)', () => {
  const sections: HandbookSection[] = readHandbook(ROOT);
  const rows = sections.flatMap((s) => s.entries);

  it('has the ten topics in their fixed order and at least 70 rows', () => {
    expect(sections.map((s) => s.id)).toEqual(HANDBOOK_SECTION_IDS);
    expect(sections.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rows.length).toBeGreaterThanOrEqual(70);
  });

  it('every row is complete in both languages with an equal number of steps', () => {
    const incomplete = rows.filter(
      (e) =>
        !e.title.nl || !e.title.en || !e.what.nl || !e.what.en || !e.see.nl || !e.see.en ||
        e.where.nl.length === 0 || e.where.nl.length !== e.where.en.length,
    );
    expect(incomplete.map((e) => e.id)).toEqual([]);
  });

  it('passes the validator without errors', () => {
    const { files, parseErrors } = readHandbookFiles(ROOT);
    expect(parseErrors).toEqual([]);
    expect(validateHandbook(files).errors).toEqual([]);
  });

  it('search finds "afvinken" and "tick" in the shopping topic', () => {
    expect(searchHandbook(sections, 'afvinken', 'nl').map((s) => s.id)).toContain('week-en-boodschappen');
    expect(searchHandbook(sections, 'tick', 'en').map((s) => s.id)).toContain('week-en-boodschappen');
  });

  it('search is accent-insensitive and keeps the topic order', () => {
    const r = searchHandbook(sections, 'ingredient', 'nl');
    expect(r.length).toBeGreaterThan(0);
    const order = r.map((s) => s.order);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(searchHandbook(sections, 'xqzvwplof', 'nl')).toEqual([]);
  });

  it('the Markdown starts with the title and has every row title exactly once as a heading', () => {
    for (const lang of ['nl', 'en'] as const) {
      const md = handbookToMarkdown(sections, lang);
      expect(md.startsWith(`# ${HANDBOOK_LABELS[lang].title}\n`)).toBe(true);
      const headings = md.split('\n').filter((l) => l.startsWith('### '));
      for (const e of rows) {
        const h = `### ${e.title[lang]}`;
        expect(headings.filter((l) => l === h || l.startsWith(`${h} (`)).length, `${lang} ${e.id}`).toBe(1);
      }
    }
  });
});
