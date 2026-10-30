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

/**
 * The 66 parts of round 1 (§2f) with their unlock: a level, or the badge that gives it. Ids and
 * unlocks never change (a saved avatar stays valid); round 2 (block 6D-UI) only redrew them.
 */
const ROUND_1: Readonly<Record<string, number | string>> = {
  'face-round': 3, 'face-oval': 3, 'face-square': 3, 'eyes-dots': 3, 'eyes-happy': 3, 'eyes-wink': 5,
  'eyes-star': 'sterrenregen', 'eyes-sleepy': 'nachtbraker', 'mouth-smile': 3, 'mouth-grin': 3, 'mouth-open': 5,
  'mouth-tongue': 'ontdekkingsreiziger', 'mouth-whistle': 8, 'hair-short': 3, 'hair-long': 3, 'hair-curly': 4,
  'hair-bun': 6, 'hair-mohawk': 12, 'hair-broccoli': 'broccolibaas', 'hair-spaghetti': 'pastafarian',
  'hair-flame': 'op-dreef', 'facial-stubble': 5, 'facial-beard': 7, 'facial-moustache': 6,
  'facial-moustache-chili': 'vuurspuwer', 'glasses-round': 4, 'glasses-sun': 9, 'glasses-lemon': 'zuurpruim',
  'glasses-monocle': 30, 'hat-dino': 3, 'hat-bandana': 5, 'hat-beanie': 6, 'hat-toque': 10, 'hat-cheese': 'kaaskop',
  'hat-party': 'feestbeest', 'hat-santa': 'kerstkok', 'hat-strawhat': 'zomerkok', 'hat-pan': 'huiskok',
  'hat-crown': 50, 'body-tee': 3, 'body-apron': 4, 'body-apron-fish': 'fishlover', 'body-striped': 6,
  'body-hoodie': 8, 'body-chef-jacket': 15, 'body-gold-jacket': 60, 'prop-wooden-spoon': 3, 'prop-ladle': 5,
  'prop-whisk': 7, 'prop-knife': 12, 'prop-pepper-mill': 18, 'prop-baguette': 'bon-appetit',
  'prop-carrot-ear': 'wortelwijsneus', 'prop-aubergine': 'aubergineknuffel', 'prop-wine': 'wijnkok',
  'prop-camera': 'foodfotograaf', 'pin-heart': 'hartje', 'pin-star': 20, 'pin-medal-gold': 'het-hele-boek',
  'pin-globe': 'wereldburger', 'bg-color': 3, 'bg-gradient': 8, 'bg-rays': 12, 'bg-stars': 20, 'bg-rainbow': 30,
  'bg-gold': 50,
};

/**
 * Fable's eight reference drawings of round 2 (docs/specs/badges-avatar.md, block 6D-UI, UI-C §3),
 * byte for byte. "hair-cap" (the base of all hair) is hair-short and "body-shirt" (the base of all
 * clothes) is body-tee: together with face-round, eyes-dots and mouth-smile they are exactly the
 * default avatar.
 */
const REFERENCES: Readonly<Record<string, string>> = {
  'face-round': '<circle cx="50" cy="42" r="30" style="fill:var(--tone)" stroke="#2a2420" stroke-width="1.5"/><ellipse cx="50" cy="58" rx="9" ry="3" fill="#2a2420" opacity=".08"/>',
  'eyes-dots': '<circle cx="39" cy="40" r="4.8" fill="#fff" opacity=".9"/><circle cx="61" cy="40" r="4.8" fill="#fff" opacity=".9"/><circle cx="39" cy="40" r="3.2" fill="#2a2420"/><circle cx="61" cy="40" r="3.2" fill="#2a2420"/><circle cx="40.1" cy="38.9" r="1" fill="#fff"/><circle cx="62.1" cy="38.9" r="1" fill="#fff"/>',
  'mouth-smile': '<path d="M41 54q9 9 18 0" fill="none" stroke="#2a2420" stroke-width="2.4" stroke-linecap="round"/>',
  'hair-short': '<path d="M19 40q-3-24 15-27 5-9 16-9t16 9q18 3 15 27-7-10-31-10T19 40z" style="fill:var(--hair)" stroke="#2a2420" stroke-width="1.5" stroke-linejoin="round"/>',
  'body-tee': '<path d="M44 68h12v9H44z" style="fill:var(--tone)"/><path d="M15 100V88q0-12 15-15l20 7 20-7q15 3 15 15v12z" fill="#f1e9dc" stroke="#2a2420" stroke-width="1.5" stroke-linejoin="round"/><path d="M50 80l-7 9h14z" fill="#d9d1c4"/>',
  'hat-toque': '<path d="M22 22q-2-16 28-16t28 16v6H22z" fill="#fff" stroke="#2a2420" stroke-width="1.5"/><rect x="24" y="26" width="52" height="9" rx="2" fill="#efefef" stroke="#2a2420" stroke-width="1.5"/>',
  'prop-wooden-spoon': '<path d="M83 82L79 64" stroke="#8a4a1f" stroke-width="6" stroke-linecap="round"/><ellipse cx="78" cy="56" rx="8" ry="11" fill="#c58a4a" stroke="#2a2420" stroke-width="1.5"/><ellipse cx="78" cy="55" rx="4" ry="6" fill="#a86f33"/>',
  'bg-rays': '<circle cx="50" cy="50" r="62" fill="#fff" opacity=".16"/><path d="M50 50L8 0h18zM50 50L44 0h18zM50 50L80 0h18zM50 50L100 18v18zM50 50L100 60v18zM50 50L0 22v18zM50 50L0 58v18zM50 50L20 100h18zM50 50L62 100h18z" fill="#fff" opacity=".26"/>',
};

/**
 * Props left out of the clip test: Fable's reference spoon (UI-C §3, byte for byte) has its handle
 * end at (87, 96), outside the clip; the Chrome probe measures 20 % of its pixels outside. That is
 * Fable's call; remove the id here when the reference changes.
 */
const CLIP_EXCEPTIONS: ReadonlySet<string> = new Set<string>(); // none since the spoon handle moved to M83 82 (Fable, 30 Oct)

type Point = readonly [number, number];
/** An affine transform [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
type Affine = readonly [number, number, number, number, number, number];
const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

function numbers(s: string): number[] {
  return (s.match(NUMBER) ?? []).map(Number);
}

/** m after k (k is applied first). */
function compose(m: Affine, k: Affine): Affine {
  return [m[0] * k[0] + m[2] * k[1], m[1] * k[0] + m[3] * k[1], m[0] * k[2] + m[2] * k[3], m[1] * k[2] + m[3] * k[3],
    m[0] * k[4] + m[2] * k[5] + m[4], m[1] * k[4] + m[3] * k[5] + m[5]];
}

/** A `transform` attribute: translate, scale, rotate (with or without a centre) and matrix. */
function parseTransform(t: string): Affine {
  let m = IDENTITY;
  for (const [, fn, args] of t.matchAll(/([a-z]+)\s*\(([^)]*)\)/gi)) {
    const n = numbers(args ?? '');
    const [n0 = 0, n1, n2 = 0] = n;
    let k: Affine;
    if (fn === 'translate') k = [1, 0, 0, 1, n0, n1 ?? 0];
    else if (fn === 'scale') k = [n0, 0, 0, n1 ?? n0, 0, 0];
    else if (fn === 'rotate') {
      const a = (n0 * Math.PI) / 180;
      const [c, s, cx, cy] = [Math.cos(a), Math.sin(a), n1 ?? 0, n2];
      k = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
    } else if (fn === 'matrix' && n.length === 6) k = n as unknown as Affine;
    else throw new Error(`unknown transform ${t}`);
    m = compose(m, k);
  }
  return m;
}

/** End points and control points of a path, relative commands resolved (arc flags must be spaced). */
function pathPoints(d: string): Point[] {
  const SIZE: Readonly<Record<string, number>> = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7 };
  const out: Point[] = [];
  let [x, y, sx, sy] = [0, 0, 0, 0];
  for (const [, cmd = '', args = ''] of d.matchAll(/([a-z])([^a-z]*)/gi)) {
    const abs = cmd.toUpperCase();
    if (abs === 'Z') {
      [x, y] = [sx, sy];
      continue;
    }
    const size = SIZE[abs] ?? 0;
    const n = numbers(args);
    for (let i = 0; size > 0 && i + size <= n.length; i += size) {
      const a = n.slice(i, i + size);
      const [ox, oy] = cmd === abs ? [0, 0] : [x, y];
      if (abs === 'H') x = (a[0] ?? 0) + ox;
      else if (abs === 'V') y = (a[0] ?? 0) + oy;
      else {
        if (abs !== 'A') for (let j = 0; j < size - 2; j += 2) out.push([(a[j] ?? 0) + ox, (a[j + 1] ?? 0) + oy]);
        [x, y] = [(a[size - 2] ?? 0) + ox, (a[size - 1] ?? 0) + oy];
      }
      out.push([x, y]);
      if (abs === 'M' && i === 0) [sx, sy] = [x, y];
    }
  }
  return out;
}

/** Every coordinate point of a part's drawing in the 100×100 box, transforms (also of <g>) applied. */
function svgPoints(svg: string): Point[] {
  const out: Point[] = [];
  const stack: Affine[] = [IDENTITY];
  for (const [, close, tag, attrs = '', selfClosing] of svg.matchAll(/<(\/?)([a-z]+)([^>]*?)(\/?)>/g)) {
    if (close) {
      stack.pop();
      continue;
    }
    const at = new Map([...attrs.matchAll(/([a-z-]+)="([^"]*)"/g)].map((a) => [a[1] ?? '', a[2] ?? '']));
    const num = (k: string): number => Number(at.get(k) ?? 0);
    const m = compose(stack[stack.length - 1] ?? IDENTITY, parseTransform(at.get('transform') ?? ''));
    if (tag === 'g') {
      if (!selfClosing) stack.push(m);
      continue;
    }
    let pts: Point[] = [];
    if (tag === 'circle' || tag === 'ellipse') pts = [[num('cx'), num('cy')]];
    else if (tag === 'rect') {
      const [x, y, w, h] = [num('x'), num('y'), num('width'), num('height')];
      pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
    } else if (tag === 'line') pts = [[num('x1'), num('y1')], [num('x2'), num('y2')]];
    else if (tag === 'polygon') {
      const n = numbers(at.get('points') ?? '');
      for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i] ?? 0, n[i + 1] ?? 0]);
    } else if (tag === 'path') pts = pathPoints(at.get('d') ?? '');
    for (const [px, py] of pts) out.push([m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]]);
  }
  return out;
}

describe('normalizeAvatarParts', () => {
  it('reads the real library: every part usable, unique ids, every id starts with its layer', () => {
    const raw = partsJson as unknown[];
    expect(PARTS).toHaveLength(raw.length);
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(raw.length);
    for (const p of PARTS) {
      expect(LAYER_ORDER).toContain(p.layer);
      expect(p.id.startsWith(`${p.layer}-`)).toBe(true);
      expect(p.nl.length).toBeGreaterThan(0);
      expect(p.en.length).toBeGreaterThan(0);
    }
    // Without the catalogue the same parts come through (only the badge tiers are missing).
    expect(normalizeAvatarParts(partsJson as unknown)).toHaveLength(raw.length);
  });

  it('every required layer has a level-3 part; the 22 badge parts of round 1 are still badge parts', () => {
    for (const layer of REQUIRED_LAYERS) {
      expect(PARTS.some((p) => p.layer === layer && 'level' in p.unlock && p.unlock.level === AVATAR_MAKER_LEVEL)).toBe(true);
    }
    expect(PARTS.filter((p) => 'badge' in p.unlock).length).toBeGreaterThanOrEqual(22);
    expect(Object.values(ROUND_1).filter((u) => typeof u === 'string')).toHaveLength(22);
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

describe('the library after round 2 (block 6D-UI, UI-C §2–§4 and §7)', () => {
  /** The minimum per layer after round 2 (§4): together 120. */
  const TARGET: Readonly<Record<string, number>> = {
    hair: 14, hat: 18, body: 14, prop: 18, bg: 12, eyes: 9, mouth: 8, facial: 7, glasses: 7, pin: 8, face: 5,
  };
  const ELEMENTS: ReadonlySet<string> = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'g']);
  /** §2: the presentation attributes, plus the geometry every element needs and the two palette styles. */
  const ATTRIBUTES: ReadonlySet<string> = new Set([
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'transform', 'style',
    'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points',
  ]);
  const tags = (svg: string): RegExpMatchArray[] => [...svg.matchAll(/<([a-z]+)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/g)];

  it('has at least 120 parts and at least the target of §4 per layer', () => {
    expect(PARTS.length).toBeGreaterThanOrEqual(120);
    expect(Object.values(TARGET).reduce((a, b) => a + b, 0)).toBe(120);
    expect(Object.keys(TARGET).sort()).toEqual([...LAYER_ORDER].sort());
    for (const layer of LAYER_ORDER) {
      expect(PARTS.filter((p) => p.layer === layer).length, layer).toBeGreaterThanOrEqual(TARGET[layer] ?? 0);
    }
  });

  it('keeps the 66 parts of round 1 with their layer and unlock; at least 60 parts are new', () => {
    expect(Object.keys(ROUND_1)).toHaveLength(66);
    for (const [id, unlock] of Object.entries(ROUND_1)) {
      const p = part(id);
      expect(id.startsWith(`${p.layer}-`)).toBe(true);
      if (typeof unlock === 'number') expect(p.unlock, id).toEqual({ level: unlock });
      else expect('badge' in p.unlock && p.unlock.badge, id).toBe(unlock);
    }
    expect(PARTS.filter((p) => !(p.id in ROUND_1)).length).toBeGreaterThanOrEqual(60);
  });

  it('every part is at most 1.5 kB and at most 14 elements', () => {
    for (const p of PARTS) {
      expect(new TextEncoder().encode(p.svg).length, p.id).toBeLessThanOrEqual(1500);
      expect((p.svg.match(/<[a-z]/g) ?? []).length, p.id).toBeLessThanOrEqual(14);
    }
  });

  it('draws only with the allowed elements and attributes: no text, no gradient, no style but the two fills', () => {
    for (const p of PARTS) {
      expect(p.svg, p.id).not.toMatch(/<text|gradient|<defs|<use|<image|url\(/i);
      // Nothing but tags: no text node, so no letter or emoji can be drawn.
      expect(p.svg.replace(/<[^>]*>/g, ''), p.id).toBe('');
      expect(p.svg.replace(/<\/g>/g, '').match(/<\//g), p.id).toBeNull();
      const found = tags(p.svg);
      expect(found.length, p.id).toBe((p.svg.match(/<[a-z]/g) ?? []).length);
      for (const m of found) {
        expect(ELEMENTS.has(m[1] ?? ''), `${p.id} <${m[1]}>`).toBe(true);
        for (const a of (m[2] ?? '').matchAll(/([a-z-]+)="([^"]*)"/g)) {
          expect(ATTRIBUTES.has(a[1] ?? ''), `${p.id} ${a[1]}`).toBe(true);
          if (a[1] === 'style') expect(['fill:var(--tone)', 'fill:var(--hair)'], p.id).toContain(a[2]);
        }
      }
    }
  });

  it("holds Fable's eight reference drawings literally", () => {
    for (const [id, svg] of Object.entries(REFERENCES)) expect(part(id).svg, id).toBe(svg);
    // The default avatar is made of the five references of its layers.
    for (const id of defaultAvatar().parts) expect(REFERENCES[id], id).toBeDefined();
  });

  it('every prop stays inside the clip circle (approximation of the 15 % rule, Fable-blik 30 Oct)', () => {
    // The rule: at most 15 % of a prop's pixels outside the clip circle r 46 of renderAvatarSvg
    // (measured with a canvas probe in Chrome). Here, without a browser: at least 85 % of the
    // drawing's coordinate points lie within r 48 of (50, 50).
    for (const p of PARTS.filter((x) => x.layer === 'prop' && !CLIP_EXCEPTIONS.has(x.id))) {
      const points = svgPoints(p.svg);
      expect(points.length, p.id).toBeGreaterThan(0);
      const inside = points.filter(([x, y]) => Math.hypot(x - 50, y - 50) <= 48).length;
      expect(inside / points.length, p.id).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('every level 3–30 unlocks at least one part, and at least one new part; new parts unlock on level 3–60', () => {
    const fresh = PARTS.filter((p) => !(p.id in ROUND_1));
    const levelOf = (p: AvatarPart): number | null => ('level' in p.unlock ? p.unlock.level : null);
    for (let level = 3; level <= 30; level++) {
      expect(PARTS.some((p) => levelOf(p) === level), `level ${level}`).toBe(true);
      expect(fresh.some((p) => levelOf(p) === level), `new on level ${level}`).toBe(true);
    }
    for (const p of fresh) {
      const level = levelOf(p);
      if (level !== null) {
        expect(level, p.id).toBeGreaterThanOrEqual(3);
        expect(level, p.id).toBeLessThanOrEqual(60);
      }
    }
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

  it("replaces every __u in a part's own ids with the uid (the library itself needs none since round 2)", () => {
    const withIds = new Map(BY_ID);
    withIds.set('bg-test', {
      id: 'bg-test', layer: 'bg', nl: 'Test', en: 'Test', unlock: { level: 3 },
      svg: '<defs><linearGradient id="g1-__u"/></defs><rect width="100" height="100" fill="url(#g1-__u)"/>',
    });
    const svg = renderAvatarSvg({ ...spec, parts: [...spec.parts.filter((id) => !id.startsWith('bg-')), 'bg-test'] }, withIds, { color: '#d9402b', level: 3, uid: 'av7' });
    expect(svg).toContain('id="g1-av7"');
    expect(svg).toContain('url(#g1-av7)');
    expect(svg).not.toContain('__u');
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
