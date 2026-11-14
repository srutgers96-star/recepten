// One line of the proto list (docs/phase-4-spec.md §3, state 2): `[✕] qty unit name [−][+]` — V1c-8
// (Stijn, 15 Nov 2026: "meestal moet je hele ingrediënten verwijderen en dan moet je 20 keer klikken"):
// ✕ on the left sets the line to "niet nodig" in one tap (↺ puts the computed amount back), the small
// − and + on the right step by the rule of `adjustStep` (pieces 1; g 10/25/50; ml 10/50/100; spoons ½); the sources on tap
// ("Waarvoor is dit?": "3 uien — 2× Pasta met spek"). A staple sits at 0 and toggles to 1 on tap
// ("even meenemen"); a "pm" line (no number) and an unresolved "Controleer zelf" line have no
// stepper. Also used inside the long-press sheet ("Aantal aanpassen"). The user's delta lives in
// `item.adjusted` (display units); the caller persists it via repo.setListItem.
import { useState } from 'preact/hooks';
import type { Dictionary } from '@/domain/dictionary';
import { adjustStep, effectiveQty, itemName, renderListItem, type ListItem } from '@/domain/aggregate';
import { pickText, type Lang } from '@/domain/model';
import { t } from '@/i18n';

export interface ProtoRowProps {
  item: ListItem;
  dict: Dictionary;
  lang: Lang;
  /** `undefined` clears the delta (back to the computed amount). */
  onAdjust: (item: ListItem, adjusted: number | undefined) => void;
  /** Show the sources under the line from the start (the sheet does). */
  sourcesOpen?: boolean;
  /** Tap on the text: default toggles the sources (main) or the "take one" state (staple). */
  onTap?: (item: ListItem) => void;
}

function clean(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** The "3 uien — 2× Pasta met spek" lines: one per dish, the scaled text of each source. */
export function sourceLines(item: ListItem, lang: Lang): Array<{ key: string; dish: string; what: string }> {
  return item.sources.map((s, i) => ({ key: `${s.recipeId}|${i}`, dish: pickText(s.name, lang) || s.recipeId, what: s.scaled || s.raw }));
}

export function ProtoRow(props: ProtoRowProps) {
  const { item, dict, lang } = props;
  const [open, setOpen] = useState(props.sourcesOpen === true);
  const staple = item.section === 'staples';
  const numeric = typeof item.qty === 'number';
  const eff = effectiveQty(item);
  const current = eff ?? 0;
  const unit = item.unit ?? null;
  const step = adjustStep(unit, current);
  const canStep = numeric && item.section !== 'check';

  function set(next: number) {
    const target = Math.max(0, clean(next));
    const base = typeof item.qty === 'number' ? item.qty : 0;
    const delta = clean(target - base);
    props.onAdjust(item, delta === 0 ? undefined : delta);
  }

  function tap() {
    if (props.onTap) {
      props.onTap(item);
      return;
    }
    if (staple) set(current > 0 ? 0 : 1);
    else setOpen((v) => !v);
  }

  const zero = numeric && eff === 0 && !staple;
  const text = zero ? `${itemName(item, dict, lang)} (${t('shop.zero')})` : renderListItem(item, dict, lang);
  const sources = sourceLines(item, lang);

  return (
    <li class={'pr' + (zero ? ' zero' : '') + (staple ? ' staple' : '') + (staple && current > 0 ? ' on' : '')}>
      <div class="pr-row">
        {canStep &&
          (zero ? (
            <button type="button" class="pr-step pr-x" aria-label={t('shop.restore')} title={t('shop.restore')} onClick={() => props.onAdjust(item, undefined)}>
              ↺
            </button>
          ) : (
            <button type="button" class="pr-step pr-x" aria-label={t('shop.notNeeded')} title={t('shop.notNeeded')} disabled={current <= 0} onClick={() => set(0)}>
              ✕
            </button>
          ))}
        <button type="button" class="pr-text" aria-expanded={open} onClick={tap}>
          {text}
          {item.fresh && !staple && (
            <>
              {' '}
              <span class="badge badge-green">{t('shop.new')}</span>
            </>
          )}
        </button>
        {canStep && (
          <>
            <button type="button" class="pr-step pr-small" aria-label={t('shop.less')} disabled={current <= 0} onClick={() => set(current - step)}>
              −
            </button>
            <button type="button" class="pr-step pr-small" aria-label={t('shop.more')} onClick={() => set(current + step)}>
              +
            </button>
          </>
        )}
      </div>
      {open && (
        <ul class="pr-sources">
          {sources.length === 0 && <li>{t('shop.noSources')}</li>}
          {sources.map((s) => (
            <li key={s.key}>
              <strong>{s.what}</strong> — {s.dish}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
