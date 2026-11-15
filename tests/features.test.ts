// Feature events (docs/specs/badges-avatar.md §2c, §6a): the pure `features.log` model that the
// app layer (src/features.ts recordFeature) bumps and the badges read through featureCounts.
import { describe, expect, it } from 'vitest';
import {
  DAILY_CAPS,
  FEATURE_IDS,
  bumpFeature,
  featureCounts,
  featureDayOf,
  isFeatureId,
  mergeFeatureLogs,
  normalizeFeatureLog,
  type FeatureLog,
} from '../src/domain/features';

const T1 = '2026-10-01T18:00:00.000Z';
const T2 = '2026-10-02T18:00:00.000Z';
const T3 = '2026-10-03T18:00:00.000Z';

// V1c-11: every counted bump also records its local day (`day`); the plain tests below assert the rest.
const D = (iso: string, n: number) => ({ d: featureDayOf(iso), n });

describe('FEATURE_IDS / isFeatureId', () => {
  it('has the 32 unique ids of §2c, without overcooked', () => {
    expect(FEATURE_IDS).toHaveLength(32);
    expect(new Set(FEATURE_IDS).size).toBe(32);
    expect(FEATURE_IDS as readonly string[]).not.toContain('overcooked');
  });

  it('recognises feature ids only', () => {
    expect(isFeatureId('voice')).toBe(true);
    expect(isFeatureId('feedback')).toBe(true);
    expect(isFeatureId('kijken')).toBe(false);
    expect(isFeatureId('overcooked')).toBe(false);
    expect(isFeatureId(undefined)).toBe(false);
    expect(isFeatureId(7)).toBe(false);
  });
});

describe('bumpFeature', () => {
  it('starts a new counter: n 1, first = last = at, by[member] 1', () => {
    expect(bumpFeature({}, 'timer', 'p:a', T1)).toEqual({ timer: { n: 1, first: T1, last: T1, by: { 'p:a': 1 }, day: D(T1, 1) } });
  });

  it('a second bump raises n and last; first stays', () => {
    const log = bumpFeature(bumpFeature({}, 'timer', 'p:a', T1), 'timer', 'p:a', T2);
    expect(log.timer).toEqual({ n: 2, first: T1, last: T2, by: { 'p:a': 2 }, day: D(T2, 1) });
  });

  it('another member gets its own key in by', () => {
    const log = bumpFeature(bumpFeature({}, 'timer', 'p:a', T1), 'timer', 'anon', T2);
    expect(log.timer).toEqual({ n: 2, first: T1, last: T2, by: { 'p:a': 1, anon: 1 }, day: D(T2, 1) });
  });

  it('never changes its input and leaves other ids alone', () => {
    const before = bumpFeature({}, 'voice', 'p:a', T1);
    const snapshot = JSON.parse(JSON.stringify(before)) as FeatureLog;
    const after = bumpFeature(before, 'voice', 'p:a', T2);
    const other = bumpFeature(after, 'print', 'p:a', T3);
    expect(before).toEqual(snapshot);
    expect(other.voice).toEqual(after.voice);
    expect(other.print).toEqual({ n: 1, first: T3, last: T3, by: { 'p:a': 1 }, day: D(T3, 1) });
  });

  it('a bump with an earlier clock never moves last back', () => {
    const log = bumpFeature(bumpFeature({}, 'timer', 'p:a', T2), 'timer', 'p:a', T1);
    expect(log.timer).toEqual({ n: 2, first: T1, last: T2, by: { 'p:a': 2 }, day: D(T1, 1) });
  });
});

describe('mergeFeatureLogs', () => {
  it('takes max n, min first, max last and the max per member', () => {
    const a: FeatureLog = {
      timer: { n: 3, first: T2, last: T2, by: { 'p:a': 3 } },
      voice: { n: 1, first: T1, last: T1, by: { 'p:a': 1 } },
    };
    const b: FeatureLog = {
      timer: { n: 2, first: T1, last: T3, by: { 'p:a': 1, 'p:b': 1 } },
      print: { n: 4, first: T1, last: T3, by: { anon: 4 } },
    };
    expect(mergeFeatureLogs(a, b)).toEqual({
      timer: { n: 3, first: T1, last: T3, by: { 'p:a': 3, 'p:b': 1 } },
      voice: { n: 1, first: T1, last: T1, by: { 'p:a': 1 } },
      print: { n: 4, first: T1, last: T3, by: { anon: 4 } },
    });
  });

  it('merging a log with itself changes nothing (restoring the same backup twice)', () => {
    const a = bumpFeature(bumpFeature({}, 'timer', 'p:a', T1), 'timer', 'p:b', T2);
    expect(mergeFeatureLogs(a, a)).toEqual(a);
    expect(mergeFeatureLogs(a, {})).toEqual(a);
    expect(mergeFeatureLogs({}, a)).toEqual(a);
  });
});

describe('normalizeFeatureLog', () => {
  it('throws garbage away and keeps valid ids', () => {
    expect(normalizeFeatureLog(undefined)).toEqual({});
    expect(normalizeFeatureLog(null)).toEqual({});
    expect(normalizeFeatureLog('log')).toEqual({});
    expect(normalizeFeatureLog([{ n: 1 }])).toEqual({});
    expect(
      normalizeFeatureLog({
        timer: { n: 2, first: T1, last: T2, by: { 'p:a': 2 } },
        kijken: { n: 1, first: T1, last: T1, by: {} }, // unknown id
        overcooked: { n: 1, first: T1, last: T1, by: {} }, // not a feature event
        voice: { n: 0, first: T1, last: T1, by: {} }, // n must be ≥ 1
        print: { n: '3', first: T1, last: T1, by: {} }, // n must be a number
        theme: { n: 1 }, // no moment at all
        story: 'yes',
        sort: { n: 2, first: T1, last: T2, by: { 'p:a': 2, 'p:b': 'x', 'p:c': -1, 'p:d': 1.5 } },
        backup: { n: 1, last: T3 }, // one moment stands in for the other; by missing → {}
      }),
    ).toEqual({
      timer: { n: 2, first: T1, last: T2, by: { 'p:a': 2 } },
      sort: { n: 2, first: T1, last: T2, by: { 'p:a': 2 } },
      backup: { n: 1, first: T3, last: T3, by: {} },
    });
  });
});

describe('featureCounts', () => {
  const log: FeatureLog = {
    timer: { n: 5, first: T1, last: T3, by: { 'p:a': 3, anon: 2 } },
    voice: { n: 1, first: T2, last: T2, by: { 'p:b': 1 } },
  };

  it("'all' gives n per id", () => {
    expect(featureCounts(log, 'all')).toEqual({ timer: 5, voice: 1 });
  });

  it('a member gives by[member] ?? 0', () => {
    const a = featureCounts(log, 'p:a');
    expect(a['timer']).toBe(3);
    expect(a['voice'] ?? 0).toBe(0);
    expect(featureCounts(log, 'p:z')['timer'] ?? 0).toBe(0);
    expect(featureCounts({}, 'all')).toEqual({});
  });
});

// V1c-11 (Stijn, 15 Nov 2026): the actions that are free to repeat count at most DAILY_CAPS[id] times per local day.
describe('daily caps (V1c-11)', () => {
  const day = (h: number, m = 0) => `2026-11-15T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;

  it('caps Verras me at 10 a day and returns the same log past the cap', () => {
    expect(DAILY_CAPS.surprise).toBe(10);
    let log: FeatureLog = {};
    for (let i = 0; i < 12; i++) log = bumpFeature(log, 'surprise', 'p1', day(12, i));
    expect(log.surprise?.n).toBe(10);
    expect(log.surprise?.by['p1']).toBe(10);
    expect(log.surprise?.day).toEqual({ d: featureDayOf(day(12)), n: 10 });
    const same = bumpFeature(log, 'surprise', 'p1', day(13));
    expect(same).toBe(log);
    // another member on the same phone shares the day's cap (the badge counts per member, the cap per phone)
    expect(bumpFeature(log, 'surprise', 'p2', day(13))).toBe(log);
  });

  it('counts again on the next day', () => {
    let log: FeatureLog = {};
    for (let i = 0; i < 10; i++) log = bumpFeature(log, 'timer', 'p1', day(18, i));
    expect(bumpFeature(log, 'timer', 'p1', day(19))).toBe(log);
    const next = bumpFeature(log, 'timer', 'p1', '2026-11-16T18:00:00.000Z');
    expect(next.timer?.n).toBe(11);
    expect(next.timer?.day).toEqual({ d: featureDayOf('2026-11-16T18:00:00.000Z'), n: 1 });
  });

  it('ids without a cap are unlimited; a custom caps table applies', () => {
    let log: FeatureLog = {};
    for (let i = 0; i < 30; i++) log = bumpFeature(log, 'voice', 'p1', day(10, i));
    expect(log.voice?.n).toBe(30);
    let capped: FeatureLog = {};
    for (let i = 0; i < 5; i++) capped = bumpFeature(capped, 'voice', 'p1', day(10, i), { voice: 2 });
    expect(capped.voice?.n).toBe(2);
  });

  it('a log from before the caps starts counting its day on the next bump', () => {
    const old: FeatureLog = { surprise: { n: 400, first: T1, last: T2, by: { p1: 400 } } };
    const next = bumpFeature(old, 'surprise', 'p1', day(9));
    expect(next.surprise?.n).toBe(401);
    expect(next.surprise?.day).toEqual({ d: featureDayOf(day(9)), n: 1 });
  });

  it('normalize keeps a valid day and drops a broken one; merge keeps the later day', () => {
    const stored = {
      surprise: { n: 3, first: T1, last: T2, by: { p1: 3 }, day: { d: '2026-11-15', n: 3 } },
      timer: { n: 2, first: T1, last: T2, by: { p1: 2 }, day: { d: 'gisteren', n: 2 } },
    };
    const log = normalizeFeatureLog(stored);
    expect(log.surprise?.day).toEqual({ d: '2026-11-15', n: 3 });
    expect(log.timer?.day).toBeUndefined();
    const a: FeatureLog = { surprise: { n: 3, first: T1, last: T2, by: { p1: 3 }, day: { d: '2026-11-14', n: 3 } } };
    const b: FeatureLog = { surprise: { n: 5, first: T1, last: T3, by: { p1: 5 }, day: { d: '2026-11-15', n: 2 } } };
    expect(mergeFeatureLogs(a, b).surprise?.day).toEqual({ d: '2026-11-15', n: 2 });
    expect(mergeFeatureLogs(b, a).surprise?.day).toEqual({ d: '2026-11-15', n: 2 });
    const c: FeatureLog = { surprise: { n: 4, first: T1, last: T3, by: { p1: 4 }, day: { d: '2026-11-15', n: 4 } } };
    expect(mergeFeatureLogs(b, c).surprise?.day).toEqual({ d: '2026-11-15', n: 4 });
    expect(mergeFeatureLogs(a, { surprise: { n: 1, first: T1, last: T1, by: { p1: 1 } } }).surprise?.day).toEqual({ d: '2026-11-14', n: 3 });
  });
});
