// The honest QR limit (docs/specs/qr-link.md §1b/§5, block 13Q): `qrFits` is pure and the limit is
// one number. A short recipe's `#r=` link gets a code; a give-away bundle of 20 recipes does not.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Recipe } from '../src/domain/model';
import { QR_MAX_URL_CHARS, qrFits } from '../src/domain/qr-fit';
import { buildBundleEnvelope, buildRecipeEnvelope } from '../src/domain/share';
import { buildShareUrl, encodeToken } from '../src/domain/token';

const APP_URL = 'https://srutgers96-star.github.io/recepten/';
const { recipes } = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8')) as { recipes: Recipe[] };

const SHORT: Recipe = {
  schema: 2,
  id: 'u:abc12345',
  rev: 1,
  createdAt: '2026-11-08T10:00:00.000Z',
  updatedAt: '2026-11-08T10:00:00.000Z',
  origin: { kind: 'user', author: 'Stijn' },
  name: { nl: 'Tosti', en: 'Toastie' },
  tags: ['snel'],
  servings: 1,
  lines: [
    { raw: { nl: '2 sneetjes brood' }, qty: { min: 2 }, unit: 'sneetje', ing: 'brood' },
    { raw: { nl: '1 plak kaas' }, qty: { min: 1 }, unit: 'plak', ing: 'kaas' },
  ],
  steps: [{ text: { nl: 'Beleg het brood en bak de tosti goudbruin.', en: 'Fill the bread and toast until golden.' } }],
  goesWith: [],
  aliases: [],
};

describe('qrFits', () => {
  it('the limit is 1.200 characters: 1.200 fits, 1.201 does not', () => {
    expect(QR_MAX_URL_CHARS).toBe(1600);
    expect(qrFits('x'.repeat(1600))).toBe(true);
    expect(qrFits('x'.repeat(1601))).toBe(false);
    expect(qrFits('')).toBe(true);
  });

  it('a real #r= link of a short recipe fits', async () => {
    const url = buildShareUrl(APP_URL, 'r', await encodeToken(buildRecipeEnvelope(SHORT, { by: 'Stijn', userIngredients: [] })));
    expect(url.length).toBeLessThanOrEqual(QR_MAX_URL_CHARS);
    expect(qrFits(url)).toBe(true);
  });

  it('a #b= bundle of 20 recipes does not fit', async () => {
    expect(recipes.length).toBeGreaterThanOrEqual(20);
    const env = buildBundleEnvelope({ recipes: recipes.slice(0, 20), patches: [] }, { by: 'Stijn', userIngredients: [] });
    const url = buildShareUrl(APP_URL, 'b', await encodeToken(env));
    expect(url.length).toBeGreaterThan(QR_MAX_URL_CHARS);
    expect(qrFits(url)).toBe(false);
  });
});
