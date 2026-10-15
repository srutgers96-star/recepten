// "Welk woord is het ingrediënt?" sheet (docs/phase-6-spec.md 6A.16): opened from the orange "?"
// chip of an unrecognised line. The words of the name part (and of an "of …" alternative) are
// toggle buttons — green = the ingredient to look up, grey = becomes a note — preselected by
// `suggestSelection` (the largest window the dictionary knows). A live line says whether the
// green words resolve ("stokbrood → gevonden ✓") and shows the line as it will read. "Koppel zo"
// hands a `WordLink` (ing + the grey words) to the caller, which stores it as a line correction
// (`applyWordLink` / `wordLinkOverride` in src/domain/line-words.ts); the raw text is never
// rewritten (CLAUDE.md invariant 2). "Nieuw ingrediënt" opens the IngredientPicker form with the
// green words as the name. Uses the .sheet-* shell of base.css (same as IngredientPicker).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ingredientLabel } from '@/components/IngredientPicker';
import { dictionary, lineText } from '@/dictionary';
import { applyWordLink, lookupWords, splitNameWords, suggestSelection, type WordLink } from '@/domain/line-words';
import type { Lang, Line } from '@/domain/model';
import { lang, t } from '@/i18n';

export interface WordPickerProps {
  open: boolean;
  /** The effective (parsed + linked) line the chips show. */
  line: Line;
  /** The language the line is written in (`lineLang`): lookups and the note use it. */
  lineLang: Lang;
  /** "Koppel zo": link the line to the green words' ingredient, grey words as a note. */
  onLink: (link: WordLink) => void;
  /** "Nieuw ingrediënt": open the ingredient form with the green words as the name. */
  onNew: (query: string, lang: Lang) => void;
  /** "Zelf zoeken": open the dictionary search with the green words (hidden when absent). */
  onSearch?: (query: string, lang: Lang) => void;
  onClose: () => void;
}

export function WordPicker(props: WordPickerProps) {
  const { open, line, lineLang: ll } = props;
  const dict = dictionary.value;
  const words = useMemo(() => splitNameWords(line, ll), [line, ll]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const firstRef = useRef<HTMLButtonElement>(null);
  // The latest props for the effects below (an inline `onClose` must not re-run them).
  const latest = useRef(props);
  latest.current = props;

  // Preselect on the OPEN transition only (and when the words change while open).
  useEffect(() => {
    if (!open) return;
    setSelected(suggestSelection(words, dict, ll));
    const id = window.setTimeout(() => firstRef.current?.focus({ preventScroll: true }), 50);
    return () => window.clearTimeout(id);
  }, [open, words, dict, ll]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const ui = lang.value;
  const { query, note, found } = lookupWords(words, selected, dict, ll);
  const link: WordLink | undefined = found ? { ing: found.id, query, note, lang: ll } : undefined;
  const preview = link ? lineText(applyWordLink(line, link, dict), ui) : '';

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet wp-sheet" role="dialog" aria-modal="true" aria-label={t('words.title')} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{t('words.title')}</h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            ×
          </button>
        </div>
        <div class="sheet-body">
          <p class="muted small wp-hint">{t('words.hint')}</p>
          <div class="wp-words" role="group" aria-label={t('words.title')}>
            {words.map((w, i) => {
              const on = selected.has(i);
              return (
                <span key={i} class="wp-item">
                  {w.lead && <span class="wp-lead muted">{w.lead}</span>}
                  <button type="button" ref={i === 0 ? firstRef : undefined} class={'wp-word' + (on ? ' wp-on' : '')} aria-pressed={on} onClick={() => toggle(i)}>
                    {w.text}
                  </button>
                </span>
              );
            })}
          </div>
          <div class="wp-status" role="status" aria-live="polite">
            {query === '' ? (
              <span class="wp-bad">{t('words.none')}</span>
            ) : (
              <>
                <span>{t('words.ingredient', { query })} </span>
                {found ? <span class="wp-ok">{t('words.found', { name: ingredientLabel(found, ui) })}</span> : <span class="wp-bad">{t('words.notFound')}</span>}
                {note !== '' && <div class="muted small">{t('words.note', { note })}</div>}
                {!found && <div class="muted small">{t('words.notFoundHint')}</div>}
              </>
            )}
          </div>
          {preview !== '' && (
            <div class="wp-preview">
              <span class="muted small">{t('words.becomes')} </span>
              {preview}
            </div>
          )}
          <p class="muted small wp-stays">{t('words.rawStays')}</p>
          <div class="actions wp-actions">
            <button type="button" class="btn btn-primary" disabled={!link} onClick={() => link && props.onLink(link)}>
              {t('words.link')}
            </button>
            <button type="button" class="btn btn-secondary" disabled={query === ''} onClick={() => props.onNew(query, ll)}>
              + {t('edit.newIngredient')}
            </button>
            {props.onSearch && (
              <button type="button" class="btn" onClick={() => props.onSearch?.(query || words.map((w) => w.text).join(' '), ll)}>
                {t('words.search')}
              </button>
            )}
            <button type="button" class="btn" onClick={props.onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
