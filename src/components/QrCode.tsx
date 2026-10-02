// QR image for a share link (phase 5 block D.5, ADR-0007 + ADR-0006 flow D). Encode-only:
// scanning stays the phone's camera app. The 'qrcode' package is loaded with a dynamic
// import at mount, so it becomes its own lazy chunk and the main bundle does not grow.
import { useEffect, useState } from 'preact/hooks';
import { t } from '@/i18n';

export function QrCode(props: { text: string; label?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    import('qrcode')
      .then((qr) =>
        qr.toDataURL(props.text, {
          // ECC 'L' = smallest symbol; the link is fetched live, a misread just means re-scan.
          errorCorrectionLevel: 'L',
          margin: 2,
          // Deliberately NOT theme tokens: scanner contrast beats dark mode (ADR-0007).
          color: { dark: '#000000', light: '#ffffff' },
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch((e: unknown) => {
        // Chunk failed to load (offline before first use) or the text is too long for a QR.
        console.error('QrCode', e);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [props.text]);

  if (failed) return <p class="warn small">{t('share.qrError')}</p>;
  return (
    <div class="share-qr-card">
      {src ? <img class="share-qr-img" src={src} alt={props.label ?? t('share.qrAlt')} /> : <span class="small share-qr-loading">{t('share.qrLoading')}</span>}
    </div>
  );
}
