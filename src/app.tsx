// Root of the full app: boot (builtins, profiles, theme), shell (header/screen/nav), hash routing,
// onboarding gate, browser notice + install card, update bar, confetti. Routes per
// docs/phase-1-spec.md §4 plus phase 4 (docs/phase-4-spec.md §3): '/week' and '/shopping', and
// phase 5 (docs/phase-5-spec.md block A): '/more/check-recipes' and '/more/household'; block A-bis:
// '/more/dictionary'; block C: '/more/badges' plus the new-badge toast next to <Confetti/>. The
// block-D Curator page ('/more/curator') was removed in phase 6 (docs/phase-6-spec.md open question
// 7, 15 Oct 2026): the English texts of a classic are edited in the editor, which shares the patch
// route ('#p=').
// Phase 6 (13B): <BrowserNotice/> sits above the content whenever the app runs in a browser tab.
// 6D-1 (docs/specs/xp-levels.md §1c–§1e): <XpPop/> (the "+12" pops), <XpToast/> (the honest 0-XP
// toast) and <LevelUpSheet/> next to <BadgeToast/>; checkRulesVersion() once at boot after the
// badges setting is known (badges off = no trace of XP). 6D-3 unlocks (= 6D-4a, §1f): the route
// '/more/unlocks' (Vrijgespeeld; since 6D-S a redirect to '/more/style?tab=confetti', Jouw stijl);
// checkRulesVersion also refreshes the phone-wide unlocks at boot.
// 6D-4 (= 6D-4b, §1j): the route '/more/calendar' (Kookkalender). 6D-S: '/more/profile' (Mijn profiel).
// Block Z (docs/specs/handbook.md §3): '/more/handbook' (Handleiding), loaded on demand (own chunk).
import type { ComponentChildren, ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { badgeToast, dismissBadgeToast, loadBadgeSettings, syncCatalogIfNeeded, type NewBadge } from './badges';
import { loadCelebrateSettings } from './celebrate';
import { challengeToast, dismissChallengeToast } from './challenges';
import { BrowserNotice } from './components/BrowserNotice';
import { CelebrationWord } from './components/CelebrationWord';
import { Confetti } from './components/Confetti';
import { InstallCard } from './components/InstallCard';
import { LevelUpSheet } from './components/LevelUpSheet';
import { Nav } from './components/Nav';
import { UpdateBar } from './components/UpdateBar';
import { XpPop, XpToast } from './components/XpPop';
import { XpRise } from './components/XpRise';
import { loadCooking } from './cooking';
import { ensureBuiltins } from './db/repo';
import { loadDictionary } from './dictionary';
import { isLadder } from './domain/badges';
import { interpolate, lang, t, type Lang } from './i18n';
import { startInboxBadge } from './inbox-badge';
import { loadProfiles, needsOnboarding } from './profile';
import { requestPersistentStorage } from './pwa';
import { IMPORT_ROUTE, navigate, route, startRouter, type Route } from './router';
import { BadgesScreen } from './screens/BadgesScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { CheckRecipesScreen } from './screens/CheckRecipesScreen';
import { CheckScreen } from './screens/CheckScreen';
import { CookScreen } from './screens/CookScreen';
import { DictionaryScreen } from './screens/DictionaryScreen';
import { EditScreen } from './screens/EditScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HouseholdScreen } from './screens/HouseholdScreen';
import { InboxScreen } from './screens/InboxScreen';
import { MoreScreen } from './screens/MoreScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ProfilesScreen } from './screens/ProfilesScreen';
import { RecipeScreen } from './screens/RecipeScreen';
import { RecipesScreen } from './screens/RecipesScreen';
import { ShareScreen } from './screens/ShareScreen';
import { ShoppingScreen } from './screens/ShoppingScreen';
import { StorageScreen } from './screens/StorageScreen';
import { StoryScreen } from './screens/StoryScreen';
import { StyleScreen } from './screens/StyleScreen';
import { WeekScreen } from './screens/WeekScreen';
import { startTestTimerTicker } from './testtimer';
import { initTheme } from './theme';
import { startTimerEngine } from './timers';
import { checkRulesVersion } from './xp';

startRouter();
// Theme first: the mirrored choice is applied before the first paint, then reconciled with the db.
initTheme();
// The device-check test timer counts (and fires) on every screen, not only while Check is open.
startTestTimerTicker();

/** Toast lifetime; long enough to read "Nieuwe badge: …", short enough to never nag. */
const BADGE_TOAST_MS = 6000;

/**
 * Splits a tier template right before the word in front of `{k}` ("niveau {k}" / "tier {k}"), so the
 * tier dot can stand before that word (block 6D-B §6). No `{k}` → the whole template comes first.
 */
function splitAtTierWord(template: string): [string, string] {
  const at = template.indexOf('{k}');
  if (at < 0) return [template, ''];
  const word = template.lastIndexOf(' ', at - 2) + 1;
  return [template.slice(0, word), template.slice(word)];
}

/**
 * The toast's text (docs/specs/badges-avatar.md §1a.10, §3b): a secret badge → `badges.toastSecret`;
 * a ladder tier → `badges.toastTier`, "🏆 Huiskok · ● niveau 2" (block 6D-B §6: no colour name in the
 * text; a `.tier-dot` in the tier's colour right before the word "niveau"/"tier", the colour name
 * only as its aria text); otherwise `badges.toast`, or its "Samen" variant `badges.toastTogether`
 * (as before 6D-2) when the household earned it.
 */
function badgeToastText(nb: NewBadge, l: Lang): ComponentChildren {
  const name = nb.badge[l].name;
  if (nb.badge.hidden) return t('badges.toastSecret', { name });
  if (nb.tier > 1 || isLadder(nb.badge)) {
    const vars = { name, k: nb.tier };
    const [before, after] = splitAtTierWord(t('badges.toastTier'));
    return (
      <>
        {interpolate(before, vars)}
        <i class={`tier-dot lvl-${nb.tier}`} role="img" aria-label={t('badges.tier.' + nb.tier)} />
        {' '}
        {interpolate(after, vars)}
      </>
    );
  }
  return t(nb.memberId === 'all' ? 'badges.toastTogether' : 'badges.toast', { name });
}

/**
 * 6E (docs/specs/challenges.md §1c): "🎯 Uitdaging gehaald: {name} · +{xp} XP", filled by
 * settleChallenges (src/challenges.ts). Same look as the badge toast, not tappable, ~6 s; when the
 * Uitdager badge toasts at the same moment it sits right above it (xp.css). Badges off → never set.
 */
function ChallengeToast() {
  const ct = challengeToast.value;
  useEffect(() => {
    if (!ct) return;
    const handle = setTimeout(() => {
      if (challengeToast.value === ct) dismissChallengeToast();
    }, BADGE_TOAST_MS);
    return () => clearTimeout(handle);
  }, [ct]);
  return (
    <div class="challenge-toast-wrap" aria-live="polite">
      {ct && <div class="xp-toast">{t('challenge.doneToast', { name: ct.challenge[lang.value].name, xp: ct.xp })}</div>}
    </div>
  );
}

/**
 * The "new badge" toast (docs/phase-5-spec.md C.2), mounted once in the shell next to <Confetti/>.
 * Tap → the badges screen; auto-dismisses after ~6 s. The aria-live wrapper is always mounted so
 * screen readers announce the toast when it appears. Badges off → badgeToast never fires (no trace).
 * 6D-2b: the text per kind (badgeToastText) and, when the badge unlocked an avatar part, a second
 * line `badges.toastUnlock` in the same toast.
 */
function BadgeToast() {
  const nb = badgeToast.value;
  useEffect(() => {
    if (!nb) return;
    const handle = setTimeout(dismissBadgeToast, BADGE_TOAST_MS);
    return () => clearTimeout(handle);
  }, [nb]);
  const l = lang.value;
  return (
    <div class="badge-toast-wrap" aria-live="polite">
      {nb && (
        <button
          type="button"
          class="badge-toast"
          title={t('badges.toastOpen')}
          onClick={() => {
            dismissBadgeToast();
            // '?tab=': open on the tab that actually earned it. 'all' = "Samen": a household badge
            // can be reached together while every member tab still shows it locked. '&group=' (block
            // 6D-UI): open the group tab the badge sits in.
            navigate('/more/badges?tab=' + encodeURIComponent(nb.memberId) + '&group=' + encodeURIComponent(nb.badge.group));
          }}
        >
          <span class="badge-toast-icon" aria-hidden="true">
            {nb.badge.icon}
          </span>
          <span class="badge-toast-text">
            {badgeToastText(nb, l)}
            {nb.unlockedPart && (
              <>
                <br />
                <span class="badge-toast-unlock">{t('badges.toastUnlock', { part: nb.unlockedPart[l] })}</span>
              </>
            )}
          </span>
        </button>
      )}
    </div>
  );
}

/** A route that moved: replaces the hash (no extra history entry) and renders nothing meanwhile. */
function Redirect(props: { to: string }) {
  useEffect(() => navigate(props.to, { replace: true }), [props.to]);
  return null;
}

/**
 * Block Z: the handbook screen is imported on demand so it (and its data) stays out of the main
 * bundle. Until the chunk is there the shell shows an empty screen with the loading line.
 */
function LazyHandbook() {
  const [Comp, setComp] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    import('./screens/HandbookScreen').then(
      (m) => alive && setComp(() => m.HandbookScreen),
      (e: unknown) => {
        console.error('handbook', e);
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  if (Comp) return <Comp />;
  return (
    <div class="screen">
      <p class="muted">{t(failed ? 'common.error' : 'common.loading')}</p>
    </div>
  );
}

function NotFound() {
  return (
    <div class="screen">
      <div class="empty">{t('app.notFound')}</div>
      <button type="button" class="btn btn-block" onClick={() => navigate('/', { replace: true })}>
        {t('nav.home')}
      </button>
    </div>
  );
}

function Screen(props: { r: Route }) {
  const seg = props.r.segments;
  const id = seg[1] ?? '';
  switch (seg[0]) {
    case undefined:
      return <HomeScreen />;
    case 'recipes':
      return <RecipesScreen />;
    case 'recipe':
      return <RecipeScreen key={id} id={id} />;
    case 'cook':
      return <CookScreen key={id} id={id} />;
    case 'add':
      return <EditScreen key="add" />;
    case 'edit':
      return <EditScreen key={id} id={id} />;
    case 'share':
      return <ShareScreen key={id} id={id} />;
    case 'inbox':
    case 'import': // alias: sw.ts share_target redirect and public/share/index.html
      return <InboxScreen />;
    case 'week':
      return <WeekScreen />;
    case 'shopping':
      return <ShoppingScreen />;
    case 'more':
      switch (seg[1]) {
        case undefined:
          return <MoreScreen />;
        case 'profiles':
          return <ProfilesScreen />;
        // 6D-S (docs/specs/badges-avatar.md "S-A"): Mijn profiel ('?id=' for another profile).
        case 'profile':
          return <ProfileScreen />;
        case 'storage':
          return <StorageScreen />;
        // Phase 5 (docs/phase-5-spec.md A.6 + A.8).
        case 'check-recipes':
          return <CheckRecipesScreen />;
        case 'household':
          return <HouseholdScreen />;
        // Phase 5 (docs/phase-5-spec.md A-bis.6): the dictionary screen (own entries, merge, clean-up).
        case 'dictionary':
          return <DictionaryScreen />;
        // Phase 5 (docs/phase-5-spec.md C.2): badges per member + "Samen".
        case 'badges':
          return <BadgesScreen />;
        // 6D-S (docs/specs/badges-avatar.md "S-B"): Jouw stijl (avatar, sounds, confetti, typefaces, theme).
        case 'style':
          return <StyleScreen />;
        // The old Vrijgespeeld page (6D-4a) is gone since 6D-S: an old link lands on Jouw stijl → Confetti.
        case 'unlocks':
          return <Redirect to="/more/style?tab=confetti" />;
        // 6D-4 (docs/specs/xp-levels.md §1j): who cooked what, per day (local log + received snapshots).
        case 'calendar':
          return <CalendarScreen />;
        // Block Z (docs/specs/handbook.md §3): the searchable handbook; a separate chunk.
        case 'handbook':
          return <LazyHandbook />;
        default:
          return <NotFound />;
      }
    case 'story':
      return <StoryScreen />;
    case 'check':
      return <CheckScreen />;
    case 'onboarding':
      return <OnboardingScreen />;
    default:
      return <NotFound />;
  }
}

export function App(props: { openImportFromHash: boolean }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang.value;
    void requestPersistentStorage();
    void loadCelebrateSettings();
    void loadBadgeSettings();
    // The router already moved a boot-time token into pendingImport and routed to the inbox;
    // this only guards the case where boot said "token" but the hash was already changed.
    const seg = route.value.segments[0];
    if (props.openImportFromHash && seg !== 'inbox' && seg !== 'import') navigate(IMPORT_ROUTE, { replace: true });

    let cancelled = false;
    (async () => {
      const errors: string[] = [];
      try {
        await ensureBuiltins();
      } catch (e) {
        errors.push(String(e));
      }
      try {
        await loadProfiles();
        // 6D-2c: with badges on and `badges.catalogSynced` below 2, register what was reached so far
        // silently (all local profiles + Samen), then set the flag; a fresh install only sets it.
        await syncCatalogIfNeeded();
      } catch (e) {
        errors.push(String(e));
      }
      // User-created ingredients on top of the bundled dictionary (never fatal: the base
      // dictionary is in the bundle and the signal already holds it).
      try {
        await loadDictionary();
      } catch (e) {
        console.error('loadDictionary', e);
      }
      if (cancelled) return;
      if (errors.length) setBootError(errors.join(' · '));
      setReady(true);
      startInboxBadge();
      // Cooking timers tick app-wide (persisted in the db), also on screens without a <TimerBar/>.
      void startTimerEngine();
      // 13K: the "Nu aan het koken" sessions (settings row cook.sessions), pruned on every return
      // to the app; the bar and cook mode read them.
      void loadCooking();
      // 6D-1 §1e: a newer XP rules version → one honest toast; first start → only the setting.
      // After loadBadgeSettings() (memoised, started above) and after the profiles are loaded.
      // 6D-3: it ends with refreshUnlocks() (the phone-wide unlocks, §3 "bij boot").
      void loadBadgeSettings()
        .then(() => checkRulesVersion())
        .catch((e: unknown) => console.error('checkRulesVersion', e));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div class="shell">
        <div class="boot" role="status">
          <h1>{t('app.title')}</h1>
          <div>{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  const r = route.value;
  // No profile yet: onboarding takes over every route except the device check (usable standalone).
  const onboarding = needsOnboarding.value && r.segments[0] !== 'check';

  return (
    <div class="shell">
      {bootError && (
        <div class="boot-error" role="alert">
          {t('common.error')}: {bootError}
        </div>
      )}
      {/* 13B: in a browser tab on a phone this says so first, also during onboarding (the moment
          to install is before the first recipe is saved in the wrong storage). */}
      <BrowserNotice />
      <div class="screen-wrap">{onboarding ? <OnboardingScreen /> : <Screen r={r} />}</div>
      <UpdateBar />
      <InstallCard />
      {!onboarding && <Nav />}
      <Confetti />
      <CelebrationWord />
      <BadgeToast />
      <ChallengeToast />
      <XpPop />
      <XpToast />
      <XpRise />
      <LevelUpSheet />
    </div>
  );
}
