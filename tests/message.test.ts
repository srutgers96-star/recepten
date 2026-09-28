// WhatsApp share message (PLAN.md §7 "Het bericht (exact)").
import { describe, it, expect } from 'vitest';
import { buildShareMessage, APP_NAME } from '../src/domain/message';
import { extractTokens } from '../src/domain/token';

const TOKEN = 'eJx9kU1v2zAMhu_5FYQvAbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const URL = `https://stijn.github.io/recepten/#r=${TOKEN}`;

describe('buildShareMessage', () => {
  it('produces the exact Dutch message from the plan', () => {
    const msg = buildShareMessage({
      nameNl: 'Afwasmachinezalm',
      nameEn: 'Dishwasher salmon',
      servings: 4,
      ingredientCount: 10,
      by: 'Stijn',
      url: URL,
      lang: 'nl',
    });
    expect(msg).toBe(
      '\u{1F372} Afwasmachinezalm · Dishwasher salmon\n' +
        '4 pers · 10 ingrediënten · van Stijn\n' +
        "Open in Rutgers' Recepten (of tik voor een voorproefje / or tap to preview):\n" +
        URL,
    );
  });

  it('produces the English variant', () => {
    const msg = buildShareMessage({
      nameNl: 'Afwasmachinezalm',
      nameEn: 'Dishwasher salmon',
      servings: 4,
      ingredientCount: 10,
      by: 'Emma',
      url: URL,
      lang: 'en',
    });
    expect(msg).toBe(
      '\u{1F372} Afwasmachinezalm · Dishwasher salmon\n' +
        '4 servings · 10 ingredients · from Emma\n' +
        "Open in Rutgers' Recipes (or tap to preview / of tik voor een voorproefje):\n" +
        URL,
    );
    expect(APP_NAME.en).toBe("Rutgers' Recipes");
  });

  it('omits the English name when missing or identical', () => {
    const base = { servings: 4, ingredientCount: 3, by: 'Stijn', url: URL, lang: 'nl' as const };
    expect(buildShareMessage({ ...base, nameNl: 'Dahl' }).split('\n')[0]).toBe('\u{1F372} Dahl');
    expect(buildShareMessage({ ...base, nameNl: 'Dahl', nameEn: '' }).split('\n')[0]).toBe('\u{1F372} Dahl');
    expect(buildShareMessage({ ...base, nameNl: 'Pizza', nameEn: 'pizza' }).split('\n')[0]).toBe('\u{1F372} Pizza');
    expect(buildShareMessage({ ...base, nameNl: '', nameEn: 'Toad in the hole' }).split('\n')[0]).toBe(
      '\u{1F372} Toad in the hole',
    );
  });

  it('omits servings and sender when absent, and uses singular forms', () => {
    const nl = buildShareMessage({ nameNl: 'Ei', ingredientCount: 1, by: '', url: URL, lang: 'nl' });
    expect(nl.split('\n')[1]).toBe('1 ingrediënt');
    const en = buildShareMessage({ nameNl: 'Ei', nameEn: 'Egg', servings: 1, ingredientCount: 1, by: ' Emma ', url: URL, lang: 'en' });
    expect(en.split('\n')[1]).toBe('1 serving · 1 ingredient · from Emma');
    expect(buildShareMessage({ nameNl: 'Ei', servings: 0, ingredientCount: 0, by: 'X', url: URL, lang: 'nl' }).split('\n')[1]).toBe(
      '0 ingrediënten · van X',
    );
  });

  it('puts the URL alone on the last of four lines, so WhatsApp renders one tappable link', () => {
    const msg = buildShareMessage({ nameNl: 'Dahl', ingredientCount: 8, by: 'Stijn', url: ` ${URL}\n`, lang: 'nl' });
    const lines = msg.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe(URL);
    expect(msg.slice(URL.length * -1)).toBe(URL);
    expect(extractTokens(msg)).toEqual([{ key: 'r', token: TOKEN }]);
  });
});
