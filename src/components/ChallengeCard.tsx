// The card "🎯 Uitdaging" on Mijn profiel (docs/specs/challenges.md §1b–§1e, block 6E), under the XP
// bar and above the tiles; ProfileScreen only mounts it for the active profile with badges on and the
// unlock `challenges` active (level 20), and only when that member's own level is >= 20. All state
// lives in src/challenges.ts (bouwer B); this file only shows it:
// - no running challenge: the line `challenge.pick` and the button Kies → <ChallengeOfferSheet/> with
//   this week's three (`challengeOffer`); Start → `startChallenge(id)`, the sheet closes. After a term
//   ran out without the goal, the quiet line `challenge.expired` sits above it (no toast, no XP).
// - a running challenge: icon + name, the description with the goal filled in, a progress bar
//   ("2 van 3", always derived from the facts by src/challenges.ts, never added up here), the time left
//   ("nog 4 dagen", "laatste dag"; further away "tot 30 nov") and the reward. A small Opgeven asks for
//   confirmation first, then `giveUp()`: no history row, no penalty, the offer of the week stays.
//   Reaching the goal (toast, confetti 'challenge', XP pop) is settleChallenges' job, not this card's.
// - under it, when anything was done: a folding row "Gehaald: {n}" with the last five (name, date, XP).
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import {
  activeChallenge,
  challengeById,
  challengeExpired,
  challengeOffer,
  challengeProgress,
  doneChallenges,
  giveUp,
  offerDeadline,
  startChallenge,
} from '@/challenges';
import { formatShortDate } from '@/components/RecipeRow';
import type { Challenge, ChallengeRule, ChallengeTerm } from '@/domain/challenges';
import { dayIndexOfIso, localDayIndex } from '@/domain/days';
import { lang, t } from '@/i18n';
import { ChallengeOfferSheet } from './ChallengeOfferSheet';
import { formatXp } from './XpBar';

/** How many done challenges the folding history shows (§1e). */
export const HISTORY_ROWS = 5;

/** The goal of a rule, as `{n}` in the names and descriptions of data/challenges.json. */
function goalOf(rule: ChallengeRule): number | null {
  if ('n' in rule) return rule.n;
  if (rule.kind === 'categories') return rule.categories.length;
  return null;
}

function fillGoal(text: string, rule: ChallengeRule): string {
  const n = goalOf(rule);
  return n === null ? text : text.replace(/\{n\}/g, String(n));
}

export function challengeName(c: Challenge): string {
  return fillGoal(c[lang.value].name, c.rule);
}

export function challengeDescription(c: Challenge): string {
  return fillGoal(c[lang.value].description, c.rule);
}

export function rewardText(xp: number): string {
  return t('challenge.reward', { xp: formatXp(xp) });
}

export function weightText(weight: number): string {
  return t('challenge.weight', { n: weight });
}

/**
 * The season whose window ends on the day of `deadline` (data/badges.json: winter ends 19 Mar,
 * spring 20 Jun, summer 22 Sep, autumn 20 Dec; termDeadline picks the longest window, so one of
 * these four); null for any other day (then the offer says "tot {date}").
 */
const SEASON_ENDS: Record<string, string> = { '3-19': 'winter', '6-20': 'spring', '9-22': 'summer', '12-20': 'autumn' };

function seasonEndingOn(deadline: Date): string | null {
  return SEASON_ENDS[`${deadline.getMonth() + 1}-${deadline.getDate()}`] ?? null;
}

/** The term of a challenge in the offer: "tot zondag", "tot 30 nov", "hele winter". */
export function termText(term: ChallengeTerm, deadline: string = offerDeadline(term)): string {
  if (term === 'week') return t('challenge.untilSunday');
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return '';
  if (term === 'season') {
    const season = seasonEndingOn(d);
    if (season) return t('challenge.wholeSeason', { season: t('challenge.season.' + season) });
  }
  return t('challenge.until', { date: formatShortDate(deadline) });
}

/** The time left of a running challenge: "nog 4 dagen", "nog 1 dag", "laatste dag"; beyond a week "tot 30 nov". */
export function timeLeftText(deadline: string, now: Date = new Date()): string {
  const end = dayIndexOfIso(deadline);
  if (end === null) return '';
  const left = end - localDayIndex(now);
  if (left <= 0) return t('challenge.lastDay');
  if (left === 1) return t('challenge.dayLeft');
  if (left <= 7) return t('challenge.daysLeft', { n: left });
  return t('challenge.until', { date: formatShortDate(deadline) });
}

export function ChallengeCard(props: { memberId: string }): JSX.Element {
  const [sheet, setSheet] = useState(false);
  const active = activeChallenge.value;
  const challenge = active ? challengeById(active.id) : undefined;
  const progress = active ? challengeProgress.value : null;
  const done = doneChallenges.value.filter((d) => d.memberId === props.memberId);
  const recent = [...done].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, HISTORY_ROWS);

  function onGiveUp() {
    if (!confirm(t('challenge.giveUpConfirm'))) return;
    void giveUp();
  }

  return (
    <section class="card challenge-card" aria-labelledby="challenge-title">
      <h2 id="challenge-title" class="challenge-title">
        {t('challenge.title')}
      </h2>

      {active && challenge ? (
        <div class="challenge-running">
          <div class="challenge-running-top">
            <span class="challenge-icon" aria-hidden="true">
              {challenge.icon}
            </span>
            <strong class="challenge-name">{challengeName(challenge)}</strong>
            <span class="challenge-reward small">{rewardText(challenge.xp)}</span>
          </div>
          <p class="challenge-desc muted small">{challengeDescription(challenge)}</p>
          {progress && <ChallengeBar current={progress.current} target={progress.target} />}
          <div class="challenge-foot">
            <span class="muted small">
              {progress && t('challenge.progress', { current: Math.min(progress.current, progress.target), target: progress.target })}
              {progress && ' · '}
              {timeLeftText(active.deadline)}
            </span>
            <button type="button" class="btn btn-small challenge-giveup" onClick={onGiveUp}>
              {t('challenge.giveUp')}
            </button>
          </div>
        </div>
      ) : (
        <div class="challenge-empty">
          {challengeExpired.value && <p class="challenge-expired muted small">{t('challenge.expired')}</p>}
          <p class="challenge-pick">{t('challenge.pick')}</p>
          <button type="button" class="btn btn-primary challenge-choose" disabled={challengeOffer.value.length === 0} onClick={() => setSheet(true)}>
            {t('challenge.choose')}
          </button>
        </div>
      )}

      {done.length > 0 && (
        <details class="challenge-history">
          <summary>{t('challenge.history', { n: done.length })}</summary>
          <ul>
            {recent.map((d) => {
              const c = challengeById(d.id);
              return (
                <li key={d.id + '@' + d.startedAt} class="challenge-history-row">
                  <span class="challenge-history-name">{c ? challengeName(c) : d.id}</span>
                  <span class="muted small">{t('challenge.historyRow', { date: formatShortDate(d.finishedAt), xp: formatXp(d.xp) })}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {sheet && (
        <ChallengeOfferSheet
          offer={challengeOffer.value}
          onClose={() => setSheet(false)}
          onStart={(id) => {
            setSheet(false);
            void startChallenge(id);
          }}
        />
      )}
    </section>
  );
}

function ChallengeBar(props: { current: number; target: number }): JSX.Element {
  const { current, target } = props;
  const shown = Math.min(Math.max(0, current), target);
  const pct = target > 0 ? ((shown / target) * 100).toFixed(1) : '0';
  const text = t('challenge.progress', { current: shown, target });
  return (
    <div class="challenge-bar" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={shown} aria-valuetext={text}>
      <span class="challenge-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
