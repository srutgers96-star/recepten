// The Home card "Deze week", compact (docs/specs/home-a-plus.md §1i, Home A+ block 2).
// No slots → the existing empty card "Kies 7 voor deze week" (→ Week), unchanged; 6C block 2 adds
// the text link `home.weekEmptyStanding` there later. Otherwise `.card.week-card.compact`:
// - title row: "Deze week ›" (→ Week) with "{n} van {total} gekookt" on the right, also at 0;
// - one line of names (→ Week): uncooked first in plan order, then the cooked ones struck through,
//   at most 3 names + "+N", joined with " · " (`weekNames` + `weekLine`, src/domain/tonight.ts);
//   CSS ellipsizes the names as a safety net, never the "+N" (own span, decision Fable 23 Oct);
// - the button as before: all cooked → secondary "Alles gekookt — kies nieuwe?" (→ Week), else
//   primary "Boodschappenlijst" (→ Shopping).
// 6B blok 4 (docs/specs/labels-categorieen.md §1d): the card names only the main dishes; a side dish
// ("+ bijgerecht", `PlanItem.sideOf`) follows its main and is neither named nor counted here.
import { Fragment, type JSX } from 'preact';
import { pickText, type Recipe } from '@/domain/model';
import { mainItems, type Plan } from '@/domain/planner';
import { weekLine, weekNames, weekProgress } from '@/domain/tonight';
import { lang, t } from '@/i18n';
import { navigateTab } from '@/router';

function toWeek(e: Event) {
  e.preventDefault();
  navigateTab('/week');
}

export function WeekCard(props: { plan: Plan; byId: ReadonlyMap<string, Recipe> }): JSX.Element {
  const { plan, byId } = props;
  const l = lang.value;

  if (plan.items.length === 0) {
    return (
      <a class="card week-card week-card-empty" href="#/week" onClick={toWeek}>
        <span class="week-card-icon" aria-hidden="true">
          🗓️
        </span>
        <span class="week-card-text">
          <strong>{t('home.weekEmpty')}</strong>
          <span class="muted small">{t('home.weekEmptyHint')}</span>
        </span>
        <span class="chev" aria-hidden="true">
          ›
        </span>
      </a>
    );
  }

  // Main dishes only: the line and "n van total gekookt" leave the side dishes out.
  const mains: Plan = { ...plan, items: mainItems(plan.items) };
  const { total, cooked } = weekProgress(mains);
  const allCooked = total > 0 && cooked === total;
  const { shown, more } = weekLine(weekNames(mains, byId, (r) => pickText(r.name, l)));

  return (
    <section class="card week-card compact">
      <h2 class="week-card-title">
        <a href="#/week" onClick={toWeek}>
          {t('home.week')} <span class="chev" aria-hidden="true">›</span>
        </a>
        <span class="muted">{t('week.cookedOf', { n: cooked, total })}</span>
      </h2>
      {shown.length > 0 && (
        <a class="week-line" href="#/week" onClick={toWeek}>
          <span class="week-line-names">
            {shown.map((n, i) => (
              <Fragment key={i}>
                {i > 0 && ' · '}
                <span class={n.cooked ? 'cooked' : undefined}>{n.name}</span>
              </Fragment>
            ))}
          </span>
          {more > 0 && <span class="week-line-more">{' · ' + t('home.weekMore', { n: more })}</span>}
        </a>
      )}
      <div class="week-card-actions">
        {allCooked ? (
          <button type="button" class="btn btn-secondary btn-block" onClick={() => navigateTab('/week')}>
            {t('home.weekAllCooked')}
          </button>
        ) : (
          <button type="button" class="btn btn-primary btn-block" onClick={() => navigateTab('/shopping')}>
            {t('home.weekList')}
          </button>
        )}
      </div>
    </section>
  );
}
