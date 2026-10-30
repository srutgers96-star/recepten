// tools/avatar-sheet.ts — contact sheet of the avatar library, for reviewing the drawings
// (docs/specs/badges-avatar.md, block 6D-UI, UI-C point 6).
//
// Run:    node --experimental-strip-types tools/avatar-sheet.ts
// Reads:  data/avatar-parts.json (and data/badges.json for the ladder tier of a badge part)
// Writes: scratch/avatar-sheet.html (scratch/ is in .gitignore; open the file in a browser)
//
// Every part is drawn with the app's own renderAvatarSvg on a neutral base avatar (the default
// avatar: round face, dots, smile, short hair, shirt), with only that part's layer swapped in, at
// 40 px (the smallest size in the app that must stay readable) and at 96 px, per layer. On top: the
// base avatar on every profile colour, and on every skin tone and hair colour.
//
// Node 22 type stripping: type-only syntax, plain ESM; no dependency.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVATAR_HAIR,
  AVATAR_TONES,
  defaultAvatar,
  normalizeAvatarParts,
  randomAvatar,
  renderAvatarSvg,
  type AvatarLayer,
  type AvatarPart,
  type AvatarSpec,
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
  const badges = readJson('data/badges.json') as Badge[];
  const parts = normalizeAvatarParts(readJson('data/avatar-parts.json'), Array.isArray(badges) ? badges : []);
  const byId: ReadonlyMap<string, AvatarPart> = new Map(parts.map((p) => [p.id, p]));
  const base = defaultAvatar();

  const sections: string[] = [];

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
      return `<figure><div class="a96">${draw(withPart(p, byId), byId)}</div><figcaption><b>${esc(p.id)}</b><br>` +
        `${esc(p.nl)} / ${esc(p.en)}<br><span>${esc(unlockText(p))} · ${bytes} B · ${elementCount(p.svg)} el</span></figcaption></figure>`;
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
  figure { margin: 0; text-align: center; }
  figcaption { font-size: 11px; margin-top: 4px; word-break: break-word; }
  figcaption span { color: #6b625b; }
  .a40 { width: 40px; height: 40px; border-radius: 999px; overflow: hidden; }
  .a72 { width: 72px; height: 72px; border-radius: 999px; overflow: hidden; }
  .a96 { width: 96px; height: 96px; border-radius: 999px; overflow: hidden; margin: 0 auto; }
  .avatar-svg { display: block; width: 100%; height: 100%; }
</style></head>
<body>
<h1>Avatar-onderdelen: ${parts.length}</h1>
<nav><a href="#base">basis</a>${counts.join('')}</nav>
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
  console.log(`${OUT}: ${parts.length} parts on ${SHEET_LAYERS.length} layers.`);
}

main();
