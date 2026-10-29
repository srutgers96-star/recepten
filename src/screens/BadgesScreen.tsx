// '#/more/badges' — Badges (docs/phase-5-spec.md Block C.2; the page of docs/specs/badges-avatar.md
// §1a, block 6D-2b): a tab per household member (the local profiles + hand-added members from
// src/domain/household.ts) plus "Samen" ('all'); per tab the eight badge groups (BADGE_GROUPS) as
// collapsible sections, each with its grid of badge cards in catalogue order.
// - one-off badge: icon, name, "✓ Verdiend" or "3/5" with a bar; an earned one gets a gold edge;
// - ladder badge: the icon in a ring of the current colour tier (tier 0 = grey dotted ring), the
//   tier line ("Niveau 1 · geel"), then "27/50" and the bar towards the NEXT tier ("✓ Platina" on top);
// - tap a card → the details under it: the description with {n} filled in, the eight tier dots and
//   "Volgende: …", the season window, "whole household", and the avatar part it unlocks.
// Secret badges (block 6D-2c, decision 29 Oct 2026): a hidden badge that is not earned yet is a "?"
// card in its own group (Geheim; the heart in Samen & delen): its real icon as the only hint, name
// "???", `badges.secretHint`, no progress, no tier, no ring, not tappable. Its name and description
// never reach the DOM. Counts do not change: the head of Geheim has no count, "{n} geheime gevonden"
// counts found badges only, group counts count the visible cards (never a "?" card). The line above
// the groups counts visible (non-hidden) badges only. Badges off (`badges.enabled`) = only a muted
// note: gamification never in the way (PLAN.md §0).
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import avatarPartsData from '@data/avatar-parts.json';
import { HOUSEHOLD_KINDS, badgeStatuses, badgesEnabled, loadBadgeSettings } from '@/badges';
import { Header } from '@/components/Header';
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

// --- Group open/closed state (per device, like Meer's groups) -----------------------------------

type GroupState = Record<BadgeGroup, boolean>;

/** localStorage key (docs/specs/README.md §2b register): which groups are folded on this phone. */
const GROUPS_KEY = 'recepten.badges.groups';

function loadGroupState(): GroupState {
  // Default: every group open (§1a.3).
  const out = Object.fromEntries(BADGE_GROUPS.map((g) => [g, true])) as GroupState;
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return out;
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const g of BADGE_GROUPS) {
        const b = (v as Record<string, unknown>)[g];
        if (typeof b === 'boolean') out[g] = b;
      }
    }
  } catch {
    /* private mode or a corrupt value: defaults */
  }
  return out;
}

function saveGroupState(s: GroupState) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// --- Small helpers ---------------------------------------------------------------------------

/** The colour name of tier k (1 … 8): "geel" … "platina" / "yellow" … "platinum". */
function colourName(k: number): string {
  return t(`badges.tier.${k}`);
}

/** "24 dec" / "24 Dec" for a season end ([month, day]); a leap year so 29 February exists. */
function dayMonth(md: [number, number], l: Lang): string {
  return new Intl.DateTimeFormat(l === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(2000, md[0] - 1, md[1]));
}

let partNames: Map<string, { nl: string; en: string }> | null = null;

/**
 * The nl/en name of an avatar part (data/avatar-parts.json, checked by the validator) for the line
 * "Geeft: {part}"; null when the id is unknown (then the line is left out, never a raw id).
 * 6D-3 brings `avatarParts()` in src/avatar.ts; this tolerant read only needs the names.
 */
function partName(id: string, l: Lang): string | null {
  if (!partNames) {
    partNames = new Map();
    const raw: unknown = avatarPartsData;
    if (Array.isArray(raw)) {
      for (const item of raw as unknown[]) {
        if (!item || typeof item !== 'object') continue;
        const p = item as Record<string, unknown>;
        if (typeof p['id'] === 'string' && typeof p['nl'] === 'string' && typeof p['en'] === 'string') {
          partNames.set(p['id'], { nl: p['nl'], en: p['en'] });
        }
      }
    }
  }
  const names = partNames.get(id);
  return names ? names[l] || names.nl : null;
}

function Chevron() {
  return (
    <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

// --- Cards -----------------------------------------------------------------------------------

/** The thin progress bar under "3/5" / "27/50". */
function Bar(props: { current: number; target: number }) {
  const { current, target } = props;
  const pct = target > 0 ? Math.round((Math.min(current, target) / target) * 100) : 0;
  return (
    <span class="badge-bar" aria-hidden="true">
      <span class="badge-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Everything under a tapped card (§1a.7). */
function BadgeDetail(props: { status: BadgeStatus }) {
  const l = lang.value;
  const { badge, earned, current, target, tier, maxTier } = props.status;
  const ladder = isLadder(badge);
  const season = badge.season ? parseSeasonWindow(badge.season) : null;
  const unlock = badge.unlock;
  const part = unlock ? partName(unlock.part, l) : null;
  return (
    <div class="badge-detail">
      {/* {n} = the next threshold (on platinum the last one): exactly the status' target. */}
      <p>{interpolate(badge[l].description, { n: target })}</p>
      {ladder ? (
        <>
          <span class="badge-dots" aria-hidden="true">
            {badge.tiers.map((_, i) => (
              <span key={i} class={`badge-dot lvl-${i + 1}${i < tier ? ' is-on' : ''}`} />
            ))}
          </span>
          {tier < maxTier && <p class="muted small">{t('badges.tierNext', { n: target, colour: colourName(tier + 1) })}</p>}
        </>
      ) : (
        <p class="muted small">{earned ? t('badges.earned') : `${current}/${target} · ${t('badges.locked')}`}</p>
      )}
      {season && <p class="muted small">{t('badges.season', { from: dayMonth(season.from, l), to: dayMonth(season.to, l) })}</p>}
      {HOUSEHOLD_KINDS.has(badge.rule.kind) && <p class="muted small">{t('badges.householdOnly')}</p>}
      {part !== null && (
        <p class="muted small">
          {t('badges.unlocks', { part })}
          {ladder && unlock?.tier !== undefined && ` ${t('badges.unlocksTier', { colour: colourName(unlock.tier) })}`}
        </p>
      )}
    </div>
  );
}

function BadgeCard(props: { status: BadgeStatus; open: boolean; onToggle: () => void }) {
  const l = lang.value;
  const { status } = props;
  const { badge, earned, current, target, tier, maxTier } = status;
  const ladder = isLadder(badge);
  const cls = 'badge-card' + (ladder ? ' is-ladder' : ' is-once') + (earned ? ' is-earned' : ' is-locked');
  return (
    <li class={cls}>
      <button type="button" class="badge-card-btn" aria-expanded={props.open} onClick={props.onToggle}>
        {ladder ? (
          // The ring takes the colour of the reached tier; tier 0 = grey dotted ring (badges.css).
          <span class={`badge-ring lvl-${tier}`} aria-hidden="true">
            <span class="badge-icon">{badge.icon}</span>
          </span>
        ) : (
          <span class="badge-icon" aria-hidden="true">
            {badge.icon}
          </span>
        )}
        <span class="badge-name">{badge[l].name}</span>
        {ladder ? (
          <>
            <span class="badge-tier">{tier >= 1 ? t('badges.tierLabel', { k: tier, colour: colourName(tier) }) : t('badges.tierNone')}</span>
            {tier >= maxTier ? (
              <span class="badge-done">{t('badges.tierMax')}</span>
            ) : (
              <>
                <span class="badge-count">
                  {current}/{target}
                </span>
                <Bar current={current} target={target} />
              </>
            )}
          </>
        ) : earned ? (
          <span class="badge-done">✓ {t('badges.earned')}</span>
        ) : (
          <>
            <span class="badge-count">
              {current}/{target}
            </span>
            <Bar current={current} target={target} />
          </>
        )}
      </button>
      {props.open && <BadgeDetail status={status} />}
    </li>
  );
}

/**
 * A "?" card (6D-2c, decision 29 Oct 2026): a hidden badge not earned yet. Only its real icon (at
 * full strength, the one hint), the name "???" and `badges.secretHint`; no progress, no tier, no
 * ring, not a button (a tap does nothing). The badge's name and description are never rendered.
 */
function SecretCard(props: { icon: string }) {
  return (
    <li class="badge-card is-secret">
      <div class="badge-card-face">
        <span class="badge-icon" aria-hidden="true">
          {props.icon}
        </span>
        <span class="badge-name">???</span>
        <span class="badge-secret-hint">{t('badges.secretHint')}</span>
      </div>
    </li>
  );
}

/** The full cards (`statuses`) first, then the "?" cards (`mystery`), each in catalogue order. */
function BadgeGrid(props: { statuses: BadgeStatus[]; mystery: BadgeStatus[]; open: string | null; onToggle: (id: string) => void }) {
  return (
    <ul class="badge-grid">
      {props.statuses.map((s) => (
        <BadgeCard key={s.badge.id} status={s} open={props.open === s.badge.id} onToggle={() => props.onToggle(s.badge.id)} />
      ))}
      {props.mystery.map((s) => (
        <SecretCard key={'?' + s.badge.id} icon={s.badge.icon} />
      ))}
    </ul>
  );
}

// --- Groups ----------------------------------------------------------------------------------

/**
 * One collapsible group (the pattern of Meer's `Group`): the head is an h2 wrapping a 48 px button
 * ("Koken · 3/33" + chevron), the body is rendered only while open. `count` is left out for the
 * secret group: its total is never shown.
 */
function GroupSection(props: { group: BadgeGroup; open: boolean; onToggle: (g: BadgeGroup) => void; count?: string; children: ComponentChildren }) {
  const bodyId = `badge-group-${props.group}`;
  return (
    <section class={'badge-group' + (props.open ? ' open' : '')}>
      <h2 class="badge-group-head">
        <button type="button" aria-expanded={props.open} aria-controls={props.open ? bodyId : undefined} onClick={() => props.onToggle(props.group)}>
          <span class="badge-group-title">
            {t(`badges.group.${props.group}`)}
            {props.count !== undefined && <span class="badge-group-count"> · {props.count}</span>}
          </span>
          <Chevron />
        </button>
      </h2>
      {props.open && (
        <div class="badge-group-body" id={bodyId}>
          {props.children}
        </div>
      )}
    </section>
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
  const [open, setOpen] = useState<string | null>(null);
  const [groupsOpen, setGroupsOpen] = useState<GroupState>(loadGroupState);

  useEffect(() => {
    let cancelled = false;
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

  const toggleCard = (id: string) => setOpen((cur) => (cur === id ? null : id));
  const toggleGroup = (g: BadgeGroup) =>
    setGroupsOpen((cur) => {
      const next = { ...cur, [g]: !cur[g] };
      saveGroupState(next);
      return next;
    });

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
                {model.groups.map((g) =>
                  g.group === SECRET_GROUP ? (
                    <GroupSection key={g.group} group={g.group} open={groupsOpen[g.group]} onToggle={toggleGroup}>
                      {/* 6D-2c: "Nog geen geheime badge gevonden …" only while there is no card at
                          all; with "?" cards the found count (also 0) stands above them. */}
                      {g.shown.length === 0 && g.mystery.length === 0 ? (
                        <p class="muted badge-secret-note">{t('badges.secretNone')}</p>
                      ) : (
                        <>
                          <p class="badge-secret-note">{t('badges.secretCount', { n: g.shown.length })}</p>
                          <BadgeGrid statuses={g.shown} mystery={g.mystery} open={open} onToggle={toggleCard} />
                        </>
                      )}
                    </GroupSection>
                  ) : (
                    <GroupSection key={g.group} group={g.group} open={groupsOpen[g.group]} onToggle={toggleGroup} count={`${g.earned}/${g.total}`}>
                      <BadgeGrid statuses={g.shown} mystery={g.mystery} open={open} onToggle={toggleCard} />
                    </GroupSection>
                  ),
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
