// Level titles (docs/specs/xp-levels.md §2d, test plan §6a): the shipped data/levels.json, the
// normalizer, titleFor/noteFor and the validator in tools/validate-data.ts.
import { describe, expect, it } from 'vitest';
import levelsJson from '../data/levels.json';
import { MAX_LEVEL, normalizeLevels, noteFor, titleFor } from '../src/domain/levels';
import { validateLevels } from '../tools/validate-data';

describe('data/levels.json', () => {
  const levels = normalizeLevels(levelsJson);

  it('has 100 contiguous levels with non-empty titles, unique per language', () => {
    expect(MAX_LEVEL).toBe(100);
    expect(levelsJson).toHaveLength(100);
    expect(levelsJson.map((l) => l.level)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    for (const lang of ['nl', 'en'] as const) {
      const titles = levelsJson.map((l) => l[lang].title);
      for (const t of titles) expect(t.trim()).not.toBe('');
      expect(new Set(titles).size).toBe(100);
    }
    // Normalizing the shipped file changes nothing.
    expect(levels.map((l) => l.nl.title)).toEqual(levelsJson.map((l) => l.nl.title));
    expect(levels.map((l) => l.en.title)).toEqual(levelsJson.map((l) => l.en.title));
  });

  it('pins the fixed titles and notes', () => {
    expect(titleFor(1, 'nl')).toBe('Keukenpiep');
    expect(titleFor(1, 'en')).toBe('Kitchen Chick');
    expect(titleFor(2, 'nl')).toBe('T-rex');
    expect(titleFor(2, 'en')).toBe('T-rex');
    // Stijn, 28 Oct 2026: Grandma cooks better than level 6, so she moved up to 39.
    expect(titleFor(6, 'nl')).toBe('Tosti-tovenaar');
    expect(titleFor(6, 'en')).toBe('Toastie wizard');
    expect(titleFor(39, 'nl')).toBe('Oma');
    expect(titleFor(39, 'en')).toBe('Grandma');
    expect(titleFor(100, 'nl')).toBe('Best Chef of the Universe');
    expect(titleFor(100, 'en')).toBe('Best Chef of the Universe');
    expect(noteFor(2, 'nl')).toBe('Te korte armpjes: kan nog niet bij het fornuis.');
    expect(noteFor(2, 'en')).toBe('Arms too short to reach the hob.');
    expect(noteFor(100, 'en')).toBe('Maximum level. There is nothing above this.');
    expect(noteFor(3, 'nl')).toBeNull();
    const withNotes = levelsJson.filter((l) => 'note' in l.nl || 'note' in l.en).map((l) => l.level);
    expect(withNotes).toEqual([2, 6, 39, 61, 72, 81, 100]); // 39 = Oma since 28 Oct 2026
  });

  it('passes the validator', () => {
    const result = validateLevels(levelsJson);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('normalizeLevels / titleFor', () => {
  it('fills missing levels with "Level N"', () => {
    const empty = normalizeLevels([]);
    expect(empty).toHaveLength(100);
    empty.forEach((l, i) => {
      expect(l.level).toBe(i + 1);
      expect(l.nl).toEqual({ title: `Level ${i + 1}` });
      expect(l.en).toEqual({ title: `Level ${i + 1}` });
    });
    expect(normalizeLevels('rubbish')).toEqual(empty);
    expect(normalizeLevels(null)).toEqual(empty);
  });

  it('keeps valid items and repairs broken ones', () => {
    const out = normalizeLevels([
      { level: 3, nl: { title: 'Drie' }, en: { title: '' } },
      { level: 3, nl: { title: 'Tweede drie' }, en: { title: 'Second three' } },
      { level: 101, nl: { title: 'Te hoog' }, en: { title: 'Too high' } },
      { level: 4.5, nl: { title: 'Half' }, en: { title: 'Half' } },
      'x',
      { level: 5, nl: { title: 'Vijf', note: 'Grap' }, en: { title: 'Five', note: '  ' } },
    ]);
    expect(out[2]).toEqual({ level: 3, nl: { title: 'Drie' }, en: { title: 'Level 3' } });
    expect(out[4]).toEqual({ level: 5, nl: { title: 'Vijf', note: 'Grap' }, en: { title: 'Five' } });
    expect(out[3]!.nl.title).toBe('Level 4');
  });

  it('never throws for levels outside 1…100', () => {
    expect(titleFor(101, 'nl')).toBe('Level 101');
    expect(titleFor(101, 'en')).toBe('Level 101');
    expect(titleFor(0, 'en')).toBe('Level 0');
    expect(titleFor(-1, 'nl')).toBe('Level -1');
    expect(titleFor(2.5, 'nl')).toBe('Level 2.5');
    expect(noteFor(101, 'nl')).toBeNull();
    expect(titleFor(7, 'en', [])).toBe('Level 7');
  });
});

describe('validateLevels', () => {
  const good = (): Array<Record<string, unknown>> => JSON.parse(JSON.stringify(levelsJson)) as Array<Record<string, unknown>>;

  it('rejects a non-array and a wrong count', () => {
    expect(validateLevels({}).errors).toHaveLength(1);
    expect(validateLevels(good().slice(0, 99)).errors.join('\n')).toMatch(/exactly 100/);
  });

  it('rejects gaps, empty and duplicate titles, empty notes', () => {
    const data = good();
    data[4]!['level'] = 6;
    (data[10]!['nl'] as Record<string, unknown>)['title'] = ' ';
    (data[11]!['en'] as Record<string, unknown>)['title'] = 'Kitchen Chick';
    (data[12]!['nl'] as Record<string, unknown>)['note'] = '';
    data[13]!['en'] = 'Stir-fryer';
    const errors = validateLevels(data).errors.join('\n');
    expect(errors).toMatch(/levels\.json\[4\]: "level" must be 5/);
    expect(errors).toMatch(/level 11: "nl\.title" must be a non-empty string/);
    expect(errors).toMatch(/level 12: "en\.title" "Kitchen Chick" is also the title of level 1/);
    expect(errors).toMatch(/level 13: "nl\.note" must be a non-empty string/);
    expect(errors).toMatch(/level 14: "en" must be/);
  });

  it('warns about stray keys', () => {
    const data = good();
    data[0]!['icon'] = '🐣';
    expect(validateLevels(data).warnings).toHaveLength(1);
    expect(validateLevels(data).errors).toEqual([]);
  });
});
