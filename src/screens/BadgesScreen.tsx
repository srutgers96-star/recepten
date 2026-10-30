// '#/more/badges' — Badges (docs/phase-5-spec.md Block C.2; the page of docs/specs/badges-avatar.md
// §1a, block 6D-2b; tabs since block 6D-UI; tiles since block 6D-B): a tab per household member (the
// local profiles + hand-added members from src/domain/household.ts) plus "Samen" ('all'); under the
// count line a horizontally scrolling strip with the eight badge groups (BADGE_GROUPS) as tabs, and
// one group at a time in the panel below it: a wrapping grid of 64 px tiles in catalogue order.
// Block 6D-B (Stijn 30 Oct: "alleen die logo's, kleiner, en als je erop klikt de details"): a tile
// is only the icon in a 56 px circle, no name and no text on it (the name is its aria-label):
// - ladder badge: the ring in the colour of the reached tier (tier 0 = grey dotted ring);
// - one-off badge: a gold edge (`--lvl-7`) once earned;
// - not earned (one-off, or a ladder on tier 0): muted (opacity .55, grey edge).
// Tap a tile → a bottom sheet (SheetPortal, Sluit at the top) with exactly the old card details: the
// icon big with its ring, the name, the description with {n} filled in, for a ladder the eight tier
// dots + "● Niveau {k}" + "{current}/{target}" + bar + "Volgende: {n} ●" ("✓ Platina" on top), for a
// one-off "✓ Verdiend" / "{current}/{target} · nog niet verdiend", the season window, "whole
// household", and the avatar part it unlocks ("Geeft: {part} ● op niveau {k}"). Colour instead of
// colour names (6D-B.6): a tier is shown by its colour (ring, dots, a 10 px `.tier-dot`); the colour
// names (`badges.tier.<k>`) are only the aria text of those dots. No sideways swipe in the sheet
// (`useHorizontalSwipe` of block 13D-2 does not exist yet); the sheet is a portal of this screen, so
// leaving the page (Back) takes it away; no hash state.
// Secret badges (block 6D-2c, decision 29 Oct 2026): a hidden badge that is not earned yet is a "?"
// tile in its own group (Geheim; the heart in Samen & delen): its real icon at full strength as the
// only hint, a dotted edge, aria-label "???"; it opens nothing. Its name and description never reach
// the DOM. Counts do not change: the tab of Geheim shows "{n} gevonden", never a total; "{n} geheime
// gevonden" counts found badges only, group counts count the visible tiles (never a "?" tile). The
// line above the tabs counts visible (non-hidden) badges only. Badges off (`badges.enabled`) = only a
// muted note: gamification never in the way (PLAN.md §0).
// Block 6D-UI (UI-A): the last group tab is remembered per phone (localStorage `recepten.badges.tab`,
// replacing `recepten.badges.groups`); '?group=<id>' opens that group, '?tab=<member>' that member.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { avatarParts } from '@/avatar';
import { HOUSEHOLD_KINDS, badgeStatuses, badgesEnabled, loadBadgeSettings } from '@/badges';
import { Header } from '@/components/Header';
import { SheetPortal } from '@/components/SheetPortal';
import { getHousehold } from '@/db/repo';
import { BADGE_GROUPS, isLadder, parseSeasonWindow, type BadgeGroup, type BadgeStatus } from '@/domain/badges';
import { memberFromProfile, membersFrom, type Member } from '@/domain/household';
import { interpolate, lang, t, type Lang } from '@/i18n';
import { activeProfile, profiles } from '@/profile';
import { route } from '@/router';

/** 'all' = the "Samen" tab (never a member id: profiles are 'p:…', hand-added members 'm:…'). */
const TOGETHER = 'all';

/** The group whose content is secret: only found badges and their count, never a total. */
const SECRET_GROUP: BadgeGroup = 'geheim';

// --- Page model (pure; no DOM, no database) ------------------------------------------------------

export interface BadgeGroupView {
  group: BadgeGroup;
  /** The cards this group may show in full, in catalogue order. */
  shown: BadgeStatus[];
  /**
   * 6D-2c: the "?" cards, in catalogue order, rendered after `shown` (in Geheim: found first, then
   * the "?" cards): every status of this group that `isShown` keeps off the page, i.e. a hidden badge
   * not earned yet. Only the icon of these reaches the DOM; they never count in `earned`/`total`.
   */
  mystery: BadgeStatus[];
  /** Earned among `shown` / the number of `shown` (never displayed for the secret group). */
  earned: number;
  total: number;
}

export interface BadgePageModel {
  /** "{earned} van {total} badges verdiend": visible (non-hidden) badges only (§1a.2). */
  earned: number;
  total: number;
  /** Badges found in the group "Geheim" ("· {n} geheime gevonden", "{n} geheime badges gevonden"). */
  secretFound: number;
  /** All eight groups in BADGE_GROUPS order, also when one is empty on this tab. */
  groups: BadgeGroupView[];
}

/**
 * May this status reach the page as a full card? A hidden badge only once it is earned; in the
 * secret group only found badges, whatever their `hidden` flag says. Everything else always. What
 * this keeps off becomes a "?" card (`BadgeGroupView.mystery`, 6D-2c).
 */
export function isShown(s: BadgeStatus): boolean {
  if (s.badge.group === SECRET_GROUP) return s.earned;
  return s.badge.hidden !== true || s.earned;
}

/** Splits one tab's statuses (badgeStatuses, catalogue order) into what the page renders. */
export function badgePageModel(statuses: readonly BadgeStatus[]): BadgePageModel {
  const visible = statuses.filter((s) => s.badge.hidden !== true);
  const groups = BADGE_GROUPS.map((group): BadgeGroupView => {
    const inGroup = statuses.filter((s) => s.badge.group === group);
    const shown = inGroup.filter(isShown);
    const mystery = inGroup.filter((s) => !isShown(s));
    return { group, shown, mystery, earned: shown.filter((s) => s.earned).length, total: shown.length };
  });
  return {
    earned: visible.filter((s) => s.earned).length,
    total: visible.length,
    secretFound: groups.find((g) => g.group === SECRET_GROUP)?.shown.length ?? 0,
    groups,
  };
}

// --- Group tab (per device) ---------------------------------------------------------------------

/** localStorage key (docs/specs/README.md §2b register, block 6D-UI): the last group tab on this phone. */
const TAB_KEY = 'recepten.badges.tab';

/** The 6D-2b key of the folded groups; gone since the tabs (6D-UI), removed once on load. */
const OLD_GROUPS_KEY = 'recepten.badges.groups';

/** The first tab ("Koken"): the fallback for an unknown or missing value. */
const FIRST_GROUP: BadgeGroup = BADGE_GROUPS[0] ?? 'koken';

/** The fixed group icons on the tabs (block 6D-UI, UI-A.1). */
const GROUP_ICONS: Record<BadgeGroup, string> = {
  koken: '🍳',
  ontdekken: '🧭',
  keukens: '🌍',
  seizoenen: '🍂',
  samen: '🤝',
  foto: '📷',
  reeksen: '🔥',
  geheim: '🤫',
};

function isGroup(v: unknown): v is BadgeGroup {
  return typeof v === 'string' && (BADGE_GROUPS as readonly string[]).includes(v);
}

/** '?group=<id>' first (the badge toast links with it), then the remembered tab, else "Koken". */
function initialGroup(fromQuery: string | null): BadgeGroup {
  if (isGroup(fromQuery)) return fromQuery;
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (isGroup(v)) return v;
  } catch {
    /* private mode: the first tab */
  }
  return FIRST_GROUP;
}

function saveGroupTab(g: BadgeGroup) {
  try {
    localStorage.setItem(TAB_KEY, g);
  } catch {
    /* ignore */
  }
}

function dropOldGroupsKey() {
  try {
    localStorage.removeItem(OLD_GROUPS_KEY);
  } catch {
    /* ignore */
  }
}

// --- Small helpers ---------------------------------------------------------------------------

/** The colour name of tier k (1 … 8): "geel" … "platina"; since 6D-B.6 only the aria text of a dot. */
function colourName(k: number): string {
  return t(`badges.tier.${k}`);
}

/** "24 dec" / "24 Dec" for a season end ([month, day]); a leap year so 29 February exists. */
function dayMonth(md: [number, number], l: Lang): string {
  return new Intl.DateTimeFormat(l === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(2000, md[0] - 1, md[1]));
}

/**
 * The nl/en name of an avatar part (`avatarParts()`, the normalized data/avatar-parts.json of block
 * 6D-3) for the line "Geeft: {part}"; null when the id is unknown (then the line is left out, never
 * a raw id).
 */
function partName(id: string, l: Lang): string | null {
  const part = avatarParts().get(id);
  return part ? part[l] || part.nl : null;
}

/**
 * The aria-label of a tile (6D-B.1): "Huiskok, niveau 2 van 8" (ladder) / "Eerste hap, verdiend" /
 * "Eerste hap, nog niet verdiend" (one-off). The visible tile carries no text at all.
 */
function tileLabel(s: BadgeStatus, l: Lang): string {
  const name = s.badge[l].name;
  if (isLadder(s.badge)) return t('badges.tileLabel', { name, k: s.tier, max: s.maxTier });
  return `${name}, ${s.earned ? t('badges.earned').toLocaleLowerCase() : t('badges.locked')}`;
}

/** The classes of the round icon (tile and sheet): ring colour, gold edge, muted when not earned. */
function coinClass(s: BadgeStatus): string {
  const kind = isLadder(s.badge) ? `is-ladder lvl-${s.tier}` : 'is-once';
  return `badge-coin ${kind} ${s.earned ? 'is-earned' : 'is-locked'}`;
}

/**
 * The 10 px dot in the colour of tier k (6D-B.6: colour instead of the colour name). Its colour name
 * is its aria text, so a screen reader still hears "geel"; `.tier-dot.lvl-<k>` in base.css (shared
 * with the toast and the avatar maker).
 */
function TierDot(props: { k: number }) {
  return <i class={`tier-dot lvl-${props.k}`} role="img" aria-label={colourName(props.k)} />;
}

/** The thin progress bar under "27/50". */
function Bar(props: { current: number; target: number }) {
  const { current, target } = props;
  const pct = target > 0 ? Math.round((Math.min(current, target) / target) * 100) : 0;
  return (
    <span class="badge-bar" aria-hidden="true">
      <span class="badge-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

// --- Tiles -----------------------------------------------------------------------------------

/** One visible badge (earned or not): only its icon in the 56 px circle; a tap opens the sheet. */
function BadgeTile(props: { status: BadgeStatus; onOpen: (tile: HTMLElement) => void }) {
  const l = lang.value;
  const { status } = props;
  return (
    <li class="badge-tile-cell">
      <button type="button" class="badge-tile" aria-label={tileLabel(status, l)} aria-haspopup="dialog" onClick={(e) => props.onOpen(e.currentTarget)}>
        <span class={coinClass(status)} aria-hidden="true">
          <span class="badge-coin-icon">{status.badge.icon}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * A "?" tile (6D-2c, decision 29 Oct 2026; a tile since 6D-B): a hidden badge not earned yet. Only
 * its real icon at full strength (the one hint) in a dotted circle, aria-label "???"; not a button
 * (a tap does nothing). The badge's name and description are never rendered.
 */
function SecretTile(props: { icon: string }) {
  return (
    <li class="badge-tile-cell">
      <span class="badge-tile is-secret" role="img" aria-label="???">
        <span class="badge-coin is-secret" aria-hidden="true">
          <span class="badge-coin-icon">{props.icon}</span>
        </span>
      </span>
    </li>
  );
}

/** The full tiles (`statuses`) first, then the "?" tiles (`mystery`), each in catalogue order. */
function BadgeTiles(props: { statuses: BadgeStatus[]; mystery: BadgeStatus[]; onOpen: (id: string, tile: HTMLElement) => void }) {
  return (
    <ul class="badge-tiles">
      {props.statuses.map((s) => (
        <BadgeTile key={s.badge.id} status={s} onOpen={(tile) => props.onOpen(s.badge.id, tile)} />
      ))}
      {props.mystery.map((s) => (
        <SecretTile key={'?' + s.badge.id} icon={s.badge.icon} />
      ))}
    </ul>
  );
}

// --- Detail sheet ----------------------------------------------------------------------------

/** How far (px) the sheet must be pulled down before letting go closes it (as the other sheets). */
const DISMISS_PX = 80;

const SHEET_NAME_ID = 'badge-sheet-name';

/**
 * The details of one tile in a bottom sheet (6D-B.2): exactly what the old card and its expanded
 * detail showed, in the order of the spec, with colour instead of colour names (6D-B.6). Sluit at
 * the top (13J); swiping it down on the grab bar / head, tapping beside it and Escape close it too;
 * there is nothing to keep. The focus goes to Sluit on open and back to the tile on close (`opener`:
 * Safari does not focus a tapped button, so the tile is handed over rather than read from the focus).
 */
function BadgeSheet(props: { status: BadgeStatus; opener: HTMLElement | null; onClose: () => void }) {
  const l = lang.value;
  const { status, opener, onClose } = props;
  const { badge, earned, current, target, tier, maxTier } = status;
  const ladder = isLadder(badge);
  const season = badge.season ? parseSeasonWindow(badge.season) : null;
  const unlock = badge.unlock;
  const part = unlock ? partName(unlock.part, l) : null;
  const closeBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it on Sluit on open, hand it back to the tile on close.
  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);

  // Swipe down on the grab bar / head: the sheet follows the finger; far enough = close.
  function onDragStart(e: PointerEvent) {
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone (a very short tap): the drag works without capture.
    }
  }
  function onDragMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y);
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = d.dy > 0 ? `translateY(${d.dy}px)` : '';
    }
  }
  function onDragEnd(e: PointerEvent, cancelled: boolean) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform .18s ease-out';
      sheetRef.current.style.transform = '';
    }
    if (!cancelled && d.dy > DISMISS_PX) onClose();
  }

  return (
    <SheetPortal>
      <div class="sheet-backdrop" onClick={onClose}>
        <div ref={sheetRef} class="sheet badge-sheet" role="dialog" aria-modal="true" aria-labelledby={SHEET_NAME_ID} onClick={(e) => e.stopPropagation()}>
          <div
            class="cooked-drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={(e) => onDragEnd(e, false)}
            onPointerCancel={(e) => onDragEnd(e, true)}
          >
            <div class="sheet-grab" aria-hidden="true" />
            <div class="sheet-head with-actions">
              <span class="badge-sheet-head-space" aria-hidden="true" />
              <button ref={closeBtn} type="button" class="sheet-head-btn" onClick={onClose}>
                {t('common.close')}
              </button>
            </div>
          </div>
          <div class="sheet-body badge-sheet-body">
            <div class="badge-sheet-hero">
              <span class={coinClass(status) + ' is-big'} aria-hidden="true">
                <span class="badge-coin-icon">{badge.icon}</span>
              </span>
              <h2 id={SHEET_NAME_ID} class="badge-sheet-name">
                {badge[l].name}
              </h2>
            </div>
            {/* {n} = the next threshold (on platinum the last one): exactly the status' target. */}
            <p class="badge-sheet-desc">{interpolate(badge[l].description, { n: target })}</p>
            {ladder ? (
              <>
                <span class="badge-dots" aria-hidden="true">
                  {badge.tiers.map((_, i) => (
                    <span key={i} class={`badge-dot lvl-${i + 1}${i < tier ? ' is-on' : ''}`} />
                  ))}
                </span>
                <p class="badge-sheet-tier">
                  {tier >= 1 ? (
                    <>
                      <TierDot k={tier} /> {t('badges.tierLabel', { k: tier })}
                    </>
                  ) : (
                    t('badges.tierNone')
                  )}
                </p>
                {tier >= maxTier ? (
                  <p class="badge-done">{t('badges.tierMax')}</p>
                ) : (
                  <>
                    <p class="badge-count">
                      {current}/{target}
                    </p>
                    <Bar current={current} target={target} />
                    <p class="muted small">
                      {t('badges.tierNext', { n: target })} <TierDot k={tier + 1} />
                    </p>
                  </>
                )}
              </>
            ) : earned ? (
              <p class="badge-done">✓ {t('badges.earned')}</p>
            ) : (
              <p class="muted small">{`${current}/${target} · ${t('badges.locked')}`}</p>
            )}
            {season && <p class="muted small">{t('badges.season', { from: dayMonth(season.from, l), to: dayMonth(season.to, l) })}</p>}
            {HOUSEHOLD_KINDS.has(badge.rule.kind) && <p class="muted small">{t('badges.householdOnly')}</p>}
            {part !== null && (
              <p class="muted small">
                {t('badges.unlocks', { part })}
                {ladder && unlock?.tier !== undefined && (
                  <>
                    {' '}
                    {/* The dot sits right before the word niveau/tier, like the toast and the maker (Fable 30 Oct). */}
                    {t('badges.unlocksAt')} <TierDot k={unlock.tier} /> {t('badges.tierWord', { k: unlock.tier })}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}

// --- Group tabs ------------------------------------------------------------------------------

const PANEL_ID = 'badge-group-panel';

function tabId(g: BadgeGroup): string {
  return `badge-group-tab-${g}`;
}

/**
 * Scrolls the strip sideways (never the page: no scrollIntoView) just far enough that the tab is
 * fully visible, with a 16 px margin. offsetLeft is relative to the strip (position: relative).
 */
function revealTab(strip: HTMLElement, tab: HTMLElement) {
  const margin = 16;
  const left = tab.offsetLeft - margin;
  const right = tab.offsetLeft + tab.offsetWidth + margin - strip.clientWidth;
  if (strip.scrollLeft > left) strip.scrollLeft = Math.max(0, left);
  else if (strip.scrollLeft < right) strip.scrollLeft = right;
}

/**
 * The strip with the eight groups (block 6D-UI, UI-A.1/5): icon + name + "2/31" in a pill (Geheim:
 * "{n} gevonden", never a total). Roving tabindex: only the active tab is in the tab order; arrow
 * left/right (and Home/End) switch tab and move the focus with it. The active tab is scrolled into
 * view when the strip appears (also after a member switch, which remounts it) and on every change.
 */
function GroupTabs(props: { groups: BadgeGroupView[]; active: BadgeGroup; onSelect: (g: BadgeGroup) => void }) {
  const stripRef = useRef<HTMLDivElement>(null);
  /** Set by the keyboard: the next active tab takes the focus (a tap already has it). */
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
    const n = props.groups.length;
    const i = props.groups.findIndex((g) => g.group === props.active);
    let next: number;
    if (e.key === 'ArrowRight') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    const target = props.groups[next];
    if (!target) return;
    moveFocus.current = true;
    props.onSelect(target.group);
  };

  return (
    <div class="badge-gtabs" role="tablist" aria-label={t('badges.title')} ref={stripRef} onKeyDown={onKeyDown}>
      {props.groups.map((g) => {
        const on = g.group === props.active;
        return (
          <button
            key={g.group}
            type="button"
            role="tab"
            id={tabId(g.group)}
            class="badge-gtab"
            aria-selected={on}
            aria-controls={PANEL_ID}
            tabIndex={on ? 0 : -1}
            onClick={() => props.onSelect(g.group)}
          >
            <span class="badge-gtab-icon" aria-hidden="true">
              {GROUP_ICONS[g.group]}
            </span>
            <span class="badge-gtab-name">{t(`badges.group.${g.group}`)}</span>
            <span class="badge-gtab-pill">{g.group === SECRET_GROUP ? t('badges.groupFound', { n: g.shown.length }) : `${g.earned}/${g.total}`}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The one group in view (UI-A.2): its tiles (full tiles, then the "?" tiles). Geheim keeps its found
 * count above the tiles ("Nog geen geheime badge gevonden …" only without any tile); any other empty
 * group shows one muted line.
 */
function GroupPanel(props: { view: BadgeGroupView; onOpen: (id: string, tile: HTMLElement) => void }) {
  const g = props.view;
  const empty = g.shown.length === 0 && g.mystery.length === 0;
  return (
    <div class="badge-gpanel" id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(g.group)} tabIndex={0}>
      {g.group === SECRET_GROUP ? (
        empty ? (
          <p class="muted badge-secret-note">{t('badges.secretNone')}</p>
        ) : (
          <>
            <p class="badge-secret-note">{t('badges.secretCount', { n: g.shown.length })}</p>
            <BadgeTiles statuses={g.shown} mystery={g.mystery} onOpen={props.onOpen} />
          </>
        )
      ) : empty ? (
        <p class="muted badge-group-empty">{t('badges.groupEmpty')}</p>
      ) : (
        <BadgeTiles statuses={g.shown} mystery={g.mystery} onOpen={props.onOpen} />
      )}
    </div>
  );
}

// --- Screen ----------------------------------------------------------------------------------

export function BadgesScreen() {
  const enabled = badgesEnabled.value;
  const profileList = profiles.value;
  const [members, setMembers] = useState<Member[] | null>(null);
  // The new-badge toast navigates here with '?tab=<memberId|all>': open on the tab that earned it.
  const [tab, setTab] = useState<string>(route.value.query.get('tab') ?? activeProfile.value?.id ?? TOGETHER);
  const [statuses, setStatuses] = useState<BadgeStatus[] | null>(null);
  /** The badge id whose sheet is open (6D-B.2; never a "?" tile) and the tile that opened it. */
  const [open, setOpen] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  // 6D-UI: '?group=<id>' (the badge toast links with it) or the tab remembered on this phone.
  const [group, setGroup] = useState<BadgeGroup>(() => initialGroup(route.value.query.get('group')));

  useEffect(() => {
    let cancelled = false;
    dropOldGroupsKey();
    void loadBadgeSettings();
    void getHousehold().then(
      (h) => {
        if (!cancelled) setMembers(membersFrom(profiles.value, h));
      },
      (e: unknown) => {
        console.error('getHousehold', e);
        if (!cancelled) setMembers(membersFrom(profiles.value, null));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStatuses(null);
    setOpen(null);
    void badgeStatuses(tab).then(
      (list) => {
        if (!cancelled) setStatuses(list);
      },
      (e: unknown) => console.error('badgeStatuses', e),
    );
    return () => {
      cancelled = true;
    };
  }, [tab, enabled]);

  // The member tabs; the household may still be loading, then the local profiles are shown already.
  const tabs = useMemo(() => members ?? profileList.map(memberFromProfile), [members, profileList]);
  const model = useMemo(() => (statuses ? badgePageModel(statuses) : null), [statuses]);

  // The last tab shown is the one remembered (also when '?group=' opened it). A group switch also
  // closes the sheet, as a member switch does: otherwise the old id would reopen it on coming back.
  useEffect(() => {
    saveGroupTab(group);
    setOpen(null);
  }, [group]);

  const view = model?.groups.find((g) => g.group === group) ?? null;
  // Only a full tile of the group in view opens a sheet (a "?" tile has no button).
  const openStatus = open !== null ? (view?.shown.find((s) => s.badge.id === open) ?? null) : null;
  const openSheet = useCallback((id: string, tile: HTMLElement) => {
    opener.current = tile;
    setOpen(id);
  }, []);
  const closeSheet = useCallback(() => setOpen(null), []);

  return (
    <>
      <Header title={t('badges.title')} back backLabel={t('common.back')} />
      <div class="screen badges">
        {!enabled ? (
          <p class="muted" style="padding-top:12px">
            {t('badges.disabled')}
          </p>
        ) : (
          <>
            <div class="chips badge-tabs" role="tablist" aria-label={t('badges.members')}>
              {tabs.map((m) => (
                <button key={m.id} type="button" role="tab" aria-selected={tab === m.id} class={'chip' + (tab === m.id ? ' on' : '')} onClick={() => setTab(m.id)}>
                  <span class="badge-tab-dot" style={{ background: m.color }} aria-hidden="true" />
                  {m.name}
                </button>
              ))}
              <button key={TOGETHER} type="button" role="tab" aria-selected={tab === TOGETHER} class={'chip' + (tab === TOGETHER ? ' on' : '')} onClick={() => setTab(TOGETHER)}>
                {t('badges.together')}
              </button>
            </div>
            {model === null ? (
              <p class="muted">{t('common.loading')}</p>
            ) : (
              <>
                <p class="badges-count" role="status">
                  {t('badges.earnedOf', { earned: model.earned, total: model.total })}
                  {model.secretFound > 0 && ` ${t('badges.secretFound', { n: model.secretFound })}`}
                </p>
                <GroupTabs groups={model.groups} active={group} onSelect={setGroup} />
                {view && <GroupPanel view={view} onOpen={openSheet} />}
              </>
            )}
          </>
        )}
      </div>
      {enabled && openStatus && <BadgeSheet key={openStatus.badge.id} status={openStatus} opener={opener.current} onClose={closeSheet} />}
    </>
  );
}
