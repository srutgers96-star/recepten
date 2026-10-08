// Share-token codec tests (PLAN.md §7): 196 real round-trips on both compression engines,
// cross-engine compatibility, frozen v2 token, alphabet, extraction from pasted text, sizes.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  encodeToken,
  decodeToken,
  extractTokens,
  buildShareUrl,
  isCompressionStreamAvailable,
  isTokenKey,
  toBase64Url,
  fromBase64Url,
  deflateRaw,
  inflateRaw,
  MIN_TOKEN_LENGTH,
  type CodecEngine,
  type Envelope,
} from '../src/domain/token';
import { normalizeSource, slugId, initialOf, foldDiacritics, type SourceRecipe } from '../src/domain/recipe-source';
import {
  FROZEN_ENVELOPE_B,
  FROZEN_ENVELOPE_F,
  FROZEN_ENVELOPE_P,
  FROZEN_TOKEN_B,
  FROZEN_TOKEN_B_FFLATE,
  FROZEN_TOKEN_F,
  FROZEN_TOKEN_F_FFLATE,
  FROZEN_TOKEN_P,
  FROZEN_TOKEN_P_FFLATE,
} from './fixtures/frozen-share-tokens';

const SOURCE = fileURLToPath(new URL('../data/source/recipes-recepten2.json', import.meta.url));
const recipes = normalizeSource(JSON.parse(readFileSync(SOURCE, 'utf8')));
const ENGINES: readonly CodecEngine[] = ['native', 'fflate'];
const ALPHABET = /^[A-Za-z0-9_-]+$/;
const APP_URL = 'https://stijn.github.io/recepten/';

/** A schema-2-like recipe for size measurements; `bilingual` duplicates name and steps as `en`. */
function toRecipeV2(r: SourceRecipe, bilingual: boolean): Record<string, unknown> {
  const steps = r.instructions.split(/(?<=[.!?])\s+(?=[A-Z0-9À-Ý])/);
  return {
    id: 'b:' + slugId(r.name),
    name: bilingual ? { nl: r.name, en: r.name } : { nl: r.name },
    servings: 4,
    lines: r.ingredients.map((raw) => ({ raw })),
    steps: bilingual ? { nl: steps, en: steps } : { nl: steps },
  };
}

function envelopeFor(r: SourceRecipe, bilingual = false): Envelope {
  return { v: 2, t: 'r', by: 'stijn', at: '2026-09-24T18:02Z', r: toRecipeV2(r, bilingual) };
}

async function deflatedJson(value: unknown, engine: CodecEngine): Promise<string> {
  return toBase64Url(await deflateRaw(new TextEncoder().encode(JSON.stringify(value)), { engine }));
}

// Frozen v2 token (PLAN §7: "Bevroren tokens uit elke versie staan in token.test.ts"). Produced
// once by the native engine; must keep decoding on both engines forever. A codec change gets a
// NEW fragment key, never a silent reinterpretation of this one.
const FROZEN_TOKEN_V2 =
  'ZY9LagJBFEW38nLHpbSNSlKzEEcZBwIRB6W-1hfr01RVK1FqCVlDthAyz8QVZQmhBSGQ6f1xzwl76FohQyNCYfkGjZTl1UPB9Gpd1dNBdTeox0-jW13VL1BwaQONRyYXONNaMrUxLDmyv6Gfj_cvKEToE2QNjaU2zcEkZ1Zb8Xw01kHBG8d9wlto3P_32UNjJml7MGnLkZKxLngUhcRxL36ToMcKVjwn6PkJ0RygMaa-34jlnGhvPI0mFW1Q1DUwopXkGNj_0c7flC0dQ5dRFgopc5uu3-Z4lt2OLa35Mk3iqQlWeAiFWTRGeucvIE0rcuK7zJ5CS9MJnT8fhliUotB0uYsX7h1zC51jx6X8Ag';
// The same envelope as fflate produced it on 2026-09-28 (different bytes, same meaning):
const FROZEN_TOKEN_V2_FFLATE =
  'ZY9BTsMwEEWvMsw6rdKorcA7RFeskZCounDbSTLEsSPbSUWjHIEzcAXEnk1PxBGYFCGQuhv_9__4T48dqizBiAo9Jrh9kSFEfrby0KOapdlykt5MsvnD7Fql2ZOAOhRC7glqRxH2HKHxbkue7BV8vb1-iMWj6pH3YtsqnR90qPWuZEtHbWrBVtc0OqwRx-0lJyv6ikMppCQPQWRncUgwkO_YFgHVPEEjCZnWPXp9kMQcxnzOhmKATluYLVIoJPZrmMGOo3ey_k87fUI0cHRtxGEjH0RqZOdPtzU-clWRgT2dVwNbyJ1hmkrJldeaR_L_QFimULNtI1lwDSwXcHq_m-JmkO55G1t_vrsialBF39IwfAM';
const FROZEN_ENVELOPE_V2: Envelope = {
  v: 2,
  t: 'r',
  by: 'stijn',
  at: '2026-09-24T18:02Z',
  msg: 'Je moet dit proberen! \u{1F372}',
  r: {
    id: 'b:afwasmachinezalm',
    name: { nl: 'Afwasmachinezalm', en: 'Dishwasher salmon' },
    servings: 4,
    lines: [{ raw: '4 zalmfilets van 150 g' }, { raw: '1 citroen' }, { raw: '½ tl zout' }],
    steps: { nl: ['Wikkel de zalm in folie.', 'Draai de afwasmachine 60 minuten op 65 °C.'] },
  },
  future: { keep: true },
};

describe('token codec', () => {
  it('loads the 196 source recipes', () => {
    expect(recipes).toHaveLength(196);
  });

  it('has native CompressionStream(deflate-raw) in Node 22', () => {
    expect(isCompressionStreamAvailable()).toBe(true);
  });

  for (const engine of ENGINES) {
    const other: CodecEngine = engine === 'native' ? 'fflate' : 'native';

    describe(`engine ${engine}`, () => {
      it('round-trips all 196 recipes and the other engine decodes the same tokens', async () => {
        for (const r of recipes) {
          const env = envelopeFor(r);
          const token = await encodeToken(env, { engine });
          expect(token).toMatch(ALPHABET);
          expect(token.length).toBeGreaterThanOrEqual(MIN_TOKEN_LENGTH);
          expect(await decodeToken(token, { engine })).toEqual(env);
          expect(await decodeToken(token, { engine: other })).toEqual(env);
        }
      });

      it('inflates to byte-identical input on both engines', async () => {
        const input = new TextEncoder().encode(JSON.stringify(envelopeFor(recipes[0]!, true)));
        const deflated = await deflateRaw(input, { engine });
        expect(deflated.length).toBeLessThan(input.length);
        expect(Array.from(await inflateRaw(deflated, { engine }))).toEqual(Array.from(input));
        expect(Array.from(await inflateRaw(deflated, { engine: other }))).toEqual(Array.from(input));
      });

      it('decodes the frozen v2 tokens (native- and fflate-produced)', async () => {
        expect(await decodeToken(FROZEN_TOKEN_V2, { engine })).toEqual(FROZEN_ENVELOPE_V2);
        expect(await decodeToken(FROZEN_TOKEN_V2_FFLATE, { engine })).toEqual(FROZEN_ENVELOPE_V2);
      });

      it('decodes the frozen phase-3 #p= and #b= tokens (native- and fflate-produced)', async () => {
        expect(await decodeToken(FROZEN_TOKEN_P, { engine })).toEqual(FROZEN_ENVELOPE_P);
        expect(await decodeToken(FROZEN_TOKEN_P_FFLATE, { engine })).toEqual(FROZEN_ENVELOPE_P);
        expect(await decodeToken(FROZEN_TOKEN_B, { engine })).toEqual(FROZEN_ENVELOPE_B);
        expect(await decodeToken(FROZEN_TOKEN_B_FFLATE, { engine })).toEqual(FROZEN_ENVELOPE_B);
      });

      it('decodes the frozen phase-5 #f= member-card token (native- and fflate-produced)', async () => {
        expect(await decodeToken(FROZEN_TOKEN_F, { engine })).toEqual(FROZEN_ENVELOPE_F);
        expect(await decodeToken(FROZEN_TOKEN_F_FFLATE, { engine })).toEqual(FROZEN_ENVELOPE_F);
        // The frozen token IS what this codec produces for that envelope today (byte-for-byte).
        const expected = engine === 'native' ? FROZEN_TOKEN_F : FROZEN_TOKEN_F_FFLATE;
        expect(await encodeToken(FROZEN_ENVELOPE_F, { engine })).toBe(expected);
      });
    });
  }

  it('auto engine is the native one where available', async () => {
    const env = envelopeFor(recipes[10]!);
    expect(await encodeToken(env)).toBe(await encodeToken(env, { engine: 'native' }));
    expect(await decodeToken(await encodeToken(env, { engine: 'fflate' }))).toEqual(env);
  });

  it('preserves unknown keys, nested and top-level', async () => {
    const env: Envelope = { v: 2, t: 'w', weekStart: '2026-09-28', entries: [{ rid: 'b:dahl', day: 1, x: null }], zzz: 1 };
    expect(await decodeToken(await encodeToken(env))).toEqual(env);
  });

  it('keeps UTF-8 intact (emoji, diacritics, fractions)', async () => {
    const env: Envelope = { v: 2, t: 'r', msg: '\u{1F372} Rösti ½ – “ok”' };
    expect(await decodeToken(await encodeToken(env))).toEqual(env);
  });

  it('throws invalid-token for anything that is not a v2 envelope', async () => {
    const bad: string[] = [
      '',
      'not a token',
      'abc+def/ghi=',
      'abcdefghijklmnopqrstuvwxy', // length % 4 === 1: impossible base64
      toBase64Url(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 250, 251])), // not a deflate stream
      await deflatedJson('hello', 'native'),
      await deflatedJson([1, 2], 'native'),
      await deflatedJson(null, 'native'),
      await deflatedJson({ t: 'r' }, 'native'), // no v
      await deflatedJson({ v: '2', t: 'r' }, 'native'), // v not a number
      await deflatedJson({ v: 2, t: 'x' }, 'fflate'), // unknown key
      await deflatedJson({ v: 2 }, 'fflate'), // no t
      toBase64Url(await deflateRaw(new TextEncoder().encode('{"v":2,"t":"r"'), { engine: 'native' })), // truncated JSON
    ];
    for (const token of bad) {
      await expect(decodeToken(token), token).rejects.toThrow('invalid-token');
    }
  });

  it('throws unsupported-version for v other than 2', async () => {
    await expect(decodeToken(await deflatedJson({ v: 3, t: 'r' }, 'native'))).rejects.toThrow('unsupported-version');
    await expect(decodeToken(await deflatedJson({ v: 1, t: 'r' }, 'fflate'))).rejects.toThrow('unsupported-version');
  });

  // Pinned on purpose (block F): a kind the app does not know is 'invalid-token', NOT
  // 'unsupported-version', because "update the app" hangs on `v` and `v` stays 2. That is exactly
  // what an app from before block F says about a `#f=` card ("no readable recipe"), and what this
  // app will say about the next new kind. Adding a kind therefore means: both phones update first.
  it('a v2 envelope with an unknown kind is invalid-token (what a pre-block-F app makes of #f=)', async () => {
    await expect(decodeToken(await deflatedJson({ v: 2, t: 'x', x: { id: 'p:1', name: 'A' } }, 'native'))).rejects.toThrow('invalid-token');
    await expect(decodeToken(await deflatedJson({ v: 2, t: 'x', x: { id: 'p:1', name: 'A' } }, 'fflate'))).rejects.toThrow('invalid-token');
    // The pre-block-F key set never matched "#f=" at all, so a pasted card was simply no token there.
    const OLD_TOKEN_RE = /(?:^|[^A-Za-z0-9_-])#?([rpwb])=([A-Za-z0-9_-]{20,})/g;
    expect([...`${APP_URL}#f=${FROZEN_TOKEN_F}`.matchAll(OLD_TOKEN_RE)]).toHaveLength(0);
    expect(extractTokens(`${APP_URL}#f=${FROZEN_TOKEN_F}`)).toEqual([{ key: 'f', token: FROZEN_TOKEN_F }]);
  });

  it('isTokenKey', () => {
    expect(['r', 'p', 'w', 'b', 'f'].every(isTokenKey)).toBe(true);
    expect(['s', 'R', 'F', '', 1, null, undefined].some(isTokenKey)).toBe(false);
  });
});

describe('base64url', () => {
  it('uses only [A-Za-z0-9_-] and no padding, for every byte length mod 4', () => {
    for (let len = 0; len <= 12; len++) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 61 + 250) & 0xff);
      const text = toBase64Url(bytes);
      if (len > 0) expect(text).toMatch(ALPHABET);
      expect(text).not.toMatch(/[+/=]/);
      expect(Array.from(fromBase64Url(text))).toEqual(Array.from(bytes));
    }
  });

  it('round-trips all 256 byte values and long input', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i & 0xff);
    const text = toBase64Url(bytes);
    expect(text).toMatch(ALPHABET);
    expect(Array.from(fromBase64Url(text))).toEqual(Array.from(bytes));
  });

  it('rejects the standard alphabet and impossible lengths', () => {
    expect(() => fromBase64Url('ab+c')).toThrow();
    expect(() => fromBase64Url('ab/c')).toThrow();
    expect(() => fromBase64Url('abc=')).toThrow();
    expect(() => fromBase64Url('abcde')).toThrow();
  });
});

describe('extractTokens', () => {
  const T1 = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abc';
  const T2 = 'ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210_-xyz';

  it('finds two tokens in a realistic WhatsApp message, in order', async () => {
    const t1 = await encodeToken(envelopeFor(recipes[4]!));
    const t2 = await encodeToken(envelopeFor(recipes[5]!));
    const message = [
      '\u{1F372} Afwasmachinezalm · Dishwasher salmon',
      '4 pers · 10 ingrediënten · van Stijn',
      "Open in Rutgers' Recepten (of tik voor een voorproefje / or tap to preview):",
      `${APP_URL}#r=${t1}`,
      '',
      'En deze ook nog \u{1F600}',
      `${APP_URL}#r=${t2}`,
    ].join('\n');
    expect(extractTokens(message)).toEqual([
      { key: 'r', token: t1 },
      { key: 'r', token: t2 },
    ]);
  });

  it('finds the token in a bare URL', () => {
    expect(extractTokens(`${APP_URL}#p=${T1}`)).toEqual([{ key: 'p', token: T1 }]);
    expect(extractTokens(`https://x.github.io/recepten#w=${T1}`)).toEqual([{ key: 'w', token: T1 }]);
  });

  it('accepts a bare "r=…" token and "#b=…"', () => {
    expect(extractTokens(`r=${T1}`)).toEqual([{ key: 'r', token: T1 }]);
    expect(extractTokens(`  #b=${T2}\n`)).toEqual([{ key: 'b', token: T2 }]);
  });

  it('stops at punctuation WhatsApp may glue to a link', () => {
    expect(extractTokens(`Kijk (${APP_URL}#r=${T1}).`)).toEqual([{ key: 'r', token: T1 }]);
    expect(extractTokens(`${APP_URL}#r=${T1}, en ${APP_URL}#r=${T2}!`)).toEqual([
      { key: 'r', token: T1 },
      { key: 'r', token: T2 },
    ]);
  });

  it('returns a repeated identical link once (quoted replies)', () => {
    expect(extractTokens(`${APP_URL}#r=${T1}\n> ${APP_URL}#r=${T1}`)).toEqual([{ key: 'r', token: T1 }]);
    expect(extractTokens(`#r=${T1} #p=${T1}`)).toHaveLength(2);
  });

  it('ignores short tokens, unknown keys and keys glued to a word', () => {
    expect(extractTokens('#r=abcdefghij')).toEqual([]);
    expect(extractTokens(`#s=${T1}`)).toEqual([]);
    expect(extractTokens(`user=${T1} foor=${T1} _r=${T1}`)).toEqual([]);
    expect(extractTokens('')).toEqual([]);
    expect(extractTokens('Gewoon een bericht zonder link, met r= en #p= erin.')).toEqual([]);
  });

  it('extracts what buildShareUrl built, for every key', () => {
    for (const key of ['r', 'p', 'w', 'b', 'f'] as const) {
      const url = buildShareUrl(APP_URL, key, T2);
      expect(url).toBe(`${APP_URL}#${key}=${T2}`);
      expect(extractTokens(`Hoi! ${url}`)).toEqual([{ key, token: T2 }]);
    }
  });
});

describe('buildShareUrl', () => {
  it('appends #<key>=<token> to the app URL', () => {
    expect(buildShareUrl('https://x.github.io/recepten/', 'r', 'abc')).toBe('https://x.github.io/recepten/#r=abc');
  });

  it('replaces an existing hash route', () => {
    expect(buildShareUrl('https://x.github.io/recepten/#/import', 'p', 'abc')).toBe('https://x.github.io/recepten/#p=abc');
  });
});

describe('token size (PLAN §7 expects ~1 KB per NL recipe, 1.5-2 KB bilingual)', () => {
  async function measure(bilingual: boolean) {
    const lengths: number[] = [];
    for (const r of recipes) lengths.push((await encodeToken(envelopeFor(r, bilingual))).length);
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);
    const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    const largest = recipes[lengths.indexOf(max)]!.name;
    return { max, min, avg, largest };
  }

  it('measures Dutch and fake bilingual tokens', async () => {
    const nl = await measure(false);
    const bi = await measure(true);
    console.log(`token length NL:        max ${nl.max} avg ${nl.avg} min ${nl.min} chars (largest: ${nl.largest})`);
    console.log(`token length bilingual: max ${bi.max} avg ${bi.avg} min ${bi.min} chars (largest: ${bi.largest})`);
    console.log(`two average NL recipes in one message: ~${2 * (nl.avg + APP_URL.length + 3) + 160} chars of the ~3500 budget`);
    expect(nl.avg).toBeLessThan(1500);
    expect(nl.max).toBeLessThan(3500);
    expect(bi.avg).toBeLessThan(2500);
  });
});

describe('recipe-source', () => {
  it('normalizes the 196 records and keeps the text of the stray "" key', () => {
    for (const r of recipes) {
      expect(Object.keys(r).sort()).toEqual(['ingredients', 'instructions', 'name']);
      expect(r.name).toBe(r.name.trim());
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.ingredients.every((line) => line === line.trim() && line.length > 0)).toBe(true);
    }
    const rendang = recipes.find((r) => r.name.startsWith('Rendang'))!;
    expect(rendang.instructions).toMatch(/^Boemboe: /);
    expect(rendang.instructions).toContain('\n\nRendang: Vlees van vet');
    expect(rendang.ingredients).toContain('Boemboe:');
    expect(rendang.ingredients).not.toContain('');
  });

  it('keeps the source order', () => {
    expect(recipes[0]!.name).toBe('Aardappel-broccoli gratin');
    expect(recipes[4]!.name).toBe('Afwasmachinezalm');
  });

  it('accepts {recipes:[…]}, skips nameless items, rejects non-lists', () => {
    const one = { name: '  Twee   spaties ', ingredients: [' 1 ei ', '', 42], instructions: 'Kook.\r\nEet.  ', '': '', extra: 1 };
    expect(normalizeSource({ recipes: [one, { ingredients: [] }, null, 'x'] })).toEqual([
      { name: 'Twee spaties', ingredients: ['1 ei'], instructions: 'Kook.\nEet.' },
    ]);
    expect(normalizeSource([{ name: 'A' }])).toEqual([{ name: 'A', ingredients: [], instructions: '' }]);
    for (const bad of [null, undefined, 'x', 1, {}, { recipes: 'x' }]) {
      expect(() => normalizeSource(bad)).toThrow('invalid-source');
    }
  });

  it('slugId strips diacritics and punctuation', () => {
    expect(slugId('Salade Niçoise')).toBe('salade-nicoise');
    expect(slugId('Penne all’ arrabbiata')).toBe('penne-all-arrabbiata');
    expect(slugId('Zalm en croûte (in bladerdeeg)')).toBe('zalm-en-croute-in-bladerdeeg');
    expect(slugId('  Rösti!!  ')).toBe('rosti');
    expect(slugId('Spaanse rösti met spinazie')).toBe('spaanse-rosti-met-spinazie');
    expect(slugId('Aardappel-broccoli gratin')).toBe('aardappel-broccoli-gratin');
    expect(slugId('Ĳsbergsla ß')).toBe('ijsbergsla-ss');
    expect(slugId('')).toBe('');
  });

  it('slugId is unique across the 196 classics', () => {
    const slugs = recipes.map((r) => slugId(r.name));
    expect(new Set(slugs).size).toBe(196);
    expect(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))).toBe(true);
  });

  it('initialOf', () => {
    expect(initialOf('Afwasmachinezalm')).toBe('A');
    expect(initialOf('Émincé van kip')).toBe('E');
    expect(initialOf('ijsje')).toBe('I');
    expect(initialOf('3-gangenmenu')).toBe('#');
    expect(initialOf('  zalm')).toBe('Z');
    expect(initialOf('')).toBe('#');
    expect(initialOf('(iets)')).toBe('#');
    const initials = new Set(recipes.map((r) => initialOf(r.name)));
    expect([...initials].every((c) => /^[A-Z]$/.test(c))).toBe(true);
  });

  it('foldDiacritics keeps case and spacing', () => {
    expect(foldDiacritics('Crème brûlée à la Rösti')).toBe('Creme brulee a la Rosti');
    expect(foldDiacritics('Øl & œuf')).toBe('Ol & oeuf');
  });
});
