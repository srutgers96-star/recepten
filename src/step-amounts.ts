// "Toon hoeveelheden" (docs/phase-6-spec.md 13I): the ingredients a step names are green, and a tap
// on one shows its scaled amount behind it ("karwijzaad (1 tl)"). The button under the step text in
// cook mode shows all of them at once; that choice is remembered on this device through the
// settings table (`cook.showAmounts`, off by default) and mirrored here, the same way src/speech.ts
// mirrors speech.readAloud. The detail page follows the same setting (it has no button of its own).
import { signal } from '@preact/signals';
import { getSetting, setSetting } from '@/db/repo';
import { recordFeature } from '@/features';

export const SHOW_AMOUNTS_SETTING = 'cook.showAmounts';

/** Mirror of the `cook.showAmounts` setting (default false): every green word shows its amount. */
export const showAmounts = signal(false);

let loaded: Promise<void> | null = null;

/** Reads the `cook.showAmounts` setting once (idempotent). */
export function loadShowAmounts(): Promise<void> {
  if (!loaded) {
    loaded = getSetting<boolean>(SHOW_AMOUNTS_SETTING, false)
      .then((on) => {
        showAmounts.value = on === true;
      })
      .catch(() => undefined);
  }
  return loaded;
}

/** Re-reads the setting from the database (after a restore replaced it). */
export function reloadShowAmounts(): Promise<void> {
  loaded = null;
  return loadShowAmounts();
}

export async function setShowAmounts(on: boolean): Promise<void> {
  // Wait for a load that may still be running, or its late .then would undo this toggle.
  await loadShowAmounts();
  showAmounts.value = on;
  await setSetting(SHOW_AMOUNTS_SETTING, on);
  if (on) void recordFeature('amounts');
}
