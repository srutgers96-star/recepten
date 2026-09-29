// The "+ wc-papier, melk …" field of the shopping list (docs/phase-4-spec.md §3): autocomplete
// over the dictionary (`dictionary.value.search`, both languages) and over the extras of the
// previous list, a leading number as the quantity ("3 melk"), commas for several plain-text items
// at once; an unknown name can go on as plain text or become a user ingredient through the
// IngredientPicker ("Nieuw ingrediënt"). The caller persists the item (repo.addExtra).
import { useMemo, useRef, useState } from 'preact/hooks';
import { IngredientPicker } from '@/components/IngredientPicker';
import { dictionary } from '@/dictionary';
import type { ListItem } from '@/domain/aggregate';
import { pickText } from '@/domain/model';
import { lang, t } from '@/i18n';

const MAX_DICT = 6;
const MAX_PREV = 3;

export interface ExtraFieldProps {
  /** Extras of the current / previous list: their labels are offered again. */
  previous: readonly ListItem[];
  onAdd: (item: Partial<ListItem>) => void | Promise<void>;
}

/** "3 melk" -> { qty: 3, name: 'melk' }; "melk" -> { qty: null, name: 'melk' }. */
export function splitLeadingQty(text: string): { qty: number | null; name: string } {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*[x×]?\s+(.+)$/u.exec(text);
  if (!m) return { qty: null, name: text.trim() };
  const qty = Number(m[1]!.replace(',', '.'));
  return Number.isFinite(qty) && qty > 0 ? { qty, name: m[2]!.trim() } : { qty: null, name: text.trim() };
}

function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function ExtraField(props: ExtraFieldProps) {
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dict = dictionary.value;
  const l = lang.value;
  const { qty, name } = splitLeadingQty(text);
  const q = name.trim();

  const dictHits = useMemo(() => (q ? dict.search(q, l).slice(0, MAX_DICT) : []), [q, dict, l]);
  const prevHits = useMemo(() => {
    if (!q) return [];
    const key = normalize(q);
    const seen = new Set<string>();
    const out: ListItem[] = [];
    for (const it of props.previous) {
      if (!it.manual || it.ing) continue;
      const label = pickText(it.label, l) || pickText(it.label, l === 'nl' ? 'en' : 'nl');
      if (!label || seen.has(label)) continue;
      if (!normalize(label).includes(key)) continue;
      seen.add(label);
      out.push(it);
      if (out.length >= MAX_PREV) break;
    }
    return out;
  }, [q, props.previous, l]);

  const exact = dictHits.find((ing) => normalize(ing[l].one) === normalize(q) || normalize(ing[l === 'nl' ? 'en' : 'nl'].one) === normalize(q));

  async function submit(item: Partial<ListItem>) {
    if (busy) return;
    setBusy(true);
    try {
      await props.onAdd(item);
      setText('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function addIngredient(id: string) {
    const ing = dict.get(id);
    const item: Partial<ListItem> = { ing: id, aisle: ing?.aisle ?? 'overig', qty: qty ?? null, unit: null };
    void submit(item);
  }

  /** Plain text, one item per comma ("wc-papier, melk"); each keeps its own leading number. */
  async function addText(raw: string) {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    if (busy) return;
    setBusy(true);
    try {
      for (const part of parts) {
        const p = splitLeadingQty(part);
        if (!p.name) continue;
        const hit = dict.ingredientByName(p.name, l);
        const item: Partial<ListItem> = hit
          ? { ing: hit.id, aisle: hit.aisle, qty: p.qty, unit: null }
          : { ing: null, aisle: 'overig', qty: p.qty, unit: null, label: { nl: l === 'nl' ? p.name : '', en: l === 'en' ? p.name : '' } };
        await props.onAdd(item);
      }
      setText('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function onEnter() {
    if (!q) return;
    if (text.includes(',')) {
      void addText(text);
      return;
    }
    if (exact) addIngredient(exact.id);
    else if (dictHits.length === 1 && dictHits[0]) addIngredient(dictHits[0].id);
    else void addText(text);
  }

  const showList = q.length > 0 && !text.includes(',');
  const other = l === 'nl' ? 'en' : 'nl';

  return (
    <div class="xf">
      <form
        class="xf-row"
        onSubmit={(e) => {
          e.preventDefault();
          onEnter();
        }}
      >
        <input
          ref={input}
          class="input"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          enterKeyHint="done"
          aria-label={t('shop.addLabel')}
          placeholder={t('shop.addPlaceholder')}
          value={text}
          disabled={busy}
          onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
        />
        <button type="submit" class="btn btn-primary" disabled={!q || busy} aria-label={t('shop.add')}>
          +
        </button>
      </form>
      {showList && (
        <ul class="xf-list">
          {dictHits.map((ing) => {
            const own = ing[l].one || ing[other].one;
            const alt = ing[other].one;
            const aisle = dict.aisle(ing.aisle)?.[l] ?? '';
            return (
              <li key={ing.id}>
                <button type="button" class="xf-item" onClick={() => addIngredient(ing.id)}>
                  <span class="name">
                    {qty !== null ? `${qty} ` : ''}
                    {own}
                    {alt && alt !== own ? <span class="muted"> · {alt}</span> : null}
                  </span>
                  <span class="sub">{aisle}</span>
                </button>
              </li>
            );
          })}
          {prevHits.map((it) => {
            const label = pickText(it.label, l) || pickText(it.label, other);
            return (
              <li key={it.key}>
                <button type="button" class="xf-item" onClick={() => void submit({ ing: null, aisle: it.aisle, qty: qty ?? null, unit: null, label: { ...it.label } })}>
                  <span class="name">
                    {qty !== null ? `${qty} ` : ''}
                    {label}
                  </span>
                  <span class="sub">{t('shop.recent')}</span>
                </button>
              </li>
            );
          })}
          {!exact && (
            <li>
              <button type="button" class="xf-item action" onClick={() => void addText(text)}>
                <span class="name">{t('shop.addAsText', { q })}</span>
              </button>
            </li>
          )}
          {!exact && (
            <li>
              <button type="button" class="xf-item action" onClick={() => setPicker(true)}>
                <span class="name">{t('shop.addNew', { q })}</span>
              </button>
            </li>
          )}
        </ul>
      )}
      <IngredientPicker
        open={picker}
        initialQuery={q}
        startNew
        onPick={(id) => {
          setPicker(false);
          addIngredient(id);
        }}
        onClose={() => setPicker(false)}
      />
    </div>
  );
}
