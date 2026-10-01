// '#/more/dictionary' — Woordenboek (docs/phase-5-spec.md A-bis.6; block E.2 extends it): search
// over every entry (bundled + own) in both languages, own entries first with an "eigen" badge.
// Per own entry: Bewerk (nl/en names, aisle), "Fuseer met bestaand" (pick the existing entry in the
// IngredientPicker → repo.mergeIngredient rewrites every reference in one transaction and keeps a
// snapshot; the toast offers "Ongedaan") and Verwijder. "Opruimen" lists own entries whose name
// already exists (repo.findOwnDuplicates) and merges them one by one or all at once.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { IngredientPicker, ingredientLabel } from '@/components/IngredientPicker';
import { deleteUserIngredient, findOwnDuplicates, mergeIngredient, saveUserIngredient, undoMerge, type OwnDuplicate } from '@/db/repo';
import { baseDictionary, dictionary, isUserIngredientId, reloadDictionary, userIngredients } from '@/dictionary';
import type { Ingredient } from '@/domain/dictionary';
import type { Lang } from '@/domain/model';
import { lang, t } from '@/i18n';

const MAX_RESULTS = 60;
const TOAST_MS = 9000;

interface Toast {
  text: string;
  /** Snapshot row of a merge: shows "Ongedaan". */
  undoId?: number;
}

/** The entry's name in the UI language (fallback other language, then id). */
function nameOf(ing: Ingredient, l: Lang): string {
  return ing[l]?.one || ing[l === 'nl' ? 'en' : 'nl']?.one || ing.id;
}

/** Inline form for an own entry: names in both languages and the aisle. */
function EntryForm(props: { entry: Ingredient; busy: boolean; onSave: (next: Ingredient) => void; onCancel: () => void }) {
  const { entry } = props;
  const l = lang.value;
  const dict = dictionary.value;
  const [nlOne, setNlOne] = useState(entry.nl?.one ?? '');
  const [nlMany, setNlMany] = useState(entry.nl?.many ?? '');
  const [enOne, setEnOne] = useState(entry.en?.one ?? '');
  const [enMany, setEnMany] = useState(entry.en?.many ?? '');
  const [aisle, setAisle] = useState(entry.aisle || 'overig');
  const [error, setError] = useState('');

  function submit(e: Event) {
    e.preventDefault();
    const nl = nlOne.trim();
    const en = enOne.trim();
    if (!nl && !en) {
      setError(t('dict.nameRequired'));
      return;
    }
    const next: Ingredient = {
      ...entry,
      nl: nl ? { one: nl, ...(nlMany.trim() ? { many: nlMany.trim() } : {}) } : { one: en },
      en: en ? { one: en, ...(enMany.trim() ? { many: enMany.trim() } : {}) } : { one: nl },
      aisle,
    };
    props.onSave(next);
  }

  return (
    <form class="dw-form" onSubmit={submit}>
      <div class="dw-pair">
        <label class="field">
          <span>
            {t('picker.nl')} · {t('picker.singular')}
          </span>
          <input class="input" type="text" autocapitalize="off" value={nlOne} onInput={(e) => setNlOne((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>{t('picker.plural')}</span>
          <input class="input" type="text" autocapitalize="off" value={nlMany} onInput={(e) => setNlMany((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <div class="dw-pair">
        <label class="field">
          <span>
            {t('picker.en')} · {t('picker.singular')}
          </span>
          <input class="input" type="text" autocapitalize="off" value={enOne} onInput={(e) => setEnOne((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>{t('picker.plural')}</span>
          <input class="input" type="text" autocapitalize="off" value={enMany} onInput={(e) => setEnMany((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <label class="field">
        <span>{t('picker.aisle')}</span>
        <select class="input" value={aisle} onChange={(e) => setAisle((e.currentTarget as HTMLSelectElement).value)}>
          {dict.aisles.map((a) => (
            <option key={a.id} value={a.id}>
              {a[l]}
            </option>
          ))}
        </select>
      </label>
      {error && <div class="bad small">{error}</div>}
      <div class="actions">
        <button type="submit" class="btn btn-primary" disabled={props.busy}>
          {t('dict.save')}
        </button>
        <button type="button" class="btn" disabled={props.busy} onClick={props.onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

interface EntryRowProps {
  ing: Ingredient;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (next: Ingredient) => void;
  onMerge: () => void;
  onDelete: () => void;
}

function EntryRow(props: EntryRowProps) {
  const { ing } = props;
  const l = lang.value;
  const other: Lang = l === 'nl' ? 'en' : 'nl';
  const dict = dictionary.value;
  const own = isUserIngredientId(ing.id);
  const name = nameOf(ing, l);
  const alt = ing[other]?.one || '';
  const aisleName = dict.aisle(ing.aisle)?.[l] ?? ing.aisle;
  return (
    <li class="dw-row">
      <div class="dw-row-main">
        <span class="dw-name">
          {name}
          {own && <span class="badge badge-muted">{t('dict.own')}</span>}
          <span class="dw-sub muted small">{[alt && alt !== name ? alt : '', aisleName].filter(Boolean).join(' · ')}</span>
        </span>
      </div>
      {own && !props.editing && (
        <div class="dw-actions">
          <button type="button" class="btn btn-small" disabled={props.busy} onClick={props.onEdit}>
            {t('dict.edit')}
          </button>
          <button type="button" class="btn btn-small" disabled={props.busy} onClick={props.onMerge}>
            {t('dict.merge')}
          </button>
          <button type="button" class="btn btn-small btn-danger" disabled={props.busy} onClick={props.onDelete} aria-label={`${t('dict.delete')} ${name}`}>
            {t('dict.delete')}
          </button>
        </div>
      )}
      {own && props.editing && <EntryForm key={ing.id} entry={ing} busy={props.busy} onSave={props.onSave} onCancel={props.onCancelEdit} />}
    </li>
  );
}

export function DictionaryScreen() {
  const l = lang.value;
  const dict = dictionary.value;
  const own = userIngredients.value;
  const builtinCount = baseDictionary().ingredients.length;
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [mergeFor, setMergeFor] = useState<Ingredient | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  // "Opruimen": null = not run yet.
  const [dupes, setDupes] = useState<OwnDuplicate[] | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const q = query.trim();
  const results = useMemo(() => {
    if (!q) return [];
    const hits = dict.search(q, l);
    const ownHits = hits.filter((i) => isUserIngredientId(i.id));
    const rest = hits.filter((i) => !isUserIngredientId(i.id));
    return [...ownHits, ...rest].slice(0, MAX_RESULTS);
  }, [q, dict, l]);

  async function saveEntry(next: Ingredient) {
    setBusy(true);
    try {
      await saveUserIngredient(next);
      await reloadDictionary();
      setEditing(null);
      setToast({ text: t('dict.saved') });
    } catch (e) {
      setToast({ text: `${t('common.error')}: ${String((e as Error)?.message ?? e)}` });
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(ing: Ingredient) {
    if (!confirm(t('dict.deleteConfirm', { name: nameOf(ing, l) }))) return;
    setBusy(true);
    try {
      await deleteUserIngredient(ing.id);
      await reloadDictionary();
      setDupes((d) => (d ? d.filter((x) => x.own.id !== ing.id) : d));
    } catch (e) {
      setToast({ text: `${t('common.error')}: ${String((e as Error)?.message ?? e)}` });
    } finally {
      setBusy(false);
    }
  }

  /** One merge with its own snapshot; the toast offers "Ongedaan" for it. */
  async function merge(ownEntry: Ingredient, targetId: string, quiet = false): Promise<boolean> {
    const target = dict.get(targetId);
    if (!target || targetId === ownEntry.id) return false;
    const ownName = nameOf(ownEntry, l);
    const existingName = ingredientLabel(target, l);
    if (!quiet && !confirm(t('dict.mergeConfirm', { own: ownName, existing: existingName }))) return false;
    setBusy(true);
    try {
      const r = await mergeIngredient(ownEntry.id, targetId);
      await reloadDictionary();
      setDupes((d) => (d ? d.filter((x) => x.own.id !== ownEntry.id) : d));
      if (!quiet) setToast({ text: t('dict.merged', { own: ownName, existing: existingName, recipes: r.recipes, lines: r.lineRefs }), undoId: r.importId });
      return true;
    } catch (e) {
      setToast({ text: `${t('dict.mergeFailed')}: ${String((e as Error)?.message ?? e)}` });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function undo(importId: number) {
    setBusy(true);
    try {
      const ok = await undoMerge(importId);
      await reloadDictionary();
      setToast({ text: ok ? t('dict.undone') : t('dict.undoFailed') });
      if (ok) setDupes(null);
    } catch (e) {
      setToast({ text: `${t('dict.undoFailed')} (${String((e as Error)?.message ?? e)})` });
    } finally {
      setBusy(false);
    }
  }

  async function runCleanup() {
    setBusy(true);
    try {
      setDupes(await findOwnDuplicates(baseDictionary()));
    } catch (e) {
      setToast({ text: `${t('common.error')}: ${String((e as Error)?.message ?? e)}` });
    } finally {
      setBusy(false);
    }
  }

  /** Every duplicate in turn (each with its own snapshot; only the last one is undoable, so no undo is offered). */
  async function mergeAll() {
    if (!dupes || !dupes.length) return;
    let n = 0;
    for (const d of dupes) {
      if (await merge(d.own, d.existing.id, true)) n++;
    }
    setToast({ text: t('dict.mergedAll', { n }) });
  }

  const rowProps = (ing: Ingredient): EntryRowProps => ({
    ing,
    busy,
    editing: editing === ing.id,
    onEdit: () => setEditing(ing.id),
    onCancelEdit: () => setEditing(null),
    onSave: (next) => void saveEntry(next),
    onMerge: () => setMergeFor(ing),
    onDelete: () => void removeEntry(ing),
  });

  return (
    <>
      <Header title={t('dict.title')} back backLabel={t('common.back')} />
      <div class="screen dw">
        <input
          class="input dw-search"
          type="search"
          autocomplete="off"
          autocapitalize="off"
          enterKeyHint="search"
          placeholder={t('dict.search')}
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        <p class="muted small dw-counts">{t('dict.counts', { builtin: builtinCount, own: own.length })}</p>

        {q ? (
          results.length === 0 ? (
            <div class="empty">{t('dict.noResults')}</div>
          ) : (
            <ul class="dw-list">
              {results.map((ing) => (
                <EntryRow key={ing.id} {...rowProps(ing)} />
              ))}
            </ul>
          )
        ) : (
          <>
            <section class="section">
              <h2>{t('dict.ownHeading')}</h2>
              {own.length === 0 ? (
                <p class="muted">{t('dict.ownEmpty')}</p>
              ) : (
                <ul class="dw-list">
                  {own.map((ing) => (
                    <EntryRow key={ing.id} {...rowProps(ing)} />
                  ))}
                </ul>
              )}
              <div class="actions">
                <button type="button" class="btn btn-secondary btn-block" disabled={busy} onClick={() => setNewOpen(true)}>
                  {t('dict.new')}
                </button>
              </div>
              <p class="muted small">{t('dict.searchHint', { n: dict.ingredients.length })}</p>
            </section>

            <section class="card dw-cleanup">
              <h2>{t('dict.cleanup')}</h2>
              <p class="muted small">{t('dict.cleanupHint')}</p>
              {dupes === null ? (
                <div class="actions">
                  <button type="button" class="btn" disabled={busy || own.length === 0} onClick={() => void runCleanup()}>
                    {t('dict.cleanup')}
                  </button>
                </div>
              ) : dupes.length === 0 ? (
                <p class="ok">{t('dict.cleanupNone')}</p>
              ) : (
                <>
                  <p>{t('dict.cleanupCount', { n: dupes.length })}</p>
                  <ul class="dw-list">
                    {dupes.map((d) => (
                      <li key={d.own.id} class="dw-row">
                        <div class="dw-row-main">
                          <span class="dw-name">
                            {t('dict.cleanupRow', { own: nameOf(d.own, l), existing: ingredientLabel(d.existing, l) })}
                            {isUserIngredientId(d.existing.id) && <span class="badge badge-muted">{t('dict.own')}</span>}
                          </span>
                          <button type="button" class="btn btn-small" disabled={busy} onClick={() => void merge(d.own, d.existing.id)}>
                            {t('dict.mergeOne')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div class="actions">
                    <button type="button" class="btn btn-primary" disabled={busy} onClick={() => void mergeAll()}>
                      {t('dict.mergeAll')}
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>

      {toast && (
        <div class="dw-toast" role="status">
          <span>{toast.text}</span>
          {toast.undoId !== undefined && (
            <button type="button" class="btn btn-small" disabled={busy} onClick={() => void undo(toast.undoId as number)}>
              {t('dict.undo')}
            </button>
          )}
        </div>
      )}

      {/* "Fuseer met bestaand": pick the target; the own entry itself cannot be chosen, nor a new one. */}
      <IngredientPicker
        open={mergeFor !== null}
        title={mergeFor ? t('dict.mergeTitle', { name: nameOf(mergeFor, l) }) : undefined}
        initialQuery={mergeFor ? nameOf(mergeFor, l) : ''}
        excludeId={mergeFor?.id}
        allowNew={false}
        onPick={(id) => {
          const target = mergeFor;
          setMergeFor(null);
          if (target) void merge(target, id);
        }}
        onClose={() => setMergeFor(null)}
      />
      {/* "+ Nieuw ingrediënt": the picker's form (with its "Bestaat al" check). */}
      <IngredientPicker
        open={newOpen}
        startNew
        onPick={(id) => {
          setNewOpen(false);
          // "Gebruik" on the "Bestaat al" banner picks an existing entry: nothing was added then.
          const ing = dictionary.value.get(id);
          if (ing && isUserIngredientId(id)) setToast({ text: t('dict.created', { name: ingredientLabel(ing, l) }) });
        }}
        onClose={() => setNewOpen(false)}
      />
    </>
  );
}
