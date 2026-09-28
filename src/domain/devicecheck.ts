// Framework-free result model for the "Apparaatcheck / Device check" page (PLAN.md §3b) and the
// plain-text report formatter. The screen collects the facts and the user's answers; this module
// only describes and formats them, so it can be unit-tested in Node.

export type Lang = 'nl' | 'en';

export interface Fact {
  label: string;
  value: string;
}

export type TimerScenario = 'fg' | 'locked' | 'bg';
export type TimerOutcome = 'rang' | 'sound' | 'vibration' | 'notification' | 'nothing';

export const TIMER_SCENARIOS: TimerScenario[] = ['fg', 'locked', 'bg'];
export const TIMER_OUTCOMES: TimerOutcome[] = ['rang', 'sound', 'vibration', 'notification', 'nothing'];

export interface TimerRow {
  scenario: TimerScenario;
  outcomes: TimerOutcome[];
  note: string;
}

export type Verdict = 'pass' | 'fail' | 'na' | null;

export interface ChecklistItem {
  id: string;
  /** 'android' rows are §3b tests 1-12; 'iphone' rows are the iPhone line broken into items. */
  group: 'android' | 'iphone';
  nl: string;
  en: string;
  /** Expected pass condition, shown small under the label. */
  expectNl?: string;
  expectEn?: string;
}

export interface ChecklistAnswer {
  verdict: Verdict;
  note: string;
}

export interface DeviceCheckAnswers {
  timer: Record<TimerScenario, { outcomes: TimerOutcome[]; note: string }>;
  checklist: Record<string, ChecklistAnswer>;
}

export interface DeviceCheckResult {
  facts: Fact[];
  timer: TimerRow[];
  checklist: Array<{ item: ChecklistItem; answer: ChecklistAnswer }>;
  /** ISO timestamp of when the report was produced. */
  at: string;
  lang: Lang;
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: '1', group: 'android', nl: 'Icoon in de app-lade en in Instellingen → Apps (WebAPK)', en: 'Icon in the app drawer and in Settings → Apps (WebAPK)' },
  { id: '2', group: 'android', nl: 'Geen adresbalk; statusbalk in themakleur; safe-area klopt', en: 'No address bar; status bar in theme colour; safe area correct' },
  { id: '3', group: 'android', nl: 'Koude start offline (vliegtuigmodus, na herstart telefoon)', en: 'Cold start offline (airplane mode, after phone restart)', expectNl: '< 2 s tot lijst', expectEn: '< 2 s to list' },
  { id: '4', group: 'android', nl: 'Lijst van 196 scrollt vloeiend; plakkende koppen; overscroll voelt niet als browser-pull-to-refresh', en: 'List of 196 scrolls smoothly; sticky headers; overscroll does not feel like browser pull-to-refresh' },
  { id: '5', group: 'android', nl: 'Toetsenbord in het formulier bedekt geen invoerveld; geen zoom bij focus', en: 'Keyboard in the form does not cover an input; no zoom on focus' },
  { id: '6', group: 'android', nl: 'Terug-gebaar verlaat de app alleen vanaf Home, nooit midden in een recept', en: 'Back gesture only leaves the app from Home, never mid-recipe' },
  { id: '7', group: 'android', nl: 'Tekstselectie / lang drukken doet niets browser-achtigs op knoppen en lijstrijen', en: 'Text selection / long press does nothing browser-like on buttons and list rows' },
  { id: '8', group: 'android', nl: '2 KB #r=-link in WhatsApp tikbaar; opent in de app of in Chrome-tab met werkende "Bewaar"', en: '2 KB #r= link tappable in WhatsApp; opens in the app or in a Chrome tab with working "Save"', expectNl: 'noteer welke', expectEn: 'note which' },
  { id: '9', group: 'android', nl: '"Delen → Recepten" in het WhatsApp-deelmenu voor een bericht én voor een .json-document', en: '"Share → Recepten" in the WhatsApp share sheet for a message and for a .json document', expectNl: 'beide', expectEn: 'both' },
  { id: '10', group: 'android', nl: 'navigator.share({text}) naar WhatsApp; Plak van klembord; textarea-plak', en: 'navigator.share({text}) to WhatsApp; paste from clipboard; textarea paste' },
  { id: '11', group: 'android', nl: 'Timer 30 s: (a) voorgrond, (b) vergrendeld, (c) achtergrond — zie de timer-rijen hierboven', en: 'Timer 30 s: (a) foreground, (b) locked, (c) background — see the timer rows above', expectNl: 'alleen (a) is vereist', expectEn: 'only (a) is required' },
  { id: '12', group: 'android', nl: 'persisted() = true na installatie', en: 'persisted() = true after installation' },

  { id: 'i1', group: 'iphone', nl: 'Beginscherm-installatie (opent standalone, zonder Safari-balk)', en: 'Home Screen installation (opens standalone, without the Safari bar)' },
  { id: 'i2', group: 'iphone', nl: 'persisted() = true in de beginscherm-app', en: 'persisted() = true in the Home Screen app' },
  { id: 'i3', group: 'iphone', nl: 'Deel via WhatsApp (share({text})) werkt', en: 'Share via WhatsApp (share({text})) works' },
  { id: 'i4', group: 'iphone', nl: '"Plak van klembord" toont de Plak-callout en plakt', en: '"Paste from clipboard" shows the Paste callout and pastes' },
  { id: 'i5', group: 'iphone', nl: 'Plakken in het tekstvak (lang drukken → Plak) werkt', en: 'Pasting into the text box (long-press → Paste) works' },
  { id: 'i6', group: 'iphone', nl: 'Offline start na herstart van de telefoon', en: 'Offline start after restarting the phone' },
  { id: 'i7', group: 'iphone', nl: '2 KB-link in WhatsApp tikbaar; opent de Safari-landingspagina', en: '2 KB link tappable in WhatsApp; opens the Safari landing page' },
  { id: 'i8', group: 'iphone', nl: 'Timer (a)/(b)/(c) — zie de timer-rijen hierboven', en: 'Timer (a)/(b)/(c) — see the timer rows above' },
];

export function emptyAnswers(): DeviceCheckAnswers {
  const checklist: Record<string, ChecklistAnswer> = {};
  for (const item of CHECKLIST_ITEMS) checklist[item.id] = { verdict: null, note: '' };
  return {
    timer: {
      fg: { outcomes: [], note: '' },
      locked: { outcomes: [], note: '' },
      bg: { outcomes: [], note: '' },
    },
    checklist,
  };
}

/** Merge a possibly partial/older stored object into a complete answers object. */
export function normalizeAnswers(raw: unknown): DeviceCheckAnswers {
  const out = emptyAnswers();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<DeviceCheckAnswers>;
  for (const s of TIMER_SCENARIOS) {
    const row = r.timer?.[s];
    if (row && typeof row === 'object') {
      out.timer[s] = {
        outcomes: Array.isArray(row.outcomes)
          ? row.outcomes.filter((o): o is TimerOutcome => (TIMER_OUTCOMES as string[]).includes(String(o)))
          : [],
        note: typeof row.note === 'string' ? row.note : '',
      };
    }
  }
  for (const item of CHECKLIST_ITEMS) {
    const a = r.checklist?.[item.id];
    if (a && typeof a === 'object') {
      const v = a.verdict;
      out.checklist[item.id] = {
        verdict: v === 'pass' || v === 'fail' || v === 'na' ? v : null,
        note: typeof a.note === 'string' ? a.note : '',
      };
    }
  }
  return out;
}

const LABELS = {
  nl: {
    title: "Rutgers' Recepten — apparaatcheck",
    facts: 'Automatisch gemeten',
    timer: 'Testtimer 30 s',
    checklist: 'Checklist (plan §3b)',
    iphone: 'iPhone',
    note: 'notitie',
    none: '—',
    scenario: { fg: '(a) voorgrond', locked: '(b) vergrendeld', bg: '(c) achtergrond' },
    outcome: { rang: 'ging af', sound: 'geluid', vibration: 'trilling', notification: 'melding', nothing: 'niets' },
    verdict: { pass: 'PASS', fail: 'FAIL', na: 'n.v.t.', open: 'open' },
  },
  en: {
    title: "Rutgers' Recipes — device check",
    facts: 'Detected automatically',
    timer: 'Test timer 30 s',
    checklist: 'Checklist (plan §3b)',
    iphone: 'iPhone',
    note: 'note',
    none: '—',
    scenario: { fg: '(a) foreground', locked: '(b) locked', bg: '(c) background' },
    outcome: { rang: 'went off', sound: 'sound', vibration: 'vibration', notification: 'notification', nothing: 'nothing' },
    verdict: { pass: 'PASS', fail: 'FAIL', na: 'n/a', open: 'open' },
  },
} as const;

/** Plain-text report, meant for the clipboard or a WhatsApp message. Pure function. */
export function formatReport(result: DeviceCheckResult): string {
  const L = LABELS[result.lang];
  const lines: string[] = [];
  lines.push(L.title);
  lines.push(result.at);
  lines.push('');
  lines.push(`== ${L.facts} ==`);
  for (const f of result.facts) lines.push(`${f.label}: ${f.value}`);
  lines.push('');
  lines.push(`== ${L.timer} ==`);
  for (const row of result.timer) {
    const outcomes = row.outcomes.length ? row.outcomes.map((o) => L.outcome[o]).join(', ') : L.none;
    lines.push(`${L.scenario[row.scenario]}: ${outcomes}${row.note ? ` (${L.note}: ${row.note})` : ''}`);
  }
  lines.push('');
  lines.push(`== ${L.checklist} ==`);
  let iphoneHeaderDone = false;
  for (const { item, answer } of result.checklist) {
    if (item.group === 'iphone' && !iphoneHeaderDone) {
      lines.push(`-- ${L.iphone} --`);
      iphoneHeaderDone = true;
    }
    const v = answer.verdict ? L.verdict[answer.verdict] : L.verdict.open;
    const label = result.lang === 'nl' ? item.nl : item.en;
    lines.push(`[${v}] ${item.id}. ${label}${answer.note ? ` (${L.note}: ${answer.note})` : ''}`);
  }
  return lines.join('\n');
}
