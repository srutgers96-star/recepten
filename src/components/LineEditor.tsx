// List editor for the recipe editor: one row per ingredient line or cooking step, one field per
// chosen language (NL, EN or both), "+" to add, ✕ per row. Single-line mode: Enter moves focus to
// the next field and adds a row after the last one (never submits). Multi-line mode (steps):
// textareas, Enter inserts a line break. All fields are 16 px (no iOS zoom), targets 44 px.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Lang } from '@/domain/model';

/** One editable row with both languages; the hidden language keeps its value (never dropped). */
export interface EditText {
  key: string;
  nl: string;
  en: string;
}

let seq = 0;

export function newEditText(nl = '', en = ''): EditText {
  seq += 1;
  return { key: 'e' + seq, nl, en };
}

/** True when the row has text in one of the given languages. */
export function editTextHasContent(t: EditText, langs: Lang[]): boolean {
  return langs.some((l) => t[l].trim() !== '');
}

export interface LineEditorProps {
  items: EditText[];
  /** Languages to show, in order (nl before en). */
  langs: Lang[];
  onChange: (items: EditText[]) => void;
  /** Textareas instead of inputs (steps). */
  multiline?: boolean;
  /** Row numbers "1." in front of every row (steps). */
  numbered?: boolean;
  placeholder?: Partial<Record<Lang, string>>;
  addLabel: string;
  removeLabel: string;
  /** Rendered under the fields of a row (the ingredient chips); null/undefined renders nothing. */
  renderExtra?: (item: EditText, idx: number) => ComponentChildren;
}

function focusField(el: HTMLElement) {
  el.focus();
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function LineEditor(props: LineEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  // "<rowKey>:<lang>" of the field to focus after the next render (a row added with Enter or "+").
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const wanted = pendingFocus.current;
    if (!wanted || !root.current) return;
    pendingFocus.current = null;
    const el = root.current.querySelector<HTMLElement>(`[data-focus="${wanted}"]`);
    if (el) focusField(el);
  });

  function update(idx: number, lang: Lang, value: string) {
    props.onChange(props.items.map((it, i) => (i === idx ? { ...it, [lang]: value } : it)));
  }

  function add(focus: boolean) {
    const item = newEditText();
    if (focus) pendingFocus.current = `${item.key}:${props.langs[0] ?? 'nl'}`;
    props.onChange([...props.items, item]);
  }

  function remove(idx: number) {
    // The list never becomes empty: removing the last row leaves one empty row.
    const rest = props.items.filter((_, i) => i !== idx);
    props.onChange(rest.length ? rest : [newEditText()]);
  }

  // Enter on a single-line field: next field, or a new row after the last one. Never a submit.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!root.current) return;
    const fields = [...root.current.querySelectorAll<HTMLElement>('[data-focus]')];
    const next = fields[fields.indexOf(e.currentTarget as HTMLElement) + 1];
    if (next) focusField(next);
    else add(true);
  }

  const showTag = props.langs.length > 1;

  return (
    <div class={'le' + (props.multiline ? ' le-multi' : '')} ref={root}>
      {props.items.map((it, idx) => (
        <div class="le-row" key={it.key}>
          {props.numbered && <span class="le-num">{idx + 1}.</span>}
          <div class="le-fields">
            {props.langs.map((l) => (
              <div class="le-field" key={l}>
                {showTag && <span class="le-tag">{l.toUpperCase()}</span>}
                {props.multiline ? (
                  <textarea
                    class="input le-input"
                    rows={3}
                    value={it[l]}
                    placeholder={props.placeholder?.[l] ?? ''}
                    autocomplete="off"
                    data-focus={`${it.key}:${l}`}
                    onInput={(e) => update(idx, l, (e.currentTarget as HTMLTextAreaElement).value)}
                  />
                ) : (
                  <input
                    class="input le-input"
                    type="text"
                    value={it[l]}
                    placeholder={props.placeholder?.[l] ?? ''}
                    autocomplete="off"
                    enterKeyHint="next"
                    data-focus={`${it.key}:${l}`}
                    onKeyDown={onKeyDown}
                    onInput={(e) => update(idx, l, (e.currentTarget as HTMLInputElement).value)}
                  />
                )}
              </div>
            ))}
            {props.renderExtra?.(it, idx)}
          </div>
          <button type="button" class="btn btn-icon btn-danger" aria-label={props.removeLabel} onClick={() => remove(idx)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" class="btn btn-small le-add" onClick={() => add(true)}>
        {props.addLabel}
      </button>
    </div>
  );
}
