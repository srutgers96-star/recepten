// The avatar domain (src/domain/avatar.ts; docs/specs/badges-avatar.md §2f, §6a, block 6D-3): the
// parts library from data/avatar-parts.json, the tolerant spec reader, completeness, unlocking,
// the level ring, the default and random avatar, and the SVG string renderer.
import { describe, expect, it } from 'vitest';
import partsJson from '../data/avatar-parts.json';
import badgesJson from '../data/badges.json';
import {
  AVATAR_HAIR,
  AVATAR_MAKER_LEVEL,
  AVATAR_TONES,
  LAYER_ORDER,
  REQUIRED_LAYERS,
  defaultAvatar,
  isComplete,
  isUnlocked,
  makerTileName,
  normalizeAvatarParts,
  normalizeAvatarSpec,
  randomAvatar,
  renderAvatarSvg,
  ringForLevel,
  type AvatarPart,
  type AvatarSpec,
} from '../src/domain/avatar';
import { TIER_COLOURS, normalizeBadges } from '../src/domain/badges';

const BADGES = normalizeBadges(badgesJson as unknown);
const PARTS = normalizeAvatarParts(partsJson as unknown, BADGES);
const BY_ID: ReadonlyMap<string, AvatarPart> = new Map(PARTS.map((p) => [p.id, p]));

function part(id: string): AvatarPart {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`no part ${id}`);
  return p;
}

const NO_BADGES: ReadonlyMap<string, number> = new Map();

describe('normalizeAvatarParts', () => {
  it('reads the real library: 66 parts, unique ids, every id starts with its layer', () => {
    expect(PARTS).toHaveLength(66);
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(66);
    for (const p of PARTS) {
      expect(LAYER_ORDER).toContain(p.layer);
      expect(p.id.startsWith(`${p.layer}-`)).toBe(true);
      expect(p.nl.length).toBeGreaterThan(0);
      expect(p.en.length).toBeGreaterThan(0);
    }
    // Without the catalogue the same 66 parts come through (only the badge tiers are missing).
    expect(normalizeAvatarParts(partsJson as unknown)).toHaveLength(66);
  });

  it('every required layer has a level-3 part; 22 parts come from badges, 44 from levels', () => {
    for (const layer of REQUIRED_LAYERS) {
      expect(PARTS.some((p) => p.layer === layer && 'level' in p.unlock && p.unlock.level === AVATAR_MAKER_LEVEL)).toBe(true);
    }
    expect(PARTS.filter((p) => 'badge' in p.unlock)).toHaveLength(22);
    expect(PARTS.filter((p) => 'level' in p.unlock)).toHaveLength(44);
  });

  it("copies a ladder badge's unlock tier onto its part; a one-off badge's part has none", () => {
    expect(part('hat-cheese').unlock).toEqual({ badge: 'kaaskop', tier: 3 });
    expect(part('hat-pan').unlock).toEqual({ badge: 'huiskok', tier: 5 });
    expect(part('hat-santa').unlock).toEqual({ badge: 'kerstkok', tier: 1 });
    expect(part('eyes-sleepy').unlock).toEqual({ badge: 'nachtbraker' });
    expect(part('pin-medal-gold').unlock).toEqual({ badge: 'het-hele-boek' });
    expect(part('face-round').unlock).toEqual({ level: 3 });
    // Without the catalogue a badge part carries no tier (counts as a one-off).
    const bare = normalizeAvatarParts(partsJson as unknown).find((p) => p.id === 'hat-cheese');
    expect(bare?.unlock).toEqual({ badge: 'kaaskop' });
  });

  it('is tolerant: garbage gives [], unusable entries are skipped, the first of a duplicate id wins', () => {
    expect(normalizeAvatarParts(null)).toEqual([]);
    expect(normalizeAvatarParts({ parts: [] })).toEqual([]);
    expect(normalizeAvatarParts('x')).toEqual([]);
    const ok = { id: 'hat-test', layer: 'hat', nl: 'Test', en: 'Test', unlock: { level: 4 }, svg: '<circle cx="50" cy="20" r="5"/>' };
    const out = normalizeAvatarParts([
      ok,
      { ...ok, nl: 'Tweede' }, // duplicate id
      { ...ok, id: 'test-hat' }, // id without its layer prefix
      { ...ok, id: 'cape-x', layer: 'cape' }, // unknown layer
      { ...ok, id: 'hat-no-nl', nl: '' },
      { ...ok, id: 'hat-no-unlock', unlock: undefined },
      { ...ok, id: 'hat-both', unlock: { level: 4, badge: 'kaaskop' } },
      { ...ok, id: 'hat-level-0', unlock: { level: 0 } },
      { ...ok, id: 'hat-Upper' },
      { ...ok, id: 'hat-script', svg: '<script>alert(1)</script>' },
      { ...ok, id: 'hat-href', svg: '<a href="https://x"><circle r="1"/></a>' },
      { ...ok, id: 'hat-onload', svg: '<circle r="1" onload="x()"/>' },
      { ...ok, id: 'hat-style', svg: '<circle r="1" style="fill:url(https://x)"/>' },
      { ...ok, id: 'hat-no-svg', svg: undefined },
      { ...ok, id: 'hat-tone', svg: '<circle r="1" style="fill:var(--tone)"/>' },
      { ...ok, id: 'bg-empty', layer: 'bg', svg: '' },
      { ...ok, id: 'hat-badge', unlock: { badge: 'kaaskop' } },
      42,
      null,
    ], BADGES);
    expect(out.map((p) => p.id)).toEqual(['hat-test', 'hat-tone', 'bg-empty', 'hat-badge']);
    expect(out[0]!.nl).toBe('Test');
    // hat-badge names kaaskop, but kaaskop's unlock.part is hat-cheese: no tier is borrowed.
    expect(out[3]!.unlock).toEqual({ badge: 'kaaskop' });
  });
});

describe('normalizeAvatarSpec', () => {
  it('accepts a v1 spec with parts', () => {
    expect(normalizeAvatarSpec({ v: 1, parts: ['face-round'] })).toEqual({ v: 1, parts: ['face-round'] });
  });

  it('anything without v 1 and a parts array is null (no usable avatar)', () => {
    for (const v of [{ v: 2 }, { v: 2, parts: ['face-round'] }, { v: 1 }, { v: '1', parts: ['face-round'] }, null, 'face-round', [], 3]) {
      expect(normalizeAvatarSpec(v)).toBeNull();
    }
    // No usable part left: null too.
    expect(normalizeAvatarSpec({ v: 1, parts: [] })).toBeNull();
    expect(normalizeAvatarSpec({ v: 1, parts: [1, null, {}, 'nonsense', 'Face-Round'] })).toBeNull();
  });

  it('filters non-strings and ids without a known layer; keeps the order; at most one per layer (first wins)', () => {
    const spec = normalizeAvatarSpec({ v: 1, parts: [' hat-toque ', 7, 'face-round', null, 'face-oval', 'cape-red', 'eyes-dots'] });
    expect(spec?.parts).toEqual(['hat-toque', 'face-round', 'eyes-dots']);
    // 'facial-…' is its own layer, not 'face'.
    expect(normalizeAvatarSpec({ v: 1, parts: ['face-round', 'facial-beard'] })?.parts).toEqual(['face-round', 'facial-beard']);
  });

  it("keeps ids this library does not know (a newer phone's part; skipped when drawing)", () => {
    expect(normalizeAvatarSpec({ v: 1, parts: ['hat-wizard', 'face-round'] })?.parts).toEqual(['hat-wizard', 'face-round']);
  });

  it('keeps tone and hair only when they are palette colours; unknown keys are preserved', () => {
    expect(normalizeAvatarSpec({ v: 1, parts: ['face-round'], tone: '#123456' })).toEqual({ v: 1, parts: ['face-round'] });
    expect(normalizeAvatarSpec({ v: 1, parts: ['face-round'], tone: '#E0B08A', hair: ' #2b6fd6 ' })).toEqual({ v: 1, parts: ['face-round'], tone: '#e0b08a', hair: '#2b6fd6' });
    expect(normalizeAvatarSpec({ v: 1, parts: ['face-round'], hair: 'red' })).toEqual({ v: 1, parts: ['face-round'] });
    expect(normalizeAvatarSpec({ v: 1, parts: ['face-round'], pose: 'wave' })).toEqual({ v: 1, parts: ['face-round'], pose: 'wave' });
  });
});

describe('isComplete', () => {
  it('the default avatar is complete; without a mouth it is not', () => {
    expect(isComplete(defaultAvatar(), BY_ID)).toBe(true);
    const noMouth: AvatarSpec = { v: 1, parts: defaultAvatar().parts.filter((id) => !id.startsWith('mouth-')) };
    expect(isComplete(noMouth, BY_ID)).toBe(false);
  });

  it('an unknown id does not fill its layer', () => {
    expect(isComplete({ v: 1, parts: ['face-round', 'eyes-dots', 'mouth-future', 'body-tee'] }, BY_ID)).toBe(false);
    expect(isComplete({ v: 1, parts: ['face-round', 'eyes-dots', 'mouth-smile', 'body-tee'] }, BY_ID)).toBe(true);
  });
});

describe('isUnlocked', () => {
  it('a level part from its level on', () => {
    const wink = part('eyes-wink'); // level 5
    expect(isUnlocked(wink, { level: 5, badgeTiers: NO_BADGES })).toBe(true);
    expect(isUnlocked(wink, { level: 40, badgeTiers: NO_BADGES })).toBe(true);
    expect(isUnlocked(wink, { level: 4, badgeTiers: NO_BADGES })).toBe(false);
  });

  it('a ladder-badge part once the badge reached the unlock tier', () => {
    const cheese = part('hat-cheese'); // kaaskop at tier 3 (blue)
    expect(isUnlocked(cheese, { level: 100, badgeTiers: NO_BADGES })).toBe(false);
    expect(isUnlocked(cheese, { level: 3, badgeTiers: new Map([['kaaskop', 2]]) })).toBe(false);
    expect(isUnlocked(cheese, { level: 3, badgeTiers: new Map([['kaaskop', 3]]) })).toBe(true);
    expect(isUnlocked(cheese, { level: 3, badgeTiers: new Map([['kaaskop', 8]]) })).toBe(true);
    expect(isUnlocked(cheese, { level: 3, badgeTiers: new Map([['zuurpruim', 8]]) })).toBe(false);
  });

  it('a one-off badge part (no tier) once the badge is earned (tier ≥ 1)', () => {
    const sleepy = part('eyes-sleepy'); // nachtbraker, secret one-off
    expect(isUnlocked(sleepy, { level: 3, badgeTiers: NO_BADGES })).toBe(false);
    expect(isUnlocked(sleepy, { level: 3, badgeTiers: new Map([['nachtbraker', 1]]) })).toBe(true);
    const handMade: AvatarPart = { id: 'pin-x', layer: 'pin', nl: 'x', en: 'x', unlock: { badge: 'b' }, svg: '' };
    expect(isUnlocked(handMade, { level: 1, badgeTiers: new Map([['b', 1]]) })).toBe(true);
    expect(isUnlocked(handMade, { level: 1, badgeTiers: new Map([['b', 0]]) })).toBe(false);
  });
});

describe('makerTileName', () => {
  const badge = (id: string) => BADGES.find((b) => b.id === id) ?? null;
  const badgeOf = (p: AvatarPart) => ('badge' in p.unlock ? badge(p.unlock.badge) : null);

  it("a locked part of a secret badge never carries that badge's name (pin-heart = hartje)", () => {
    expect(makerTileName(part('pin-heart'), 'nl', false, badge('hartje'))).toBe('');
    expect(makerTileName(part('pin-heart'), 'en', false, badge('hartje'))).toBe('');
    for (const p of PARTS) {
      const b = badgeOf(p);
      if (b?.hidden !== true) continue;
      for (const lang of ['nl', 'en'] as const) {
        const name = makerTileName(p, lang, false, b).toLocaleLowerCase();
        expect(name.includes(b.nl.name.toLocaleLowerCase())).toBe(false);
        expect(name.includes(b.en.name.toLocaleLowerCase())).toBe(false);
      }
    }
  });

  it('keeps the part name otherwise: unlocked, a level part, a visible badge, a secret badge with another name', () => {
    expect(makerTileName(part('pin-heart'), 'nl', true, badge('hartje'))).toBe('Hartje');
    expect(makerTileName(part('eyes-sleepy'), 'nl', false, badge('nachtbraker'))).toBe('Slaperig');
    expect(makerTileName(part('hat-cheese'), 'en', false, badge('kaaskop'))).toBe('Cheese-wedge hat');
    expect(makerTileName(part('prop-aubergine'), 'nl', false, badge('aubergineknuffel'))).toBe('Aubergineknuffel');
    expect(makerTileName(part('hair-mohawk'), 'nl', false, null)).toBe('Hanenkam');
  });
});

describe('ringForLevel', () => {
  it('null under 5, then the eight colours per level band', () => {
    const table: Array<[number, string | null]> = [
      [1, null], [4, null], [5, 'geel'], [9, 'geel'], [10, 'groen'], [19, 'groen'], [20, 'blauw'], [30, 'rood'],
      [40, 'brons'], [50, 'zilver'], [60, 'goud'], [79, 'goud'], [80, 'platina'], [100, 'platina'],
    ];
    for (const [level, colour] of table) expect(ringForLevel(level)).toBe(colour);
  });

  it('uses exactly the TIER_COLOURS of the badges, in order', () => {
    expect([5, 10, 20, 30, 40, 50, 60, 80].map(ringForLevel)).toEqual([...TIER_COLOURS]);
  });
});

describe('defaultAvatar and randomAvatar', () => {
  it('the default avatar: round face, dots, smile, short hair, T-shirt; complete', () => {
    const d = defaultAvatar();
    expect(d.v).toBe(1);
    expect(d.parts).toEqual(['face-round', 'eyes-dots', 'mouth-smile', 'hair-short', 'body-tee']);
    expect(isComplete(d, BY_ID)).toBe(true);
    expect(normalizeAvatarSpec(d)).toEqual(d);
  });

  it('the same seed gives the same avatar; it is complete and uses only unlocked parts', () => {
    const ctx = { level: 3, badgeTiers: NO_BADGES };
    const unlocked = PARTS.filter((p) => isUnlocked(p, ctx));
    const ids = new Set(unlocked.map((p) => p.id));
    for (const seed of [1, 42, 1730200000000, 1730200000001, 7]) {
      const a = randomAvatar(unlocked, seed);
      expect(randomAvatar(unlocked, seed)).toEqual(a);
      expect(isComplete(a, BY_ID)).toBe(true);
      for (const id of a.parts) expect(ids.has(id)).toBe(true);
      expect(normalizeAvatarSpec(a)).toEqual(a); // one per layer, palette colours
      expect(AVATAR_TONES as readonly string[]).toContain(a.tone);
      expect(AVATAR_HAIR as readonly string[]).toContain(a.hair);
      // Parts come in drawing order.
      const order = a.parts.map((id) => LAYER_ORDER.indexOf(BY_ID.get(id)!.layer));
      expect(order).toEqual([...order].sort((x, y) => x - y));
    }
  });

  it('different seeds give different avatars; optional layers are sometimes empty, sometimes filled', () => {
    const all = PARTS;
    const specs = Array.from({ length: 60 }, (_, i) => randomAvatar(all, 1000 + i));
    expect(new Set(specs.map((s) => JSON.stringify(s))).size).toBeGreaterThan(30);
    const withHat = specs.filter((s) => s.parts.some((id) => id.startsWith('hat-'))).length;
    expect(withHat).toBeGreaterThan(10);
    expect(withHat).toBeLessThan(50);
    for (const s of specs) expect(isComplete(s, BY_ID)).toBe(true);
  });
});

describe('renderAvatarSvg', () => {
  const spec: AvatarSpec = { v: 1, parts: ['hat-toque', 'face-round', 'eyes-happy', 'mouth-grin', 'body-apron', 'bg-gradient'], tone: '#e0b08a', hair: '#8a5a2b' };

  it('has the fixed structure: clip path with the uid, the profile colour, the layers, no ring under level 5', () => {
    const svg = renderAvatarSvg(spec, BY_ID, { color: '#d9402b', level: 3, uid: 'av7' });
    expect(svg.startsWith('<svg viewBox="0 0 100 100" class="avatar-svg" style="--tone:#e0b08a;--hair:#8a5a2b" aria-hidden="true">')).toBe(true);
    expect(svg).toContain('<defs><clipPath id="c-av7"><circle cx="50" cy="50" r="46"/></clipPath></defs>');
    expect(svg).toContain('<circle cx="50" cy="50" r="46" fill="#d9402b"/>');
    expect(svg).toContain('<g clip-path="url(#c-av7)">');
    expect(svg).toContain('id="c-av7"');
    expect(svg).toContain('url(#c-av7)');
    expect(svg).not.toContain('__u');
    expect(svg).toContain('id="g1-av7"'); // bg-gradient's own id got the uid
    expect(svg).toContain('url(#g1-av7)');
    expect(svg).not.toContain('r="48"');
    expect(svg.endsWith('</g></svg>')).toBe(true);
    expect(svg).not.toMatch(/<script/i);
  });

  it('draws the layers in LAYER_ORDER, whatever the order in the spec', () => {
    const svg = renderAvatarSvg(spec, BY_ID, { color: '#2b4fa8', level: 0, uid: 'x' });
    const at = (id: string) => svg.indexOf(part(id).svg.replaceAll('__u', 'x'));
    expect(at('bg-gradient')).toBeGreaterThan(-1);
    expect(at('bg-gradient')).toBeLessThan(at('body-apron'));
    expect(at('body-apron')).toBeLessThan(at('face-round'));
    expect(at('face-round')).toBeLessThan(at('mouth-grin'));
    expect(at('mouth-grin')).toBeLessThan(at('eyes-happy'));
    expect(at('eyes-happy')).toBeLessThan(at('hat-toque'));
  });

  it('skips an unknown id without an error', () => {
    const svg = renderAvatarSvg({ v: 1, parts: ['face-round', 'hat-wizard', 'eyes-dots', 'mouth-smile', 'body-tee'] }, BY_ID, { color: '#2b4fa8', level: 3, uid: 'u1' });
    expect(svg).toContain(part('face-round').svg);
    expect(svg).not.toContain('wizard');
  });

  it('a ring from level 5: green at level 10, none at level 3', () => {
    const ten = renderAvatarSvg(defaultAvatar(), BY_ID, { color: '#2b4fa8', level: 10, uid: 'r' });
    expect(ten).toContain('<circle cx="50" cy="50" r="48" fill="none" stroke="#3d9a3a" stroke-width="4"/></svg>');
    expect(renderAvatarSvg(defaultAvatar(), BY_ID, { color: '#2b4fa8', level: 5, uid: 'r' })).toContain('stroke="#e6b800"');
    expect(renderAvatarSvg(defaultAvatar(), BY_ID, { color: '#2b4fa8', level: 100, uid: 'r' })).toContain('stroke="#7fd1d6"');
    expect(renderAvatarSvg(defaultAvatar(), BY_ID, { color: '#2b4fa8', level: 3, uid: 'r' })).not.toContain('r="48"');
  });

  it('never puts markup from outside the library into the string: colour, tone, hair and uid are checked', () => {
    const evil = { v: 1, parts: ['face-round'], tone: '"/><script>x()</script>', hair: 'red;}' } as AvatarSpec;
    const svg = renderAvatarSvg(evil, BY_ID, { color: '#fff" onload="x()', level: 3, uid: 'a"b<c' });
    expect(svg).not.toMatch(/<script|onload/i);
    expect(svg).toContain('style="--tone:#f3d2b3;--hair:#4a2c17"'); // palette defaults
    expect(svg).toContain('fill="#2b4fa8"'); // cobalt instead of an unsafe colour
    expect(svg).toContain('id="c-abc"');
  });

  it('every part of the library renders (one at a time), with every __u replaced', () => {
    for (const p of PARTS) {
      const svg = renderAvatarSvg({ v: 1, parts: [p.id] }, BY_ID, { color: '#eeeeee', level: 0, uid: 'p1' });
      expect(svg).toContain(p.svg.replaceAll('__u', 'p1'));
      expect(svg).not.toContain('__u');
    }
  });
});
