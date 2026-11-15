// V1c-2 §1c: joinParts — the person message in front of the recipe parts of the Stuur sheet.
import { describe, expect, it } from 'vitest';
import type { MessagePlan } from '../src/domain/share';
import { joinParts } from '../src/sendto';

const plan = (...parts: string[]): MessagePlan => ({ parts, tokens: parts.length, chars: parts.reduce((n, p) => n + p.length, 0) });

describe('joinParts', () => {
  it('glues the first recipe part behind the person message when it fits', () => {
    expect(joinParts('📈 Voortgang\nhttps://x', plan('🍲 2 recepten\nhttps://r1\nhttps://r2'), 1000)).toEqual([
      '📈 Voortgang\nhttps://x\n\n🍲 2 recepten\nhttps://r1\nhttps://r2',
    ]);
  });

  it('keeps the person message as its own part when the first recipe part does not fit', () => {
    const first = 'a'.repeat(60);
    const r1 = 'b'.repeat(50);
    expect(joinParts(first, plan(r1), 100)).toEqual([first, r1]);
  });

  it('the limit is inclusive (exactly the limit still glues)', () => {
    const first = 'a'.repeat(48);
    const r1 = 'b'.repeat(50);
    expect(joinParts(first, plan(r1), 100)).toEqual([first + '\n\n' + r1]);
  });

  it('with several recipe parts: part 1 joins, the rest follow in order', () => {
    expect(joinParts('P', plan('R1', 'R2', 'R3'), 100)).toEqual(['P\n\nR1', 'R2', 'R3']);
    expect(joinParts('P'.repeat(99), plan('R1', 'R2'), 100)).toEqual(['P'.repeat(99), 'R1', 'R2']);
  });

  it('an empty plan, a missing plan or a file plan leaves only the person message', () => {
    expect(joinParts('P', null)).toEqual(['P']);
    expect(joinParts('P', plan())).toEqual(['P']);
    expect(joinParts('P', { file: { name: 'f.json', json: '{}' }, reason: 'too-large' })).toEqual(['P']);
  });

  it('without a person message only the recipe parts go; nothing at all gives no parts', () => {
    expect(joinParts('', plan('R1', 'R2'))).toEqual(['R1', 'R2']);
    expect(joinParts('', null)).toEqual([]);
  });

  it('defaults to the 20 KB recipe-link limit', () => {
    const first = 'a'.repeat(10_000);
    expect(joinParts(first, plan('b'.repeat(9_998)))).toHaveLength(1);
    expect(joinParts(first, plan('b'.repeat(9_999)))).toHaveLength(2);
  });
});
