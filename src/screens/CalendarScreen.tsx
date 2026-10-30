// '#/more/calendar' — the cooking calendar (docs/specs/xp-levels.md §1j, block 6D-4 = 6D-4b).
// Who cooked what, per day: a month grid Mon–Sun with at most three dots per day in the colours of
// the people who cooked (one dot per person, in the order `calendarMonth` gives the cooks). The local
// cooks come from this phone's cook log; others come from the snapshots received with "Sync mijn
// voortgang" (`progress.snapshots`). The same person locally AND as a snapshot: local wins
// (`calendarMonth`, src/domain/progress.ts). Today has a ring, future days are muted.
// A tap on a day lists "{name} — {recipe}" under the grid (the name from `allRecipes()`; an id this
// phone does not know says "een recept"). Under it the legend: every household member and every
// friend with dot and name, plus (badges on only) "Level n · titel" — live for a profile on this
// phone, from the snapshot for anyone else, then with "· bijgewerkt {date}".
// The calendar is ALWAYS there, also with badges off (it is a log; §5.12): only the levels go.
// Honest at the bottom: others are shown as they last shared (no backend, invariant 14).
// Opening this screen is never a reward moment: it reads (xpStateFor), it never settles XP (§5.11).
//
// Layout styles are inline (this block owns no stylesheet); colours come from the design tokens.
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { badgesEnabled, loadBadgeSettings } from '@/badges';
import { Header } from '@/components/Header';
import { formatShortDate } from '@/components/RecipeRow';
import { useLiveQuery } from '@/db/live';
import { allRecipes, getHousehold, getProgressSnapshots, listCookLog } from '@/db/repo';
import { localDayIndex } from '@/domain/days';
import { DEFAULT_MEMBER_COLOR, membersFrom, type HouseholdSetting } from '@/domain/household';
import { titleFor } from '@/domain/levels';
import { pickText, type CookLogEntry, type Lang } from '@/domain/model';
import { calendarMonth, type CalendarDay, type ProgressSnapshot } from '@/domain/progress';
import { lang, t } from '@/i18n';
import { profiles } from '@/profile';
import { xpStateFor, xpStates } from '@/xp';

const DAY_MS = 86_400_000;
/** At most this many dots under a day number (§1j). */
const MAX_DOTS = 3;

// ---------------------------------------------------------------------------- styles

const S = {
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' },
  navBtn: { minWidth: '44px', minHeight: '44px', justifyContent: 'center', fontSize: '22px' },
  month: { margin: 0, textAlign: 'center', flex: '1 1 auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px' },
  weekday: { textAlign: 'center', fontSize: '13px', color: 'var(--muted)', padding: '4px 0' },
  cell: {
    minHeight: '48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 0 4px',
    border: '2px solid transparent',
    borderRadius: '10px',
    background: 'transparent',
    color: 'var(--ink)',
    font: 'inherit',
    fontSize: '15px',
    lineHeight: 1.1,
    cursor: 'pointer',
  },
  today: { borderColor: 'var(--cobalt)', fontWeight: 700 },
  selected: { background: 'var(--press)' },
  future: { color: 'var(--muted)', opacity: 0.55 },
  dots: { display: 'flex', gap: '3px', minHeight: '8px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', flex: '0 0 auto' },
  dayHead: { margin: '12px 0 4px', fontSize: '16px' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  item: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' },
  legendDot: { width: '12px', height: '12px', borderRadius: '50%', flex: '0 0 auto' },
} satisfies Record<string, JSX.CSSProperties>;

// ---------------------------------------------------------------------------- data

/** Someone who can have dots: a household member (local or not) or a friend. */
interface Person {
  id: string;
  name: string;
  color: string;
  local: boolean;
  /** The received snapshot for a member on another phone or a friend (levels + "bijgewerkt"). */
  snapshot?: ProgressSnapshot;
}

interface CalendarData {
  log: CookLogEntry[];
  snapshots: ProgressSnapshot[];
  household: HouseholdSetting;
}

async function loadCalendarData(): Promise<CalendarData> {
  const [log, snapshots, household] = await Promise.all([listCookLog(), getProgressSnapshots(), getHousehold()]);
  return { log, snapshots: Object.values(snapshots), household };
}

/** Year + 0-based month of today (local); `calendarMonth` gets month + 1. */
function thisMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

function locale(l: Lang): string {
  return l === 'nl' ? 'nl-NL' : 'en-GB';
}

/** First letter upper case ("oktober 2026" → "Oktober 2026"; the rest as Intl wrote it). */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "oktober 2026" / "October 2026". */
function monthLabel(year: number, month: number, l: Lang): string {
  try {
    return capitalize(new Date(Date.UTC(year, month, 1)).toLocaleDateString(locale(l), { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  } catch {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
}

/** "donderdag 30 oktober" / "Thursday 30 October" for a day index (the index is a local calendar day). */
function dayLabel(dayIndex: number, l: Lang): string {
  try {
    return capitalize(new Date(dayIndex * DAY_MS).toLocaleDateString(locale(l), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }));
  } catch {
    return String(new Date(dayIndex * DAY_MS).getUTCDate());
  }
}

/** Day index (days since 1970-01-01) of day `dom` (1-based) of the month. */
function dayIndexOf(year: number, month: number, dom: number): number {
  return Math.floor(Date.UTC(year, month, dom) / DAY_MS);
}

/** Monday = 0 … Sunday = 6 (1970-01-01, day index 0, was a Thursday). */
function weekdayOf(dayIndex: number): number {
  return (((dayIndex + 3) % 7) + 7) % 7;
}

/** The distinct people of one day's cooks, in their order, at most `MAX_DOTS`. */
function dotPeople(cooks: CalendarDay['cooks']): string[] {
  const out: string[] = [];
  for (const c of cooks) {
    if (!out.includes(c.memberId)) out.push(c.memberId);
    if (out.length === MAX_DOTS) break;
  }
  return out;
}

/** The level of everyone local, from the shared memo (asked once, quietly, per profile; badges on only). */
function useLocalLevels(ids: readonly string[]): ReadonlyMap<string, number> {
  const on = badgesEnabled.value;
  const key = ids.join('|');
  useEffect(() => {
    let cancelled = false;
    void loadBadgeSettings()
      .then(() => {
        if (cancelled || !badgesEnabled.value) return;
        for (const id of ids) void xpStateFor(id).catch((e: unknown) => console.error('xpStateFor', e));
      })
      .catch((e: unknown) => console.error('loadBadgeSettings', e));
    return () => {
      cancelled = true;
    };
  }, [key, on]);
  const states = xpStates.value;
  const out = new Map<string, number>();
  for (const id of ids) {
    const s = states.get(id);
    if (s) out.set(id, s.level);
  }
  return out;
}

// ---------------------------------------------------------------------------- screen

export function CalendarScreen() {
  const l = lang.value;
  const [{ year, month }, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState<number | null>(null);
  const data = useLiveQuery<CalendarData | null>(loadCalendarData, [], null);
  const recipes = useLiveQuery(() => allRecipes(), [], []);
  const list = profiles.value;
  const localIds = useMemo(() => list.map((p) => p.id), [list]);
  const localLevels = useLocalLevels(localIds);
  const levelsOn = badgesEnabled.value;

  const recipeNames = useMemo(() => new Map(recipes.map((r) => [r.id, r.name] as const)), [recipes]);

  // Members first (profiles on this phone, then the others), then friends that are not a member.
  const people = useMemo((): Person[] => {
    if (!data) return [];
    const byId = new Map(data.snapshots.map((s) => [s.id, s] as const));
    const out: Person[] = membersFrom(list, data.household).map((m) => {
      const snapshot = m.local ? undefined : byId.get(m.id);
      return { id: m.id, name: m.name, color: m.color || snapshot?.color || DEFAULT_MEMBER_COLOR, local: m.local, ...(snapshot ? { snapshot } : {}) };
    });
    const taken = new Set(out.map((p) => p.id));
    for (const s of data.snapshots) {
      if (s.friend !== true || taken.has(s.id)) continue;
      taken.add(s.id);
      out.push({ id: s.id, name: s.name, color: s.color || DEFAULT_MEMBER_COLOR, local: false, snapshot: s });
    }
    return out;
  }, [data, list]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p] as const)), [people]);

  const days = useMemo((): Map<number, CalendarDay['cooks']> => {
    const out = new Map<number, CalendarDay['cooks']>();
    if (!data) return out;
    // Only people the calendar can name: local cooks of a profile on this phone, snapshots of a
    // member on another phone or a friend (a removed member's snapshot shows no dots).
    const local = data.log.filter((e) => personById.get(e.profileId)?.local === true).map((e) => ({ memberId: e.profileId, recipeId: e.recipeId, at: e.at }));
    const snapshots = people.flatMap((p) => (p.snapshot ? [p.snapshot] : []));
    // calendarMonth counts months 1…12 and gives `day` as the day of the month.
    for (const d of calendarMonth({ year, month: month + 1, local, snapshots, localMemberIds: new Set(localIds) })) {
      if (d.cooks.length) out.set(d.day, d.cooks);
    }
    return out;
  }, [data, people, personById, localIds, year, month]);

  function goMonth(step: number) {
    setSelected(null);
    setMonth(({ year: y, month: m }) => {
      const next = m + step;
      return { year: y + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });
  }

  const today = localDayIndex(new Date());
  const first = dayIndexOf(year, month, 1);
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = weekdayOf(first);
  const weekdays = t('calendar.weekdays').split(' ');
  const selectedCooks = selected !== null ? days.get(selected) ?? [] : [];

  function personName(id: string): string {
    return personById.get(id)?.name ?? '?';
  }

  function recipeName(id: string | null): string {
    const name = id ? recipeNames.get(id) : undefined;
    return (name && pickText(name, l)) || t('calendar.someRecipe');
  }

  /**
   * "Level 6 · Oma" (badges on only), and for a snapshot "· bijgewerkt 12 okt" (how fresh the dots
   * are: not XP, so also with badges off); '' without data.
   */
  function levelLine(p: Person): string {
    const level = !levelsOn ? undefined : p.local ? localLevels.get(p.id) : p.snapshot?.level;
    const parts: string[] = [];
    if (level !== undefined) parts.push(t('xp.levelTitle', { level, title: titleFor(level, l) }));
    if (p.snapshot) parts.push(t('progress.updatedAgo', { date: formatShortDate(p.snapshot.receivedAt, l) }));
    return parts.join(' ');
  }

  return (
    <>
      <Header title={t('more.calendar')} back backLabel={t('common.back')} />
      <div class="screen form">
        <section class="card" style="margin-top:12px">
          <div style={S.nav}>
            <button type="button" class="icon-btn" style={S.navBtn} aria-label={t('calendar.prev')} onClick={() => goMonth(-1)}>
              <span aria-hidden="true">‹</span>
            </button>
            <h2 style={S.month} aria-live="polite">
              {monthLabel(year, month, l)}
            </h2>
            <button type="button" class="icon-btn" style={S.navBtn} aria-label={t('calendar.next')} onClick={() => goMonth(1)}>
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <div style={S.grid} aria-hidden="true">
            {weekdays.map((w) => (
              <span key={w} style={S.weekday}>
                {w}
              </span>
            ))}
          </div>
          {!data ? (
            <p class="muted">{t('common.loading')}</p>
          ) : (
            <div style={S.grid}>
              {Array.from({ length: lead }, (_, i) => (
                <span key={'lead' + i} aria-hidden="true" />
              ))}
              {Array.from({ length }, (_, i) => {
                const dom = i + 1;
                const index = first + i;
                const cooks = days.get(dom) ?? [];
                const style: JSX.CSSProperties = {
                  ...S.cell,
                  ...(index === today ? S.today : null),
                  ...(selected === dom ? S.selected : null),
                  ...(index > today ? S.future : null),
                };
                const who = dotPeople(cooks);
                return (
                  <button
                    key={dom}
                    type="button"
                    style={style}
                    aria-pressed={selected === dom}
                    aria-current={index === today ? 'date' : undefined}
                    aria-label={[dayLabel(index, l), ...who.map(personName)].join(', ')}
                    onClick={() => setSelected(selected === dom ? null : dom)}
                  >
                    <span>{dom}</span>
                    <span style={S.dots} aria-hidden="true">
                      {who.map((id) => (
                        <span key={id} style={{ ...S.dot, background: personById.get(id)?.color ?? DEFAULT_MEMBER_COLOR }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {data && days.size === 0 && <p class="muted small">{t('calendar.emptyMonth')}</p>}
          {data && selected !== null && (
            <div role="region" aria-live="polite">
              <h3 style={S.dayHead}>{dayLabel(first + selected - 1, l)}</h3>
              {selectedCooks.length === 0 ? (
                <p class="muted small">{t('calendar.nothing')}</p>
              ) : (
                <ul style={S.list}>
                  {selectedCooks.map((c, i) => (
                    <li key={i} style={S.item}>
                      <span style={{ ...S.legendDot, background: personById.get(c.memberId)?.color ?? DEFAULT_MEMBER_COLOR }} aria-hidden="true" />
                      <span>
                        {personName(c.memberId)} — {recipeName(c.recipeId)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {people.length > 0 && (
          <section class="card">
            <ul style={S.list}>
              {people.map((p) => {
                const level = levelLine(p);
                return (
                  <li key={p.id} style={S.item}>
                    <span style={{ ...S.legendDot, background: p.color }} aria-hidden="true" />
                    <span>
                      <strong>{p.name}</strong>
                      {level && (
                        <>
                          {' '}
                          <span class="muted small">{level}</span>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p class="muted small">{t('calendar.honest')}</p>
      </div>
    </>
  );
}
