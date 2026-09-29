// rawFromLine / seedQty (src/components/line-raw.ts): the editor's chip round trip must never
// alter a quantity (docs/phase-2-spec.md §1/§6 "quantities never altered"). The inline editor
// seeds its amount from the stored qty and its unit select from the stored unit, and writing the
// line back keeps "½ l" as "½ l" (not "500 ml") and "1 dl" as "1 dl" in English (not "100 ml").
import { describe, expect, it } from 'vitest';
import { rawFromLine, seedQty } from '../src/components/line-raw';
import type { Lang, Line } from '../src/domain/model';
import { parseLine, parseQty } from '../src/domain/parser';
import { renderLine } from '../src/domain/render';
import { testDictionary } from './fixtures/test-dictionary';

const dict = testDictionary();
const nl = (raw: string) => parseLine(raw, dict, 'nl');

/** What EditScreen.applyChipEdit does when the editor is applied without touching anything. */
function applyUntouched(line: Line, lang: Lang): string {
  const text = seedQty(line, lang);
  const m = text ? parseQty(text, lang) : null;
  const edited: Line = { ...line, qty: m ? m.qty : null, unit: line.unit ?? null };
  return rawFromLine(edited, dict, lang);
}

describe('seedQty', () => {
  it('is the stored quantity, not the display conversion', () => {
    expect(seedQty(nl('½ l kippenbouillon'), 'nl')).toBe('½');
    expect(seedQty(nl('½ l kippenbouillon'), 'en')).toBe('½');
    expect(seedQty(nl('2½ dl kippenbouillon'), 'en')).toBe('2½');
    expect(seedQty(nl('ca. 400 g aardappelen'), 'en')).toBe('approx. 400');
    expect(seedQty(nl('2-3 uien'), 'nl')).toBe('2-3');
    expect(seedQty(nl('zout'), 'nl')).toBe('');
  });

  it('parses back to the same quantity in both languages', () => {
    for (const raw of ['½ l kippenbouillon', '1 dl kippenbouillon', '2½ dl kippenbouillon', '1,5 kg aardappelen', 'ca. 400 g aardappelen']) {
      const line = nl(raw);
      for (const lang of ['nl', 'en'] as const) {
        const m = parseQty(seedQty(line, lang), lang);
        expect(m?.qty, `${raw} / ${lang}`).toEqual(line.qty);
      }
    }
  });
});

describe('rawFromLine', () => {
  it('writes the quantity and unit as stored, never re-united', () => {
    expect(rawFromLine(nl('½ l kippenbouillon'), dict, 'nl')).toBe('½ l kippenbouillon');
    expect(rawFromLine(nl('½ l kippenbouillon'), dict, 'en')).toBe('½ l chicken stock');
    expect(rawFromLine(nl('1 dl kippenbouillon'), dict, 'nl')).toBe('1 dl kippenbouillon');
    expect(rawFromLine(nl('1 dl kippenbouillon'), dict, 'en')).toBe('1 dl chicken stock');
    expect(rawFromLine(nl('½ kg aardappelen'), dict, 'nl')).toBe('½ kg aardappelen');
    // The display still converts: the raw text and the rendering are different things.
    expect(renderLine(nl('½ l kippenbouillon'), dict, 'nl')).toBe('500 ml kippenbouillon');
    expect(renderLine(nl('1 dl kippenbouillon'), dict, 'en')).toBe('100 ml chicken stock');
  });

  it('keeps prep, notes and "naar smaak" in the app notation', () => {
    expect(rawFromLine(nl('2 el olijfolie [voor het bakken]'), dict, 'nl')).toBe('2 el olijfolie [voor het bakken]');
    expect(rawFromLine(nl('1 rode ui [gesnipperd]'), dict, 'en')).toBe('1 red onion [finely diced]');
    expect(rawFromLine(nl('zout en peper naar smaak'), dict, 'nl')).toBe('zout en peper naar smaak');
  });

  it('applying the untouched chip editor is a no-op for dl and l lines in both languages', () => {
    const cases: Array<[string, string, string]> = [
      ['½ l kippenbouillon', '½ l kippenbouillon', '½ l chicken stock'],
      ['1 dl kippenbouillon', '1 dl kippenbouillon', '1 dl chicken stock'],
      ['2½ dl kippenbouillon', '2½ dl kippenbouillon', '2½ dl chicken stock'],
      ['¼ l kippenbouillon', '¼ l kippenbouillon', '¼ l chicken stock'],
    ];
    for (const [raw, expectNl, expectEn] of cases) {
      const line = nl(raw);
      expect(applyUntouched(line, 'nl'), raw).toBe(expectNl);
      expect(applyUntouched(line, 'en'), raw).toBe(expectEn);
      // And the rewritten Dutch text parses to the same structure again.
      const again = nl(applyUntouched(line, 'nl'));
      expect(again.qty).toEqual(line.qty);
      expect(again.unit).toBe(line.unit);
      expect(again.ing).toBe(line.ing);
    }
  });
});
