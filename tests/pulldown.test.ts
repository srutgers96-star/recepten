// Block 6D-S (docs/specs/badges-avatar.md "S-A" point 3): the pure part of the pull-down gesture.
import { describe, expect, it } from 'vitest';
import { PULL_THRESHOLD, pullDistance } from '../src/pulldown';

describe('pullDistance', () => {
  it('measures a straight pull down', () => {
    expect(pullDistance({ x: 100, y: 50 }, { x: 100, y: 150 })).toBe(100);
  });

  it('is zero for a pull up or no travel', () => {
    expect(pullDistance({ x: 0, y: 200 }, { x: 0, y: 100 })).toBe(0);
    expect(pullDistance({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });

  it('counts a diagonal pull that is more vertical than horizontal', () => {
    expect(pullDistance({ x: 0, y: 0 }, { x: 40, y: 90 })).toBe(90);
    expect(pullDistance({ x: 0, y: 0 }, { x: -40, y: 90 })).toBe(90);
  });

  it('is zero when the travel is as sideways as it is down, or more', () => {
    expect(pullDistance({ x: 0, y: 0 }, { x: 90, y: 90 })).toBe(0);
    expect(pullDistance({ x: 0, y: 0 }, { x: -120, y: 90 })).toBe(0);
  });

  it('reaches the default threshold of 80 px exactly at 80', () => {
    expect(PULL_THRESHOLD).toBe(80);
    expect(pullDistance({ x: 0, y: 0 }, { x: 0, y: 79 }) >= PULL_THRESHOLD).toBe(false);
    expect(pullDistance({ x: 0, y: 0 }, { x: 0, y: 80 }) >= PULL_THRESHOLD).toBe(true);
  });
});
