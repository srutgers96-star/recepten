// The share-sheet helpers of the Share, "Stuur nieuwe naar …" and Storage screens. Invariant 9
// (CLAUDE.md): `navigator.share` gets exactly ONE field ({text} or {files}); the call happens
// before the first `await`, so it still sits inside the user activation of the tap handler.
// File order (ADR-0004): .json, then the same bytes as .txt (Chromium refuses .json), then a
// plain <a download> that works in every browser and lands in Downloads.

export type TextOutcome = 'shared' | 'aborted' | 'failed' | 'no-share-api';

function isAbort(e: unknown): boolean {
  return (e as { name?: string })?.name === 'AbortError';
}

/**
 * Plain text through the share sheet; without one WhatsApp's web intent is opened instead
 * (`no-share-api`: the caller cannot know whether it was sent). Call synchronously in the tap handler.
 */
export async function shareText(text: string): Promise<{ outcome: TextOutcome; error?: string }> {
  if (typeof navigator.share !== 'function') {
    location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
    return { outcome: 'no-share-api' };
  }
  try {
    await navigator.share({ text });
    return { outcome: 'shared' };
  } catch (e) {
    if (isAbort(e)) return { outcome: 'aborted' };
    return { outcome: 'failed', error: String(e) };
  }
}

export async function copyText(text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Last resort: a plain download link (works in every browser, lands in Downloads). */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type FileOutcome = 'shared' | 'downloaded' | 'aborted' | 'failed';

/**
 * A JSON document through the share sheet as `<name>` (.json), else the same bytes as .txt,
 * else a download. `name` must end in ".json". Call synchronously in the tap handler.
 */
export async function shareJsonFile(name: string, json: string): Promise<{ outcome: FileOutcome; name: string; error?: string }> {
  const stem = name.replace(/\.json$/i, '');
  const jsonFile = new File([json], `${stem}.json`, { type: 'application/json' });
  const txtFile = new File([json], `${stem}.txt`, { type: 'text/plain' });
  const canShare = (f: File) => typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });
  const candidate = canShare(jsonFile) ? jsonFile : canShare(txtFile) ? txtFile : null;
  if (candidate) {
    try {
      await navigator.share({ files: [candidate] });
      return { outcome: 'shared', name: candidate.name };
    } catch (e) {
      if (isAbort(e)) return { outcome: 'aborted', name: candidate.name };
      // fall through to the download
    }
  }
  try {
    downloadBlob(jsonFile.name, jsonFile);
    return { outcome: 'downloaded', name: jsonFile.name };
  } catch (e) {
    return { outcome: 'failed', name: jsonFile.name, error: String(e) };
  }
}
