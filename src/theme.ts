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
//
// V1c-10 (docs/specs/ei-gabi.md): 'panter' (the leopard theme) follows the same plumbing, with one
// source only: the device-local setting `theme.panterUnlocked`, written by an egg (unlockPanterEgg),
// mirrored in localStorage `recepten.theme.panterFree` for the first paint. Its colour variant is the
// device-local setting `theme.panterColor` (mirrored in `recepten.theme.panterColor`), applied as a
// second attribute `data-panter` on <html> while the leopard theme is applied. V1c-10b (15 Nov, after
// Gabi's verdict): two colours only, 'klassiek' (light, sand) and 'roze' (dark, hot pink & black); a
// stored 'sneeuw' or 'paars' from the first version falls back to 'klassiek'. The status-bar colour of
// the leopard theme is its black header bar, per colour (PANTER_BAR), not the paper.
import { effect, signal } from '@preact/signals';
import { badgesEnabled } from '@/badges';
import { getSetting, setSetting } from '@/db/repo';
import { isActive, unlockedOnPhone } from '@/unlocks';

export type Theme = 'system' | 'light' | 'dark' | 'gold' | 'panter';

export const THEME_SETTING = 'theme';
/** Setting `theme.goldUnlocked` (boolean, this phone): the maker's egg unlocked the gold theme (V5 §1d). */
export const GOLD_UNLOCKED_SETTING = 'theme.goldUnlocked';
/** The unlock id of the level-100 gold theme (data/unlocks.json). */
export const GOLD_THEME_UNLOCK = 'gold-theme';
const LOCAL_KEY = 'recepten.theme';
/** localStorage: '1' while gold was known to be free on this phone (optimistic first paint). */
const GOLD_FREE_KEY = 'recepten.theme.goldFree';
/** Setting `theme.panterUnlocked` (boolean, this phone): the leopard egg was found (V1c-10). */
export const PANTER_UNLOCKED_SETTING = 'theme.panterUnlocked';
/** Setting `theme.panterColor` (PanterColor, this phone): the colour variant of the leopard theme. */
export const PANTER_COLOR_SETTING = 'theme.panterColor';
/** localStorage: '1' while the leopard theme was known to be free on this phone (optimistic first paint). */
const PANTER_FREE_KEY = 'recepten.theme.panterFree';
/** localStorage mirror of `theme.panterColor` (first paint). */
const PANTER_COLOR_KEY = 'recepten.theme.panterColor';

/** The colour variants of the leopard theme (panter.css `[data-panter=...]`): sand, or hot pink & black. */
export type PanterColor = 'klassiek' | 'roze';
export const PANTER_COLORS: readonly PanterColor[] = ['klassiek', 'roze'];
export const DEFAULT_PANTER_COLOR: PanterColor = 'klassiek';

export function isPanterColor(v: unknown): v is PanterColor {
  return typeof v === 'string' && (PANTER_COLORS as readonly string[]).includes(v);
}

/** Paper colour per theme, for the status bar (<meta name="theme-color">); the leopard theme uses PANTER_BAR. */
const PAPER: Record<Exclude<Theme, 'system' | 'panter'>, string> = { light: '#eaf3fb', dark: '#0f1a2b', gold: '#15120c' };
/** The leopard theme's header bar per colour (panter.css --panter-bar): what sits under the status bar. */
const PANTER_BAR: Record<PanterColor, string> = { klassiek: '#15100b', roze: '#120b10' };

export function isTheme(v: unknown): v is Theme {
  return v === 'system' || v === 'light' || v === 'dark' || v === 'gold' || v === 'panter';
}

/** The theme really applied: a 'gold' or 'panter' that is not free falls back to 'system' (V5 §1d, V1c-10). */
export function effectiveTheme(t: Theme, goldFree: boolean, panterFree = false): Theme {
  if (t === 'gold' && !goldFree) return 'system';
  if (t === 'panter' && !panterFree) return 'system';
  return t;
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

function readPanterFreeMirror(): boolean {
  try {
    return localStorage.getItem(PANTER_FREE_KEY) === '1';
  } catch {
    return false;
  }
}

function readPanterColorLocal(): PanterColor {
  try {
    const v = localStorage.getItem(PANTER_COLOR_KEY);
    return isPanterColor(v) ? v : DEFAULT_PANTER_COLOR;
  } catch {
    return DEFAULT_PANTER_COLOR;
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
/** Mirror of `theme.panterUnlocked`: the leopard egg was found on this phone (V1c-10). */
export const panterUnlocked = signal(false);
/** localStorage `recepten.theme.panterFree`: the leopard theme was free on this phone at an earlier start. */
export const panterFreeMirror = signal(readPanterFreeMirror());
/** `theme.panterColor`: the colour variant of the leopard theme. */
export const panterColor = signal<PanterColor>(readPanterColorLocal());
/** The `theme.panterUnlocked` read in initTheme has resolved (success or failure). */
const panterEggRead = signal(false);

export interface PanterAvailabilityInput {
  /** `theme.panterUnlocked` as read. */
  unlocked: boolean;
  /** localStorage mirror: the leopard theme was free here at an earlier start. */
  mirror: boolean;
  /** The `theme.panterUnlocked` read has resolved. */
  eggRead: boolean;
}

/** The leopard theme is free: the egg setting, or optimistically the mirror until that setting is read. Pure. */
export function panterAvailable(i: PanterAvailabilityInput): boolean {
  return i.unlocked || (!i.eggRead && i.mirror);
}

function panterInput(): PanterAvailabilityInput {
  return { unlocked: panterUnlocked.value, mirror: panterFreeMirror.value, eggRead: panterEggRead.value };
}

/** The leopard theme is free on this phone (see panterAvailable). */
export function panterThemeFree(): boolean {
  return panterAvailable(panterInput());
}

/** Keeps the leopard mirror in step with the egg setting (never the other way round). */
function syncPanterMirror(i: PanterAvailabilityInput): void {
  try {
    if (i.unlocked) {
      if (!i.mirror) {
        localStorage.setItem(PANTER_FREE_KEY, '1');
        panterFreeMirror.value = true;
      }
    } else if (i.eggRead && i.mirror) {
      localStorage.removeItem(PANTER_FREE_KEY);
      panterFreeMirror.value = false;
    }
  } catch {
    /* ignore */
  }
}

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

function apply(t: Theme, color: PanterColor) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (t === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
  // V1c-10: the colour variant only while the leopard theme is applied.
  if (t === 'panter') el.setAttribute('data-panter', color);
  else el.removeAttribute('data-panter');
  // index.html carries two theme-color metas with media queries; a forced theme overrides both.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    if (!m.dataset.original) m.dataset.original = m.content;
    m.content = t === 'system' ? (m.dataset.original ?? m.content) : t === 'panter' ? PANTER_BAR[color] : PAPER[t];
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
    const pInput = panterInput();
    apply(effectiveTheme(theme.value, goldAvailable(input), panterAvailable(pInput)), panterColor.value);
    syncGoldMirror(input);
    syncPanterMirror(pInput);
  });
  void getSetting<unknown>(PANTER_UNLOCKED_SETTING, false).then(
    (v) => {
      if (v === true) panterUnlocked.value = true;
      panterEggRead.value = true;
    },
    () => {
      panterEggRead.value = true;
    },
  );
  void getSetting<unknown>(PANTER_COLOR_SETTING, DEFAULT_PANTER_COLOR).then(
    (v) => {
      const c = isPanterColor(v) ? v : DEFAULT_PANTER_COLOR;
      if (c === panterColor.value) return;
      panterColor.value = c;
      writePanterColorLocal(c);
    },
    () => {
      /* keep the mirrored colour */
    },
  );
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

function writePanterColorLocal(c: PanterColor): void {
  try {
    localStorage.setItem(PANTER_COLOR_KEY, c);
  } catch {
    /* ignore */
  }
}

/** Jouw stijl -> Thema -> Kleur (V1c-10): the leopard theme's colour variant (setting + mirror + attribute). */
export async function setPanterColor(c: PanterColor): Promise<void> {
  panterColor.value = c;
  writePanterColorLocal(c);
  await setSetting(PANTER_COLOR_SETTING, c);
}

/**
 * The leopard egg (V1c-10): writes `theme.panterUnlocked = true` and the mirror, and switches the
 * theme to 'panter' at once (Fable: otherwise nothing visibly happens). 'already' when this phone
 * had it before.
 */
export async function unlockPanterEgg(): Promise<'unlocked' | 'already'> {
  let already = panterUnlocked.value;
  if (!already) {
    try {
      already = (await getSetting<unknown>(PANTER_UNLOCKED_SETTING, false)) === true;
    } catch {
      /* treat as new */
    }
  }
  panterUnlocked.value = true;
  try {
    localStorage.setItem(PANTER_FREE_KEY, '1');
    panterFreeMirror.value = true;
  } catch {
    /* ignore */
  }
  await setSetting(PANTER_UNLOCKED_SETTING, true);
  await setTheme('panter');
  return already ? 'already' : 'unlocked';
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
