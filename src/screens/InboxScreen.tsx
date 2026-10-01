// '#/inbox' (docs/phase-3-spec.md §4 "Inbox") — top: the import UI. It accepts pasted text with
// several tokens (`#r=` recipes, `#p=` patches of classics, `#b=` bundles), bundle files (.json/.txt
// with a bundle envelope, the old backup format or a single recipe/envelope), the share-target
// inbox from the 'share-inbox' cache (?from=share, src/sw.ts) and a token the router parked in
// pendingImport. Everything is parsed with share.parseEnvelope, merged into ONE ParsedShare and
// classified by merge.planImport against repo.localStateForImport(); <ImportPreview> shows every
// item with its status and the choices (<ConflictCard>), ONE "Importeer" calls
// repo.applyImportPlan. Below: the result line with "Maak ongedaan" (undoLastImport), the import
// history (listImports, collapsible) and the received recipes (unseen badge via 'inbox.seenIds',
// received patches of classics shown as "<klassieker> · aangepast door X").
import { useEffect, useRef, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { Header } from '@/components/Header';
import { ImportPreview } from '@/components/ImportPreview';
import { useLive } from '@/db/live';
import type { ImportSnapshot } from '@/db/model';
import {
  addToPlan,
  applyImportPlan,
  getPlan,
  getRecipe,
  getSetting,
  isUndoable,
  listImports,
  localStateForImport,
  receivedPatches,
  savePlan,
  setSetting,
  undoLastImport,
  userRecipes,
  type ImportResult,
} from '@/db/repo';
import { reloadDictionary } from '@/dictionary';
import { defaultChoices, planImport, type ImportChoice, type ImportChoices, type ImportPlan } from '@/domain/merge';
import { pickText, type Recipe, type Text } from '@/domain/model';
import { emptyPlan, newPlanItem } from '@/domain/planner';
import { normalizeRecipe } from '@/domain/recipe-io';
import { parseEnvelope, readPatchPayload, type ParsedShare, type PatchPayload, type PlanShare } from '@/domain/share';
import { planWrites } from '@/components/ImportPreview';
import { decodeToken, extractTokens } from '@/domain/token';
import { lang, t } from '@/i18n';
import { INBOX_SEEN_KEY, refreshShareBadges, unsentChanges } from '@/inbox-badge';
import { activeProfile } from '@/profile';
import { navigate, pendingImport, route } from '@/router';

// --- Seen bookkeeping (setting 'inbox.seenIds'; the Nav badge in src/inbox-badge.ts follows it) ---

async function seenIds(): Promise<Set<string>> {
  const raw = await getSetting<unknown>(INBOX_SEEN_KEY, []);
  return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
}

/** Marks a received recipe id (or 'p:' + baseId of a received patch) as seen. */
export async function markInboxSeen(id: string): Promise<void> {
  const seen = await seenIds();
  if (seen.has(id)) return;
  seen.add(id);
  await setSetting(INBOX_SEEN_KEY, [...seen]);
}

/** Phase 5 block C: received recipes can finish 'Verzamelaar' the moment they are imported. */
function checkBadgesAfterImport() {
  const pid = activeProfile.value?.id;
  if (pid) void checkNewBadges(pid).catch((e: unknown) => console.error('checkNewBadges', e));
}

// --- Input -> one ParsedShare -------------------------------------------------------------------

interface ShareInboxPayload {
  at: number;
  text: string;
  files: Array<{ name: string; type: string; text: string }>;
}

/** Everything the input held, merged: recipes and patches concatenated, dictionary entries by id. */
interface Collected {
  share: ParsedShare;
  /** Human-readable problems per part (invalid code, newer version …). */
  problems: string[];
  /** A received week plan (`#w=`, phase 4): the first one in the input; its recipes are in `share`. */
  plan?: ReceivedPlan;
}

/** A `#w=` plan as the Inbox offers it: the dishes with a name when known here or in the token. */
interface ReceivedPlan {
  share: PlanShare;
  by?: string;
  /** Names of the embedded recipes by id (the receiver may not have them yet). */
  names: Record<string, Text>;
}

function emptyShare(): ParsedShare {
  return { kind: 'bundle', dict: { ing: [] }, recipes: [], patches: [] };
}

function usable(r: Recipe | null): r is Recipe {
  return !!r && (r.lines.length > 0 || r.steps.length > 0);
}

function senderOf(r: Recipe): string | undefined {
  return r.origin.receivedFrom || r.origin.author || undefined;
}

function problemOf(e: unknown): string {
  return (e as Error)?.message === 'unsupported-version' ? t('inbox.unsupported') : t('inbox.invalid');
}

function addShare(acc: Collected, parsed: ParsedShare) {
  const s = acc.share;
  if (parsed.kind === 'plan' && parsed.plan && !acc.plan) {
    const names: Record<string, Text> = {};
    for (const r of parsed.recipes) names[r.id] = r.name;
    acc.plan = { share: parsed.plan, names, ...(parsed.by ? { by: parsed.by } : {}) };
  }
  if (!s.by && parsed.by) s.by = parsed.by;
  if (!s.at && parsed.at) s.at = parsed.at;
  if (!s.title && parsed.title) s.title = parsed.title;
  s.recipes.push(...parsed.recipes.filter(usable));
  s.patches.push(...parsed.patches);
  const have = new Set(s.dict.ing.map((e) => e.id));
  for (const e of parsed.dict.ing) {
    if (have.has(e.id)) continue;
    have.add(e.id);
    s.dict.ing.push(e);
  }
}

function addRecipe(acc: Collected, r: Recipe) {
  if (!usable(r)) return;
  acc.share.recipes.push(r);
  if (!acc.share.by) {
    const by = senderOf(r);
    if (by) acc.share.by = by;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Recognise JSON by content: an envelope (r/p/b, also the backup format), an array, an export
 * with `recipes` / `userRecipes`, a bare patch, a recipe in any shape. A v3 envelope says
 * "update the app" (parseEnvelope checks the version like decodeToken does).
 */
function collectJson(value: unknown, acc: Collected, depth = 0) {
  if (depth > 3) return;
  if (Array.isArray(value)) {
    for (const v of value) collectJson(v, acc, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.v === 'number' && typeof value.t === 'string') {
    try {
      addShare(acc, parseEnvelope(value));
    } catch (e) {
      acc.problems.push(problemOf(e));
    }
    return;
  }
  if (Array.isArray(value.userRecipes) || Array.isArray(value.recipes)) {
    collectJson(value.userRecipes ?? value.recipes, acc, depth + 1);
    if (Array.isArray(value.overrides)) collectJson(value.overrides, acc, depth + 1);
    if (Array.isArray(value.userIngredients)) {
      // Legacy export without an envelope: run its ingredients through the tolerant reader.
      try {
        addShare(acc, parseEnvelope({ v: 2, t: 'b', b: { recipes: [], patches: [] }, dict: { ing: value.userIngredients } }));
      } catch {
        /* ignore an unreadable dictionary part */
      }
    }
    return;
  }
  if (typeof value.baseId === 'string' && isRecord(value.patch)) {
    const p: PatchPayload | null = readPatchPayload(value);
    if (p) acc.share.patches.push(p);
    return;
  }
  const recipe = normalizeRecipe(value);
  if (recipe) addRecipe(acc, recipe);
}

/**
 * JSON-by-content on one part of the input. A share-target part may carry a title/subject line
 * before the document body, so when the whole part is not JSON we retry from the first '{' / '['.
 */
function jsonCandidates(part: string): unknown[] {
  const s = part.trim();
  if (!s) return [];
  try {
    return [JSON.parse(s)];
  } catch {
    /* not JSON as a whole */
  }
  const idx = [s.indexOf('{'), s.indexOf('[')].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (idx === undefined || idx === 0) return [];
  try {
    return [JSON.parse(s.slice(idx))];
  } catch {
    return [];
  }
}

/** Tokens first (every `#r=`/`#p=`/`#b=` in the text), else JSON by content per part. */
async function collect(text: string, parts: string[] | null): Promise<Collected> {
  const acc: Collected = { share: emptyShare(), problems: [] };
  const tokens = extractTokens(text);
  if (tokens.length) {
    for (const tk of tokens) {
      try {
        const env = await decodeToken(tk.token);
        // The fragment key is part of the contract: "#r=" must carry a t:'r' envelope.
        if (env.t !== tk.key) throw new Error('invalid-token');
        addShare(acc, parseEnvelope(env));
      } catch (e) {
        acc.problems.push(problemOf(e));
      }
    }
    return acc;
  }
  const candidates = parts && parts.length > 1 ? parts : [text];
  for (const part of candidates) for (const value of jsonCandidates(part)) collectJson(value, acc);
  return acc;
}

// --- Received list ------------------------------------------------------------------------------

interface ReceivedRow {
  /** Recipe id, or 'p:' + baseId for a received patch (also the seen key). */
  key: string;
  recipeId: string;
  name: Recipe['name'];
  from?: string;
  at: string;
  patch: boolean;
}

function fmtDate(iso: string | undefined, l: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(l === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function receivedAt(r: Recipe): string {
  return r.origin.receivedAt || r.createdAt;
}

/** Received recipes + classics whose override came in through an import ("aangepast door X"). */
async function receivedRows(): Promise<ReceivedRow[]> {
  const [recipes, patched] = await Promise.all([userRecipes(), receivedPatches()]);
  const rows: ReceivedRow[] = [];
  for (const r of recipes) {
    if (r.origin.kind !== 'received') continue;
    const row: ReceivedRow = { key: r.id, recipeId: r.id, name: r.name, at: receivedAt(r), patch: false };
    if (r.origin.receivedFrom) row.from = r.origin.receivedFrom;
    rows.push(row);
  }
  for (const info of patched) {
    const classic = await getRecipe(info.baseId);
    if (!classic) continue;
    const row: ReceivedRow = { key: 'p:' + info.baseId, recipeId: info.baseId, name: classic.name, at: info.at, patch: true };
    if (info.from) row.from = info.from;
    rows.push(row);
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

// --- Screen --------------------------------------------------------------------------------------

export function InboxScreen() {
  const [text, setText] = useState('');
  // Share-target parts (message text, each file) kept separate for JSON detection; null once the
  // user edits the textarea or the text came from anywhere else.
  const [parts, setParts] = useState<string[] | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [choices, setChoices] = useState<ImportChoices>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [resultError, setResultError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  // Phase 4: a received week plan (`#w=`) with the local names of its dishes and the outcome line.
  const [received, setReceived] = useState<ReceivedPlan | null>(null);
  const [planNames, setPlanNames] = useState<Record<string, Text>>({});
  const [planNotice, setPlanNotice] = useState('');
  const [planDone, setPlanDone] = useState(false);
  const seq = useRef(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pending = pendingImport.value;
  const fromShare = route.value.query.get('from') === 'share';
  const ui = lang.value;
  const unsent = unsentChanges.value;

  const receivedList = useLive(receivedRows, []);
  const seen = useLive(seenIds, []);
  const history = useLive(() => listImports(10), []);

  // The "unsent changes" card (spec §3: Inbox → top card when there is something unsent).
  useEffect(() => {
    void refreshShareBadges();
  }, []);

  // A share token arrived in the URL hash (at boot or later): move it into the textarea.
  useEffect(() => {
    if (!pending) return;
    pendingImport.value = null;
    setParts(null);
    setText(pending);
  }, [pending]);

  // Web Share Target: the service worker parked the POST in the 'share-inbox' cache (src/sw.ts).
  useEffect(() => {
    if (!fromShare) return;
    (async () => {
      try {
        if ('caches' in window) {
          const cache = await caches.open('share-inbox');
          const key = import.meta.env.BASE_URL + 'share/inbox';
          const res = await cache.match(key);
          if (res) {
            const payload = (await res.json()) as ShareInboxPayload;
            await cache.delete(key);
            const got = [payload.text, ...(payload.files ?? []).map((f) => f.text)].filter((s) => typeof s === 'string' && s.length > 0);
            setParts(got);
            setText(got.join('\n'));
            setNotice(t('inbox.fromShare'));
          }
        }
      } catch (e) {
        console.warn('share-inbox', e);
      }
      // Drop "?from=share" so a reload never re-reads the (deleted) cache entry.
      navigate(route.value.path, { replace: true });
    })();
  }, [fromShare]);

  // Analyse the text (debounced): tokens first, else JSON by content; then plan against the db.
  useEffect(() => {
    const my = ++seq.current;
    const trimmed = text.trim();
    if (!trimmed) {
      setPlan(null);
      setChoices({});
      setProblems([]);
      setError(null);
      setReceived(null);
      setPlanNames({});
      setPlanNotice('');
      setPlanDone(false);
      return;
    }
    const handle = setTimeout(async () => {
      let next: ImportPlan | null = null;
      let probs: string[] = [];
      let err: string | null = null;
      let week: ReceivedPlan | null = null;
      let names: Record<string, Text> = {};
      try {
        const got = await collect(trimmed, parts);
        probs = got.problems;
        const share = got.share;
        if (share.recipes.length || share.patches.length || share.dict.ing.length) {
          next = planImport(share, await localStateForImport());
        } else if (!probs.length && !got.plan) {
          err = t('inbox.noToken');
        }
        if (got.plan) {
          week = got.plan;
          // Dish names: the local recipe when we have it, else the name embedded in the token.
          names = { ...got.plan.names };
          for (const it of got.plan.share.items) {
            const local = await getRecipe(it.recipeId);
            if (local) names[it.recipeId] = local.name;
          }
        }
      } catch (e) {
        console.warn('inbox plan', e);
        err = t('inbox.invalid');
      }
      if (my !== seq.current) return;
      setPlan(next);
      setChoices(next ? defaultChoices(next) : {});
      setProblems(probs);
      setError(err);
      setReceived(week);
      setPlanNames(names);
      setPlanNotice('');
      setPlanDone(false);
    }, 150);
    return () => clearTimeout(handle);
  }, [text, parts, ui]);

  // readText() must run inside the tap (iOS shows its Paste callout only then).
  function pasteFromClipboard() {
    setNotice('');
    if (!navigator.clipboard?.readText) {
      setNotice(t('inbox.pasteFailed'));
      textarea.current?.focus();
      return;
    }
    navigator.clipboard
      .readText()
      .then((s) => {
        if (s) {
          setParts(null);
          setText(s);
        } else setNotice(t('inbox.pasteFailed'));
      })
      .catch(() => {
        setNotice(t('inbox.pasteFailed'));
        textarea.current?.focus();
      });
  }

  function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    file
      .text()
      .then((s) => {
        setParts(null);
        setText(s);
      })
      .catch(() => setNotice(t('inbox.fileFailed')));
  }

  function clearText() {
    setParts(null);
    setText('');
  }

  function choose(id: string, choice: ImportChoice) {
    setChoices((prev) => ({ ...prev, [id]: choice }));
  }

  async function doImport() {
    if (!plan || busy) return;
    setBusy(true);
    setResultError('');
    try {
      const res = await applyImportPlan(plan, choices, { name: plan.by ?? '' });
      if (res.ingredients > 0) await reloadDictionary();
      if (res.importId === undefined) {
        setNotice(t('inbox.nothingToImport'));
      } else {
        setResult(res);
        setNotice('');
        clearText();
        checkBadgesAfterImport();
      }
    } catch (e) {
      console.error('import', e);
      setResultError(`${t('inbox.importError')}: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  }

  /**
   * "Overnemen" / "Toevoegen" on a received week plan (docs/phase-4-spec.md §1): the embedded
   * recipes go through the normal import first (so their ids exist here), then the dishes we
   * know become plan slots; unknown ids (recipes the sender did not include) are skipped.
   */
  async function takePlan(mode: 'replace' | 'append') {
    if (!received || busy) return;
    setBusy(true);
    setPlanNotice('');
    try {
      if (plan && planWrites(plan, choices)) {
        const res = await applyImportPlan(plan, choices, { name: plan.by ?? received.by ?? '' });
        if (res.ingredients > 0) await reloadDictionary();
        if (res.importId !== undefined) {
          setResult(res);
          checkBadgesAfterImport();
        }
      }
      const known: PlanShare['items'] = [];
      let unknown = 0;
      for (const it of received.share.items) {
        if (await getRecipe(it.recipeId)) known.push(it);
        else unknown++;
      }
      const parts: string[] = [];
      if (mode === 'replace') {
        const fresh = emptyPlan();
        fresh.items = known.map((it) => newPlanItem(it.recipeId, it.servings));
        if (received.share.note) fresh.note = received.share.note;
        await savePlan(fresh);
        parts.push(t('inbox.plan.taken', { n: known.length }));
      } else {
        const current = await getPlan();
        const have = new Set(current.items.map((p) => p.recipeId));
        let added = 0;
        for (const it of known) {
          if (have.has(it.recipeId)) continue;
          await addToPlan(it.recipeId, it.servings);
          added++;
        }
        parts.push(added > 0 ? t('inbox.plan.added', { n: added }) : t('inbox.plan.nothing'));
      }
      if (unknown === 1) parts.push(t('inbox.plan.unknownOne'));
      else if (unknown > 1) parts.push(t('inbox.plan.unknown', { n: unknown }));
      setPlanNotice(parts.join(' '));
      setPlanDone(true);
    } catch (e) {
      console.error('take plan', e);
      setPlanNotice(`${t('inbox.plan.failed')}: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doUndo() {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await undoLastImport();
      await reloadDictionary();
      setResult(null);
      setNotice(ok ? t('inbox.undone') : t('inbox.undoFailed'));
    } catch (e) {
      console.error('undo import', e);
      setNotice(`${t('inbox.importError')}: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  }

  function open(id: string) {
    navigate('/recipe/' + id);
  }

  function openReceived(row: ReceivedRow) {
    void markInboxSeen(row.key);
    navigate('/recipe/' + row.recipeId);
  }

  const list = receivedList ?? [];
  const rows: ImportSnapshot[] = history ?? [];
  const weekDishes = received?.share.items.length ?? 0;
  const weekTitle = received
    ? received.by
      ? weekDishes === 1
        ? t('inbox.plan.titleOne', { name: received.by })
        : t('inbox.plan.title', { name: received.by, n: weekDishes })
      : t('inbox.plan.titleAnon', { n: weekDishes })
    : '';
  // Only the NEWEST import can be undone, and only until the next one (repo.undoLastImport).
  const undoable = isUndoable(rows[0]) ? rows[0] : undefined;
  const resultUndoable = !!result && result.importId !== undefined && !!undoable && undoable.id === result.importId;
  const written = result ? [...result.added, ...result.updated].filter((id) => !id.startsWith('p:')) : [];

  return (
    <>
      <Header title={t('inbox.title')} />
      <div class="screen form inbox">
        {unsent > 0 && (
          <a
            class="card reminder"
            href="#/share"
            onClick={(e) => {
              e.preventDefault();
              navigate('/share');
            }}
          >
            <span class="reminder-icon" aria-hidden="true">
              📤
            </span>
            <span class="reminder-text">
              {unsent === 1 ? t('home.unsentOne') : t('home.unsent', { n: unsent })}
              <span class="reminder-action">{t('home.unsentAction')} ›</span>
            </span>
            <span class="badge">{unsent}</span>
          </a>
        )}
        <p class="muted inbox-hint">{t('inbox.hint')}</p>
        <textarea
          class="input"
          ref={textarea}
          rows={4}
          value={text}
          autocomplete="off"
          spellcheck={false}
          onInput={(e) => {
            setParts(null);
            setText((e.currentTarget as HTMLTextAreaElement).value);
          }}
        />
        <div class="actions">
          <button type="button" class="btn btn-primary" onClick={pasteFromClipboard}>
            {t('inbox.paste')}
          </button>
          <label class="btn">
            {t('inbox.file')}
            <input type="file" accept=".json,.txt,application/json,text/plain" style="display:none" onChange={onFile} />
          </label>
          {text && (
            <button type="button" class="btn btn-small" onClick={clearText}>
              {t('inbox.clear')}
            </button>
          )}
        </div>
        <p class="muted small">{t('inbox.pasteHint')}</p>
        <div class="status" role="status">
          {notice}
        </div>

        {error && <div class="card bad">{error}</div>}
        {problems.map((p, i) => (
          <div class="card bad" key={'p' + i}>
            {p}
          </div>
        ))}

        {received && (
          <section class="card inbox-plan">
            <h3>{weekTitle}</h3>
            {received.share.note && (
              <p class="muted small">
                {t('inbox.plan.note')}: {received.share.note}
              </p>
            )}
            <ul>
              {received.share.items.map((it, i) => {
                const name = pickText(planNames[it.recipeId], ui);
                return (
                  <li key={it.recipeId + i} class={name ? '' : 'unknown'}>
                    <span class="name">{name || t('inbox.plan.unknownDish')}</span>
                    <span class="srv">{t('inbox.plan.servings', { n: it.servings })}</span>
                  </li>
                );
              })}
            </ul>
            {!planDone && <p class="muted small">{t('inbox.plan.hint')}</p>}
            {!planDone ? (
              <div class="actions">
                <button type="button" class="btn btn-primary" disabled={busy || weekDishes === 0} onClick={() => void takePlan('replace')}>
                  {t('inbox.plan.take')}
                </button>
                <button type="button" class="btn" disabled={busy || weekDishes === 0} onClick={() => void takePlan('append')}>
                  {t('inbox.plan.add')}
                </button>
              </div>
            ) : (
              <div class="actions">
                <button type="button" class="btn btn-primary" onClick={() => navigate('/week')}>
                  {t('inbox.plan.toWeek')} ›
                </button>
              </div>
            )}
            <div class="status" role="status">
              {planNotice}
            </div>
          </section>
        )}
        {plan && !planDone && <ImportPreview plan={plan} choices={choices} ui={ui} busy={busy} onChoice={choose} onImport={() => void doImport()} onOpen={open} />}
        {resultError && <div class="card bad">{resultError}</div>}

        {result && (
          <div class="card inbox-result">
            <div class="ok inbox-result-line">
              {t('inbox.result', { added: result.added.length, updated: result.updated.length, skipped: result.skipped.length })}
              {result.copies.length > 0 ? ` · ${t('inbox.resultCopies', { n: result.copies.length })}` : ''}
              {result.ingredients > 0 ? ` · ${t('inbox.resultIngredients', { n: result.ingredients })}` : ''}
            </div>
            <div class="actions inbox-result-actions">
              {written.length === 1 && (
                <button type="button" class="btn" onClick={() => open(written[0] as string)}>
                  {t('inbox.open')}
                </button>
              )}
              {resultUndoable && (
                <button type="button" class="btn btn-danger" disabled={busy} onClick={() => void doUndo()}>
                  {t('inbox.undo')}
                </button>
              )}
            </div>
          </div>
        )}

        <section class="section inbox-received">
          <h2>{t('inbox.received')}</h2>
          {receivedList && list.length === 0 && <div class="empty">{t('inbox.empty')}</div>}
          <ul class="list">
            {list.map((r) => {
              const unseen = seen ? !seen.has(r.key) : false;
              const meta: string[] = [];
              if (r.patch) meta.push(r.from ? t('inbox.patchBy', { name: r.from }) : t('inbox.patchAnon'));
              else if (r.from) meta.push(t('common.from', { name: r.from }));
              meta.push(fmtDate(r.at, ui));
              return (
                <li key={r.key}>
                  <a
                    class="row inbox-row"
                    href={'#/recipe/' + r.recipeId}
                    onClick={(e) => {
                      e.preventDefault();
                      openReceived(r);
                    }}
                  >
                    <span class="name">
                      <span class="inbox-row-name">{pickText(r.name, ui)}</span>
                      <span class="muted small inbox-row-meta">{meta.join(' · ')}</span>
                    </span>
                    {unseen && <span class="badge badge-green">{t('inbox.unseen')}</span>}
                    <span class="chev">›</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <section class="section inbox-history">
          <button type="button" class="inbox-history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
            <span class="inbox-history-title">
              {t('inbox.history')}
              {rows.length > 0 ? ` (${rows.length})` : ''}
            </span>
            <span class="muted small">{showHistory ? t('inbox.hide') : t('inbox.show')}</span>
          </button>
          {showHistory && (
            <ul class="list inbox-history-list">
              {history && rows.length === 0 && <li class="muted small inbox-history-empty">{t('inbox.historyEmpty')}</li>}
              {rows.map((s) => (
                <li class="inbox-history-row" key={s.id ?? s.at}>
                  <div class="inbox-history-main">
                    <div class="inbox-history-when">
                      {fmtDate(s.at, ui)}
                      {' · '}
                      {s.from ? t('common.from', { name: s.from }) : t('inbox.senderUnknown')}
                      {s.undone && (
                        <>
                          {' '}
                          <span class="badge badge-muted">{t('inbox.historyUndone')}</span>
                        </>
                      )}
                    </div>
                    <div class="muted small">
                      {t('inbox.result', { added: s.added.length, updated: s.updated.length, skipped: s.skipped.length })}
                      {s.copies && s.copies.length > 0 ? ` · ${t('inbox.resultCopies', { n: s.copies.length })}` : ''}
                    </div>
                  </div>
                  {undoable && undoable.id === s.id && (
                    <button type="button" class="btn btn-small btn-danger" disabled={busy} onClick={() => void doUndo()}>
                      {t('inbox.undo')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
