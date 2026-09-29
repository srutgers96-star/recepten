// Tiny, storage-free landing viewer for shared links opened in iOS Safari (outside the installed
// app). Decodes the token client-side and shows it read-only with an NL/EN switch, "Copy code"
// and the hand-off card. It NEVER writes to storage (invariant, CLAUDE.md 6): Safari's bucket is
// invisible to the Home Screen app. Imports domain modules only (no Dexie, no router).
//   #r=  one recipe (schema 2 or any older shape, through normalizeRecipe)
//   #p=  an adjustment of a classic: "Aanpassing van <name> door <by>" + the changed fields
//   #b=  a bundle: the recipes (names in both languages) and adjustments it holds
// Ingredient lines are rendered through the bundled dictionary (schema-2 lines carry `ing`,
// `qty`, `unit`, `prep` and usually only a Dutch `raw`), so the EN view shows English names;
// a line the dictionary cannot render falls back to its raw text.
import { defaultDictionary } from './domain/data';
import { pickText, type Lang, type Line, type Recipe, type Step, type Text } from './domain/model';
import { renderLine } from './domain/render';
import { parseEnvelope, type ParsedShare, type PatchPayload } from './domain/share';
import { decodeToken } from './domain/token';

const S = {
  nl: {
    title: "Rutgers' Recepten",
    preview: 'Voorproefje van een gedeeld recept',
    previewPatch: 'Voorproefje van een gedeelde aanpassing',
    previewBundle: 'Voorproefje van een gedeelde bundel',
    ingredients: 'Ingrediënten',
    method: 'Bereiding',
    tip: 'Serveertip',
    copy: 'Kopieer receptcode',
    copied: 'Gekopieerd. Open nu de Recepten-app op je beginscherm → Inbox → Plak.',
    copyFailed: 'Kopiëren mislukt — houd de link in WhatsApp ingedrukt en kies Kopieer.',
    handoff: 'Bewaren in je app',
    steps: ['Tik op "Kopieer receptcode"', 'Open Recepten op je beginscherm', 'Tab Inbox → Plak van klembord → Importeer'],
    install: 'Nog geen app? Deel → Zet op beginscherm.',
    openApp: "Open Rutgers' Recepten (hele app)",
    invalid: 'Deze link bevat geen leesbaar recept.',
    unsupported: 'Deze code is nieuwer dan deze pagina. Update de app.',
    by: 'van',
    servings: 'pers.',
    patchOf: 'Aanpassing van',
    patchBy: 'door',
    patchHint: 'Wordt in de app op je eigen exemplaar van deze klassieker gelegd; er komt geen dubbel recept bij.',
    changed: 'Gewijzigd:',
    fields: { name: 'naam', description: 'omschrijving', lines: 'ingrediënten', steps: 'bereiding', category: 'categorie', tags: 'kenmerken', servingTip: 'serveertip' } as Record<string, string>,
    bundleRecipes: (n: number) => `${n} ${n === 1 ? 'recept' : 'recepten'}`,
    bundlePatches: (n: number) => `${n} aangepaste ${n === 1 ? 'klassieker' : 'klassiekers'}`,
    bundleIngredients: (n: number) => `${n} ${n === 1 ? 'nieuw ingrediënt' : 'nieuwe ingrediënten'}`,
    adjusted: 'aangepast',
    empty: 'Deze bundel is leeg.',
  },
  en: {
    title: "Rutgers' Recipes",
    preview: 'Preview of a shared recipe',
    previewPatch: 'Preview of a shared adjustment',
    previewBundle: 'Preview of a shared bundle',
    ingredients: 'Ingredients',
    method: 'Method',
    tip: 'Serving tip',
    copy: 'Copy recipe code',
    copied: 'Copied. Now open the Recepten app on your Home Screen → Inbox → Paste.',
    copyFailed: 'Copy failed — long-press the link in WhatsApp and choose Copy.',
    handoff: 'Save it in your app',
    steps: ['Tap "Copy recipe code"', 'Open Recepten on your Home Screen', 'Inbox tab → Paste from clipboard → Import'],
    install: 'No app yet? Share → Add to Home Screen.',
    openApp: "Open Rutgers' Recipes (the whole app)",
    invalid: 'This link does not contain a readable recipe.',
    unsupported: 'This code is newer than this page. Update the app.',
    by: 'from',
    servings: 'servings',
    patchOf: 'Adjustment of',
    patchBy: 'by',
    patchHint: 'The app applies it to your own copy of this classic; no duplicate recipe is added.',
    changed: 'Changed:',
    fields: { name: 'name', description: 'description', lines: 'ingredients', steps: 'method', category: 'category', tags: 'tags', servingTip: 'serving tip' } as Record<string, string>,
    bundleRecipes: (n: number) => `${n} ${n === 1 ? 'recipe' : 'recipes'}`,
    bundlePatches: (n: number) => `${n} adjusted ${n === 1 ? 'classic' : 'classics'}`,
    bundleIngredients: (n: number) => `${n} new ${n === 1 ? 'ingredient' : 'ingredients'}`,
    adjusted: 'adjusted',
    empty: 'This bundle is empty.',
  },
} as const;

const CSS = `
:root{color-scheme:light dark;--paper:#eaf3fb;--card:#fff;--ink:#1f2733;--muted:#5b6775;--cobalt:#2b4fa8;--line:rgba(31,39,51,.12);--on:#fff}
@media(prefers-color-scheme:dark){:root{--paper:#0f1a2b;--card:#17243a;--ink:#e8eef6;--muted:#9fb0c3;--cobalt:#6f8fe0;--line:rgba(232,238,246,.14);--on:#0f1a2b}}
*{box-sizing:border-box}html,body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
/* The app shell (base.css) locks html/body/#app to the viewport and scrolls inside; that stylesheet can be
   loaded on this page too, which left the Safari preview unscrollable. This page is a plain document. */
html,body{height:auto!important;min-height:100%;overflow:auto!important;overscroll-behavior:auto!important}
#app{height:auto!important;min-height:100%;overflow:visible!important;display:block!important}
main{max-width:40rem;margin:auto;padding:calc(12px + env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.top{display:flex;align-items:center;gap:8px}.top h1{flex:1;font-size:20px;color:var(--cobalt);margin:0}
.lang{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}.lang button{min-width:44px;min-height:44px;border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:700}
.lang button.on{background:var(--cobalt);color:var(--on)}
h2{font-size:26px;margin:20px 0 4px}h3{font-size:17px;margin:20px 0 8px}p{margin:0 0 12px}.muted{color:var(--muted);font-size:14px}
ul{margin:0;padding:0;list-style:none}li{padding:8px 0;border-bottom:1px solid var(--line)}li.head{font-weight:700;color:var(--cobalt);border-bottom:0;padding-top:14px}
li .alt{display:block;font-size:14px;color:var(--muted);font-style:italic}li .tag{font-size:13px;color:var(--muted)}
ol{margin:0;padding-left:24px}ol li{padding:6px 0 6px 4px;border-bottom:1px solid var(--line)}
.btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin:20px 0 8px;border:0;border-radius:12px;background:var(--cobalt);color:var(--on);font:inherit;font-weight:600;text-decoration:none;box-sizing:border-box}
.btn.secondary{background:transparent;color:var(--cobalt);border:1px solid var(--cobalt)}
.card{background:var(--card);border:1px solid var(--cobalt);border-radius:14px;padding:14px 16px;margin:16px 0;font-size:14px}.card ol{margin:6px 0;padding-left:20px}.card ol li{border:0;padding:2px 0}
.status{min-height:22px;font-size:14px;color:var(--muted)}
`;

/** The app itself (no token): opening it in Safari is the first step towards "Add to Home Screen". */
function appUrl(): string {
  return location.origin + import.meta.env.BASE_URL;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

const app = document.getElementById('app')!;
let lang: Lang = /^en/i.test(navigator.language ?? '') ? 'en' : 'nl';
let share: ParsedShare | null = null;
let problem: 'invalid' | 'unsupported' | null = null;

/** "<nl> · <en>" when both exist and differ, else the one that exists. */
function bothNames(t: Text | null | undefined): string {
  const nl = (t?.nl ?? '').trim();
  const en = (t?.en ?? '').trim();
  if (nl && en && nl.toLowerCase() !== en.toLowerCase()) return `${nl} · ${en}`;
  return nl || en || '?';
}

function linesHtml(lines: readonly Line[]): string {
  const dict = defaultDictionary();
  return lines
    .map((l) => {
      const header = l.kind === 'header';
      let text = '';
      if (!header) {
        try {
          text = renderLine(l, dict, lang);
        } catch {
          text = '';
        }
      }
      return { text: text || pickText(l.raw, lang), header };
    })
    .filter((l) => l.text)
    .map((l) => `<li${l.header ? ' class="head"' : ''}>${esc(l.text)}</li>`)
    .join('');
}

function stepsHtml(steps: readonly Step[]): string {
  return steps
    .map((s) => pickText(s.text, lang))
    .filter(Boolean)
    .map((s) => `<li>${esc(s).replace(/\n/g, '<br>')}</li>`)
    .join('');
}

function recipeHtml(recipe: Recipe, by: string): string[] {
  const L = S[lang];
  const parts: string[] = [];
  parts.push(`<h2>${esc(pickText(recipe.name, lang) || '?')}</h2>`);
  const meta = [recipe.servings > 0 ? `${recipe.servings} ${L.servings}` : '', by ? `${L.by} ${by}` : ''].filter(Boolean).join(' · ');
  if (meta) parts.push(`<p class="muted">${esc(meta)}</p>`);
  const description = pickText(recipe.description, lang);
  if (description) parts.push(`<p>${esc(description)}</p>`);
  if (recipe.lines.length) parts.push(`<h3>${esc(L.ingredients)}</h3><ul>${linesHtml(recipe.lines)}</ul>`);
  if (recipe.steps.length) parts.push(`<h3>${esc(L.method)}</h3><ol>${stepsHtml(recipe.steps)}</ol>`);
  const tip = pickText(recipe.servingTip, lang);
  if (tip) parts.push(`<h3>${esc(L.tip)}</h3><p>${esc(tip)}</p>`);
  return parts;
}

/** "Aanpassing van <classic> door <by>", the changed fields, and the patched content that is showable. */
function patchHtml(p: PatchPayload, by: string): string[] {
  const L = S[lang];
  const parts: string[] = [];
  const name = pickText(p.name, lang) || p.baseId.replace(/^b:/, '');
  parts.push(`<h2>${esc(L.patchOf)} ${esc(name)}</h2>`);
  if (by) parts.push(`<p class="muted">${esc(L.patchBy)} ${esc(by)}</p>`);
  const patch = p.patch ?? {};
  const changed = Object.keys(patch)
    .filter((k) => patch[k] !== undefined)
    .map((k) => L.fields[k] ?? k);
  if (changed.length) parts.push(`<p><strong>${esc(L.changed)}</strong> ${esc(changed.join(', '))}</p>`);
  parts.push(`<p class="muted">${esc(L.patchHint)}</p>`);
  const patchedName = patch.name && typeof patch.name === 'object' ? pickText(patch.name as Text, lang) : '';
  if (patchedName && patchedName !== name) parts.push(`<p><strong>${esc(L.fields.name ?? 'name')}:</strong> ${esc(patchedName)}</p>`);
  const description = patch.description && typeof patch.description === 'object' ? pickText(patch.description as Text, lang) : '';
  if (description) parts.push(`<p>${esc(description)}</p>`);
  if (Array.isArray(patch.lines) && patch.lines.length) parts.push(`<h3>${esc(L.ingredients)}</h3><ul>${linesHtml(patch.lines as Line[])}</ul>`);
  if (Array.isArray(patch.steps) && patch.steps.length) parts.push(`<h3>${esc(L.method)}</h3><ol>${stepsHtml(patch.steps as Step[])}</ol>`);
  const tip = patch.servingTip && typeof patch.servingTip === 'object' ? pickText(patch.servingTip as Text, lang) : '';
  if (tip) parts.push(`<h3>${esc(L.tip)}</h3><p>${esc(tip)}</p>`);
  return parts;
}

/** The bundle as a list: recipe names (both languages), adjustments, new ingredients. */
function bundleHtml(s: ParsedShare, by: string): string[] {
  const L = S[lang];
  const parts: string[] = [];
  parts.push(`<h2>${esc(s.title || L.bundleRecipes(s.recipes.length + s.patches.length))}</h2>`);
  const counts = [
    s.recipes.length ? L.bundleRecipes(s.recipes.length) : '',
    s.patches.length ? L.bundlePatches(s.patches.length) : '',
    s.dict.ing.length ? L.bundleIngredients(s.dict.ing.length) : '',
    by ? `${L.by} ${by}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (counts) parts.push(`<p class="muted">${esc(counts)}</p>`);
  const items: string[] = [];
  for (const r of s.recipes) {
    const nl = (r.name.nl ?? '').trim();
    const en = (r.name.en ?? '').trim();
    const first = pickText(r.name, lang) || '?';
    const other = lang === 'nl' ? en : nl;
    const alt = other && other.toLowerCase() !== first.toLowerCase() ? `<span class="alt">${esc(other)}</span>` : '';
    items.push(`<li>${esc(first)}${alt}</li>`);
  }
  for (const p of s.patches) {
    const name = pickText(p.name, lang) || p.baseId.replace(/^b:/, '');
    items.push(`<li>${esc(name)} <span class="tag">(${esc(L.adjusted)})</span></li>`);
  }
  for (const e of s.dict.ing) {
    const name = (lang === 'nl' ? e.nl.one : e.en.one) || e.nl.one || e.en.one || e.id;
    items.push(`<li class="muted">+ ${esc(name)}</li>`);
  }
  parts.push(items.length ? `<ul>${items.join('')}</ul>` : `<p>${esc(L.empty)}</p>`);
  return parts;
}

function render() {
  const L = S[lang];
  const parts: string[] = [];
  parts.push(`<style>${CSS}</style><main>`);
  parts.push(`<div class="top"><h1>${esc(L.title)}</h1><div class="lang"><button type="button" data-lang="nl" class="${lang === 'nl' ? 'on' : ''}">NL</button><button type="button" data-lang="en" class="${lang === 'en' ? 'on' : ''}">EN</button></div></div>`);
  const recipe = share?.kind === 'recipe' ? share.recipes[0] : undefined;
  const patch = share?.kind === 'patch' ? share.patches[0] : undefined;
  const bundle = share?.kind === 'bundle' ? share : undefined;
  const by = share?.by ?? '';
  parts.push(`<p class="muted">${esc(patch ? L.previewPatch : bundle ? L.previewBundle : L.preview)}</p>`);
  if (recipe || patch || bundle) {
    if (recipe) parts.push(...recipeHtml(recipe, by));
    else if (patch) parts.push(...patchHtml(patch, by));
    else if (bundle) parts.push(...bundleHtml(bundle, by));
    parts.push(`<button type="button" class="btn" id="copy">${esc(L.copy)}</button><div class="status" id="status"></div>`);
    parts.push(`<div class="card"><strong>${esc(L.handoff)}</strong><ol>${L.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><div class="muted">${esc(L.install)}</div></div>`);
    parts.push(`<a class="btn secondary" href="${esc(appUrl())}">${esc(L.openApp)}</a>`);
  } else {
    parts.push(`<p>${esc(problem === 'unsupported' ? L.unsupported : L.invalid)}</p>`);
    parts.push(`<a class="btn" href="${esc(appUrl())}">${esc(L.openApp)}</a>`);
    parts.push(`<div class="card"><div class="muted">${esc(L.install)}</div></div>`);
  }
  parts.push('</main>');
  app.innerHTML = parts.join('');

  for (const b of app.querySelectorAll<HTMLButtonElement>('button[data-lang]')) {
    b.addEventListener('click', () => {
      lang = b.dataset.lang === 'en' ? 'en' : 'nl';
      render();
    });
  }
  document.getElementById('copy')?.addEventListener('click', async () => {
    const status = document.getElementById('status')!;
    try {
      await navigator.clipboard.writeText(location.href);
      status.textContent = S[lang].copied;
    } catch {
      status.textContent = S[lang].copyFailed;
    }
  });
}

async function boot() {
  const m = /^#([rpwb])=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (m && (m[1] === 'r' || m[1] === 'p' || m[1] === 'b') && m[2]) {
    try {
      const env = await decodeToken(m[2]);
      if (env.t !== m[1]) throw new Error('invalid-token');
      const parsed = parseEnvelope(env);
      const usable =
        (parsed.kind === 'recipe' && parsed.recipes.length > 0) ||
        (parsed.kind === 'patch' && parsed.patches.length > 0) ||
        (parsed.kind === 'bundle' && (parsed.recipes.length > 0 || parsed.patches.length > 0));
      if (usable) share = parsed;
      else problem = 'invalid';
    } catch (e) {
      problem = (e as Error)?.message === 'unsupported-version' ? 'unsupported' : 'invalid';
    }
  } else {
    problem = 'invalid';
  }
  render();
}

void boot();
