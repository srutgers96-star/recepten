import { describe, expect, it } from 'vitest';
import type { Recipe } from '../src/domain/model';
import { matchesName, queryTerms, termVariants } from '../src/domain/search';

function recipe(nl: string, en = nl, aliases: string[] = []): Recipe {
  return {
    schema: 2,
    id: 'u:test',
    rev: 1,
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
    origin: { kind: 'user' },
    name: { nl, en },
    tags: [],
    servings: 4,
    lines: [],
    steps: [],
    goesWith: [],
    aliases,
  };
}

describe('spelling variants of dish names', () => {
  it('finds "Dino\'s Gulyás" when searching "goulash" (Stijn, 16 Oct 2026)', () => {
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('goulash'))).toBe(true);
  });

  it('still finds the classics named goulash', () => {
    expect(matchesName(recipe('Hongaarse goulash', 'Hungarian goulash'), queryTerms('goulash'))).toBe(true);
    expect(matchesName(recipe('Hongaarse goulash', 'Hungarian goulash'), queryTerms('gulyás'))).toBe(true);
  });

  it('matches a typed prefix of four or more letters', () => {
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('goul'))).toBe(true);
    expect(termVariants('gou')).toEqual(['gou']);
  });

  it('works in both directions for other dishes', () => {
    expect(matchesName(recipe('Shoarma met knoflooksaus'), queryTerms('shawarma'))).toBe(true);
    expect(matchesName(recipe('Kip saté', 'Chicken satay'), queryTerms('sate'))).toBe(true);
    expect(matchesName(recipe('Lasagne met courgette'), queryTerms('lasagna'))).toBe(true);
  });

  it('keeps every term required', () => {
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('dino goulash'))).toBe(true);
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('stijn goulash'))).toBe(false);
  });

  it('does not invent matches for unrelated words', () => {
    expect(matchesName(recipe("Dino's Gulyás"), queryTerms('lasagne'))).toBe(false);
    expect(termVariants('pasta')).toEqual(['pasta']);
  });
});
