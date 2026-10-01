// '#/' — Home "Vanavond?": greeting, "Verras me" (with optional filter chips that constrain the
// dice), the categories shelf, favourites chips (per profile), recently cooked, own & received
// recipes and the story link (docs/phase-1-spec.md §5, phase-2-spec.md §5). Phase 4: the "Deze
// week" card (names max 5 + "+N", Boodschappenlijst; empty → "Kies 7 voor deze week") replaced
// the planner teaser.
// Phase 3: two muted reminder cards under the greeting — backup overdue (> 30 days of unbacked
// changes) → Opslag, and unsent changes (a partner in 'share.lastSentTo' is behind) → Stuur nieuwe.
// Phase 4: a third one for unseen Inbox items (the Inbox tab moved under Meer, spec §3); the dice
// chips are the generic `PickChips` (spec §0); "+" in the "Eigen & ontvangen" header opens '/add'.
// Phase 5 (docs/phase-5-spec.md A-bis.8): "Selecteer" next to that title and a long-press on one
// of its rows open the Recipes screen in select mode ('#/recipes?select=1[&id=…]').
// Phase 5 block C: a compact "Badges 7/40" link-card (active profile) when badges are enabled.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { badgeStatuses, badgesEnabled, loadBadgeSettings } from '@/badges';
import { CategoryShelf } from '@/components/CategoryShelf';
import { Header } from '@/components/Header';
import { PickChips, applyPickFilter, loadPickFilter, pickFilterActive, savePickFilter, tagIdsIn, type PickFilter } from '@/components/PickSheet';
import { RecipeRow, formatShortDate, otherLanguageName } from '@/components/RecipeRow';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { allRecipes, getPlan, listFavorites, recentCooked, userRecipes } from '@/db/repo';
import { dictionary } from '@/dictionary';
import { pickText, type Recipe } from '@/domain/model';
import { lang, t } from '@/i18n';
import { backupStatus, inboxUnseen, refreshShareBadges, unsentChanges } from '@/inbox-badge';
import { activeProfile, profiles } from '@/profile';
import { navigate, navigateTab } from '@/router';

// Module-level so the suggestion stays the same when you come back to Home (reroll changes it).
let surpriseId: string | null = null;

/** The dice filters survive a reload (own key: the list has its own selection). */
const SURPRISE_FILTERS_KEY = 'recepten.surpriseFilters';

function pickRandom(list: Recipe[], not: string | null): string | null {
  if (!list.length) return null;
  if (list.length === 1) return list[0]?.id ?? null;
  let pick: Recipe | undefined;
  do pick = list[Math.floor(Math.random() * list.length)];
  while (!pick || pick.id === not);
  return pick.id;
}

function openRecipe(id: string) {
  navigate('/recipe/' + id);
}

export function HomeScreen() {
  const l = lang.value;
  const profile = activeProfile.value;
  const pid = profile?.id ?? '';
  const all = useLive(allRecipes, []);
  const favs = useLive(() => (pid ? listFavorites(pid) : Promise.resolve(new Set<string>())), [pid]);
  const cooked = useLive(() => recentCooked(undefined, 5), []);
  const own = useLive(userRecipes, []);
  const plan = useLive(getPlan, []);
  const [, bump] = useState(0);
  const [filters, setFilters] = useState<PickFilter>(() => loadPickFilter(SURPRISE_FILTERS_KEY));
  const backup = backupStatus.value;
  const unsent = unsentChanges.value;
  const unseen = inboxUnseen.value;
  const dict = dictionary.value;

  useEffect(() => {
    void refreshShareBadges();
  }, []);

  // Phase 5 block C: the compact "Badges 7/40" link-card for the active profile. Badges off =
  // the card is gone entirely (PLAN.md §0: gamification never in the way).
  const badgesOn = badgesEnabled.value;
  const [badgeCount, setBadgeCount] = useState<{ earned: number; total: number } | null>(null);
  useEffect(() => {
    if (!badgesOn || !pid) {
      setBadgeCount(null);
      return;
    }
    let cancelled = false;
    void loadBadgeSettings()
      .then(() => (badgesEnabled.value ? badgeStatuses(pid) : null))
      .then((list) => {
        if (!cancelled && list) setBadgeCount({ earned: list.filter((s) => s.earned).length, total: list.length });
      })
      .catch((e: unknown) => console.error('badgeStatuses', e));
    return () => {
      cancelled = true;
    };
  }, [badgesOn, pid]);

  const byId = useMemo(() => new Map((all ?? []).map((r) => [r.id, r] as const)), [all]);
  const tags = useMemo(() => tagIdsIn(all ?? []), [all]);
  // The dice only rolls over recipes that match the chips; the pick is re-rolled when it drops out.
  const pool = useMemo(() => applyPickFilter(all ?? [], filters, dict, l), [all, filters, dict, l]);
  const poolIds = useMemo(() => new Set(pool.map((r) => r.id)), [pool]);
  if (pool.length && (!surpriseId || !poolIds.has(surpriseId))) surpriseId = pickRandom(pool, null);
  const surprise = surpriseId && poolIds.has(surpriseId) ? byId.get(surpriseId) : undefined;
  const surpriseAlt = surprise ? otherLanguageName(surprise, l) : null;
  const filtering = pickFilterActive(filters);

  function changeFilters(next: PickFilter) {
    setFilters(next);
    savePickFilter(SURPRISE_FILTERS_KEY, next);
  }

  const favList = useMemo(() => {
    if (!favs || !all) return [];
    return all.filter((r) => favs.has(r.id)).sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), l));
  }, [favs, all, l]);

  const ownList = useMemo(() => (own ? [...own].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5) : []), [own]);
  const profileName = (id: string) => profiles.value.find((p) => p.id === id)?.name ?? '';

  // "Deze week" card (phase 4): the plan's dishes, cooked ones struck through, max 5 + "+N".
  const planItems = plan?.items ?? [];
  const planShown = planItems.slice(0, 5);
  const planMore = planItems.length - planShown.length;
  const planAllCooked = planItems.length > 0 && planItems.every((p) => p.cooked);

  return (
    <>
      <Header title={t('home.title')} />
      <TimerBar />
      <div class="screen home">
        <h2 class="home-greeting">{profile ? t('home.greeting', { name: profile.name }) : t('home.greetingAnon')}</h2>

        {backup?.overdue && (
          <a
            class="card reminder"
            href="#/more/storage"
            onClick={(e) => {
              e.preventDefault();
              navigate('/more/storage');
            }}
          >
            <span class="reminder-icon" aria-hidden="true">
              💾
            </span>
            <span class="reminder-text">
              {t(backup.lastBackupAt ? 'home.backupOverdue' : 'home.backupNever', { n: backup.unbackedChanges })}
              <span class="reminder-action">{t('home.backupAction')} ›</span>
            </span>
          </a>
        )}
        {unsent > 0 && (
          <a
            class="card reminder"
            href="#/share"
            onClick={(e) => {
              e.preventDefault();
              navigate('/share');
            }}
          >
            <span class="reminder-icon" aria-hidden="true">
              📤
            </span>
            <span class="reminder-text">
              {unsent === 1 ? t('home.unsentOne') : t('home.unsent', { n: unsent })}
              <span class="reminder-action">{t('home.unsentAction')} ›</span>
            </span>
          </a>
        )}
        {unseen > 0 && (
          <a
            class="card reminder"
            href="#/inbox"
            onClick={(e) => {
              e.preventDefault();
              navigate('/inbox');
            }}
          >
            <span class="reminder-icon" aria-hidden="true">
              📥
            </span>
            <span class="reminder-text">
              {unseen === 1 ? t('home.inboxUnseenOne') : t('home.inboxUnseen', { n: unseen })}
              <span class="reminder-action">{t('home.inboxAction')} ›</span>
            </span>
          </a>
        )}

        {plan !== undefined &&
          (planItems.length === 0 ? (
            <a
              class="card week-card week-card-empty"
              href="#/week"
              onClick={(e) => {
                e.preventDefault();
                navigateTab('/week');
              }}
            >
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
          ) : (
            <section class="card week-card">
              <h2 class="week-card-title">
                <a
                  href="#/week"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTab('/week');
                  }}
                >
                  {t('home.week')} <span class="chev" aria-hidden="true">›</span>
                </a>
              </h2>
              <ul class="week-card-list">
                {planShown.map((p) => {
                  const r = byId.get(p.recipeId);
                  return (
                    <li key={p.id} class={p.cooked ? 'cooked' : ''}>
                      <a
                        href={'#/recipe/' + p.recipeId}
                        onClick={(e) => {
                          e.preventDefault();
                          openRecipe(p.recipeId);
                        }}
                      >
                        {r ? pickText(r.name, l) : p.recipeId}
                      </a>
                    </li>
                  );
                })}
                {planMore > 0 && (
                  <li class="week-card-more">
                    <a
                      href="#/week"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateTab('/week');
                      }}
                    >
                      {t('home.weekMore', { n: planMore })}
                    </a>
                  </li>
                )}
              </ul>
              <div class="week-card-actions">
                {planAllCooked ? (
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
          ))}

        <section class="card surprise">
          <div class="muted small">{t('home.surprise')}</div>
          <PickChips filter={filters} onChange={changeFilters} tags={tags} noQuery />
          {surprise ? (
            <>
              <button type="button" class="surprise-name" onClick={() => openRecipe(surprise.id)}>
                {pickText(surprise.name, l)}
                {surpriseAlt && <span class="surprise-alt">{surpriseAlt}</span>}
              </button>
              <div class="surprise-actions">
                <button type="button" class="btn btn-primary" onClick={() => openRecipe(surprise.id)}>
                  {t('home.open')}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  onClick={() => {
                    surpriseId = pickRandom(pool, surpriseId);
                    bump((n) => n + 1);
                  }}
                >
                  <span aria-hidden="true">🎲</span> {t('home.reroll')}
                </button>
              </div>
            </>
          ) : all && filtering ? (
            <div class="muted">{t('home.noMatch')}</div>
          ) : (
            <div class="muted">{t('common.loading')}</div>
          )}
        </section>

        <CategoryShelf recipes={all ?? []} />

        <section class="home-section">
          <h2>{t('home.favorites')}</h2>
          {favList.length === 0 ? (
            <p class="muted">{t('home.noFavorites')}</p>
          ) : (
            <div class="chips">
              {favList.map((r) => (
                <a
                  key={r.id}
                  class="chip"
                  href={'#/recipe/' + r.id}
                  onClick={(e) => {
                    e.preventDefault();
                    openRecipe(r.id);
                  }}
                >
                  <span class="star on" aria-hidden="true">
                    ★
                  </span>
                  {pickText(r.name, l)}
                </a>
              ))}
            </div>
          )}
        </section>

        <section class="home-section">
          <h2>{t('home.recentCooked')}</h2>
          {!cooked || cooked.length === 0 ? (
            <p class="muted">{t('home.noCooked')}</p>
          ) : (
            <div class="cooked-list">
              {cooked.map((e) => {
                const r = byId.get(e.recipeId);
                const who = profileName(e.profileId);
                return (
                  <a
                    key={e.id ?? `${e.recipeId}|${e.at}`}
                    class="cooked-row"
                    href={'#/recipe/' + e.recipeId}
                    onClick={(ev) => {
                      ev.preventDefault();
                      openRecipe(e.recipeId);
                    }}
                  >
                    <span class="name">{r ? pickText(r.name, l) : e.recipeId}</span>
                    <span class="meta">
                      {e.stars ? `★ ${e.stars} · ` : ''}
                      {formatShortDate(e.at, l)}
                      {who ? ` · ${who}` : ''}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        <section class="home-section">
          <h2>
            <span class="home-section-title">{t('home.ownReceived')}</span>
            {/* Phase 5 (A-bis.8): select mode lives on the Recipes screen; this opens it (long-press
                on a row below preselects that recipe). */}
            {ownList.length > 0 && (
              <a
                class="home-select"
                href="#/recipes?select=1"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/recipes?select=1');
                }}
              >
                {t('select.enter')}
              </a>
            )}
            <a
              class="home-add"
              href="#/add"
              aria-label={t('list.add')}
              onClick={(e) => {
                e.preventDefault();
                navigate('/add');
              }}
            >
              +
            </a>
            {own && own.length > 5 && (
              <a
                href="#/recipes"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTab('/recipes');
                }}
              >
                {t('home.allRecipes')}
              </a>
            )}
          </h2>
          {ownList.length === 0 ? (
            <>
              <p class="muted">{t('home.noOwn')}</p>
              <div class="actions">
                <a
                  class="btn btn-small"
                  href="#/add"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/add');
                  }}
                >
                  {t('home.addFirst')}
                </a>
              </div>
            </>
          ) : (
            <ul class="list">
              {ownList.map((r) => (
                <li key={r.id}>
                  <RecipeRow recipe={r} favorite={favs?.has(r.id)} subtitle={formatShortDate(r.updatedAt, l)} onLongPress={(x) => navigate('/recipes?select=1&id=' + encodeURIComponent(x.id))} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {badgesOn && badgeCount && (
          <a
            class="card link-card badges-card"
            href="#/more/badges"
            onClick={(e) => {
              e.preventDefault();
              navigate('/more/badges');
            }}
          >
            <span class="link-card-icon" aria-hidden="true">
              🏆
            </span>
            <span class="link-card-text">
              <strong>
                {t('home.badges')}{' '}
                <span class="badges-card-count">
                  {badgeCount.earned}/{badgeCount.total}
                </span>
              </strong>
              <span class="muted small">{t('home.badgesHint')}</span>
            </span>
            <span class="chev" aria-hidden="true">
              ›
            </span>
          </a>
        )}

        <a
          class="card link-card"
          href="#/story"
          onClick={(e) => {
            e.preventDefault();
            navigate('/story');
          }}
        >
          <span class="link-card-icon" aria-hidden="true">
            📖
          </span>
          <span class="link-card-text">
            <strong>{t('home.story')}</strong>
            <span class="muted small">{t('home.storyHint')}</span>
          </span>
          <span class="chev" aria-hidden="true">
            ›
          </span>
        </a>
      </div>
    </>
  );
}
