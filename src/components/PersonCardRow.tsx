// One received person (docs/specs/verbeterronde-1c.md, block V1c-2 §1b): who someone is (`#f=`,
// `MemberCard`) or their progress (`#x=`, `ProgressCard`). Replaces the former MemberCardRow and
// ProgressCardRow of HouseholdScreen; used by Huishouden & vrienden (the add panel, with the role
// already chosen) and by In & uit (no role: both "Voeg toe als huisgenoot" and "Voeg toe als vriend").
//   - status 'new': with `role` one button "Voeg {name} toe als {rol}", without `role` two buttons;
//   - status 'known': "Werk {name} bij" (a card never changes the role, src/people.ts applyPersonCard);
//   - status 'local' (a profile on this phone): for a progress the V1c-9 restore logic ("Herstel mijn
//     voortgang", taken over literally from ProgressCardRow), for who-I-am the line `people.cardLocal`.
import { useEffect, useState } from 'preact/hooks';
import { badgesEnabled, loadBadgeSettings } from '@/badges';
import { formatShortDate } from '@/components/RecipeRow';
import { formatXp, levelTitleText } from '@/components/XpBar';
import { dayFromKey, dayIndexOfIso, localDayIndex } from '@/domain/days';
import { matchMemberForCard, roleOf, type Member, type MemberCard, type MemberRole } from '@/domain/household';
import type { ProgressCard } from '@/domain/share';
import { t } from '@/i18n';
import { cardStatus } from '@/people';
import { Avatar } from '@/screens/ProfilesScreen';
import { xpStateFor } from '@/xp';

/** What happened to a received person: added, updated, nothing (a profile here), or (V1c-9) the own progress restored. */
export type PersonOutcome = 'added' | 'updated' | 'local' | 'restored';

/** V1c-9: what `restoreProgress` reported, for the line "Voortgang hersteld: level N, … kookdagen en … badges teruggezet." */
export interface RestoredInfo {
  level: number;
  cookDaysAdded: number;
  badgesAdded: number;
}

/** V1c-9 §1b: "Voortgang hersteld: …" for a finished restore. */
export function restoredText(r: RestoredInfo): string {
  return t('progress.restored', { level: formatXp(r.level), days: formatXp(r.cookDaysAdded), badges: formatXp(r.badgesAdded) });
}

/** The `badges.enabled` setting once known: 'loading' until then (V1c-9: no "zet Badges aan" line flashes by). */
export function useBadgesState(): 'loading' | 'on' | 'off' {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadBadgeSettings().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return !ready ? 'loading' : badgesEnabled.value ? 'on' : 'off';
}

/**
 * Cook days of the card in the 30 days up to the day it was shared (the envelope's `at`; today when
 * the share carries no date), that day included: "{n} kookdagen in de laatste 30 dagen".
 */
export function cookDaysIn30(card: Pick<ProgressCard, 'cookDays'>, sentAt?: string): number {
  const end = (sentAt ? dayIndexOfIso(sentAt) : null) ?? localDayIndex(new Date());
  let n = 0;
  for (const c of card.cookDays) {
    const day = dayFromKey(c.d);
    if (day !== null && day <= end && day > end - 30) n++;
  }
  return n;
}

function isProgress(card: MemberCard | ProgressCard): card is ProgressCard {
  return 'xp' in card;
}

/** "huisgenoot" / "vriend" for "Voeg {name} toe als {role}". */
function roleWord(role: MemberRole): string {
  return t(role === 'friend' ? 'people.roleFriend' : 'people.roleHousemate');
}

export interface PersonCardRowProps {
  card: MemberCard | ProgressCard;
  /** The envelope's `at` (a progress). */
  sentAt?: string;
  members: readonly Member[];
  /** The role chosen in the add panel; absent (In & uit) = both add buttons. */
  role?: MemberRole;
  done?: PersonOutcome;
  /** V1c-9: what the restore reported (with `done` 'restored'). */
  restored?: RestoredInfo;
  busy?: boolean;
  onAdd: (card: MemberCard | ProgressCard, role: MemberRole) => void;
  /** V1c-9: "Herstel mijn voortgang" on a progress of a profile on this phone (confirmed already). */
  onRestore?: (card: ProgressCard, profileId: string) => void;
  /** After added/updated: the button "Naar huishouden" (In & uit). */
  onOpenHousehold?: () => void;
}

export function PersonCardRow(props: PersonCardRowProps) {
  const { card } = props;
  const progress = isProgress(card) ? card : null;
  const badges = useBadgesState();
  const badgesOn = badges === 'on';
  const status = props.done === 'local' ? 'local' : cardStatus(props.members, card);
  // V1c-9 §1b: a card of a profile on this phone (by id or name — the member's id is the profile id).
  const matched = matchMemberForCard(props.members, card);
  const localMember = status === 'local' ? matched : undefined;
  const profileId = localMember?.local ? localMember.id : null;
  // The profile's current total and level, read quietly (an effect); null while unknown.
  const [current, setCurrent] = useState<{ total: number; level: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setCurrent(null);
    if (!progress || !profileId || !badgesOn || !props.onRestore) return;
    xpStateFor(profileId).then(
      (st) => {
        if (!cancelled) setCurrent({ total: st.total, level: st.level });
      },
      (e: unknown) => console.error('xpStateFor', e),
    );
    return () => {
      cancelled = true;
    };
  }, [profileId, badgesOn, card.id, progress?.xp, props.done, !!props.onRestore]);
  const name = card.name;
  const sent = formatShortDate(props.sentAt);

  // The role of the person as stored now (after an add: the role it was added with).
  const addedRole: MemberRole = matched && !matched.local ? roleOf(matched) : (props.role ?? 'housemate');
  const doneText =
    props.done === 'updated'
      ? t('progress.updated', { name })
      : props.done === 'added'
        ? t(addedRole === 'friend' ? 'people.addedFriend' : 'people.addedHousemate', { name })
        : props.done === 'restored' && props.restored
          ? restoredText(props.restored)
          : '';

  /** V1c-9 §1b: the 'local' part of a progress — badges off, nothing to restore, or the hint with the restore button. */
  function localProgressPart(p: ProgressCard) {
    if (profileId && props.onRestore) {
      if (badges === 'off') return <p class="muted small">{t('progress.restoreBadgesOff')}</p>;
      if (badgesOn && current && p.xp > current.total) {
        const pid = profileId;
        const restore = () => {
          if (!confirm(t('progress.restoreConfirm', { cardLevel: formatXp(p.level) }))) return;
          props.onRestore?.(p, pid);
        };
        return (
          <div class="actions">
            <p class="muted small progress-restore-hint">
              {t('progress.restoreHint', {
                date: sent,
                cardLevel: formatXp(p.level),
                xp: formatXp(p.xp),
                badges: formatXp(p.badges.length),
                days: formatXp(p.cookDays.length),
                level: formatXp(current.level),
              })}
            </p>
            <button type="button" class="btn btn-primary btn-block" disabled={props.busy} onClick={restore}>
              {t('progress.restoreBtn')}
            </button>
          </div>
        );
      }
    }
    // Not this phone's own profile, the total still loading, or card.xp ≤ the current total: nothing to restore.
    return <p class="muted small">{t('progress.local', { name })}</p>;
  }

  function addButtons() {
    if (props.role) {
      const role = props.role;
      return (
        <div class="actions">
          <button type="button" class="btn btn-primary btn-block" disabled={props.busy} onClick={() => props.onAdd(card, role)}>
            {t('people.addAs', { name, role: roleWord(role) })}
          </button>
        </div>
      );
    }
    return (
      <div class="actions">
        <button type="button" class="btn btn-primary btn-block" disabled={props.busy} onClick={() => props.onAdd(card, 'housemate')}>
          {t('people.addAsHousemate')}
        </button>
        <button type="button" class="btn btn-block" disabled={props.busy} onClick={() => props.onAdd(card, 'friend')}>
          {t('people.addAsFriend')}
        </button>
      </div>
    );
  }

  let line3 = '';
  if (progress) {
    const cookDays = cookDaysIn30(progress, props.sentAt);
    line3 = [cookDays === 1 ? t('progress.cookDays30One') : t('progress.cookDays30', { n: formatXp(cookDays) }), sent ? t('progress.sentAt', { date: sent }) : '']
      .filter((s) => s !== '')
      .join(' · ');
  }

  return (
    <div class={'member-card-row' + (progress ? ' progress-card-row' : '')}>
      <div class="member-card-head">
        <Avatar profile={card} />
        <div class="who">
          <strong>{name}</strong>
          {progress ? (
            <>
              <span class="muted small">{t('progress.from', { name })}</span>
              {badgesOn && (
                <span class="muted small">
                  {levelTitleText(progress.level)} · {progress.badges.length === 1
                    ? t('progress.streakBadgesOne', { streak: formatXp(progress.streak) })
                    : t('progress.streakBadges', { streak: formatXp(progress.streak), badges: formatXp(progress.badges.length) })}
                </span>
              )}
              <span class="muted small">{line3}</span>
            </>
          ) : (
            <span class="muted small">{t('people.cardIdentity', { name })}</span>
          )}
        </div>
      </div>
      {props.done && props.done !== 'local' ? (
        <>
          <p class="ok small">{doneText}</p>
          {props.onOpenHousehold && props.done !== 'restored' && (
            <div class="actions">
              <button type="button" class="btn" onClick={props.onOpenHousehold}>
                {t('household.toHousehold')} ›
              </button>
            </div>
          )}
        </>
      ) : status === 'local' ? (
        progress ? (
          localProgressPart(progress)
        ) : (
          <p class="muted small">{t('people.cardLocal')}</p>
        )
      ) : status === 'known' ? (
        <div class="actions">
          <button type="button" class="btn btn-primary btn-block" disabled={props.busy} onClick={() => props.onAdd(card, props.role ?? (matched ? roleOf(matched) : 'housemate'))}>
            {t('people.update', { name })}
          </button>
          {/* V2 §1c: what the update of a progress brings along (the card's avatar too). */}
          {progress && <p class="muted small progress-update-hint">{t('progress.updateHint')}</p>}
        </div>
      ) : (
        addButtons()
      )}
    </div>
  );
}
