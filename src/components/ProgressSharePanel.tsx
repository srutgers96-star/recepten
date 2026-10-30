// "Sync mijn voortgang" (docs/specs/xp-levels.md §1h, block 6D-4 = 6D-4b): the panel under the
// button on the ACTIVE profile card (Profielen) and under Huishouden → Mijn kaartje. Same build-up
// as <MemberCardPanel/> (ProfilesScreen): intro, Deel + Kopieer link, the iPhone line, a status.
//
// What travels is a SNAPSHOT (`#x=`, §2h): level, XP, streak, the earned badges (`id` / `id@k`) and
// the cooking days of the last 90 days with their recipe ids (`progressCardFor`, src/domain/progress.ts).
// No notes, no stars, no photos. There is no backend (invariant 14): the other person sees what was
// shared NOW, and the panel says so (`progress.honest`).
//
// Sharing goes through `shareText` with exactly ONE field (invariant 9). After the share sheet
// reported 'shared' an 'out' row (kind 'progress') lands in the "In & uit" log, then the active
// profile's badges are re-checked ("Hele cirkel" reads 'out' rows) — the same order as the other
// share screens. Copying does not log (as with the member card). The card is built once per
// opening (and again when name, colour, language or avatar change); it never writes anything else.
//
// Badges off (`badges.enabled` false) = no trace of XP or level anywhere (§1, §5.9): the panel then
// renders nothing, and the screens leave the button out.
import { useEffect, useState } from 'preact/hooks';
import { badgesEnabled, recheckActiveBadges } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { logShareEvent } from '@/db/repo';
import { normalizeAvatarSpec } from '@/domain/avatar';
import { localDayIndex } from '@/domain/days';
import { titleFor } from '@/domain/levels';
import { nowIso, type Profile } from '@/domain/model';
import { progressCardFor } from '@/domain/progress';
import { buildProgressEnvelope, buildProgressShareMessage } from '@/domain/share';
import { buildShareUrl, encodeToken } from '@/domain/token';
import { t } from '@/i18n';
import { ensureDeviceId } from '@/screens/ProfilesScreen';
import { copyText, shareText } from '@/share-actions';
import { buildXpFacts, xpStateFor } from '@/xp';

/** The WhatsApp text: one sentence in the SENDER's language, the `#x=` link alone on the last line (§2h). */
async function buildProgressMessage(p: Profile): Promise<string> {
  const [deviceId, state, facts] = await Promise.all([ensureDeviceId(), xpStateFor(p.id), buildXpFacts(p.id)]);
  const avatar = normalizeAvatarSpec(p.avatar);
  const card = progressCardFor({
    member: { id: p.id, name: p.name, color: p.color, lang: p.lang },
    deviceId,
    state,
    badges: facts.badges,
    log: facts.log,
    today: localDayIndex(new Date()),
    ...(avatar ? { avatar } : {}),
  });
  const token = await encodeToken(buildProgressEnvelope(card));
  const url = buildShareUrl(appInfo.appUrl, 'x', token);
  return buildProgressShareMessage({ name: card.name, level: card.level, title: titleFor(card.level, p.lang), url, lang: p.lang });
}

export function ProgressSharePanel(props: { profile: Profile }) {
  const p = props.profile;
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
    buildProgressMessage(p)
      .then((m) => {
        if (!cancelled) setMessage(m);
      })
      .catch((e: unknown) => {
        console.error('progress card', e);
        if (!cancelled) setBuildFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [p.id, p.name, p.color, p.lang, JSON.stringify(p.avatar ?? null), on]);

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
          // §1h: the progress went out — one 'out' row (kind 'progress'); then the badges re-check.
          void logShareEvent({ at: nowIso(), direction: 'out', kind: 'progress', who: null, count: 1, recipeIds: [], note: p.name })
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
        // The clipboard refused (http dev server, permissions): show the text to copy by hand.
        setStatus(t('share.copyError'));
        setShowRaw(true);
      }
    });
  }

  return (
    <div class="member-card-share progress-share">
      <p class="muted small">{t('progress.intro')}</p>
      {/* The spec names no text for this rare failure; the generic share error is used (no new key). */}
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
      <p class="muted small">{t('household.cardIosHint')}</p>
      <p class="muted small">{t('progress.honest')}</p>
      <div class="status" role="status">
        {status}
      </div>
    </div>
  );
}

/**
 * The button "Sync mijn voortgang" with the panel unfolding under it, for a screen that has no row
 * of profile buttons to put it in (Huishouden → Mijn kaartje). Badges off = nothing at all.
 */
export function ProgressShareToggle(props: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  if (!badgesEnabled.value) return null;
  return (
    <>
      <div class="actions" style="margin:8px 0 0">
        <button type="button" class="btn btn-small" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {t('progress.share')}
        </button>
      </div>
      {open && <ProgressSharePanel profile={props.profile} />}
    </>
  );
}
