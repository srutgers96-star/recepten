// Root of the full app: shell (header/screen/nav), hash routing, install card, update bar.
import { useEffect } from 'preact/hooks';
import { InstallCard } from './components/InstallCard';
import { Nav } from './components/Nav';
import { UpdateBar } from './components/UpdateBar';
import { lang, t } from './i18n';
import { requestPersistentStorage } from './pwa';
import { navigate, route, startRouter } from './router';
import { AddScreen } from './screens/AddScreen';
import { CheckScreen } from './screens/CheckScreen';
import { ImportScreen } from './screens/ImportScreen';
import { RecipeScreen } from './screens/RecipeScreen';
import { RecipesScreen } from './screens/RecipesScreen';
import { ShareScreen } from './screens/ShareScreen';
import { startTestTimerTicker } from './testtimer';

startRouter();
// The device-check test timer counts (and fires) on every screen, not only while Check is open.
startTestTimerTicker();

function Screen() {
  const r = route.value;
  switch (r.segments[0]) {
    case undefined:
      return <RecipesScreen />;
    case 'recipe':
      return <RecipeScreen id={r.segments[1] ?? ''} />;
    case 'add':
      return <AddScreen />;
    case 'share':
      return <ShareScreen />;
    case 'import':
      return <ImportScreen />;
    case 'check':
      return <CheckScreen />;
    default:
      return (
        <div class="screen">
          <div class="empty">{t('app.notFound')}</div>
          <button type="button" class="btn btn-block" onClick={() => navigate('/', { replace: true })}>
            {t('nav.recipes')}
          </button>
        </div>
      );
  }
}

export function App(props: { openImportFromHash: boolean }) {
  useEffect(() => {
    document.documentElement.lang = lang.value;
    void requestPersistentStorage();
    // The router already moved a boot-time token into pendingImport and routed to '#/import';
    // this only guards the case where boot said "token" but the hash was already changed.
    if (props.openImportFromHash && route.value.path !== '/import') navigate('/import', { replace: true });
  }, []);

  return (
    <div class="shell">
      <div class="screen-wrap">
        <Screen />
      </div>
      <UpdateBar />
      <InstallCard />
      <Nav />
    </div>
  );
}
