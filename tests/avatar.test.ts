// The avatar domain (src/domain/avatar.ts; docs/specs/badges-avatar.md §2f, §6a, block 6D-3): the
// parts library from data/avatar-parts.json, the tolerant spec reader, completeness, unlocking,
// the level ring, the default and random avatar, and the SVG string renderer; the rarity of the
// parts (block 6D-R).
import { describe, expect, it } from 'vitest';
import partsJson from '../data/avatar-parts.json';
import badgesJson from '../data/badges.json';
import {
  AVATAR_HAIR,
  AVATAR_MAKER_LEVEL,
  AVATAR_TONES,
  LAYER_ORDER,
  RARITIES,
  REQUIRED_LAYERS,
  defaultAvatar,
  isComplete,
  isUnlocked,
  makerTileName,
  normalizeAvatarParts,
  normalizeAvatarSpec,
  randomAvatar,
  rarityFor,
  renderAvatarSvg,
  ringForLevel,
  type AvatarPart,
  type AvatarSpec,
  type Rarity,
} from '../src/domain/avatar';
import { TIER_COLOURS, normalizeBadges } from '../src/domain/badges';
import { AVATAR_LAYERS, AVATAR_RARITIES, coversFirstElement, validateAvatarParts } from '../tools/validate-data.ts';

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
 * Round 3 (docs/specs/frames.md §3 and §4, block 6D-F): the 11 frames and the 17 new backgrounds,
 * literally as Fable decided them. Unlock: a level, or [badge, tier]. Frames: accent and clip; the
 * clip as [cx, cy, r] for a circle, 'hexagon' or 'gold-rect'. Backgrounds: whether they cover.
 */
const ROUND_3_FRAMES: Readonly<Record<string, { unlock: number | readonly [string, number]; rarity: Rarity; accent: string; clip: readonly [number, number, number] | 'hexagon' | 'gold-rect' }>> = {
  'frame-ring': { unlock: 3, rarity: 'common', accent: '#f4ede4', clip: [50, 50, 46] },
  'frame-dots': { unlock: 9, rarity: 'common', accent: '#ffffff', clip: [50, 50, 46] },
  'frame-plate': { unlock: 18, rarity: 'rare', accent: '#ffffff', clip: [50, 50, 40] },
  'frame-hexagon': { unlock: 24, rarity: 'rare', accent: '#6b7a90', clip: 'hexagon' },
  'frame-scallop': { unlock: 33, rarity: 'rare', accent: '#e07a5f', clip: [50, 50, 44] },
  'frame-board': { unlock: 42, rarity: 'epic', accent: '#a9743f', clip: [50, 50, 42] },
  'frame-pan': { unlock: 55, rarity: 'epic', accent: '#3b3f45', clip: [50, 50, 43] },
  'frame-laurel': { unlock: ['uitdager', 3], rarity: 'epic', accent: '#4f8a3c', clip: [50, 50, 44] },
  'frame-basket': { unlock: ['vaste-klant', 5], rarity: 'epic', accent: '#b98a4a', clip: [50, 50, 43] },
  'frame-chefhat': { unlock: 70, rarity: 'legendary', accent: '#ffffff', clip: [50, 50, 44] },
  'frame-gold': { unlock: 85, rarity: 'legendary', accent: '#c9a227', clip: 'gold-rect' },
};
const ROUND_3_BGS: Readonly<Record<string, { level: number; rarity: Rarity; covers: boolean }>> = {
  'bg-stripes': { level: 5, rarity: 'common', covers: false },
  'bg-chevron': { level: 7, rarity: 'common', covers: false },
  'bg-waves': { level: 10, rarity: 'common', covers: false },
  'bg-grid': { level: 16, rarity: 'common', covers: false },
  'bg-checker': { level: 19, rarity: 'common', covers: false },
  'bg-kitchen': { level: 21, rarity: 'rare', covers: true },
  'bg-herbs': { level: 25, rarity: 'rare', covers: true },
  'bg-wood': { level: 27, rarity: 'rare', covers: true },
  'bg-night': { level: 35, rarity: 'rare', covers: true },
  'bg-spring': { level: 40, rarity: 'rare', covers: true },
  'bg-summer': { level: 44, rarity: 'epic', covers: true },
  'bg-autumn': { level: 48, rarity: 'epic', covers: true },
  'bg-winter': { level: 52, rarity: 'epic', covers: true },
  'bg-market': { level: 58, rarity: 'epic', covers: true },
  'bg-fire': { level: 65, rarity: 'epic', covers: true },
  'bg-aurora': { level: 75, rarity: 'legendary', covers: true },
  'bg-galaxy': { level: 90, rarity: 'legendary', covers: true },
};
/** Every id of round 3: left out of the round-2 checks (frames.md §6.1). */
const ROUND_3: ReadonlySet<string> = new Set([...Object.keys(ROUND_3_FRAMES), ...Object.keys(ROUND_3_BGS)]);

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
    // Round 2 knew no frames (block 6D-F adds that layer; its own test is below).
    expect(Object.keys(TARGET).sort()).toEqual(LAYER_ORDER.filter((l) => l !== 'frame').sort());
    for (const layer of Object.keys(TARGET)) {
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

  it('every part stays within the drawing budget of its rarity (block 6D-R point 3)', () => {
    // common/rare ≤ 14 elements and 1.5 kB; epic ≤ 20 and 2 kB; legendary ≤ 26 and 2.5 kB.
    const BUDGET: Readonly<Record<Rarity, { elements: number; bytes: number }>> = {
      common: { elements: 14, bytes: 1500 },
      rare: { elements: 14, bytes: 1500 },
      epic: { elements: 20, bytes: 2000 },
      legendary: { elements: 26, bytes: 2500 },
    };
    for (const p of PARTS) {
      const budget = BUDGET[p.rarity];
      expect(new TextEncoder().encode(p.svg).length, `${p.id} (${p.rarity})`).toBeLessThanOrEqual(budget.bytes);
      expect((p.svg.match(/<[a-z]/g) ?? []).length, `${p.id} (${p.rarity})`).toBeLessThanOrEqual(budget.elements);
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
    // The parts of round 2 only: the frames and the 17 backgrounds of round 3 (block 6D-F) go up to
    // level 90 by design and are left out (frames.md §6.1).
    const fresh = PARTS.filter((p) => !(p.id in ROUND_1) && !ROUND_3.has(p.id));
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

describe('rarity (block 6D-R)', () => {
  const levelOf = (p: AvatarPart): number | null => ('level' in p.unlock ? p.unlock.level : null);
  const byLevel = PARTS.filter((p) => levelOf(p) !== null);

  it('has the four rarities in order; the validator mirrors them', () => {
    expect(RARITIES).toEqual(['common', 'rare', 'epic', 'legendary']);
    expect(AVATAR_RARITIES).toEqual([...RARITIES]);
  });

  it('every part has a valid rarity, and the data file sets it explicitly on every part (point 3)', () => {
    for (const p of PARTS) expect(RARITIES, p.id).toContain(p.rarity);
    for (const raw of partsJson as Array<Record<string, unknown>>) {
      expect(RARITIES as readonly unknown[], String(raw['id'])).toContain(raw['rarity']);
    }
  });

  it('rarityFor on a level: ≤ 20 common · 21–50 rare · 51–80 epic · 81–100 legendary', () => {
    const table: Array<[number, Rarity]> = [
      [3, 'common'], [20, 'common'], [21, 'rare'], [50, 'rare'], [51, 'epic'], [80, 'epic'], [81, 'legendary'], [100, 'legendary'],
    ];
    for (const [level, rarity] of table) expect(rarityFor({ level }), `level ${level}`).toBe(rarity);
  });

  it('rarityFor on a badge: tier ≤ 2 or a visible one-off rare · tier 3–5 epic · tier ≥ 6 legendary; hidden at least epic', () => {
    expect(rarityFor({ badge: 'b', tier: 1 })).toBe('rare');
    expect(rarityFor({ badge: 'b', tier: 2 })).toBe('rare');
    expect(rarityFor({ badge: 'b', tier: 3 })).toBe('epic');
    expect(rarityFor({ badge: 'b', tier: 5 })).toBe('epic');
    expect(rarityFor({ badge: 'b', tier: 6 })).toBe('legendary');
    expect(rarityFor({ badge: 'b', tier: 8 })).toBe('legendary');
    // A one-off badge (no tier), visible or without a catalogue: rare.
    expect(rarityFor({ badge: 'b' })).toBe('rare');
    expect(rarityFor({ badge: 'b' }, { hidden: false })).toBe('rare');
    expect(rarityFor({ badge: 'b' }, null)).toBe('rare');
    // A hidden (secret) badge: at least epic, never lowered.
    expect(rarityFor({ badge: 'b' }, { hidden: true })).toBe('epic');
    expect(rarityFor({ badge: 'b', tier: 2 }, { hidden: true })).toBe('epic');
    expect(rarityFor({ badge: 'b', tier: 4 }, { hidden: true })).toBe('epic');
    expect(rarityFor({ badge: 'b', tier: 6 }, { hidden: true })).toBe('legendary');
    // With the real catalogue: nachtbraker is a secret one-off, het-hele-boek a visible one.
    const badge = (id: string) => BADGES.find((b) => b.id === id) ?? null;
    expect(rarityFor(part('eyes-sleepy').unlock, badge('nachtbraker'))).toBe('epic');
    expect(rarityFor(part('pin-medal-gold').unlock, badge('het-hele-boek'))).toBe('rare');
    expect(rarityFor(part('hat-pan').unlock, badge('huiskok'))).toBe('epic'); // tier 5
  });

  it('normalizeAvatarParts: an explicit rarity wins; a missing or unknown one falls back to the rule', () => {
    const base = { layer: 'hat', nl: 'Test', en: 'Test', svg: '<circle cx="50" cy="20" r="5"/>' };
    const out = normalizeAvatarParts([
      { ...base, id: 'hat-explicit', unlock: { level: 3 }, rarity: 'legendary' },
      { ...base, id: 'hat-missing', unlock: { level: 35 } },
      { ...base, id: 'hat-unknown', unlock: { level: 60 }, rarity: 'mythic' },
      { ...base, id: 'hat-number', unlock: { level: 90 }, rarity: 3 },
      { ...base, id: 'hat-secret', unlock: { badge: 'nachtbraker' } }, // hidden one-off: epic
      { ...base, id: 'hat-cheese', unlock: { badge: 'kaaskop' } }, // the ladder at tier 3: epic
    ], BADGES);
    expect(out.map((p) => [p.id, p.rarity])).toEqual([
      ['hat-explicit', 'legendary'],
      ['hat-missing', 'rare'],
      ['hat-unknown', 'epic'],
      ['hat-number', 'legendary'],
      ['hat-secret', 'epic'],
      ['hat-cheese', 'epic'],
    ]);
    // Without the catalogue a badge part is a visible one-off: rare.
    expect(normalizeAvatarParts([{ ...base, id: 'hat-secret', unlock: { badge: 'nachtbraker' } }])[0]?.rarity).toBe('rare');
  });

  it("holds Fable's decisions of point 3 literally (appearance counts as well as difficulty)", () => {
    const LEGENDARY = ['hat-crown', 'body-gold-jacket', 'bg-gold', 'bg-confetti', 'hair-whipped-cream', 'hair-flame', 'hat-dino'];
    const EPIC = ['hat-cheese', 'prop-camera', 'bg-rainbow', 'bg-stars', 'hat-watermelon', 'hat-mushroom', 'hat-pumpkin',
      'body-tuxedo', 'glasses-monocle', 'hair-spaghetti', 'hair-broccoli', 'bg-sunset'];
    for (const id of LEGENDARY) expect(part(id).rarity, id).toBe('legendary');
    for (const id of EPIC) expect(part(id).rarity, id).toBe('epic');
    // Ordinary clothes and hair stay common, also when they come late.
    expect(part('body-dress').rarity).toBe('common');
    expect(part('hair-ponytail').rarity).toBe('common');
  });

  it('the balance: ≥ 75 % of the level commons on level ≤ 20, ≥ 75 % of the level rares on level ≤ 50', () => {
    const commons = byLevel.filter((p) => p.rarity === 'common');
    const rares = byLevel.filter((p) => p.rarity === 'rare');
    expect(commons.length).toBeGreaterThan(0);
    expect(rares.length).toBeGreaterThan(0);
    expect(commons.filter((p) => (levelOf(p) ?? 0) <= 20).length / commons.length).toBeGreaterThanOrEqual(0.75);
    expect(rares.filter((p) => (levelOf(p) ?? 0) <= 50).length / rares.length).toBeGreaterThanOrEqual(0.75);
  });

  it('legendary: at least 3 parts and at most 10 % of the library', () => {
    const legendary = PARTS.filter((p) => p.rarity === 'legendary').length;
    expect(legendary).toBeGreaterThanOrEqual(3);
    expect(legendary).toBeLessThanOrEqual(PARTS.length * 0.1);
  });

  it('the validator demands a valid rarity, and never warns when it differs from the rule', () => {
    const minimal = (extra: Record<string, unknown>) => [
      { id: 'face-a', layer: 'face', nl: 'a', en: 'a', unlock: { level: 3 }, svg: '' },
      { id: 'eyes-a', layer: 'eyes', nl: 'a', en: 'a', unlock: { level: 3 }, svg: '' },
      { id: 'mouth-a', layer: 'mouth', nl: 'a', en: 'a', unlock: { level: 3 }, svg: '' },
      { id: 'body-a', layer: 'body', nl: 'a', en: 'a', unlock: { level: 3 }, svg: '', ...extra },
    ];
    // A level-3 part made legendary by hand: no error, no warning.
    expect(validateAvatarParts(minimal({ rarity: 'legendary' }), [])).toMatchObject({ errors: [], warnings: [] });
    // Missing: falls back to the rule, fine.
    expect(validateAvatarParts(minimal({}), [])).toMatchObject({ errors: [], warnings: [] });
    expect(validateAvatarParts(minimal({ rarity: 'mythic' }), []).errors).toEqual([
      'avatar-parts.json "body-a": "rarity" must be one of common | rare | epic | legendary, got "mythic".',
    ]);
    expect(validateAvatarParts(minimal({ rarity: 2 }), []).errors).toHaveLength(1);
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
    const handMade: AvatarPart = { id: 'pin-x', layer: 'pin', nl: 'x', en: 'x', unlock: { badge: 'b' }, rarity: 'rare', svg: '' };
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
    // Block 6D-F (frames.md §2b): the profile colour is a rect INSIDE the clip group (was a circle
    // r 46 before it); without a frame the style has no --accent (the pinned form) and the clip is the
    // round one.
    const svg = renderAvatarSvg(spec, BY_ID, { color: '#d9402b', level: 3, uid: 'av7' });
    expect(svg.startsWith('<svg viewBox="0 0 100 100" class="avatar-svg" style="--tone:#e0b08a;--hair:#8a5a2b" aria-hidden="true">')).toBe(true);
    expect(svg).not.toContain('--accent');
    expect(svg).toContain('<defs><clipPath id="c-av7"><circle cx="50" cy="50" r="46"/></clipPath></defs>');
    expect(svg).toContain('<g clip-path="url(#c-av7)"><rect width="100" height="100" fill="#d9402b"/>');
    expect(svg).not.toContain('<circle cx="50" cy="50" r="46" fill=');
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
      id: 'bg-test', layer: 'bg', nl: 'Test', en: 'Test', unlock: { level: 3 }, rarity: 'common',
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

  it('wraps every layer in <g data-layer="LAYER"> with the part markup unchanged inside (V1b §1d)', () => {
    const svg = renderAvatarSvg(spec, BY_ID, { color: '#2b4fa8', level: 0, uid: 'x' });
    for (const id of spec.parts) {
      const p = part(id);
      expect(svg, id).toContain(`<g data-layer="${p.layer}">${p.svg.replaceAll('__u', 'x')}</g>`);
    }
    // The eyes layer the wink animates (avatar.css `.avatar.wink [data-layer="eyes"]`).
    expect(svg).toContain('<g data-layer="eyes">');
    expect(svg.match(/data-layer=/g)?.length).toBe(spec.parts.length);
  });

  it('highlight: the selection ring in currentColor, circle r 48 width 4 without a frame; none without highlight (V1b §1d)', () => {
    const ring = '<circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="4"/>';
    const on = renderAvatarSvg(spec, BY_ID, { color: '#2b4fa8', level: 10, uid: 'h', highlight: true });
    expect(on.endsWith(`${ring}</svg>`)).toBe(true);
    const off = renderAvatarSvg(spec, BY_ID, { color: '#2b4fa8', level: 10, uid: 'h' });
    expect(off).not.toContain('currentColor');
    expect(renderAvatarSvg(spec, BY_ID, { color: '#2b4fa8', level: 10, uid: 'h', highlight: false })).toBe(off);
  });

  it('every part of the library renders (one at a time), with every __u replaced', () => {
    for (const p of PARTS) {
      const svg = renderAvatarSvg({ v: 1, parts: [p.id] }, BY_ID, { color: '#eeeeee', level: 0, uid: 'p1' });
      expect(svg).toContain(p.svg.replaceAll('__u', 'p1'));
      expect(svg).not.toContain('__u');
    }
  });
});

// ---------------------------------------------------------------------------- block 6D-F: frames

/** The svg split into what lies inside the clip group and what lies outside it (ring, frame, root). */
function splitClip(svg: string): { inside: string; outside: string } {
  const start = svg.indexOf('<g clip-path="url(#c-');
  if (start < 0) return { inside: '', outside: svg };
  let depth = 0;
  for (const m of svg.slice(start).matchAll(/<(\/?)g[\s>]/g)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) {
      const end = start + (m.index ?? 0) + '</g>'.length;
      return { inside: svg.slice(start, end), outside: svg.slice(0, start) + svg.slice(end) };
    }
  }
  throw new Error('unbalanced <g>');
}

/** Self-made test parts (frames.md §6: the colour rule is tested without builder B's data too). */
const TEST_RING_SVG = '<circle cx="50" cy="50" r="48" fill="none" stroke="var(--accent)" stroke-width="4"/>';
const HEX_CLIP = '<polygon points="50,4 89.84,27 89.84,73 50,96 10.16,73 10.16,27"/>';
const TEST_PARTS_RAW = [
  { id: 'frame-ring', layer: 'frame', nl: 'Rand', en: 'Plain ring', unlock: { level: 3 }, rarity: 'common',
    clip: '<circle cx="50" cy="50" r="46"/>', accent: '#f4ede4', svg: TEST_RING_SVG },
  { id: 'frame-hextest', layer: 'frame', nl: 'Zeshoek', en: 'Hexagon', unlock: { level: 24 }, rarity: 'rare',
    clip: HEX_CLIP, accent: '#6b7a90', svg: '<polygon points="50,1.5 92,25.75 92,74.25 50,98.5 8,74.25 8,25.75" fill="none" stroke="var(--accent)" stroke-width="3" id="h__u"/>' },
  { id: 'bg-seethrough', layer: 'bg', nl: 'Door', en: 'Through', unlock: { level: 3 }, rarity: 'common',
    svg: '<rect width="100" height="100" fill="#fff" opacity=".2"/>' },
  { id: 'bg-cover', layer: 'bg', nl: 'Nacht', en: 'Night', unlock: { level: 3 }, rarity: 'rare', covers: true,
    svg: '<rect width="100" height="100" fill="#1b2a4a"/><circle cx="20" cy="20" r="2" fill="#fff5c2"/>' },
];
const TEST_PARTS = normalizeAvatarParts(TEST_PARTS_RAW);
/** The five default parts plus the test parts. */
const TEST_LIB: ReadonlyMap<string, AvatarPart> = new Map([
  ...defaultAvatar().parts.map((id) => [id, part(id)] as const),
  ...TEST_PARTS.map((p) => [p.id, p] as const),
]);
const TEST_LIB_NO_RING: ReadonlyMap<string, AvatarPart> = new Map([...TEST_LIB].filter(([id]) => id !== 'frame-ring'));
const withParts = (...ids: string[]): AvatarSpec => ({ ...defaultAvatar(), parts: [...defaultAvatar().parts, ...ids] });

describe('block 6D-F: the frame layer and its fields (frames.md §2a, §6.2)', () => {
  it("'frame' is the last layer, not required; the validator mirrors the layers", () => {
    expect(LAYER_ORDER[LAYER_ORDER.length - 1]).toBe('frame');
    expect(LAYER_ORDER).toHaveLength(12);
    expect(REQUIRED_LAYERS).toEqual(['face', 'eyes', 'mouth', 'body']);
    expect(AVATAR_LAYERS).toEqual([...LAYER_ORDER]);
  });

  it('normalizeAvatarParts reads clip and accent on a frame and covers on a background', () => {
    const ring = TEST_PARTS.find((p) => p.id === 'frame-ring');
    expect(ring).toMatchObject({ layer: 'frame', clip: '<circle cx="50" cy="50" r="46"/>', accent: '#f4ede4' });
    expect(ring?.covers).toBeUndefined();
    expect(TEST_PARTS.find((p) => p.id === 'bg-cover')?.covers).toBe(true);
    expect('covers' in TEST_PARTS.find((p) => p.id === 'bg-seethrough')!).toBe(false);
  });

  it('a frame without a valid clip or accent is skipped', () => {
    const ok = TEST_PARTS_RAW[0]!;
    const out = normalizeAvatarParts([
      { ...ok, id: 'frame-no-clip', clip: undefined },
      { ...ok, id: 'frame-no-accent', accent: undefined },
      { ...ok, id: 'frame-named-accent', accent: 'red' },
      { ...ok, id: 'frame-short-accent', accent: '#fff' },
      { ...ok, id: 'frame-clip-fill', clip: '<circle cx="50" cy="50" r="46" fill="#000"/>' },
      { ...ok, id: 'frame-clip-style', clip: '<circle cx="50" cy="50" r="46" style="fill:red"/>' },
      { ...ok, id: 'frame-clip-id', clip: '<circle id="x" cx="50" cy="50" r="46"/>' },
      { ...ok, id: 'frame-clip-two', clip: '<circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="40"/>' },
      { ...ok, id: 'frame-clip-g', clip: '<g><circle cx="50" cy="50" r="46"/></g>' },
      { ...ok, id: 'frame-clip-number', clip: 46 },
      { ...ok, id: 'frame-ok' },
      { ...ok, id: 'frame-path', clip: '<path d="M50 4L96 50 50 96 4 50z"/>', accent: '#ABCDEF' },
    ]);
    expect(out.map((p) => p.id)).toEqual(['frame-ok', 'frame-path']);
    expect(out[1]!.accent).toBe('#abcdef');
  });

  it('covers only when literally true and only on a background; clip/accent/covers ignored on other layers', () => {
    const base = { nl: 'x', en: 'x', unlock: { level: 3 }, svg: '<rect width="100" height="100" fill="#123456"/>' };
    const out = normalizeAvatarParts([
      { ...base, id: 'bg-string', layer: 'bg', covers: 'true' },
      { ...base, id: 'bg-one', layer: 'bg', covers: 1 },
      { ...base, id: 'bg-false', layer: 'bg', covers: false },
      { ...base, id: 'hat-covers', layer: 'hat', covers: true, clip: '<circle cx="50" cy="50" r="46"/>', accent: '#ffffff' },
    ]);
    expect(out.map((p) => p.id)).toEqual(['bg-string', 'bg-one', 'bg-false', 'hat-covers']);
    for (const p of out) {
      expect('covers' in p, p.id).toBe(false);
      expect('clip' in p, p.id).toBe(false);
      expect('accent' in p, p.id).toBe(false);
    }
  });

  it('normalizeAvatarSpec keeps a frame-* id (a known layer), one per layer', () => {
    expect(normalizeAvatarSpec({ v: 1, parts: ['face-round', 'frame-gold', 'frame-ring'] })?.parts).toEqual(['face-round', 'frame-gold']);
    expect(normalizeAvatarSpec({ v: 1, parts: ['frame-future'] })?.parts).toEqual(['frame-future']);
  });

  it('isComplete does not need a frame', () => {
    expect(isComplete(defaultAvatar(), TEST_LIB)).toBe(true);
    expect(isComplete(withParts('frame-ring'), TEST_LIB)).toBe(true);
  });

  it('randomAvatar can pick a frame (optional layer, about half the time) and stays complete', () => {
    const unlocked = [...TEST_LIB.values()];
    const specs = Array.from({ length: 40 }, (_, i) => randomAvatar(unlocked, 500 + i));
    const withFrame = specs.filter((s) => s.parts.some((id) => id.startsWith('frame-')));
    expect(withFrame.length).toBeGreaterThan(5);
    expect(withFrame.length).toBeLessThan(35);
    for (const s of specs) {
      expect(isComplete(s, TEST_LIB)).toBe(true);
      expect(normalizeAvatarSpec(s)).toEqual(s);
      // The frame, when there, comes last (drawing order).
      const i = s.parts.findIndex((id) => id.startsWith('frame-'));
      if (i >= 0) expect(i).toBe(s.parts.length - 1);
    }
  });
});

describe('block 6D-F: renderAvatarSvg with a frame (frames.md §2b, §6.1)', () => {
  it('a frame: its clip, the level ring as the stroked clip shape, the frame after the ring, --accent its own colour', () => {
    const svg = renderAvatarSvg(withParts('frame-hextest'), TEST_LIB, { color: '#d9402b', level: 10, uid: 'f1' });
    expect(svg.startsWith('<svg viewBox="0 0 100 100" class="avatar-svg" style="--tone:#f3d2b3;--hair:#4a2c17;--accent:#6b7a90" aria-hidden="true">')).toBe(true);
    expect(svg).toContain(`<defs><clipPath id="c-f1">${HEX_CLIP}</clipPath></defs>`);
    expect(svg).toContain('<g clip-path="url(#c-f1)"><rect width="100" height="100" fill="#d9402b"/>');
    const ring = '<polygon points="50,4 89.84,27 89.84,73 50,96 10.16,73 10.16,27" fill="none" stroke="#3d9a3a" stroke-width="2"/>';
    const frame = TEST_LIB.get('frame-hextest')!.svg.replaceAll('__u', 'f1');
    expect(svg).toContain(`</g>${ring}<g data-layer="frame">${frame}</g></svg>`);
    expect(svg).not.toContain('r="48" fill="none" stroke="#3d9a3a"');
    expect(svg).not.toContain('__u');
    // The frame is outside the clip group; nothing of it inside.
    const { inside, outside } = splitClip(svg);
    expect(inside).not.toContain('var(--accent)');
    expect(outside).toContain(frame);
  });

  it('highlight with a frame: the clip shape once more in currentColor, width 3, after the frame (V1b §1d)', () => {
    const svg = renderAvatarSvg(withParts('frame-hextest'), TEST_LIB, { color: '#d9402b', level: 10, uid: 'f1', highlight: true });
    const frame = TEST_LIB.get('frame-hextest')!.svg.replaceAll('__u', 'f1');
    const hl = '<polygon points="50,4 89.84,27 89.84,73 50,96 10.16,73 10.16,27" fill="none" stroke="currentColor" stroke-width="3"/>';
    expect(svg).toContain(`<g data-layer="frame">${frame}</g>${hl}</svg>`);
    expect(renderAvatarSvg(withParts('frame-hextest'), TEST_LIB, { color: '#d9402b', level: 10, uid: 'f1' })).not.toContain('currentColor');
  });

  it('a frame under level 5: no ring, the frame right after the clip group', () => {
    const svg = renderAvatarSvg(withParts('frame-ring'), TEST_LIB, { color: '#d9402b', level: 3, uid: 'f2' });
    expect(svg).toContain(`</g><g data-layer="frame">${TEST_RING_SVG}</g></svg>`);
    expect(svg).toContain(';--accent:#f4ede4"');
  });

  it('without a frame: the ring as before (r 48, width 4), no --accent', () => {
    const svg = renderAvatarSvg(withParts('bg-seethrough'), TEST_LIB, { color: '#d9402b', level: 10, uid: 'f3' });
    expect(svg).toContain('</g><circle cx="50" cy="50" r="48" fill="none" stroke="#3d9a3a" stroke-width="4"/></svg>');
    expect(svg).not.toContain('--accent');
    expect(svg).toContain('<clipPath id="c-f3"><circle cx="50" cy="50" r="46"/></clipPath>');
  });

  it('a covering background hands the profile colour to the frame', () => {
    const svg = renderAvatarSvg(withParts('bg-cover', 'frame-hextest'), TEST_LIB, { color: '#aa3366', level: 10, uid: 'f4' });
    expect(svg).toContain(';--accent:#aa3366"');
    expect(svg).not.toContain('#6b7a90');
  });

  it('implicit ring: a covering background without a frame draws frame-ring in the profile colour', () => {
    for (const spec of [withParts('bg-cover'), withParts('bg-cover', 'frame-unknown')]) {
      const svg = renderAvatarSvg(spec, TEST_LIB, { color: '#aa3366', level: 10, uid: 'f5' });
      expect(svg).toContain(';--accent:#aa3366"');
      expect(svg).toContain('<clipPath id="c-f5"><circle cx="50" cy="50" r="46"/></clipPath>');
      expect(svg).toContain(`</g><circle cx="50" cy="50" r="46" fill="none" stroke="#3d9a3a" stroke-width="2"/><g data-layer="frame">${TEST_RING_SVG}</g></svg>`);
    }
  });

  it('implicit ring without frame-ring in the library: a plain ring in the profile colour after a thin level ring', () => {
    const ten = renderAvatarSvg(withParts('bg-cover'), TEST_LIB_NO_RING, { color: '#aa3366', level: 10, uid: 'f6' });
    expect(ten).toContain('</g><circle cx="50" cy="50" r="45" fill="none" stroke="#3d9a3a" stroke-width="2"/><circle cx="50" cy="50" r="48" fill="none" stroke="#aa3366" stroke-width="4"/></svg>');
    expect(ten).not.toContain('--accent');
    const three = renderAvatarSvg(withParts('bg-cover'), TEST_LIB_NO_RING, { color: '#aa3366', level: 3, uid: 'f6' });
    expect(three).toContain('</g><circle cx="50" cy="50" r="48" fill="none" stroke="#aa3366" stroke-width="4"/></svg>');
  });

  it('an unsafe colour falls back to cobalt in the rect and in --accent alike', () => {
    const svg = renderAvatarSvg(withParts('bg-cover'), TEST_LIB, { color: '#fff" onload="x()', level: 0, uid: 'f7' });
    expect(svg).not.toMatch(/onload/);
    expect(svg).toContain(';--accent:#2b4fa8"');
    expect(svg).toContain('fill="#2b4fa8"');
  });
});

/** The colour rule §2c over every background × (every frame + none) of a library (frames.md §6.3). */
function checkColourRule(lib: ReadonlyMap<string, AvatarPart>): number {
  const COLOUR = '#aa3366';
  const all = [...lib.values()];
  const bgs = all.filter((p) => p.layer === 'bg');
  const frames: Array<AvatarPart | null> = [null, ...all.filter((p) => p.layer === 'frame')];
  let n = 0;
  for (const bg of bgs) {
    for (const frame of frames) {
      for (const level of [0, 10]) {
        const ids = frame ? [bg.id, frame.id] : [bg.id];
        const svg = renderAvatarSvg(withParts(...ids), lib, { color: COLOUR, level, uid: 'k' });
        const { inside, outside } = splitClip(svg);
        const label = `${bg.id} × ${frame?.id ?? 'none'} @${level}`;
        expect(inside.startsWith(`<g clip-path="url(#c-k)"><rect width="100" height="100" fill="${COLOUR}"/>`), label).toBe(true);
        // Decision a: a background without covers must never start with a covering element,
        // or it would hide the profile colour without the implicit ring.
        if (bg.covers !== true) expect(coversFirstElement(bg.svg), label).toBe(false);
        if (bg.covers === true) {
          expect(outside.includes(`--accent:${COLOUR}`) || outside.includes(`stroke="${COLOUR}"`), label).toBe(true);
          if (frame) expect(outside, label).toContain(`--accent:${COLOUR}`);
        } else if (frame) {
          expect(outside, label).toContain(`--accent:${frame.accent}`);
        }
        n++;
      }
    }
  }
  return n;
}

describe('block 6D-F: the colour rule (frames.md §2c, §6.3)', () => {
  it('holds over the self-made test library (both backgrounds × both frames + none), also without frame-ring', () => {
    expect(checkColourRule(TEST_LIB)).toBe(2 * 3 * 2);
    expect(checkColourRule(TEST_LIB_NO_RING)).toBe(2 * 2 * 2);
  });

  it('holds over the real library: every background × (every frame + none)', () => {
    const bgs = PARTS.filter((p) => p.layer === 'bg').length;
    const frames = PARTS.filter((p) => p.layer === 'frame').length;
    expect(checkColourRule(BY_ID)).toBe(bgs * (frames + 1) * 2);
  });
});

describe('block 6D-F: the validator (frames.md §2d, §6.5)', () => {
  const required = [
    { id: 'face-a', layer: 'face', nl: 'a', en: 'a', unlock: { level: 3 }, svg: '' },
    { id: 'eyes-a', layer: 'eyes', nl: 'a', en: 'a', unlock: { level: 3 }, svg: '' },
    { id: 'mouth-a', layer: 'mouth', nl: 'a', en: 'a', unlock: { level: 3 }, svg: '' },
    { id: 'body-a', layer: 'body', nl: 'a', en: 'a', unlock: { level: 3 }, svg: '' },
  ];
  const frame = { id: 'frame-a', layer: 'frame', nl: 'a', en: 'a', unlock: { level: 9 }, clip: '<circle cx="50" cy="50" r="46"/>', accent: '#f4ede4', svg: TEST_RING_SVG };
  const cover = { id: 'bg-a', layer: 'bg', nl: 'a', en: 'a', unlock: { level: 21 }, covers: true, svg: '<rect width="100" height="100" fill="#1b2a4a"/><circle cx="20" cy="20" r="2" fill="#fff"/>' };
  const errorsOf = (extra: Array<Record<string, unknown>>, badges: unknown[] = []) => validateAvatarParts([...required, ...extra], badges).errors;

  it('a valid frame and a valid covering background pass; a frame is not needed on level 3', () => {
    expect(validateAvatarParts([...required, frame, cover], [])).toMatchObject({ errors: [], warnings: [] });
    expect(errorsOf([{ ...frame, clip: HEX_CLIP }, { ...frame, id: 'frame-b', clip: '<rect x="8" y="8" width="84" height="84" rx="14"/>' }])).toEqual([]);
    expect(errorsOf([{ ...cover, svg: '<circle cx="50" cy="50" r="50" fill="#123456"/>' }])).toEqual([]);
  });

  it('a frame without clip or accent, or with a bad one', () => {
    expect(errorsOf([{ ...frame, clip: undefined }])).toEqual(['avatar-parts.json "frame-a": a frame needs "clip" (one SVG shape element).']);
    expect(errorsOf([{ ...frame, accent: undefined }])).toEqual(['avatar-parts.json "frame-a": a frame needs "accent" as #rrggbb, got undefined.']);
    expect(errorsOf([{ ...frame, accent: '#fff' }])).toHaveLength(1);
    expect(errorsOf([{ ...frame, accent: 'var(--x)' }])).toHaveLength(1);
  });

  it('a clip with fill=, style=, id=, two elements or another element is an error', () => {
    expect(errorsOf([{ ...frame, clip: '<circle cx="50" cy="50" r="46" fill="#000"/>' }])).toEqual([
      'avatar-parts.json "frame-a": clip attribute "fill" is not allowed (geometry only).',
    ]);
    for (const clip of ['<circle cx="50" cy="50" r="46" style="fill:red"/>', '<circle id="c__u" cx="50" cy="50" r="46"/>',
      '<circle cx="50" cy="50" r="46" stroke="#000"/>', '<circle cx="50" cy="50" r="46"/><circle r="2"/>',
      '<g><circle cx="50" cy="50" r="46"/></g>', '<line x1="0" y1="0" x2="1" y2="1"/>', '<circle cx="50" cy="50" r="46">', '<circle/>']) {
      expect(errorsOf([{ ...frame, clip }]), clip).not.toEqual([]);
    }
  });

  it("a frame's svg must use var(--accent), and the svg drawing rules hold for frames too", () => {
    expect(errorsOf([{ ...frame, svg: '<circle cx="50" cy="50" r="48" fill="none" stroke="#000" stroke-width="4"/>' }])).toEqual([
      'avatar-parts.json "frame-a": a frame\'s svg must use var(--accent) at least once.',
    ]);
    expect(errorsOf([{ ...frame, svg: `${TEST_RING_SVG}<circle r="1" style="fill:var(--accent)"/>` }])).toHaveLength(1);
    expect(errorsOf([{ ...frame, svg: `${TEST_RING_SVG}<circle id="x" r="1"/>` }])).toHaveLength(1);
  });

  it('clip or accent on another layer, covers on another layer than bg, covers not a boolean', () => {
    expect(errorsOf([{ id: 'hat-a', layer: 'hat', nl: 'a', en: 'a', unlock: { level: 4 }, svg: '', clip: '<circle cx="50" cy="50" r="46"/>' }]))
      .toEqual(['avatar-parts.json "hat-a": "clip" is only for layer "frame".']);
    expect(errorsOf([{ id: 'hat-a', layer: 'hat', nl: 'a', en: 'a', unlock: { level: 4 }, svg: '', accent: '#ffffff' }]))
      .toEqual(['avatar-parts.json "hat-a": "accent" is only for layer "frame".']);
    expect(errorsOf([{ id: 'hat-a', layer: 'hat', nl: 'a', en: 'a', unlock: { level: 4 }, svg: '', covers: true }]))
      .toEqual(['avatar-parts.json "hat-a": "covers" is only for layer "bg".']);
    expect(errorsOf([{ ...cover, covers: 'yes' }])).toEqual(['avatar-parts.json "bg-a": "covers" must be a boolean, got "yes".']);
    expect(errorsOf([{ ...cover, covers: false, svg: '<circle cx="20" cy="20" r="2" fill="#fff"/>' }])).toEqual([]);
  });

  it('a background whose first element covers but has no covers: true is an error (decision a)', () => {
    const msg = 'avatar-parts.json "bg-a": its first element covers the profile colour but has no "covers": true.';
    expect(errorsOf([{ ...cover, covers: false }])).toEqual([msg]);
    const { covers: _drop, ...noCovers } = cover;
    expect(errorsOf([noCovers])).toEqual([msg]);
    expect(errorsOf([{ ...noCovers, svg: '<circle cx="50" cy="50" r="50" fill="#123456"/>' }])).toEqual([msg]);
    expect(errorsOf([{ ...noCovers, svg: '<rect width="100" height="100" fill="#fff" opacity=".16"/>' }])).toEqual([]);
  });

  it('covers: true without a covering first element is an error', () => {
    const msg = 'avatar-parts.json "bg-a": "covers": true needs a covering first element (<rect width="100" height="100" fill="…"/> or a circle r 50).';
    for (const svg of ['<circle cx="20" cy="20" r="2" fill="#fff"/><rect width="100" height="100" fill="#1b2a4a"/>',
      '<rect width="100" height="100" fill="#fff" opacity=".14"/>', '<rect width="100" height="60" fill="#8fd0f0"/>',
      '<rect x="5" width="100" height="100" fill="#123456"/>', '<rect width="100" height="100" fill="none"/>',
      '<circle cx="50" cy="50" r="46" fill="#123456"/>', '']) {
      expect(errorsOf([{ ...cover, svg }]), svg).toEqual([msg]);
    }
    expect(coversFirstElement('<rect width="100" height="100" fill="#f6f1e8"/>')).toBe(true);
  });

  it('the badge cross-check holds for frames: uitdager ↔ frame-laurel', () => {
    const laurel = { ...frame, id: 'frame-laurel', unlock: { badge: 'uitdager' } };
    const uitdager = { id: 'uitdager', unlock: { part: 'frame-laurel', tier: 3 } };
    expect(errorsOf([laurel], [uitdager])).toEqual([]);
    expect(errorsOf([laurel], [{ id: 'uitdager' }])).toEqual([
      'avatar-parts.json "frame-laurel": badge "uitdager" does not point back (its unlock.part is undefined).',
    ]);
    expect(errorsOf([{ ...laurel, unlock: { level: 40 } }], [uitdager])).toEqual([
      'badges.json "uitdager": unlocks part "frame-laurel", but that part\'s unlock is {"level":40}.',
    ]);
  });
});

describe('block 6D-F: the real library of round 3 (frames.md §3, §4; needs the data of builder B)', () => {
  it('has 154 parts: 30 backgrounds (14 covering), 11 frames; legendary 11 (≤ 10 %)', () => {
    expect(PARTS).toHaveLength(154);
    expect(PARTS.filter((p) => p.layer === 'bg')).toHaveLength(30);
    expect(PARTS.filter((p) => p.layer === 'bg' && p.covers === true)).toHaveLength(14);
    expect(PARTS.filter((p) => p.layer === 'frame')).toHaveLength(11);
    expect(PARTS.filter((p) => p.rarity === 'legendary')).toHaveLength(11);
  });

  it('holds the 11 frames of §3 literally: unlock, rarity, accent, clip; the svg uses var(--accent)', () => {
    for (const [id, want] of Object.entries(ROUND_3_FRAMES)) {
      const p = part(id);
      expect(p.layer, id).toBe('frame');
      expect(p.rarity, id).toBe(want.rarity);
      expect(p.accent, id).toBe(want.accent);
      expect(p.unlock, id).toEqual(typeof want.unlock === 'number' ? { level: want.unlock } : { badge: want.unlock[0], tier: want.unlock[1] });
      expect(p.svg, id).toContain('var(--accent)');
      const clip = p.clip ?? '';
      const at = new Map([...clip.matchAll(/([a-z]+)="([^"]*)"/g)].map((a) => [a[1] ?? '', Number(a[2])]));
      if (want.clip === 'hexagon') {
        expect(clip.startsWith('<polygon '), id).toBe(true);
        const n = numbers(clip);
        expect(n, id).toHaveLength(12);
        for (let i = 0; i < 12; i += 2) expect(Math.hypot((n[i] ?? 0) - 50, (n[i + 1] ?? 0) - 50), id).toBeCloseTo(46, 0);
        expect(Math.min(...n.filter((_, i) => i % 2 === 1)), id).toBeCloseTo(4, 0); // point up
      } else if (want.clip === 'gold-rect') {
        expect(clip.startsWith('<rect '), id).toBe(true);
        expect([at.get('x'), at.get('y'), at.get('width'), at.get('height'), at.get('rx')], id).toEqual([8, 8, 84, 84, 14]);
      } else {
        expect(clip.startsWith('<circle '), id).toBe(true);
        expect([at.get('cx'), at.get('cy'), at.get('r')], id).toEqual([...want.clip]);
      }
    }
    expect(part('frame-ring').unlock).toEqual({ level: AVATAR_MAKER_LEVEL });
  });

  it('holds the 17 new backgrounds of §4 literally; of the 13 old ones only gold and sunset cover (decision a)', () => {
    for (const [id, want] of Object.entries(ROUND_3_BGS)) {
      const p = part(id);
      expect(p.layer, id).toBe('bg');
      expect(p.unlock, id).toEqual({ level: want.level });
      expect(p.rarity, id).toBe(want.rarity);
      expect(p.covers === true, id).toBe(want.covers);
      if (want.covers) expect(coversFirstElement(p.svg), id).toBe(true);
    }
    const OLD_COVERING: ReadonlySet<string> = new Set(['bg-gold', 'bg-sunset']);
    for (const p of PARTS.filter((x) => x.layer === 'bg' && !ROUND_3.has(x.id))) {
      expect(p.covers, p.id).toBe(OLD_COVERING.has(p.id) ? true : undefined);
      expect(coversFirstElement(p.svg), p.id).toBe(OLD_COVERING.has(p.id));
    }
  });

  it('frames and the new backgrounds draw inside 0–100', () => {
    for (const p of PARTS.filter((x) => ROUND_3.has(x.id))) {
      for (const [x, y] of svgPoints(p.svg)) {
        expect(x, p.id).toBeGreaterThanOrEqual(0);
        expect(x, p.id).toBeLessThanOrEqual(100);
        expect(y, p.id).toBeGreaterThanOrEqual(0);
        expect(y, p.id).toBeLessThanOrEqual(100);
      }
    }
  });

  it('the real data validates with 0 errors and 0 warnings', () => {
    expect(validateAvatarParts(partsJson as unknown, badgesJson as unknown)).toMatchObject({ errors: [], warnings: [] });
  });

  it('🎲 Verras me picks a frame for some seed from the real library', () => {
    const specs = Array.from({ length: 20 }, (_, i) => randomAvatar(PARTS, 2000 + i));
    expect(specs.some((s) => s.parts.some((id) => id.startsWith('frame-')))).toBe(true);
    for (const s of specs) expect(isComplete(s, BY_ID)).toBe(true);
  });
});
