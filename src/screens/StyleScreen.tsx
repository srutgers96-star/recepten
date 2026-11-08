// '#/more/style' — Jouw stijl (docs/specs/badges-avatar.md block 6D-S, builder S-B): one place to make
// the app yours. A header with Terug and "Jouw stijl", then the same tab strip as the badge page
// (role="tablist", horizontal, 48 px; the last tab per phone in localStorage `recepten.style.tab`;
// `?tab=` wins, e.g. the old '#/more/unlocks' lands on '?tab=confetti'):
//   Avatar · Geluiden · Confetti · Letters · Thema.
// Every choice is a tile in the avatar maker's grid (64 px, icon or swatch with a short name under
// it), with the rarity dot of 6D-R top left (common = none) and, when locked, 🔒 + "Lv n" or the
// badge icon; a tap on a locked tile puts the explanation under its grid ("Zeldzaam · Komt vrij op
// level 35."). A tile with `.on` is the current choice.
//   - Avatar: the preview (160 px) and "Avatar aanpassen" (<AvatarSheet/>, from level 3; under it the
//     existing hint). No tiles.
//   - Geluiden: "Timergeluid" (every TimerSound, 'off' last; tap = choose + preview at once), then
//     "Bij Gekookt!" with the ta-da tile (tap = on/off, plays when switched on).
//   - Confetti: "Verras me" (the rotation over the mix), 'default' and every confetti unlock; tap =
//     that style always (`confetti.style`) + a preview burst. A long press, or the small ☑/☐ corner,
//     on an unlocked style takes it out of / puts it in the mix (`setUnlockEnabled`).
//   - Letters: Standaard · Krijtbord · Handschrift ("Aa" in that typeface); tap = `cook.font`.
//   - Thema: Systeem · Licht · Donker (a small swatch in that paper colour); tap = setTheme.
//   - At the bottom, muted, `unlocks.phoneWide`.
// Badges off: only `badges.disabled` and the tab Thema (the theme has nothing to do with XP).
// Opening this screen is never a reward moment: it reads, it never settles XP.
//
// The tiles come from the pure model `styleTiles` (tests/style-screen.test.ts).
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { badgeData, badgesEnabled, loadBadgeSettings } from '@/badges';
import { celebrate, celebrateFast, confettiStyle, DEFAULT_CONFETTI_STYLE, loadCelebrateSettings, RANDOM_CONFETTI_STYLE, setCelebrateFast, setConfettiStyle } from '@/celebrate';
import { isIOS } from '@/components/AppInfo';
import { AvatarSheet } from '@/components/AvatarSheet';
import { Header } from '@/components/Header';
import { COOKED_SOUND_UNLOCK } from '@/cooklog';
import { getSetting, setSetting } from '@/db/repo';
import { AVATAR_MAKER_LEVEL } from '@/domain/avatar';
import type { Lang } from '@/domain/model';
import type { Rarity } from '@/domain/rarity';
import type { Unlock } from '@/domain/unlocks';
import { recordFeature } from '@/features';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate, route } from '@/router';
import { cookedSound, loadSoundSettings, previewCookedSound, previewTimerSound, setCookedSound, setTimerSound, timerSound, type TimerSound } from '@/sounds';
import { setTheme, theme, type Theme } from '@/theme';
import { COOK_FONT_SETTING, disabledUnlocks, isActive, refreshUnlocks, setUnlockEnabled, unlockData, unlockedOnPhone, type CookFont } from '@/unlocks';
import { Avatar, useAvatarLevel } from './ProfilesScreen';

// ---------------------------------------------------------------------------- the pure tile model

export type StyleTab = 'avatar' | 'sounds' | 'confetti' | 'fonts' | 'theme';

/** The five tabs, in strip order (S-B.1). */
export const STYLE_TABS: readonly StyleTab[] = ['avatar', 'sounds', 'confetti', 'fonts', 'theme'];

/** localStorage key (README §2b register, integrator): the last tab on this phone. */
export const STYLE_TAB_KEY = 'recepten.style.tab';

/** The tabs on screen: all five, or with badges off only Thema (S-B.1). */
/** Badges off: only the tabs that are plain settings (the four base timer sounds, the theme); the rest is XP (§1). */
export function styleTabs(badgesOn: boolean): StyleTab[] {
  return badgesOn ? [...STYLE_TABS] : ['sounds', 'theme'];
}

/** The tab to open: `?tab=` when it is one of `tabs`, else the remembered one, else the first. */
export function initialStyleTab(tabs: readonly StyleTab[], param: string | null, remembered: string | null): StyleTab {
  const first = tabs[0] ?? 'theme';
  for (const v of [param, remembered]) if (v !== null && (tabs as readonly string[]).includes(v)) return v as StyleTab;
  return first;
}

/** Which setting a tile belongs to; also the group its lock note sits under. */
export type TileGroup = 'timerSound' | 'cookedSound' | 'confetti' | 'font' | 'theme';

export interface StyleTile {
  group: TileGroup;
  /** TimerSound, 'tada', 'random' | confetti style value, CookFont, Theme. */
  value: string;
  /** The unlock behind the tile; null for a standard choice (beeps, 'default', Systeem, …). */
  unlock: Unlock | null;
  /** The unlock's rarity; a standard choice is common (no dot). */
  rarity: Rarity;
  /** Not unlocked on this phone (a standard choice never is). */
  locked: boolean;
  /** The current choice (what the app really uses now). */
  on: boolean;
  /** Confetti only: in the "Verras me" mix (true/false) for an unlocked confetti unlock; null = no ☑/☐. */
  inMix: boolean | null;
}

/** Everything the tiles depend on (signals and settings, read by the screen). */
export interface StyleState {
  badgesOn: boolean;
  unlocks: readonly Unlock[];
  /** `unlockedOnPhone`: unlock ids a local profile has unlocked. */
  unlocked: ReadonlySet<string>;
  /** `unlocks.disabled`: unlock ids switched off (out of the mix) on this phone. */
  disabled: ReadonlySet<string>;
  timerSound: TimerSound;
  cookedSound: boolean;
  /** `confetti.style`: 'random' or a style value. */
  confettiStyle: string;
  cookFont: CookFont;
  theme: Theme;
}

/** Every TimerSound in tile order: the three standard ones, the four unlockable ones, 'off' last. */
export const TIMER_SOUND_TILES: readonly TimerSound[] = ['beeps', 'bell', 'melody', 'cowbell', 'gong', 'kitchen', 'fanfare', 'off'];
const FONT_TILES: readonly CookFont[] = ['default', 'chalk', 'hand'];
const THEME_TILES: readonly Theme[] = ['system', 'light', 'dark'];

function unlockFor(s: StyleState, kind: Unlock['kind'], value: string): Unlock | null {
  return s.unlocks.find((u) => u.kind === kind && u.value === value) ?? null;
}

/**
 * Groups whose setting keeps working when its unlock is (no longer) unlocked on this phone: the timer
 * plays `timer.sound` and cook mode shows `cook.font` as they are (§1g). Their chosen tile stays `.on`
 * even when locked, so the screen shows what the app really uses (as the old Meer picker did). The
 * ta-da and a confetti style only work while unlocked, so a locked one is never on.
 */
const KEEPS_WORKING_WHEN_LOCKED: ReadonlySet<TileGroup> = new Set(['timerSound', 'font']);

function tile(s: StyleState, group: TileGroup, value: string, unlock: Unlock | null, on: boolean, inMix: boolean | null = null): StyleTile {
  const locked = unlock !== null && !s.unlocked.has(unlock.id);
  const shownOn = on && (!locked || KEEPS_WORKING_WHEN_LOCKED.has(group));
  return { group, value, unlock, rarity: unlock?.rarity ?? 'common', locked, on: shownOn, inMix: locked ? null : inMix };
}

/**
 * The confetti style a burst uses now (mirrors celebrate's pickConfettiStyle for the `.on` tile):
 * the chosen style when this phone can use it ('default' or an unlocked confetti style), else
 * 'random'.
 */
export function shownConfettiStyle(s: StyleState): string {
  if (s.confettiStyle === RANDOM_CONFETTI_STYLE || s.confettiStyle === DEFAULT_CONFETTI_STYLE) return s.confettiStyle;
  const u = unlockFor(s, 'confetti', s.confettiStyle);
  return u !== null && s.unlocked.has(u.id) ? s.confettiStyle : RANDOM_CONFETTI_STYLE;
}

/**
 * The tiles of one tab, in screen order (S-B.1). Avatar has none; with badges off every tab but
 * Thema is empty (the screen then only shows Thema).
 */
export function styleTiles(tab: StyleTab, s: StyleState): StyleTile[] {
  if (tab === 'theme') return THEME_TILES.map((v) => tile(s, 'theme', v, null, s.theme === v));
  if (!s.badgesOn) {
    // Badges off (Fable, 8 Nov): the four base sounds stay choosable, nothing that is an unlock.
    if (tab !== 'sounds') return [];
    return TIMER_SOUND_TILES.filter((v) => unlockFor(s, 'timerSound', v) === null).map((v) => tile(s, 'timerSound', v, null, s.timerSound === v));
  }
  switch (tab) {
    case 'avatar':
      return [];
    case 'sounds': {
      const out = TIMER_SOUND_TILES.map((v) => tile(s, 'timerSound', v, unlockFor(s, 'timerSound', v), s.timerSound === v));
      const tada = s.unlocks.find((u) => u.id === COOKED_SOUND_UNLOCK) ?? null;
      if (tada) out.push(tile(s, 'cookedSound', tada.value, tada, s.cookedSound && !s.disabled.has(tada.id)));
      return out;
    }
    case 'confetti': {
      const shown = shownConfettiStyle(s);
      return [
        tile(s, 'confetti', RANDOM_CONFETTI_STYLE, null, shown === RANDOM_CONFETTI_STYLE),
        tile(s, 'confetti', DEFAULT_CONFETTI_STYLE, null, shown === DEFAULT_CONFETTI_STYLE),
        ...s.unlocks.filter((u) => u.kind === 'confetti').map((u) => tile(s, 'confetti', u.value, u, shown === u.value, !s.disabled.has(u.id))),
      ];
    }
    case 'fonts':
      return FONT_TILES.map((v) => tile(s, 'font', v, unlockFor(s, 'cookFont', v), s.cookFont === v));
  }
}

// ---------------------------------------------------------------------------- names and notes

/** Icons of the standard choices (an unlock brings its own icon from data/unlocks.json). */
const STANDARD_ICONS: Readonly<Record<string, string>> = {
  'timerSound:beeps': '⏰',
  'timerSound:bell': '🛎️',
  'timerSound:melody': '🎶',
  'timerSound:off': '🔇',
  'confetti:random': '🎲',
  'confetti:default': '🎉',
};

function tileName(x: StyleTile, l: Lang): string {
  switch (x.group) {
    case 'timerSound':
      return t('more.timerSound.' + x.value);
    case 'font':
      return t('style.font.' + x.value);
    case 'theme':
      return t('more.theme.' + x.value);
    case 'confetti':
      if (x.value === RANDOM_CONFETTI_STYLE) return t('style.random');
      if (x.value === DEFAULT_CONFETTI_STYLE) return t('style.confetti.default');
      return x.unlock ? x.unlock[l].name : x.value;
    case 'cookedSound':
      return x.unlock ? x.unlock[l].name : x.value;
  }
}

function rarityName(r: Rarity): string {
  return t('avatar.rarity.' + r);
}

/** The badge an unlock comes with, if it is a badge unlock and the badge is known. */
function unlockBadge(u: Unlock) {
  const by = u.by;
  return 'badge' in by ? (badgeData().find((b) => b.id === by.badge) ?? null) : null;
}

/** "Komt vrij op level 35." / "Komt vrij met de badge Op dreef." (a secret badge is never named). */
function lockText(u: Unlock, l: Lang): string {
  const by = u.by;
  if (!('badge' in by)) return t('style.lockedLevel', { n: by.level });
  const badge = unlockBadge(u);
  if (!badge || badge.hidden === true) return t('avatar.lockedSecret');
  return t('style.lockedBadge', { badge: badge[l].name });
}

/** The small label on a locked tile: 🔒 + "Lv n", or 🔒 + the badge icon (❓ for a secret badge). */
function lockLabel(u: Unlock): string {
  const by = u.by;
  if (!('badge' in by)) return `🔒 ${t('avatar.lockLevel', { n: by.level })}`;
  const badge = unlockBadge(u);
  return `🔒 ${!badge || badge.hidden === true ? '❓' : badge.icon}`;
}

// ---------------------------------------------------------------------------- the screen

/** How long a press must last to toggle a style's place in the mix. */
const LONG_PRESS_MS = 500;
const PANEL_ID = 'style-panel';

function tabId(tab: StyleTab): string {
  return `style-tab-${tab}`;
}

function readRememberedTab(): string | null {
  try {
    return localStorage.getItem(STYLE_TAB_KEY);
  } catch {
    return null;
  }
}

function rememberTab(tab: StyleTab): void {
  try {
    localStorage.setItem(STYLE_TAB_KEY, tab);
  } catch {
    // Private mode / blocked storage: the tab is simply not remembered.
  }
}

function normalizeCookFont(v: unknown): CookFont {
  return v === 'chalk' || v === 'hand' ? v : 'default';
}

/** Scrolls the strip just enough to show `tab` with a margin (same as the badge page). */
function revealTab(strip: HTMLElement, tab: HTMLElement) {
  const margin = 16;
  const left = tab.offsetLeft - margin;
  const right = tab.offsetLeft + tab.offsetWidth + margin - strip.clientWidth;
  if (strip.scrollLeft > left) strip.scrollLeft = Math.max(0, left);
  else if (strip.scrollLeft < right) strip.scrollLeft = right;
}

/** The strip (same pattern and classes as the badge page's group tabs, block 6D-UI). */
function StyleTabs(props: { tabs: readonly StyleTab[]; active: StyleTab; onSelect: (tab: StyleTab) => void }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const tab = strip ? document.getElementById(tabId(props.active)) : null;
    if (!strip || !tab) return;
    revealTab(strip, tab);
    if (moveFocus.current) {
      moveFocus.current = false;
      tab.focus({ preventScroll: true });
    }
  }, [props.active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const n = props.tabs.length;
    const i = props.tabs.indexOf(props.active);
    let next: number;
    if (e.key === 'ArrowRight') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    const target = props.tabs[next];
    if (!target) return;
    moveFocus.current = true;
    props.onSelect(target);
  };

  return (
    <div class="badge-gtabs style-tabs" role="tablist" aria-label={t('style.title')} ref={stripRef} onKeyDown={onKeyDown}>
      {props.tabs.map((tab) => {
        const on = tab === props.active;
        return (
          <button key={tab} type="button" role="tab" id={tabId(tab)} class="badge-gtab" aria-selected={on} aria-controls={PANEL_ID} tabIndex={on ? 0 : -1} onClick={() => props.onSelect(tab)}>
            <span class="badge-gtab-name">{t('style.tab.' + tab)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The face of a tile: the icon, or the swatch of a typeface ("Aa") or a theme (paper colour). */
function TileFace(props: { x: StyleTile }): JSX.Element {
  const { x } = props;
  if (x.group === 'font') {
    return (
      <span class="style-swatch-font" data-font={x.value} aria-hidden="true">
        Aa
      </span>
    );
  }
  if (x.group === 'theme') return <span class="style-swatch-theme" data-theme-swatch={x.value} aria-hidden="true" />;
  const icon = x.unlock?.icon ?? STANDARD_ICONS[`${x.group}:${x.value}`] ?? '•';
  return (
    <span class="style-tile-icon" aria-hidden="true">
      {icon}
    </span>
  );
}

function Tile(props: { x: StyleTile; l: Lang; onTap: (x: StyleTile) => void; onToggleMix: (x: StyleTile) => void }): JSX.Element {
  const { x, l } = props;
  const name = tileName(x, l);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const canMix = x.inMix !== null;
  const rarity = rarityName(x.rarity);
  const label = x.locked && x.unlock ? `${rarity} · ${name}. ${lockText(x.unlock, l)}` : x.unlock ? `${rarity} · ${name}` : name;

  function clearPress() {
    if (press.current !== null) clearTimeout(press.current);
    press.current = null;
  }

  useEffect(() => clearPress, []);

  function onPointerDown() {
    if (!canMix) return;
    clearPress();
    fired.current = false;
    press.current = setTimeout(() => {
      press.current = null;
      fired.current = true;
      props.onToggleMix(x);
    }, LONG_PRESS_MS);
  }

  return (
    <div class="style-tile-wrap">
      <button
        type="button"
        class={'style-tile' + (x.on ? ' on' : '') + (x.locked ? ' locked' : '')}
        aria-pressed={x.locked && !x.on ? undefined : x.on}
        aria-label={label}
        title={label}
        onPointerDown={onPointerDown}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onPointerCancel={clearPress}
        onContextMenu={(e) => {
          if (canMix) e.preventDefault();
        }}
        onClick={() => {
          // The click that ends a long press only toggled the mix.
          if (fired.current) {
            fired.current = false;
            return;
          }
          props.onTap(x);
        }}
      >
        <span class="style-tile-face">
          <TileFace x={x} />
          {x.rarity !== 'common' && <span class="style-tile-rarity rarity-dot" data-rarity={x.rarity} aria-hidden="true" />}
          {x.locked && x.unlock && <span class="style-tile-lock">{lockLabel(x.unlock)}</span>}
        </span>
        <span class="style-tile-name">{name}</span>
      </button>
      {canMix && (
        <button
          type="button"
          class="style-tile-mix"
          aria-pressed={x.inMix === true}
          aria-label={`${name}: ${t(x.inMix ? 'style.inMix' : 'style.outOfMix')}`}
          title={t(x.inMix ? 'style.inMix' : 'style.outOfMix')}
          onClick={() => props.onToggleMix(x)}
        >
          <span aria-hidden="true">{x.inMix ? '☑' : '☐'}</span>
        </button>
      )}
    </div>
  );
}

/** One grid of tiles with the lock note of its tapped locked tile under it. */
function TileGrid(props: { tiles: StyleTile[]; l: Lang; note: StyleTile | null; onTap: (x: StyleTile) => void; onToggleMix: (x: StyleTile) => void }): JSX.Element {
  const note = props.note && props.tiles.includes(props.note) ? props.note : null;
  return (
    <>
      <div class="style-grid">
        {props.tiles.map((x) => (
          <Tile key={`${x.group}:${x.value}`} x={x} l={props.l} onTap={props.onTap} onToggleMix={props.onToggleMix} />
        ))}
      </div>
      {note?.unlock && (
        <p class="muted small style-note" data-rarity={note.rarity} aria-live="polite">
          {`${rarityName(note.rarity)} · ${lockText(note.unlock, props.l)}`}
        </p>
      )}
    </>
  );
}

/** V4 §1c: the unlock id of "Snelle vieringen" (data/unlocks.json). */
const FAST_CELEBRATIONS_UNLOCK = 'fast-celebrations';

function Section(props: { title: string; hint?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="style-section">
      <h2 class="more-sub style-head">{props.title}</h2>
      {props.hint}
      {props.children}
    </section>
  );
}

export function StyleScreen() {
  const badgesOn = badgesEnabled.value;
  const l = lang.value;
  const active = activeProfile.value;
  const level = useAvatarLevel(active?.id);
  const tabs = styleTabs(badgesOn);
  const [tab, setTab] = useState<StyleTab>(() => initialStyleTab(tabs, route.value.query.get('tab'), readRememberedTab()));
  const [cookFont, setCookFont] = useState<CookFont>('default');
  const [avatarOpen, setAvatarOpen] = useState(false);
  // The locked tile whose explanation stands under its grid (one at a time).
  const [noteKey, setNoteKey] = useState<string | null>(null);

  useEffect(() => {
    void loadBadgeSettings();
    void loadSoundSettings();
    void loadCelebrateSettings();
    // A read, not a reward moment: brings the phone-wide union up to date (never settles XP).
    void refreshUnlocks().catch((e: unknown) => console.error('refreshUnlocks', e));
    void getSetting<unknown>(COOK_FONT_SETTING, 'default').then(
      (v) => setCookFont(normalizeCookFont(v)),
      (e: unknown) => console.error('getCookFont', e),
    );
  }, []);

  // Badges switched off (or on) while open: stay on a tab that exists.
  const shownTab: StyleTab = tabs.includes(tab) ? tab : (tabs[0] ?? 'theme');

  function selectTab(next: StyleTab) {
    setTab(next);
    setNoteKey(null);
    rememberTab(next);
    if (route.value.query.has('tab')) navigate('/more/style?tab=' + next, { replace: true });
  }

  const state: StyleState = {
    badgesOn,
    unlocks: unlockData(),
    unlocked: unlockedOnPhone.value,
    disabled: disabledUnlocks.value,
    timerSound: timerSound.value,
    cookedSound: cookedSound.value,
    confettiStyle: confettiStyle.value,
    cookFont,
    theme: theme.value,
  };
  const tiles = styleTiles(shownTab, state);
  const note = tiles.find((x) => `${x.group}:${x.value}` === noteKey) ?? null;

  /** A chosen unlock that was switched off on this phone (`unlocks.disabled`) is switched on again. */
  function ensureOn(x: StyleTile) {
    if (x.unlock && state.disabled.has(x.unlock.id)) void setUnlockEnabled(x.unlock.id, true).catch((e: unknown) => console.error('setUnlockEnabled', e));
  }

  function onTap(x: StyleTile) {
    if (x.locked) {
      setNoteKey(`${x.group}:${x.value}`);
      return;
    }
    setNoteKey(null);
    switch (x.group) {
      case 'timerSound': {
        const s = x.value as TimerSound;
        // The preview first, inside the tap (the tap wakes the audio context).
        if (s !== 'off') previewTimerSound(s);
        ensureOn(x);
        void setTimerSound(s).catch((e: unknown) => console.error('setTimerSound', e));
        return;
      }
      case 'cookedSound': {
        const next = !x.on;
        if (next) {
          previewCookedSound();
          ensureOn(x);
        }
        void setCookedSound(next).catch((e: unknown) => console.error('setCookedSound', e));
        return;
      }
      case 'confetti':
        void setConfettiStyle(x.value).catch((e: unknown) => console.error('setConfettiStyle', e));
        if (x.value !== RANDOM_CONFETTI_STYLE) celebrate('cooked', { style: x.value });
        return;
      case 'font': {
        const f = normalizeCookFont(x.value);
        setCookFont(f);
        ensureOn(x);
        void setSetting(COOK_FONT_SETTING, f).catch((e: unknown) => console.error('setCookFont', e));
        return;
      }
      case 'theme': {
        const th = x.value as Theme;
        if (th !== theme.value) void recordFeature('theme');
        void setTheme(th);
        return;
      }
    }
  }

  function onToggleMix(x: StyleTile) {
    if (!x.unlock || x.inMix === null) return;
    void setUnlockEnabled(x.unlock.id, !x.inMix).catch((e: unknown) => console.error('setUnlockEnabled', e));
  }

  const grid = (list: StyleTile[]) => <TileGrid tiles={list} l={l} note={note} onTap={onTap} onToggleMix={onToggleMix} />;
  const canOpenMaker = active !== null && level !== undefined && level >= AVATAR_MAKER_LEVEL;

  function panel(): JSX.Element | null {
    switch (shownTab) {
      case 'avatar':
        if (!active) return null;
        return (
          <div class="style-avatar">
            <div class="style-avatar-art">
              <Avatar profile={active} big level={level} />
            </div>
            <button type="button" class="btn" disabled={!canOpenMaker} onClick={() => setAvatarOpen(true)}>
              {t('avatar.open')}
            </button>
            {!canOpenMaker && <p class="muted small">{t('avatar.lockedHint')}</p>}
          </div>
        );
      case 'sounds':
        return (
          <>
            <Section title={t('style.timerSound')} hint={isIOS() ? <p class="muted small style-hint">{t('more.timerSoundIOSHint')}</p> : undefined}>
              {grid(tiles.filter((x) => x.group === 'timerSound'))}
            </Section>
            {tiles.some((x) => x.group === 'cookedSound') && <Section title={t('style.cookedSound')}>{grid(tiles.filter((x) => x.group === 'cookedSound'))}</Section>}
          </>
        );
      case 'confetti':
        return (
          <>
            {grid(tiles)}
            {/* V4 §1c: the level-30 unlock "Snelle vieringen" — a phone setting (`celebrate.fast`), shown only while active. */}
            {isActive(FAST_CELEBRATIONS_UNLOCK) && (
              <Section title={t('style.fast')}>
                <label class="setting">
                  <div class="label">
                    <small>{t('style.fastHint')}</small>
                  </div>
                  <span class="switch">
                    <input
                      type="checkbox"
                      aria-label={t('style.fast')}
                      checked={celebrateFast.value}
                      onChange={(e) => void Promise.resolve(setCelebrateFast((e.currentTarget as HTMLInputElement).checked)).catch((err: unknown) => console.error('setCelebrateFast', err))}
                    />
                    <span class="track" />
                  </span>
                </label>
              </Section>
            )}
          </>
        );
      default:
        return grid(tiles);
    }
  }

  return (
    <>
      <Header title={t('style.title')} back backLabel={t('common.back')} />
      <div class="screen style">
        {!badgesOn && (
          <p class="muted" style="padding-top:12px">
            {t('badges.disabled')}
          </p>
        )}
        <StyleTabs tabs={tabs} active={shownTab} onSelect={selectTab} />
        <div class="style-panel" id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(shownTab)} tabIndex={0}>
          {panel()}
        </div>
        {badgesOn && <p class="muted small style-phone-wide">{t('unlocks.phoneWide')}</p>}
      </div>
      {avatarOpen && active && <AvatarSheet profile={active} onClose={() => setAvatarOpen(false)} />}
    </>
  );
}
