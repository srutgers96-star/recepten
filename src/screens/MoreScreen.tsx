// '#/more' — the Inbox row on top (with the unseen badge; phase 4 moved the Inbox tab here), then —
// phase 6 (docs/phase-6-spec.md 6A.6) — four collapsible groups whose open/closed state is kept per
// device in localStorage, with the "Opslag & back-up" row (backup-due badge) as a plain row between
// them (a group holding one row of the same name was two taps for one):
//   "Jij & je huishouden"  (V1b, docs/specs/verbeterronde-1b.md §1a) a centred profile block (avatar,
//                          name, level title → '/more/profile'), the sub-head row "Huishouden &
//                          vrienden" (→ '/more/household'), the housemates and the friends as smaller
//                          rows with a "huisgenoot"/"vriend" tag (or one "Voeg een huisgenoot toe"
//                          row), the row "Profielen op deze telefoon" (only with more than one
//                          profile), 📅 Kookkalender, "Aantal personen" stepper (phase 4 week slots).
//                          The 🏆 Badges row went in V1 and 🎨 Jouw stijl in V1b: both are tiles on
//                          Mijn profiel (the routes '/more/badges' and '/more/style' stay).
//   "Instellingen"         language, confetti (the word opens the confetti styles), badges (the word
//                          opens Badges), temperature °C | °F | both, "Kookstand & timer" (read-aloud,
//                          voice commands, vibrate — phase 5 block B); the Experimenten switch
//                          (phase 5 block D) went on 8 nov 2026: nothing read it any more since 13Q
//   "Recepten & delen"     "Deel je nieuwe recepten" (unsent badge), Controleer mijn recepten,
//                          Woordenboek (counts → '/more/dictionary', phase 5 A-bis.6)
//   — Opslag & back-up —   one row → '/more/storage'
//   "Hulp & over"          Feedback voor Stijn (sheet, 6A.7), ☕ Steun dit project (bunq link),
//                          "Links openen in de app" (sheet with the steps per phone, 13B),
//                          Apparaatcheck, Het verhaal, and "Over" (version, channel, build, GitHub).
//                          (The Curator page was removed in phase 6, docs/phase-6-spec.md open
//                          question 7; a classic's English is improved via Bewerk on the recipe.)
// 6D-S (docs/specs/badges-avatar.md "S-A" point 4): the profile block (big avatar, chips of the other
// profiles) and the row "🎁 Vrijgespeeld" are gone; the timer sound, the cook-mode typeface, the
// sound on Cooked! and the theme moved to Jouw stijl (src/screens/StyleScreen.tsx, "S-B").
// 6D-4 (docs/specs/xp-levels.md §1j): "📅 Kookkalender" (→ '/more/calendar') closes the menu of
// "Jij & je huishouden", always shown (the calendar is a log; only its levels need badges on).
// A closed group shows its badge (unsent) on the group head, so nothing gets lost. The group head
// is the shared <FoldHead/> (V1 §1a): an <h2> wrapping the toggle button (not a heading inside a
// button, which screen readers drop from their headings list), the standard disclosure pattern.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { badgesEnabled, loadBadgeSettings, setBadgesEnabled, syncCatalogIfNeeded } from '@/badges';
import { confettiEnabled, loadCelebrateSettings, setConfettiEnabled } from '@/celebrate';
import { appInfo, isIOS } from '@/components/AppInfo';
import { browserLabel, OpenInChrome } from '@/components/BrowserNotice';
import { FoldHead } from '@/components/FoldHead';
import { Header, chooseLang } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { levelTitleText } from '@/components/XpBar';
import { SheetPortal } from '@/components/SheetPortal';
import { getHousehold, getHouseholdServings, getProgressSnapshots, getTemperatureMode, setHouseholdServings, setTemperatureMode, type TemperatureMode } from '@/db/repo';
import { baseDictionary, userIngredients } from '@/dictionary';
import { matchMemberForCard, memberFromProfile, membersFrom, type HouseholdSetting, type Member } from '@/domain/household';
import type { Lang } from '@/domain/model';
import type { ProgressSnapshot } from '@/domain/progress';
import { recordFeature } from '@/features';
import { lang, t } from '@/i18n';
import { backupStatus, inboxUnseen, refreshShareBadges, unsentChanges } from '@/inbox-badge';
import { activeProfile, profiles } from '@/profile';
import { browserName, isAndroid, isStandalone } from '@/pwa';
import { navigate } from '@/router';
import { copyText, shareText } from '@/share-actions';
import { loadSoundSettings, setTimerVibrate, timerVibrate } from '@/sounds';
import { canSpeak, loadSpeechSettings, readAloud, setReadAloud } from '@/speech';
import { GOLD_COUNT_FROM, GOLD_TAPS, goldThemeFree, tapCounter, tapsLeft, unlockGoldByMaker, type TapCount } from '@/theme';
import { canListen, commandsEnabled, loadVoiceSettings, setCommandsEnabled } from '@/voice';
import { Avatar, useAvatarLevel } from './ProfilesScreen';

const GITHUB_URL = 'https://github.com/srutgers96-star/recepten';
/**
 * Phase 6 (docs/phase-6-spec.md "Besluiten": donate button). A plain link to Stijn's public bunq
 * page; no payments inside the app. Shown here and at the bottom of "Het verhaal".
 */
export const DONATE_URL = 'https://bunq.me/StijnRutgers';
/** "Aantal personen" stepper range (a new week slot starts at this many servings). */
const MIN_HOUSEHOLD = 1;
const MAX_HOUSEHOLD = 12;
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

function MenuRow(props: {
  label: string;
  to?: string;
  onClick?: () => void;
  sub?: string;
  badge?: string;
  badgeTone?: 'orange' | 'red';
  /** 6D-S: an element before the label (the row Mijn profiel: the small avatar). */
  icon?: ComponentChildren;
  ariaLabel?: string;
  /** V1: an extra class on the row ('row-member': a housemate or friend, a size smaller; V1b
   *  'row-subhead': the sub-head row "Huishouden & vrienden"). */
  extraClass?: string;
  /** V1b: a small tag after the name ("huisgenoot" / "vriend"). */
  tag?: string;
}) {
  const { to, onClick } = props;
  return (
    <button type="button" class={'row' + (props.icon ? ' row-icon' : '') + (props.extraClass ? ' ' + props.extraClass : '')} aria-label={props.ariaLabel} onClick={onClick ?? (() => to && navigate(to))}>
      {props.icon}
      <span class="name">
        {props.label}
        {props.tag && <span class="who-tag">{props.tag}</span>}
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
      <FoldHead
        title={props.title}
        open={props.open}
        onToggle={() => props.onToggle(props.id)}
        controls={bodyId}
        badge={!props.open && props.badge ? <span class={'badge menu-badge' + (props.badgeTone === 'red' ? ' badge-next' : '')}>{props.badge}</span> : undefined}
      />
      {props.open && (
        <div class="more-group-body" id={bodyId}>
          {props.children}
        </div>
      )}
    </section>
  );
}

// --- Housemates and friends under "Huishouden & vrienden" (V1 §1c, V1b §1a) -----------------------

/**
 * One housemate (a member that is not the active profile), a size smaller, tagged "huisgenoot". Under
 * the name, with badges on and a level known: the level line as on Huishouden (a profile on this
 * phone live via `useAvatarLevel`; a member on another phone from its last snapshot, without the
 * "bijgewerkt" date); otherwise "via kaartje" / "met de hand", or nothing for a local profile.
 */
function MemberMenuRow(props: { member: Member; snapshot?: ProgressSnapshot }) {
  const m = props.member;
  const localLevel = useAvatarLevel(m.local ? m.id : null);
  const level = badgesEnabled.value ? (m.local ? localLevel : props.snapshot?.level) : undefined;
  const sub = level !== undefined ? levelTitleText(level) : m.local ? undefined : m.deviceId ? t('household.fromCard') : t('household.byHand');
  return <MenuRow extraClass="row-member" icon={<Avatar profile={m} />} label={m.name} tag={t('more.tagHousemate')} sub={sub} to="/more/household" />;
}

/** One friend (a snapshot kept with "Bewaar als vriend"), tagged "vriend"; with badges on "Level n · titel" under it. */
function FriendMenuRow(props: { snapshot: ProgressSnapshot }) {
  const s = props.snapshot;
  const sub = badgesEnabled.value ? levelTitleText(s.level) : undefined;
  return <MenuRow extraClass="row-member" icon={<Avatar profile={s} />} label={s.name} tag={t('more.friend')} sub={sub} to="/more/household" />;
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
        if (r.outcome === 'shared' || r.outcome === 'no-share-api') void recordFeature('feedback');
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
    <SheetPortal>
      <div class="sheet-backdrop no-print" onClick={onClose}>
        <div class="sheet feedback-sheet" role="dialog" aria-modal="true" aria-label={t('more.feedback')} onClick={(e) => e.stopPropagation()}>
          <div class="sheet-head with-actions">
            <span class="sheet-head-btn" aria-hidden="true" />
            <h2>{t('more.feedback')}</h2>
            <button type="button" class="sheet-head-btn" onClick={onClose}>
              {t('common.close')}
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
    </SheetPortal>
  );
}

// --- "Links openen in de app" (13B) ---------------------------------------------------------------

/**
 * Bottom sheet with the steps per phone, the phone you hold first. Honest on both (CLAUDE.md
 * invariants 5 and 13): Android can usually be told to open links in the app (default browser Chrome,
 * "Ondersteunde links openen") but the app cannot force it; an iPhone always opens Safari, so the
 * route there is copy → app → paste. On Android in another browser than Chrome (and not installed)
 * the sheet also carries the "Open in Chrome" pair. Same .sheet-* shell and keyboard/focus handling
 * as the feedback sheet.
 */
function LinksSheet(props: { onClose: () => void }) {
  const { onClose } = props;
  const ios = isIOS();
  const browser = browserName();
  const showChrome = isAndroid() && !isStandalone() && browser !== 'chrome';
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it on the close button and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => opener?.focus();
  }, []);

  const android = (
    <section class="links-platform" aria-labelledby="links-android">
      <h3 id="links-android">{t('links.android')}</h3>
      <ol>
        <li>{t('browser.android.install')}</li>
        <li>{t('links.android.step2')}</li>
        <li>{t('links.android.step3')}</li>
        <li>{t('links.android.step4')}</li>
      </ol>
      <p class="muted small">{t('links.android.honest')}</p>
      {showChrome && (
        <>
          <p class="links-now">{t('links.nowIn', { browser: browserLabel(browser) })}</p>
          <OpenInChrome />
        </>
      )}
    </section>
  );
  const iphone = (
    <section class="links-platform" aria-labelledby="links-ios">
      <h3 id="links-ios">{t('links.ios')}</h3>
      <p>{t('links.ios.honest')}</p>
      <ol>
        <li>{t('links.ios.step1')}</li>
        <li>{t('links.ios.step2')}</li>
        <li>{t('links.ios.step3')}</li>
        <li>{t('links.ios.step4')}</li>
      </ol>
      <p class="muted small">{t('links.ios.alt')}</p>
    </section>
  );

  return (
    <SheetPortal>
      <div class="sheet-backdrop no-print" onClick={onClose}>
        <div class="sheet links-sheet" role="dialog" aria-modal="true" aria-label={t('more.links')} onClick={(e) => e.stopPropagation()}>
          <div class="sheet-head with-actions">
            <span class="sheet-head-btn" aria-hidden="true" />
            <h2>{t('more.links')}</h2>
            <button ref={closeBtn} type="button" class="sheet-head-btn" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
          <div class="sheet-body">
            <p class="muted small links-intro">{t('links.intro')}</p>
            {/* The phone in hand first; the other one below for whoever reads along. */}
            {ios ? iphone : android}
            {ios ? android : iphone}
          </div>
        </div>
      </div>
    </SheetPortal>
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
  // V1b §1a: °C | °F | both (null until read).
  const [tempMode, setTempMode] = useState<TemperatureMode | null>(null);
  const [household, setHousehold] = useState<number | null>(null);
  const [groups, setGroups] = useState<GroupState>(loadGroupState);
  const [feedback, setFeedback] = useState(false);
  const [links, setLinks] = useState(false);
  // V1 §1c: the household setting and the progress snapshots, read once on mount (as Huishouden does).
  const [householdSetting, setHouseholdSetting] = useState<HouseholdSetting | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, ProgressSnapshot>>({});
  // 6D-S: the row Mijn profiel shows the level ring and, with badges on, the level title.
  const level = useAvatarLevel(active?.id);
  // V5 §1d: the maker's egg — taps on Versie (less than 2 s apart) count; 33 unlocks the gold theme.
  const taps = useRef<TapCount | null>(null);
  const [egg, setEgg] = useState<{ kind: 'count'; left: number } | { kind: 'unlocked' | 'already' } | null>(null);

  function onVersionTap() {
    // The result stays until you leave the screen (§1d); later taps change nothing.
    if (egg !== null && egg.kind !== 'count') return;
    const next = tapCounter(taps.current, Date.now());
    taps.current = next;
    if (next.count >= GOLD_TAPS) {
      if (goldThemeFree()) {
        setEgg({ kind: 'already' });
        return;
      }
      setEgg({ kind: 'unlocked' });
      void unlockGoldByMaker().catch((e: unknown) => console.error('unlockGoldByMaker', e));
      return;
    }
    setEgg(next.count >= GOLD_COUNT_FROM ? { kind: 'count', left: tapsLeft(next.count) } : null);
  }

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
    void getTemperatureMode().then(setTempMode, (e: unknown) => console.error('getTemperatureMode', e));
    void getHouseholdServings().then(setHousehold, (e: unknown) => console.error('getHouseholdServings', e));
    void refreshShareBadges();
    void getHousehold().then(setHouseholdSetting, (e: unknown) => console.error('getHousehold', e));
    void getProgressSnapshots().then(setSnapshots, (e: unknown) => console.error('getProgressSnapshots', e));
  }, []);

  function toggleGroup(id: GroupId) {
    setGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveGroupState(next);
      return next;
    });
  }

  function chooseTemperature(mode: TemperatureMode) {
    setTempMode(mode);
    void setTemperatureMode(mode).catch((e: unknown) => console.error('setTemperatureMode', e));
    if (mode !== 'c') void recordFeature('fahrenheit');
  }

  /** "Aantal personen": the servings a new week slot starts with (spec §0 `household.servings`). */
  function changeHousehold(delta: number) {
    const next = Math.min(MAX_HOUSEHOLD, Math.max(MIN_HOUSEHOLD, (household ?? 4) + delta));
    setHousehold(next);
    void setHouseholdServings(next).catch((e: unknown) => console.error('setHouseholdServings', e));
  }

  const own = userIngredients.value;
  const builtin = baseDictionary().ingredients.length;
  // Badges on and the level known: "Level 5 · Boterhamsmeerder" under the name (badges off: no trace of XP).
  const levelSub = badgesEnabled.value && level !== undefined ? levelTitleText(level) : undefined;
  // V1 §1c: every member except the active profile (local profiles and members by card or by hand),
  // and the friends (a friend who has since become a member shows as a member only, as on Huishouden).
  const profileList = profiles.value;
  const members = householdSetting ? membersFrom(profileList, householdSetting) : profileList.map(memberFromProfile);
  const housemates = members.filter((m) => m.id !== active?.id);
  const friends = Object.values(snapshots)
    .filter((s) => s.friend && !matchMemberForCard(members, s))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <Header title={t('more.title')} />
      <div class="screen more">
        {/* Phase 4: the Inbox moved here from the bottom nav; its unseen badge follows. Stays on top. */}
        <section class="section menu more-inbox">
          <MenuRow label={t('more.inbox')} sub={t('more.inboxHint')} to="/inbox" badge={unseen > 0 ? String(unseen > 99 ? '99+' : unseen) : undefined} />
        </section>

        <Group id="you" title={t('more.group.you')} open={groups.you} onToggle={toggleGroup}>
          {/* V1b §1a: the active profile as a centred block (avatar, name, level title) → Mijn profiel. */}
          <button
            type="button"
            class="more-profile"
            aria-label={active ? `${t('more.myProfile')}: ${active.name}${levelSub ? ', ' + levelSub : ''}` : undefined}
            onClick={() => navigate('/more/profile')}
          >
            {active && <Avatar profile={active} level={level} />}
            <span class="more-profile-name">{active ? active.name : t('more.myProfile')}</span>
            {active && levelSub && <span class="more-profile-level muted small">{levelSub}</span>}
          </button>
          <div class="menu">
            {/* V1b §1a: the sub-head row "Huishouden & vrienden" (→ Huishouden), then the housemates
                and the friends, each with a small tag after the name. */}
            <MenuRow extraClass="row-subhead" label={t('more.householdFriends')} to="/more/household" />
            {housemates.map((m) => (
              <MemberMenuRow key={m.id} member={m} snapshot={snapshots[m.id]} />
            ))}
            {friends.map((s) => (
              <FriendMenuRow key={s.id} snapshot={s} />
            ))}
            {housemates.length === 0 && friends.length === 0 && <MenuRow label={t('more.householdRowEmpty')} to="/more/household" />}
            {/* V1 §1c point 5: the Profielen page only for a phone that already holds more than one
                profile (from before V1); with exactly one there is no trace of it. */}
            {profileList.length > 1 && <MenuRow label={t('more.profilesHere')} sub={t('more.profilesHereHint', { n: profileList.length })} to="/more/profiles" />}
            {/* 6D-4 (docs/specs/xp-levels.md §1j): the cooking calendar, ALWAYS (also with badges off: it is a log). */}
            <MenuRow label={`📅 ${t('more.calendar')}`} to="/more/calendar" />
          </div>
          <div class="setting">
            <div class="label">
              {t('more.household')}
            </div>
            <div class="household-step" role="group" aria-label={t('more.household')}>
              <button type="button" class="servings-step" aria-label={t('more.householdLess')} disabled={household === null || household <= MIN_HOUSEHOLD} onClick={() => changeHousehold(-1)}>
                −
              </button>
              <span class="value" aria-live="polite">
                {household === null ? '…' : household === 1 ? t('more.householdValueOne') : t('more.householdValue', { n: household })}
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
          {/* V1b §1a: the word opens the confetti styles in Jouw stijl; the switch is a label of its own. */}
          <div class="setting">
            <button type="button" class="label label-link" onClick={() => navigate('/more/style?tab=confetti')}>
              <span class="label-link-title">{t('more.confetti')}</span>
            </button>
            <label class="switch">
              <input type="checkbox" aria-label={t('more.confetti')} checked={confettiEnabled.value} onChange={(e) => void setConfettiEnabled((e.currentTarget as HTMLInputElement).checked)} />
              <span class="track" />
            </label>
          </div>
          {/* Phase 5 block C: badges off = no badge row, no Home card, no toast (PLAN §0 Gamification).
              V1b §1a: the word opens Badges. */}
          <div class="setting">
            <button type="button" class="label label-link" onClick={() => navigate('/more/badges')}>
              <span class="label-link-title">{t('more.badges')}</span>
              <small>{t('more.badgesHint')}</small>
            </button>
            <label class="switch">
              <input
                type="checkbox"
                aria-label={t('more.badges')}
                checked={badgesEnabled.value}
                onChange={(e) => {
                  const on = (e.currentTarget as HTMLInputElement).checked;
                  // 6D-2c: off → on with `badges.catalogSynced` below 2 first registers what was reached
                  // so far silently, then sets the flag (syncCatalogIfNeeded is a no-op otherwise).
                  void setBadgesEnabled(on)
                    .then(() => (on ? syncCatalogIfNeeded() : undefined))
                    .catch((err: unknown) => console.error('setBadgesEnabled', err));
                }}
              />
              <span class="track" />
            </label>
          </div>
          {/* V1b §1a: °C | °F | both instead of the "°F erbij" switch. */}
          <div class="setting">
            <div class="label">
              {t('more.temperature')}
            </div>
            <Segmented<TemperatureMode>
              name="temperature"
              options={[
                { value: 'c', label: t('more.temperatureC') },
                { value: 'f', label: t('more.temperatureF') },
                { value: 'both', label: t('more.temperatureBoth') },
              ]}
              selected={tempMode ? [tempMode] : []}
              onChange={(v) => {
                if (v[0]) chooseTemperature(v[0]);
              }}
            />
          </div>

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
          <label class="setting">
            <div class="label">
              {t('more.timerVibrate')}
            </div>
            <span class="switch">
              <input type="checkbox" checked={timerVibrate.value} onChange={(e) => void setTimerVibrate((e.currentTarget as HTMLInputElement).checked)} />
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
            {/* Block Z (docs/specs/handbook.md §1): the handbook, the first row of Hulp & over. */}
            <MenuRow label={`📖 ${t('more.handbook')}`} to="/more/handbook" />
            {/* 6A.7: opens the feedback sheet below (no route: it is a small dialog, not a screen). */}
            <MenuRow label={t('more.feedback')} onClick={() => setFeedback(true)} />
          </div>
          <DonateBlock />
          <div class="menu">
            {/* 13B: the steps per phone to get a share link into the app (sheet, no route). */}
            <MenuRow label={t('more.links')} sub={t('more.linksHint')} onClick={() => setLinks(true)} />
            <MenuRow label={t('more.check')} to="/check" />
            <MenuRow label={t('more.story')} to="/story" />
          </div>
          <div class="about">
            <h3 class="more-sub">{t('more.about')}</h3>
            <dl>
              <dt>{t('more.version')}</dt>
              <dd>
                <button type="button" class="about-version" onClick={onVersionTap}>
                  {appInfo.version}
                </button>
              </dd>
              <dt>{t('more.channel')}</dt>
              <dd>{appInfo.channel}</dd>
              <dt>{t('more.build')}</dt>
              <dd>{appInfo.sha}</dd>
            </dl>
            {egg?.kind === 'count' && <p class="muted small about-egg">{t('more.goldCount', { n: egg.left })}</p>}
            {egg !== null && egg.kind !== 'count' && (
              <p class="muted small about-egg" role="status">
                {t(egg.kind === 'unlocked' ? 'more.goldUnlocked' : 'more.goldAlready')}
              </p>
            )}
            <div class="actions" style="margin-top:12px">
              <a class="btn" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                {t('more.github')}
              </a>
            </div>
          </div>
        </Group>
      </div>
      {feedback && <FeedbackSheet onClose={() => setFeedback(false)} />}
      {links && <LinksSheet onClose={() => setLinks(false)} />}
    </>
  );
}
