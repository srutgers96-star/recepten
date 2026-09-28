// '#/import' — textarea paste, clipboard button, file picker, share-target inbox, hash token.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { lang, t } from '@/i18n';
import { navigate, pendingImport, route } from '@/router';
import { db } from '@/db/db';
import type { SharedRecipe } from '@/db/model';
import { nameExists } from '@/db/recipes';
import { readSharedRecipe } from '@/db/shared';
import { decodeToken, extractTokens, parseEnvelope, type Envelope } from '@/domain/token';

interface PreviewItem {
  key: string;
  recipe?: SharedRecipe;
  by?: string;
  at?: string;
  exists: boolean;
  savedId?: number;
  /** Set when the envelope type is not importable in phase 0, or decoding failed. */
  problem?: string;
}

interface ShareInboxPayload {
  at: number;
  text: string;
  files: Array<{ name: string; type: string; text: string }>;
}

function fromEnvelope(env: Envelope, key: string): PreviewItem {
  if (env.t !== 'r') return { key, exists: false, problem: `${t('import.unsupportedType')} ${env.t}` };
  const recipe = readSharedRecipe(env.r);
  if (!recipe) return { key, exists: false, problem: t('import.invalid') };
  return { key, recipe, by: typeof env.by === 'string' ? env.by : undefined, at: typeof env.at === 'string' ? env.at : undefined, exists: false };
}

/** Recognise pasted JSON by content: an envelope, a recipe, an array, or an export object. */
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
      const msg = (e as Error)?.message;
      out.push({ key, exists: false, problem: msg === 'unsupported-version' ? t('import.unsupported') : t('import.invalid') });
    }
    return;
  }
  if (Array.isArray(o.userRecipes)) return fromJson(o.userRecipes, key, out);
  if (Array.isArray(o.recipes)) return fromJson(o.recipes, key, out);
  const recipe = readSharedRecipe(o);
  if (recipe) out.push({ key, recipe, exists: false });
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

function fmtDate(iso: string | undefined, l: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(l === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ImportScreen() {
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

  // A share token arrived in the URL hash (at boot or later): move it into the textarea.
  useEffect(() => {
    if (!pending) return;
    pendingImport.value = null;
    setParts(null);
    setText(pending);
  }, [pending]);

  // Web Share Target: the service worker parked the POST in the 'share-inbox' cache.
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
            const received = [payload.text, ...(payload.files ?? []).map((f) => f.text)].filter((s) => typeof s === 'string' && s.length > 0);
            setParts(received);
            setText(received.join('\n'));
            setNotice(t('import.fromShare'));
          }
        }
      } catch (e) {
        console.warn('share-inbox', e);
      }
      navigate('/import', { replace: true });
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
          try {
            found.push(fromEnvelope(await decodeToken(tk.token), `${tk.key}${i}`));
          } catch (e) {
            const msg = (e as Error)?.message;
            found.push({ key: `${tk.key}${i}`, exists: false, problem: msg === 'unsupported-version' ? t('import.unsupported') : t('import.invalid') });
          }
        }
      } else {
        // JSON by content: each shared part on its own (a title line must not break a .json file).
        const candidates = parts && parts.length > 1 ? parts : [trimmed];
        candidates.forEach((part, i) => {
          for (const value of jsonCandidates(part)) fromJson(value, `j${i}`, found);
        });
        if (!found.length) err = t('import.noToken');
      }
      const withExists = await Promise.all(found.map(async (it) => (it.recipe ? { ...it, exists: await nameExists(it.recipe.name.nl) } : it)));
      if (my !== seq.current) return;
      setItems(withExists);
      setError(err);
    }, 150);
    return () => clearTimeout(handle);
  }, [text, parts, lang.value]);

  function pasteFromClipboard() {
    setNotice('');
    if (!navigator.clipboard?.readText) {
      setNotice(t('import.pasteFailed'));
      textarea.current?.focus();
      return;
    }
    navigator.clipboard
      .readText()
      .then((s) => {
        if (s) {
          setParts(null);
          setText(s);
        } else setNotice(t('import.pasteFailed'));
      })
      .catch(() => {
        setNotice(t('import.pasteFailed'));
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
      .catch(() => setNotice(t('import.fileFailed')));
  }

  async function save(item: PreviewItem) {
    if (!item.recipe) return;
    const r = item.recipe;
    const id = await db.userRecipes.add({
      name: r.name.nl,
      nameEn: r.name.en,
      ingredients: r.ingredients,
      instructions: r.instructions.nl,
      instructionsEn: r.instructions.en,
      servings: r.servings,
      origin: 'received',
      by: item.by,
      createdAt: new Date().toISOString(),
    });
    setItems((prev) => prev.map((it) => (it.key === item.key ? { ...it, savedId: id, exists: true } : it)));
  }

  const en = lang.value === 'en';

  return (
    <>
      <Header title={t('import.title')} />
      <div class="screen form">
        <p class="muted" style="padding-top:12px">
          {t('import.hint')}
        </p>
        <textarea
          class="input"
          ref={textarea}
          rows={6}
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
            {t('import.paste')}
          </button>
          <label class="btn">
            {t('import.file')}
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
              {t('import.clear')}
            </button>
          )}
        </div>
        <p class="muted small">{t('import.pasteHint')}</p>
        <div class="status" role="status">
          {notice}
        </div>

        {error && <div class="card bad">{error}</div>}

        {items.map((item) => (
          <div class="card" key={item.key}>
            {item.problem && <div class="bad">{item.problem}</div>}
            {item.recipe && (
              <>
                <div class="muted small">{t('import.preview')}</div>
                <h2>{(en && item.recipe.name.en) || item.recipe.name.nl}</h2>
                {item.recipe.name.en && item.recipe.name.en !== item.recipe.name.nl && <div class="muted">{en ? item.recipe.name.nl : item.recipe.name.en}</div>}
                <p class="muted">
                  {item.recipe.ingredients.length} {t('import.ingredients')}
                  {item.by ? ` · ${t('import.by')} ${item.by}` : ''}
                  {item.at ? ` · ${t('import.at')} ${fmtDate(item.at, lang.value)}` : ''}
                </p>
                {item.exists && !item.savedId && (
                  <p>
                    <span class="badge badge-green">{t('import.exists')}</span> <span class="muted small">{t('import.existsHint')}</span>
                  </p>
                )}
                {item.savedId !== undefined ? (
                  <div class="actions">
                    <span class="ok">{t('import.saved')}</span>
                    <button type="button" class="btn" onClick={() => navigate('/recipe/u' + item.savedId)}>
                      {t('import.open')}
                    </button>
                  </div>
                ) : (
                  <div class="actions">
                    <button type="button" class="btn btn-primary btn-block" onClick={() => void save(item)}>
                      {t('import.save')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
