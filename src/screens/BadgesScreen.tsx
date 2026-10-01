// '#/more/badges' — Badges (docs/phase-5-spec.md Block C.2): a tab per household member (the local
// profiles + hand-added members from src/domain/household.ts) plus "Samen" ('all'); per tab a grid
// of badge cards. Earned = coloured icon + name (tier tints the card edge: gold/silver/bronze);
// locked = dimmed with "7/10" and a thin progress bar. Tap a card → the description (active
// language) expands under it. The heading shows "N of M". Badges off (`badges.enabled`) = only a
// muted note: gamification never in the way (PLAN.md §0).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { badgeStatuses, badgesEnabled, loadBadgeSettings } from '@/badges';
import { Header } from '@/components/Header';
import { getHousehold } from '@/db/repo';
import type { BadgeStatus } from '@/domain/badges';
import { memberFromProfile, membersFrom, type Member } from '@/domain/household';
import { lang, t } from '@/i18n';
import { activeProfile, profiles } from '@/profile';
import { route } from '@/router';

/** 'all' = the "Samen" tab (never a member id: profiles are 'p:…', hand-added members 'm:…'). */
const TOGETHER = 'all';

function BadgeCard(props: { status: BadgeStatus; open: boolean; onToggle: () => void }) {
  const l = lang.value;
  const { badge, earned, current, target } = props.status;
  const text = badge[l];
  const pct = target > 0 ? Math.round((Math.min(current, target) / target) * 100) : 0;
  return (
    <li class={`badge-card tier-${badge.tier ?? 1}${earned ? ' is-earned' : ' is-locked'}`}>
      <button type="button" class="badge-card-btn" aria-expanded={props.open} onClick={props.onToggle}>
        <span class="badge-icon" aria-hidden="true">
          {badge.icon}
        </span>
        <span class="badge-name">{text.name}</span>
        {earned ? (
          <span class="badge-done">✓ {t('badges.earned')}</span>
        ) : (
          <>
            <span class="badge-count">
              {current}/{target}
            </span>
            <span class="badge-bar" aria-hidden="true">
              <span class="badge-bar-fill" style={{ width: `${pct}%` }} />
            </span>
          </>
        )}
      </button>
      {props.open && (
        <div class="badge-detail">
          <p>{text.description}</p>
          <p class="muted small">{earned ? t('badges.earned') : `${current}/${target} · ${t('badges.locked')}`}</p>
        </div>
      )}
    </li>
  );
}

export function BadgesScreen() {
  const enabled = badgesEnabled.value;
  const profileList = profiles.value;
  const [members, setMembers] = useState<Member[] | null>(null);
  // The new-badge toast navigates here with '?tab=<memberId|all>': open on the tab that earned it.
  const [tab, setTab] = useState<string>(route.value.query.get('tab') ?? activeProfile.value?.id ?? TOGETHER);
  const [statuses, setStatuses] = useState<BadgeStatus[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

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
  const earned = statuses ? statuses.filter((s) => s.earned).length : 0;
  const total = statuses ? statuses.length : 0;

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
            {statuses === null ? (
              <p class="muted">{t('common.loading')}</p>
            ) : (
              <>
                <p class="badges-count" role="status">
                  {t('badges.earnedOf', { earned, total })}
                </p>
                <ul class="badge-grid">
                  {statuses.map((s) => (
                    <BadgeCard key={s.badge.id} status={s} open={open === s.badge.id} onToggle={() => setOpen(open === s.badge.id ? null : s.badge.id)} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
