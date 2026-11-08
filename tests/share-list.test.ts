// 13c (docs/specs/opschoonronde.md §2B.1–§2B.3): the list builder in src/domain/share-list.ts. A long
// list keeps its LINK (`planMessages` with LIST_LINK_MESSAGE_LIMIT gives a text, not a file) while the
// QR stays honest (`qrFits` false beyond QR_MAX_URL_CHARS); the optional `variant` travels and is read
// tolerantly; the plain-text limit (DEFAULT_MESSAGE_LIMIT) is unchanged.
import { describe, expect, it } from 'vitest';
import type { ListItem } from '../src/domain/aggregate';
import { defaultDictionary } from '../src/domain/data';
import { qrFits, QR_MAX_URL_CHARS } from '../src/domain/qr-fit';
import { DEFAULT_MESSAGE_LIMIT, parseEnvelope, planMessages, readListPayload, type ListShare } from '../src/domain/share';
import { buildListEnvelope, LIST_LINK_MESSAGE_LIMIT } from '../src/domain/share-list';
import { extractTokens } from '../src/domain/token';

const dict = defaultDictionary();
const APP_URL = 'https://stijn.github.io/recepten/';
const TITLE = { nl: '🛒 Boodschappen wk 46', en: '🛒 Shopping wk 46' };

/** `n` list lines over distinct dictionary ingredients, each with an amount in grams. */
function itemsOf(n: number): ListItem[] {
  return dict.ingredients.slice(0, n).map((ing, i) => ({ key: `${ing.id}||g`, ing: ing.id, qty: 100 + i, unit: 'g', aisle: ing.aisle ?? 'overig', section: 'main', sources: [] }));
}

async function linkFor(n: number) {
  const env = buildListEnvelope(itemsOf(n), dict, 'Stijn', { title: TITLE, hideChecked: true, hideInHouse: true });
  const plan = await planMessages([env], APP_URL, { lang: 'nl', by: 'Stijn', name: 'Stijn', limit: LIST_LINK_MESSAGE_LIMIT });
  const text = 'parts' in plan ? plan.parts[0] ?? '' : '';
  const url = text.split('\n').pop() ?? '';
  return { env, plan, text, url };
}

describe('a long list keeps its link (13c §2B.1)', () => {
  it('LIST_LINK_MESSAGE_LIMIT is 20000; the text and QR limits are unchanged', () => {
    expect(LIST_LINK_MESSAGE_LIMIT).toBe(20000);
    expect(DEFAULT_MESSAGE_LIMIT).toBe(3500);
    expect(QR_MAX_URL_CHARS).toBe(1600);
  });

  it('150 lines: a link message (no file), too big for a QR', async () => {
    const { env, plan, text, url } = await linkFor(150);
    expect((env.l as ListShare).lines).toHaveLength(150);
    expect('parts' in plan && plan.parts.length === 1).toBe(true);
    expect(text).toMatch(/^🛒 Boodschappenlijst van Stijn — 150 regels\./);
    expect(extractTokens(text)).toHaveLength(1);
    expect(url).toMatch(/#l=/);
    expect(qrFits(url)).toBe(false);
  });

  it('12 lines: a link message and a QR that fits', async () => {
    const { plan, url } = await linkFor(12);
    expect('parts' in plan && plan.parts.length === 1).toBe(true);
    expect(url).toMatch(/#l=/);
    expect(qrFits(url)).toBe(true);
  });

  it('a link message longer than the text limit still is a text with LIST_LINK_MESSAGE_LIMIT, a file without it', async () => {
    const env = buildListEnvelope(itemsOf(200), dict, 'Stijn', { title: TITLE });
    const long = await planMessages([env], APP_URL, { lang: 'nl', limit: LIST_LINK_MESSAGE_LIMIT });
    expect('parts' in long && long.parts.length === 1 && (long.parts[0] ?? '').length > DEFAULT_MESSAGE_LIMIT).toBe(true);
    // V2: the default is now RECIPE_LINK_MESSAGE_LIMIT (20,000); the old 3,500 limit still gives a file.
    const plain = await planMessages([env], APP_URL, { lang: 'nl', limit: DEFAULT_MESSAGE_LIMIT });
    expect('file' in plain).toBe(true);
  });
});

describe('variant on a shared list line (13c §2B.2)', () => {
  it('is read as a non-empty string; anything else is dropped; unknown keys stay', () => {
    const l = readListPayload({
      title: 'Lijst',
      lines: [
        { raw: { nl: '2 rode uien', en: '2 red onions' }, ing: 'ui', variant: ' rode ', qty: 2 },
        { raw: '3 uien', ing: 'ui', variant: '', qty: 3 },
        { raw: 'prei', ing: 'prei', variant: 7, extra: true },
      ],
    })!;
    expect(l.lines[0]?.variant).toBe('rode');
    expect('variant' in l.lines[1]!).toBe(false);
    expect('variant' in l.lines[2]!).toBe(false);
    expect(l.lines[2]?.extra).toBe(true);
  });

  it('round-trips through parseEnvelope', () => {
    const red: ListItem = { key: 'ui|rode|stuk', ing: 'ui', variant: 'rode', qty: 2, unit: null, aisle: 'groente-fruit', section: 'main', sources: [] };
    const parsed = parseEnvelope(buildListEnvelope([red], dict, 'Stijn', { title: TITLE }));
    expect(parsed.list?.lines[0]).toMatchObject({ raw: { nl: '2 rode uien', en: '2 red onions' }, ing: 'ui', variant: 'rode', qty: 2 });
  });
});
