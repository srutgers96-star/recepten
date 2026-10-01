// Root of the full app: boot (builtins, profiles, theme), shell (header/screen/nav), hash routing,
// onboarding gate, install card, update bar, confetti. Routes per docs/phase-1-spec.md §4 plus
// phase 4 (docs/phase-4-spec.md §3): '/week' and '/shopping', and phase 5 (docs/phase-5-spec.md
// block A): '/more/check-recipes' and '/more/household'; block A-bis: '/more/dictionary'.
import { useEffect, useState } from 'preact/hooks';
import { loadCelebrateSettings } from './celebrate';
import { Confetti } from './components/Confetti';
import { InstallCard } from './components/InstallCard';
import { Nav } from './components/Nav';
import { UpdateBar } from './components/UpdateBar';
import { ensureBuiltins } from './db/repo';
import { loadDictionary } from './dictionary';
import { lang, t } from './i18n';
import { startInboxBadge } from './inbox-badge';
import { loadProfiles, needsOnboarding } from './profile';
import { requestPersistentStorage } from './pwa';
import { IMPORT_ROUTE, navigate, route, startRouter, type Route } from './router';
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
import { ProfilesScreen } from './screens/ProfilesScreen';
import { RecipeScreen } from './screens/RecipeScreen';
import { RecipesScreen } from './screens/RecipesScreen';
import { ShareScreen } from './screens/ShareScreen';
import { ShoppingScreen } from './screens/ShoppingScreen';
import { StorageScreen } from './screens/StorageScreen';
import { StoryScreen } from './screens/StoryScreen';
import { WeekScreen } from './screens/WeekScreen';
import { startTestTimerTicker } from './testtimer';
import { initTheme } from './theme';
import { startTimerEngine } from './timers';

startRouter();
// Theme first: the mirrored choice is applied before the first paint, then reconciled with the db.
initTheme();
// The device-check test timer counts (and fires) on every screen, not only while Check is open.
startTestTimerTicker();

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
      <div class="screen-wrap">{onboarding ? <OnboardingScreen /> : <Screen r={r} />}</div>
      <UpdateBar />
      <InstallCard />
      {!onboarding && <Nav />}
      <Confetti />
    </div>
  );
}
