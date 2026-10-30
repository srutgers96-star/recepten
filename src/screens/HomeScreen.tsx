// '#/' — Home "Vanavond?" (docs/specs/home-a-plus.md, Home A+ blocks 1 and 2). Top to bottom (§1a):
//   header "Vanavond?" with the "+" (AddMenu: Plak · Zelf · AI · Bestand, the same sheet as Recipes),
//   <TimerBar/> (13K puts its cooking bar in this slot), then .screen.home:
//    1 greeting row: avatar circle + "Hoi Stijn, wat eten we vanavond?", and under it the level-row
//      slot <HomeLevelRow/> (until 6D "🏆 Badges x/y ›", only with badges on)
//    2 the card VANAVOND (<TonightCard/>: the week's next dish, or the dice with its filter chips)
//    3 the line "Verder met: Goulash ›" (only for a recipe viewed today, not cooked today, and not the
//      dish the card shows)
//    4 "Deze week", compact (<WeekCard/>: "n van 7 gekookt", one line of names, Boodschappenlijst;
//      empty → "Kies 7 voor deze week")
//    5 backup card (only while the backup is overdue)
//    6 row 📥 In & uit with "1 ontvangen · 2 te delen" / "niets nieuws" → '#/inbox'
//    7 favourites (one scrolling chip strip, per profile)
//    8 recently cooked (3 rows; ★ Beoordeel for the active member's unrated cooks)
//    9 categories (one scrolling row of tiles)
//   10 row 📒 Mijn recepten N → the Recipes list sorted "Eigen & ontvangen" ('?sort=ownReceived')
//   11 row 📖 Het verhaal van dit boek → '#/story'
import { useEffect, useMemo, useState } from 'preact/hooks';
import { AddMenu } from '@/components/AddMenu';
import { CategoryShelf } from '@/components/CategoryShelf';
import { Header } from '@/components/Header';
import { HomeLevelRow } from '@/components/HomeLevelRow';
import { formatShortDate } from '@/components/RecipeRow';
import { TimerBar } from '@/components/TimerBar';
import { TonightCard } from '@/components/TonightCard';
import { WeekCard } from '@/components/WeekCard';
import { useLive } from '@/db/live';
import { allRecipes, getPlan, latestCookFor, listFavorites, recentCooked, userRecipes } from '@/db/repo';
import { pickText } from '@/domain/model';
import { continueWithId } from '@/domain/tonight';
import { lang, t } from '@/i18n';

/** The Home header: today as "donderdag 30 oktober" / "Thursday 30 October" (Stijn 30 Oct: "Vanavond?" top-left was odd;
 *  something functional instead). Capitalised like a title. */
function todayTitle(l: 'nl' | 'en'): string {
  const text = new Date().toLocaleDateString(l === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
import { backupStatus, inboxUnseen, refreshShareBadges, unsentChanges } from '@/inbox-badge';
import { activeProfile, profiles } from '@/profile';
import { lastViewed } from '@/recent';
import { navigate, navigateTab } from '@/router';
import { Avatar, useAvatarLevel } from './ProfilesScreen';

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
  const [addMenu, setAddMenu] = useState(false);
  const backup = backupStatus.value;
  const unsent = unsentChanges.value;
  const unseen = inboxUnseen.value;
  // 6D-3 (docs/specs/badges-avatar.md §1c): the greeting's avatar shows the level ring.
  const level = useAvatarLevel(pid);

  useEffect(() => {
    void refreshShareBadges();
  }, []);

  const byId = useMemo(() => new Map((all ?? []).map((r) => [r.id, r] as const)), [all]);
  const knownIds = useMemo(() => new Set(byId.keys()), [byId]);

  // Line "Verder met" (§1h): the last viewed recipe (per phone, read once when Home mounts), only
  // when it was viewed today, still exists, is not the dish the Tonight card shows (`shownId`, which
  // the card reports) and has no cook today (`latestCookFor`, live, so ticking Gekookt hides the
  // line). The cook query resolves to null for "no cook", undefined = loading.
  const [last] = useState(lastViewed);
  const lastId = last?.id ?? null;
  const lastCook = useLive(() => (lastId ? latestCookFor(lastId).then((e) => e ?? null) : Promise.resolve(null)), [lastId]);
  // The card reports its dish through `onShown` from a layout effect, which runs before the browser
  // paints; the state update it causes here re-renders Home before that paint too. So every switch
  // of the card (opening Home, its buttons, its chips, new data) reaches the line in the same frame
  // and the line never shows the card's own dish (decision Fable 23 Oct). `shownId` is undefined
  // until the card's first report (null, "nothing shown", also counts): until then no line.
  const [shownId, setShownId] = useState<string | null | undefined>(undefined);
  const cardReady = all !== undefined && plan !== undefined;
  const continueId =
    shownId !== undefined && cardReady && lastCook !== undefined
      ? continueWithId(last, new Date(), knownIds, shownId, lastCook?.at ?? null)
      : null;
  const continueRecipe = continueId ? byId.get(continueId) : undefined;

  const favList = useMemo(() => {
    if (!favs || !all) return [];
    return all.filter((r) => favs.has(r.id)).sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), l));
  }, [favs, all, l]);

  const profileName = (id: string) => profiles.value.find((p) => p.id === id)?.name ?? '';

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
        title={todayTitle(lang.value)}
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
          {profile && <Avatar profile={profile} level={level} />}
          {/* Stijn 30 Oct: no "Hoi Stijn, wat eten we vanavond?" ("Vanavond" stood on Home three times); just the name. */}
          <h2 class="home-greeting">{profile ? profile.name : t('home.greetingAnon')}</h2>
        </div>
        <HomeLevelRow profileId={pid} />

        <TonightCard recipes={all} plan={plan} onShown={setShownId} />

        {continueRecipe && (
          <a
            class="home-continue"
            href={'#/recipe/' + continueRecipe.id}
            onClick={(e) => {
              e.preventDefault();
              openRecipe(continueRecipe.id);
            }}
          >
            {t('home.continueWith', { name: pickText(continueRecipe.name, l) })}
          </a>
        )}

        {plan !== undefined && <WeekCard plan={plan} byId={byId} />}

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
