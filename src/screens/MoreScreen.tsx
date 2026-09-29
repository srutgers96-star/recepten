// '#/more' — Inbox row (with the unseen badge; phase 4 moved the Inbox tab here), active profile
// (switch, "+ profiel"), language, theme, confetti, "°F erbij", the
// dictionary (counts + own ingredients with delete), and the links to "Stuur nieuwe naar …"
// (unsent-changes badge), Opslag & back-up (backup-due badge), Het verhaal, Apparaatcheck, plus
// "Over" (version, sha, channel, GitHub).
import { useEffect, useState } from 'preact/hooks';
import { confettiEnabled, loadCelebrateSettings, setConfettiEnabled } from '@/celebrate';
import { appInfo } from '@/components/AppInfo';
import { Header, chooseLang } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { deleteUserIngredient, getFahrenheit, getHouseholdServings, setFahrenheit, setHouseholdServings } from '@/db/repo';
import { baseDictionary, dictionary, reloadDictionary, userIngredients } from '@/dictionary';
import type { Lang } from '@/domain/model';
import { lang, t } from '@/i18n';
import { backupStatus, inboxUnseen, refreshShareBadges, unsentChanges } from '@/inbox-badge';
import { activeProfile, profiles, setActiveProfile } from '@/profile';
import { navigate } from '@/router';
import { setTheme, theme, type Theme } from '@/theme';
import { Avatar } from './ProfilesScreen';

const GITHUB_URL = 'https://github.com/srutgers96-star/recepten';
/** "Huishouden" stepper range (a new week slot starts at this many servings). */
const MIN_HOUSEHOLD = 1;
const MAX_HOUSEHOLD = 12;

function Chevron() {
  return (
    <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function MenuRow(props: { label: string; to: string; sub?: string; badge?: string; badgeTone?: 'orange' | 'red' }) {
  return (
    <button type="button" class="row" onClick={() => navigate(props.to)}>
      <span class="name">
        {props.label}
        {props.sub && <span class="row-sub">{props.sub}</span>}
      </span>
      {props.badge && <span class={'badge menu-badge' + (props.badgeTone === 'red' ? ' badge-next' : '')}>{props.badge}</span>}
      <Chevron />
    </button>
  );
}

/** "Woordenboek": builtin + own counts; tap opens the own entries, each with a delete button. */
function DictionarySection() {
  const l = lang.value;
  const [open, setOpen] = useState(false);
  const own = userIngredients.value;
  const builtin = baseDictionary().ingredients.length;
  const dict = dictionary.value;

  async function remove(id: string, name: string) {
    if (!confirm(t('more.dictDeleteConfirm', { name }))) return;
    try {
      await deleteUserIngredient(id);
      await reloadDictionary();
    } catch (e) {
      console.error('deleteUserIngredient', e);
    }
  }

  return (
    <section class="section">
      <h2>{t('more.dictionary')}</h2>
      <div class="menu">
        <button type="button" class="row" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span class="name">
            {t('more.dictCounts', { builtin, own: own.length })}
            <span class="row-sub">{t('more.dictHint')}</span>
          </span>
          <Chevron />
        </button>
      </div>
      {open &&
        (own.length === 0 ? (
          <p class="muted dict-empty">{t('more.dictNone')}</p>
        ) : (
          <ul class="list dict-list">
            {own.map((i) => {
              const name = (l === 'nl' ? i.nl.one : i.en.one) || i.nl.one || i.en.one || i.id;
              const other = (l === 'nl' ? i.en.one : i.nl.one) || '';
              const aisle = dict.aisle(i.aisle);
              const aisleName = aisle ? (l === 'nl' ? aisle.nl : aisle.en) : i.aisle;
              return (
                <li key={i.id} class="dict-row">
                  <span class="name">
                    {name}
                    <span class="row-sub">{[other, aisleName].filter(Boolean).join(' · ')}</span>
                  </span>
                  <button type="button" class="btn btn-small" onClick={() => void remove(i.id, name)} aria-label={`${t('more.dictDelete')} ${name}`}>
                    {t('more.dictDelete')}
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}

export function MoreScreen() {
  const active = activeProfile.value;
  const others = profiles.value.filter((p) => p.id !== active?.id);
  const [fahrenheit, setF] = useState(false);
  const [household, setHousehold] = useState<number | null>(null);

  const unsent = unsentChanges.value;
  const unseen = inboxUnseen.value;
  const backupDue = backupStatus.value?.overdue === true;

  useEffect(() => {
    void loadCelebrateSettings();
    void getFahrenheit().then(setF, (e: unknown) => console.error('getFahrenheit', e));
    void getHouseholdServings().then(setHousehold, (e: unknown) => console.error('getHouseholdServings', e));
    void refreshShareBadges();
  }, []);

  function toggleFahrenheit(on: boolean) {
    setF(on);
    void setFahrenheit(on).catch((e: unknown) => console.error('setFahrenheit', e));
  }

  /** "Huishouden": the servings a new week slot starts with (spec §0 `household.servings`). */
  function changeHousehold(delta: number) {
    const next = Math.min(MAX_HOUSEHOLD, Math.max(MIN_HOUSEHOLD, (household ?? 4) + delta));
    setHousehold(next);
    void setHouseholdServings(next).catch((e: unknown) => console.error('setHouseholdServings', e));
  }

  return (
    <>
      <Header title={t('more.title')} />
      <div class="screen">
        {/* Phase 4: the Inbox moved here from the bottom nav; its unseen badge follows. */}
        <section class="section menu more-inbox">
          <MenuRow label={t('more.inbox')} sub={t('more.inboxHint')} to="/inbox" badge={unseen > 0 ? String(unseen > 99 ? '99+' : unseen) : undefined} />
        </section>

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
          <div class="setting">
            <div class="label">
              {t('more.household')}
              <small>{t('more.householdHint')}</small>
            </div>
            <div class="household-step" role="group" aria-label={t('more.household')}>
              <button type="button" class="servings-step" aria-label={t('more.householdLess')} disabled={household === null || household <= MIN_HOUSEHOLD} onClick={() => changeHousehold(-1)}>
                −
              </button>
              <span class="value" aria-live="polite">
                {household === null ? '…' : t('more.householdValue', { n: household })}
              </span>
              <button type="button" class="servings-step" aria-label={t('more.householdMore')} disabled={household === null || household >= MAX_HOUSEHOLD} onClick={() => changeHousehold(1)}>
                +
              </button>
            </div>
          </div>
          <label class="setting">
            <div class="label">
              {t('more.fahrenheit')}
              <small>{t('more.fahrenheitHint')}</small>
            </div>
            <span class="switch">
              <input type="checkbox" checked={fahrenheit} onChange={(e) => toggleFahrenheit((e.currentTarget as HTMLInputElement).checked)} />
              <span class="track" />
            </span>
          </label>
        </section>

        <DictionarySection />

        <section class="section menu">
          <MenuRow label={t('more.sendNew')} sub={t('more.sendNewHint')} to="/share" badge={unsent > 0 ? String(unsent > 99 ? '99+' : unsent) : undefined} />
          <MenuRow label={t('more.storage')} to="/more/storage" badge={backupDue ? t('more.backupDue') : undefined} badgeTone="red" />
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
