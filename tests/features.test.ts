// Feature events (docs/specs/badges-avatar.md §2c, §6a): the pure `features.log` model that the
// app layer (src/features.ts recordFeature) bumps and the badges read through featureCounts.
import { describe, expect, it } from 'vitest';
import {
  FEATURE_IDS,
  bumpFeature,
  featureCounts,
  isFeatureId,
  mergeFeatureLogs,
  normalizeFeatureLog,
  type FeatureLog,
} from '../src/domain/features';

const T1 = '2026-10-01T18:00:00.000Z';
const T2 = '2026-10-02T18:00:00.000Z';
const T3 = '2026-10-03T18:00:00.000Z';

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
    expect(bumpFeature({}, 'timer', 'p:a', T1)).toEqual({ timer: { n: 1, first: T1, last: T1, by: { 'p:a': 1 } } });
  });

  it('a second bump raises n and last; first stays', () => {
    const log = bumpFeature(bumpFeature({}, 'timer', 'p:a', T1), 'timer', 'p:a', T2);
    expect(log.timer).toEqual({ n: 2, first: T1, last: T2, by: { 'p:a': 2 } });
  });

  it('another member gets its own key in by', () => {
    const log = bumpFeature(bumpFeature({}, 'timer', 'p:a', T1), 'timer', 'anon', T2);
    expect(log.timer).toEqual({ n: 2, first: T1, last: T2, by: { 'p:a': 1, anon: 1 } });
  });

  it('never changes its input and leaves other ids alone', () => {
    const before = bumpFeature({}, 'voice', 'p:a', T1);
    const snapshot = JSON.parse(JSON.stringify(before)) as FeatureLog;
    const after = bumpFeature(before, 'voice', 'p:a', T2);
    const other = bumpFeature(after, 'print', 'p:a', T3);
    expect(before).toEqual(snapshot);
    expect(other.voice).toEqual(after.voice);
    expect(other.print).toEqual({ n: 1, first: T3, last: T3, by: { 'p:a': 1 } });
  });

  it('a bump with an earlier clock never moves last back', () => {
    const log = bumpFeature(bumpFeature({}, 'timer', 'p:a', T2), 'timer', 'p:a', T1);
    expect(log.timer).toEqual({ n: 2, first: T1, last: T2, by: { 'p:a': 2 } });
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
