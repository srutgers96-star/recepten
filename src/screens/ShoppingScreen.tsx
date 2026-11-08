// '#/shopping' — the shopping list (docs/phase-4-spec.md §3 "Boodschappen"). Two tabs at the top
// (6C, docs/specs/vaste-lijst.md §1a): "Deze week" (the states below) and "Vaste lijst" (StandingTab:
// what you buy every week; `?tab=standing` opens it; the choice is not stored; the proto step shows no
// tabs). "Deze week" has three states:
//   1. no list yet for the plan: card "Weekplan: N gerechten" + "Maak de lijst" (→ proto);
//      no plan at all: the plain list (extras + the standing-list lines) with the add field;
//   2. proto list (after "Maak de lijst", before confirming): per aisle `[−] qty name [+]`, staples
//      at 0 in a small "Voorraad" block (tap → 1), "Controleer zelf" for unresolved lines, the
//      extras field, "Bevestig lijst"; the standing-list lines sit in their own block "Vaste lijst"
//      after the aisles and before "Voorraad" (6C §1d, StandingProtoRow: −/+ for this list only,
//      Heb ik al for this list only, Ook voortaan → adoptStandingAdjustment; "Beheer de vaste lijst ›");
//   3. the list: aisle sections in data order (collapsible, counter, collapsed once complete),
//      tap = tick (strike-through, stays in place), "Verberg afgevinkt", undo snackbar (5 s),
//      hold = menu (Heb ik al → in huis + pantry 21 days for non-perishables / Aantal aanpassen /
//      Waarvoor is dit? / Verwijder / Zet op de vaste lijst; a standing line instead: Heb ik al for this
//      list only (never the pantry) / Aantal aanpassen (+ Ook voortaan) / Haal van de vaste lijst, no
//      Waarvoor and no Verwijder; in the list itself a standing line stays in its aisle with 📌),
//      the stale banner "Weekplan gewijzigd — Bijwerken"
//      (regenerate through the repo, checks survive; never automatic), "Deel lijst" (plain text
//      NL/EN titled "🛒 Boodschappen wk 39 · 7 gerechten · 4 pers.", "Zonder afgevinkt" on by
//      default → navigator.share({text}) with exactly one field, "Kopieer" fallback; "gedeeld om
//      hh:mm" / "gewijzigd sinds delen"), "Klaar" (clear the ticks, and "Heb ik al" + the changed
//      amount of standing lines; its undo puts all three back), "Leeg de lijst" (empty items
//      and extras, undo via the snack; also in the proto step) and "winkelstand" (wake lock).
// `?proto=1` (the Week screen's "Boodschappenlijst maken") builds the list and opens the proto step.
// All data goes through src/db/repo.ts; the dictionary comes from the `dictionary` signal.
// 13D blok 3 (docs/specs/varianten-tabs.md §1e): "Waarvoor is dit?" puts "(glutenvrije versie)"
// (`vt.version.<diet>`, lower case) after the dish of a line that came from a slot's diet version
// (`ListSource.diet`); the line text itself is already the swapped one ("400 g glutenvrije pasta").
// 13Q (docs/specs/qr-link.md §1c): the share card also offers the list as a LINK (`#l=`, built by
// share-list.buildListEnvelope over the same lines as the text): "Deel link" / "Kopieer link" / "Toon QR"
// (QrPanel). Sharing the link logs one 'out' row (kind 'list'); the receiver gets "Zet op mijn lijst"
// in In & uit.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { appInfo, isIOS } from '@/components/AppInfo';
import { ExtraField } from '@/components/ExtraField';
import { Header } from '@/components/Header';
import { ListRow } from '@/components/ListRow';
import { ProtoRow, sourceLines } from '@/components/ProtoRow';
import { QrPanel, QrToggle } from '@/components/QrPanel';
import { Segmented } from '@/components/Segmented';
import { StandingProtoRow, canKeepStanding } from '@/components/StandingProtoRow';
import { StandingTab } from '@/components/StandingTab';
import { TimerBar } from '@/components/TimerBar';
import { SheetPortal } from '@/components/SheetPortal';
import { useLive } from '@/db/live';
import { mainItems } from '@/domain/planner';
import type { List } from '@/db/model';
import {
  addExtra,
  addLineToStanding,
  adoptStandingAdjustment,
  clearChecks,
  clearShoppingList,
  generateList,
  getHouseholdServings,
  getList,
  getPlan,
  getStandingList,
  isListStale,
  logShareEvent,
  markListShared,
  migratePinsToStanding,
  removeExtra,
  removeStandingItem,
  restoreListItem,
  restoreShoppingList,
  restoreStandingItem,
  setInHouse,
  setListItem,
  type ListItemPatch,
} from '@/db/repo';
import { recheckActiveBadges } from '@/badges';
import { dictionary } from '@/dictionary';
import { effectiveQty, groupByAisle, isoWeekNumber, itemName, listAsText, renderListItem, type AisleGroup, type ListItem } from '@/domain/aggregate';
import type { Dictionary } from '@/domain/dictionary';
import { nowIso, type Lang, type Text } from '@/domain/model';
import { planMessages, type ListShare } from '@/domain/share';
import { buildListEnvelope, LIST_LINK_MESSAGE_LIMIT } from '@/domain/share-list';
import { buildShareUrl, encodeToken } from '@/domain/token';
import { recordFeature } from '@/features';
import { lang, t, tIn } from '@/i18n';
import { printPage } from '@/print';
import { activeProfile } from '@/profile';
import { navigate, route } from '@/router';
import { copyText, shareText } from '@/share-actions';

const SNACK_MS = 5000;

/** 'list' and 'proto' are the tab "Deze week"; 'standing' is the tab "Vaste lijst" (6C). */
type Mode = 'list' | 'proto' | 'standing';
type MenuView = 'menu' | 'adjust' | 'sources';

interface Snack {
  text: string;
  undo?: () => void | Promise<void>;
}

// --- Wake lock ("winkelstand"; same approach as CookScreen, switchable) ----------------------------

type WakeLockSentinelLike = { release(): Promise<void> };

/** Keeps the screen on while `enabled`; re-requests when the app returns to the foreground. */
function useWakeLock(enabled: boolean): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!wl) {
      setSupported(false);
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let gone = false;
    const request = async () => {
      if (gone || document.visibilityState !== 'visible') return;
      try {
        sentinel = await wl.request('screen');
        setSupported(true);
        if (gone) await sentinel.release();
      } catch {
        setSupported((s) => s ?? false);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void request();
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) void sentinel.release().catch(() => undefined);
      sentinel = null;
    };
  }, [enabled]);
  return enabled ? supported : null;
}

// --- Helpers -------------------------------------------------------------------------------------

/** The line text; an item stepped down to 0 reads "ui (niet nodig)", as in the proto step (ProtoRow). */
function lineText(it: ListItem, dict: Dictionary, l: Lang): string {
  if (typeof it.qty === 'number' && it.section !== 'staples' && effectiveQty(it) === 0) return `${itemName(it, dict, l)} (${t('shop.zero')})`;
  return renderListItem(it, dict, l);
}

/** True for a staple that still sits at 0 ("even meenemen" not tapped). */
function restingStaple(it: ListItem): boolean {
  return it.section === 'staples' && !((effectiveQty(it) ?? 0) > 0);
}

interface Split {
  /** Real shopping lines (main, tapped staples, extras), grouped by aisle. */
  main: ListItem[];
  staples: ListItem[];
  inHouse: ListItem[];
  check: ListItem[];
}

function splitItems(items: readonly ListItem[]): Split {
  const out: Split = { main: [], staples: [], inHouse: [], check: [] };
  for (const it of items) {
    if (it.inHouse) out.inHouse.push(it);
    else if (it.section === 'check') out.check.push(it);
    else if (restingStaple(it)) out.staples.push(it);
    else out.main.push(it);
  }
  return out;
}

function timeOf(iso: string, l: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(l === 'nl' ? 'nl-NL' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

// --- Screen --------------------------------------------------------------------------------------

export function ShoppingScreen() {
  const l = lang.value;
  const dict = dictionary.value;
  const protoRequested = route.value.query.get('proto') === '1';
  // 6C §1a: `#/shopping?tab=standing` opens the tab "Vaste lijst" (Home's empty week card, the proto block).
  const standingRequested = !protoRequested && route.value.query.get('tab') === 'standing';
  const [mode, setMode] = useState<Mode>(standingRequested ? 'standing' : 'list');
  const [busy, setBusy] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [storeMode, setStoreMode] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<{ item: ListItem; view: MenuView } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLang, setShareLang] = useState<Lang>(l);
  // PLAN.md §8: ticked lines are skipped in the shared text by default ("Zonder afgevinkt").
  const [shareHideChecked, setShareHideChecked] = useState(true);
  const [shareStatus, setShareStatus] = useState('');
  const [snack, setSnack] = useState<Snack | null>(null);
  // "Gekopieerd ✓" flash on the "Kopieer als tekst" button (block D.2).
  const [copiedFlash, setCopiedFlash] = useState(false);
  // 13Q (docs/specs/qr-link.md §1c): the same lines as a `#l=` link — the message (one sentence +
  // the URL alone on the last line), the URL itself for "Toon QR", and how many lines it carries.
  const [link, setLink] = useState<{ message: string; url: string; lines: number } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const snackTimer = useRef<number | null>(null);
  const autoProto = useRef(false);
  const wake = useWakeLock(storeMode);
  const ios = isIOS();

  const plan = useLive(getPlan, []);
  // `undefined` = not read yet, `null` = there is no list row.
  const list = useLive<List | null>(async () => (await getList()) ?? null, []);
  const stale = useLive(isListStale, []);
  const household = useLive(getHouseholdServings, []) ?? 4;

  // Main dishes only, like Week, the #w= message and In & uit (Fable, 23 Oct 2026); side dishes still feed the list.
  const dishes = plan ? mainItems(plan.items).filter((p) => !p.cooked).length : 0;
  const items = list?.items ?? [];
  const generated = !!list && list.generatedFrom !== '';
  const loading = plan === undefined || list === undefined || stale === undefined;

  // The menu item follows the live list (an adjustment must show at once in the sheet).
  const menuItem = menu ? (items.find((it) => it.key === menu.item.key) ?? null) : null;
  useEffect(() => {
    if (menu && !menuItem) setMenu(null);
  }, [menu, menuItem]);

  useEffect(
    () => () => {
      if (snackTimer.current !== null) window.clearTimeout(snackTimer.current);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  // 6C (docs/specs/vaste-lijst.md §1d): old "Elke week" pins move to the standing list once; one snack when any moved.
  useEffect(() => {
    void migratePinsToStanding()
      .then((n) => {
        if (n > 0) showSnack(n === 1 ? t('shop.standing.migratedSnackOne') : t('shop.standing.migratedSnack', { n }));
      })
      .catch(() => undefined);
  }, []);

  function showSnack(text: string, undo?: () => void | Promise<void>) {
    if (snackTimer.current !== null) window.clearTimeout(snackTimer.current);
    setSnack(undo ? { text, undo } : { text });
    snackTimer.current = window.setTimeout(() => {
      snackTimer.current = null;
      setSnack(null);
    }, SNACK_MS);
  }

  async function undoSnack() {
    const s = snack;
    setSnack(null);
    if (snackTimer.current !== null) window.clearTimeout(snackTimer.current);
    snackTimer.current = null;
    if (s?.undo) await s.undo();
  }

  /** "Maak de lijst" / "Bijwerken": regenerate through the repo (checks survive by key). */
  async function build(toProto: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await generateList(dict);
      // 'listMade' moved to the first tick of a shopping round (Stijn 30 Oct: a list you never shop with
      // should not count for Boodschapper); see toggleCheck.
      if (toProto) setMode('proto');
      else showSnack(t('shop.updated'));
    } catch (e) {
      console.error('generateList', e);
      showSnack(`${t('common.error')}: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  }

  // ?tab=standing while the screen is already open (e.g. "Beheer de vaste lijst ›") switches the tab.
  useEffect(() => {
    if (standingRequested) setMode('standing');
  }, [standingRequested]);

  /** The tabs (§1a): a tap on the tab that is already on gives [] → nothing happens. */
  function switchTab(next: Mode | undefined) {
    if (!next || next === mode) return;
    setMenu(null);
    setMode(next);
    // Leaving "Vaste lijst": drop ?tab=standing so the effect above does not flip it back on a re-render.
    if (next !== 'standing' && standingRequested) navigate('/shopping', { replace: true });
  }

  // ?proto=1 (Week → "Boodschappenlijst maken"): build when stale, then open the proto step.
  useEffect(() => {
    if (!protoRequested || autoProto.current || loading) return;
    autoProto.current = true;
    if (stale || !generated) void build(true);
    else setMode('proto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protoRequested, loading, stale, generated]);

  function confirmProto() {
    setMode('list');
    setOpen({});
    if (protoRequested) navigate('/shopping', { replace: true });
  }

  // --- Item actions (all through the repo; the live query re-renders) ---------------------------

  async function toggleCheck(it: ListItem) {
    const next = !it.checked;
    // Boodschapper counts shopping rounds you actually used: the first tick on a list with nothing ticked yet.
    const firstTick = next && !items.some((x) => x.checked);
    await setListItem(it.key, { checked: next ? true : undefined });
    if (firstTick) void recordFeature('listMade');
    // 6D-2c: the tick is a trace of "Hele cirkel"; the row is written, so check now.
    if (next) recheckActiveBadges();
    const name = itemName(it, dict, l);
    showSnack(`${next ? t('shop.checkedSnack') : t('shop.uncheckedSnack')}: ${name}`, () => setListItem(it.key, { checked: next ? undefined : true }));
  }

  async function adjust(it: ListItem, adjusted: number | undefined) {
    await setListItem(it.key, { adjusted });
  }

  async function setHave(it: ListItem, on: boolean) {
    setMenu(null);
    await setListItem(it.key, on ? { inHouse: true, checked: undefined } : { inHouse: undefined });
    // 6C §5.4: a standing line's "Heb ik al" is for this list only and never touches the pantry.
    if (it.ing && !it.standing) await setInHouse(it.ing, on, { perishable: dict.get(it.ing)?.perishable === true });
    if (it.ing && on) void recordFeature('pantry');
    const ing = it.standing ? null : it.ing;
    showSnack(on ? t('shop.inHouseSnack') : t('shop.neededSnack'), async () => {
      await setListItem(it.key, on ? { inHouse: undefined } : { inHouse: true });
      if (ing) await setInHouse(ing, !on, { perishable: dict.get(ing)?.perishable === true });
    });
  }

  async function remove(it: ListItem) {
    setMenu(null);
    await removeExtra(it.key);
    // Undo puts the item back exactly as it was (a generated item into the list only, never into
    // the extras: it would otherwise outlive its dish as a stale manual line).
    showSnack(`${t('shop.removedSnack')}: ${itemName(it, dict, l)}`, () => restoreListItem({ ...it }));
  }

  /** "Zet op de vaste lijst" (6C §1d): the line's ingredient goes on the standing list; a manual extra
   *  is replaced by the new standing line, a recipe line stays. Undo takes the item off again and puts a
   *  replaced extra back; when the item was already on the standing list nothing changed, so no undo. */
  async function toStanding(it: ListItem) {
    setMenu(null);
    const before = new Set((await getStandingList()).items.map((s) => s.id));
    const added = await addLineToStanding(it.key);
    if (!added) return;
    const name = itemName(it, dict, l);
    if (before.has(added.id)) {
      showSnack(t('shop.standing.addedSnack', { name }));
      return;
    }
    showSnack(t('shop.standing.addedSnack', { name }), async () => {
      await removeStandingItem(added.id);
      if (it.manual) await restoreListItem({ ...it });
    });
    // Same feature hook as StandingTab's add (spec §0: 6D-2 counts both paths; badge vaste-klant).
    void recordFeature('standingList');
  }

  /** "Haal van de vaste lijst" (6C §1d): removes the standing item and its line; undo brings both back. */
  async function fromStanding(it: ListItem) {
    setMenu(null);
    const removed = await removeStandingItem(`s:${it.key.slice(2)}`);
    if (!removed) return;
    showSnack(t('shop.standing.removedSnack', { name: itemName(it, dict, l) }), () => restoreStandingItem(removed.item, removed.line));
  }

  /** "Ook voortaan" (6C §1d): the amount changed on this list becomes the new usual amount of the
   *  standing item; the snack names the line as it was saved ("2 potten mayonaise"). It is rendered
   *  after adopting: an amount lowered to 0 is stored as "no amount", so the snack must not say "0". */
  async function keep(it: ListItem) {
    if (!it.standing || !canKeepStanding(it)) return;
    await adoptStandingAdjustment(it.key);
    const saved = (await getList())?.items.find((x) => x.key === it.key);
    const text = renderListItem(saved ?? it, dict, l);
    showSnack(t('shop.standing.keptSnack', { text }));
  }

  async function addItem(item: Partial<ListItem>) {
    const added = await addExtra(item);
    showSnack(`${t('shop.addedSnack')}: ${itemName(added, dict, l)}`, () => removeExtra(added.key));
  }

  /** "Klaar": clears the ticks and, on standing lines, "Heb ik al" and the changed amount (6C §1d:
   *  the next list starts from the usual amounts). The undo puts the ticks and those two fields back. */
  async function finish() {
    if (busy) return;
    const undo: Array<{ key: string; patch: ListItemPatch }> = [];
    for (const it of items) {
      const patch: ListItemPatch = {};
      if (it.checked) patch.checked = true;
      if (it.standing) {
        if (it.inHouse) patch.inHouse = true;
        if (typeof it.adjusted === 'number') patch.adjusted = it.adjusted;
      }
      if (Object.keys(patch).length > 0) undo.push({ key: it.key, patch });
    }
    setBusy(true);
    try {
      await clearChecks();
    } finally {
      setBusy(false);
    }
    setOpen({});
    showSnack(t('shop.doneSnack'), async () => {
      for (const u of undo) await setListItem(u.key, u.patch);
    });
  }

  /** "Leeg de lijst": empties items and extras at once (no confirm dialog; "Ongedaan" brings the
   *  list back exactly, ticks included). Afterwards the existing empty state shows: with a plan the
   *  "Maak de lijst" card, without one the empty text. */
  async function clearAll() {
    if (busy) return;
    const wasMode = mode;
    setBusy(true);
    let prev: List | null = null;
    try {
      prev = await clearShoppingList();
    } catch (e) {
      console.error('clearShoppingList', e);
      showSnack(`${t('common.error')}: ${String((e as Error)?.message ?? e)}`);
      return;
    } finally {
      setBusy(false);
    }
    setMode('list');
    setOpen({});
    setMenu(null);
    // Like confirmProto: drop ?proto=1 so a reload does not rebuild the list just cleared.
    if (protoRequested) navigate('/shopping', { replace: true });
    if (!prev) return;
    const back = prev;
    showSnack(t('shop.cleared'), async () => {
      await restoreShoppingList(back);
      setMode(wasMode);
    });
  }

  // --- Sharing (invariant 9: navigator.share with exactly ONE field, inside the tap) --------------

  // "🛒 Boodschappen wk 39 · 7 gerechten · 4 pers." (PLAN.md §8 "Delen van de lijst"); a plain
  // list without a plan is just "🛒 Boodschappen wk 39".
  const titleIn = (lg: Lang) =>
    [
      tIn(lg, 'shop.shareTitle', { week: isoWeekNumber(new Date()) }),
      dishes === 1 ? tIn(lg, 'shop.shareTitleDishOne') : dishes > 1 ? tIn(lg, 'shop.shareTitleDishes', { n: dishes }) : '',
      dishes > 0 ? tIn(lg, 'shop.shareTitleServings', { n: household }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  const shareTitle = titleIn(shareLang);
  const shareTextValue = useMemo(
    () => (items.length ? listAsText(items, dict, shareLang, { title: shareTitle, hideInHouse: true, hideChecked: shareHideChecked }) : ''),
    [items, dict, shareLang, shareTitle, shareHideChecked],
  );

  function doShare() {
    if (!shareTextValue) return;
    setShareStatus('');
    const at = nowIso();
    // shareText calls navigator.share before its first await: still inside the tap.
    void shareText(shareTextValue).then(async (r) => {
      if (r.outcome === 'shared' || r.outcome === 'no-share-api') {
        await markListShared(at);
        void recordFeature('listShared');
        setShareStatus(r.outcome === 'shared' ? t('shop.shared') : t('shop.noShareApi'));
      } else if (r.outcome === 'failed') setShareStatus(`${t('shop.shareError')}: ${r.error ?? ''}`);
    });
  }

  function doCopy() {
    if (!shareTextValue) return;
    const at = nowIso();
    void copyText(shareTextValue).then(async (r) => {
      if (r.ok) {
        await markListShared(at);
        void recordFeature('listShared');
        setShareStatus(t('shop.copied'));
      } else setShareStatus(`${t('shop.copyError')}: ${r.error ?? ''}`);
    });
  }

  // 13Q (docs/specs/qr-link.md §1c/§2): the link carries the list as the text shows it — the same
  // items, in-house lines left out, ticked lines per "Zonder afgevinkt" — with the title in both
  // languages (invariant 3). Built ahead of the tap (encodeToken is async; navigator.share must be
  // called inside the tap), only while the share card is open.
  const by = activeProfile.value?.name ?? '';
  const titleNl = titleIn('nl');
  const titleEn = titleIn('en');
  useEffect(() => {
    setLink(null);
    setShowQr(false);
    if (!shareOpen || !shareTextValue) return;
    let cancelled = false;
    (async () => {
      const title: Text = { nl: titleNl, en: titleEn };
      const env = buildListEnvelope(items, dict, by, { title, hideChecked: shareHideChecked, hideInHouse: true });
      // 13c §2B.1: the link message gets LIST_LINK_MESSAGE_LIMIT (one `{ text }`, a WhatsApp message may
      // be far longer than 3,500 characters), so a long list keeps its link; the QR stays bound to
      // QR_MAX_URL_CHARS (QrPanel says "too big" then). The plain-text share keeps its own limit.
      const [built, token] = await Promise.all([
        planMessages([env], appInfo.appUrl, { lang: shareLang, by, name: by, limit: LIST_LINK_MESSAGE_LIMIT }),
        encodeToken(env),
      ]);
      if (cancelled) return;
      const lines = (env.l as ListShare | undefined)?.lines.length ?? 0;
      // Only a list beyond even that limit comes back as a file (planMessages): then the link buttons
      // stay disabled.
      setLink({ message: 'text' in built ? built.text : '', url: buildShareUrl(appInfo.appUrl, 'l', token), lines });
    })().catch((e: unknown) => {
      console.error('list link', e);
      if (!cancelled) setShareStatus(`${t('shop.shareError')}: ${String((e as Error)?.message ?? e)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [shareOpen, shareTextValue, titleNl, titleEn, shareLang, by]);

  /** "Deel link": `{ text }` only (invariant 9), the sentence above the link; logs one 'out' row. */
  function doShareLink() {
    const current = link;
    if (!current?.message) return;
    setShareStatus('');
    const at = nowIso();
    void shareText(current.message).then(async (r) => {
      if (r.outcome === 'shared' || r.outcome === 'no-share-api') {
        await markListShared(at);
        void recordFeature('listShared');
        setShareStatus(r.outcome === 'shared' ? t('shop.shared') : t('shop.noShareApi'));
      } else if (r.outcome === 'failed') setShareStatus(`${t('shop.shareError')}: ${r.error ?? ''}`);
      if (r.outcome === 'shared') {
        // §2: the list went out — one 'out' row (kind 'list'), then the badges re-check.
        void logShareEvent({ at, direction: 'out', kind: 'list', who: null, count: current.lines, recipeIds: [] })
          .then(() => recheckActiveBadges())
          .catch((e: unknown) => console.error('logShareEvent', e));
      }
    });
  }

  /** "Kopieer link": the same message to the clipboard (copying does not log, as with the member card). */
  function doCopyLink() {
    const current = link;
    if (!current?.message) return;
    const at = nowIso();
    void copyText(current.message).then(async (r) => {
      if (r.ok) {
        await markListShared(at);
        void recordFeature('listShared');
        setShareStatus(t('shop.copied'));
      } else setShareStatus(`${t('shop.copyError')}: ${r.error ?? ''}`);
    });
  }

  /** "Kopieer als tekst": the same text as the share preview (title, no in-house, ticked lines
   *  per the share option), straight to the clipboard with a short "Gekopieerd ✓" flash. */
  function doCopyAsText() {
    if (!shareTextValue) return;
    void copyText(shareTextValue).then((r) => {
      if (!r.ok) {
        showSnack(`${t('shop.copyError')}: ${r.error ?? ''}`);
        return;
      }
      setCopiedFlash(true);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => {
        flashTimer.current = null;
        setCopiedFlash(false);
      }, 1500);
    });
  }

  const sharedAt = list?.sharedAt ?? null;
  // repo.markListShared stamps sharedAt and updatedAt identically, so any later save counts.
  const changedSinceShare = !!sharedAt && !!list && new Date(list.updatedAt).getTime() > new Date(sharedAt).getTime();

  // --- Derived view data ---------------------------------------------------------------------------

  const split = useMemo(() => splitItems(items), [items]);
  const groups: AisleGroup[] = useMemo(() => groupByAisle(split.main, dict, l), [split.main, dict, l]);
  // 6C §1d: in the proto step the standing lines leave their aisle for the block "Vaste lijst" (after
  // the aisles, before "Voorraad"); in the list itself they stay in their aisle (`groups`).
  const protoStanding = useMemo(() => split.main.filter((it) => it.standing), [split.main]);
  const protoGroups: AisleGroup[] = useMemo(() => groupByAisle(split.main.filter((it) => !it.standing), dict, l), [split.main, dict, l]);
  const total = split.main.length + split.check.length;
  const done = split.main.filter((it) => it.checked).length + split.check.filter((it) => it.checked).length;
  const allDone = total > 0 && done === total;
  // 13D: each source line keeps the diet version of its slot (`ListSource.diet`) for the suffix.
  const menuLines = menuItem ? sourceLines(menuItem, l).map((s, i) => ({ ...s, diet: menuItem.sources[i]?.diet })) : [];
  // "Leeg de lijst" shows as soon as there is anything to clear (never in shop mode).
  const canClear = items.length > 0 || (list?.extras.length ?? 0) > 0;

  // --- Render ---------------------------------------------------------------------------------------

  const planCard = (
    <>
      {!loading && dishes > 0 && (
        <div class="card shop-plan shop-top">
          <div class="who">
            <strong>{dishes === 1 ? t('shop.planCardOne') : t('shop.planCard', { n: dishes })}</strong>
            {!generated && <small>{t('shop.planCardHint')}</small>}
          </div>
          {!generated ? (
            <button type="button" class="btn btn-primary" disabled={busy} onClick={() => void build(true)}>
              {busy ? t('shop.making') : t('shop.make')}
            </button>
          ) : (
            <button type="button" class="btn btn-small" onClick={() => navigate('/week')}>
              {t('shop.toWeek')} ›
            </button>
          )}
        </div>
      )}
      {!loading && dishes === 0 && (
        <p class="muted small shop-top">
          {t('shop.noPlan')}{' '}
          <a
            href="#/week"
            onClick={(e) => {
              e.preventDefault();
              navigate('/week');
            }}
          >
            {t('shop.toWeek')} ›
          </a>
        </p>
      )}
      {!loading && stale && generated && (
        <div class="shop-banner" role="status">
          <span>{t('shop.stale')}</span>
          <button type="button" class="btn btn-small" disabled={busy} onClick={() => void build(mode === 'proto')}>
            {busy ? t('shop.making') : t('shop.update')}
          </button>
        </div>
      )}
    </>
  );

  const extrasField = <ExtraField previous={list?.extras ?? []} onAdd={addItem} />;

  const protoView = (
    <>
      <h2 class="shop-top">{t('shop.proto.title')}</h2>
      <p class="muted small">{t('shop.proto.hint')}</p>
      {protoGroups.map((g) => (
        <section class="shop-aisle" data-aisle={g.id} key={g.id}>
          <div class="shop-aisle-head" role="heading" aria-level={3}>
            <i class="rule" aria-hidden="true" />
            <span class="name">{g.aisle ? g.aisle[l] : g.id}</span>
            <span class="count">{g.items.length}</span>
            <i class="rule" aria-hidden="true" />
          </div>
          <ul class="list">
            {g.items.map((it) => (
              <ProtoRow key={it.key} item={it} dict={dict} lang={l} onAdjust={(item, a) => void adjust(item, a)} />
            ))}
          </ul>
        </section>
      ))}
      {split.main.length === 0 && split.check.length === 0 && <div class="empty">{t('shop.empty')}</div>}
      {protoStanding.length > 0 && (
        <section class="shop-block standing-proto">
          <h3>{t('shop.standing.protoTitle')}</h3>
          <p class="hint">{t('shop.standing.protoHint')}</p>
          <ul class="list">
            {protoStanding.map((it) => (
              <StandingProtoRow
                key={it.key}
                item={it}
                dict={dict}
                lang={l}
                onAdjust={(item, a) => void adjust(item, a)}
                onHave={(item) => void setHave(item, true)}
                onKeep={(item) => void keep(item)}
              />
            ))}
          </ul>
          <a
            class="standing-home-link"
            href="#/shopping?tab=standing"
            onClick={(e) => {
              e.preventDefault();
              navigate('/shopping?tab=standing');
            }}
          >
            {t('shop.standing.manage')}
          </a>
        </section>
      )}
      {split.staples.length > 0 && (
        <section class="shop-block">
          <h3>{t('shop.staples')}</h3>
          <p class="hint">{t('shop.staplesHint')}</p>
          <ul class="list">
            {split.staples.map((it) => (
              <ProtoRow key={it.key} item={it} dict={dict} lang={l} onAdjust={(item, a) => void adjust(item, a)} />
            ))}
          </ul>
        </section>
      )}
      {split.check.length > 0 && (
        <section class="shop-block">
          <h3>{t('shop.check')}</h3>
          <p class="hint">{t('shop.checkHint')}</p>
          <ul class="list">
            {split.check.map((it) => (
              <ProtoRow key={it.key} item={it} dict={dict} lang={l} onAdjust={(item, a) => void adjust(item, a)} />
            ))}
          </ul>
        </section>
      )}
      {split.inHouse.length > 0 && (
        <section class="shop-block">
          <h3>{t('shop.inHouse')}</h3>
          <p class="hint">{t('shop.inHouseHint')}</p>
          <ul class="list">
            {split.inHouse.map((it) => (
              <ProtoRow key={it.key} item={it} dict={dict} lang={l} onAdjust={(item, a) => void adjust(item, a)} onTap={(item) => void setHave(item, false)} />
            ))}
          </ul>
        </section>
      )}
      <section class="section">
        <h2>{t('shop.addLabel')}</h2>
        {extrasField}
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-block" onClick={confirmProto}>
          {t('shop.confirm')}
        </button>
        {canClear && (
          <button type="button" class="btn btn-small" disabled={busy} onClick={() => void clearAll()}>
            {t('shop.clear')}
          </button>
        )}
      </div>
    </>
  );

  const listView = (
    <>
      <div class="shop-tools">
        <button type="button" class={'btn' + (hideChecked ? ' on' : '')} aria-pressed={hideChecked} onClick={() => setHideChecked((v) => !v)}>
          {hideChecked ? t('shop.showChecked') : t('shop.hideChecked')}
        </button>
        <button type="button" class={'btn' + (storeMode ? ' on' : '')} aria-pressed={storeMode} onClick={() => setStoreMode((v) => !v)}>
          {t('shop.storeMode')}
        </button>
        <button type="button" class={'btn' + (shareOpen ? ' on' : '')} aria-expanded={shareOpen} disabled={items.length === 0} onClick={() => setShareOpen((v) => !v)}>
          {t('shop.share')}
        </button>
        {/* window.print() is unreliable in the installed iPhone app (invariant 13): the honest
            hint below replaces the button there — printing goes through the share sheet. */}
        {!ios && (
          <button type="button" class="btn" disabled={items.length === 0} onClick={() => { printPage('shopping'); void recordFeature('print'); }}>
            {t('shop.print')}
          </button>
        )}
        <button type="button" class="btn" disabled={items.length === 0} onClick={doCopyAsText}>
          {copiedFlash ? t('shop.copiedFlash') : t('shop.copyAsText')}
        </button>
        <button type="button" class="btn" disabled={busy || done === 0} onClick={() => void finish()}>
          {t('shop.done')}
        </button>
        {canClear && !storeMode && (
          <button type="button" class="btn" disabled={busy} onClick={() => void clearAll()}>
            {t('shop.clear')}
          </button>
        )}
      </div>
      {ios && items.length > 0 && <p class="muted small shop-print-hint">{t('shop.printIOSHint')}</p>}
      <div class="shop-status" role="status">
        {storeMode && (wake === false ? t('shop.storeModeNo') : wake ? t('shop.storeModeOn') : '')}
        {storeMode && sharedAt ? ' · ' : ''}
        {sharedAt ? t('shop.sharedAt', { time: timeOf(sharedAt, l) }) : ''}
        {sharedAt && changedSinceShare ? ` · ${t('shop.changedSince')}` : ''}
      </div>

      {shareOpen && (
        <section class="card shop-share">
          <h2>{t('shop.share')}</h2>
          <p class="muted small">{t('shop.shareHint')}</p>
          <div class="shop-share-lang">
            <span class="muted small">{t('shop.textLang')}</span>
            <Segmented<Lang>
              name="shop-share-lang"
              options={[
                { value: 'nl', label: 'NL' },
                { value: 'en', label: 'EN' },
              ]}
              selected={[shareLang]}
              onChange={(next) => next[0] && setShareLang(next[0])}
            />
          </div>
          <label class="shop-share-opt">
            <input type="checkbox" checked={shareHideChecked} onChange={(e) => setShareHideChecked((e.currentTarget as HTMLInputElement).checked)} />
            <span>{t('shop.shareHideChecked')}</span>
          </label>
          <pre class="report shop-share-preview">{shareTextValue || t('shop.nothingToShare')}</pre>
          <div class="actions">
            <button type="button" class="btn btn-primary btn-block" disabled={!shareTextValue} onClick={doShare}>
              {t('shop.share')}
            </button>
            <button type="button" class="btn" disabled={!shareTextValue} onClick={doCopy}>
              {t('shop.copy')}
            </button>
          </div>
          {/* 13Q §1c: the same lines as a link (`#l=`) and as a QR code. */}
          <div class="actions">
            <button type="button" class="btn" disabled={!link?.message} onClick={doShareLink}>
              {t('shop.shareLink')}
            </button>
            <button type="button" class="btn" disabled={!link?.message} onClick={doCopyLink}>
              {t('shop.copyLink')}
            </button>
            <QrToggle open={showQr} disabled={!link?.url} onToggle={() => setShowQr((v) => !v)} />
          </div>
          <QrPanel url={link?.url ?? ''} open={showQr} onToggle={() => setShowQr(false)} />
          <div class="status" role="status">
            {shareStatus}
          </div>
        </section>
      )}

      {extrasField}

      {items.length === 0 && !loading && <div class="empty">{t('shop.empty')}</div>}
      {allDone && !hideChecked && <p class="ok">{t('shop.allDone')}</p>}

      {groups.map((g) => {
        const n = g.items.length;
        const d = g.items.filter((it) => it.checked).length;
        const complete = n > 0 && d === n;
        const expanded = open[g.id] ?? !complete;
        const visible = hideChecked ? g.items.filter((it) => !it.checked) : g.items;
        if (hideChecked && visible.length === 0 && !expanded) return null;
        return (
          <section class={'shop-aisle' + (complete ? ' complete' : '')} data-aisle={g.id} key={g.id}>
            <button type="button" class="shop-aisle-head" aria-expanded={expanded} onClick={() => setOpen((o) => ({ ...o, [g.id]: !expanded }))}>
              <i class="rule" aria-hidden="true" />
              <span class="name">{g.aisle ? g.aisle[l] : g.id}</span>
              <span class={'count' + (complete ? ' done' : '')}>{t('shop.count', { done: d, total: n })}</span>
              <span class="chev" aria-hidden="true">
                ▾
              </span>
              <i class="rule" aria-hidden="true" />
            </button>
            {expanded && (
              <ul class="list">
                {visible.map((it) => (
                  <ListRow key={it.key} item={it} text={lineText(it, dict, l)} name={itemName(it, dict, l)} onToggle={(item) => void toggleCheck(item)} onHold={(item) => setMenu({ item, view: 'menu' })} onRemove={(item) => void remove(item)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {split.check.length > 0 && (
        <section class="shop-block">
          <h3>{t('shop.check')}</h3>
          <p class="hint">{t('shop.checkHint')}</p>
          <ul class="list">
            {(hideChecked ? split.check.filter((it) => !it.checked) : split.check).map((it) => (
              <ListRow key={it.key} item={it} text={lineText(it, dict, l)} name={itemName(it, dict, l)} onToggle={(item) => void toggleCheck(item)} onHold={(item) => setMenu({ item, view: 'menu' })} onRemove={(item) => void remove(item)} />
            ))}
          </ul>
        </section>
      )}

      {split.staples.length > 0 && (
        <section class="shop-block">
          <h3>{t('shop.staples')}</h3>
          <p class="hint">{t('shop.staplesHint')}</p>
          <ul class="list">
            {split.staples.map((it) => (
              <ProtoRow key={it.key} item={it} dict={dict} lang={l} onAdjust={(item, a) => void adjust(item, a)} />
            ))}
          </ul>
        </section>
      )}

      {split.inHouse.length > 0 && (
        <section class="shop-block">
          <h3>{t('shop.inHouse')}</h3>
          <p class="hint">{t('shop.inHouseHint')}</p>
          <ul class="list">
            {split.inHouse.map((it) => (
              <ProtoRow key={it.key} item={it} dict={dict} lang={l} onAdjust={(item, a) => void adjust(item, a)} onTap={(item) => void setHave(item, false)} />
            ))}
          </ul>
        </section>
      )}

      {items.length > 0 && <p class="muted small">{t('shop.holdHint')}</p>}
    </>
  );

  return (
    <>
      <Header title={t('shop.title')} />
      <TimerBar />
      <div class="screen form shop">
        {/* 6C §1a: the two tabs sit under the cooking bar; the proto step is an in-between step without tabs. */}
        {mode !== 'proto' && (
          <div class="standing-tabs">
            <Segmented<'week' | 'standing'>
              name="shop-tab"
              options={[
                { value: 'week', label: t('shop.tab.week') },
                { value: 'standing', label: t('shop.tab.standing') },
              ]}
              selected={[mode === 'standing' ? 'standing' : 'week']}
              onChange={(next) => switchTab(next[0] === 'standing' ? 'standing' : next[0] === 'week' ? 'list' : undefined)}
            />
          </div>
        )}
        {mode === 'standing' ? (
          <StandingTab onSnack={showSnack} />
        ) : (
          <>
            {planCard}
            {loading ? <div class="empty">{t('shop.loading')}</div> : mode === 'proto' ? protoView : listView}
          </>
        )}
      </div>

      {menuItem && (
        <SheetPortal onEscape={() => setMenu(null)}>
          <div class="sheet-backdrop" onClick={() => setMenu(null)}>
            <div class="sheet shop-sheet" role="dialog" aria-modal="true" aria-label={itemName(menuItem, dict, l)} onClick={(e) => e.stopPropagation()}>
              <div class="sheet-head with-actions">
                <span class="sheet-head-btn" aria-hidden="true" />
                <h2>{menu?.view === 'adjust' ? t('shop.menu.adjust') : menu?.view === 'sources' ? t('shop.menu.sources') : itemName(menuItem, dict, l)}</h2>
                <button type="button" class="sheet-head-btn" onClick={() => setMenu(null)}>
                  {t('common.close')}
                </button>
              </div>
              <div class="sheet-body">
                {menu?.view === 'menu' && (
                  <>
                    <p class="shop-sheet-sub">{lineText(menuItem, dict, l)}</p>
                    {menuItem.standing && <p class="shop-sheet-sub standing-on-list">{t('shop.standing.onList')}</p>}
                    <ul class="shop-menu">
                      <li>
                        {menuItem.inHouse ? (
                          <button type="button" onClick={() => void setHave(menuItem, false)}>
                            <span class="ico" aria-hidden="true">
                              🛒
                            </span>
                            {t('shop.menu.needed')}
                          </button>
                        ) : (
                          <button type="button" onClick={() => void setHave(menuItem, true)}>
                            <span class="ico" aria-hidden="true">
                              🏠
                            </span>
                            {t('shop.menu.inHouse')}
                            {menuItem.standing ? (
                              <small>{t('shop.standing.haveHint')}</small>
                            ) : (
                              menuItem.ing && !dict.get(menuItem.ing)?.perishable && <small>{t('shop.menu.inHouseHint')}</small>
                            )}
                          </button>
                        )}
                      </li>
                      {menuItem.section !== 'check' && typeof menuItem.qty === 'number' && (
                        <li>
                          <button type="button" onClick={() => setMenu({ item: menuItem, view: 'adjust' })}>
                            <span class="ico" aria-hidden="true">
                              ±
                            </span>
                            {t('shop.menu.adjust')}
                          </button>
                        </li>
                      )}
                      {menuItem.standing ? (
                        // 6C §1d: a standing line has no "Waarvoor is dit?" (the sub line says it) and no
                        // "Verwijder" (that is Heb ik al for this list, or taking it off the standing list).
                        <li>
                          <button type="button" onClick={() => void fromStanding(menuItem)}>
                            <span class="ico" aria-hidden="true">
                              📌
                            </span>
                            {t('shop.menu.fromStanding')}
                          </button>
                        </li>
                      ) : (
                        <>
                          <li>
                            <button type="button" onClick={() => setMenu({ item: menuItem, view: 'sources' })}>
                              <span class="ico" aria-hidden="true">
                                ❓
                              </span>
                              {t('shop.menu.sources')}
                            </button>
                          </li>
                          {menuItem.section !== 'check' && (
                            <li>
                              <button type="button" onClick={() => void toStanding(menuItem)}>
                                <span class="ico" aria-hidden="true">
                                  📌
                                </span>
                                {t('shop.menu.toStanding')}
                                <small>{t('shop.menu.toStandingHint')}</small>
                              </button>
                            </li>
                          )}
                          <li>
                            <button type="button" class="danger" onClick={() => void remove(menuItem)}>
                              <span class="ico" aria-hidden="true">
                                🗑
                              </span>
                              {t('shop.menu.remove')}
                            </button>
                          </li>
                        </>
                      )}
                    </ul>
                  </>
                )}
                {menu?.view === 'adjust' && (
                  <>
                    <ul class="list">
                      <ProtoRow item={menuItem} dict={dict} lang={l} onAdjust={(item, a) => void adjust(item, a)} onTap={() => undefined} />
                    </ul>
                    <div class="actions">
                      <button type="button" class="btn" onClick={() => setMenu({ item: menuItem, view: 'menu' })}>
                        {t('shop.menu.back')}
                      </button>
                      {/* 6C §1d: a standing line gets "Ook voortaan" here, grey while the amount is unchanged. */}
                      {menuItem.standing && (
                        <button type="button" class="btn" disabled={!canKeepStanding(menuItem)} onClick={() => void keep(menuItem)}>
                          {t('shop.standing.keep')}
                        </button>
                      )}
                      <button type="button" class="btn btn-primary" onClick={() => setMenu(null)}>
                        {t('common.close')}
                      </button>
                    </div>
                  </>
                )}
                {menu?.view === 'sources' && (
                  <>
                    <p class="shop-sheet-name">{lineText(menuItem, dict, l)}</p>
                    <ul class="pr-sources">
                      {menuLines.length === 0 && <li>{t('shop.noSources')}</li>}
                      {menuLines.map((s) => (
                        <li key={s.key}>
                          <strong>{s.what}</strong> — {s.dish}
                          {s.diet && ` (${t('vt.version.' + s.diet).toLocaleLowerCase()})`}
                        </li>
                      ))}
                    </ul>
                    <div class="actions">
                      <button type="button" class="btn" onClick={() => setMenu({ item: menuItem, view: 'menu' })}>
                        {t('shop.menu.back')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </SheetPortal>
      )}

      {snack && (
        <div class="snackbar" role="status">
          <span>{snack.text}</span>
          {snack.undo && (
            <button type="button" onClick={() => void undoSnack()}>
              {t('shop.undo')}
            </button>
          )}
        </div>
      )}
    </>
  );
}
