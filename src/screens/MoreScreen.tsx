// '#/more' — active profile (switch, "+ profiel"), language, theme, confetti, and the links to
// Opslag & back-up, Het verhaal, Apparaatcheck, plus "Over" (version, sha, channel, GitHub).
import { useEffect } from 'preact/hooks';
import { confettiEnabled, loadCelebrateSettings, setConfettiEnabled } from '@/celebrate';
import { appInfo } from '@/components/AppInfo';
import { Header, chooseLang } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import type { Lang } from '@/domain/model';
import { lang, t } from '@/i18n';
import { activeProfile, profiles, setActiveProfile } from '@/profile';
import { navigate } from '@/router';
import { setTheme, theme, type Theme } from '@/theme';
import { Avatar } from './ProfilesScreen';

const GITHUB_URL = 'https://github.com/srutgers96-star/recepten';

function Chevron() {
  return (
    <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function MenuRow(props: { label: string; to: string }) {
  return (
    <button type="button" class="row" onClick={() => navigate(props.to)}>
      <span class="name">{props.label}</span>
      <Chevron />
    </button>
  );
}

export function MoreScreen() {
  const active = activeProfile.value;
  const others = profiles.value.filter((p) => p.id !== active?.id);

  useEffect(() => {
    void loadCelebrateSettings();
  }, []);

  return (
    <>
      <Header title={t('more.title')} />
      <div class="screen">
        <section class="card">
          <h2>{t('more.profile')}</h2>
          {active ? (
            <div class="profile-card">
              <Avatar profile={active} big />
              <div class="who">
                <strong>{active.name}</strong>
                <span class="muted small">{t(active.lang === 'nl' ? 'lang.nl' : 'lang.en')}</span>
              </div>
            </div>
          ) : (
            <div class="muted">{t('profiles.empty')}</div>
          )}
          <div class="profile-chips">
            {others.map((p) => (
              <button key={p.id} type="button" class="profile-chip" onClick={() => void setActiveProfile(p.id)} aria-label={`${t('more.switchTo')} ${p.name}`}>
                <Avatar profile={p} />
                <span>{p.name}</span>
              </button>
            ))}
            <button type="button" class="profile-chip" onClick={() => navigate('/more/profiles?add=1')}>
              <span style="padding-left:8px">{t('more.addProfile')}</span>
            </button>
          </div>
          <div class="menu" style="margin-top:8px">
            <MenuRow label={t('more.manageProfiles')} to="/more/profiles" />
          </div>
        </section>

        <section class="section">
          <h2>{t('more.settings')}</h2>
          <div class="setting">
            <div class="label">
              {t('more.language')}
              <small>{t('more.languageHint')}</small>
            </div>
            <Segmented<Lang>
              name="lang"
              options={[
                { value: 'nl', label: 'NL' },
                { value: 'en', label: 'EN' },
              ]}
              selected={[lang.value]}
              onChange={(v) => {
                if (v[0]) chooseLang(v[0]);
              }}
            />
          </div>
          <div class="setting">
            <div class="label">{t('more.theme')}</div>
            <Segmented<Theme>
              name="theme"
              options={[
                { value: 'system', label: t('more.theme.system') },
                { value: 'light', label: t('more.theme.light') },
                { value: 'dark', label: t('more.theme.dark') },
              ]}
              selected={[theme.value]}
              onChange={(v) => {
                if (v[0]) void setTheme(v[0]);
              }}
            />
          </div>
          <label class="setting">
            <div class="label">
              {t('more.confetti')}
              <small>{t('more.confettiHint')}</small>
            </div>
            <span class="switch">
              <input type="checkbox" checked={confettiEnabled.value} onChange={(e) => void setConfettiEnabled((e.currentTarget as HTMLInputElement).checked)} />
              <span class="track" />
            </span>
          </label>
        </section>

        <section class="section menu">
          <MenuRow label={t('more.storage')} to="/more/storage" />
          <MenuRow label={t('more.story')} to="/story" />
          <MenuRow label={t('more.check')} to="/check" />
        </section>

        <section class="section about">
          <h2>{t('more.about')}</h2>
          <dl>
            <dt>{t('more.version')}</dt>
            <dd>{appInfo.version}</dd>
            <dt>{t('more.channel')}</dt>
            <dd>{appInfo.channel}</dd>
            <dt>{t('more.build')}</dt>
            <dd>{appInfo.sha}</dd>
          </dl>
          <div class="actions" style="margin-top:12px">
            <a class="btn" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              {t('more.github')}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
