// '#/inbox' — top: the import UI (textarea paste, "Plak van klembord" with readText in the tap,
// file input validated by content, the share-target inbox from the 'share-inbox' cache when opened
// with ?from=share, and a '#r=' hash handed over by the router as pendingImport); every input is
// decoded to a schema-2 recipe and previewed as Nieuw / Al aanwezig (fingerprint) / Bijgewerkt,
// "Bewaar" -> repo.importRecipes (origin received, receivedFrom = env.by). Below: the received
// recipes, newest first, "van <naam>", unseen badge (setting 'inbox.seenIds'), tap -> detail.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { useLive } from '@/db/live';
import { allRecipes, getRecipe, getSetting, importRecipes, isBuiltinId, setSetting, userRecipes } from '@/db/repo';
import { pickText, type Recipe } from '@/domain/model';
import { normalizeRecipe, recipeFingerprint, recipeFromEnvelope } from '@/domain/recipe-io';
import { decodeToken, extractTokens, parseEnvelope, type Envelope } from '@/domain/token';
import { lang, t } from '@/i18n';
import { INBOX_SEEN_KEY } from '@/inbox-badge';
import { navigate, pendingImport, route } from '@/router';

// --- Seen bookkeeping (setting 'inbox.seenIds'; the Nav badge in src/inbox-badge.ts follows it) ---

async function seenIds(): Promise<Set<string>> {
  const raw = await getSetting<unknown>(INBOX_SEEN_KEY, []);
  return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
}

export async function markInboxSeen(id: string): Promise<void> {
  const seen = await seenIds();
  if (seen.has(id)) return;
  seen.add(id);
  await setSetting(INBOX_SEEN_KEY, [...seen]);
}

// --- Import preview ------------------------------------------------------------------------------

type ItemStatus = 'new' | 'exists' | 'updated';

interface PreviewItem {
  key: string;
  recipe?: Recipe;
  /** Sender (envelope `by`, else the recipe's own origin). */
  by?: string;
  at?: string;
  status?: ItemStatus;
  /** Id of the recipe already present (same id, or same fingerprint under another id). */
  existingId?: string;
  savedId?: string;
  saveNote?: string;
  /** Set when the input could not be read as a recipe. */
  problem?: string;
}

interface ShareInboxPayload {
  at: number;
  text: string;
  files: Array<{ name: string; type: string; text: string }>;
}

function usable(r: Recipe | null): r is Recipe {
  return !!r && (r.lines.length > 0 || r.steps.length > 0);
}

function senderOf(r: Recipe): string | undefined {
  return r.origin.receivedFrom || r.origin.author || undefined;
}

function fromEnvelope(env: Envelope, key: string): PreviewItem {
  if (env.t === 'b') return { key, problem: t('inbox.backup') };
  if (env.t !== 'r') return { key, problem: `${t('inbox.unsupportedType')} ${env.t}` };
  const recipe = recipeFromEnvelope(env);
  if (!usable(recipe)) return { key, problem: t('inbox.invalid') };
  const item: PreviewItem = { key, recipe };
  const by = typeof env.by === 'string' && env.by.trim() ? env.by.trim() : senderOf(recipe);
  if (by) item.by = by;
  if (typeof env.at === 'string') item.at = env.at;
  return item;
}

function problemOf(e: unknown): string {
  return (e as Error)?.message === 'unsupported-version' ? t('inbox.unsupported') : t('inbox.invalid');
}

/** Recognise pasted JSON by content: an envelope, a recipe (any shape), an array, or an export. */
function fromJson(value: unknown, key: string, out: PreviewItem[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => fromJson(v, `${key}.${i}`, out));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const o = value as Record<string, unknown>;
  if (typeof o.v === 'number' && typeof o.t === 'string') {
    // Same version check as decodeToken: a v3 envelope pasted as raw JSON says "update the app".
    try {
      out.push(fromEnvelope(parseEnvelope(o), key));
    } catch (e) {
      out.push({ key, problem: problemOf(e) });
    }
    return;
  }
  if (Array.isArray(o.userRecipes)) return fromJson(o.userRecipes, key, out);
  if (Array.isArray(o.recipes)) return fromJson(o.recipes, key, out);
  const recipe = normalizeRecipe(o);
  if (usable(recipe)) {
    const item: PreviewItem = { key, recipe };
    const by = senderOf(recipe);
    if (by) item.by = by;
    out.push(item);
  }
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

/** Nieuw / Al aanwezig / Bijgewerkt, the same way importRecipes will decide. */
async function withStatus(item: PreviewItem): Promise<PreviewItem> {
  if (!item.recipe) return item;
  const r = item.recipe;
  const fp = recipeFingerprint(r);
  const byId = await getRecipe(r.id);
  if (byId) {
    if (isBuiltinId(r.id) || recipeFingerprint(byId) === fp) return { ...item, status: 'exists', existingId: byId.id };
    return { ...item, status: 'updated', existingId: byId.id };
  }
  const twin = (await allRecipes()).find((x) => recipeFingerprint(x) === fp);
  if (twin) return { ...item, status: 'exists', existingId: twin.id };
  return { ...item, status: 'new' };
}

function fmtDate(iso: string | undefined, l: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(l === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function receivedAt(r: Recipe): string {
  return r.origin.receivedAt || r.createdAt;
}

// --- Screen --------------------------------------------------------------------------------------

export function InboxScreen() {
  const [text, setText] = useState('');
  // Share-target parts (message text, each file) kept separate for JSON detection; null once the
  // user edits the textarea or the text came from anywhere else.
  const [parts, setParts] = useState<string[] | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const seq = useRef(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pending = pendingImport.value;
  const fromShare = route.value.query.get('from') === 'share';
  const ui = lang.value;

  const received = useLive(async () => (await userRecipes()).filter((r) => r.origin.kind === 'received'), []);
  const seen = useLive(seenIds, []);

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

  // Analyse the text (debounced): tokens first, else JSON by content.
  useEffect(() => {
    const my = ++seq.current;
    const trimmed = text.trim();
    if (!trimmed) {
      setItems([]);
      setError(null);
      return;
    }
    const handle = setTimeout(async () => {
      const found: PreviewItem[] = [];
      let err: string | null = null;
      const tokens = extractTokens(trimmed);
      if (tokens.length) {
        for (const [i, tk] of tokens.entries()) {
          const key = `${tk.key}${i}`;
          try {
            const env = await decodeToken(tk.token);
            // The fragment key is part of the contract: "#r=" must carry a t:'r' envelope.
            found.push(env.t === tk.key ? fromEnvelope(env, key) : { key, problem: t('inbox.invalid') });
          } catch (e) {
            found.push({ key, problem: problemOf(e) });
          }
        }
      } else {
        // JSON by content: each shared part on its own (a title line must not break a .json file).
        const candidates = parts && parts.length > 1 ? parts : [trimmed];
        candidates.forEach((part, i) => {
          for (const value of jsonCandidates(part)) fromJson(value, `j${i}`, found);
        });
        if (!found.length) err = t('inbox.noToken');
      }
      const withStatuses = await Promise.all(found.map(withStatus));
      if (my !== seq.current) return;
      setItems(withStatuses);
      setError(err);
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

  async function save(item: PreviewItem) {
    if (!item.recipe) return;
    try {
      const result = await importRecipes([item.recipe], { name: item.by ?? '' });
      const id = item.recipe.id;
      const saved = result.added.includes(id) || result.updated.includes(id);
      setItems((prev) =>
        prev.map((it) =>
          it.key === item.key ? { ...it, savedId: saved ? id : it.existingId, saveNote: saved ? t('inbox.saved') : t('inbox.skipped') } : it,
        ),
      );
    } catch (e) {
      setItems((prev) => prev.map((it) => (it.key === item.key ? { ...it, saveNote: `${t('inbox.saveError')}: ${String(e)}` } : it)));
    }
  }

  function open(id: string) {
    void markInboxSeen(id);
    navigate('/recipe/' + id);
  }

  const list = (received ?? []).slice().sort((a, b) => receivedAt(b).localeCompare(receivedAt(a)));

  return (
    <>
      <Header title={t('inbox.title')} />
      <div class="screen form inbox">
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
            <button
              type="button"
              class="btn btn-small"
              onClick={() => {
                setParts(null);
                setText('');
              }}
            >
              {t('inbox.clear')}
            </button>
          )}
        </div>
        <p class="muted small">{t('inbox.pasteHint')}</p>
        <div class="status" role="status">
          {notice}
        </div>

        {error && <div class="card bad">{error}</div>}

        {items.map((item) => (
          <div class="card inbox-item" key={item.key}>
            {item.problem && <div class="bad">{item.problem}</div>}
            {item.recipe && (
              <>
                <div class="muted small">{t('inbox.preview')}</div>
                <h2 class="inbox-name">{pickText(item.recipe.name, ui)}</h2>
                {item.recipe.name.en && item.recipe.name.nl && item.recipe.name.en !== item.recipe.name.nl && (
                  <div class="muted">{ui === 'en' ? item.recipe.name.nl : item.recipe.name.en}</div>
                )}
                <p class="muted">
                  {t('inbox.ingredients', { n: item.recipe.lines.filter((l) => l.kind !== 'header').length })}
                  {' · '}
                  {t('inbox.steps', { n: item.recipe.steps.length })}
                  {item.by ? ` · ${t('common.from', { name: item.by })}` : ''}
                  {item.at ? ` · ${t('inbox.at')} ${fmtDate(item.at, ui)}` : ''}
                </p>
                {item.savedId === undefined && item.status === 'new' && (
                  <p>
                    <span class="badge badge-green">{t('inbox.new')}</span>
                  </p>
                )}
                {item.savedId === undefined && item.status === 'exists' && (
                  <p>
                    <span class="badge">{t('inbox.exists')}</span> <span class="muted small">{t('inbox.existsHint')}</span>
                  </p>
                )}
                {item.savedId === undefined && item.status === 'updated' && (
                  <p>
                    <span class="badge">{t('inbox.updated')}</span> <span class="muted small">{t('inbox.updatedHint')}</span>
                  </p>
                )}
                {item.savedId !== undefined ? (
                  <div class="actions">
                    <span class="ok inbox-note">{item.saveNote}</span>
                    <button type="button" class="btn" onClick={() => open(item.savedId as string)}>
                      {t('inbox.open')}
                    </button>
                  </div>
                ) : item.status === 'exists' && item.existingId ? (
                  <div class="actions">
                    <button type="button" class="btn btn-block" onClick={() => navigate('/recipe/' + item.existingId)}>
                      {t('inbox.open')}
                    </button>
                  </div>
                ) : (
                  <div class="actions">
                    <button type="button" class="btn btn-primary btn-block" onClick={() => void save(item)}>
                      {t('inbox.save')}
                    </button>
                  </div>
                )}
                {item.savedId === undefined && item.saveNote && <div class="bad small">{item.saveNote}</div>}
              </>
            )}
          </div>
        ))}

        <section class="section inbox-received">
          <h2>{t('inbox.received')}</h2>
          {received && list.length === 0 && <div class="empty">{t('inbox.empty')}</div>}
          <ul class="list">
            {list.map((r) => {
              const unseen = seen ? !seen.has(r.id) : false;
              const from = r.origin.receivedFrom;
              return (
                <li key={r.id}>
                  <a
                    class="row inbox-row"
                    href={'#/recipe/' + r.id}
                    onClick={(e) => {
                      e.preventDefault();
                      open(r.id);
                    }}
                  >
                    <span class="name">
                      <span class="inbox-row-name">{pickText(r.name, ui)}</span>
                      <span class="muted small inbox-row-meta">
                        {from ? t('common.from', { name: from }) : ''}
                        {from ? ' · ' : ''}
                        {fmtDate(receivedAt(r), ui)}
                      </span>
                    </span>
                    {unseen && <span class="badge badge-green">{t('inbox.unseen')}</span>}
                    <span class="chev">›</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
