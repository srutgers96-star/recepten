// '#/check' — the Apparaatcheck / Device check page (PLAN.md §3b), usable by either phone owner
// alone: auto-detected facts, a 30 s test timer, three manual timer rows, the §3b checklist and a
// copy/share of a plain-text report (formatted in src/domain/devicecheck.ts).
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { appInfo } from '@/components/AppInfo';
import { Segmented } from '@/components/Segmented';
import { lang, t } from '@/i18n';
import { isStandalone } from '@/pwa';
import { startTestTimer, stopTestTimer, timerEndAt, timerFired, timerNow } from '@/testtimer';
import { isCompressionStreamAvailable } from '@/domain/token';
import {
  CHECKLIST_ITEMS,
  TIMER_OUTCOMES,
  TIMER_SCENARIOS,
  emptyAnswers,
  formatReport,
  normalizeAnswers,
  type DeviceCheckAnswers,
  type Fact,
  type TimerOutcome,
  type TimerScenario,
  type Verdict,
} from '@/domain/devicecheck';

const ANSWERS_KEY = 'recepten.devicecheck';

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function loadAnswers(): DeviceCheckAnswers {
  const raw = lsGet(ANSWERS_KEY);
  try {
    return normalizeAnswers(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyAnswers();
  }
}

const FACT_LABELS = {
  nl: {
    ua: 'User agent',
    standalone: 'Standalone (geïnstalleerd)',
    persisted: 'storage.persisted()',
    persist: 'storage.persist()',
    compression: 'CompressionStream',
    share: 'navigator.share',
    canShare: 'canShare({text})',
    clipboard: 'Klembord lezen / schrijven',
    notification: 'Meldingstoestemming',
    wakeLock: 'Wake lock',
    sw: 'Service worker actief',
    channel: 'Kanaal / versie / sha',
    screen: 'Scherm / viewport / dpr',
    safeArea: 'Safe-area (b/r/o/l)',
    online: 'Netwerk',
    language: 'Taal toestel',
    dark: 'Donkere modus',
  },
  en: {
    ua: 'User agent',
    standalone: 'Standalone (installed)',
    persisted: 'storage.persisted()',
    persist: 'storage.persist()',
    compression: 'CompressionStream',
    share: 'navigator.share',
    canShare: 'canShare({text})',
    clipboard: 'Clipboard read / write',
    notification: 'Notification permission',
    wakeLock: 'Wake lock',
    sw: 'Service worker controlling',
    channel: 'Channel / version / sha',
    screen: 'Screen / viewport / dpr',
    safeArea: 'Safe area (t/r/b/l)',
    online: 'Network',
    language: 'Device language',
    dark: 'Dark mode',
  },
} as const;

async function collectFacts(probe: HTMLElement | null, l: 'nl' | 'en'): Promise<Fact[]> {
  const L = FACT_LABELS[l];
  const yes = t('common.yes');
  const no = t('common.no');
  const unknown = t('common.unknown');
  const yn = (b: boolean) => (b ? yes : no);

  let persisted = unknown;
  let persist = unknown;
  try {
    if (navigator.storage?.persisted) persisted = yn(await navigator.storage.persisted());
    if (navigator.storage?.persist) persist = yn(await navigator.storage.persist());
  } catch (e) {
    persist = String(e);
  }

  let canShare = no;
  try {
    canShare = typeof navigator.canShare === 'function' ? yn(navigator.canShare({ text: 'x' })) : unknown;
  } catch {
    canShare = no;
  }

  let sw = no;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      sw = navigator.serviceWorker.controller ? yes : reg ? `${no} (registered)` : no;
    }
  } catch {
    sw = unknown;
  }

  let safe = unknown;
  if (probe) {
    const cs = getComputedStyle(probe);
    safe = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' ');
  }

  const clip = `${typeof navigator.clipboard?.readText === 'function' ? yes : no} / ${typeof navigator.clipboard?.writeText === 'function' ? yes : no}`;

  return [
    { label: L.ua, value: navigator.userAgent },
    { label: L.standalone, value: yn(isStandalone()) },
    { label: L.persisted, value: persisted },
    { label: L.persist, value: persist },
    { label: L.compression, value: yn(isCompressionStreamAvailable()) },
    { label: L.share, value: yn(typeof navigator.share === 'function') },
    { label: L.canShare, value: canShare },
    { label: L.clipboard, value: clip },
    { label: L.notification, value: 'Notification' in window ? Notification.permission : unknown },
    { label: L.wakeLock, value: yn('wakeLock' in navigator) },
    { label: L.sw, value: sw },
    { label: L.channel, value: `${appInfo.channel} / ${appInfo.version} / ${appInfo.sha}` },
    { label: L.screen, value: `${screen.width}×${screen.height} / ${innerWidth}×${innerHeight} / ${devicePixelRatio}` },
    { label: L.safeArea, value: safe },
    { label: L.online, value: navigator.onLine ? t('common.online') : t('common.offline') },
    { label: L.language, value: navigator.language },
    { label: L.dark, value: yn(matchMedia('(prefers-color-scheme: dark)').matches) },
  ];
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function CheckScreen() {
  const l = lang.value;
  const [facts, setFacts] = useState<Fact[]>([]);
  const [answers, setAnswers] = useState<DeviceCheckAnswers>(loadAnswers);
  // The timer itself lives in src/testtimer.ts (signals), so it keeps running on other screens.
  const endAt = timerEndAt.value;
  const now = timerNow.value;
  const fired = timerFired.value;
  const [status, setStatus] = useState('');
  const [wakeStatus, setWakeStatus] = useState('');
  const probe = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    collectFacts(probe.current, l).then(setFacts);
  }, [l]);

  useEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    lsSet(ANSWERS_KEY, JSON.stringify(answers));
  }, [answers]);

  // startTestTimer must run inside the tap so the AudioContext is unlocked (iOS).
  const startTimer = startTestTimer;
  const stopTimer = stopTestTimer;

  async function askNotification() {
    try {
      if (!('Notification' in window)) {
        setStatus(t('common.unknown'));
        return;
      }
      const res = await Notification.requestPermission();
      setStatus(`${t('check.askNotif')}: ${res}`);
    } catch (e) {
      setStatus(String(e));
    }
    measure();
  }

  async function testWakeLock() {
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      setWakeStatus(t('check.wakeActive'));
      setTimeout(() => {
        sentinel.release().then(() => setWakeStatus(t('check.wakeDone')));
      }, 20_000);
    } catch (e) {
      setWakeStatus(`${t('check.wakeFailed')}: ${String(e)}`);
    }
  }

  function buildReport(): string {
    return formatReport({
      facts,
      timer: TIMER_SCENARIOS.map((s) => ({ scenario: s, outcomes: answers.timer[s].outcomes, note: answers.timer[s].note })),
      checklist: CHECKLIST_ITEMS.map((item) => ({ item, answer: answers.checklist[item.id] ?? { verdict: null, note: '' } })),
      at: new Date().toISOString(),
      lang: l,
    });
  }

  function copyReport() {
    navigator.clipboard
      .writeText(buildReport())
      .then(() => setStatus(t('check.copied')))
      .catch((e: unknown) => setStatus(`${t('check.copyFailed')}: ${String(e)}`));
  }

  function shareReport() {
    const text = buildReport();
    if (typeof navigator.share === 'function') {
      navigator.share({ text }).catch((e: unknown) => {
        if ((e as { name?: string })?.name !== 'AbortError') setStatus(String(e));
      });
    } else {
      location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
    }
  }

  function setTimerRow(s: TimerScenario, patch: Partial<{ outcomes: TimerOutcome[]; note: string }>) {
    setAnswers((prev) => ({ ...prev, timer: { ...prev.timer, [s]: { ...prev.timer[s], ...patch } } }));
  }

  function setCheck(id: string, patch: Partial<{ verdict: Verdict; note: string }>) {
    setAnswers((prev) => ({
      ...prev,
      checklist: { ...prev.checklist, [id]: { ...(prev.checklist[id] ?? { verdict: null, note: '' }), ...patch } },
    }));
  }

  const remaining = endAt === null ? null : endAt - now;
  const scenarioLabel: Record<TimerScenario, string> = { fg: t('check.fg'), locked: t('check.locked'), bg: t('check.bg') };
  const outcomeLabel: Record<TimerOutcome, string> = {
    rang: t('check.o.rang'),
    sound: t('check.o.sound'),
    vibration: t('check.o.vibration'),
    notification: t('check.o.notification'),
    nothing: t('check.o.nothing'),
  };

  return (
    <>
      <Header title={t('check.title')} />
      <div class="screen form">
        <div class="probe" ref={probe} />
        <p class="muted" style="padding-top:12px">
          {t('check.intro')}
        </p>

        <section class="section">
          <h2>{t('check.facts')}</h2>
          <ul class="facts">
            {facts.map((f) => (
              <li key={f.label}>
                <span>{f.label}</span>
                <span>{f.value}</span>
              </li>
            ))}
          </ul>
          <div class="actions">
            <button type="button" class="btn btn-small" onClick={measure}>
              {t('check.refresh')}
            </button>
            <button type="button" class="btn btn-small" onClick={() => void askNotification()}>
              {t('check.askNotif')}
            </button>
            <button type="button" class="btn btn-small" onClick={() => void testWakeLock()}>
              {t('check.wake')}
            </button>
          </div>
          <div class="status">{wakeStatus}</div>
        </section>

        <section class="section">
          <h2>{t('check.timer')}</h2>
          <p class="muted small">{t('check.timerHint')}</p>
          <div class={'timer-display' + (fired ? ' done' : '')}>{remaining === null ? '0:30' : fmt(remaining)}</div>
          <div class="muted small" style="text-align:center">
            {endAt === null ? t('check.idle') : fired || (remaining !== null && remaining <= 0) ? t('check.finished') : t('check.running')}
          </div>
          <div class="actions">
            <button type="button" class="btn btn-primary" onClick={startTimer}>
              {t('check.start')}
            </button>
            {endAt !== null && (
              <button type="button" class="btn" onClick={stopTimer}>
                {t('check.stop')}
              </button>
            )}
          </div>

          <h2>{t('check.timerRows')}</h2>
          {TIMER_SCENARIOS.map((s) => (
            <div class="checkrow" key={s}>
              <div class="label">{scenarioLabel[s]}</div>
              <Segmented<TimerOutcome>
                name={'timer-' + s}
                multi
                options={TIMER_OUTCOMES.map((o) => ({ value: o, label: outcomeLabel[o] }))}
                selected={answers.timer[s].outcomes}
                onChange={(outcomes) => setTimerRow(s, { outcomes })}
              />
              <input class="input" type="text" placeholder={t('check.note')} value={answers.timer[s].note} onInput={(e) => setTimerRow(s, { note: (e.currentTarget as HTMLInputElement).value })} />
            </div>
          ))}
        </section>

        <section class="section">
          <h2>{t('check.checklist')}</h2>
          {CHECKLIST_ITEMS.map((item, i) => {
            const a = answers.checklist[item.id] ?? { verdict: null, note: '' };
            const firstIphone = item.group === 'iphone' && CHECKLIST_ITEMS[i - 1]?.group !== 'iphone';
            return (
              <div key={item.id}>
                {firstIphone && <h2 style="margin-top:20px">{t('check.iphone')}</h2>}
                <div class="checkrow">
                  <div class="label">
                    <strong>{item.id}.</strong> {l === 'nl' ? item.nl : item.en}
                    {(l === 'nl' ? item.expectNl : item.expectEn) && <span class="expect">{l === 'nl' ? item.expectNl : item.expectEn}</span>}
                  </div>
                  <Segmented<'pass' | 'fail' | 'na'>
                    name={'check-' + item.id}
                    options={[
                      { value: 'pass', label: t('check.pass'), tone: 'pass' },
                      { value: 'fail', label: t('check.fail'), tone: 'fail' },
                      { value: 'na', label: t('check.na') },
                    ]}
                    selected={a.verdict ? [a.verdict] : []}
                    onChange={(v) => setCheck(item.id, { verdict: v[0] ?? null })}
                  />
                  <input class="input" type="text" placeholder={t('check.note')} value={a.note} onInput={(e) => setCheck(item.id, { note: (e.currentTarget as HTMLInputElement).value })} />
                </div>
              </div>
            );
          })}
        </section>

        <section class="section">
          <div class="actions">
            <button type="button" class="btn btn-primary" onClick={copyReport}>
              {t('check.copy')}
            </button>
            <button type="button" class="btn" onClick={shareReport}>
              {t('check.share')}
            </button>
          </div>
          <div class="status" role="status">
            {status}
          </div>
          <details>
            <summary class="muted small">report.txt</summary>
            <pre class="report">{buildReport()}</pre>
          </details>
          <div class="actions">
            <button
              type="button"
              class="btn btn-small btn-danger"
              onClick={() => {
                setAnswers(emptyAnswers());
                stopTimer();
              }}
            >
              {t('check.reset')}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
