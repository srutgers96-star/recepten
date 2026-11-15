// V1c-9 (docs/specs/verbeterronde-1c.md, block V1c-9 §1b): <ProgressReturnPanel/> — "Stuur terug" on
// Huishouden & vrienden sends a STORED snapshot of someone else back to them (their phone may be
// empty): intro, Deel + Kopieer link, the iPhone line, a status (no QR). The card is
// `cardOfSnapshot(snapshot)` (no `receivedAt` / `friend`), wrapped by the unchanged
// `buildProgressEnvelope` (invariant 4), with the envelope's `at` set to the snapshot's `receivedAt`
// so the receiver sees the original date. Sharing goes through `shareText` with exactly ONE field
// (invariant 9). Badges off = no trace of XP or level anywhere: the panel then renders nothing.
//
// V1c-2 §1c: the former "Sync mijn voortgang" panel (<ProgressSharePanel/>, <ProgressShareToggle/>)
// is gone; sending your own progress is the Stuur sheet (<SendSheet/>, src/sendto.ts, which now
// holds buildProgressMessage).
import { useEffect, useState } from 'preact/hooks';
import { badgesEnabled, recheckActiveBadges } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { formatShortDate } from '@/components/RecipeRow';
import { logShareEvent } from '@/db/repo';
import { titleFor } from '@/domain/levels';
import { nowIso } from '@/domain/model';
import { cardOfSnapshot, type ProgressSnapshot } from '@/domain/progress';
import { buildProgressEnvelope, buildProgressShareMessage } from '@/domain/share';
import { buildShareUrl, encodeToken } from '@/domain/token';
import { t } from '@/i18n';
import { copyText, shareText } from '@/share-actions';

/** V1c-9: the WhatsApp text for a stored snapshot, in the SNAPSHOT's language; the `#x=` link on the last line. */
async function buildReturnMessage(snapshot: ProgressSnapshot): Promise<string> {
  const card = cardOfSnapshot(snapshot);
  const env = buildProgressEnvelope(card);
  // §1b: the moment that phone received it ≈ the moment it was shared ("gedeeld op", the 30-day rule).
  env.at = snapshot.receivedAt;
  const token = await encodeToken(env);
  const url = buildShareUrl(appInfo.appUrl, 'x', token);
  const l = card.lang === 'en' ? 'en' : 'nl';
  return buildProgressShareMessage({ name: card.name, level: card.level, title: titleFor(card.level, l), url, lang: l });
}

/**
 * V1c-9 "Stuur terug": intro, Deel + Kopieer link, the iPhone line, a status (no QR). After the share
 * sheet reported 'shared' one 'out' row (kind 'progress', who = the name). Badges off = nothing.
 */
export function ProgressReturnPanel(props: { snapshot: ProgressSnapshot }) {
  const s = props.snapshot;
  const [message, setMessage] = useState('');
  const [buildFailed, setBuildFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [busy, setBusy] = useState(false);
  const on = badgesEnabled.value;

  useEffect(() => {
    let cancelled = false;
    setMessage('');
    setBuildFailed(false);
    setStatus('');
    setShowRaw(false);
    if (!on) return;
    buildReturnMessage(s)
      .then((m) => {
        if (!cancelled) setMessage(m);
      })
      .catch((e: unknown) => {
        console.error('progress return', e);
        if (!cancelled) setBuildFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [s.id, s.receivedAt, on]);

  if (!on) return null;

  function share() {
    if (!message || busy) return;
    setBusy(true);
    setStatus('');
    // navigator.share runs before the first await inside shareText: still within the tap.
    void shareText(message)
      .then((r) => {
        if (r.outcome === 'shared') {
          setStatus(t('progress.shared'));
          void logShareEvent({ at: nowIso(), direction: 'out', kind: 'progress', who: s.name, count: 1, recipeIds: [] })
            .then(() => recheckActiveBadges())
            .catch((e: unknown) => console.error('logShareEvent', e));
        } else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
        else if (r.outcome === 'failed') setStatus(`${t('share.error')}: ${r.error ?? ''}`);
      })
      .finally(() => setBusy(false));
  }

  function copy() {
    if (!message) return;
    void copyText(message).then((r) => {
      if (r.ok) setStatus(t('progress.copied'));
      else {
        setStatus(t('share.copyError'));
        setShowRaw(true);
      }
    });
  }

  return (
    <div class="member-card-share progress-share progress-return">
      <p class="muted small">{t('progress.returnIntro', { name: s.name, level: s.level, date: formatShortDate(s.receivedAt) })}</p>
      {buildFailed && <p class="bad small">{t('share.error')}</p>}
      <div class="actions">
        <button type="button" class="btn btn-primary" disabled={!message || busy} onClick={share}>
          {t('progress.send')}
        </button>
        <button type="button" class="btn" disabled={!message} onClick={copy}>
          {t('progress.copy')}
        </button>
      </div>
      {showRaw && <textarea class="input member-card-raw" readOnly rows={3} value={message} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />}
      <p class="muted small">{t('send.iosHint')}</p>
      <div class="status" role="status">
        {status}
      </div>
    </div>
  );
}
