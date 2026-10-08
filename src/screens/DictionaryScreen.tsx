// '#/more/dictionary' — Woordenboek (docs/phase-5-spec.md A-bis.6; block E.2 extends it): search
// over every entry (bundled + own) in both languages, own entries first with an "eigen" badge.
// Per own entry: Bewerk (nl/en names, aisle), "Fuseer met bestaand" (pick the existing entry in the
// IngredientPicker → repo.mergeIngredient rewrites every reference in one transaction and keeps a
// snapshot; the toast offers "Ongedaan") and Verwijder. "Opruimen" lists own entries whose name
// already exists (repo.findOwnDuplicates) and merges them one by one or all at once.
// Block E.2 on top of that: an aisle chip strip ("Alle" + every aisle that has entries, in
// aisles.json order) that combines with the search field — without a query it lists the whole
// aisle alphabetically; any filtered list renders at most PAGE rows and "Toon meer" adds the next
// page, because the dictionary grows to ±1900 entries. A tap on a row opens a read-only detail
// (both names with plural, aliases, aisle, default unit, flags as chips); own entries keep their
// Bewerk/Fuseer/Verwijder. "+ Nieuw ingrediënt" sits next to the counter and opens the picker's own
// form (`startNew` + `newOnly`, incl. the "Bestaat al" check); the counter shows the totals, or the
// count for the active search/aisle ("312 in Groente & fruit").
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { IngredientPicker, ingredientLabel } from '@/components/IngredientPicker';
import { deleteUserIngredient, findOwnDuplicates, mergeIngredient, saveUserIngredient, undoMerge, type OwnDuplicate } from '@/db/repo';
import { baseDictionary, dictionary, isUserIngredientId, reloadDictionary, userIngredients } from '@/dictionary';
import { normalizeKey, type Ingredient } from '@/domain/dictionary';
import type { Lang } from '@/domain/model';
import { lang, t } from '@/i18n';

/** Rows rendered at once; "Toon meer" adds another page (block E: the list must stay fast at ±1900 entries). */
const PAGE = 100;
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

/** "sjalot" plus "· meervoud: sjalotten" (muted) when the entry has a plural. */
function NamePair(props: { n: { one: string; many?: string } | undefined }) {
  const { n } = props;
  if (!n?.one) return <>—</>;
  return (
    <>
      {n.one}
      {n.many && n.many !== n.one && <span class="muted"> · {t('dict.pluralOf', { many: n.many })}</span>}
    </>
  );
}

interface Flag {
  key: string;
  /** Diet chips (vegetarisch/vegan/glutenvrij) get the green diet look; the rest are plain info. */
  diet: boolean;
}

/**
 * The entry's flags as plain-language chips. A missing flag means "unknown" and shows nothing;
 * `gluten` means "contains gluten": false (and not unsure) = gluten-free, true = "bevat gluten",
 * `glutenUnsure` = "misschien gluten" (the same doubt diet.ts reports as "waarschijnlijk").
 */
function entryFlags(ing: Ingredient): Flag[] {
  const flags: Flag[] = [];
  if (ing.veg === true) flags.push({ key: 'dict.flag.veg', diet: true });
  if (ing.vegan === true) flags.push({ key: 'dict.flag.vegan', diet: true });
  if (ing.glutenUnsure === true) flags.push({ key: 'dict.flag.glutenUnsure', diet: false });
  else if (ing.gluten === false) flags.push({ key: 'dict.flag.glutenfree', diet: true });
  else if (ing.gluten === true) flags.push({ key: 'dict.flag.gluten', diet: false });
  if (ing.perishable === true) flags.push({ key: 'dict.flag.perishable', diet: false });
  if (ing.staple === true) flags.push({ key: 'dict.flag.staple', diet: false });
  return flags;
}

/**
 * Read-only detail of an entry (block E.2): both names (singular + plural), aliases, aisle,
 * default unit and the flags as chips. Built-in entries are never editable here.
 */
function EntryDetail(props: { ing: Ingredient }) {
  const { ing } = props;
  const l = lang.value;
  const dict = dictionary.value;
  const aisleName = dict.aisle(ing.aisle)?.[l] ?? ing.aisle;
  // UI language first; an alias that equals one of the names or an earlier alias is shown once.
  // Also skip an alias that only repeats one of the entry's own names ("hagelslag" is both the NL
  // name and an EN alias; "avocados" is the EN plural).
  const seenAlias = new Set<string>([ing.nl?.one, ing.nl?.many, ing.en?.one, ing.en?.many].filter((n): n is string => !!n).map(normalizeKey));
  const aliases = [...(ing.aliases?.[l] ?? []), ...(ing.aliases?.[l === 'nl' ? 'en' : 'nl'] ?? [])].filter((a) => {
    const k = normalizeKey(a);
    if (seenAlias.has(k)) return false;
    seenAlias.add(k);
    return true;
  });
  const du = ing.defaultUnit;
  let unitLabel: string;
  if (!du) unitLabel = t('picker.unitNone');
  else if (du === 'stuk') unitLabel = t('picker.unitPieces');
  else {
    const u = dict.unit(du);
    unitLabel = u ? (u[l].long ?? u[l].one) : du;
  }
  const flags = entryFlags(ing);
  return (
    <div class="dw-detail">
      <dl class="dw-facts">
        <dt>{t('picker.nl')}</dt>
        <dd>
          <NamePair n={ing.nl} />
        </dd>
        <dt>{t('picker.en')}</dt>
        <dd>
          <NamePair n={ing.en} />
        </dd>
        {aliases.length > 0 && (
          <>
            <dt>{t('dict.aliases')}</dt>
            <dd>{aliases.join(', ')}</dd>
          </>
        )}
        <dt>{t('dict.aisleLabel')}</dt>
        <dd>{aisleName}</dd>
        <dt>{t('picker.unit')}</dt>
        <dd>{unitLabel}</dd>
      </dl>
      {flags.length > 0 && (
        <ul class="dw-flags" aria-label={t('dict.flags')}>
          {flags.map((f) => (
            <li key={f.key} class={'dw-flag' + (f.diet ? ' dw-flag-diet' : '')}>
              {t(f.key)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
  /** Detail block open; a tap on the name toggles it (block E.2). */
  open: boolean;
  onToggle: () => void;
  /** An aisle filter is on: the aisle name under every row would only repeat the chip. */
  hideAisle: boolean;
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
      <button type="button" class="dw-rowbtn" aria-expanded={props.open} onClick={props.onToggle}>
        <span class="dw-name">
          {name}
          {own && <span class="badge badge-muted">{t('dict.own')}</span>}
          <span class="dw-sub muted small">{[alt && alt !== name ? alt : '', props.hideAisle ? '' : aisleName].filter(Boolean).join(' · ')}</span>
        </span>
        <span class={'dw-caret' + (props.open ? ' open' : '')} aria-hidden="true">
          ▸
        </span>
      </button>
      {props.open && !props.editing && <EntryDetail ing={ing} />}
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
  // Block E.2: aisle chip filter (null = "Alle") and the one expanded detail row.
  const [aisle, setAisle] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Rows rendered for one filter combination: a new query or aisle starts at PAGE again without
  // an extra render (the count belongs to the key it was raised for).
  const [paging, setPaging] = useState<{ key: string; n: number }>({ key: '', n: PAGE });
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

  /** Entries per aisle id (one pass over the whole dictionary): chips only for aisles that have entries. */
  const aisleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of dict.ingredients) counts.set(i.aisle, (counts.get(i.aisle) ?? 0) + 1);
    return counts;
  }, [dict]);
  // aisles.json order (Dictionary sorts by `order`); the chosen one stays even if it emptied out.
  const aisleChips = dict.aisles.filter((a) => (aisleCounts.get(a.id) ?? 0) > 0 || a.id === aisle);

  /**
   * Everything the active filters allow, unpaged: search hits (own first, then by rank), narrowed
   * to the chosen aisle; without a query the whole aisle alphabetically in the UI language.
   * Empty when no filter is active (the default view: own entries + Opruimen).
   */
  const filtered = useMemo(() => {
    if (q) {
      const hits = dict.search(q, l);
      const inAisle = aisle ? hits.filter((i) => i.aisle === aisle) : hits;
      const ownHits = inAisle.filter((i) => isUserIngredientId(i.id));
      const rest = inAisle.filter((i) => !isUserIngredientId(i.id));
      return [...ownHits, ...rest];
    }
    if (aisle) {
      const collator = new Intl.Collator(l, { sensitivity: 'base', numeric: true });
      return dict.ingredients.filter((i) => i.aisle === aisle).sort((a, b) => collator.compare(nameOf(a, l), nameOf(b, l)));
    }
    return [];
  }, [q, aisle, dict, l]);
  const filterKey = `${aisle ?? ''}\u0000${q}`;
  const shown = paging.key === filterKey ? paging.n : PAGE;
  const visible = filtered.length > shown ? filtered.slice(0, shown) : filtered;
  const filtering = q !== '' || aisle !== null;
  const aisleLabel = aisle ? (dict.aisle(aisle)?.[l] ?? aisle) : '';
  // Counter line: the totals by default, otherwise the count for the active filter(s).
  const countText = q
    ? aisle
      ? t('dict.countFoundAisle', { n: filtered.length, name: aisleLabel })
      : t('dict.countFound', { n: filtered.length })
    : aisle
      ? t('dict.countAisle', { n: filtered.length, name: aisleLabel })
      : t('dict.counts', { builtin: builtinCount, own: own.length });

  /** After "+ Nieuw ingrediënt" (or "Gebruik" on its "Bestaat al" banner): show that entry, opened. */
  function showEntry(id: string) {
    const ing = dictionary.value.get(id);
    if (!ing) return;
    setAisle(null);
    setQuery(nameOf(ing, l));
    setOpenId(id);
  }

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

  /** Every duplicate in turn (each with its own snapshot; only the last one is undoable, so the person confirms first and no undo is offered). */
  async function mergeAll() {
    if (!dupes || !dupes.length) return;
    if (!confirm(t('dict.mergeAllConfirm', { n: dupes.length }))) return;
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
    open: openId === ing.id,
    onToggle: () => setOpenId((cur) => (cur === ing.id ? null : ing.id)),
    hideAisle: aisle !== null && ing.aisle === aisle,
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
        {/* Counter + "+ Nieuw ingrediënt" (block E.2: the picker's own form, incl. "Bestaat al"). */}
        <div class="dw-head">
          <p class="muted small dw-counts" aria-live="polite">
            {countText}
          </p>
          <button type="button" class="btn btn-secondary" disabled={busy} onClick={() => setNewOpen(true)}>
            {t('dict.new')}
          </button>
        </div>

        {/* Aisle filter: scrollable chip strip in aisles.json order; combines with the search field. */}
        <div class="chips dw-aisles" role="group" aria-label={t('dict.aisleFilter')}>
          <button type="button" class={'chip' + (aisle === null ? ' on' : '')} aria-pressed={aisle === null} onClick={() => setAisle(null)}>
            {t('dict.aisleAll')}
          </button>
          {aisleChips.map((a) => (
            <button
              key={a.id}
              type="button"
              class={'chip' + (aisle === a.id ? ' on' : '')}
              aria-pressed={aisle === a.id}
              onClick={() => setAisle((cur) => (cur === a.id ? null : a.id))}
            >
              {a[l]}
            </button>
          ))}
        </div>

        {filtering ? (
          filtered.length === 0 ? (
            <div class="empty">{t('dict.noResults')}</div>
          ) : (
            <>
              <ul class="dw-list">
                {visible.map((ing) => (
                  <EntryRow key={ing.id} {...rowProps(ing)} />
                ))}
              </ul>
              {filtered.length > visible.length && (
                <div class="dw-more">
                  <button type="button" class="btn" onClick={() => setPaging({ key: filterKey, n: shown + PAGE })}>
                    {t('dict.showMore', { n: filtered.length - visible.length })}
                  </button>
                </div>
              )}
            </>
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
      {/* "+ Nieuw ingrediënt": the picker's form (with its "Bestaat al" check); Annuleren closes it. */}
      <IngredientPicker
        open={newOpen}
        startNew
        newOnly
        onPick={(id, created) => {
          setNewOpen(false);
          // "Gebruik" on the "Bestaat al" banner picks an entry that was there already: nothing added.
          const ing = dictionary.value.get(id);
          if (ing && created) setToast({ text: t('dict.created', { name: ingredientLabel(ing, l) }) });
          showEntry(id);
        }}
        onClose={() => setNewOpen(false)}
      />
    </>
  );
}
