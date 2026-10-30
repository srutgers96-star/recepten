// "✓ Gekookt" / "Beoordeel" bottom sheet on the recipe page (docs/phase-6-spec.md 6A.3). Gabi cooks
// from memory and skips cook mode, so this logs a cook without it: when (today / yesterday / another
// date, never in the future), stars (optional; the same radiogroup as cook mode) and a note →
// `recordCooked` (src/cooklog.ts), which counts everywhere cook mode counts. In `rate` mode the same
// sheet, without the date part, gives an existing entry its stars afterwards → `updateCookLogEntry`.
// Uses the .sheet-* shell of base.css (same as VariantSheet / IngredientPicker); without a profile
// it says so honestly instead of saving to nobody.
// Dismissal (Gabi's bug + Stijn's decision, 16 Oct 2026): Bewaar sits at the top as well as under the
// form, so it is always in view on an iPhone. Swiping the sheet down (grab bar/head), tapping beside
// it, Annuleer and Escape all close WITHOUT saving; only Bewaar saves. The line under the form says so.
// Photo (Gabi, 16 Oct 2026: "the cooked button should also have the add photo function"): the same
// "Foto toevoegen" as the Gekookt! page of cook mode, but held in the sheet until Bewaar (so a swipe
// away saves nothing, photo included). Bewaar stores the cook first, then the photo with the cook's
// date; a failed photo save keeps the sheet open and a second Bewaar retries only the photo.
// 6D-1 (docs/specs/xp-levels.md §1e, §3): a rating and a photo are reward moments (settleXp; the cook
// itself settles in recordCooked), and "Andere datum" more than 7 days back says honestly, with
// badges on, that it counts for badges and the calendar but not for XP.
// 13D blok 3 (docs/specs/varianten-tabs.md §1d): on an approved diet tab the recipe page passes that
// diet as `variant`; a new cook logs it (recordCooked). "Beoordeel" (rate mode) is unchanged.
import { useEffect, useRef, useState } from 'preact/hooks';
import { badgesEnabled, checkNewBadges } from '@/badges';
import { celebrate } from '@/celebrate';
import { formatShortDate } from '@/components/RecipeRow';
import { Segmented } from '@/components/Segmented';
import { SheetPortal } from '@/components/SheetPortal';
import { cookedAtForDay, daysAgo, localDay, recordCooked } from '@/cooklog';
import { addPhoto, updateCookLogEntry } from '@/db/repo';
import { dayFromKey, localDayIndex } from '@/domain/days';
import type { VariantDiet } from '@/domain/diets';
import { nowIso, type CookLogEntry } from '@/domain/model';
import { XP_RULES } from '@/domain/xp';
import { lang, t } from '@/i18n';
import { encodePhotoFile } from '@/photo';
import { activeProfile } from '@/profile';
import { markXpDirty, settleXp } from '@/xp';

type When = 'today' | 'yesterday' | 'other';

/** `log` = a new cook; `rate` = stars and a note for this existing entry. */
export type CookedSheetMode = { kind: 'log' } | { kind: 'rate'; entry: CookLogEntry };

export interface CookedSheetProps {
  recipeId: string;
  mode: CookedSheetMode;
  onClose: () => void;
  /** After a successful save; the caller closes the sheet and shows the confirmation. */
  onSaved: (kind: CookedSheetMode['kind']) => void;
  /** 13D: the approved diet version this cook was (the chosen diet tab); absent/null = the original. */
  variant?: VariantDiet | null;
}

export function CookedSheet(props: CookedSheetProps) {
  const l = lang.value;
  const profile = activeProfile.value;
  const mode = props.mode;
  const entry = mode.kind === 'rate' ? mode.entry : null;
  const title = entry ? t('cooked.rateTitle') : t('cooked.title');
  const today = localDay();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);
  const [when, setWhen] = useState<When>('today');
  const [day, setDay] = useState('');
  const [stars, setStars] = useState(entry?.stars ?? 0);
  const [note, setNote] = useState(entry?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // The picked photo, re-encoded (max 1024 px) but NOT stored yet; `url` is its preview.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoState, setPhotoState] = useState<'idle' | 'busy' | 'error'>('idle');
  const photoInput = useRef<HTMLInputElement>(null);
  // Bewaar in two parts: once the cook (or rating) is stored, a retry after a failed photo save
  // must not log the cook a second time. Holds the date the photo gets.
  const cookSaved = useRef<string | null>(null);
  const { onClose } = props;

  // Free the preview URL when the photo changes and when the sheet closes.
  useEffect(() => {
    if (!photo) return;
    const url = photo.url;
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function onPhotoPicked(file: File) {
    if (busy || photoState === 'busy') return;
    setPhotoState('busy');
    try {
      const blob = await encodePhotoFile(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
      setPhotoState('idle');
    } catch (e) {
      console.error('encodePhotoFile', e);
      setPhotoState('error');
    }
  }

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

  /** A tap on star n: toggle off when it was the rating already. No confetti yet: nothing is saved. */
  function chooseStars(n: number) {
    setStars(stars === n ? 0 : n);
  }

  /** The timestamp this cook gets, or null while "Andere datum" has no valid day yet. */
  function cookedAt(): string | null {
    if (when === 'today') return nowIso();
    if (when === 'yesterday') return cookedAtForDay(daysAgo(1));
    if (!day || day > today) return null;
    return cookedAtForDay(day);
  }

  const canSave =
    !!profile && !busy && photoState !== 'busy' && (cookSaved.current !== null || (entry ? entry.id !== undefined : cookedAt() !== null));

  // §1e: the chosen day lies more than `backdateDays` calendar days before today (the same rule as
  // deriveXp: entered today, cooked on that day) → no XP for this cook. Only said with badges on.
  const pickedDay = when === 'other' && day && day <= today ? dayFromKey(day) : null;
  const backdated = badgesEnabled.value && pickedDay !== null && localDayIndex(new Date()) - pickedDay > XP_RULES.backdateDays;

  /** Swipe down / tap beside the sheet: close without saving (only Bewaar saves). */
  function dismiss() {
    if (busy) return;
    onClose();
  }

  // Swipe down on the grab bar / head: the sheet follows the finger; far enough = dismiss().
  function onDragStart(e: PointerEvent) {
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone (e.g. a very short tap): the drag simply works without capture.
    }
  }
  function onDragMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y);
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = d.dy > 0 ? `translateY(${d.dy}px)` : '';
    }
  }
  function onDragEnd(e: PointerEvent, cancelled: boolean) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform .18s ease-out';
      sheetRef.current.style.transform = '';
    }
    if (!cancelled && d.dy > 80) dismiss();
  }

  async function onSave() {
    if (!canSave || !profile) return;
    setBusy(true);
    setError(false);
    try {
      // Part 1: the cook (or the rating), once.
      if (cookSaved.current === null) {
        if (entry) {
          if (entry.id === undefined) throw new Error('cook-log entry without id');
          await updateCookLogEntry(entry.id, { stars: stars > 0 ? stars : null, note });
          markXpDirty(profile.id);
          // The small stars burst (C.4) only once the rating is really saved (Stijn, 16 Oct 2026:
          // confetti on the tap itself was premature when the sheet was then closed unsaved).
          if (stars > 0) celebrate('stars');
          // Stars given afterwards count for the review badges (data/badges.json "reviews", "oneStar")
          // just like stars in cook mode: start the check, never make the save wait for it (same
          // pattern as recordCooked).
          void checkNewBadges(profile.id).catch((e: unknown) => console.error('checkNewBadges', e));
          // 6D-1: stars afterwards change that cook's base (+5): a small pop, never a new roll.
          void settleXp(profile.id).catch((e: unknown) => console.error('settleXp', e));
          cookSaved.current = entry.at;
        } else {
          const at = cookedAt();
          if (at === null) throw new Error('no date');
          await recordCooked({
            recipeId: props.recipeId,
            profileId: profile.id,
            at,
            stars: stars > 0 ? stars : null,
            note,
            variant: props.variant ?? null,
          });
          cookSaved.current = at;
        }
      }
      // Part 2: the photo, with the cook's date. The photo badges count household-wide; check again
      // now that the photo is in (recordCooked's own check ran before it was stored).
      if (photo) {
        try {
          await addPhoto({ recipeId: props.recipeId, memberId: profile.id, blob: photo.blob, at: cookSaved.current });
        } catch (e) {
          console.error('addPhoto', e);
          setPhotoState('error');
          setBusy(false);
          return;
        }
        markXpDirty(profile.id);
        void checkNewBadges(profile.id).catch((e: unknown) => console.error('checkNewBadges', e));
        // 6D-1: the photo is a reward moment of its own (it pops in the same series as the cook).
        void settleXp(profile.id).catch((e: unknown) => console.error('settleXp', e));
      }
      props.onSaved(entry ? 'rate' : 'log');
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
    <SheetPortal>
    <div class="sheet-backdrop no-print" onClick={dismiss}>
      <div ref={sheetRef} class="sheet cooked-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div
          class="cooked-drag"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={(e) => onDragEnd(e, false)}
          onPointerCancel={(e) => onDragEnd(e, true)}
        >
          <div class="sheet-grab" aria-hidden="true" />
          <div class="sheet-head with-actions">
            <button ref={closeBtn} type="button" class="sheet-head-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <h2>{title}</h2>
            <button type="button" class="sheet-head-btn save" disabled={!canSave} onClick={() => void onSave()}>
              {t('common.save')}
            </button>
          </div>
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
                  {backdated && <p class="muted small cooked-backdated">{t('xp.backdated')}</p>}
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
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                style="display:none"
                onChange={(e) => {
                  const input = e.currentTarget as HTMLInputElement;
                  const f = input.files?.[0];
                  input.value = '';
                  if (f) void onPhotoPicked(f);
                }}
              />
              {/* No capture attribute: the phone offers its photo library as well as the camera (the dish was often cooked earlier). */}
              {photo ? (
                <div class="cooked-photo">
                  <img class="cooked-photo-img" src={photo.url} alt={t('cooked.photoAlt')} />
                  <p class="muted small cooked-photo-hint">{photoState === 'error' ? t('cook.photoFailed') : t('cooked.photoHint')}</p>
                  <button
                    type="button"
                    class="btn btn-small cooked-photo-remove"
                    disabled={busy}
                    onClick={() => {
                      setPhoto(null);
                      setPhotoState('idle');
                    }}
                  >
                    {t('cooked.photoRemove')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  class="btn btn-block cooked-photo-add"
                  disabled={busy || photoState === 'busy'}
                  onClick={() => photoInput.current?.click()}
                >
                  <span aria-hidden="true">📷</span>{' '}
                  {photoState === 'busy' ? t('cook.photoBusy') : photoState === 'error' ? t('cook.photoFailed') : t('cook.photoAdd')}
                </button>
              )}
            </>
          )}
        </div>
        <div class="cooked-foot">
          <button type="button" class="btn btn-primary" disabled={!canSave} onClick={() => void onSave()}>
            {busy ? t('cooked.saving') : entry ? t('cooked.saveRating') : t('cooked.save')}
          </button>
          {profile && <p class="muted small cooked-dismiss-hint">{t('cooked.dismissHint')}</p>}
          {error && (
            <p class="cooked-error" role="alert">
              {t('cooked.failed')}
            </p>
          )}
        </div>
      </div>
    </div>
    </SheetPortal>
  );
}
