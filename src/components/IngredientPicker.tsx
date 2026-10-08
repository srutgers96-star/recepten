// "Koppel ingrediënt" bottom sheet (docs/phase-2-spec.md §5): search the dictionary in both
// languages and pick an entry, or create a new user ingredient (nl/en names, aisle, default unit,
// veg/staple) which is stored in `userIngredients`, merged into the dictionary signal and picked.
// The caller stores the picked id (a line override for builtins, the line itself for own recipes).
//
// Dictionary hygiene (docs/phase-5-spec.md A-bis.6): before a new entry is created, the typed
// name is checked against the dictionary in both languages (aliases and plurals included,
// `Dictionary.findExisting`); a hit shows "Bestaat al: aubergine (eggplant) — die gebruiken?"
// with one tap to pick that entry instead ("Gebruik") or to create the new one anyway.
import { useEffect, useRef, useState } from 'preact/hooks';
import { slugId } from '@/domain/recipe-source';
import type { Ingredient } from '@/domain/dictionary';
import type { Lang } from '@/domain/model';
import { saveUserIngredient } from '@/db/repo';
import { dictionary, isUserIngredientId, reloadDictionary } from '@/dictionary';
import { lang, t } from '@/i18n';

export interface IngredientPickerProps {
  open: boolean;
  /** Prefills the search field (the unresolved name part of the line). */
  initialQuery?: string;
  /** True opens the sheet on the "Nieuw ingrediënt" form right away, with `initialQuery` as the name. */
  startNew?: boolean;
  /**
   * The language of the prefilled name (docs/phase-6-spec.md 6A.14): which name field `initialQuery`
   * goes into when the form opens. The editor passes the language the line is written in (an NL line
   * in an EN-set app must not become an English entry); default the UI language.
   */
  initialLang?: Lang;
  /** Sheet title (default "Koppel ingrediënt"); the dictionary screen's "Fuseer" passes its own. */
  title?: string;
  /** An id that must not be picked (the own entry being merged): shown greyed with a hint. */
  excludeId?: string;
  /** False hides "+ Nieuw ingrediënt" (a merge target must exist already). Default true. */
  allowNew?: boolean;
  /**
   * The sheet is only the "Nieuw ingrediënt" form (Woordenboek → "+ Nieuw ingrediënt", block E.2;
   * use with `startNew`): Annuleer closes the sheet instead of going back to the link search, and
   * the save button says "Zet in woordenboek" (nothing is linked there).
   */
  newOnly?: boolean;
  /** `created` is true when the id is the entry this sheet just saved (not an existing one picked). */
  onPick: (id: string, created?: boolean) => void;
  onClose: () => void;
}

const MAX_RESULTS = 40;

/** A dictionary id for a new user entry that does not collide with an existing one. */
export function uniqueIngredientId(nameNl: string, nameEn: string): string {
  const base = slugId(nameNl.trim() || nameEn.trim()) || 'ingredient';
  let id = base;
  for (let n = 2; dictionary.value.get(id); n++) id = `${base}-${n}`;
  return id;
}

/** "aubergine (eggplant)": the entry's name in the UI language with the other language in brackets. */
export function ingredientLabel(ing: Ingredient, l: 'nl' | 'en'): string {
  const other = l === 'nl' ? 'en' : 'nl';
  const own = ing[l]?.one || ing[other]?.one || ing.id;
  const alt = ing[other]?.one || '';
  return alt && alt !== own ? `${own} (${alt})` : own;
}

export function IngredientPicker(props: IngredientPickerProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [nlOne, setNlOne] = useState('');
  const [nlMany, setNlMany] = useState('');
  const [enOne, setEnOne] = useState('');
  const [enMany, setEnMany] = useState('');
  const [aisle, setAisle] = useState('overig');
  const [unit, setUnit] = useState<string>('stuk');
  const [veg, setVeg] = useState(true);
  const [staple, setStaple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Toch nieuw": the existing entry id the person chose to ignore for this form.
  const [ignoreExisting, setIgnoreExisting] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // The latest props, read by the effects below without re-running them on every render (the
  // caller recomputes `initialQuery` and passes an inline `onClose`; a dictionary change while
  // the sheet is open must not wipe a half-typed query or the new-ingredient form).
  const latest = useRef(props);
  latest.current = props;

  // Reset on the OPEN transition only: fresh query, search mode (or the form when asked), empty form.
  useEffect(() => {
    if (!props.open) return;
    const { initialQuery, startNew: openForm } = latest.current;
    const q = initialQuery ?? '';
    const nameLang = latest.current.initialLang ?? lang.value;
    setQuery(q);
    setMode(openForm ? 'new' : 'search');
    setNlOne(openForm && nameLang === 'nl' ? q : '');
    setNlMany('');
    setEnOne(openForm && nameLang === 'en' ? q : '');
    setEnMany('');
    setAisle('overig');
    setUnit('stuk');
    setVeg(true);
    setStaple(false);
    setError(null);
    setBusy(false);
    setIgnoreExisting(null);
    const id = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [props.open]);

  // Escape closes.
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open]);

  if (!props.open) return null;

  const l = lang.value;
  const other = l === 'nl' ? 'en' : 'nl';
  const dict = dictionary.value;
  const q = query.trim();
  const results = q ? dict.search(q, l).slice(0, MAX_RESULTS) : [];
  const allowNew = props.allowNew !== false;

  // A-bis.6: the typed name (either language) already is an entry.
  const existing = mode === 'new' ? (dict.findExisting(nlOne.trim(), 'nl') ?? dict.findExisting(enOne.trim(), 'en')) : undefined;
  const existingShown = existing && existing.id !== ignoreExisting ? existing : undefined;

  const startNew = () => {
    // The query goes into the field of the language it was written in (6A.14), like on open.
    const nameLang = props.initialLang ?? l;
    if (nameLang === 'nl') setNlOne(q);
    else setEnOne(q);
    setError(null);
    setIgnoreExisting(null);
    setMode('new');
  };

  const save = async () => {
    const nl = nlOne.trim();
    const en = enOne.trim();
    if (!nl && !en) {
      setError(t('picker.nameRequired'));
      return;
    }
    // The banner is already visible; a submit with it open is not a "create anyway".
    if (existingShown) return;
    setBusy(true);
    setError(null);
    try {
      const entry: Ingredient = {
        id: uniqueIngredientId(nl, en),
        nl: nl ? { one: nl, ...(nlMany.trim() ? { many: nlMany.trim() } : {}) } : { one: en },
        en: en ? { one: en, ...(enMany.trim() ? { many: enMany.trim() } : {}) } : { one: nl },
        aisle,
        defaultUnit: unit === '' ? null : unit,
        staple,
        veg,
      };
      await saveUserIngredient(entry);
      await reloadDictionary();
      props.onPick(entry.id, true);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const title = props.title ?? t('picker.title');

  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{mode === 'new' ? t('picker.new') : title}</h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            ×
          </button>
        </div>

        {mode === 'search' ? (
          <div class="sheet-body">
            <input
              ref={searchRef}
              class="input"
              type="search"
              autocomplete="off"
              autocapitalize="off"
              enterKeyHint="search"
              placeholder={t('picker.search')}
              value={query}
              onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            />
            {q === '' ? (
              <div class="muted small picker-hint">{t('picker.hint')}</div>
            ) : results.length === 0 ? (
              <div class="muted small picker-hint">{allowNew ? t('picker.none') : t('dict.noResults')}</div>
            ) : (
              <ul class="picker-list">
                {results.map((ing) => {
                  const own = ing[l]?.one ?? ing[other]?.one ?? ing.id;
                  const alt = ing[other]?.one ?? '';
                  const aisleName = dict.aisle(ing.aisle)?.[l] ?? '';
                  const excluded = ing.id === props.excludeId;
                  return (
                    <li key={ing.id}>
                      <button type="button" class={'picker-item' + (excluded ? ' picker-excluded' : '')} disabled={excluded} onClick={() => props.onPick(ing.id)}>
                        <span class="picker-name">
                          {own}
                          {isUserIngredientId(ing.id) && <span class="badge badge-muted picker-own">{t('picker.own')}</span>}
                        </span>
                        <span class="picker-sub muted small">
                          {excluded ? t('picker.exclude') : ''}
                          {!excluded && alt && alt !== own ? alt : ''}
                          {!excluded && alt && alt !== own && aisleName ? ' · ' : ''}
                          {!excluded ? aisleName : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {allowNew && (
              <div class="actions">
                <button type="button" class="btn btn-secondary btn-block" onClick={startNew}>
                  + {t('picker.new')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <form
            class="sheet-body picker-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div class="picker-pair">
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
            <div class="picker-pair">
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
            {existingShown && (
              <div class="picker-exists" role="status">
                <div class="picker-exists-text">
                  {t('picker.exists', { name: ingredientLabel(existingShown, l) })}
                  {isUserIngredientId(existingShown.id) && <span class="badge badge-muted picker-own">{t('picker.own')}</span>}
                </div>
                <div class="actions picker-exists-actions">
                  <button type="button" class="btn btn-primary" disabled={busy} onClick={() => props.onPick(existingShown.id)}>
                    {t('picker.useExisting')}
                  </button>
                  <button type="button" class="btn" disabled={busy} onClick={() => setIgnoreExisting(existingShown.id)}>
                    {t('picker.newAnyway')}
                  </button>
                </div>
              </div>
            )}
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
            <label class="field">
              <span>{t('picker.unit')}</span>
              <select class="input" value={unit} onChange={(e) => setUnit((e.currentTarget as HTMLSelectElement).value)}>
                <option value="stuk">{t('picker.unitPieces')}</option>
                <option value="">{t('picker.unitNone')}</option>
                {dict.units
                  .filter((u) => u.id !== 'stuk')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {l === 'nl' ? `${u.nl.one} (${u.en.one})` : `${u.en.one} (${u.nl.one})`}
                    </option>
                  ))}
              </select>
            </label>
            <label class="check">
              <input type="checkbox" checked={veg} onChange={(e) => setVeg((e.currentTarget as HTMLInputElement).checked)} />
              {t('picker.veg')}
            </label>
            <label class="check">
              <input type="checkbox" checked={staple} onChange={(e) => setStaple((e.currentTarget as HTMLInputElement).checked)} />
              {t('picker.staple')}
            </label>
            {error && <div class="bad small">{error}</div>}
            <div class="actions">
              <button type="button" class="btn" disabled={busy} onClick={() => (props.newOnly ? props.onClose() : setMode('search'))}>
                {props.newOnly ? t('common.cancel') : t('picker.cancel')}
              </button>
              <button type="submit" class="btn btn-primary" disabled={busy || !!existingShown}>
                {props.newOnly ? t('dict.newSave') : t('picker.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
