// "Koppel ingrediënt" bottom sheet (docs/phase-2-spec.md §5): search the dictionary in both
// languages and pick an entry, or create a new user ingredient (nl/en names, aisle, default unit,
// veg/staple) which is stored in `userIngredients`, merged into the dictionary signal and picked.
// The caller stores the picked id (a line override for builtins, the line itself for own recipes).
import { useEffect, useRef, useState } from 'preact/hooks';
import { slugId } from '@/domain/recipe-source';
import type { Ingredient } from '@/domain/dictionary';
import { saveUserIngredient } from '@/db/repo';
import { dictionary, isUserIngredientId, reloadDictionary } from '@/dictionary';
import { lang, t } from '@/i18n';

export interface IngredientPickerProps {
  open: boolean;
  /** Prefills the search field (the unresolved name part of the line). */
  initialQuery?: string;
  /** True opens the sheet on the "Nieuw ingrediënt" form right away, with `initialQuery` as the name. */
  startNew?: boolean;
  onPick: (id: string) => void;
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
    const uiLang = lang.value;
    setQuery(q);
    setMode(openForm ? 'new' : 'search');
    setNlOne(openForm && uiLang === 'nl' ? q : '');
    setNlMany('');
    setEnOne(openForm && uiLang === 'en' ? q : '');
    setEnMany('');
    setAisle('overig');
    setUnit('stuk');
    setVeg(true);
    setStaple(false);
    setError(null);
    setBusy(false);
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

  const startNew = () => {
    if (l === 'nl') setNlOne(q);
    else setEnOne(q);
    setError(null);
    setMode('new');
  };

  const save = async () => {
    const nl = nlOne.trim();
    const en = enOne.trim();
    if (!nl && !en) {
      setError(t('picker.nameRequired'));
      return;
    }
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
      props.onPick(entry.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={t('picker.title')} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{mode === 'new' ? t('picker.new') : t('picker.title')}</h2>
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
              <div class="muted small picker-hint">{t('picker.none')}</div>
            ) : (
              <ul class="picker-list">
                {results.map((ing) => {
                  const own = ing[l]?.one ?? ing[other]?.one ?? ing.id;
                  const alt = ing[other]?.one ?? '';
                  const aisleName = dict.aisle(ing.aisle)?.[l] ?? '';
                  return (
                    <li key={ing.id}>
                      <button type="button" class="picker-item" onClick={() => props.onPick(ing.id)}>
                        <span class="picker-name">
                          {own}
                          {isUserIngredientId(ing.id) && <span class="badge badge-muted picker-own">{t('picker.own')}</span>}
                        </span>
                        <span class="picker-sub muted small">
                          {alt && alt !== own ? alt : ''}
                          {alt && alt !== own && aisleName ? ' · ' : ''}
                          {aisleName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div class="actions">
              <button type="button" class="btn btn-secondary btn-block" onClick={startNew}>
                + {t('picker.new')}
              </button>
            </div>
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
              <button type="button" class="btn" disabled={busy} onClick={() => setMode('search')}>
                {t('picker.cancel')}
              </button>
              <button type="submit" class="btn btn-primary" disabled={busy}>
                {t('picker.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
