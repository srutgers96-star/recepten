// The "+ wc-papier, melk …" field of the shopping list (docs/phase-4-spec.md §3): autocomplete
// over the dictionary (`dictionary.value.search`, both languages) and over the extras of the
// previous list, a leading amount as the quantity ("3 melk", "200 gram boter", "2 pakken melk":
// src/domain/shopinput.ts), commas for several plain-text items at once; an unknown name can go on
// as plain text or become a user ingredient through the IngredientPicker ("Nieuw ingrediënt").
// The caller persists the item (repo.addExtra).
import { useMemo, useRef, useState } from 'preact/hooks';
import { IngredientPicker } from '@/components/IngredientPicker';
import { dictionary, type Dictionary } from '@/dictionary';
import type { ListItem } from '@/domain/aggregate';
import { pickText, type Lang } from '@/domain/model';
import { isShopList, parseShopInput, splitShopList } from '@/domain/shopinput';
import { lang, t } from '@/i18n';

const MAX_DICT = 6;
const MAX_PREV = 3;

export interface ExtraFieldProps {
  /** Extras of the current / previous list: their labels are offered again. */
  previous: readonly ListItem[];
  onAdd: (item: Partial<ListItem>) => void | Promise<void>;
}

/** "200 g " / "3 " in front of a suggestion; '' without an amount. */
function amountPrefix(qty: number | null, unit: string | null, dict: Dictionary, l: Lang): string {
  if (qty === null) return '';
  const n = l === 'nl' ? String(qty).replace('.', ',') : String(qty);
  const u = unit ? dict.unit(unit) : undefined;
  const label = u ? (qty > 1 && u[l].many ? u[l].many : u[l].one) : '';
  return label ? `${n} ${label} ` : `${n} `;
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
  const { qty, unit, name } = parseShopInput(text, dict, l);
  const q = name.trim();
  const prefix = amountPrefix(qty, unit, dict, l);

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
    const item: Partial<ListItem> = { ing: id, aisle: ing?.aisle ?? 'overig', qty: qty ?? null, unit: qty !== null ? unit : null };
    void submit(item);
  }

  /** Plain text, one item per comma ("wc-papier, melk"; "1,5 l melk" is one); each keeps its own amount. */
  async function addText(raw: string) {
    const parts = splitShopList(raw);
    if (!parts.length) return;
    if (busy) return;
    setBusy(true);
    try {
      for (const part of parts) {
        const p = parseShopInput(part, dict, l);
        if (!p.name) continue;
        const hit = dict.ingredientByName(p.name, l);
        // Not in the dictionary as typed, but without its first word it is ("doos eieren", "rode
        // uien"): keep the words as typed, file it under that product's aisle instead of Overig.
        const near = hit ? undefined : dict.ingredientByName(p.name.replace(/^\S+\s+/u, ''), l);
        const item: Partial<ListItem> = hit
          ? { ing: hit.id, aisle: hit.aisle, qty: p.qty, unit: p.unit }
          : { ing: null, aisle: near?.aisle ?? 'overig', qty: p.qty, unit: p.unit, label: { nl: l === 'nl' ? p.name : '', en: l === 'en' ? p.name : '' } };
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
    if (isShopList(text)) {
      void addText(text);
      return;
    }
    if (exact) addIngredient(exact.id);
    else if (dictHits.length === 1 && dictHits[0]) addIngredient(dictHits[0].id);
    else void addText(text);
  }

  const showList = q.length > 0 && !isShopList(text);
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
                    {prefix}
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
                <button type="button" class="xf-item" onClick={() => void submit({ ing: null, aisle: it.aisle, qty: qty ?? null, unit: qty !== null ? unit : null, label: { ...it.label } })}>
                  <span class="name">
                    {prefix}
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
