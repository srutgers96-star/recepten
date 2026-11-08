// splitSteps / joinSteps (docs/phase-1-spec.md §1).
import { describe, expect, it } from 'vitest';
import { joinSteps, MAX_STEP_CHARS, MIN_STEP_CHARS, splitSentences, splitSteps } from '../src/domain/steps';
import { formatTemperatures } from '../src/components/StepView';
import { temperatureModeFrom, type TemperatureMode } from '../src/db/repo';

const S1 = 'Kook de aardappelen in ca. 20 minuten gaar en giet ze af in een vergiet.';
const S2 = 'Bak de ui in de boter glazig en voeg de knoflook en de paprika toe.';
const S3 = 'Voeg de tomaten toe en laat de saus 10 minuten zachtjes pruttelen.';
const S4 = 'Serveer met rijst en bestrooi met verse peterselie.';

describe('splitSteps', () => {
  it('splits on blank lines and trims', () => {
    expect(splitSteps(`${S1}\n\n${S2}\n\n\n${S3}\n`)).toEqual([S1, S2, S3]);
  });

  it('accepts Windows line endings and keeps single newlines inside a paragraph', () => {
    expect(splitSteps(`Maak de saus:\r\n${S2}\r\n\r\n${S3}`)).toEqual([`Maak de saus:\n${S2}`, S3]);
  });

  it('returns [] for empty input', () => {
    expect(splitSteps('')).toEqual([]);
    expect(splitSteps('  \n\n ')).toEqual([]);
  });

  it('splits a long paragraph at sentence boundaries, starting steps at cooking verbs', () => {
    const long = [S1, S2, S3, S4, S1, S2, S3, S4].join(' ');
    expect(long.length).toBeGreaterThan(MAX_STEP_CHARS);
    const steps = splitSteps(long);
    expect(steps.length).toBeGreaterThan(1);
    for (const s of steps) {
      expect(s.length).toBeGreaterThanOrEqual(MIN_STEP_CHARS);
      expect(s.length).toBeLessThanOrEqual(MAX_STEP_CHARS);
      // every step starts at a sentence start, never in the middle of one
      expect(s).toMatch(/^[A-Z]/);
    }
    expect(steps.join(' ')).toBe(long);
    // the first step keeps "ca. 20 minuten" together
    expect(steps[0]).toContain('ca. 20 minuten gaar');
  });

  it('protects abbreviations and decimals', () => {
    const p = 'Voeg ca. 200 ml melk toe en evt. 1.5 tl zout. Bak 5 min. op hoog vuur en roer bijv. de kaas erdoor tot 1,5 cm dik. Serveer.';
    expect(splitSentences(p)).toEqual([
      'Voeg ca. 200 ml melk toe en evt. 1.5 tl zout.',
      'Bak 5 min. op hoog vuur en roer bijv. de kaas erdoor tot 1,5 cm dik.',
      'Serveer.',
    ]);
  });

  it('treats a unit abbreviation before a capital as a sentence end', () => {
    expect(splitSentences('Laat 5 min. Roer daarna de kaas erdoor.')).toEqual(['Laat 5 min.', 'Roer daarna de kaas erdoor.']);
    expect(splitSentences('Bak 30 minuten op 200 °C. Serveer warm.')).toEqual(['Bak 30 minuten op 200 °C.', 'Serveer warm.']);
  });

  it('joins short tails to the previous step and a short first step to the next', () => {
    const steps = splitSteps(`${S1}\n\nServeer.`);
    expect(steps).toEqual([`${S1}\nServeer.`]);
    const steps2 = splitSteps(`Oven op 200 °C.\n\n${S2}`);
    expect(steps2).toEqual([`Oven op 200 °C.\n${S2}`]);
  });

  it('never produces a step shorter than the minimum when there is more than one step', () => {
    const long = [S1, S2, S3, 'Serveer.', S4, 'Dek af.'].join(' ') + ' ' + [S1, S2, S3].join(' ');
    for (const s of splitSteps(long)) expect(s.length).toBeGreaterThanOrEqual(MIN_STEP_CHARS);
  });
});

describe('joinSteps', () => {
  it('joins with blank lines and drops empty steps', () => {
    expect(joinSteps([S1, '', '  ', S2])).toBe(`${S1}\n\n${S2}`);
    expect(joinSteps([])).toBe('');
  });

  it('round-trips with splitSteps for normal steps', () => {
    const steps = [S1, S2, S3, S4];
    expect(splitSteps(joinSteps(steps))).toEqual(steps);
  });
});

// V1b §1b: the temperature setting (units.temperature) in its three modes.
describe('formatTemperatures', () => {
  const OVEN = 'Verwarm de oven voor op 180 °C';
  const MODES: TemperatureMode[] = ['c', 'f', 'both'];

  it("'c' leaves the text unchanged", () => {
    expect(formatTemperatures(OVEN, 'c')).toBe(OVEN);
  });

  it("'both' appends the °F value (the old °F-erbij behaviour)", () => {
    expect(formatTemperatures(OVEN, 'both')).toBe('Verwarm de oven voor op 180 °C (350 °F)');
  });

  it("'f' replaces the °C value with the °F value", () => {
    expect(formatTemperatures(OVEN, 'f')).toBe('Verwarm de oven voor op 350 °F');
  });

  it('recognises 180°C and 200 ℃ and rounds off-table values to 5 in every mode', () => {
    expect(formatTemperatures('Bak op 180°C, daarna 200 ℃.', 'f')).toBe('Bak op 350 °F, daarna 400 °F.');
    expect(formatTemperatures('Bak op 175 °C.', 'both')).toBe('Bak op 175 °C (345 °F).');
    expect(formatTemperatures('Bak op 175 °C.', 'f')).toBe('Bak op 345 °F.');
  });

  it('a text without a temperature stays the same in every mode', () => {
    const plain = 'Snijd de ui fijn en bak 5 minuten.';
    for (const m of MODES) expect(formatTemperatures(plain, m)).toBe(plain);
  });

  it('a text that already carries °F stays the same in every mode', () => {
    const done = 'Bak op 180 °C (350 °F).';
    for (const m of MODES) expect(formatTemperatures(done, m)).toBe(done);
  });
});

describe('temperatureModeFrom (translation of the old units.fahrenheit)', () => {
  it('uses the new key when it is valid', () => {
    expect(temperatureModeFrom('f', true)).toBe('f');
    expect(temperatureModeFrom('c', true)).toBe('c');
    expect(temperatureModeFrom('both', false)).toBe('both');
  });

  it("old true -> 'both', missing or false -> 'c'", () => {
    expect(temperatureModeFrom(undefined, true)).toBe('both');
    expect(temperatureModeFrom(undefined, undefined)).toBe('c');
    expect(temperatureModeFrom(undefined, false)).toBe('c');
  });

  it('ignores an invalid new value', () => {
    expect(temperatureModeFrom('kelvin', true)).toBe('both');
    expect(temperatureModeFrom(42, false)).toBe('c');
  });
});
