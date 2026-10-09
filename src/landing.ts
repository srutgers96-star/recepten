// Tiny, storage-free landing viewer for shared links opened in iOS Safari (outside the installed
// app). Decodes the token client-side and shows it read-only with an NL/EN switch, "Copy code"
// and the hand-off card. It NEVER writes to storage (invariant, CLAUDE.md 6): Safari's bucket is
// invisible to the Home Screen app. Imports domain modules only (no Dexie, no router).
//   #r=  one recipe (schema 2 or any older shape, through normalizeRecipe)
//   #p=  an adjustment of a classic: "Aanpassing van <name> door <by>" + the changed fields
//   #b=  a bundle: the recipes (names in both languages) and adjustments it holds
//   #w=  a week plan: "Weekplan van <by>: N gerechten" and the own recipes it carries (builtins
//        travel by id only, so they are counted, not named)
//   #f=  a member card: "Kaartje van <name>" with the colour swatch and language; "Kopieer code"
//        and the same hand-off card (copy → app → Inbox → Plak), because on an iPhone a link
//        never opens the installed app (CLAUDE.md invariant 5)
// Ingredient lines are rendered through the bundled dictionary (schema-2 lines carry `ing`,
// `qty`, `unit`, `prep` and usually only a Dutch `raw`), so the EN view shows English names;
// a line the dictionary cannot render falls back to its raw text. The dictionary is by far the
// largest part of the app (±1600 products, ~60 kB gzip), so it is NOT in this bundle: the page
// paints with the raw line text first and loads the dictionary afterwards (`import()`), which
// only improves the ingredient lines once it is in.
import type { Dictionary } from './domain/dictionary';
import { pickText, type Lang, type Line, type Recipe, type Step, type Text } from './domain/model';
import { renderLine } from './domain/render';
import { parseEnvelope, type MemberCard, type ParsedShare, type PatchPayload } from './domain/share';
import { decodeToken } from './domain/token';

const S = {
  nl: {
    title: "Rutgers' Recepten",
    preview: 'Voorproefje van een gedeeld recept',
    previewPatch: 'Voorproefje van een gedeelde aanpassing',
    previewBundle: 'Voorproefje van een gedeelde bundel',
    previewPlan: 'Voorproefje van een gedeeld weekplan',
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
    planOf: (n: number, by: string) => `Weekplan${by ? ` van ${by}` : ''}: ${n} ${n === 1 ? 'gerecht' : 'gerechten'}`,
    planFromApp: (n: number) => `${n} ${n === 1 ? 'gerecht' : 'gerechten'} uit de app zelf (staan al op je telefoon)`,
    planNote: 'Notitie',
    planHint: 'In de app kies je Overnemen (vervangt je week) of Toevoegen (alleen wat ontbreekt).',
    planEmpty: 'Dit weekplan is leeg.',
    previewMember: 'Voorproefje van een gedeeld ledenkaartje',
    memberOf: (name: string) => `Kaartje van ${name}`,
    memberLang: (l: Lang) => (l === 'en' ? 'Taal: Engels' : 'Taal: Nederlands'),
    memberHint: (name: string) => `In de app voeg je ${name} toe aan je huishouden. Recepten van ${name} krijgen dan deze naam en kleur, en "Deel je nieuwe recepten" kent ${name} al.`,
    copyCard: 'Kopieer code',
    copiedCard: 'Gekopieerd. Open nu de Recepten-app op je beginscherm → Inbox → Plak.',
    stepsCard: ['Tik op "Kopieer code"', 'Open Recepten op je beginscherm', 'Tab Inbox → Plak van klembord → Voeg toe aan huishouden'],
  },
  en: {
    title: "Rutgers' Recipes",
    preview: 'Preview of a shared recipe',
    previewPatch: 'Preview of a shared adjustment',
    previewBundle: 'Preview of a shared bundle',
    previewPlan: 'Preview of a shared week plan',
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
    planOf: (n: number, by: string) => `Week plan${by ? ` from ${by}` : ''}: ${n} ${n === 1 ? 'dish' : 'dishes'}`,
    planFromApp: (n: number) => `${n} ${n === 1 ? 'dish' : 'dishes'} from the app itself (already on your phone)`,
    planNote: 'Note',
    planHint: 'In the app choose Take over (replaces your week) or Add (only what is missing).',
    planEmpty: 'This week plan is empty.',
    previewMember: 'Preview of a shared member card',
    memberOf: (name: string) => `${name}'s card`,
    memberLang: (l: Lang) => (l === 'en' ? 'Language: English' : 'Language: Dutch'),
    memberHint: (name: string) => `In the app you add ${name} to your household. Recipes from ${name} then get this name and colour, and "Share your new recipes" already knows ${name}.`,
    copyCard: 'Copy code',
    copiedCard: 'Copied. Now open the Recepten app on your Home Screen → Inbox → Paste.',
    stepsCard: ['Tap "Copy code"', 'Open Recepten on your Home Screen', 'Inbox tab → Paste from clipboard → Add to household'],
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
.swatch{display:inline-block;width:16px;height:16px;border-radius:50%;vertical-align:-3px;margin-right:6px;border:1px solid var(--line)}
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
/** The bundled dictionary once its chunk has arrived (null until then: lines show their raw text). */
let dict: Dictionary | null = null;

/** Whether the share has ingredient lines to render (only then is the dictionary worth loading). */
function hasLines(s: ParsedShare): boolean {
  if (s.kind === 'recipe') return (s.recipes[0]?.lines.length ?? 0) > 0;
  if (s.kind === 'patch') return Array.isArray(s.patches[0]?.patch?.lines) && (s.patches[0]?.patch?.lines as unknown[]).length > 0;
  return false;
}

/**
 * Loads the dictionary chunk after the first paint and re-renders the lines through it. Nothing
 * else waits for it; a failed load simply leaves the raw text. The chunk holds data files and the
 * dictionary class only (no Dexie, no storage: CLAUDE.md invariant 6 still holds).
 */
function loadDictionaryLater() {
  import('./domain/data')
    .then((m) => {
      dict = m.defaultDictionary();
      if (share) render(true);
    })
    .catch(() => {
      /* offline or a stale precache: the raw text stays */
    });
}

/** "<nl> · <en>" when both exist and differ, else the one that exists. */
function bothNames(t: Text | null | undefined): string {
  const nl = (t?.nl ?? '').trim();
  const en = (t?.en ?? '').trim();
  if (nl && en && nl.toLowerCase() !== en.toLowerCase()) return `${nl} · ${en}`;
  return nl || en || '?';
}

function linesHtml(lines: readonly Line[]): string {
  return lines
    .map((l) => {
      const header = l.kind === 'header';
      let text = '';
      if (!header && dict) {
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

/** The week plan: "Weekplan van <by>: N gerechten", the embedded (own) recipes by name, the rest counted. */
function planHtml(s: ParsedShare, by: string): string[] {
  const L = S[lang];
  const parts: string[] = [];
  const plan = s.plan ?? { items: [] };
  parts.push(`<h2>${esc(L.planOf(plan.items.length, by))}</h2>`);
  if (plan.note) parts.push(`<p class="muted">${esc(L.planNote)}: ${esc(plan.note)}</p>`);
  const embedded = new Map(s.recipes.map((r) => [r.id, r] as const));
  const items: string[] = [];
  let fromApp = 0;
  for (const it of plan.items) {
    const r = embedded.get(it.recipeId);
    if (!r) {
      fromApp++;
      continue;
    }
    const first = pickText(r.name, lang) || '?';
    const other = lang === 'nl' ? (r.name.en ?? '').trim() : (r.name.nl ?? '').trim();
    const alt = other && other.toLowerCase() !== first.toLowerCase() ? `<span class="alt">${esc(other)}</span>` : '';
    items.push(`<li>${esc(first)} <span class="tag">(${it.servings} ${esc(L.servings)})</span>${alt}</li>`);
  }
  if (fromApp) items.push(`<li class="muted">${esc(L.planFromApp(fromApp))}</li>`);
  parts.push(items.length ? `<ul>${items.join('')}</ul>` : `<p>${esc(L.planEmpty)}</p>`);
  parts.push(`<p class="muted">${esc(L.planHint)}</p>`);
  return parts;
}

/** The member card: "Kaartje van <name>", the colour swatch with the language, and what the app does with it. */
function memberHtml(card: MemberCard): string[] {
  const L = S[lang];
  const parts: string[] = [];
  parts.push(`<h2>${esc(L.memberOf(card.name))}</h2>`);
  // `color` passed readMemberPayload's plain-colour check, so it is safe in an inline style.
  parts.push(`<p class="muted"><span class="swatch" style="background:${esc(card.color)}"></span>${esc(card.name)} · ${esc(L.memberLang(card.lang))}</p>`);
  parts.push(`<p class="muted">${esc(L.memberHint(card.name))}</p>`);
  return parts;
}

/** `keepStatus`: the dictionary re-render must not wipe a "Gekopieerd" the person just got. */
function render(keepStatus = false) {
  const L = S[lang];
  const status = keepStatus ? (document.getElementById('status')?.textContent ?? '') : '';
  const parts: string[] = [];
  parts.push(`<style>${CSS}</style><main>`);
  parts.push(`<div class="top"><h1>${esc(L.title)}</h1><div class="lang"><button type="button" data-lang="nl" class="${lang === 'nl' ? 'on' : ''}">NL</button><button type="button" data-lang="en" class="${lang === 'en' ? 'on' : ''}">EN</button></div></div>`);
  const recipe = share?.kind === 'recipe' ? share.recipes[0] : undefined;
  const patch = share?.kind === 'patch' ? share.patches[0] : undefined;
  const bundle = share?.kind === 'bundle' ? share : undefined;
  const plan = share?.kind === 'plan' ? share : undefined;
  const member = share?.kind === 'member' ? share.member : undefined;
  const by = share?.by ?? '';
  parts.push(`<p class="muted">${esc(patch ? L.previewPatch : bundle ? L.previewBundle : plan ? L.previewPlan : member ? L.previewMember : L.preview)}</p>`);
  if (recipe || patch || bundle || plan || member) {
    if (recipe) parts.push(...recipeHtml(recipe, by));
    else if (patch) parts.push(...patchHtml(patch, by));
    else if (bundle) parts.push(...bundleHtml(bundle, by));
    else if (plan) parts.push(...planHtml(plan, by));
    else if (member) parts.push(...memberHtml(member));
    const steps: readonly string[] = member ? L.stepsCard : L.steps;
    parts.push(`<button type="button" class="btn" id="copy">${esc(member ? L.copyCard : L.copy)}</button><div class="status" id="status"></div>`);
    parts.push(`<div class="card"><strong>${esc(L.handoff)}</strong><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><div class="muted">${esc(L.install)}</div></div>`);
    parts.push(`<a class="btn secondary" href="${esc(appUrl())}">${esc(L.openApp)}</a>`);
  } else {
    parts.push(`<p>${esc(problem === 'unsupported' ? L.unsupported : L.invalid)}</p>`);
    parts.push(`<a class="btn" href="${esc(appUrl())}">${esc(L.openApp)}</a>`);
    parts.push(`<div class="card"><div class="muted">${esc(L.install)}</div></div>`);
  }
  parts.push('</main>');
  app.innerHTML = parts.join('');
  if (status) {
    const el = document.getElementById('status');
    if (el) el.textContent = status;
  }

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
      status.textContent = share?.kind === 'member' ? S[lang].copiedCard : S[lang].copied;
    } catch {
      status.textContent = S[lang].copyFailed;
    }
  });
}

async function boot() {
  const m = /^#([rpwbf])=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (m && m[2]) {
    try {
      const env = await decodeToken(m[2]);
      if (env.t !== m[1]) throw new Error('invalid-token');
      const parsed = parseEnvelope(env);
      const usable =
        (parsed.kind === 'recipe' && parsed.recipes.length > 0) ||
        (parsed.kind === 'patch' && parsed.patches.length > 0) ||
        (parsed.kind === 'bundle' && (parsed.recipes.length > 0 || parsed.patches.length > 0)) ||
        (parsed.kind === 'plan' && (parsed.plan?.items.length ?? 0) > 0) ||
        (parsed.kind === 'member' && !!parsed.member);
      if (usable) share = parsed;
      else problem = 'invalid';
    } catch (e) {
      problem = (e as Error)?.message === 'unsupported-version' ? 'unsupported' : 'invalid';
    }
  } else {
    problem = 'invalid';
  }
  render();
  if (share && hasLines(share)) loadDictionaryLater();
}

void boot();
