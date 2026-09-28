// Theme setting (Meer → Thema): 'system' | 'light' | 'dark'. Applied as `data-theme` on <html>
// (base.css switches the tokens; no attribute = follow prefers-color-scheme). The choice is stored
// in the database (backup) and mirrored in localStorage so the very first paint already has it.
import { signal } from '@preact/signals';
import { getSetting, setSetting } from '@/db/repo';

export type Theme = 'system' | 'light' | 'dark';

export const THEME_SETTING = 'theme';
const LOCAL_KEY = 'recepten.theme';

/** Paper colour per theme, for the status bar (<meta name="theme-color">). */
const PAPER: Record<'light' | 'dark', string> = { light: '#eaf3fb', dark: '#0f1a2b' };

function isTheme(v: unknown): v is Theme {
  return v === 'system' || v === 'light' || v === 'dark';
}

function readLocal(): Theme {
  try {
    const v = localStorage.getItem(LOCAL_KEY);
    return isTheme(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export const theme = signal<Theme>(readLocal());

function apply(t: Theme) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (t === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
  // index.html carries two theme-color metas with media queries; a forced theme overrides both.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    if (!m.dataset.original) m.dataset.original = m.content;
    m.content = t === 'system' ? (m.dataset.original ?? m.content) : PAPER[t];
  });
}

/** Applies the mirrored choice at once and then reconciles with the database (call once at boot). */
export function initTheme(): void {
  apply(theme.value);
  void getSetting<unknown>(THEME_SETTING, 'system').then((v) => {
    if (!isTheme(v) || v === theme.value) return;
    theme.value = v;
    apply(v);
    try {
      localStorage.setItem(LOCAL_KEY, v);
    } catch {
      /* ignore */
    }
  });
}

export async function setTheme(t: Theme): Promise<void> {
  theme.value = t;
  apply(t);
  try {
    localStorage.setItem(LOCAL_KEY, t);
  } catch {
    /* ignore */
  }
  await setSetting(THEME_SETTING, t);
}
