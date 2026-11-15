// V1c-2 §1c (docs/specs/verbeterronde-1c.md, block "Mensen en sturen"): the Stuur sheet. "Stuur naar
// Gabi" (from a person row on Huishouden & vrienden) or "Stuur mijn voortgang" (no recipient: Mijn
// profiel, Profielen, the top of Huishouden & vrienden). Same shell as <CookedSheet/>: SheetPortal,
// grab bar, a head with Sluit left and the primary action (Deel) right, so it is always in view.
//
// Two ticks: "Mijn voortgang" (the `#x=` snapshot: who you are, level, badges, cooking days) — with
// badges off "Wie ik ben" (the `#f=` token: name, colour, language, avatar) — on by default; and,
// only with a recipient, "Nieuwe recepten" (the delta since the last send to that name, as on
// '#/share'), on when something is new, disabled when nothing is. The text is built when the sheet
// opens and recomputed on every tick change (joinParts), so Deel calls navigator.share({ text })
// inside the tap (invariant 9: exactly one field). Several parts (V2, 20 KB per message) go one tap
// at a time ("Deel deel 2 van 3"); after the last one logSent writes the 'out' rows and
// `share.lastSentTo`, and the status says "Verstuurd.". The sheet does not close by itself (Stijn
// wants to see it is done); Sluit, a tap beside it and Escape close it. A delta too big for messages
// (a bundle file) is not handled here: the recipes line says so and links to '#/share'.
import { useEffect, useRef, useState } from 'preact/hooks';
import { badgesEnabled } from '@/badges';
import { formatShortDate } from '@/components/RecipeRow';
import { SheetPortal } from '@/components/SheetPortal';
import type { DeltaSince } from '@/db/repo';
import type { Member } from '@/domain/household';
import type { Profile } from '@/domain/model';
import type { MessagePlan } from '@/domain/share';
import { t } from '@/i18n';
import { navigate } from '@/router';
import { buildIdentityMessage, buildProgressMessage, joinParts, logSent, planDeltaFor } from '@/sendto';
import { copyText, shareText } from '@/share-actions';

interface DeltaInfo {
  delta: DeltaSince;
  plan: MessagePlan | null;
  lastSent: string | null;
  count: number;
}

export function SendSheet(props: { profile: Profile; recipient: Member | null; onClose: () => void }) {
  const p = props.profile;
  const recipient = props.recipient;
  const badgesOn = badgesEnabled.value;
  const title = recipient ? t('send.title', { name: recipient.name }) : t('send.titleMine');

  const [first, setFirst] = useState('');
  const [firstFailed, setFirstFailed] = useState(false);
  const [info, setInfo] = useState<DeltaInfo | null>(null);
  const [wantMine, setWantMine] = useState(true);
  const [wantRecipes, setWantRecipes] = useState(false);
  const [sentParts, setSentParts] = useState(0);
  const [status, setStatus] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Bumped after a send with recipes: the delta is recomputed (they are no longer new). */
  const [deltaRound, setDeltaRound] = useState(0);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // The person message: progress (badges on) or who I am (badges off), built once per opening.
  useEffect(() => {
    let cancelled = false;
    setFirst('');
    setFirstFailed(false);
    (badgesOn ? buildProgressMessage(p) : buildIdentityMessage(p))
      .then((m) => {
        if (!cancelled) setFirst(m.message);
      })
      .catch((e: unknown) => {
        console.error('send sheet', e);
        if (!cancelled) setFirstFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [p.id, p.name, p.color, p.lang, JSON.stringify(p.avatar ?? null), badgesOn]);

  // The recipes for this recipient (only with a recipient).
  useEffect(() => {
    if (!recipient) return;
    let cancelled = false;
    planDeltaFor(recipient.name, { name: p.name, id: p.id })
      .then((d) => {
        if (cancelled) return;
        setInfo(d);
        // On by default when something is new and it fits in messages (a file goes via '#/share').
        setWantRecipes(d.count > 0 && d.plan !== null && 'parts' in d.plan);
      })
      .catch((e: unknown) => {
        console.error('send sheet delta', e);
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [recipient?.name, p.id, p.name, deltaRound]);

  // aria-modal moves no focus by itself: put it on Sluit on open and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => opener?.focus();
  }, []);

  const tooBig = info !== null && info.plan !== null && 'file' in info.plan;
  const recipesUsable = info !== null && info.count > 0 && !tooBig;
  const mineOn = wantMine && first !== '';
  const recipesOn = wantRecipes && recipesUsable;
  const parts = joinParts(mineOn ? first : '', recipesOn && info ? info.plan : null);
  const nothing = !wantMine && !recipesOn;
  const ready = parts.length > 0 && !busy;

  // A tick change starts the parts over.
  useEffect(() => {
    setSentParts(0);
    setShowRaw(false);
  }, [mineOn, recipesOn, parts.length]);

  function close() {
    if (busy) return;
    props.onClose();
  }

  function share() {
    if (!ready) return;
    const n = parts.length;
    const i = Math.min(sentParts, n - 1);
    const sendingMine = mineOn;
    const sendingDelta = recipesOn && info ? info.delta : null;
    setBusy(true);
    setStatus('');
    // navigator.share runs before the first await inside shareText: still within the tap.
    void shareText(parts[i] ?? '')
      .then(async (r) => {
        if (r.outcome === 'shared' && i + 1 < n) {
          setSentParts(i + 1);
          setStatus(t('delta.partSent', { i: i + 1, n }));
        } else if (r.outcome === 'shared') {
          setSentParts(0);
          await logSent({
            profile: p,
            recipient: recipient?.name ?? null,
            progress: sendingMine && badgesOn,
            identity: sendingMine && !badgesOn,
            delta: sendingDelta,
          });
          setStatus(t('send.done'));
          if (sendingDelta) setDeltaRound((k) => k + 1);
        } else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
        else if (r.outcome === 'failed') setStatus(`${t('share.error')}: ${r.error ?? ''}`);
      })
      .finally(() => setBusy(false));
  }

  /** "Kopieer": every part, one blank line between them (the paste box reads several codes). Not logged. */
  function copy() {
    if (!parts.length) return;
    void copyText(parts.join('\n\n')).then((r) => {
      if (r.ok) setStatus(t('send.copied'));
      else {
        // The clipboard refused (http dev server, permissions): show the text to copy by hand.
        setStatus(t('share.copyError'));
        setShowRaw(true);
      }
    });
  }

  const shareLabel = parts.length > 1 && sentParts > 0 ? t('send.sharePart', { i: sentParts + 1, n: parts.length }) : t('send.share');

  let recipesSub = '';
  if (info) {
    if (tooBig) recipesSub = '';
    else if (info.count > 0) recipesSub = info.lastSent ? t('send.recipesSub', { n: info.count, date: formatShortDate(info.lastSent) }) : t('send.recipesAll', { n: info.count });
    else recipesSub = info.lastSent ? t('send.recipesNone', { date: formatShortDate(info.lastSent) }) : t('send.recipesAll', { n: 0 });
  }

  return (
    <SheetPortal onEscape={close}>
      <div class="sheet-backdrop no-print" onClick={close}>
        <div class="sheet send-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <div class="sheet-grab" aria-hidden="true" />
          <div class="sheet-head with-actions">
            <button ref={closeBtn} type="button" class="sheet-head-btn" onClick={close}>
              {t('common.close')}
            </button>
            <h2>{title}</h2>
            <button type="button" class="sheet-head-btn save" disabled={!ready} onClick={share}>
              {shareLabel}
            </button>
          </div>
          <div class="sheet-body">
            <div class="send-sheet-options">
              <label class="send-sheet-option">
                <input type="checkbox" checked={wantMine} disabled={busy} onChange={(e) => setWantMine((e.currentTarget as HTMLInputElement).checked)} />
                <span class="send-sheet-option-text">
                  <strong>{badgesOn ? t('send.progress') : t('send.identity')}</strong>
                  <span class="muted small">{badgesOn ? t('send.progressSub') : t('send.identitySub')}</span>
                  {firstFailed && <span class="bad small">{t('share.error')}</span>}
                </span>
              </label>
              {recipient && (
                <label class={'send-sheet-option' + (recipesUsable ? '' : ' off')}>
                  <input
                    type="checkbox"
                    checked={recipesOn}
                    disabled={busy || !recipesUsable}
                    onChange={(e) => setWantRecipes((e.currentTarget as HTMLInputElement).checked)}
                  />
                  <span class="send-sheet-option-text">
                    <strong>{t('send.recipes')}</strong>
                    {info === null ? (
                      <span class="muted small">{t('common.loading')}</span>
                    ) : tooBig ? (
                      <span class="small send-sheet-toobig">
                        {t('send.tooBig')}{' '}
                        <a
                          href="#/share"
                          onClick={(e) => {
                            e.preventDefault();
                            props.onClose();
                            navigate('/share');
                          }}
                        >
                          {t('delta.title')} ›
                        </a>
                      </span>
                    ) : (
                      <span class="muted small">{recipesSub}</span>
                    )}
                  </span>
                </label>
              )}
            </div>
            {showRaw && <textarea class="input member-card-raw" readOnly rows={4} value={parts.join('\n\n')} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />}
            <p class="muted small send-sheet-ios">{t('send.iosHint')}</p>
          </div>
          <div class="send-sheet-foot">
            <div class="actions">
              <button type="button" class="btn btn-primary" disabled={!ready} onClick={share}>
                {shareLabel}
              </button>
              <button type="button" class="btn" disabled={!parts.length} onClick={copy}>
                {t('send.copy')}
              </button>
            </div>
            <div class="status send-sheet-status" role="status">
              {nothing ? t('send.nothing') : status}
            </div>
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
