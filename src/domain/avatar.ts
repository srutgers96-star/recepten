// The avatar (docs/specs/badges-avatar.md §2f, block 6D-3): the spec a profile stores, the parts
// library of data/avatar-parts.json, unlocking, the level ring and the SVG renderer. Framework-free:
// no preact, no dexie, no clock (randomAvatar takes its seed); runs in Node (tests) and in the app.
//
// - AvatarSpec   what a person chose: part ids (at most one per layer), skin tone, hair colour. It
//                lives on `Profile.avatar`, travels on the `#f=` member card (`MemberCard.avatar`)
//                and is ids only (±120 bytes before compression).
// - AvatarPart   one drawable part of the library: an SVG fragment in viewBox 0 0 100 100, unlocked
//                by a level or by a badge. The library is data; nothing of it is hardcoded here.
// - renderAvatarSvg builds the whole <svg> as a string. The part fragments come only from
//                data/avatar-parts.json (checked by tools/validate-data.ts `validateAvatarParts`, and
//                again by normalizeAvatarParts below); a spec from someone else's card only selects
//                ids and palette colours, it never brings markup of its own.
//
// Imports nothing but types: share.ts (the `#f=` card) uses normalizeAvatarSpec, and share.ts is in
// the Safari landing bundle, which must not pull in the badge catalogue or the badge engine.
import type { Badge, TIER_COLOURS } from './badges.ts';

// ---------------------------------------------------------------------------- model

export type AvatarLayer = 'bg' | 'body' | 'pin' | 'face' | 'facial' | 'mouth' | 'eyes' | 'hair' | 'glasses'
  | 'hat' | 'prop';

/** Drawing order, bottom to top. */
export const LAYER_ORDER: readonly AvatarLayer[] = ['bg', 'body', 'pin', 'face', 'facial', 'mouth', 'eyes', 'hair',
  'glasses', 'hat', 'prop'];

/** Layers an avatar MUST have; the rest may be empty. */
export const REQUIRED_LAYERS: readonly AvatarLayer[] = ['face', 'eyes', 'mouth', 'body'];

export interface AvatarSpec {
  v: 1;
  /** Part ids, at most one per layer; unknown ids are skipped when drawing. */
  parts: string[];
  /** Skin tone from AVATAR_TONES; default AVATAR_TONES[1]. */
  tone?: string;
  /** Hair colour from AVATAR_HAIR; default AVATAR_HAIR[0]. */
  hair?: string;
  /** Unknown keys are preserved (invariant 4: a newer app's card keeps what it carries). */
  [k: string]: unknown;
}

/**
 * A part unlocks at level N, or with the badge that gives it (that badge has `unlock.part` = this
 * id). `tier` on a badge unlock is not in the data file: normalizeAvatarParts copies it from the
 * badge's own `unlock.tier` when that badge is a ladder (data/badges.json is the one source of the
 * tier), so `isUnlocked` can say "Kaaskop at blue" from the part alone. Absent = a one-off badge
 * (earned once is enough), or no catalogue was passed to normalizeAvatarParts.
 */
export type AvatarUnlock = { level: number } | { badge: string; tier?: number };

export interface AvatarPart {
  /** '<layer>-<name>', kebab-case; forever (invariant 1 in spirit). */
  id: string;
  layer: AvatarLayer;
  /** Short name for the maker and the toast. */
  nl: string;
  en: string;
  unlock: AvatarUnlock;
  /** SVG fragment in viewBox 0 0 100 100; may use `var(--tone)`/`var(--hair)` and `__u` as the
   *  unique suffix for ids (the renderer replaces it). Empty = draws nothing (bg-color). */
  svg: string;
}

export const AVATAR_TONES = ['#f7dcc4', '#f3d2b3', '#e0b08a', '#c68a5a', '#9c6a45', '#6b4530'] as const;
export const AVATAR_HAIR = ['#4a2c17', '#1e1a19', '#8a5a2b', '#d9a85c', '#b23a2a', '#9a9a9a', '#7a3d8a',
  '#2b6fd6'] as const;

/** From this level the avatar maker opens (after your first cooked dish you are on level 3). */
export const AVATAR_MAKER_LEVEL = 3;
// Aligned: data/unlocks.json (docs/specs/xp-levels.md §2e) puts `avatar-maker` on level 3 too. Open
// question 3 (3 or 5) stays with Stijn; if he changes it, change both places.

export type RingColour = (typeof TIER_COLOURS)[number];

/** TIER_COLOURS of src/domain/badges.ts, tier 1 … 8, repeated here as a value so this module needs
 *  no runtime import (see the header); tests/avatar.test.ts pins that both lists are equal. */
const RING_ORDER: readonly RingColour[] = ['geel', 'groen', 'blauw', 'rood', 'brons', 'zilver', 'goud', 'platina'];

/** The eight level colours as hex: the `--lvl-1` … `--lvl-8` tokens of src/styles/badges.css
 *  (docs/specs/badges-avatar.md §3b; the same in light and dark), so the SVG string is self-contained. */
const RING_HEX: Readonly<Record<RingColour, string>> = {
  geel: '#e6b800',
  groen: '#3d9a3a',
  blauw: '#2b6fd6',
  rood: '#d9402b',
  brons: '#b0712d',
  zilver: '#8d9aa8',
  goud: '#c9a227',
  platina: '#7fd1d6',
};

/** Same cobalt as DEFAULT_MEMBER_COLOR (household.ts) / the card default (share.ts). */
const DEFAULT_COLOR = '#2b4fa8';
/** A plain CSS colour (hex, a name, rgb()/hsl()); the same rule share.ts applies to a card's colour. */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|(?:rgb|hsl)a?\(\s*[\d.%\s,/]+\s*\))$/i;
const PART_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LAYER_SET: ReadonlySet<string> = new Set(LAYER_ORDER);
/** The only `style` values a part may carry (tools/validate-data.ts `checkAvatarSvg`). */
const PART_STYLES: ReadonlySet<string> = new Set(['fill:var(--tone)', 'fill:var(--hair)']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** The layer an id belongs to by its '<layer>-' prefix, if any. */
function layerOfId(id: string): AvatarLayer | null {
  for (const layer of LAYER_ORDER) if (id.length > layer.length + 1 && id.startsWith(`${layer}-`)) return layer;
  return null;
}

/** The palette value `v` names (case-insensitive), or null. */
function fromPalette(v: unknown, palette: readonly string[]): string | null {
  if (typeof v !== 'string') return null;
  const wanted = v.trim().toLowerCase();
  return palette.find((c) => c === wanted) ?? null;
}

// ---------------------------------------------------------------------------- the library

/**
 * Defence in depth on top of the validator: a fragment with `<script`, an `href`, an event-handler
 * attribute or a `style` other than the two palette fills is never drawn.
 */
function isSafePartSvg(svg: string): boolean {
  if (/<script/i.test(svg) || /href\s*=/i.test(svg) || /\son[a-z]+\s*=/i.test(svg)) return false;
  const styles = [...svg.matchAll(/style\s*=\s*(["'])(.*?)\1/gi)];
  if ((svg.match(/style\s*=/gi) ?? []).length !== styles.length) return false;
  return styles.every((m) => PART_STYLES.has(m[2] ?? ''));
}

/**
 * Normalize the raw contents of data/avatar-parts.json. Tolerant, like normalizeBadges: unusable
 * entries are skipped (never an exception). A part is usable with a kebab-case id that starts with
 * '<layer>-', a known layer, non-empty nl and en, an unlock that is `{ level: 1..100 }` or
 * `{ badge: id }`, and an svg string that passes `isSafePartSvg`. Duplicate ids: the first wins.
 * The strict checks are the validator's.
 *
 * `badges` is the normalized badge catalogue (src/badges.ts `badgeData()`, i.e. normalizeBadges of
 * data/badges.json). A badge unlock gets `tier` from it when that badge is a ladder whose
 * `unlock.part` is this part (e.g. hat-cheese ← kaaskop at tier 3, blue). Without the catalogue a
 * badge part counts as a one-off (tier 1), so the app layer passes it.
 */
export function normalizeAvatarParts(data: unknown, badges: readonly Badge[] = []): AvatarPart[] {
  if (!Array.isArray(data)) return [];
  const badgeById = new Map<string, Badge>();
  for (const b of badges) if (!badgeById.has(b.id)) badgeById.set(b.id, b);
  const out: AvatarPart[] = [];
  const seen = new Set<string>();
  for (const raw of data as unknown[]) {
    if (!isRecord(raw)) continue;
    const id = nonEmptyString(raw['id']);
    const layer = raw['layer'];
    const nl = nonEmptyString(raw['nl']);
    const en = nonEmptyString(raw['en']);
    const svg = raw['svg'];
    if (id === null || !PART_ID.test(id) || seen.has(id)) continue;
    if (typeof layer !== 'string' || !LAYER_SET.has(layer) || !id.startsWith(`${layer}-`)) continue;
    if (nl === null || en === null || typeof svg !== 'string' || !isSafePartSvg(svg)) continue;
    const unlock = normalizeUnlock(raw['unlock'], id, badgeById);
    if (unlock === null) continue;
    seen.add(id);
    out.push({ id, layer: layer as AvatarLayer, nl, en, unlock, svg });
  }
  return out;
}

function normalizeUnlock(v: unknown, partId: string, badgeById: ReadonlyMap<string, Badge>): AvatarUnlock | null {
  if (!isRecord(v)) return null;
  const hasLevel = v['level'] !== undefined;
  const hasBadge = v['badge'] !== undefined;
  if (hasLevel === hasBadge) return null;
  if (hasLevel) {
    const level = v['level'];
    return typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 100 ? { level } : null;
  }
  const badgeId = nonEmptyString(v['badge']);
  if (badgeId === null) return null;
  const unlock: { badge: string; tier?: number } = { badge: badgeId };
  const badge = badgeById.get(badgeId);
  // A ladder is a badge with its eight `tiers` (normalizeBadges keeps them only when valid).
  const ladder = Array.isArray(badge?.tiers) && badge.tiers.length === RING_ORDER.length;
  if (ladder && badge?.unlock?.part === partId) unlock.tier = badge.unlock.tier ?? 1;
  return unlock;
}

// ---------------------------------------------------------------------------- the spec

/**
 * A stored or received avatar, tolerantly; null = no usable avatar (the initial circle shows).
 * Needs `v === 1` and a `parts` array. Parts: strings only, trimmed, kebab-case, with a known
 * '<layer>-' prefix, at most one per layer (the first wins), order kept; ids this app's library
 * does not know are KEPT (a newer phone's part; skipped when drawing). No part left → null.
 * `tone`/`hair` stay only when they are a palette colour (stored as the palette value). Unknown
 * keys are preserved.
 */
export function normalizeAvatarSpec(v: unknown): AvatarSpec | null {
  if (!isRecord(v) || v['v'] !== 1 || !Array.isArray(v['parts'])) return null;
  const parts: string[] = [];
  const layers = new Set<AvatarLayer>();
  for (const raw of v['parts'] as unknown[]) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    const layer = layerOfId(id);
    if (layer === null || !PART_ID.test(id) || layers.has(layer)) continue;
    layers.add(layer);
    parts.push(id);
  }
  if (parts.length === 0) return null;
  const out: AvatarSpec = { ...v, v: 1, parts };
  delete out.tone;
  delete out.hair;
  const tone = fromPalette(v['tone'], AVATAR_TONES);
  if (tone !== null) out.tone = tone;
  const hair = fromPalette(v['hair'], AVATAR_HAIR);
  if (hair !== null) out.hair = hair;
  return out;
}

/** Every REQUIRED_LAYERS layer has a part this library knows. */
export function isComplete(spec: AvatarSpec, parts: ReadonlyMap<string, AvatarPart>): boolean {
  const have = new Set<AvatarLayer>();
  for (const id of spec.parts) {
    const part = parts.get(id);
    if (part) have.add(part.layer);
  }
  return REQUIRED_LAYERS.every((layer) => have.has(layer));
}

/**
 * Whether this person has the part: a level part from that level on; a badge part once the badge
 * reached the part's tier (`badgeTiers`: badge id → reached tier, a one-off = 1; src/badges.ts
 * `badgeTiersFor`), a one-off badge's part once it is earned.
 */
export function isUnlocked(part: AvatarPart, ctx: { level: number; badgeTiers: ReadonlyMap<string, number> }): boolean {
  const u = part.unlock;
  if ('level' in u) return ctx.level >= u.level;
  return (ctx.badgeTiers.get(u.badge) ?? 0) >= (u.tier ?? 1);
}

/**
 * The name a maker tile carries in its title and aria-label (§1b.3-4). A locked part of a SECRET
 * badge never puts that badge's name in the DOM (§1b.4; Fable's check §7.10): pin-heart is called
 * "Hartje" / "Little heart", exactly like the hidden badge hartje, so its locked tile gets no name
 * ('') and only says that it unlocks with a secret badge. A part name that does not contain the
 * badge's name (eyes-sleepy "Slaperig" for nachtbraker) stays, and so does the name of every
 * unlocked part, level part and part of a visible badge. `badge` is the badge of a badge part (null
 * for a level part, or a badge this app does not know: then there is no name to give away).
 */
export function makerTileName(part: AvatarPart, lang: 'nl' | 'en', unlocked: boolean,
  badge: Pick<Badge, 'hidden' | 'nl' | 'en'> | null): string {
  const name = part[lang];
  if (unlocked || badge?.hidden !== true) return name;
  const plain = (s: string): string => s.trim().toLocaleLowerCase();
  const own = plain(name);
  const givesAway = [badge.nl.name, badge.en.name].some((b) => plain(b) !== '' && own.includes(plain(b)));
  return givesAway ? '' : name;
}

/**
 * The ring colour per level: null under 5, then the 8 colours: 5–9 geel, 10–19 groen, 20–29 blauw,
 * 30–39 rood, 40–49 brons, 50–59 zilver, 60–79 goud, 80–100 platina.
 */
export function ringForLevel(level: number): RingColour | null {
  if (!Number.isFinite(level) || level < 5) return null;
  const k = level < 10 ? 0 : level < 20 ? 1 : level < 30 ? 2 : level < 40 ? 3 : level < 50 ? 4 : level < 60 ? 5 : level < 80 ? 6 : 7;
  return RING_ORDER[k] ?? null;
}

/** The avatar a first-time maker opens with: round face, dots, smile, short hair, T-shirt. */
export function defaultAvatar(): AvatarSpec {
  return { v: 1, parts: ['face-round', 'eyes-dots', 'mouth-smile', 'hair-short', 'body-tee'], tone: AVATAR_TONES[1], hair: AVATAR_HAIR[0] };
}

/** mulberry32: a small seeded generator in [0, 1) (no Math.random, docs/specs/README.md §4.11). */
function seededRandom(seed: number): () => number {
  let a = (Number.isFinite(seed) ? Math.floor(seed) % 4294967296 : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * "🎲 Verras me": a random avatar from the parts this person has (`unlocked`), the same for the same
 * seed. Required layers are always filled (when any part of that layer is unlocked), optional layers
 * with a 50% chance; skin tone and hair colour come from the palettes (all free). Parts in
 * LAYER_ORDER.
 */
export function randomAvatar(unlocked: AvatarPart[], seed: number): AvatarSpec {
  const rnd = seededRandom(seed);
  const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(rnd() * list.length)];
  const parts: string[] = [];
  for (const layer of LAYER_ORDER) {
    const options = unlocked.filter((p) => p.layer === layer);
    if (options.length === 0) continue;
    if (!REQUIRED_LAYERS.includes(layer) && rnd() < 0.5) continue;
    const part = pick(options);
    if (part) parts.push(part.id);
  }
  return { v: 1, parts, tone: pick(AVATAR_TONES) ?? AVATAR_TONES[1], hair: pick(AVATAR_HAIR) ?? AVATAR_HAIR[0] };
}

// ---------------------------------------------------------------------------- rendering

/**
 * The whole SVG as a string (no framework), exactly:
 *   <svg viewBox="0 0 100 100" class="avatar-svg" style="--tone:…;--hair:…" aria-hidden="true">
 *     <defs><clipPath id="c-UID"><circle cx="50" cy="50" r="46"/></clipPath></defs>
 *     <circle cx="50" cy="50" r="46" fill="COLOR"/>
 *     <g clip-path="url(#c-UID)">…layers in LAYER_ORDER…</g>
 *     <circle cx="50" cy="50" r="48" fill="none" stroke="RING" stroke-width="4"/>   (only with a ring)
 *   </svg>
 * `color` is the profile colour (a plain CSS colour, else cobalt); `level` gives the ring
 * (`ringForLevel`; pass 0 for no ring); `uid` replaces every `__u` and suffixes the clip path, so
 * several avatars on one page never share an id. Per layer the spec's first part this library
 * knows is drawn; unknown ids are skipped. Tone and hair fall back to the palette defaults.
 */
export function renderAvatarSvg(spec: AvatarSpec, parts: ReadonlyMap<string, AvatarPart>,
  opts: { color: string; level: number; uid: string }): string {
  const uid = String(opts.uid).replace(/[^A-Za-z0-9_-]/g, '') || 'a';
  const tone = fromPalette(spec.tone, AVATAR_TONES) ?? AVATAR_TONES[1];
  const hair = fromPalette(spec.hair, AVATAR_HAIR) ?? AVATAR_HAIR[0];
  const rawColor = typeof opts.color === 'string' ? opts.color.trim() : '';
  const color = SAFE_COLOR.test(rawColor) ? rawColor : DEFAULT_COLOR;

  const byLayer = new Map<AvatarLayer, AvatarPart>();
  for (const id of Array.isArray(spec.parts) ? spec.parts : []) {
    const part = typeof id === 'string' ? parts.get(id) : undefined;
    if (part && !byLayer.has(part.layer)) byLayer.set(part.layer, part);
  }
  let layers = '';
  for (const layer of LAYER_ORDER) {
    const part = byLayer.get(layer);
    if (part) layers += part.svg.replaceAll('__u', uid);
  }

  const ring = ringForLevel(opts.level);
  const ringSvg = ring ? `<circle cx="50" cy="50" r="48" fill="none" stroke="${RING_HEX[ring]}" stroke-width="4"/>` : '';
  return (
    `<svg viewBox="0 0 100 100" class="avatar-svg" style="--tone:${tone};--hair:${hair}" aria-hidden="true">` +
    `<defs><clipPath id="c-${uid}"><circle cx="50" cy="50" r="46"/></clipPath></defs>` +
    `<circle cx="50" cy="50" r="46" fill="${color}"/>` +
    `<g clip-path="url(#c-${uid})">${layers}</g>` +
    ringSvg +
    `</svg>`
  );
}
