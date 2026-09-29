// Bilingual UI strings (docs/phase-1-spec.md §4). `lang` is a signal so components re-render on
// toggle. Dictionaries are split per owner and merged here: common (shell, nav, generic buttons),
// browse (home, list, detail, cook), edit (editor, share, inbox/import), settings (more, profiles,
// storage, story, check). A missing key renders the key itself and never throws, so the owners can
// work in parallel. Keep strings short: 360 px phones.
import { signal } from '@preact/signals';
import type { Lang } from '@/domain/model';
import { browse } from './browse';
import { common } from './common';
import { edit } from './edit';
import { phase2 } from './phase2';
import { settings } from './settings';
import { week } from './week';
import { shopping } from './shopping';

export type { Lang };

/** One dictionary: key -> {nl, en}. Both languages are mandatory for every key. */
export type Dict = Record<string, { nl: string; en: string }>;

// phase2 is merged last (docs/phase-2-spec.md §5 strings; it may refine an earlier key).
// Phase 4: week (Week tab, Kies-N sheet, nav) after phase2; shopping (the shopping agent) appends after it.
const dict: Dict = { ...common, ...browse, ...edit, ...settings, ...phase2, ...week, ...shopping };

const STORAGE_KEY = 'recepten.lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'nl' || stored === 'en') return stored;
  } catch {
    /* storage may be unavailable (private mode) */
  }
  return /^en/i.test(typeof navigator !== 'undefined' ? navigator.language ?? '' : '') ? 'en' : 'nl';
}

export const lang = signal<Lang>(initialLang());

export function setLang(next: Lang) {
  lang.value = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

export function toggleLang() {
  setLang(lang.value === 'nl' ? 'en' : 'nl');
}

/** Replaces `{name}`-style placeholders; unknown placeholders are left as they are. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Translate a UI key in the current language (reads the `lang` signal). Missing key -> the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  if (!entry) return key;
  return interpolate(entry[lang.value] ?? entry.nl, vars);
}

/** Translate in an explicit language (share messages, notifications from the timer engine). */
export function tIn(l: Lang, key: string, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  if (!entry) return key;
  return interpolate(entry[l] ?? entry.nl, vars);
}

export function hasKey(key: string): boolean {
  return key in dict;
}
