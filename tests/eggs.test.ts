// V1c-10 (docs/specs/ei-gabi.md §1a): the leopard-print egg phrases.
import { describe, expect, it } from 'vitest';
import { foldEggText, isPanterEggText, PANTER_PHRASES } from '../src/domain/eggs';

describe('foldEggText', () => {
  it('trims, lowercases, strips diacritics, collapses spaces and drops one trailing . or !', () => {
    expect(foldEggText('  Leopard   PRINT! ')).toBe('leopard print');
    expect(foldEggText('Pantér print.')).toBe('panter print');
    expect(foldEggText('leopard\tprint')).toBe('leopard print');
  });
});

describe('isPanterEggText', () => {
  it('accepts every phrase', () => {
    for (const p of PANTER_PHRASES) expect(isPanterEggText(p)).toBe(true);
  });

  it('ignores case, surrounding spaces and a trailing ! or .', () => {
    expect(isPanterEggText('Leopard Print')).toBe(true);
    expect(isPanterEggText('LEOPARD PRINT')).toBe(true);
    expect(isPanterEggText('Leopard print!')).toBe(true);
    expect(isPanterEggText(' luipaardprint. ')).toBe(true);
    expect(isPanterEggText('Panter  print')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isPanterEggText('leopard prints')).toBe(false);
    expect(isPanterEggText('leopard')).toBe(false);
    expect(isPanterEggText('2 leopard print')).toBe(false);
    expect(isPanterEggText('leopard print, melk')).toBe(false);
    // The screen checks the whole typed line (ExtraField onLine), never a parsed part of it.
    expect(isPanterEggText('melk, leopard print')).toBe(false);
    expect(isPanterEggText('1 kg leopard print')).toBe(false);
    expect(isPanterEggText('melk' + String.fromCharCode(10) + 'leopard print' + String.fromCharCode(10) + 'brood')).toBe(false);
    expect(isPanterEggText('')).toBe(false);
    expect(isPanterEggText('   ')).toBe(false);
    expect(isPanterEggText(null)).toBe(false);
    expect(isPanterEggText(undefined)).toBe(false);
  });
});
