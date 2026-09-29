// Tiny, storage-free landing viewer for shared-recipe links opened in iOS Safari (outside the
// installed app). Decodes the #r= token client-side, reads the payload (schema 2 or any older
// shape) through normalizeRecipe, shows the recipe read-only with an NL/EN switch, offers "Copy
// recipe code" and the hand-off card. It NEVER writes to storage (invariant, CLAUDE.md 6):
// Safari's bucket is invisible to the Home Screen app. Imports domain modules only (no Dexie).
// Ingredient lines are rendered through the bundled dictionary (schema-2 lines carry `ing`,
// `qty`, `unit`, `prep` and usually only a Dutch `raw`), so the EN view shows English names;
// a line the dictionary cannot render falls back to its raw text.
import { defaultDictionary } from './domain/data';
import { pickText, type Lang, type Recipe } from './domain/model';
import { normalizeRecipe } from './domain/recipe-io';
import { renderLine } from './domain/render';
import { decodeToken } from './domain/token';

const S = {
  nl: {
    title: "Rutgers' Recepten",
    preview: 'Voorproefje van een gedeeld recept',
    ingredients: 'Ingrediënten',
    method: 'Bereiding',
    tip: 'Serveertip',
    copy: 'Kopieer receptcode',
    copied: 'Gekopieerd. Open nu de Recepten-app op je beginscherm → Inbox → Plak.',
    copyFailed: 'Kopiëren mislukt — houd de link in WhatsApp ingedrukt en kies Kopieer.',
    handoff: 'Bewaren in je app',
    steps: ['Tik op "Kopieer receptcode"', 'Open Recepten op je beginscherm', 'Tab Inbox → Plak van klembord → Bewaar'],
    install: 'Nog geen app? Deel → Zet op beginscherm.',
    openApp: "Open Rutgers' Recepten (hele app)",
    invalid: 'Deze link bevat geen leesbaar recept.',
    unsupported: 'Deze code is nieuwer dan deze pagina. Update de app.',
    by: 'van',
    servings: 'pers.',
  },
  en: {
    title: "Rutgers' Recipes",
    preview: 'Preview of a shared recipe',
    ingredients: 'Ingredients',
    method: 'Method',
    tip: 'Serving tip',
    copy: 'Copy recipe code',
    copied: 'Copied. Now open the Recepten app on your Home Screen → Inbox → Paste.',
    copyFailed: 'Copy failed — long-press the link in WhatsApp and choose Copy.',
    handoff: 'Save it in your app',
    steps: ['Tap "Copy recipe code"', 'Open Recepten on your Home Screen', 'Inbox tab → Paste from clipboard → Save'],
    install: 'No app yet? Share → Add to Home Screen.',
    openApp: "Open Rutgers' Recipes (the whole app)",
    invalid: 'This link does not contain a readable recipe.',
    unsupported: 'This code is newer than this page. Update the app.',
    by: 'from',
    servings: 'servings',
  },
} as const;

const CSS = `
:root{color-scheme:light dark;--paper:#eaf3fb;--card:#fff;--ink:#1f2733;--muted:#5b6775;--cobalt:#2b4fa8;--line:rgba(31,39,51,.12);--on:#fff}
@media(prefers-color-scheme:dark){:root{--paper:#0f1a2b;--card:#17243a;--ink:#e8eef6;--muted:#9fb0c3;--cobalt:#6f8fe0;--line:rgba(232,238,246,.14);--on:#0f1a2b}}
*{box-sizing:border-box}html,body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
main{max-width:40rem;margin:auto;padding:calc(12px + env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.top{display:flex;align-items:center;gap:8px}.top h1{flex:1;font-size:20px;color:var(--cobalt);margin:0}
.lang{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}.lang button{min-width:44px;min-height:44px;border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:700}
.lang button.on{background:var(--cobalt);color:var(--on)}
h2{font-size:26px;margin:20px 0 4px}h3{font-size:17px;margin:20px 0 8px}p{margin:0 0 12px}.muted{color:var(--muted);font-size:14px}
ul{margin:0;padding:0;list-style:none}li{padding:8px 0;border-bottom:1px solid var(--line)}li.head{font-weight:700;color:var(--cobalt);border-bottom:0;padding-top:14px}
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
let recipe: Recipe | null = null;
let by = '';
let problem: 'invalid' | 'unsupported' | null = null;

function render() {
  const L = S[lang];
  const parts: string[] = [];
  parts.push(`<style>${CSS}</style><main>`);
  parts.push(`<div class="top"><h1>${esc(L.title)}</h1><div class="lang"><button type="button" data-lang="nl" class="${lang === 'nl' ? 'on' : ''}">NL</button><button type="button" data-lang="en" class="${lang === 'en' ? 'on' : ''}">EN</button></div></div>`);
  parts.push(`<p class="muted">${esc(L.preview)}</p>`);
  if (recipe) {
    parts.push(`<h2>${esc(pickText(recipe.name, lang) || '?')}</h2>`);
    const meta = [recipe.servings > 0 ? `${recipe.servings} ${L.servings}` : '', by ? `${L.by} ${by}` : ''].filter(Boolean).join(' · ');
    if (meta) parts.push(`<p class="muted">${esc(meta)}</p>`);
    const description = pickText(recipe.description, lang);
    if (description) parts.push(`<p>${esc(description)}</p>`);
    if (recipe.lines.length) {
      const dict = defaultDictionary();
      const lines = recipe.lines
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
      parts.push(`<h3>${esc(L.ingredients)}</h3><ul>${lines}</ul>`);
    }
    if (recipe.steps.length) {
      const steps = recipe.steps
        .map((s) => pickText(s.text, lang))
        .filter(Boolean)
        .map((s) => `<li>${esc(s).replace(/\n/g, '<br>')}</li>`)
        .join('');
      parts.push(`<h3>${esc(L.method)}</h3><ol>${steps}</ol>`);
    }
    const tip = pickText(recipe.servingTip, lang);
    if (tip) parts.push(`<h3>${esc(L.tip)}</h3><p>${esc(tip)}</p>`);
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
  if (m && m[1] === 'r' && m[2]) {
    try {
      const env = await decodeToken(m[2]);
      recipe = env.t === 'r' ? normalizeRecipe(env.r) : null;
      if (!recipe) problem = 'invalid';
      if (typeof env.by === 'string') by = env.by;
    } catch (e) {
      problem = (e as Error)?.message === 'unsupported-version' ? 'unsupported' : 'invalid';
    }
  } else {
    problem = 'invalid';
  }
  render();
}

void boot();
