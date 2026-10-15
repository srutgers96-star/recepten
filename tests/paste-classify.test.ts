// src/domain/paste-classify.ts (docs/phase-6-spec.md 13A): one paste box that recognises
// everything. Order: empty → tokens (r/p/w/b, text around them allowed, several at once, an f
// among them travels along) → member (only #f=) → bundle (JSON) → ai (the import prompt's plain
// format, escaped or not) → website → unknown.
import { describe, expect, it } from 'vitest';
import { classifyPaste } from '../src/domain/paste-classify';
import { cleanPastedText } from '../src/domain/photo-import';
import { decodeToken, encodeToken, extractTokens } from '../src/domain/token';
import { PASTE_FIXTURES, readPasteFixture } from './fixtures/paste/read';

/** A token-shaped string: extractTokens accepts any 20+ base64url characters (the UI decodes later). */
const fake = (seed: string) => (seed + 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-').slice(0, 40);
const APP = 'https://srutgers96-star.github.io/recepten/';

describe('classifyPaste: empty, tokens, member', () => {
  it('empty and whitespace', () => {
    expect(classifyPaste('')).toEqual({ kind: 'empty', normalized: '' });
    expect(classifyPaste('  \n\t ​')).toEqual({ kind: 'empty', normalized: '' });
  });

  it('a share link with text around it, in a WhatsApp bubble', () => {
    const r = classifyPaste(`Kijk, dit recept is echt lekker:\n${APP}#r=${fake('r')}\nGroetjes!`);
    expect(r.kind).toBe('tokens');
    expect(r.tokens).toEqual([`r=${fake('r')}`]);
    expect(r.normalized).toContain('Groetjes!');
  });

  it('several tokens, in order, each once, an #f= among them travels along', () => {
    const r = classifyPaste(`${APP}#w=${fake('w')} en ${APP}#r=${fake('r')} en nog eens ${APP}#r=${fake('r')} plus mijn kaartje ${APP}#f=${fake('f')}`);
    expect(r.kind).toBe('tokens');
    expect(r.tokens).toEqual([`w=${fake('w')}`, `r=${fake('r')}`, `f=${fake('f')}`]);
  });

  it('a bare "r=…" and a bundle or plan link are tokens too', () => {
    expect(classifyPaste(`r=${fake('r')}`).kind).toBe('tokens');
    expect(classifyPaste(`${APP}#b=${fake('b')}`).kind).toBe('tokens');
    expect(classifyPaste(`${APP}#p=${fake('p')}`).kind).toBe('tokens');
  });

  it('only a member card is "member"', () => {
    const r = classifyPaste(`Voeg me toe aan je huishouden: ${APP}#f=${fake('f')}`);
    expect(r.kind).toBe('member');
    expect(r.tokens).toEqual([`f=${fake('f')}`]);
  });

  it('a real token round-trips: the tokens list is what extractTokens reads again', async () => {
    const token = await encodeToken({ v: 2, t: 'r', r: { id: 'u:test', name: { nl: 'Soep' }, lines: [], steps: [] } });
    const r = classifyPaste(`${APP}#r=${token}`);
    expect(r.kind).toBe('tokens');
    expect(r.tokens).toEqual([`r=${token}`]);
    expect(extractTokens(r.tokens?.join('\n') ?? '')).toEqual([{ key: 'r', token }]);
  });

  it('an escaped link (copied from a rendered chat) still carries its token', () => {
    const r = classifyPaste(`${APP}\\#r=${fake('r')}`);
    expect(r.kind).toBe('tokens');
    expect(r.normalized).not.toContain('\\');
  });

  it('an escape or a zero-width character INSIDE the token: the cleaned text decodes, as src/paste.ts reads it', async () => {
    const token = await encodeToken({ v: 2, t: 'r', r: { id: 'u:test', name: { nl: 'Soep' }, lines: [], steps: [] } });
    // A rendered chat escapes the first "_" / "-" of the token; a zero-width space may land in it too.
    const escaped = `${APP}#r=${token.replace(/([_-])/u, '\\$1')}`;
    const zeroWidth = `${APP}#r=${token.slice(0, 20)}​${token.slice(20)}`;
    for (const text of [escaped, zeroWidth]) {
      const r = classifyPaste(text);
      expect(r.kind).toBe('tokens');
      expect(r.tokens).toEqual([`r=${token}`]);
      const read = extractTokens(cleanPastedText(text));
      expect(read).toEqual([{ key: 'r', token }]);
      await expect(decodeToken(token)).resolves.toMatchObject({ t: 'r' });
    }
  });
});

describe('classifyPaste: bundle JSON', () => {
  it('an envelope, a backup, an export and a bare recipe', () => {
    expect(classifyPaste(JSON.stringify({ v: 2, t: 'r', r: { id: 'u:1' } })).kind).toBe('bundle');
    expect(classifyPaste(JSON.stringify({ v: 2, t: 'b', at: '2026-10-15', app: 'recepten', userRecipes: [], profiles: [] })).kind).toBe('bundle');
    expect(classifyPaste(JSON.stringify({ recipes: [{ id: 'u:1', name: { nl: 'Soep' } }] })).kind).toBe('bundle');
    expect(classifyPaste(JSON.stringify({ id: 'u:1', name: { nl: 'Soep' }, lines: [], steps: [] })).kind).toBe('bundle');
    expect(classifyPaste(JSON.stringify([{ id: 'u:1', name: { nl: 'Soep' }, lines: [] }])).kind).toBe('bundle');
  });

  it('a title line before the document (a share-target subject) and pretty-printed JSON', () => {
    expect(classifyPaste('Recepten export\n' + JSON.stringify({ v: 2, t: 'b', b: { recipes: [], patches: [] } }, null, 2)).kind).toBe('bundle');
  });

  it('JSON that is not a recipe shape is not a bundle', () => {
    expect(classifyPaste('[1, 2, 3]').kind).toBe('unknown');
    expect(classifyPaste('{"hello": "world"}').kind).toBe('unknown');
  });
});

const AI_NL = '=== NL ===\n# Uiensoep\nPorties: 6\n## Ingrediënten\n- 4 uien\n- 1 l bouillon\n## Bereiding\nSnipper de uien.\n\nKook 20 minuten.\n=== EN ===\n# Onion soup\nServings: 6\n## Ingredients\n- 4 onions\n- 1 l stock\n## Method\nSlice the onions.\n\nSimmer for 20 minutes.\n';

describe('classifyPaste: AI answer', () => {
  it('the bilingual answer, with and without a code block, with and without chatter', () => {
    expect(classifyPaste(AI_NL).kind).toBe('ai');
    const fenced = classifyPaste('Here you go:\n```\n' + AI_NL + '```\nLet me know!');
    expect(fenced.kind).toBe('ai');
    expect(fenced.normalized).not.toContain('```');
  });

  it('a single block with "# Name" only, or "## Ingrediënten" only', () => {
    expect(classifyPaste('# Soep\n4 uien\n1 l bouillon').kind).toBe('ai');
    expect(classifyPaste('Soep\n## Ingrediënten\n4 uien\n## Bereiding\nKook.').kind).toBe('ai');
  });

  it('with the escapes a rendered answer copies: "\\#", "\\[", "\\*"', () => {
    const r = classifyPaste('\\# Uiensoep\nPorties: 6\n\\#\\# Ingrediënten\n\\- 4 uien \\[gesnipperd\\]\n\\#\\# Bereiding\nKook.');
    expect(r.kind).toBe('ai');
    expect(r.normalized).toContain('# Uiensoep');
    expect(r.normalized).toContain('[gesnipperd]');
    expect(r.normalized).not.toContain('\\');
  });

  it("Stijn's broken copies: everything on one line, and the escaped ingredient line", () => {
    expect(classifyPaste('=== NL === # Broccoli quiche Porties: 4 Categorie: hartige taart Labels: vegetarisch ## Ingrediënten - 1 rol bladerdeeg - 400 g broccoli ## Bereiding 1. Verwarm de oven.').kind).toBe('ai');
    expect(classifyPaste('### Ingrediënten\n\n1,5 kg uien \\[in plakken\\] 1 bol knoflook \\[in plakjes\\] 75 g boter zout peper').kind).toBe('ai');
  });

  it('without any "#": "Porties:" plus "Categorie:" together are the answer\'s meta lines', () => {
    expect(classifyPaste('Uiensoep\nPorties: 6\nCategorie: soep\nIngrediënten\n4 uien\nBereiding\nKook.').kind).toBe('ai');
    expect(classifyPaste('Onion soup\nServings: 6\nTags: quick\nIngredients\n4 onions\nMethod\nCook.').kind).toBe('ai');
  });

  it('the translation answer (I1./S1. markers) is an AI answer too', () => {
    expect(classifyPaste('1. Onion soup\nI1. 4 onions\nI2. 1 l stock\nS1. Slice the onions.').kind).toBe('ai');
  });
});

describe('classifyPaste: website and unknown', () => {
  it('every paste fixture is a website recipe, with the parse attached', () => {
    for (const file of PASTE_FIXTURES) {
      const r = classifyPaste(readPasteFixture(file));
      expect(r.kind, file).toBe('website');
      expect(r.website?.ingredients.length, file).toBeGreaterThan(5);
      expect(r.website?.confidence, file).toBe('high');
    }
  });

  it('a page with "Servings: 4" alone (one weak marker) is still a website', () => {
    expect(classifyPaste('Soup\nServings: 4\nIngredients\n1 onion\n2 carrots\nMethod\nCook for 20 minutes until soft.').kind).toBe('website');
  });

  it('a headless block of quantity lines is a website recipe too', () => {
    expect(classifyPaste('Tomatensoep\n1 ui\n2 teentjes knoflook\n800 g tomaten\n500 ml bouillon\nSnipper de ui en bak hem zacht.').kind).toBe('website');
  });

  it('prose and a greeting are unknown', () => {
    expect(classifyPaste('Hoi! Hoe laat ben je thuis vanavond?').kind).toBe('unknown');
    expect(classifyPaste('Hoi! Hoe laat ben je thuis vanavond?').normalized).toBe('Hoi! Hoe laat ben je thuis vanavond?');
    // A lone " # " inside a message is not the "# Naam" marker.
    expect(classifyPaste('Hoi, zie je morgen om 8 uur # bij de bakker').kind).toBe('unknown');
    expect(classifyPaste('ticket # Abc123').kind).toBe('unknown');
  });

  it('normalized: Windows line ends, zero-width characters and escapes are gone', () => {
    const r = classifyPaste('Soep\r\n​Ingrediënten\r\n1 ui \\[gesnipperd\\]\r\n2 wortels\r\n3 aardappelen');
    expect(r.normalized).toBe('Soep\nIngrediënten\n1 ui [gesnipperd]\n2 wortels\n3 aardappelen');
  });
});
