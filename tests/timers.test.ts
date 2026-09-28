// findTimers / formatTimer / timerMs (docs/phase-1-spec.md §1).
import { describe, expect, it } from 'vitest';
import { findTimers, formatTimer, timerMs } from '../src/domain/timers';

function specs(text: string) {
  return findTimers(text).map(({ min, max, unit }) => (max === undefined ? { min, unit } : { min, max, unit }));
}

describe('findTimers (Dutch)', () => {
  it('finds the phrases from the spec', () => {
    expect(specs('Bak in het midden van de oven 25-30 minuten op 200 °C')).toEqual([{ min: 25, max: 30, unit: 'min' }]);
    expect(specs('Kook de aardappelen in ca. 5 min bijna gaar')).toEqual([{ min: 5, unit: 'min' }]);
    expect(specs('Laat het in ongeveer een kwartier inkoken')).toEqual([{ min: 15, unit: 'min' }]);
    expect(specs('Laat een half uur rusten')).toEqual([{ min: 30, unit: 'min' }]);
    expect(specs('Laat drie kwartier sudderen')).toEqual([{ min: 45, unit: 'min' }]);
    expect(specs('Laat 1 uur in de koelkast opstijven')).toEqual([{ min: 1, unit: 'hour' }]);
    expect(specs('laat het gerecht nog 1½ uur sudderen')).toEqual([{ min: 1.5, unit: 'hour' }]);
    expect(specs('laat 30 seconden zacht koken')).toEqual([{ min: 30, unit: 'sec' }]);
  });

  it('understands ranges with tot, à, en dash and mixed fractions', () => {
    expect(specs('5 tot 10 minuten')).toEqual([{ min: 5, max: 10, unit: 'min' }]);
    expect(specs('5 à 6 minuten')).toEqual([{ min: 5, max: 6, unit: 'min' }]);
    expect(specs('laat 10–15 minuten sudderen')).toEqual([{ min: 10, max: 15, unit: 'min' }]);
    expect(specs('in 2 ½ tot 3 uur gaar')).toEqual([{ min: 2.5, max: 3, unit: 'hour' }]);
    expect(specs('Laat 24 uur marineren')).toEqual([{ min: 24, unit: 'hour' }]);
    expect(specs('bak 1 minuut mee')).toEqual([{ min: 1, unit: 'min' }]);
    expect(specs('laat twee minuten staan')).toEqual([{ min: 2, unit: 'min' }]);
    expect(specs('een uurtje zachtjes')).toEqual([{ min: 1, unit: 'hour' }]);
    expect(specs('anderhalf uur')).toEqual([{ min: 1.5, unit: 'hour' }]);
  });

  it('ignores minuten used as a noun without a number', () => {
    expect(findTimers('Warm de saus nog enkele minuten door.')).toEqual([]);
    expect(findTimers('Paar minuten onder de gril')).toEqual([]);
    expect(findTimers('Zet het vuur laag en laat de saus binden.')).toEqual([]);
  });

  it('never reads part of a number or a temperature as a timer', () => {
    expect(specs('Bak 20 minuten op 200 °C')).toEqual([{ min: 20, unit: 'min' }]);
    expect(findTimers('Bak op 175 °C goudbruin')).toEqual([]);
    expect(specs('om de 15 minuten omroeren')).toEqual([{ min: 15, unit: 'min' }]);
  });

  it('returns every duration in order with the matched text as label', () => {
    const found = findTimers('Fruit de ui 5 minuten, voeg de kip toe en laat 20 minuten stoven; daarna een kwartier rusten.');
    expect(found.map((t) => t.label)).toEqual(['5 minuten', '20 minuten', 'een kwartier']);
  });
});

describe('findTimers (English)', () => {
  it('finds the phrases from the spec', () => {
    expect(specs('Simmer for 10 minutes')).toEqual([{ min: 10, unit: 'min' }]);
    expect(specs('Leave to rest for an hour')).toEqual([{ min: 1, unit: 'hour' }]);
    expect(specs('Bake for 25-30 mins')).toEqual([{ min: 25, max: 30, unit: 'min' }]);
    expect(specs('cook 10 to 15 minutes')).toEqual([{ min: 10, max: 15, unit: 'min' }]);
    expect(specs('chill for half an hour')).toEqual([{ min: 30, unit: 'min' }]);
    expect(specs('roast for an hour and a half')).toEqual([{ min: 1.5, unit: 'hour' }]);
    expect(specs('a quarter of an hour')).toEqual([{ min: 15, unit: 'min' }]);
    expect(specs('stir for 30 seconds')).toEqual([{ min: 30, unit: 'sec' }]);
    expect(specs('boil for two hours')).toEqual([{ min: 2, unit: 'hour' }]);
  });
});

describe('formatTimer', () => {
  it('formats ranges, fractions and units per language', () => {
    expect(formatTimer({ min: 25, max: 30, unit: 'min' }, 'nl')).toBe('25-30 min');
    expect(formatTimer({ min: 25, max: 30, unit: 'min' }, 'en')).toBe('25-30 min');
    expect(formatTimer({ min: 1.5, unit: 'hour' }, 'nl')).toBe('1½ uur');
    expect(formatTimer({ min: 1.5, unit: 'hour' }, 'en')).toBe('1½ h');
    expect(formatTimer({ min: 30, unit: 'sec' }, 'nl')).toBe('30 sec');
    expect(formatTimer({ min: 2.5, max: 3, unit: 'hour' }, 'nl')).toBe('2½-3 uur');
  });
});

describe('timerMs', () => {
  it('uses the maximum of a range', () => {
    expect(timerMs({ min: 25, max: 30, unit: 'min' })).toBe(30 * 60_000);
    expect(timerMs({ min: 5, unit: 'min' })).toBe(5 * 60_000);
    expect(timerMs({ min: 1.5, unit: 'hour' })).toBe(90 * 60_000);
    expect(timerMs({ min: 30, unit: 'sec' })).toBe(30_000);
  });
});
