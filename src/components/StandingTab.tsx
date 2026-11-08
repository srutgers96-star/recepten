// The "Vaste lijst" / "Every week" tab of the shopping screen (docs/specs/vaste-lijst.md §1b, §3,
// block 6C-2): a grey intro, the ExtraField with its own placeholder (dictionary autocomplete, commas
// = several), the standing items grouped per aisle in data order (paused ones grey with "(staat uit)",
// last within their aisle), a tap hint, and the empty state. A tap on a line opens the StandingSheet,
// where every tap saves at once. ShoppingScreen owns the snack and passes it in as `onSnack`.
import { useState } from 'preact/hooks';
import { ExtraField } from '@/components/ExtraField';
import { StandingSheet } from '@/components/StandingSheet';
import {
  addStandingItem,
  getStandingList,
  removeStandingItem,
  restoreStandingItem,
  updateStandingItem,
  type NewStandingItem,
  type StandingPatch,
} from '@/db/repo';
import { useLive } from '@/db/live';
import { dictionary, type Dictionary } from '@/dictionary';
import { itemName, type ListItem } from '@/domain/aggregate';
import type { Lang } from '@/domain/model';
import { defaultStandingUnit, renderStandingItem, sortStandingItems, standingToListItem, type StandingItem } from '@/domain/standing';
import { recordFeature } from '@/features';
import { lang, t } from '@/i18n';

export interface StandingTabProps {
  /** ShoppingScreen's `showSnack(text, undo?)`. */
  onSnack: (text: string, undo?: () => void | Promise<void>) => void;
}

/** No previous extras are offered on the standing tab (§1b: `previous={[]}`). */
const NO_PREVIOUS: readonly ListItem[] = [];

/**
 * The ExtraField item as a new standing item (§3 StandingTab.onAdd): free text keeps its label; no typed
 * unit → the dictionary item's standing default unit (a typed unit stays, also one outside
 * STANDING_UNITS, decision C); no number → 1 for a dictionary item, none for free text (decision B).
 */
export function toNewStandingItem(item: Partial<ListItem>, dict: Dictionary): NewStandingItem {
  const ing = item.ing ?? null;
  const out: NewStandingItem = {
    ing,
    aisle: item.aisle || 'overig',
    unit: item.unit ?? (ing ? defaultStandingUnit(dict.get(ing), dict) : null),
    qty: item.qty ?? (ing ? 1 : null),
  };
  if (!ing && item.label) out.label = { ...item.label };
  return out;
}

/** Name of a standing item for snacks ("melk", "postzegels"). */
function standingName(s: StandingItem, dict: Dictionary, l: Lang): string {
  return itemName(standingToListItem(s), dict, l);
}

/** Consecutive runs of the same aisle in the already sorted items. */
function byAisle(items: readonly StandingItem[]): { aisle: string; items: StandingItem[] }[] {
  const out: { aisle: string; items: StandingItem[] }[] = [];
  for (const s of items) {
    const aisle = s.aisle || 'overig';
    const last = out[out.length - 1];
    if (last && last.aisle === aisle) last.items.push(s);
    else out.push({ aisle, items: [s] });
  }
  return out;
}

export function StandingTab(props: StandingTabProps) {
  const standing = useLive(getStandingList, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const dict = dictionary.value;
  const l = lang.value;
  const { onSnack } = props;

  const items = standing ? sortStandingItems(standing.items, dict, l) : [];
  const open = openId ? (standing?.items.find((s) => s.id === openId) ?? null) : null;

  async function add(item: Partial<ListItem>) {
    try {
      const before = await getStandingList();
      const added = await addStandingItem(toNewStandingItem(item, dict));
      const name = standingName(added, dict, l);
      if (before.items.some((s) => s.id === added.id)) {
        // Already on the standing list (findSameStanding): nothing changed, so nothing to undo.
        onSnack(t('shop.standing.addedSnack', { name }));
        return;
      }
      onSnack(t('shop.standing.addedSnack', { name }), () => removeStandingItem(added.id).then(() => undefined));
      void recordFeature('standingList');
    } catch (e) {
      onSnack(`${t('common.error')}: ${String((e as Error)?.message ?? e)}`);
    }
  }

  function patch(id: string, p: StandingPatch) {
    void updateStandingItem(id, p).catch((e: unknown) => onSnack(`${t('common.error')}: ${String((e as Error)?.message ?? e)}`));
  }

  async function remove(item: StandingItem) {
    setOpenId(null);
    try {
      const removed = await removeStandingItem(item.id);
      if (!removed) return;
      onSnack(t('shop.standing.removedSnack', { name: standingName(removed, dict, l) }), () => restoreStandingItem(removed));
    } catch (e) {
      onSnack(`${t('common.error')}: ${String((e as Error)?.message ?? e)}`);
    }
  }

  return (
    <div class="standing-tab">
      <p class="muted small standing-intro">{t('shop.standing.intro')}</p>
      <ExtraField previous={NO_PREVIOUS} placeholder={t('shop.standing.addPlaceholder')} onAdd={add} />
      {standing && items.length === 0 && <div class="empty standing-empty">{t('shop.standing.empty')}</div>}
      {byAisle(items).map((g) => {
        const aisle = dict.aisle(g.aisle);
        return (
          <section class="shop-aisle standing-aisle" data-aisle={g.aisle} key={g.aisle}>
            <div class="shop-aisle-head" role="heading" aria-level={3}>
              <i class="rule" aria-hidden="true" />
              <span class="name">{aisle ? aisle[l] : g.aisle}</span>
              <span class="count">{g.items.length}</span>
              <i class="rule" aria-hidden="true" />
            </div>
            <ul class="list">
              {g.items.map((s) => (
                <li key={s.id} class={'standing-row' + (s.enabled ? '' : ' paused')}>
                  <button type="button" class="standing-row-btn" onClick={() => setOpenId(s.id)}>
                    <span class="standing-text">{renderStandingItem(s, dict, l)}</span>
                    {!s.enabled && <span class="standing-paused"> {t('shop.standing.paused')}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {items.length > 0 && <p class="muted small standing-hint">{t('shop.standing.tapHint')}</p>}
      <StandingSheet item={open} dict={dict} lang={l} onPatch={patch} onRemove={(item) => void remove(item)} onClose={() => setOpenId(null)} />
    </div>
  );
}
