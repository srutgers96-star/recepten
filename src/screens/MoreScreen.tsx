// '#/more' — the Inbox row on top (with the unseen badge; phase 4 moved the Inbox tab here), then —
// phase 6 (docs/phase-6-spec.md 6A.6) — four collapsible groups whose open/closed state is kept per
// device in localStorage, with the "Opslag & back-up" row (backup-due badge) as a plain row between
// them (a group holding one row of the same name was two taps for one):
//   "Jij & je huishouden"  active profile (switch, "+ profiel"), Profielen beheren, Huishouden,
//                          🏆 Badges row (phase 5 block C, only while the badges switch is on),
//                          "Aantal personen" stepper (phase 4 week slots)
//   "Instellingen"         language, theme, confetti, badges switch, °F, "Kookstand & timer"
//                          (read-aloud, voice commands, timer sound & vibrate — phase 5 block B),
//                          experiments switch (phase 5 block D)
//   "Recepten & delen"     "Deel je nieuwe recepten" (unsent badge), Controleer mijn recepten,
//                          Woordenboek (counts → '/more/dictionary', phase 5 A-bis.6)
//   — Opslag & back-up —   one row → '/more/storage'
//   "Hulp & over"          Feedback voor Stijn (sheet, 6A.7), ☕ Steun dit project (bunq link),
//                          "Testen & nakijken" = Apparaatcheck + Curator, Het verhaal, and "Over"
//                          (version, channel, build, GitHub)
// A closed group shows its badge (unsent) on the group head, so nothing gets lost. The group head
// is an <h2> wrapping the toggle button (not a heading inside a button, which screen readers drop
// from their headings list), the standard disclosure pattern.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
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
import { isStandalone } from '@/pwa';
import { navigate } from '@/router';
import { copyText, shareText } from '@/share-actions';
import { loadSoundSettings, previewTimerSound, setTimerSound, setTimerVibrate, timerSound, timerVibrate, type TimerSound } from '@/sounds';
import { canSpeak, loadSpeechSettings, readAloud, setReadAloud } from '@/speech';
import { setTheme, theme, type Theme } from '@/theme';
import { canListen, commandsEnabled, loadVoiceSettings, setCommandsEnabled } from '@/voice';
import { Avatar } from './ProfilesScreen';

const GITHUB_URL = 'https://github.com/srutgers96-star/recepten';
/**
 * Phase 6 (docs/phase-6-spec.md "Besluiten": donate button). A plain link to Stijn's public bunq
 * page; no payments inside the app. Shown here and at the bottom of "Het verhaal".
 */
export const DONATE_URL = 'https://bunq.me/StijnRutgers';
/** "Aantal personen" stepper range (a new week slot starts at this many servings). */
const MIN_HOUSEHOLD = 1;
const MAX_HOUSEHOLD = 12;
/**
 * Phase 5 block D: features under construction sit behind this boolean setting (default off).
 * Readers use getSetting('experiments', false); right now that is "Toon QR" on the share screen.
 */
const EXPERIMENTS_KEY = 'experiments';

// --- Collapsible groups (6A.6) ------------------------------------------------------------------

type GroupId = 'you' | 'settings' | 'recipes' | 'help';
type GroupState = Record<GroupId, boolean>;

/** Per-device open/closed state (not a profile setting: it is about this screen on this phone). */
const GROUPS_KEY = 'recepten.more.groups';
/** First visit: the daily groups open, the rest folded; the badges on a closed head keep it honest. */
const DEFAULT_OPEN: GroupState = { you: true, settings: false, recipes: true, help: false };
const GROUP_IDS: readonly GroupId[] = ['you', 'settings', 'recipes', 'help'];

function loadGroupState(): GroupState {
  const out: GroupState = { ...DEFAULT_OPEN };
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return out;
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object') {
      for (const id of GROUP_IDS) {
        const b = (v as Record<string, unknown>)[id];
        if (typeof b === 'boolean') out[id] = b;
      }
    }
  } catch {
    /* private mode or corrupt value: defaults */
  }
  return out;
}

function saveGroupState(s: GroupState) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function Chevron() {
  return (
    <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function MenuRow(props: { label: string; to?: string; onClick?: () => void; sub?: string; badge?: string; badgeTone?: 'orange' | 'red' }) {
  const { to, onClick } = props;
  return (
    <button type="button" class="row" onClick={onClick ?? (() => to && navigate(to))}>
      <span class="name">
        {props.label}
        {props.sub && <span class="row-sub">{props.sub}</span>}
      </span>
      {props.badge && <span class={'badge menu-badge' + (props.badgeTone === 'red' ? ' badge-next' : '')}>{props.badge}</span>}
      <Chevron />
    </button>
  );
}

/**
 * One collapsible group: the head is an h2 wrapping a 48 px button (title + optional badge +
 * chevron) — the heading stays in a screen reader's headings list that way; the body is rendered
 * only while open. The badge shows on the head only while closed — open, the row inside carries it.
 */
function Group(props: { id: GroupId; title: string; open: boolean; onToggle: (id: GroupId) => void; badge?: string; badgeTone?: 'orange' | 'red'; children: ComponentChildren }) {
  const bodyId = `more-group-${props.id}`;
  return (
    <section class={'section more-group' + (props.open ? ' open' : '')}>
      <h2 class="more-group-head">
        <button type="button" aria-expanded={props.open} aria-controls={props.open ? bodyId : undefined} onClick={() => props.onToggle(props.id)}>
          <span class="more-group-title">{props.title}</span>
          {!props.open && props.badge && <span class={'badge menu-badge' + (props.badgeTone === 'red' ? ' badge-next' : '')}>{props.badge}</span>}
          <Chevron />
        </button>
      </h2>
      {props.open && (
        <div class="more-group-body" id={bodyId}>
          {props.children}
        </div>
      )}
    </section>
  );
}

// --- Feedback (6A.7) ----------------------------------------------------------------------------

/**
 * "iPhone · iOS 26.0 · Safari 26" from the user agent: platform and browser only, no identifiers.
 * `ipadAsMac` is the iPadOS-13+ case (Mac user agent with touch points), where the UA carries no
 * iPadOS version. Order matters for the browser: Edge, Samsung Internet and Chrome all also say
 * "Safari"; Chrome / Firefox on iOS are "CriOS" / "FxiOS".
 */
export function describeDevice(ua: string, ipadAsMac = false): string {
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  const iosVersion = () => {
    const v = /OS (\d+)[._](\d+)/.exec(ua);
    return v ? ` ${v[1]}.${v[2]}` : '';
  };
  if (/iPhone/.test(ua)) parts.push('iPhone', `iOS${iosVersion()}`);
  else if (/iPad/.test(ua)) parts.push('iPad', `iPadOS${iosVersion()}`);
  else if (ipadAsMac) parts.push('iPad');
  else if ((m = /Android (\d+(?:\.\d+)?)/.exec(ua))) parts.push(`Android ${m[1]}`);
  else if (/Android/.test(ua)) parts.push('Android');
  else if (/Windows/.test(ua)) parts.push('Windows');
  else if (/Mac OS X/.test(ua)) parts.push('Mac');
  else if (/Linux/.test(ua)) parts.push('Linux');

  if ((m = /Edg\/(\d+)/.exec(ua))) parts.push(`Edge ${m[1]}`);
  else if ((m = /SamsungBrowser\/(\d+)/.exec(ua))) parts.push(`Samsung Internet ${m[1]}`);
  else if ((m = /(?:Firefox|FxiOS)\/(\d+)/.exec(ua))) parts.push(`Firefox ${m[1]}`);
  else if ((m = /(?:Chrome|CriOS)\/(\d+)/.exec(ua))) parts.push(`Chrome ${m[1]}`);
  else if ((m = /Version\/(\d+)\S* .*Safari/.exec(ua))) parts.push(`Safari ${m[1]}`);
  else if (/Safari/.test(ua)) parts.push('Safari');
  return parts.join(' · ');
}

/** The lines the app appends under the feedback: version, channel, build and the device. */
function feedbackFooter(): string {
  const device = describeDevice(navigator.userAgent, isIOS() && !/iP(hone|ad|od)/.test(navigator.userAgent));
  const where = t(isStandalone() ? 'feedback.installed' : 'feedback.inBrowser');
  return [`${t('feedback.app')}: ${t('app.title')} ${appInfo.version} (${appInfo.channel}, build ${appInfo.sha})`, `${t('feedback.device')}: ${[device, where].filter(Boolean).join(' · ')}`].join('\n');
}

/**
 * Bottom sheet with one textarea. "Verstuur" hands the text (+ footer) to the share sheet as
 * exactly `{ text }` (invariant 9), so the person picks Stijn in WhatsApp or mail themselves: no
 * phone number or address lives in the code (the repo and the site are public). Without a share
 * API there is only the copy button. Uses the .sheet-* shell of base.css.
 */
function FeedbackSheet(props: { onClose: () => void }) {
  const { onClose } = props;
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const canShare = typeof navigator.share === 'function';
  const footer = feedbackFooter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it in the textarea on open and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    area.current?.focus({ preventScroll: true });
    return () => opener?.focus();
  }, []);

  function compose(): string | null {
    const body = text.trim();
    if (!body) {
      setStatus(t('feedback.empty'));
      return null;
    }
    return `${t('feedback.header')}\n\n${body}\n\n—\n${footer}`;
  }

  function send() {
    if (busy) return;
    const msg = compose();
    if (!msg) return;
    setBusy(true);
    setStatus('');
    // navigator.share runs before the first await inside shareText: still within the tap.
    void shareText(msg)
      .then((r) => {
        if (r.outcome === 'shared') setStatus(t('feedback.sent'));
        else if (r.outcome === 'failed') setStatus(`${t('common.error')}: ${r.error ?? ''}`);
      })
      .finally(() => setBusy(false));
  }

  function copy() {
    const msg = compose();
    if (!msg) return;
    void copyText(msg).then((r) => setStatus(r.ok ? t('feedback.copied') : `${t('common.error')}: ${r.error ?? ''}`));
  }

  return (
    <div class="sheet-backdrop no-print" onClick={onClose}>
      <div class="sheet feedback-sheet" role="dialog" aria-modal="true" aria-label={t('more.feedback')} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{t('more.feedback')}</h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={onClose}>
            ×
          </button>
        </div>
        <div class="sheet-body">
          <p class="muted small feedback-intro">{t('feedback.intro')}</p>
          <textarea ref={area} class="input" value={text} placeholder={t('feedback.placeholder')} aria-label={t('more.feedback')} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} />
          <div class="feedback-auto" aria-label={t('feedback.auto')}>
            <span class="feedback-auto-title">{t('feedback.auto')}</span>
            {footer}
          </div>
          {!canShare && <p class="muted small">{t('feedback.noShare')}</p>}
          <div class="actions">
            {canShare && (
              <button type="button" class="btn btn-primary btn-block" disabled={busy} onClick={send}>
                {t('feedback.send')}
              </button>
            )}
            <button type="button" class={'btn' + (canShare ? '' : ' btn-primary btn-block')} onClick={copy}>
              {t('feedback.copy')}
            </button>
          </div>
          <div class="status" role="status">
            {status}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "☕ Steun dit project" — a plain external link plus its one-line explanation (6A.7 / Besluiten). */
export function DonateBlock(props: { center?: boolean }) {
  return (
    <div class={'donate' + (props.center ? ' center' : '')}>
      <a class="btn" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
        {t('more.donate')}
      </a>
      <p class="muted small">{t('more.donateHint')}</p>
    </div>
  );
}

// --- Screen -------------------------------------------------------------------------------------

export function MoreScreen() {
  const active = activeProfile.value;
  const others = profiles.value.filter((p) => p.id !== active?.id);
  const [fahrenheit, setF] = useState(false);
  const [household, setHousehold] = useState<number | null>(null);
  const [experiments, setExperiments] = useState(false);
  const [groups, setGroups] = useState<GroupState>(loadGroupState);
  const [feedback, setFeedback] = useState(false);

  const unsent = unsentChanges.value;
  const unseen = inboxUnseen.value;
  const backupDue = backupStatus.value?.overdue === true;
  const unsentBadge = unsent > 0 ? String(unsent > 99 ? '99+' : unsent) : undefined;
  const backupBadge = backupDue ? t('more.backupDue') : undefined;

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

  function toggleGroup(id: GroupId) {
    setGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveGroupState(next);
      return next;
    });
  }

  function toggleFahrenheit(on: boolean) {
    setF(on);
    void setFahrenheit(on).catch((e: unknown) => console.error('setFahrenheit', e));
  }

  function toggleExperiments(on: boolean) {
    setExperiments(on);
    void setSetting(EXPERIMENTS_KEY, on === true).catch((e: unknown) => console.error('setExperiments', e));
  }

  /** "Aantal personen": the servings a new week slot starts with (spec §0 `household.servings`). */
  function changeHousehold(delta: number) {
    const next = Math.min(MAX_HOUSEHOLD, Math.max(MIN_HOUSEHOLD, (household ?? 4) + delta));
    setHousehold(next);
    void setHouseholdServings(next).catch((e: unknown) => console.error('setHouseholdServings', e));
  }

  const own = userIngredients.value;
  const builtin = baseDictionary().ingredients.length;

  return (
    <>
      <Header title={t('more.title')} />
      <div class="screen more">
        {/* Phase 4: the Inbox moved here from the bottom nav; its unseen badge follows. Stays on top. */}
        <section class="section menu more-inbox">
          <MenuRow label={t('more.inbox')} sub={t('more.inboxHint')} to="/inbox" badge={unseen > 0 ? String(unseen > 99 ? '99+' : unseen) : undefined} />
        </section>

        <Group id="you" title={t('more.group.you')} open={groups.you} onToggle={toggleGroup}>
          <div class="card">
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
              {/* Phase 5 block C: only while the badges switch (under Instellingen) is on — off means no trace of gamification. */}
              {badgesEnabled.value && <MenuRow label={`🏆 ${t('more.badges')}`} sub={t('more.badgesRowHint')} to="/more/badges" />}
            </div>
          </div>
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
        </Group>

        <Group id="settings" title={t('more.settings')} open={groups.settings} onToggle={toggleGroup}>
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

          {/* Phase 5 block B (docs/phase-5-spec.md B.1–B.3): read-aloud, voice commands, timer sound. */}
          <h3 class="more-sub">{t('more.cookTimer')}</h3>
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
        </Group>

        <Group id="recipes" title={t('more.group.recipes')} open={groups.recipes} onToggle={toggleGroup} badge={unsentBadge}>
          <div class="menu">
            <MenuRow label={t('more.sendNew')} sub={t('more.sendNewHint')} to="/share" badge={unsentBadge} />
            {/* Phase 5 (docs/phase-5-spec.md A.6): suggested category + diet tags per own recipe. */}
            <MenuRow label={t('more.checkRecipes')} sub={t('more.checkRecipesHint')} to="/more/check-recipes" />
            {/* "Woordenboek": builtin + own counts; opens the dictionary screen (A-bis.6: own entries
                editable, "Fuseer met bestaand", "Opruimen"). */}
            <MenuRow label={t('more.dictionary')} sub={`${t('more.dictCounts', { builtin, own: own.length })} · ${t('more.dictHint')}`} to="/more/dictionary" />
          </div>
        </Group>

        {/* "Opslag & back-up" is one row between the groups, not a group: a group with a single row
            of the same name was two taps for one. The backup-due badge sits on the row. */}
        <section class="section menu more-storage">
          <MenuRow label={t('more.storage')} sub={t('more.storageHint')} to="/more/storage" badge={backupBadge} badgeTone="red" />
        </section>

        <Group id="help" title={t('more.group.help')} open={groups.help} onToggle={toggleGroup}>
          <div class="menu">
            {/* 6A.7: opens the feedback sheet below (no route: it is a small dialog, not a screen). */}
            <MenuRow label={t('more.feedback')} sub={t('more.feedbackHint')} onClick={() => setFeedback(true)} />
          </div>
          <DonateBlock />
          <h3 class="more-sub">{t('more.testing')}</h3>
          <div class="menu">
            <MenuRow label={t('more.check')} to="/check" />
            {/* Phase 5 block D (docs/phase-5-spec.md D.4): the English texts of the classics, for Gabi. */}
            <MenuRow label={t('more.curator')} sub={t('more.curatorHint')} to="/more/curator" />
          </div>
          <div class="menu">
            <MenuRow label={t('more.story')} to="/story" />
          </div>
          <div class="about">
            <h3 class="more-sub">{t('more.about')}</h3>
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
          </div>
        </Group>
      </div>
      {feedback && <FeedbackSheet onClose={() => setFeedback(false)} />}
    </>
  );
}
