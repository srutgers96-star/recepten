// One standing line ("Vaste lijst" / "Every week") in the proto block of the week list
// (docs/specs/vaste-lijst.md §1d, §3; block 3). It is the ordinary ProtoRow (−/+ changes
// `adjusted`, so this list only) with a button row under it: "Heb ik al" (this list only, until
// Klaar) and, only when the amount was changed here, "Ook voortaan" (makes the changed amount the
// new usual amount). ProtoRow renders its own `<li class="pr">`, so this returns a fragment with a
// second `<li class="spr-actions">`; the caller puts both inside the same `<ul class="list">`.
// ProtoRow itself is unchanged. The caller persists: onAdjust → setListItem, onHave → in-house for
// this list, onKeep → adoptStandingAdjustment + snack.
import type { Dictionary } from '@/domain/dictionary';
import type { ListItem } from '@/domain/aggregate';
import type { Lang } from '@/domain/model';
import { ProtoRow } from '@/components/ProtoRow';
import { t } from '@/i18n';

export interface StandingProtoRowProps {
  item: ListItem;
  dict: Dictionary;
  lang: Lang;
  /** `undefined` clears the delta (back to the usual amount). */
  onAdjust: (item: ListItem, adjusted: number | undefined) => void;
  /** "Heb ik al": this list only, not remembered. */
  onHave: (item: ListItem) => void;
  /** "Ook voortaan": the adjusted amount becomes the new usual amount. */
  onKeep: (item: ListItem) => void;
}

/** True when "Ook voortaan" has something to adopt (§3: a non-zero `adjusted`). */
export function canKeepStanding(item: ListItem): boolean {
  return typeof item.adjusted === 'number' && item.adjusted !== 0;
}

export function StandingProtoRow(props: StandingProtoRowProps) {
  const { item, dict, lang } = props;
  return (
    <>
      <ProtoRow item={item} dict={dict} lang={lang} onAdjust={props.onAdjust} />
      <li class="spr-actions">
        <button type="button" class="btn btn-small" onClick={() => props.onHave(item)}>
          {t('shop.menu.inHouse')}
        </button>
        {canKeepStanding(item) && (
          <button type="button" class="btn btn-small btn-secondary" onClick={() => props.onKeep(item)}>
            {t('shop.standing.keep')}
          </button>
        )}
      </li>
    </>
  );
}
