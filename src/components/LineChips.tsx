// Live chips under an ingredient input in the editor (docs/phase-2-spec.md §5 "Editor"):
// `[2] [el] [olijfolie ✓]` for a resolved line, `[?] naam` + "Koppel" / "Nieuw ingrediënt" for an
// unresolved one. Tapping a chip of a resolved line opens a small inline editor for quantity,
// unit, prep note and "optioneel"; the editor screen writes the result back into the raw text
// (raw stays the source of truth, invariant 2) with `rawFromLine`.
import { useState } from 'preact/hooks';
import type { Lang, Line, Qty } from '@/domain/model';
import { parseQty } from '@/domain/parser';
import { dictionary, lineParts } from '@/dictionary';
import { t } from '@/i18n';
import { rawFromLine, seedQty } from './line-raw';

export { rawFromLine };

/** What the inline editor hands back; the screen turns it into a raw line per language. */
export interface LineEdit {
  qty: Qty | null;
  unit: string | null;
  /** Prep note as typed, in `lang` of the chips ('' = none). */
  prep: string;
  optional: boolean;
}

export interface LineChipsProps {
  /** The effective (parsed + linked) line of the row. */
  line: Line;
  /** Language of the chips and of the inline editor. */
  lang: Lang;
  /** True while this row's inline editor is open. */
  editing: boolean;
  onOpenEdit: () => void;
  onCloseEdit: () => void;
  /** "Koppel": open the ingredient picker for this row. */
  onLink: () => void;
  /** "Nieuw ingrediënt": open the picker (its "+ Nieuw ingrediënt" form) for this row. */
  onNew: () => void;
  onApply: (edit: LineEdit) => void;
}

/** Prep text of a line in a language ('' when none). */
function prepTextOf(line: Line, lang: Lang): string {
  const p = line.prep;
  if (!p) return '';
  return p[lang] ?? p[lang === 'nl' ? 'en' : 'nl'] ?? '';
}

function LineChipEditor(props: { line: Line; lang: Lang; onApply: (edit: LineEdit) => void; onCancel: () => void; onLink: () => void }) {
  const { line, lang } = props;
  const dict = dictionary.value;
  // Seed amount AND unit from the stored line (½ l -> "½" + "l"), not from the rendered chips
  // (which show 500 ml / 100 ml in English): applying without touching the amount must be a no-op.
  const [qty, setQty] = useState(seedQty(line, lang));
  const [unit, setUnit] = useState(line.unit ?? '');
  const [prep, setPrep] = useState(prepTextOf(line, lang));
  const [optional, setOptional] = useState(line.optional === true);
  const [qtyBad, setQtyBad] = useState(false);

  function apply() {
    const text = qty.trim();
    let q: Qty | null = null;
    if (text) {
      const m = parseQty(text, lang);
      if (!m || m.length < text.length) {
        setQtyBad(true);
        return;
      }
      q = m.qty;
    }
    props.onApply({ qty: q, unit: unit === '' ? null : unit, prep: prep.trim(), optional });
  }

  return (
    <div class="lc-editor" role="group" aria-label={t('edit.chipEdit')}>
      <div class="lc-editor-row">
        <label class="field lc-qty">
          <span>{t('edit.qty')}</span>
          <input
            class="input"
            type="text"
            inputMode="decimal"
            autocomplete="off"
            placeholder="2, 2-3, ½"
            value={qty}
            onInput={(e) => {
              setQty((e.currentTarget as HTMLInputElement).value);
              setQtyBad(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
          />
        </label>
        <label class="field lc-unit">
          <span>{t('edit.unit')}</span>
          <select class="input" value={unit} onChange={(e) => setUnit((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">{t('edit.unitNone')}</option>
            {dict.units.map((u) => (
              <option key={u.id} value={u.id}>
                {lang === 'nl' ? `${u.nl.one} (${u.en.one})` : `${u.en.one} (${u.nl.one})`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {qtyBad && <div class="bad small">{t('edit.qtyInvalid')}</div>}
      <label class="field">
        <span>{t('edit.prep')}</span>
        <input
          class="input"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          placeholder={t('edit.prepPlaceholder')}
          value={prep}
          onInput={(e) => setPrep((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
        />
      </label>
      <label class="check">
        <input type="checkbox" checked={optional} onChange={(e) => setOptional((e.currentTarget as HTMLInputElement).checked)} />
        {t('edit.optional')}
      </label>
      <div class="actions lc-editor-actions">
        <button type="button" class="btn btn-primary" onClick={apply}>
          {t('edit.apply')}
        </button>
        <button type="button" class="btn" onClick={props.onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" class="btn btn-small" onClick={props.onLink}>
          {t('edit.relink')}
        </button>
      </div>
    </div>
  );
}

export function LineChips(props: LineChipsProps) {
  const { line, lang } = props;
  if (line.kind === 'header') {
    return (
      <div class="lc">
        <span class="lc-chip lc-muted">{t('edit.headerChip')}</span>
      </div>
    );
  }
  const p = lineParts(line, lang);
  // `resolved` is false for an unlinked line AND for an `ing` this dictionary does not know.
  const resolved = p.resolved;
  const open = props.editing ? props.onCloseEdit : props.onOpenEdit;
  return (
    <div class="lc-wrap">
      <div class="lc">
        {p.part && (
          <button type="button" class="lc-chip" onClick={open} disabled={!resolved}>
            {p.part}
          </button>
        )}
        {p.qty && (
          <button type="button" class="lc-chip" onClick={open} disabled={!resolved}>
            {p.qty}
          </button>
        )}
        {p.unit && (
          <button type="button" class="lc-chip" onClick={open} disabled={!resolved}>
            {p.unit}
          </button>
        )}
        {resolved ? (
          <button type="button" class="lc-chip lc-ok" onClick={open}>
            {p.name} <span class="lc-tick">✓</span>
          </button>
        ) : (
          <>
            <span class="lc-chip lc-unresolved" title={t('edit.unresolved')}>
              ? {line.name || p.text}
            </span>
            <button type="button" class="btn btn-small lc-btn" onClick={props.onLink}>
              {t('edit.link')}
            </button>
            <button type="button" class="btn btn-small lc-btn" onClick={props.onNew}>
              {t('edit.newIngredient')}
            </button>
          </>
        )}
        {resolved && p.prep && (
          <button type="button" class="lc-chip lc-soft" onClick={open}>
            {p.prep}
          </button>
        )}
        {resolved && p.optional && (
          <button type="button" class="lc-chip lc-soft" onClick={open}>
            {p.optional}
          </button>
        )}
      </div>
      {props.editing && resolved && (
        <LineChipEditor line={line} lang={lang} onApply={props.onApply} onCancel={props.onCloseEdit} onLink={props.onLink} />
      )}
    </div>
  );
}
