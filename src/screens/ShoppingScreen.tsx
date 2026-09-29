// '#/shopping' — the shopping list (docs/phase-4-spec.md §3 "Boodschappen"), three states:
//   1. no list yet for the plan: card "Weekplan: N gerechten" + "Maak de lijst" (→ proto);
//      no plan at all: the plain list (extras + "elke week" pins) with the add field;
//   2. proto list (after "Maak de lijst", before confirming): per aisle `[−] qty name [+]`, staples
//      at 0 in a small "Voorraad" block (tap → 1), "Controleer zelf" for unresolved lines, the
//      extras field, "Bevestig lijst";
//   3. the list: aisle sections in data order (collapsible, counter, collapsed once complete),
//      tap = tick (strike-through, stays in place), "Verberg afgevinkt", undo snackbar (5 s),
//      hold = menu (Heb ik al → in huis + pantry 21 days for non-perishables / Aantal aanpassen /
//      Waarvoor is dit? / Verwijder / Elke week), the stale banner "Weekplan gewijzigd — Bijwerken"
//      (regenerate through the repo, checks survive; never automatic), "Deel lijst" (plain text
//      NL/EN titled "🛒 Boodschappen wk 39 · 7 gerechten · 4 pers.", "Zonder afgevinkt" on by
//      default → navigator.share({text}) with exactly one field, "Kopieer" fallback; "gedeeld om
//      hh:mm" / "gewijzigd sinds delen"), "Klaar" (clear the ticks) and "winkelstand" (wake lock).
// `?proto=1` (the Week screen's "Boodschappenlijst maken") builds the list and opens the proto step.
// All data goes through src/db/repo.ts; the dictionary comes from the `dictionary` signal.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ExtraField } from '@/components/ExtraField';
import { Header } from '@/components/Header';
import { ListRow } from '@/components/ListRow';
import { ProtoRow, sourceLines } from '@/components/ProtoRow';
import { Segmented } from '@/components/Segmented';
import { useLive } from '@/db/live';
import type { List } from '@/db/model';
import {
  addExtra,
  clearChecks,
  generateList,
  getHouseholdServings,
  getList,
  getPlan,
  isListStale,
  markListShared,
  removeExtra,
  restoreListItem,
  setInHouse,
  setListItem,
  togglePinned,
} from '@/db/repo';
import { dictionary } from '@/dictionary';
import { effectiveQty, groupByAisle, isoWeekNumber, itemName, listAsText, renderListItem, type AisleGroup, type ListItem } from '@/domain/aggregate';
import type { Dictionary } from '@/domain/dictionary';
import { nowIso, type Lang } from '@/domain/model';
import { lang, t, tIn } from '@/i18n';
import { navigate, route } from '@/router';
import { copyText, shareText } from '@/share-actions';

const SNACK_MS = 5000;

type Mode = 'list' | 'proto';
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
  const [mode, setMode] = useState<Mode>('list');
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
  const snackTimer = useRef<number | null>(null);
  const autoProto = useRef(false);
  const wake = useWakeLock(storeMode);

  const plan = useLive(getPlan, []);
  // `undefined` = not read yet, `null` = there is no list row.
  const list = useLive<List | null>(async () => (await getList()) ?? null, []);
  const stale = useLive(isListStale, []);
  const household = useLive(getHouseholdServings, []) ?? 4;

  const dishes = plan ? plan.items.filter((p) => !p.cooked).length : 0;
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
    },
    [],
  );

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
      if (toProto) setMode('proto');
      else showSnack(t('shop.updated'));
    } catch (e) {
      console.error('generateList', e);
      showSnack(`${t('common.error')}: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
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
    await setListItem(it.key, { checked: next ? true : undefined });
    const name = itemName(it, dict, l);
    showSnack(`${next ? t('shop.checkedSnack') : t('shop.uncheckedSnack')}: ${name}`, () => setListItem(it.key, { checked: next ? undefined : true }));
  }

  async function adjust(it: ListItem, adjusted: number | undefined) {
    await setListItem(it.key, { adjusted });
  }

  async function setHave(it: ListItem, on: boolean) {
    setMenu(null);
    await setListItem(it.key, on ? { inHouse: true, checked: undefined } : { inHouse: undefined });
    if (it.ing) await setInHouse(it.ing, on, { perishable: dict.get(it.ing)?.perishable === true });
    const ing = it.ing;
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

  async function pin(it: ListItem) {
    setMenu(null);
    const on = await togglePinned(it.key);
    showSnack(on ? t('shop.pinnedSnack') : t('shop.unpinnedSnack'), () => togglePinned(it.key).then(() => undefined));
  }

  async function addItem(item: Partial<ListItem>) {
    const added = await addExtra(item);
    showSnack(`${t('shop.addedSnack')}: ${itemName(added, dict, l)}`, () => removeExtra(added.key));
  }

  async function finish() {
    if (busy) return;
    const checked = items.filter((it) => it.checked).map((it) => it.key);
    setBusy(true);
    try {
      await clearChecks();
    } finally {
      setBusy(false);
    }
    setOpen({});
    showSnack(t('shop.doneSnack'), async () => {
      for (const key of checked) await setListItem(key, { checked: true });
    });
  }

  // --- Sharing (invariant 9: navigator.share with exactly ONE field, inside the tap) --------------

  // "🛒 Boodschappen wk 39 · 7 gerechten · 4 pers." (PLAN.md §8 "Delen van de lijst"); a plain
  // list without a plan is just "🛒 Boodschappen wk 39".
  const shareTitle = [
    tIn(shareLang, 'shop.shareTitle', { week: isoWeekNumber(new Date()) }),
    dishes === 1 ? tIn(shareLang, 'shop.shareTitleDishOne') : dishes > 1 ? tIn(shareLang, 'shop.shareTitleDishes', { n: dishes }) : '',
    dishes > 0 ? tIn(shareLang, 'shop.shareTitleServings', { n: household }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
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
        setShareStatus(t('shop.copied'));
      } else setShareStatus(`${t('shop.copyError')}: ${r.error ?? ''}`);
    });
  }

  const sharedAt = list?.sharedAt ?? null;
  // repo.markListShared stamps sharedAt and updatedAt identically, so any later save counts.
  const changedSinceShare = !!sharedAt && !!list && new Date(list.updatedAt).getTime() > new Date(sharedAt).getTime();

  // --- Derived view data ---------------------------------------------------------------------------

  const split = useMemo(() => splitItems(items), [items]);
  const groups: AisleGroup[] = useMemo(() => groupByAisle(split.main, dict, l), [split.main, dict, l]);
  const total = split.main.length + split.check.length;
  const done = split.main.filter((it) => it.checked).length + split.check.filter((it) => it.checked).length;
  const allDone = total > 0 && done === total;
  const menuLines = menuItem ? sourceLines(menuItem, l) : [];

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
      {groups.map((g) => (
        <section class="shop-aisle" key={g.id}>
          <div class="shop-aisle-head" role="heading" aria-level={3}>
            <span class="name">{g.aisle ? g.aisle[l] : g.id}</span>
            <span class="count">{g.items.length}</span>
          </div>
          <ul class="list">
            {g.items.map((it) => (
              <ProtoRow key={it.key} item={it} dict={dict} lang={l} onAdjust={(item, a) => void adjust(item, a)} />
            ))}
          </ul>
        </section>
      ))}
      {split.main.length === 0 && split.check.length === 0 && <div class="empty">{t('shop.empty')}</div>}
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
        <button type="button" class="btn" disabled={busy || done === 0} onClick={() => void finish()}>
          {t('shop.done')}
        </button>
      </div>
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
          <section class={'shop-aisle' + (complete ? ' complete' : '')} key={g.id}>
            <button type="button" class="shop-aisle-head" aria-expanded={expanded} onClick={() => setOpen((o) => ({ ...o, [g.id]: !expanded }))}>
              <span class="name">{g.aisle ? g.aisle[l] : g.id}</span>
              <span class={'count' + (complete ? ' done' : '')}>{t('shop.count', { done: d, total: n })}</span>
              <span class="chev" aria-hidden="true">
                ▾
              </span>
            </button>
            {expanded && (
              <ul class="list">
                {visible.map((it) => (
                  <ListRow key={it.key} item={it} text={lineText(it, dict, l)} onToggle={(item) => void toggleCheck(item)} onHold={(item) => setMenu({ item, view: 'menu' })} />
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
              <ListRow key={it.key} item={it} text={lineText(it, dict, l)} onToggle={(item) => void toggleCheck(item)} onHold={(item) => setMenu({ item, view: 'menu' })} />
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
      <div class="screen form shop">
        {planCard}
        {loading ? <div class="empty">{t('shop.loading')}</div> : mode === 'proto' ? protoView : listView}
      </div>

      {menuItem && (
        <div class="sheet-backdrop" onClick={() => setMenu(null)}>
          <div class="sheet shop-sheet" role="dialog" aria-modal="true" aria-label={itemName(menuItem, dict, l)} onClick={(e) => e.stopPropagation()}>
            <div class="sheet-head">
              <h2>{menu?.view === 'adjust' ? t('shop.menu.adjust') : menu?.view === 'sources' ? t('shop.menu.sources') : itemName(menuItem, dict, l)}</h2>
              <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={() => setMenu(null)}>
                ×
              </button>
            </div>
            <div class="sheet-body">
              {menu?.view === 'menu' && (
                <>
                  <p class="shop-sheet-sub">{lineText(menuItem, dict, l)}</p>
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
                          {menuItem.ing && !dict.get(menuItem.ing)?.perishable && <small>{t('shop.menu.inHouseHint')}</small>}
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
                    <li>
                      <button type="button" onClick={() => setMenu({ item: menuItem, view: 'sources' })}>
                        <span class="ico" aria-hidden="true">
                          ❓
                        </span>
                        {t('shop.menu.sources')}
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => void pin(menuItem)}>
                        <span class="ico" aria-hidden="true">
                          📌
                        </span>
                        {menuItem.pinned ? t('shop.menu.unpin') : t('shop.menu.pin')}
                      </button>
                    </li>
                    <li>
                      <button type="button" class="danger" onClick={() => void remove(menuItem)}>
                        <span class="ico" aria-hidden="true">
                          🗑
                        </span>
                        {t('shop.menu.remove')}
                      </button>
                    </li>
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
