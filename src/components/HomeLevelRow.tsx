// The slot under the Home greeting (docs/specs/home-a-plus.md §1c). Until 6D it shows one thin line
// "🏆 Badges 7/40 ›" for the active profile (tap → '#/more/badges'). It reads badgesEnabled /
// loadBadgeSettings / badgeStatuses (src/badges.ts) itself and renders null when badges are off,
// there is no profile or the count has not loaded yet, so the line takes no space then (PLAN.md §0:
// gamification never in the way). 6D-1 replaces only the CONTENT of this file with `LevelLine`;
// HomeScreen does not change.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { badgeStatuses, badgesEnabled, loadBadgeSettings } from '@/badges';
import { t } from '@/i18n';
import { navigate } from '@/router';

export function HomeLevelRow(props: { profileId: string }): JSX.Element | null {
  const pid = props.profileId;
  const badgesOn = badgesEnabled.value;
  const [count, setCount] = useState<{ earned: number; total: number } | null>(null);

  useEffect(() => {
    // A new profile (or badges switched back on) starts as "not loaded yet": no stale count.
    setCount(null);
    if (!badgesOn || !pid) return;
    let cancelled = false;
    void loadBadgeSettings()
      .then(() => (badgesEnabled.value ? badgeStatuses(pid) : null))
      .then((list) => {
        if (!cancelled && list) setCount({ earned: list.filter((s) => s.earned).length, total: list.length });
      })
      .catch((e: unknown) => console.error('badgeStatuses', e));
    return () => {
      cancelled = true;
    };
  }, [badgesOn, pid]);

  if (!badgesOn || !pid || !count) return null;
  return (
    <a
      class="home-level"
      href="#/more/badges"
      onClick={(e) => {
        e.preventDefault();
        navigate('/more/badges');
      }}
    >
      <span aria-hidden="true">🏆</span>
      <span>
        {t('home.badges')} {count.earned}/{count.total}
      </span>
      <span class="chev" aria-hidden="true">
        ›
      </span>
    </a>
  );
}
