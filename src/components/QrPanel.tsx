// "Toon QR" next to every share button (docs/specs/qr-link.md §1a/§1b, block 13Q). The parent owns
// the open state and puts <QrToggle/> in its own row of buttons, next to "Deel" and "Kopieer link";
// <QrPanel/> unfolds under that row: the code (white card with a quiet zone in BOTH themes,
// ADR-0007) and the hint `share.qrHint`. A link longer than QR_MAX_URL_CHARS shows no code but the
// honest line `share.qrTooBig` (the button stays, so the user sees why). Tapping the button again,
// or the panel itself, closes it. Encode-only: no scanner, no camera permission (ADR-0007).
import { QrCode } from '@/components/QrCode';
import { qrFits } from '@/domain/qr-fit';
import { recordFeature } from '@/features';
import { t } from '@/i18n';

/** The third button, "Toon QR"; the label stays the same, `aria-expanded` tells the state. */
export function QrToggle(props: { open: boolean; onToggle(): void; disabled?: boolean }) {
  return (
    <button
      type="button"
      class="btn"
      aria-expanded={props.open}
      disabled={props.disabled}
      onClick={() => {
        if (!props.open) void recordFeature('qrShown');
        props.onToggle();
      }}
    >
      {t('share.qr')}
    </button>
  );
}

/** The block under the buttons: the QR of exactly `url`, or the too-big line. Closed = nothing. */
export function QrPanel(props: { url: string; open: boolean; onToggle(): void; label?: string }) {
  if (!props.open || !props.url) return null;
  const fits = qrFits(props.url);
  return (
    // Tapping the panel closes it as well (§1a "tik nogmaals op Toon QR of ernaast → dicht").
    <div class="qr-panel" onClick={props.onToggle}>
      {fits ? (
        <>
          <QrCode text={props.url} label={props.label} />
          <p class="muted small qr-panel-hint">{t('share.qrHint')}</p>
        </>
      ) : (
        <p class="warn small qr-panel-hint">{t('share.qrTooBig')}</p>
      )}
    </div>
  );
}
