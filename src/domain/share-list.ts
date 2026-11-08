// The shopping list as a `#l=` envelope (docs/specs/qr-link.md §2, 13Q), split off share.ts in 13c
// (docs/specs/opschoonronde.md §2B.3): only the full app BUILDS a list envelope, and the builder needs
// the aggregation module (effectiveQty, groupByAisle, renderListItem). share.ts keeps the reading side
// (`ListShareLine`, `LIST_MAX_LINES`, `readListPayload`) that the Safari landing needs, so the landing's
// chunk no longer carries aggregate.ts. Framework-free: no preact, no dexie.
import { effectiveQty, groupByAisle, renderListItem, type ListItem } from './aggregate.ts';
import type { Dictionary } from './dictionary.ts';
import type { Text } from './model.ts';
import { baseEnvelope, cleanString, LIST_MAX_LINES, type ListShare, type ListShareLine } from './share.ts';
import type { Envelope } from './token.ts';

/**
 * Character budget of the list LINK message (13c §2B.1): the link is one `{ text }` (invariant 9) and
 * a WhatsApp message may be far longer than the 3,500 characters of `DEFAULT_MESSAGE_LIMIT`, so a long
 * list keeps its link. The plain-text share ("Deel als tekst") keeps `DEFAULT_MESSAGE_LIMIT` and falls
 * back to the file as before; the QR stays bound to `QR_MAX_URL_CHARS`.
 */
export const LIST_LINK_MESSAGE_LIMIT = 20000;

export interface ListEnvelopeOptions {
  /** The list title in both languages ("Boodschappen week 46" / "Shopping week 46"). */
  title: Text;
  /** Leave checked lines out (the "verberg afgevinkt" switch of the text share). */
  hideChecked?: boolean;
  /** Leave "in huis" lines out. */
  hideInHouse?: boolean;
}

/**
 * `{v: 2, t: 'l', by, at, l: {title, lines}}` (docs/specs/qr-link.md §2): the list as the text
 * share (`listAsText`) shows it: the same visible lines (checked ones out with `hideChecked`,
 * in-house ones out with `hideInHouse`, numeric lines at 0 always out), the aisle groups in data
 * order and the "Controleer zelf" lines last. Each line carries its text per language
 * (`renderListItem`) and, when known, the ingredient id, the effective amount, the unit and the
 * aisle, plus the qualifier ids as `variant` (13c §2B.2). Within a group the lines follow the
 * Dutch names (the receiver regroups by aisle anyway).
 * At most LIST_MAX_LINES lines.
 */
export function buildListEnvelope(items: readonly ListItem[], dict: Dictionary, by: string, opts: ListEnvelopeOptions): Envelope {
  const visible = (it: ListItem): boolean => {
    if (it.checked && opts.hideChecked) return false;
    if (it.inHouse && opts.hideInHouse) return false;
    if (typeof it.qty === 'number') {
      const eff = effectiveQty(it);
      return eff !== null && eff > 0;
    }
    return true;
  };
  const listed = items.filter((it) => it.section !== 'check' && visible(it));
  const ordered: ListItem[] = [];
  for (const g of groupByAisle(listed, dict, 'nl')) ordered.push(...g.items);
  ordered.push(...items.filter((it) => it.section === 'check' && visible(it)));
  const lines: ListShareLine[] = [];
  for (const it of ordered) {
    if (lines.length >= LIST_MAX_LINES) break;
    const raw: Text = {};
    const nl = renderListItem(it, dict, 'nl').trim();
    const en = renderListItem(it, dict, 'en').trim();
    if (nl) raw.nl = nl;
    if (en) raw.en = en;
    if (!raw.nl && !raw.en) continue;
    const line: ListShareLine = { raw };
    if (typeof it.ing === 'string' && it.ing && dict.get(it.ing)) line.ing = it.ing;
    // 13c §2B.2: the qualifier ("rode" in "rode ui") travels, so the receiver adds "rode ui", not "ui".
    const variant = cleanString(it.variant);
    if (variant) line.variant = variant;
    const qty = effectiveQty(it);
    if (qty !== null && Number.isFinite(qty) && qty > 0) {
      line.qty = qty;
      if (typeof it.unit === 'string' && it.unit) line.unit = it.unit;
    }
    if (typeof it.aisle === 'string' && it.aisle) line.aisle = it.aisle;
    lines.push(line);
  }
  const title: Text = {};
  const tnl = cleanString(opts.title.nl);
  const ten = cleanString(opts.title.en);
  if (tnl) title.nl = tnl;
  if (ten) title.en = ten;
  const l: ListShare = { title, lines };
  const env = baseEnvelope('l', by);
  env.l = l;
  return env;
}

