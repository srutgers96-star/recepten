// "Zet op de lijst?" (V6, docs/specs/verbeterronde-6.md §1b): the check step for a pasted (or typed)
// shopping list of three or more lines in the "+ wc-papier, melk …" field (ExtraField). One row per
// line in the order of the text: left the raw text (muted, with its amount), right the suggestion of
// `suggestShopLines` as radio chips —
// - `sure`: one filled chip with the ingredient's name in the app language;
// - `maybe`: an outlined chip with the best match plus at most two alternative chips;
// - `unknown`: the chip "Als tekst" chosen, with the alternatives beside it when there are any;
// and always a small "Zoek…" button that opens the IngredientPicker (search or create new) and puts
// its pick in the row. The outlined maybe-chip is a proposal, not yet chosen (aria-checked false), but
// it IS what gets placed when the row is left alone. Taps (Fable, V6 lens): the first tap on the
// proposal confirms it (filled); a tap on a confirmed chosen chip (or a sure one) → "Als tekst"; a
// tap on an alternative chooses and confirms that one. A note ("check", "for breakfast") stands in
// italics under the row.
//
// "Zet {n} regels op de lijst" (the button at the bottom, outside the scrolling body so it stays in
// view): every row goes through `onAdd` as ExtraField does it for a recognised ingredient (`ing`,
// `qty`, `unit`; the note in `note`, shown in brackets behind the name) or as a text line (`label` = the raw
// line, aisle Overig). The raw line is never lost (CLAUDE.md invariant 2): a line that is not linked
// goes on as its own words. Learning: a row placed with another ingredient than the first suggestion
// (an alternative, or via Zoek…) is remembered as `normalizeKey(name) → id` in the setting
// `shop.learned` (repo.learnShopWord), which `suggestShopLines` consults first next time.
//
// 13J: rendered through <SheetPortal>, Sluit right in the head; Escape and tapping beside the sheet
// close it without placing anything.
import { useEffect, useRef, useState } from 'preact/hooks';
import { IngredientPicker } from '@/components/IngredientPicker';
import { SheetPortal } from '@/components/SheetPortal';
import { getLearnedShopWords, learnShopWord } from '@/db/repo';
import { dictionary, type Dictionary } from '@/dictionary';
import type { ListItem } from '@/domain/aggregate';
import { normalizeKey } from '@/domain/dictionary';
import type { Lang } from '@/domain/model';
import { suggestShopLines, type ShopSuggestion } from '@/domain/shopinput';
import { lang, t } from '@/i18n';

export interface ShopPasteSheetProps {
  /** The pasted / typed text; null = closed. */
  text: string | null;
  /** Places one item (the caller persists it, as for ExtraField). */
  onAdd: (item: Partial<ListItem>) => void | Promise<void>;
  /** After placing: the sheet is done (the caller clears its field). */
  onDone: () => void;
  /** Sluit / Escape / tap beside: nothing is placed. */
  onClose: () => void;
}

/**
 * One row of the sheet: the suggestion plus the current choice (null = Als tekst). On a maybe row the
 * choice starts as the proposal (so placing uses it) with `confirmed` false.
 */
interface Row {
  s: ShopSuggestion;
  choice: string | null;
  /** Picked via Zoek… and not among the suggestion's own chips: shown as an extra chip. */
  extra: string | null;
  /** False only for an untouched maybe proposal: drawn outlined, aria-checked false; the first tap confirms it. */
  confirmed: boolean;
}

/** The ingredient's name in the app language (the other language, then the id, as fallback). */
function ingName(id: string, dict: Dictionary, l: Lang): string {
  const ing = dict.get(id);
  if (!ing) return id;
  const other: Lang = l === 'nl' ? 'en' : 'nl';
  return ing[l]?.one || ing[other]?.one || id;
}

/** The chips of a row, in order: the match, the alternatives, a Zoek… pick (each id once). */
function rowOptions(r: Row): string[] {
  const out: string[] = [];
  const push = (id: string | null) => {
    if (id && !out.includes(id)) out.push(id);
  };
  push(r.s.match);
  for (const id of r.s.alternatives) push(id);
  push(r.extra);
  return out;
}

/** The ListItem a row becomes (§1b "Knop onderaan"). */
export function pasteRowItem(s: ShopSuggestion, choice: string | null, dict: Dictionary, l: Lang): Partial<ListItem> {
  const ing = choice ? dict.get(choice) : undefined;
  if (ing) {
    const item: Partial<ListItem> = { ing: ing.id, aisle: ing.aisle ?? 'overig', qty: s.qty ?? null, unit: s.qty !== null ? s.unit : null };
    // The note goes in `note` (renderListItem / itemName show it in brackets behind the name);
    // `label` is never shown for a dictionary item.
    if (s.note) item.note = s.note;
    return item;
  }
  return { ing: null, aisle: 'overig', qty: null, unit: null, label: { nl: l === 'nl' ? s.raw : '', en: l === 'en' ? s.raw : '' } };
}

export function ShopPasteSheet(props: ShopPasteSheetProps) {
  if (props.text === null) return null;
  return <ShopPasteBody {...props} text={props.text} />;
}

function ShopPasteBody(props: ShopPasteSheetProps & { text: string }) {
  const dict = dictionary.value;
  const l = lang.value;
  const [learned, setLearned] = useState<Record<string, string> | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [searchFor, setSearchFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    void getLearnedShopWords().then((w) => {
      if (alive) setLearned(w);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The suggestions once the learned words are in, computed ONCE per paste (the sheet mounts per
  // paste). Not on later dictionary changes: "Nieuw ingrediënt" via Zoek… reloads the dictionary
  // (a new `dictionary.value`), and recomputing then would wipe every choice made in the sheet,
  // including the row that just got the new ingredient.
  useEffect(() => {
    if (!learned) return;
    setRows((cur) => cur ?? suggestShopLines(props.text, dictionary.value, lang.value, learned).map((s) => ({ s, choice: s.status === 'unknown' ? null : s.match, extra: null, confirmed: s.status !== 'maybe' })));
  }, [learned]);

  // Focus on Sluit on open, back to the opener on close (aria-modal moves no focus by itself).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function choose(idx: number, id: string | null) {
    setRows((cur) =>
      cur
        ? cur.map((r, i) => {
            if (i !== idx) return r;
            // The outlined proposal: the first tap confirms it.
            if (id !== null && r.choice === id && !r.confirmed) return { ...r, confirmed: true };
            // A tap on the confirmed chosen chip: Als tekst. Any other chip: chosen and confirmed.
            const next = id !== null && r.choice === id ? null : id;
            return { ...r, choice: next, confirmed: true };
          })
        : cur,
    );
  }

  function picked(idx: number, id: string) {
    setRows((cur) =>
      cur
        ? cur.map((r, i) => {
            if (i !== idx) return r;
            const own = r.s.match === id || r.s.alternatives.includes(id);
            return { ...r, choice: id, extra: own ? r.extra : id, confirmed: true };
          })
        : cur,
    );
  }

  async function place() {
    if (!rows || busy) return;
    setBusy(true);
    try {
      for (const r of rows) {
        const d = dictionary.value;
        // Learning (§1b): another ingredient than the first suggestion → remember it for this name.
        if (r.choice !== null && r.choice !== r.s.match && r.s.name.trim()) {
          await learnShopWord(normalizeKey(r.s.name), r.choice);
        }
        await props.onAdd(pasteRowItem(r.s, r.choice, d, l));
      }
      props.onDone();
    } finally {
      setBusy(false);
    }
  }

  const n = rows?.length ?? 0;
  const title = t('shop.paste.title');
  const searchRow = searchFor !== null && rows ? rows[searchFor] : undefined;

  return (
    <>
      <SheetPortal onEscape={searchFor === null && !busy ? props.onClose : undefined}>
        <div class="sheet-backdrop" onClick={() => !busy && props.onClose()}>
          <div class="sheet spaste" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
            <div class="sheet-head with-actions">
              <span class="sheet-head-btn" aria-hidden="true" />
              <h2>{title}</h2>
              <button ref={closeBtn} type="button" class="sheet-head-btn save" disabled={busy} onClick={props.onClose}>
                {t('common.close')}
              </button>
            </div>
            <div class="sheet-body">
              {rows && (
                <ul class="spaste-list">
                  {rows.map((r, idx) => {
                    const options = rowOptions(r);
                    const showText = r.choice === null || r.s.status === 'unknown';
                    return (
                      <li key={idx} class="spaste-row">
                        <div class="spaste-line">
                          <span class="spaste-raw muted">{r.s.raw}</span>
                          <div class="spaste-chips" role="radiogroup" aria-label={r.s.raw}>
                            {options.map((id) => {
                              const on = r.choice === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  role="radio"
                                  aria-checked={on && r.confirmed}
                                  class={'spaste-chip' + (on ? (r.confirmed ? ' on' : ' maybe') : '')}
                                  disabled={busy}
                                  onClick={() => choose(idx, id)}
                                >
                                  {ingName(id, dict, l)}
                                </button>
                              );
                            })}
                            {showText && (
                              <button
                                type="button"
                                role="radio"
                                aria-checked={r.choice === null}
                                class={'spaste-chip text' + (r.choice === null ? ' on' : '')}
                                disabled={busy}
                                onClick={() => choose(idx, null)}
                              >
                                {t('shop.paste.asText')}
                              </button>
                            )}
                            <button type="button" class="spaste-search" disabled={busy} onClick={() => setSearchFor(idx)}>
                              {t('shop.paste.search')}
                            </button>
                          </div>
                        </div>
                        {r.s.note && <p class="spaste-note">{t('shop.paste.note', { note: r.s.note })}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div class="spaste-foot">
              <button type="button" class="btn btn-primary btn-block" disabled={busy || n === 0} onClick={() => void place()}>
                {n === 1 ? t('shop.paste.addOne') : t('shop.paste.add', { n })}
              </button>
            </div>
          </div>
        </div>
      </SheetPortal>
      <IngredientPicker
        open={searchRow !== undefined}
        initialQuery={searchRow?.s.name ?? ''}
        onPick={(id) => {
          const idx = searchFor;
          setSearchFor(null);
          if (idx !== null) picked(idx, id);
        }}
        onClose={() => setSearchFor(null)}
      />
    </>
  );
}
