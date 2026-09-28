// '#/onboarding' — shown (by the shell) while no profile exists: name, language, colour → creates
// the profile, makes it active and lands on Home — or on the Inbox when the app was opened with a
// share link (the router parked the token in pendingImport while onboarding took over the route).
// Reuses ProfileForm from the profiles screen.
import { Header } from '@/components/Header';
import { t } from '@/i18n';
import { createProfile } from '@/profile';
import { IMPORT_ROUTE, navigate, pendingImport } from '@/router';
import { ProfileForm } from './ProfilesScreen';

export function OnboardingScreen() {
  return (
    <>
      <Header title={t('app.title')} />
      <div class="screen form">
        <div class="onboarding">
          <img class="cover" src={import.meta.env.BASE_URL + 'cover.webp'} alt="" />
          <h2>{t('onboarding.title')}</h2>
          <p class="muted">{t('onboarding.intro')}</p>
          <ProfileForm
            autoFocus
            submitLabel={t('onboarding.start')}
            onSubmit={async (v) => {
              await createProfile(v);
              navigate(pendingImport.value ? IMPORT_ROUTE : '/', { replace: true });
            }}
          />
        </div>
      </div>
    </>
  );
}
