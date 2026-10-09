// "✓ Gekookt" / "Beoordeel" bottom sheet on the recipe page (docs/phase-6-spec.md 6A.3). Gabi cooks
// from memory and skips cook mode, so this logs a cook without it: when (today / yesterday / another
// date, never in the future), stars (optional; the same radiogroup as cook mode) and a note →
// `recordCooked` (src/cooklog.ts), which counts everywhere cook mode counts. In `rate` mode the same
// sheet, without the date part, gives an existing entry its stars afterwards → `updateCookLogEntry`.
// Uses the .sheet-* shell of base.css (same as VariantSheet / IngredientPicker); without a profile
// it says so honestly instead of saving to nobody.
import { useEffect, useRef, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { celebrate } from '@/celebrate';
import { formatShortDate } from '@/components/RecipeRow';
import { Segmented } from '@/components/Segmented';
import { cookedAtForDay, daysAgo, localDay, recordCooked } from '@/cooklog';
import { updateCookLogEntry } from '@/db/repo';
import { nowIso, type CookLogEntry } from '@/domain/model';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';

type When = 'today' | 'yesterday' | 'other';

/** `log` = a new cook; `rate` = stars and a note for this existing entry. */
export type CookedSheetMode = { kind: 'log' } | { kind: 'rate'; entry: CookLogEntry };

export interface CookedSheetProps {
  recipeId: string;
  mode: CookedSheetMode;
  onClose: () => void;
  /** After a successful save; the caller closes the sheet and shows the confirmation. */
  onSaved: (kind: CookedSheetMode['kind']) => void;
}

export function CookedSheet(props: CookedSheetProps) {
  const l = lang.value;
  const profile = activeProfile.value;
  const mode = props.mode;
  const entry = mode.kind === 'rate' ? mode.entry : null;
  const title = entry ? t('cooked.rateTitle') : t('cooked.title');
  const today = localDay();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [when, setWhen] = useState<When>('today');
  const [day, setDay] = useState('');
  const [stars, setStars] = useState(entry?.stars ?? 0);
  const [note, setNote] = useState(entry?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const starsCelebrated = useRef(false);
  const { onClose } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it on the × on open and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => opener?.focus();
  }, []);

  /** A tap on star n: toggle off when it was the rating already; first pick = small burst (C.4). */
  function chooseStars(n: number) {
    const next = stars === n ? 0 : n;
    setStars(next);
    if (next > 0 && !starsCelebrated.current) {
      starsCelebrated.current = true;
      celebrate('stars');
    }
  }

  /** The timestamp this cook gets, or null while "Andere datum" has no valid day yet. */
  function cookedAt(): string | null {
    if (when === 'today') return nowIso();
    if (when === 'yesterday') return cookedAtForDay(daysAgo(1));
    if (!day || day > today) return null;
    return cookedAtForDay(day);
  }

  const canSave = !!profile && !busy && (entry ? entry.id !== undefined : cookedAt() !== null);

  async function onSave() {
    if (!canSave || !profile) return;
    setBusy(true);
    setError(false);
    try {
      if (entry) {
        if (entry.id === undefined) throw new Error('cook-log entry without id');
        await updateCookLogEntry(entry.id, { stars: stars > 0 ? stars : null, note });
        // Stars given afterwards count for the review badges (data/badges.json "reviews", "oneStar")
        // just like stars in cook mode: start the check, never make the save wait for it (same
        // pattern as recordCooked).
        void checkNewBadges(profile.id).catch((e: unknown) => console.error('checkNewBadges', e));
        props.onSaved('rate');
      } else {
        const at = cookedAt();
        if (at === null) throw new Error('no date');
        await recordCooked({ recipeId: props.recipeId, profileId: profile.id, at, stars: stars > 0 ? stars : null, note });
        props.onSaved('log');
      }
    } catch (e) {
      console.error('CookedSheet', e);
      setError(true);
      setBusy(false);
    }
  }

  const whenOptions = [
    { value: 'today' as const, label: t('cooked.today') },
    { value: 'yesterday' as const, label: t('cooked.yesterday') },
    { value: 'other' as const, label: t('cooked.otherDay') },
  ];

  return (
    <div class="sheet-backdrop no-print" onClick={onClose}>
      <div class="sheet cooked-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button ref={closeBtn} type="button" class="icon-btn" aria-label={t('common.close')} onClick={onClose}>
            ×
          </button>
        </div>
        <div class="sheet-body">
          {!profile ? (
            <p class="muted cooked-hint">{t('cooked.noProfile')}</p>
          ) : (
            <>
              {entry ? (
                <p class="muted small cooked-intro">
                  {t('cooked.cookedOn', { date: formatShortDate(entry.at, l) })} · {t('cooked.rateIntro')}
                </p>
              ) : (
                <>
                  <p class="muted small cooked-intro">{t('cooked.intro')}</p>
                  <div class="field cooked-when">
                    <span>{t('cooked.when')}</span>
                    {/* The segmented control deselects on a second tap; a cook always has a day, so keep the current one. */}
                    <Segmented
                      name="cooked-when"
                      options={whenOptions}
                      selected={[when]}
                      onChange={(next) => {
                        const v = next[0];
                        if (v) setWhen(v);
                      }}
                    />
                  </div>
                  {when === 'other' && (
                    <label class="field cooked-date">
                      <span>{t('cooked.dateLabel')}</span>
                      <input
                        type="date"
                        class="input"
                        value={day}
                        max={today}
                        disabled={busy}
                        onInput={(e) => setDay((e.currentTarget as HTMLInputElement).value)}
                      />
                    </label>
                  )}
                </>
              )}
              <div class="muted small">{t('cook.stars')}</div>
              <div class="stars" role="radiogroup" aria-label={t('cook.stars')}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={t('cook.starN', { n })}
                    class={n <= stars ? 'on' : ''}
                    disabled={busy}
                    onClick={() => chooseStars(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <label class="field">
                <span>{t('cook.noteLabel')}</span>
                <textarea
                  class="input notes"
                  value={note}
                  placeholder={t('cook.notePlaceholder')}
                  disabled={busy}
                  onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)}
                />
              </label>
            </>
          )}
        </div>
        <div class="cooked-foot">
          <button type="button" class="btn btn-primary" disabled={!canSave} onClick={() => void onSave()}>
            {busy ? t('cooked.saving') : entry ? t('cooked.saveRating') : t('cooked.save')}
          </button>
          {error && (
            <p class="cooked-error" role="alert">
              {t('cooked.failed')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
