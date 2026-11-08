// "Kies een uitdaging" (docs/specs/challenges.md §1b, block 6E): the offer of this week (three
// challenges, one of each weight; src/challenges.ts `challengeOffer`) as three tappable cards with the
// name, the description with the goal filled in, the term ("tot zondag", "tot 30 nov", "hele winter"),
// the reward ("+250 XP") and the weight as one to three 🌶. Tapping a card selects it and shows Start
// under it; Start starts it (`onStart`) and the caller closes the sheet. 13J pattern: SheetPortal with
// only Sluit on the right of the head (`.sheet-head.with-actions`); Escape, tapping beside the sheet and
// Sluit close it without starting anything. Focus goes to Sluit on open and back to the opener on close.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Challenge } from '@/domain/challenges';
import { t } from '@/i18n';
import { challengeDescription, challengeName, rewardText, termText, weightText } from './ChallengeCard';
import { SheetPortal } from './SheetPortal';

export function ChallengeOfferSheet(props: { offer: readonly Challenge[]; onStart: (id: string) => void; onClose: () => void }): JSX.Element {
  const { offer, onStart, onClose } = props;
  const [chosen, setChosen] = useState<string | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const heading = t('challenge.sheetTitle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it on Sluit on open, hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <SheetPortal>
      <div class="sheet-backdrop" onClick={onClose}>
        <div class="sheet challenge-sheet" role="dialog" aria-modal="true" aria-label={heading} onClick={(e) => e.stopPropagation()}>
          <div class="sheet-grab" aria-hidden="true" />
          <div class="sheet-head with-actions">
            <h2>{heading}</h2>
            <button ref={closeBtn} type="button" class="sheet-head-btn" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
          <div class="sheet-body challenge-offer">
            {offer.map((c) => {
              const on = chosen === c.id;
              return (
                <div key={c.id} class={'challenge-offer-card' + (on ? ' on' : '')}>
                  <button type="button" class="challenge-offer-pick" aria-pressed={on} onClick={() => setChosen(on ? null : c.id)}>
                    <span class="challenge-offer-top">
                      <span class="challenge-icon" aria-hidden="true">
                        {c.icon}
                      </span>
                      <strong class="challenge-offer-name">{challengeName(c)}</strong>
                      <span class="challenge-weight" role="img" aria-label={weightText(c.weight)}>
                        {'🌶'.repeat(c.weight)}
                      </span>
                    </span>
                    <span class="challenge-offer-desc">{challengeDescription(c)}</span>
                    <span class="challenge-offer-meta muted small">
                      {termText(c.term)} · <span class="challenge-reward">{rewardText(c.xp)}</span>
                    </span>
                  </button>
                  {on && (
                    <button type="button" class="btn btn-primary btn-block challenge-start" onClick={() => onStart(c.id)}>
                      {t('challenge.start')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
