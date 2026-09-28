// '#/' — Home "Vanavond?": greeting, "Verras me", favourites chips (per profile), recently cooked,
// own & received recipes, the story link and the planner teaser (docs/phase-1-spec.md §5).
import { useMemo, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { RecipeRow, formatShortDate } from '@/components/RecipeRow';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { allRecipes, listFavorites, recentCooked, userRecipes } from '@/db/repo';
import { pickText, type Recipe } from '@/domain/model';
import { lang, t } from '@/i18n';
import { activeProfile, profiles } from '@/profile';
import { navigate, navigateTab } from '@/router';

// Module-level so the suggestion stays the same when you come back to Home (reroll changes it).
let surpriseId: string | null = null;

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
  const [, bump] = useState(0);

  const byId = useMemo(() => new Map((all ?? []).map((r) => [r.id, r] as const)), [all]);
  if (all && all.length && (!surpriseId || !byId.has(surpriseId))) surpriseId = pickRandom(all, null);
  const surprise = surpriseId ? byId.get(surpriseId) : undefined;

  const favList = useMemo(() => {
    if (!favs || !all) return [];
    return all.filter((r) => favs.has(r.id)).sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), l));
  }, [favs, all, l]);

  const ownList = useMemo(() => (own ? [...own].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5) : []), [own]);
  const profileName = (id: string) => profiles.value.find((p) => p.id === id)?.name ?? '';

  return (
    <>
      <Header title={t('home.title')} />
      <TimerBar />
      <div class="screen home">
        <h2 class="home-greeting">{profile ? t('home.greeting', { name: profile.name }) : t('home.greetingAnon')}</h2>

        <section class="card surprise">
          <div class="muted small">{t('home.surprise')}</div>
          {surprise ? (
            <>
              <button type="button" class="surprise-name" onClick={() => openRecipe(surprise.id)}>
                {pickText(surprise.name, l)}
              </button>
              <div class="surprise-actions">
                <button type="button" class="btn btn-primary" onClick={() => openRecipe(surprise.id)}>
                  {t('home.open')}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  onClick={() => {
                    surpriseId = pickRandom(all ?? [], surpriseId);
                    bump((n) => n + 1);
                  }}
                >
                  <span aria-hidden="true">🎲</span> {t('home.reroll')}
                </button>
              </div>
            </>
          ) : (
            <div class="muted">{t('common.loading')}</div>
          )}
        </section>

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
            {t('home.ownReceived')}
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
                  <RecipeRow recipe={r} favorite={favs?.has(r.id)} subtitle={formatShortDate(r.updatedAt, l)} />
                </li>
              ))}
            </ul>
          )}
        </section>

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

        <div class="card teaser">{t('home.teaser')}</div>
      </div>
    </>
  );
}
