// XP bar on a profile card (docs/specs/xp-levels.md §1a) and the level line on Home (§1b), block 6D-1.
// Both read the memoised `xpStates` (src/xp.ts) and ask `xpStateFor(memberId)` once on mount: a
// quiet read that recomputes when the member is dirty, never a reward moment (no pops, no
// `xp.lastSeen` write; settleXp only runs on the seven reward moments, §5.11). Badges off (the
// existing switch `badges.enabled`) → both render null: no trace of XP anywhere, no empty space.
// Numbers with thousands go through Intl.NumberFormat ("1.500" / "1,500").
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { badgesEnabled, loadBadgeSettings } from '@/badges';
import { localDayIndex } from '@/domain/days';
import { MAX_LEVEL, titleFor } from '@/domain/levels';
import type { XpState } from '@/domain/xp';
import { lang, t } from '@/i18n';
import { profiles } from '@/profile';
import { navigate } from '@/router';
import { Avatar } from '@/screens/ProfilesScreen';
import { xpStateFor, xpStates } from '@/xp';

const formatters = new Map<string, Intl.NumberFormat>();

/** A whole number with the thousands separator of the UI language (nl-NL "1.500", en-GB "1,500"). */
export function formatXp(n: number): string {
  const locale = lang.value === 'nl' ? 'nl-NL' : 'en-GB';
  let f = formatters.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    formatters.set(locale, f);
  }
  return f.format(n);
}

/** How far into the current level: (total − levelStart) / (nextAt − levelStart), 1 on level 100. */
export function levelProgress(st: Pick<XpState, 'total' | 'level' | 'levelStart' | 'nextAt'>): number {
  if (st.nextAt === null || st.level >= MAX_LEVEL) return 1;
  const span = st.nextAt - st.levelStart;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (st.total - st.levelStart) / span));
}

/** "Level {level} · {title}" in the UI language (title from data/levels.json). */
export function levelTitleText(level: number): string {
  return t('xp.levelTitle', { level, title: titleFor(level, lang.value) });
}

/**
 * The streak part of line 2 (§1a): n ≥ 2 → "🔥 n dagen op rij" (with "· vrije dag gebruikt" when the
 * free day is in use); n = 1 → "🔥 vandaag gekookt", but only when that one cook day IS today (a
 * streak of 1 that ended yesterday would make the text untrue); 0 → nothing.
 */
function streakText(st: XpState, today: number): string | null {
  const n = st.streak.current;
  if (n >= 2) return t(st.streak.freeDayUsed ? 'xp.streakFree' : 'xp.streak', { n: formatXp(n) });
  if (n === 1 && st.streak.lastDay === today) return t('xp.streakOne');
  return null;
}

/**
 * The member's XP state: the shared memo when it has one, else the result of the mount-time
 * `xpStateFor` (kept locally so the bar also fills when the memo signal is written later).
 * `ready` turns true once the badges setting is known, so "badges off" never flashes a bar.
 */
function useXpState(memberId: string, wanted: boolean): { ready: boolean; state: XpState | null } {
  const [ready, setReady] = useState(false);
  const [own, setOwn] = useState<{ id: string; state: XpState } | null>(null);
  const on = badgesEnabled.value;

  useEffect(() => {
    let cancelled = false;
    void loadBadgeSettings()
      .then(() => {
        if (cancelled) return null;
        setReady(true);
        return badgesEnabled.value && wanted && memberId ? xpStateFor(memberId) : null;
      })
      .then((state) => {
        if (!cancelled && state) setOwn({ id: memberId, state });
      })
      .catch((e: unknown) => console.error('xpStateFor', e));
    return () => {
      cancelled = true;
    };
  }, [memberId, on, wanted]);

  const memo = xpStates.value.get(memberId) ?? null;
  return { ready, state: memo ?? (own && own.id === memberId ? own.state : null) };
}

export interface XpBarProps {
  memberId: string;
  /** Tighter spacing for use inside another card (same content). */
  compact?: boolean;
}

/**
 * Line 1 (bold) "Level 6 · Oma" with "922 / 970 XP" on the right ("MAX LEVEL · … XP" on level 100),
 * the cobalt bar (role="progressbar"), line 2 (muted small) streak · "nog 48 XP tot level 7".
 */
export function XpBar(props: XpBarProps): JSX.Element | null {
  const { ready, state } = useXpState(props.memberId, true);
  if (!badgesEnabled.value || !ready) return null;
  const cls = 'xp-block' + (props.compact ? ' compact' : '');
  if (!state) {
    return (
      <div class={cls}>
        <span class="muted small">{t('common.loading')}</span>
      </div>
    );
  }

  const max = state.nextAt === null || state.level >= MAX_LEVEL;
  const title = levelTitleText(state.level);
  const right = max ? t('xp.maxLevel', { xp: formatXp(state.total) }) : t('xp.ofNext', { xp: formatXp(state.total), next: formatXp(state.nextAt ?? state.total) });
  const pct = (levelProgress(state) * 100).toFixed(1);
  const parts = [streakText(state, localDayIndex(new Date()))];
  if (!max && state.nextAt !== null) parts.push(t('xp.toNext', { n: formatXp(Math.max(0, state.nextAt - state.total)), level: state.level + 1 }));
  const line2 = parts.filter((p): p is string => !!p).join(' · ');

  return (
    <div class={cls}>
      <div class="xp-head">
        <strong class="xp-title">{title}</strong>
        <span class="xp-of small">{right}</span>
      </div>
      <div
        class="xp-bar"
        role="progressbar"
        aria-label={title}
        aria-valuemin={max ? 0 : state.levelStart}
        aria-valuemax={max ? state.total : (state.nextAt ?? state.total)}
        aria-valuenow={state.total}
        aria-valuetext={right}
      >
        <span class="xp-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {line2 && <div class="xp-sub muted small">{line2}</div>}
    </div>
  );
}

/**
 * The level line on Home (§1b; the content of HomeLevelRow): the profile's avatar circle,
 * "Level 3 · Aardappelschiller", a thin bar and a ›; a tap opens Meer → Profielen. Badges off, no
 * profile or no state loaded yet → null (the slot takes no space).
 */
export function LevelLine(props: { memberId: string }): JSX.Element | null {
  const profile = profiles.value.find((p) => p.id === props.memberId) ?? null;
  const { ready, state } = useXpState(props.memberId, profile !== null);
  if (!badgesEnabled.value || !ready || !profile || !state) return null;
  const pct = (levelProgress(state) * 100).toFixed(1);
  return (
    <a
      class="home-level xp-line"
      href="#/more/profiles"
      onClick={(e) => {
        e.preventDefault();
        navigate('/more/profiles');
      }}
    >
      <Avatar profile={profile} />
      <span class="xp-line-text">{levelTitleText(state.level)}</span>
      <span class="xp-bar thin" aria-hidden="true">
        <span class="xp-bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <span class="chev" aria-hidden="true">
        ›
      </span>
    </a>
  );
}
