// The bottom action bar of select mode (docs/phase-5-spec.md A-bis.8), shown by the Recipes
// list above the nav while recipes are selected: the count, then Deel · Deze week · Labels ·
// Verwijder · Exporteer. The bar is pure UI: the list owns the selection and does the writes.
// "Labels" opens the category/labels sheet (below), "Verwijder" an inline confirm (own and
// received recipes only; classics stay). Escape leaves select mode (the list handles the key).
import { useState } from 'preact/hooks';
import { categoryLabel } from '@/components/FilterChips';
import { META_TAG_IDS, metaTagLabel } from '@/components/MetaRows';
import { dictionary } from '@/dictionary';
import { DIET_TAGS, type DietTag } from '@/domain/diet';
import type { Recipe } from '@/domain/model';
import { t } from '@/i18n';

/**
 * What the category/labels sheet applies to every selected recipe: `category` undefined =
 * leave as it is, null = none, else the id; `tags` only the chips the person touched.
 */
export interface MetaChange {
  category?: string | null;
  tags: Array<{ id: string; on: boolean }>;
}

export interface SelectBarProps {
  /** The selected recipes (effective: override applied), in list order. */
  selected: readonly Recipe[];
  /** Any action running: buttons disabled. */
  busy?: boolean;
  /** The share message is being built (Deel disabled until it is ready). */
  building?: boolean;
  /** One-line status under the buttons ("3 toegevoegd aan je week"). */
  status?: string;
  onShare: () => void;
  onWeek: () => void;
  onMeta: (change: MetaChange) => void;
  onDelete: (own: readonly Recipe[]) => void;
  onExport: () => void;
}

/** Own and received recipes: the ones "Verwijder" may remove. */
export function deletableOf(list: readonly Recipe[]): Recipe[] {
  return list.filter((r) => r.origin.kind !== 'builtin');
}

const ICONS = {
  share: <path d="M12 3v13M7 8l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />,
  week: <path d="M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M12 13v4M10 15h4" />,
  meta: <path d="M3 5h11l7 7-7 7H3zM7 12h.01" />,
  delete: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  export: <path d="M12 3v12M8 11l4 4 4-4M4 17v3h16v-3" />,
};

function Icon(props: { name: keyof typeof ICONS }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {ICONS[props.name]}
    </svg>
  );
}

export function SelectBar(props: SelectBarProps) {
  const [sheet, setSheet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const n = props.selected.length;
  const own = deletableOf(props.selected);
  const none = n === 0;
  const busy = props.busy === true;

  function action(name: keyof typeof ICONS, label: string, onClick: () => void, disabled = false, danger = false) {
    return (
      <button type="button" class={'select-action' + (danger ? ' danger' : '')} disabled={none || busy || disabled} onClick={onClick}>
        <Icon name={name} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div class="select-bar" role="toolbar" aria-label={t('select.enter')}>
      <div class="select-count" aria-live="polite">
        {none ? t('select.none') : t('select.count', { n })}
        {props.status && <span class="select-status">{props.status}</span>}
      </div>
      {confirmDelete ? (
        <div class="confirm select-confirm" role="alertdialog" aria-label={t('select.delete')}>
          <p>{own.length === 1 ? t('select.deleteOne') : t('select.deleteConfirm', { n: own.length })}</p>
          {own.length < n && <p class="muted small">{t('select.deleteOnlyOwn', { n: n - own.length })}</p>}
          <div class="actions">
            <button
              type="button"
              class="btn btn-primary btn-danger"
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false);
                props.onDelete(own);
              }}
            >
              {t('recipe.deleteYes')}
            </button>
            <button type="button" class="btn" disabled={busy} onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div class="select-actions">
          {action('share', t('select.share'), props.onShare, props.building === true)}
          {action('week', t('select.week'), props.onWeek)}
          {action('meta', t('select.meta'), () => setSheet(true))}
          {action('delete', t('select.delete'), () => setConfirmDelete(true), own.length === 0, true)}
          {action('export', t('select.export'), props.onExport)}
        </div>
      )}
      {sheet && (
        <MetaSheet
          selected={props.selected}
          onClose={() => setSheet(false)}
          onApply={(change) => {
            setSheet(false);
            props.onMeta(change);
          }}
        />
      )}
    </div>
  );
}

// --- Category / labels sheet -----------------------------------------------------------------

type ChipState = 'on' | 'off' | 'mixed';

/** What the chips show before anyone touches them: on/off when every recipe agrees, else mixed. */
function initialStates(selected: readonly Recipe[]): Record<string, ChipState> {
  const out: Record<string, ChipState> = {};
  for (const tag of META_TAG_IDS) {
    const count = selected.filter((r) => r.tags.includes(tag)).length;
    out[tag] = count === 0 ? 'off' : count === selected.length ? 'on' : 'mixed';
  }
  return out;
}

/** The common category when every selected recipe has the same one, else undefined. */
function commonCategory(selected: readonly Recipe[]): string | null | undefined {
  const first = selected[0]?.category ?? null;
  return selected.every((r) => (r.category ?? null) === first) ? first : undefined;
}

/** Sentinel option value for "leave the category as it is". */
const KEEP = '__keep__';

function MetaSheet(props: { selected: readonly Recipe[]; onClose: () => void; onApply: (change: MetaChange) => void }) {
  const dict = dictionary.value;
  const common = commonCategory(props.selected);
  // The select's initial value: the shared category, '' for none, KEEP when they differ.
  const baseCategory = common === undefined ? KEEP : (common ?? '');
  const [category, setCategory] = useState<string>(baseCategory);
  const [states, setStates] = useState<Record<string, ChipState>>(() => initialStates(props.selected));
  const [touched, setTouched] = useState<Set<string>>(() => new Set());

  function toggle(tag: string) {
    // mixed → on (give it to all), on → off, off → on.
    const next: ChipState = states[tag] === 'on' ? 'off' : 'on';
    setStates({ ...states, [tag]: next });
    setTouched(new Set(touched).add(tag));
  }

  function apply() {
    const change: MetaChange = { tags: [] };
    if (categoryChanged) change.category = category || null;
    for (const tag of touched) change.tags.push({ id: tag, on: states[tag] === 'on' });
    props.onApply(change);
  }

  const categoryChanged = category !== KEEP && category !== baseCategory;
  const dirty = touched.size > 0 || categoryChanged;

  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={t('select.metaTitle')} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{t('select.metaTitle')}</h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            ×
          </button>
        </div>
        <div class="sheet-body">
          <p class="muted small select-meta-hint">{t('select.metaHint', { n: props.selected.length })}</p>
          <label class="field">
            <span>{t('meta.category')}</span>
            <select class="input" name="select-category" value={category} onChange={(e) => setCategory((e.currentTarget as HTMLSelectElement).value)}>
              {common === undefined && <option value={KEEP}>{t('select.metaKeep')}</option>}
              <option value="">{t('recipe.noCategory')}</option>
              {dict.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c, c.id)}
                </option>
              ))}
            </select>
          </label>
          <div class="field">
            <span>{t('meta.tags')}</span>
            <div class="select-tags" role="group" aria-label={t('meta.tags')}>
              {META_TAG_IDS.map((tag) => {
                const state = states[tag] ?? 'off';
                const diet = DIET_TAGS.includes(tag as DietTag);
                return (
                  <button
                    key={tag}
                    type="button"
                    class={'select-tag' + (state === 'on' ? ' on' : '') + (state === 'mixed' ? ' mixed' : '') + (diet ? ' diet' : '')}
                    aria-pressed={state === 'mixed' ? 'mixed' : state === 'on'}
                    onClick={() => toggle(tag)}
                  >
                    {metaTagLabel(tag)}
                    {state === 'mixed' && <span class="select-tag-mixed">{t('select.metaMixed')}</span>}
                  </button>
                );
              })}
            </div>
            <p class="muted small select-meta-hint">{t('select.metaTagsHint')}</p>
          </div>
          <div class="actions">
            <button type="button" class="btn btn-primary btn-block" disabled={!dirty} onClick={apply}>
              {t('select.metaApply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
