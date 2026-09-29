// '#/week' — the week plan (docs/phase-4-spec.md §3 "Week"): a free list of 1..N dishes without
// days. Empty: a hero with the N stepper (1..14, default 7), "Kies N" (→ PickSheet) and "Verras
// me". Filled: one row per slot — name (active language), servings stepper, lock, reroll 🎲
// (pickRecipes with count 1, honouring locks and the sheet's filter/search as the pool), remove,
// "Gekookt" tick (also set by cook mode) — and the actions Verras me (all unlocked), Boodschappenlijst
// maken (→ '/shopping?proto=1'), Deel weekplan (`#w=` via navigator.share({text}) with exactly one
// field inside the tap handler; wa.me fallback; own recipes travel along) and Leeg (confirm).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { EMPTY_PICK_FILTER, PickChips, PickSheet, applyPickFilter, pickFilterActive, tagIdsIn, type PickFilter } from '@/components/PickSheet';
import { otherLanguageName } from '@/components/RecipeRow';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import {
  allRecipes,
  clearPlan,
  getHouseholdServings,
  getPlan,
  isBuiltinId,
  listLineOverrides,
  listUserIngredients,
  markPlanCooked,
  recentCooked,
  removeFromPlan,
  savePlan,
  setPlanServings,
  togglePlanLock,
} from '@/db/repo';
import { dictionary } from '@/dictionary';
import { pickText, type CookLogEntry, type Recipe } from '@/domain/model';
import type { LineOverride } from '@/domain/overrides';
import { newPlanItem, normalizeServings, pickRecipes, recentCookedIds, type PlanItem } from '@/domain/planner';
import { buildPlanEnvelope, planMessages, type MessagePlan } from '@/domain/share';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';
import { copyText, shareJsonFile, shareText } from '@/share-actions';

export const MIN_N = 1;
export const MAX_N = 14;
export const DEFAULT_N = 7;
const MAX_SLOT_SERVINGS = 24;
/** Enough cook-log rows to cover six weeks of a busy kitchen; newest first. */
const COOK_LOG_ROWS = 2000;

// Module-level so a trip to a recipe and back keeps the chosen N and the filter (session only).
let savedN = DEFAULT_N;
let savedFilter: PickFilter = EMPTY_PICK_FILTER;

/** recipeId → ISO of the newest cook-log entry. */
function lastCookedMap(log: readonly CookLogEntry[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of log) {
    const prev = out.get(e.recipeId);
    if (!prev || e.at > prev) out.set(e.recipeId, e.at);
  }
  return out;
}

export function WeekScreen() {
  const l = lang.value;
  const dict = dictionary.value;
  const by = activeProfile.value?.name ?? '';
  const plan = useLive(getPlan, []);
  const all = useLive(allRecipes, []);
  const household = useLive(getHouseholdServings, []) ?? 4;
  const log = useLive(() => recentCooked(undefined, COOK_LOG_ROWS), []);
  const [n, setN] = useState(savedN);
  const [filter, setFilterState] = useState<PickFilter>(savedFilter);
  const [sheet, setSheet] = useState(false);
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState<MessagePlan | null>(null);
  const [busy, setBusy] = useState(false);

  function setFilter(next: PickFilter) {
    savedFilter = next;
    setFilterState(next);
  }
  function changeN(next: number) {
    const v = Math.min(MAX_N, Math.max(MIN_N, next));
    savedN = v;
    setN(v);
  }

  const byId = useMemo(() => new Map((all ?? []).map((r) => [r.id, r] as const)), [all]);
  const tags = useMemo(() => tagIdsIn(all ?? []), [all]);
  const pool = useMemo(() => applyPickFilter(all ?? [], filter, dict, l), [all, filter, dict, l]);
  const lastCooked = useMemo(() => lastCookedMap(log ?? []), [log]);
  const recentIds = useMemo(() => recentCookedIds(log ?? []), [log]);
  const items = plan?.items ?? [];
  const uncooked = items.filter((p) => !p.cooked);
  const cookedCount = items.length - uncooked.length;
  const filtering = pickFilterActive(filter);

  // The share message is built ahead of the tap (encodeToken is async; navigator.share must be
  // called synchronously inside the tap handler). Rebuilt when the uncooked dishes change.
  const shareKey = uncooked.map((p) => `${p.recipeId}@${p.servings}`).sort().join('|');
  useEffect(() => {
    setMessage(null);
    if (!plan || !all || uncooked.length === 0) return;
    let cancelled = false;
    (async () => {
      const ownIds = uncooked.map((p) => p.recipeId).filter((id) => !isBuiltinId(id) && byId.has(id));
      const overrides: LineOverride[] = (await Promise.all(ownIds.map((id) => listLineOverrides(id)))).flat();
      const userIngredients = await listUserIngredients();
      const recipes = ownIds.map((id) => byId.get(id)).filter((r): r is Recipe => !!r);
      const env = buildPlanEnvelope(plan, recipes, { by, userIngredients, lineOverrides: overrides });
      const built = await planMessages([env], appInfo.appUrl, { lang: l, by, name: by });
      if (!cancelled) setMessage(built);
    })().catch((e: unknown) => {
      if (!cancelled) setStatus(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [shareKey, all, by, l]);

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      await fn();
    } catch (e) {
      console.error('week', e);
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  /** PickSheet "Voeg N toe": new slots with the household servings (never a duplicate dish). */
  function onPicked(ids: string[]) {
    setSheet(false);
    void run(async () => {
      const current = await getPlan();
      const have = new Set(current.items.map((p) => p.recipeId));
      const fresh = ids.filter((id) => !have.has(id)).map((id) => newPlanItem(id, household));
      if (fresh.length) await savePlan({ ...current, items: [...current.items, ...fresh] });
    });
  }

  /** Hero "Verras me": N dishes from the pool into an empty plan. */
  function surpriseFill() {
    void run(async () => {
      const current = await getPlan();
      const picked = pickRecipes({ count: n, pool, recentIds, existing: current.items });
      if (picked.length === 0) {
        setStatus(t('week.noPool'));
        return;
      }
      await savePlan({ ...current, items: [...current.items, ...picked.map((r) => newPlanItem(r.id, household))] });
    });
  }

  /**
   * "Verras me" on a filled plan: every unlocked, uncooked slot gets a new dish; locks stay. The
   * dishes now in the open slots are taken out of the pool, so a slot never gets "replaced" by
   * the same dish and dishes do not merely swap places; a slot keeps its dish only when the pool
   * runs dry.
   */
  function surpriseUnlocked() {
    void run(async () => {
      const current = await getPlan();
      const kept = current.items.filter((p) => p.locked || p.cooked);
      const open = current.items.filter((p) => !p.locked && !p.cooked);
      if (open.length === 0) return;
      const openIds = new Set(open.map((p) => p.recipeId));
      const picked = pickRecipes({ count: open.length, pool: pool.filter((r) => !openIds.has(r.id)), recentIds, existing: kept });
      if (picked.length === 0) {
        setStatus(t('week.noPool'));
        return;
      }
      const pickedIds = new Set(picked.map((r) => r.id));
      let i = 0;
      const next: PlanItem[] = [];
      for (const p of current.items) {
        if (p.locked || p.cooked) {
          next.push(p);
          continue;
        }
        const r = picked[i++];
        if (r) next.push({ ...p, recipeId: r.id });
        else if (!pickedIds.has(p.recipeId)) next.push(p); // pool exhausted: keep the old dish
      }
      await savePlan({ ...current, items: next });
    });
  }

  /**
   * 🎲 on one slot: one dish from the pool that is not in the plan yet. The slot itself is left
   * out of `existing` (it is being replaced, so it must not count towards the pasta/rijst caps)
   * and its current dish out of the pool (never the same dish again).
   */
  function reroll(item: PlanItem) {
    void run(async () => {
      const current = await getPlan();
      const others = current.items.filter((p) => p.id !== item.id);
      const picked = pickRecipes({ count: 1, pool: pool.filter((r) => r.id !== item.recipeId), recentIds, existing: others })[0];
      if (!picked) {
        setStatus(t('week.noPool'));
        return;
      }
      await savePlan({ ...current, items: current.items.map((p) => (p.id === item.id ? { ...p, recipeId: picked.id } : p)) });
    });
  }

  function servings(item: PlanItem, delta: number) {
    const next = Math.min(MAX_SLOT_SERVINGS, Math.max(1, normalizeServings(item.servings) + delta));
    if (next !== item.servings) void run(() => setPlanServings(item.id, next));
  }

  function onClear() {
    if (!confirm(t('week.clearConfirm'))) return;
    void run(clearPlan);
  }

  function onShare() {
    if (!message) return;
    setStatus('');
    if ('text' in message) {
      void shareText(message.text).then((r) => {
        if (r.outcome === 'failed') setStatus(`${t('share.error')}: ${r.error ?? ''}`);
        else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
      });
    } else {
      void shareJsonFile(message.file.name, message.file.json).then((r) => {
        if (r.outcome === 'shared') setStatus(t('share.fileShared'));
        else if (r.outcome === 'downloaded') setStatus(t('share.fileDownloaded', { name: r.name }));
        else if (r.outcome === 'failed') setStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
      });
    }
  }

  function onCopy() {
    if (!message || !('text' in message)) return;
    void copyText(message.text).then((r) => setStatus(r.ok ? t('week.copied') : `${t('share.copyError')}: ${r.error ?? ''}`));
  }

  const loading = plan === undefined || all === undefined;
  const empty = !loading && items.length === 0;

  return (
    <>
      <Header
        title={t('week.title')}
        action={
          !empty && !loading ? (
            <button type="button" class="icon-btn week-clear" onClick={onClear} disabled={busy}>
              {t('week.clear')}
            </button>
          ) : undefined
        }
      />
      <TimerBar />
      <div class="screen week">
        {loading && <div class="empty">{t('common.loading')}</div>}

        {empty && (
          <section class="card week-hero">
            <h2>{t('week.heroTitle')}</h2>
            <p class="muted">{t('week.heroHint')}</p>
            <div class="week-n" role="group" aria-label={t('week.count')}>
              <button type="button" class="servings-step" aria-label={t('week.less')} disabled={n <= MIN_N} onClick={() => changeN(n - 1)}>
                −
              </button>
              <span class="week-n-value" aria-live="polite">
                {n}
              </span>
              <button type="button" class="servings-step" aria-label={t('week.more')} disabled={n >= MAX_N} onClick={() => changeN(n + 1)}>
                +
              </button>
            </div>
            <div class="actions week-hero-actions">
              <button type="button" class="btn btn-primary btn-block week-pick" onClick={() => setSheet(true)}>
                {t('week.pickN', { n })}
              </button>
              <button type="button" class="btn btn-secondary btn-block" disabled={busy || pool.length === 0} onClick={surpriseFill}>
                <span aria-hidden="true">🎲</span> {t('week.surprise')}
              </button>
            </div>
            <PickChips filter={filter} onChange={setFilter} tags={tags} />
            {filtering && <p class="muted small week-filter-note">{t('week.filterOn', { n: pool.length })}</p>}
          </section>
        )}

        {!loading && !empty && (
          <>
            <div class="week-summary muted small">
              {items.length === 1 ? t('week.dish') : t('week.dishes', { n: items.length })}
              {cookedCount > 0 && ` · ${t('week.cookedOf', { n: cookedCount, total: items.length })}`}
            </div>

            <ul class="week-slots">
              {items.map((p) => {
                const r = byId.get(p.recipeId);
                const name = r ? pickText(r.name, l) : t('week.missing');
                const alt = r ? otherLanguageName(r, l) : null;
                const cooked = p.cooked === true;
                const locked = p.locked === true;
                return (
                  <li key={p.id} class={'week-slot' + (cooked ? ' cooked' : '') + (locked ? ' locked' : '')}>
                    <button
                      type="button"
                      class={'week-tick' + (cooked ? ' on' : '')}
                      role="checkbox"
                      aria-checked={cooked}
                      aria-label={cooked ? t('week.cooked') : t('week.notCooked')}
                      disabled={busy}
                      onClick={() => void run(() => markPlanCooked(p.id, !cooked))}
                    >
                      {cooked ? '✓' : ''}
                    </button>
                    <button type="button" class="week-name" disabled={!r} onClick={() => r && navigate('/recipe/' + r.id)}>
                      <span class="week-name-text">{name}</span>
                      {(alt || locked) && (
                        <span class="row-sub">
                          {alt && <span class="row-alt">{alt}</span>}
                          {alt && locked ? ' · ' : ''}
                          {locked && <span class="week-locked-label">🔒 {t('week.locked')}</span>}
                        </span>
                      )}
                    </button>
                    <div class="week-tools">
                      <div class="week-srv" role="group" aria-label={t('servings.label')}>
                        <button type="button" class="week-srv-step" aria-label={t('week.servingsLess')} disabled={busy || p.servings <= 1} onClick={() => servings(p, -1)}>
                          −
                        </button>
                        <span class="week-srv-value">{t('week.servings', { n: p.servings })}</span>
                        <button type="button" class="week-srv-step" aria-label={t('week.servingsMore')} disabled={busy || p.servings >= MAX_SLOT_SERVINGS} onClick={() => servings(p, 1)}>
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        class={'week-tool' + (locked ? ' on' : '')}
                        aria-pressed={locked}
                        aria-label={locked ? t('week.unlock') : t('week.lock')}
                        disabled={busy}
                        onClick={() => void run(async () => void (await togglePlanLock(p.id)))}
                      >
                        {locked ? '🔒' : '🔓'}
                      </button>
                      <button type="button" class="week-tool" aria-label={t('week.reroll')} disabled={busy || locked || cooked || pool.length === 0} onClick={() => reroll(p)}>
                        🎲
                      </button>
                      <button type="button" class="week-tool week-remove" aria-label={t('week.remove')} disabled={busy} onClick={() => void run(() => removeFromPlan(p.id))}>
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div class="actions week-actions">
              <button type="button" class="btn btn-primary btn-block" onClick={() => navigate('/shopping?proto=1')}>
                {t('week.makeList')}
              </button>
              <div class="week-actions-row">
                <button type="button" class="btn btn-secondary" disabled={busy || pool.length === 0 || uncooked.every((p) => p.locked)} onClick={surpriseUnlocked}>
                  <span aria-hidden="true">🎲</span> {t('week.surprise')}
                </button>
                <button type="button" class="btn" onClick={() => setSheet(true)}>
                  {t('week.pickMore')}
                </button>
              </div>
              <p class="muted small week-hint">{t('week.surpriseHint')}</p>
            </div>

            <section class="section week-filter">
              <h2>{t('week.filterEdit')}</h2>
              <PickChips filter={filter} onChange={setFilter} tags={tags} />
              <p class="muted small week-filter-note">{filtering ? t('week.filterOn', { n: pool.length }) : t('pick.sortHint')}</p>
            </section>

            <section class="section week-share">
              <h2>{t('week.share')}</h2>
              <p class="muted small">{t('week.shareHint')}</p>
              {!by && <p class="warn small">{t('week.shareNoProfile')}</p>}
              {message && 'file' in message && <p class="warn small">{t('week.shareTooLarge', { n: message.file.json.length })}</p>}
              <div class="actions">
                <button type="button" class="btn btn-primary btn-block" disabled={!message || uncooked.length === 0} onClick={onShare}>
                  {message && 'file' in message ? t('week.shareFile') : t('week.share')}
                </button>
                {message && 'text' in message && (
                  <button type="button" class="btn" onClick={onCopy}>
                    {t('week.copy')}
                  </button>
                )}
              </div>
              <div class="status" role="status">
                {status || (uncooked.length > 0 && !message ? t('week.shareBuilding') : '')}
              </div>
            </section>
          </>
        )}
        {empty && status && (
          <div class="status" role="status">
            {status}
          </div>
        )}
      </div>

      <PickSheet
        open={sheet}
        target={n}
        recipes={all ?? []}
        existing={items}
        lastCooked={lastCooked}
        recentIds={recentIds}
        filter={filter}
        onFilter={setFilter}
        onConfirm={onPicked}
        onClose={() => setSheet(false)}
      />
    </>
  );
}
