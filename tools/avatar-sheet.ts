// tools/avatar-sheet.ts — contact sheet of the avatar library, for reviewing the drawings
// (docs/specs/badges-avatar.md, block 6D-UI, UI-C point 6) and their rarity (block 6D-R point 4).
//
// Run:    node --experimental-strip-types tools/avatar-sheet.ts
// Reads:  data/avatar-parts.json (and data/badges.json for the ladder tier and the secrecy of a
//         badge part)
// Writes: scratch/avatar-sheet.html (scratch/ is in .gitignore; open the file in a browser), and
//         prints the rarity balance table to the console
//
// Every part is drawn with the app's own renderAvatarSvg on a neutral base avatar (the default
// avatar: round face, dots, smile, short hair, shirt), with only that part's layer swapped in, at
// 40 px (the smallest size in the app that must stay readable) and at 96 px, per layer; each 96 px
// part carries its rarity as a coloured corner and in text (with the level/badge rule next to it
// when Fable set another rarity by hand). On top: the balance table per rarity (how many, and how
// many of the level parts of a rarity you have before level 20 / 50 / 80; badge parts apart), then
// the base avatar on every profile colour, and on every skin tone and hair colour.
//
// Node 22 type stripping: type-only syntax, plain ESM; no dependency.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVATAR_HAIR,
  AVATAR_TONES,
  defaultAvatar,
  RARITIES,
  normalizeAvatarParts,
  randomAvatar,
  rarityFor,
  renderAvatarSvg,
  type AvatarLayer,
  type AvatarPart,
  type AvatarSpec,
  type Rarity,
} from '../src/domain/avatar.ts';
import type { Badge } from '../src/domain/badges.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scratch', 'avatar-sheet.html');

/** The layers in the maker's order (AvatarSheet ROWS without the two colour rows). */
const SHEET_LAYERS: readonly AvatarLayer[] = ['face', 'hair', 'eyes', 'mouth', 'facial', 'glasses', 'hat', 'body', 'prop', 'pin', 'bg'];
/** The neutral colour behind every part (cobalt, the default member colour). */
const BASE_COLOR = '#2b4fa8';
/** Mirrors PROFILE_COLORS in src/profile.ts (not imported: that module needs the app). */
const PROFILE_COLORS = ['#2b4fa8', '#d9402b', '#3d7a3a', '#d98a2e', '#7a3d8a', '#2a8a8a', '#1f3b73', '#b0246b',
  '#a6421c', '#8a5a00', '#5a6b1f', '#1f6b5a', '#4a5d78', '#7a1f3d'];

/** The rarity names of the maker (src/i18n/avatar.ts `avatar.rarity.*`, NL) and the light-theme
 *  colours of its tokens (src/styles/avatar.css `--rarity-*`; common = var(--muted), #5b6775 in
 *  src/styles/base.css). */
const RARITY_NAME: Readonly<Record<Rarity, string>> = { common: 'Gewoon', rare: 'Zeldzaam', epic: 'Episch', legendary: 'Legendarisch' };
const RARITY_COLOR: Readonly<Record<Rarity, string>> = { common: '#5b6775', rare: '#2b6fd6', epic: '#7a5aa8', legendary: '#c9a227' };
/** The guideline of block 6D-R point 3 (not a hard number). */
const RARITY_GUIDE: Readonly<Record<Rarity, string>> = { common: '±50 %', rare: '±30 %', epic: '±15 %', legendary: '±5 %' };
/** "Before level N you have n of m <rarity>s": only level unlocks count (point 4). */
const BEFORE_LEVEL: Readonly<Partial<Record<Rarity, number>>> = { common: 20, rare: 50, epic: 80 };
const RARITY_PLURAL: Readonly<Record<Rarity, string>> = { common: 'commons', rare: 'rares', epic: 'epics', legendary: 'legendaries' };

/** A badge as data/badges.json has it, with only what the rarity rule reads. */
type RawBadge = { id?: unknown; group?: unknown; hidden?: unknown; tiers?: unknown; unlock?: unknown };

/** Hidden like normalizeBadges says (group 'geheim' is always hidden); src/domain/badges.ts is not
 *  importable under Node type stripping (its imports have no .ts extension). */
function isHiddenBadge(b: RawBadge | undefined): boolean {
  return b?.hidden === true || b?.group === 'geheim';
}

function levelOf(part: AvatarPart): number | null {
  return 'level' in part.unlock ? part.unlock.level : null;
}

function pct(n: number, total: number): string {
  return total === 0 ? '–' : `${Math.round((100 * n) / total)} %`;
}

interface BalanceRow {
  rarity: Rarity;
  total: number;
  byLevel: AvatarPart[];
  byBadge: AvatarPart[];
  /** "vóór level N": n of the m level parts of this rarity unlock at level ≤ N. */
  before: { level: number; n: number; m: number } | null;
}

function balance(parts: readonly AvatarPart[]): BalanceRow[] {
  return RARITIES.map((rarity) => {
    const list = parts.filter((p) => p.rarity === rarity);
    const byLevel = list.filter((p) => levelOf(p) !== null);
    const limit = BEFORE_LEVEL[rarity];
    const before = limit === undefined ? null
      : { level: limit, n: byLevel.filter((p) => (levelOf(p) ?? 0) <= limit).length, m: byLevel.length };
    return { rarity, total: list.length, byLevel, byBadge: list.filter((p) => levelOf(p) === null), before };
  });
}

function beforeText(row: BalanceRow): string {
  if (!row.before) return '–';
  return `vóór level ${row.before.level} (t/m ${row.before.level}) heb je ${row.before.n} van ${row.before.m} ${RARITY_PLURAL[row.rarity]}`;
}

function badgeText(part: AvatarPart): string {
  const u = part.unlock;
  return 'badge' in u ? `${part.id} (${u.badge}${u.tier !== undefined ? ` @${u.tier}` : ''})` : part.id;
}

/** The balance table as plain Markdown, for the console (and the build report). */
function balanceMarkdown(rows: readonly BalanceRow[], total: number): string {
  const lines = [
    '| Zeldzaamheid | Aantal | Aandeel (richtlijn) | Via level | Via badge | Vóór level |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${RARITY_NAME[r.rarity]} (${r.rarity}) | ${r.total} | ${pct(r.total, total)} (${RARITY_GUIDE[r.rarity]}) | ${r.byLevel.length} | ${r.byBadge.length} | ${beforeText(r)} |`),
    `| Totaal | ${total} | | ${rows.reduce((a, r) => a + r.byLevel.length, 0)} | ${rows.reduce((a, r) => a + r.byBadge.length, 0)} | |`,
    '',
    'Badge-onderdelen (tellen niet mee in "vóór level"):',
    ...rows.filter((r) => r.byBadge.length > 0).map((r) => `- ${RARITY_NAME[r.rarity]} (${r.byBadge.length}): ${r.byBadge.map(badgeText).join(', ')}`),
  ];
  return lines.join('\n');
}

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as unknown;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let uidCounter = 0;
function draw(spec: AvatarSpec, byId: ReadonlyMap<string, AvatarPart>, color = BASE_COLOR, level = 0): string {
  uidCounter += 1;
  return renderAvatarSvg(spec, byId, { color, level, uid: `s${uidCounter}` });
}

/** The base avatar with `part` in its layer (replacing the base part of that layer, if any). */
function withPart(part: AvatarPart, byId: ReadonlyMap<string, AvatarPart>): AvatarSpec {
  const base = defaultAvatar();
  const parts = base.parts.filter((id) => byId.get(id)?.layer !== part.layer);
  return { ...base, parts: [...parts, part.id] };
}

function unlockText(part: AvatarPart): string {
  const u = part.unlock;
  if ('level' in u) return `Lv ${u.level}`;
  return `badge ${u.badge}${u.tier !== undefined ? ` @${u.tier}` : ''}`;
}

function elementCount(svg: string): number {
  return (svg.match(/<[a-z]+/g) ?? []).length;
}

function main(): void {
  const rawBadges = readJson('data/badges.json');
  const badgeList: RawBadge[] = Array.isArray(rawBadges) ? (rawBadges as RawBadge[]) : [];
  // Raw badges carry `tiers` and `unlock` as normalizeBadges keeps them; `hidden` as it decides it.
  const badges = badgeList.map((b) => ({ ...b, hidden: isHiddenBadge(b) })) as unknown as Badge[];
  const badgeById = new Map(badges.map((b) => [b.id, b]));
  const parts = normalizeAvatarParts(readJson('data/avatar-parts.json'), badges);
  const byId: ReadonlyMap<string, AvatarPart> = new Map(parts.map((p) => [p.id, p]));
  const base = defaultAvatar();
  /** The rarity the level/badge rule would give (the fallback when the data has none). */
  const ruleOf = (p: AvatarPart): Rarity => rarityFor(p.unlock, 'badge' in p.unlock ? badgeById.get(p.unlock.badge) ?? null : null);
  const deviations = parts.filter((p) => ruleOf(p) !== p.rarity);

  const sections: string[] = [];

  // The rarity balance (block 6D-R point 4), so Stijn and Fable can judge the distribution.
  const rows = balance(parts);
  const tableRows = rows.map((r) => `<tr class="r-${r.rarity}"><th><span class="dot"></span>${RARITY_NAME[r.rarity]}</th>` +
    `<td>${r.total}</td><td>${pct(r.total, parts.length)} <span>(${RARITY_GUIDE[r.rarity]})</span></td>` +
    `<td>${r.byLevel.length}</td><td>${r.byBadge.length}</td><td>${esc(beforeText(r))}</td></tr>`).join('');
  const badgeLines = rows.filter((r) => r.byBadge.length > 0)
    .map((r) => `<li class="r-${r.rarity}"><span class="dot"></span><b>${RARITY_NAME[r.rarity]} (${r.byBadge.length}):</b> ${esc(r.byBadge.map(badgeText).join(', '))}</li>`).join('');
  const deviationText = deviations.map((p) => `${p.id} (regel ${RARITY_NAME[ruleOf(p)].toLowerCase()} → ${RARITY_NAME[p.rarity].toLowerCase()})`).join(', ');
  sections.push(`<section id="rarity"><h2>Zeldzaamheid</h2>` +
    `<div class="table-wrap"><table><thead><tr><th>Zeldzaamheid</th><th>Aantal</th><th>Aandeel (richtlijn)</th><th>Via level</th><th>Via badge</th><th>Vóór level (alleen level-onderdelen)</th></tr></thead>` +
    `<tbody>${tableRows}<tr><th>Totaal</th><td>${parts.length}</td><td></td><td>${rows.reduce((a, r) => a + r.byLevel.length, 0)}</td>` +
    `<td>${rows.reduce((a, r) => a + r.byBadge.length, 0)}</td><td></td></tr></tbody></table></div>` +
    `<p>Badge-onderdelen (tellen niet mee in "vóór level"):</p><ul>${badgeLines}</ul>` +
    `<p>Met de hand anders dan de regel (${deviations.length}): ${esc(deviationText)}</p></section>`);

  // The base avatar on every profile colour, then on every skin tone and every hair colour.
  const colours = PROFILE_COLORS.map((c) => `<div class="a72" title="${c}">${draw(base, byId, c)}</div>`).join('');
  const tones = AVATAR_TONES.map((t) => `<div class="a72" title="${t}">${draw({ ...base, tone: t }, byId)}</div>`).join('');
  const hair = AVATAR_HAIR.map((h) => `<div class="a72" title="${h}">${draw({ ...base, hair: h }, byId)}</div>`).join('');
  // Sixteen "🎲 Verras me" avatars from the whole library (fixed seeds), to check the layers together.
  const random = Array.from({ length: 16 }, (_, i) => randomAvatar(parts, 1000 + i * 7919))
    .map((spec, i) => `<div class="a72">${draw(spec, byId, PROFILE_COLORS[i % PROFILE_COLORS.length], 5 + i * 6)}</div>`).join('');
  sections.push(`<section id="base"><h2>Basis-avatar</h2><p>Profielkleuren</p><div class="row">${colours}</div>` +
    `<p>Huidtinten</p><div class="row">${tones}</div><p>Haarkleuren</p><div class="row">${hair}</div>` +
    `<p>Verras me (alle lagen samen, met rand)</p><div class="row">${random}</div></section>`);

  const counts: string[] = [];
  for (const layer of SHEET_LAYERS) {
    const list = parts.filter((p) => p.layer === layer);
    counts.push(`<a href="#${layer}">${layer} ${list.length}</a>`);
    const small = list.map((p) => `<div class="a40" title="${esc(p.id)}">${draw(withPart(p, byId), byId)}</div>`).join('');
    const cells = list.map((p) => {
      const bytes = new TextEncoder().encode(p.svg).length;
      const rule = ruleOf(p);
      const ruleNote = rule !== p.rarity ? ` <span>(regel: ${RARITY_NAME[rule].toLowerCase()})</span>` : '';
      return `<figure class="r-${p.rarity}" title="${RARITY_NAME[p.rarity]}"><div class="a96">${draw(withPart(p, byId), byId)}</div><figcaption><b>${esc(p.id)}</b><br>` +
        `${esc(p.nl)} / ${esc(p.en)}<br><em>${RARITY_NAME[p.rarity]}</em>${ruleNote}<br>` +
        `<span>${esc(unlockText(p))} · ${bytes} B · ${elementCount(p.svg)} el</span></figcaption></figure>`;
    }).join('');
    sections.push(`<section id="${layer}"><h2>${layer} (${list.length})</h2><div class="row">${small}</div><div class="grid">${cells}</div></section>`);
  }

  const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Avatar contact sheet</title>
<style>
  body { margin: 0; padding: 16px; font: 13px/1.35 system-ui, sans-serif; background: #f4f2ee; color: #2a2420; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 8px; }
  nav { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 0 0 16px; }
  section { background: #fff; border-radius: 12px; padding: 12px; margin: 0 0 16px; }
  p { margin: 8px 0 4px; color: #6b625b; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  figure { margin: 0; text-align: center; position: relative; padding-top: 4px; }
  /* The rarity: a coloured corner on every part, and its name in the caption. */
  figure::before { content: ""; position: absolute; top: 0; left: 0; border-top: 22px solid var(--r); border-right: 22px solid transparent; border-top-left-radius: 6px; }
  figcaption em { font-style: normal; font-weight: 600; color: var(--r); }
  .r-common { --r: ${RARITY_COLOR.common}; }
  .r-rare { --r: ${RARITY_COLOR.rare}; }
  .r-epic { --r: ${RARITY_COLOR.epic}; }
  .r-legendary { --r: ${RARITY_COLOR.legendary}; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; background: var(--r); margin-right: 6px; vertical-align: baseline; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; margin: 0 0 8px; }
  th, td { text-align: left; padding: 4px 10px 4px 0; border-bottom: 1px solid #eee; vertical-align: top; }
  thead th { font-weight: 600; color: #6b625b; }
  tbody th { color: var(--r, inherit); }
  td span { color: #6b625b; }
  ul { margin: 4px 0 8px; padding-left: 18px; }
  figcaption { font-size: 11px; margin-top: 4px; word-break: break-word; }
  figcaption span { color: #6b625b; }
  .a40 { width: 40px; height: 40px; border-radius: 999px; overflow: hidden; }
  .a72 { width: 72px; height: 72px; border-radius: 999px; overflow: hidden; }
  .a96 { width: 96px; height: 96px; border-radius: 999px; overflow: hidden; margin: 0 auto; }
  .avatar-svg { display: block; width: 100%; height: 100%; }
</style></head>
<body>
<h1>Avatar-onderdelen: ${parts.length}</h1>
<nav><a href="#rarity">zeldzaamheid</a><a href="#base">basis</a>${counts.join('')}</nav>
${sections.join('\n')}
<script>
  // avatar-sheet.html?layer=hat shows only that layer (one screenshot per layer).
  const only = new URLSearchParams(location.search).get('layer');
  if (only) for (const s of document.querySelectorAll('section')) s.hidden = s.id !== only;
</script>
</body></html>
`;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  console.log(`${OUT}: ${parts.length} parts on ${SHEET_LAYERS.length} layers.\n`);
  console.log(balanceMarkdown(rows, parts.length));
  console.log(`\nMet de hand anders dan de regel (${deviations.length}): ${deviationText}`);
}

main();
