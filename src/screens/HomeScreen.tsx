// '#/' — Home "Vanavond?" (docs/specs/home-a-plus.md, Home A+ block 1). Top to bottom (§1a):
//   header "Vanavond?" with the "+" (AddMenu: Plak · Zelf · AI · Bestand, the same sheet as Recipes),
//   <TimerBar/> (13K puts its cooking bar in this slot), then .screen.home:
//    1 greeting row: avatar circle + "Hoi Stijn, wat eten we vanavond?", and under it the level-row
//      slot <HomeLevelRow/> (until 6D "🏆 Badges x/y ›", only with badges on)
//    2 "Verras me" (dice with optional filter chips; block 2 replaces it with the Tonight card)
//    4 "Deze week" (names max 5 + "+N", Boodschappenlijst; empty → "Kies 7 voor deze week"; block 2
//      replaces it with the compact WeekCard)
//    5 backup card (only while the backup is overdue)
//    6 row 📥 In & uit with "1 ontvangen · 2 te delen" / "niets nieuws" → '#/inbox'
//    7 favourites (one scrolling chip strip, per profile)
//    8 recently cooked (3 rows; ★ Beoordeel for the active member's unrated cooks)
//    9 categories (one scrolling row of tiles)
//   10 row 📒 Mijn recepten N → the Recipes list sorted "Eigen & ontvangen" ('?sort=ownReceived')
//   11 row 📖 Het verhaal van dit boek → '#/story'
// (3 "Verder met" arrives with block 2.)
import { useEffect, useMemo, useState } from 'preact/hooks';
import { AddMenu } from '@/components/AddMenu';
import { CategoryShelf } from '@/components/CategoryShelf';
import { Header } from '@/components/Header';
import { HomeLevelRow } from '@/components/HomeLevelRow';
import { PickChips, applyPickFilter, loadPickFilter, pickFilterActive, savePickFilter, tagIdsIn, type PickFilter } from '@/components/PickSheet';
import { formatShortDate, otherLanguageName } from '@/components/RecipeRow';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { allRecipes, getPlan, listFavorites, recentCooked, userRecipes } from '@/db/repo';
import { dictionary } from '@/dictionary';
import { pickText, type Recipe } from '@/domain/model';
import { lang, t } from '@/i18n';
import { backupStatus, inboxUnseen, refreshShareBadges, unsentChanges } from '@/inbox-badge';
import { activeProfile, profiles } from '@/profile';
import { navigate, navigateTab } from '@/router';
import { Avatar } from './ProfilesScreen';

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
  const cooked = useLive(() => recentCooked(undefined, 3), []);
  const own = useLive(userRecipes, []);
  const plan = useLive(getPlan, []);
  const [, bump] = useState(0);
  const [addMenu, setAddMenu] = useState(false);
  const [filters, setFilters] = useState<PickFilter>(() => loadPickFilter(SURPRISE_FILTERS_KEY));
  const backup = backupStatus.value;
  const unsent = unsentChanges.value;
  const unseen = inboxUnseen.value;
  const dict = dictionary.value;

  useEffect(() => {
    void refreshShareBadges();
  }, []);

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

  const profileName = (id: string) => profiles.value.find((p) => p.id === id)?.name ?? '';

  // "Deze week" card (phase 4): the plan's dishes, cooked ones struck through, max 5 + "+N".
  const planItems = plan?.items ?? [];
  const planShown = planItems.slice(0, 5);
  const planMore = planItems.length - planShown.length;
  const planAllCooked = planItems.length > 0 && planItems.every((p) => p.cooked);

  // Row "In & uit" (§1d): the non-empty parts of "{n} ontvangen" and "{n} te delen", or "niets
  // nieuws". Both signals are live (src/inbox-badge.ts) and keep their last value on a database
  // error, so the row shows the last known counts then.
  const inOutParts: string[] = [];
  if (unseen > 0) inOutParts.push(t('home.inOutReceived', { n: unseen }));
  if (unsent > 0) inOutParts.push(t('home.inOutToShare', { n: unsent }));
  const inOutDetail = inOutParts.length ? inOutParts.join(' · ') : t('home.inOutNothing');

  // Row "Mijn recepten" (§1e): own + received; nothing while the count is still loading.
  const myCount = own?.length;
  const myDetail = myCount === undefined ? '' : myCount === 0 ? t('home.myRecipesNone') : String(myCount);

  return (
    <>
      <Header
        title={t('home.title')}
        action={
          <button type="button" class="icon-btn list-add" aria-label={t('list.add')} aria-haspopup="dialog" onClick={() => setAddMenu(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        }
      />
      <TimerBar />
      <div class="screen home">
        <div class="home-hello">
          {profile && <Avatar profile={profile} />}
          <h2 class="home-greeting">{profile ? t('home.greeting', { name: profile.name }) : t('home.greetingAnon')}</h2>
        </div>
        <HomeLevelRow profileId={pid} />

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

        {/* Always there, also with "niets nieuws": it is Home's way into In & uit (§1d). */}
        <div class="card home-rows">
          <a
            class={'home-row' + (unseen > 0 ? ' has-new' : '')}
            href="#/inbox"
            onClick={(e) => {
              e.preventDefault();
              navigate('/inbox');
            }}
          >
            <span class="home-row-icon" aria-hidden="true">
              📥
            </span>
            <span class="home-row-title">{t('home.inOut')}</span>
            <span class="detail">{inOutDetail}</span>
            <span class="chev" aria-hidden="true">
              ›
            </span>
          </a>
        </div>

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
                // Phase 6 A.3: a cook of the active member without stars gets a small "Beoordeel"
                // link that opens the recipe with the rate sheet for THIS entry ('?rate=<id>',
                // RecipeScreen) — not for the latest cook of the recipe, which may be another, already
                // rated one. Other members' cooks are theirs to rate, so those rows stay plain.
                const canRate = !e.stars && !!pid && e.profileId === pid && e.id !== undefined;
                const name = r ? pickText(r.name, l) : e.recipeId;
                return (
                  <div key={e.id ?? `${e.recipeId}|${e.at}`} class="cooked-row">
                    <a
                      class="cooked-main"
                      href={'#/recipe/' + e.recipeId}
                      onClick={(ev) => {
                        ev.preventDefault();
                        openRecipe(e.recipeId);
                      }}
                    >
                      <span class="name">{name}</span>
                      <span class="meta">
                        {e.stars ? `★ ${e.stars} · ` : ''}
                        {formatShortDate(e.at, l)}
                        {who ? ` · ${who}` : ''}
                      </span>
                    </a>
                    {canRate && (
                      /* Up to three of these in a row: the dish name in the accessible name tells them apart. */
                      <button type="button" class="cooked-rate" aria-label={`${t('recipe.rate')}: ${name}`} onClick={() => navigate('/recipe/' + e.recipeId + '?rate=' + e.id)}>
                        <span aria-hidden="true">★</span> {t('recipe.rate')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <CategoryShelf recipes={all ?? []} />

        <div class="card home-rows">
          <a
            class="home-row"
            href="#/recipes?sort=ownReceived"
            onClick={(e) => {
              e.preventDefault();
              navigateTab('/recipes?sort=ownReceived');
            }}
          >
            <span class="home-row-icon" aria-hidden="true">
              📒
            </span>
            <span class="home-row-title">{t('home.myRecipes')}</span>
            <span class="detail">{myDetail}</span>
            <span class="chev" aria-hidden="true">
              ›
            </span>
          </a>
          <a
            class="home-row"
            href="#/story"
            onClick={(e) => {
              e.preventDefault();
              navigate('/story');
            }}
          >
            <span class="home-row-icon" aria-hidden="true">
              📖
            </span>
            <span class="home-row-title">{t('home.storyRow')}</span>
            <span class="chev" aria-hidden="true">
              ›
            </span>
          </a>
        </div>
      </div>
      <AddMenu open={addMenu} onClose={() => setAddMenu(false)} />
    </>
  );
}
