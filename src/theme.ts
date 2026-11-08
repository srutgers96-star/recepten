// Theme setting (Jouw stijl → Thema): 'system' | 'light' | 'dark' | 'gold'. Applied as `data-theme` on
// <html> (base.css switches the tokens; no attribute = follow prefers-color-scheme). The choice is
// stored in the database (backup) and mirrored in localStorage so the very first paint already has it
// (system/light/dark, and gold on a phone that had it, see below).
//
// V5 §1d: 'gold' is only usable while it is free on this phone: the level-100 unlock `gold-theme`
// is active WHILE BADGES ARE ON (docs/specs/xp-levels.md: with badges off nothing from the unlocks is
// visible), or the maker's egg (33 taps on Versie in Meer → Over) wrote `theme.goldUnlocked` (not an
// XP unlock, so independent of badges). A stored 'gold' that is not free is applied as 'system' (no
// locked theme); the stored choice itself stays, so it comes back as soon as gold is free again.
//
// No system-theme flash at a cold start (Fable, 8 Nov): at boot `unlockedOnPhone` is still empty and
// the egg setting is not read yet. localStorage `recepten.theme.goldFree` ('1') remembers that gold
// was free on this phone; until BOTH the unlocks have been computed once and the egg setting has
// been read, that mirror counts as "gold is free" (optimistic). Afterwards only the real sources
// count and the mirror is written or removed to match them. The mirror is a per-device hint only.
import { effect, signal } from '@preact/signals';
import { badgesEnabled } from '@/badges';
import { getSetting, setSetting } from '@/db/repo';
import { isActive, unlockedOnPhone } from '@/unlocks';

export type Theme = 'system' | 'light' | 'dark' | 'gold';

export const THEME_SETTING = 'theme';
/** Setting `theme.goldUnlocked` (boolean, this phone): the maker's egg unlocked the gold theme (V5 §1d). */
export const GOLD_UNLOCKED_SETTING = 'theme.goldUnlocked';
/** The unlock id of the level-100 gold theme (data/unlocks.json). */
export const GOLD_THEME_UNLOCK = 'gold-theme';
const LOCAL_KEY = 'recepten.theme';
/** localStorage: '1' while gold was known to be free on this phone (optimistic first paint). */
const GOLD_FREE_KEY = 'recepten.theme.goldFree';

/** Paper colour per theme, for the status bar (<meta name="theme-color">). */
const PAPER: Record<Exclude<Theme, 'system'>, string> = { light: '#eaf3fb', dark: '#0f1a2b', gold: '#15120c' };

export function isTheme(v: unknown): v is Theme {
  return v === 'system' || v === 'light' || v === 'dark' || v === 'gold';
}

/** The theme really applied: a 'gold' that is not free falls back to 'system' (V5 §1d). */
export function effectiveTheme(t: Theme, goldFree: boolean): Theme {
  return t === 'gold' && !goldFree ? 'system' : t;
}

function readLocal(): Theme {
  try {
    const v = localStorage.getItem(LOCAL_KEY);
    return isTheme(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function readGoldFreeMirror(): boolean {
  try {
    return localStorage.getItem(GOLD_FREE_KEY) === '1';
  } catch {
    return false;
  }
}

export const theme = signal<Theme>(readLocal());
/** Mirror of `theme.goldUnlocked`: the maker's egg unlocked the gold theme on this phone. */
export const goldUnlockedByMaker = signal(false);
/** localStorage `recepten.theme.goldFree`: gold was free on this phone at an earlier start. */
export const goldFreeMirror = signal(readGoldFreeMirror());
/** The unlocks have been computed at least once (a later assignment of `unlockedOnPhone`). */
const unlocksSeen = signal(false);
/** The `theme.goldUnlocked` read in initTheme has resolved (success or failure). */
const eggRead = signal(false);

export interface GoldAvailabilityInput {
  /** `isActive('gold-theme')`: the level-100 unlock is unlocked and not switched off. */
  unlockActive: boolean;
  badgesOn: boolean;
  /** The maker's egg was found on this phone. */
  byMaker: boolean;
  /** localStorage mirror: gold was free here at an earlier start. */
  mirror: boolean;
  unlocksSeen: boolean;
  eggRead: boolean;
}

/**
 * Gold is free: through the level-100 unlock only while badges are on, always through the maker's
 * egg, and optimistically through the mirror until both the unlocks and the egg setting are read. Pure.
 */
export function goldAvailable(i: GoldAvailabilityInput): boolean {
  return (i.badgesOn && i.unlockActive) || i.byMaker || (i.mirror && !(i.unlocksSeen && i.eggRead));
}

function goldInput(): GoldAvailabilityInput {
  return {
    unlockActive: isActive(GOLD_THEME_UNLOCK),
    badgesOn: badgesEnabled.value,
    byMaker: goldUnlockedByMaker.value,
    mirror: goldFreeMirror.value,
    unlocksSeen: unlocksSeen.value,
    eggRead: eggRead.value,
  };
}

/** Gold is free on this phone (see goldAvailable). */
export function goldThemeFree(): boolean {
  return goldAvailable(goldInput());
}

/** Keeps the localStorage mirror in step with the real sources (never the other way round). */
function syncGoldMirror(i: GoldAvailabilityInput): void {
  const real = (i.badgesOn && i.unlockActive) || i.byMaker;
  try {
    if (real) {
      if (!i.mirror) {
        localStorage.setItem(GOLD_FREE_KEY, '1');
        goldFreeMirror.value = true;
      }
    } else if (i.unlocksSeen && i.eggRead && i.mirror) {
      localStorage.removeItem(GOLD_FREE_KEY);
      goldFreeMirror.value = false;
    }
  } catch {
    /* ignore */
  }
}

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

let started = false;

/**
 * Applies the mirrored choice at once and then reconciles with the database (call once at boot).
 * An effect re-applies whenever the choice or the gold availability changes (the unlocks arrive
 * after refreshUnlocks, the egg setting after its read).
 */
export function initTheme(): void {
  if (started) return;
  started = true;
  // The first run sees the initial empty set of unlocks/unlocks.ts; any later assignment
  // (refreshUnlocks) means the unlocks have really been computed.
  let firstUnlocksRun = true;
  effect(() => {
    void unlockedOnPhone.value;
    if (firstUnlocksRun) firstUnlocksRun = false;
    else unlocksSeen.value = true;
  });
  effect(() => {
    const input = goldInput();
    apply(effectiveTheme(theme.value, goldAvailable(input)));
    syncGoldMirror(input);
  });
  void getSetting<unknown>(GOLD_UNLOCKED_SETTING, false).then(
    (v) => {
      if (v === true) goldUnlockedByMaker.value = true;
      eggRead.value = true;
    },
    () => {
      eggRead.value = true;
    },
  );
  void getSetting<unknown>(THEME_SETTING, 'system').then((v) => {
    if (!isTheme(v) || v === theme.value) return;
    theme.value = v;
    try {
      localStorage.setItem(LOCAL_KEY, v);
    } catch {
      /* ignore */
    }
  });
}

export async function setTheme(t: Theme): Promise<void> {
  theme.value = t;
  try {
    localStorage.setItem(LOCAL_KEY, t);
  } catch {
    /* ignore */
  }
  await setSetting(THEME_SETTING, t);
}

/** The maker's egg (V5 §1d): writes `theme.goldUnlocked = true`. Does NOT switch the theme. */
export async function unlockGoldByMaker(): Promise<void> {
  goldUnlockedByMaker.value = true;
  await setSetting(GOLD_UNLOCKED_SETTING, true);
}

// ---------------------------------------------------------------------------- the maker's egg counter

/** Taps on Versie that unlock the gold theme (Stijn, 8 Nov). */
export const GOLD_TAPS = 33;
/** From this tap on the "nog n keer…" line shows. */
export const GOLD_COUNT_FROM = 25;
/** A tap counts on only while the previous one was less than this long ago. */
export const GOLD_TAP_WINDOW_MS = 2000;

export interface TapCount {
  /** Taps in the current run (1 after a fresh start). */
  count: number;
  /** Time of the last tap (ms). */
  lastMs: number;
}

/** One tap on Versie: counts on within 2 s of the previous tap, else starts again at 1. Pure. */
export function tapCounter(prev: TapCount | null, nowMs: number): TapCount {
  const gap = prev === null ? Infinity : nowMs - prev.lastMs;
  if (prev !== null && gap >= 0 && gap < GOLD_TAP_WINDOW_MS) return { count: prev.count + 1, lastMs: nowMs };
  return { count: 1, lastMs: nowMs };
}

/** Taps still needed before the gold theme unlocks (never below 0). */
export function tapsLeft(count: number): number {
  return Math.max(0, GOLD_TAPS - count);
}
