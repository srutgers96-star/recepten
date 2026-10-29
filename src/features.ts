// Feature events, app layer (docs/specs/badges-avatar.md §2c, block 6D-2a). The pure counting lives
// in src/domain/features.ts; this module only reads the setting `features.log`, bumps it for the
// active profile ('anon' without one) and writes it back, then lets the badges look again.
//
// Callers fire and forget, AFTER the action succeeded (the moments are listed in §2c):
//   void recordFeature('timer');
// Never awaited in a tap handler, never throws. Badges off = no trace at all: nothing is written
// (§7.6, README §4.11 "badges uit = geen spoor"). Calls are serialized like `checking` in
// src/badges.ts, so two quick taps can never both read the same old log and lose one bump.
import { badgesEnabled, checkNewBadges, FEATURES_LOG_SETTING, loadBadgeSettings } from '@/badges';
import { getSetting, setSetting } from '@/db/repo';
import { bumpFeature, normalizeFeatureLog, type FeatureId } from '@/domain/features';
import { nowIso } from '@/domain/model';
import { activeProfile } from '@/profile';

/** Member id for a feature event without an active profile (§2c). */
const ANON = 'anon';

let recording: Promise<void> = Promise.resolve();

/**
 * Records one feature event for the active profile and checks for new badges. Serialized; a
 * failure is logged, never thrown (callers do `void recordFeature(id)`). No-op with badges off.
 */
export function recordFeature(id: FeatureId): Promise<void> {
  const run = recording.then(() => doRecordFeature(id));
  recording = run.catch(() => undefined);
  return run.catch((e: unknown) => {
    console.warn('recordFeature', e);
  });
}

async function doRecordFeature(id: FeatureId): Promise<void> {
  await loadBadgeSettings();
  if (!badgesEnabled.value) return;
  const memberId = activeProfile.value?.id ?? ANON;
  const log = normalizeFeatureLog(await getSetting<unknown>(FEATURES_LOG_SETTING, {}));
  await setSetting(FEATURES_LOG_SETTING, bumpFeature(log, id, memberId, nowIso()));
  await checkNewBadges(memberId);
}
