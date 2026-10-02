// '#/more' — Inbox row (with the unseen badge; phase 4 moved the Inbox tab here), active profile
// (switch, "+ profiel"), language, theme, confetti, "°F erbij", the "Kookstand & timer" section
// (read-aloud, voice commands, timer sound & vibrate — phase 5 block B), the
// dictionary row (counts → '/more/dictionary', phase 5 A-bis.6), and the links to "Stuur nieuwe naar …"
// (unsent-changes badge), Opslag & back-up (backup-due badge), Het verhaal, Apparaatcheck, plus
// "Over" (version, sha, channel, GitHub). Phase 5: "Huishouden" (under the profile card),
// "Controleer mijn recepten" (docs/phase-5-spec.md A.6 / A.8), and block D: the "Curator" row
// ('/more/curator') plus the "Experimenten" switch in "Over" (setting 'experiments').
import { useEffect, useState } from 'preact/hooks';
import { badgesEnabled, loadBadgeSettings, setBadgesEnabled } from '@/badges';
import { confettiEnabled, loadCelebrateSettings, setConfettiEnabled } from '@/celebrate';
import { appInfo, isIOS } from '@/components/AppInfo';
import { Header, chooseLang } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { getFahrenheit, getHouseholdServings, getSetting, setFahrenheit, setHouseholdServings, setSetting } from '@/db/repo';
import { baseDictionary, userIngredients } from '@/dictionary';
import type { Lang } from '@/domain/model';
import { lang, t } from '@/i18n';
import { backupStatus, inboxUnseen, refreshShareBadges, unsentChanges } from '@/inbox-badge';
import { activeProfile, profiles, setActiveProfile } from '@/profile';
import { navigate } from '@/router';
import { loadSoundSettings, previewTimerSound, setTimerSound, setTimerVibrate, timerSound, timerVibrate, type TimerSound } from '@/sounds';
import { canSpeak, loadSpeechSettings, readAloud, setReadAloud } from '@/speech';
import { setTheme, theme, type Theme } from '@/theme';
import { canListen, commandsEnabled, loadVoiceSettings, setCommandsEnabled } from '@/voice';
import { Avatar } from './ProfilesScreen';

const GITHUB_URL = 'https://github.com/srutgers96-star/recepten';
/** "Huishouden" stepper range (a new week slot starts at this many servings). */
const MIN_HOUSEHOLD = 1;
const MAX_HOUSEHOLD = 12;
/**
 * Phase 5 block D: features under construction sit behind this boolean setting (default off).
 * Readers use getSetting('experiments', false); right now that is "Toon QR" on the share screen.
 */
const EXPERIMENTS_KEY = 'experiments';

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

/** "Woordenboek": builtin + own counts; the row opens the dictionary screen (A-bis.6: own entries
 *  editable, "Fuseer met bestaand", "Opruimen"). */
function DictionarySection() {
  const own = userIngredients.value;
  const builtin = baseDictionary().ingredients.length;
  return (
    <section class="section">
      <h2>{t('more.dictionary')}</h2>
      <div class="menu">
        <MenuRow label={t('more.dictCounts', { builtin, own: own.length })} sub={t('more.dictHint')} to="/more/dictionary" />
      </div>
    </section>
  );
}

export function MoreScreen() {
  const active = activeProfile.value;
  const others = profiles.value.filter((p) => p.id !== active?.id);
  const [fahrenheit, setF] = useState(false);
  const [household, setHousehold] = useState<number | null>(null);
  const [experiments, setExperiments] = useState(false);

  const unsent = unsentChanges.value;
  const unseen = inboxUnseen.value;
  const backupDue = backupStatus.value?.overdue === true;

  useEffect(() => {
    void loadCelebrateSettings();
    // Phase 5 block C: the badges switch mirrors the setting 'badges.enabled' (idempotent load).
    void loadBadgeSettings();
    // Phase 5 block B: read-aloud, voice commands, timer sound & vibrate (all idempotent loads).
    void loadSpeechSettings();
    void loadVoiceSettings();
    void loadSoundSettings();
    void getFahrenheit().then(setF, (e: unknown) => console.error('getFahrenheit', e));
    void getHouseholdServings().then(setHousehold, (e: unknown) => console.error('getHouseholdServings', e));
    // Phase 5 block D: the experiments flag (default off), same pattern as the °F switch.
    void getSetting<unknown>(EXPERIMENTS_KEY, false).then(
      (v) => setExperiments(v === true),
      (e: unknown) => console.error('getExperiments', e),
    );
    void refreshShareBadges();
  }, []);

  function toggleFahrenheit(on: boolean) {
    setF(on);
    void setFahrenheit(on).catch((e: unknown) => console.error('setFahrenheit', e));
  }

  function toggleExperiments(on: boolean) {
    setExperiments(on);
    void setSetting(EXPERIMENTS_KEY, on === true).catch((e: unknown) => console.error('setExperiments', e));
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
            {/* Phase 5 (docs/phase-5-spec.md A.8): the household (name + members). */}
            <MenuRow label={t('more.householdRow')} sub={t('more.householdRowHint')} to="/more/household" />
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
          {/* Phase 5 block C: badges off = no badge row, no Home card, no toast (PLAN §0 Gamification). */}
          <label class="setting">
            <div class="label">
              {t('more.badges')}
              <small>{t('more.badgesHint')}</small>
            </div>
            <span class="switch">
              <input type="checkbox" checked={badgesEnabled.value} onChange={(e) => void setBadgesEnabled((e.currentTarget as HTMLInputElement).checked)} />
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

        {/* Phase 5 block B (docs/phase-5-spec.md B.1–B.3): read-aloud, voice commands, timer sound. */}
        <section class="section">
          <h2>{t('more.cookTimer')}</h2>
          {canSpeak() ? (
            <label class="setting">
              <div class="label">
                {t('more.readAloud')}
                <small>{t('more.readAloudHint')}</small>
              </div>
              <span class="switch">
                <input type="checkbox" checked={readAloud.value} onChange={(e) => void setReadAloud((e.currentTarget as HTMLInputElement).checked)} />
                <span class="track" />
              </span>
            </label>
          ) : (
            <div class="setting unavailable">
              <div class="label">{t('more.readAloudUnavailable')}</div>
            </div>
          )}
          {canListen() ? (
            <label class="setting">
              <div class="label">
                {t('more.voiceCommands')}
                <small>{t('more.voiceCommandsHint')}</small>
              </div>
              <span class="switch">
                <input type="checkbox" checked={commandsEnabled.value} onChange={(e) => void setCommandsEnabled((e.currentTarget as HTMLInputElement).checked)} />
                <span class="track" />
              </span>
            </label>
          ) : (
            /* Realistic outcome on iPhone: no SpeechRecognition — say so instead of hiding the row. */
            <div class="setting unavailable">
              <div class="label">{t('more.voiceUnavailable')}</div>
            </div>
          )}
          <div class="setting setting-stack">
            <div class="label">
              {t('more.timerSound')}
              {/* iOS only: the side silent switch mutes web audio; the notification is the only way (invariant 13). */}
              {isIOS() && <small>{t('more.timerSoundIOSHint')}</small>}
            </div>
            <div class="timer-sound-row">
              <Segmented<TimerSound>
                name="timerSound"
                options={[
                  { value: 'beeps', label: t('more.timerSound.beeps') },
                  { value: 'bell', label: t('more.timerSound.bell') },
                  { value: 'melody', label: t('more.timerSound.melody') },
                  { value: 'off', label: t('more.timerSound.off') },
                ]}
                selected={[timerSound.value]}
                onChange={(v) => {
                  if (v[0]) void setTimerSound(v[0]);
                }}
              />
              <button type="button" class="btn" disabled={timerSound.value === 'off'} onClick={() => previewTimerSound(timerSound.value)}>
                {t('more.timerSoundPreview')}
              </button>
            </div>
          </div>
          <label class="setting">
            <div class="label">
              {t('more.timerVibrate')}
              <small>{t('more.timerVibrateHint')}</small>
            </div>
            <span class="switch">
              <input type="checkbox" checked={timerVibrate.value} onChange={(e) => void setTimerVibrate((e.currentTarget as HTMLInputElement).checked)} />
              <span class="track" />
            </span>
          </label>
        </section>

        <DictionarySection />

        <section class="section menu">
          {/* Phase 5 block C: only while the switch above is on — off means no trace of gamification. */}
          {badgesEnabled.value && <MenuRow label={`🏆 ${t('more.badges')}`} sub={t('more.badgesRowHint')} to="/more/badges" />}
          <MenuRow label={t('more.sendNew')} sub={t('more.sendNewHint')} to="/share" badge={unsent > 0 ? String(unsent > 99 ? '99+' : unsent) : undefined} />
          {/* Phase 5 (docs/phase-5-spec.md A.6): suggested category + diet tags per own recipe. */}
          <MenuRow label={t('more.checkRecipes')} sub={t('more.checkRecipesHint')} to="/more/check-recipes" />
          {/* Phase 5 block D (docs/phase-5-spec.md D.4): the English texts of the classics, for Gabi. */}
          <MenuRow label={t('more.curator')} sub={t('more.curatorHint')} to="/more/curator" />
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
          {/* Phase 5 block D: experiments flag — features under construction (now: QR on the share screen). */}
          <label class="setting">
            <div class="label">
              {t('more.experiments')}
              <small>{t('more.experimentsHint')}</small>
            </div>
            <span class="switch">
              <input type="checkbox" checked={experiments} onChange={(e) => toggleExperiments((e.currentTarget as HTMLInputElement).checked)} />
              <span class="track" />
            </span>
          </label>
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
