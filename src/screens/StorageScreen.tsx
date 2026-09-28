// '#/more/storage' — status (installed, persisted, usage), counts, last backup, "Back-up maken"
// (navigator.share({files}) with .json, then the same bytes as .txt, then an <a download>) and
// "Herstel" (<input type=file> → importBundle → counts). Invariant 9: share exactly ONE field.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { reloadCelebrateSettings } from '@/celebrate';
import { Header } from '@/components/Header';
import type { BackupBundle } from '@/db/model';
import { bundled, exportBundle, getSetting, importBundle, setSetting } from '@/db/repo';
import { nowIso } from '@/domain/model';
import { lang, t } from '@/i18n';
import { loadProfiles } from '@/profile';
import { isStandalone } from '@/pwa';

export const LAST_BACKUP_KEY = 'backup.lastAt';

interface Facts {
  standalone: boolean;
  persisted: boolean | null;
  usage: number | null;
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return t('storage.never');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang.value === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function isAbort(e: unknown): boolean {
  return (e as { name?: string })?.name === 'AbortError';
}

/** Last resort: a plain download link (works in every browser, lands in Downloads). */
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function StorageScreen() {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [bundle, setBundle] = useState<BackupBundle | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    let persisted: boolean | null = null;
    let usage: number | null = null;
    try {
      if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
    } catch {
      persisted = null;
    }
    try {
      if (navigator.storage?.estimate) usage = (await navigator.storage.estimate()).usage ?? null;
    } catch {
      usage = null;
    }
    setFacts({ standalone: isStandalone(), persisted, usage });
    // Pre-built so the "Back-up maken" tap shares at once (user activation is short-lived).
    const [b, last] = await Promise.all([exportBundle(), getSetting<string | null>(LAST_BACKUP_KEY, null)]);
    setBundle(b);
    setLastBackup(last);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function markBackedUp() {
    const at = nowIso();
    await setSetting(LAST_BACKUP_KEY, at);
    setLastBackup(at);
  }

  async function makeBackup() {
    if (!bundle || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const fresh: BackupBundle = { ...bundle, at: nowIso() };
      const json = JSON.stringify(fresh);
      const stem = `recepten-${fresh.at.slice(0, 10)}`;
      const jsonFile = new File([json], `${stem}.json`, { type: 'application/json' });
      const txtFile = new File([json], `${stem}.txt`, { type: 'text/plain' });
      const canShare = (f: File) => typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });

      // 1. .json, 2. the same bytes as .txt (Chromium refuses .json), 3. a download.
      const candidate = canShare(jsonFile) ? jsonFile : canShare(txtFile) ? txtFile : null;
      if (candidate) {
        try {
          await navigator.share({ files: [candidate] });
          await markBackedUp();
          setStatus(t('storage.backupShared'));
          return;
        } catch (e) {
          if (isAbort(e)) return;
          // fall through to the download
        }
      }
      download(jsonFile.name, jsonFile);
      await markBackedUp();
      setStatus(t('storage.backupDownloaded'));
    } catch (e) {
      setStatus(`${t('storage.backupFailed')}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File) {
    setRestoreStatus(t('storage.restoring'));
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setRestoreStatus(t('storage.readFailed'));
      return;
    }
    try {
      const result = await importBundle(parsed as BackupBundle);
      // Refresh the in-memory mirrors of what the restore may have changed (the active profile is
      // kept when this phone already had one; theme and last-backup date are never restored).
      await Promise.all([loadProfiles(), reloadCelebrateSettings()]);
      await reload();
      setRestoreStatus(t('storage.restored', { ...result }));
    } catch (e) {
      setRestoreStatus((e as Error)?.message === 'invalid-bundle' ? t('storage.invalid') : `${t('common.error')}: ${String(e)}`);
    }
  }

  const yes = t('common.yes');
  const no = t('common.no');
  const own = bundle ? bundle.userRecipes.filter((r) => r.origin.kind !== 'received').length : null;
  const received = bundle ? bundle.userRecipes.filter((r) => r.origin.kind === 'received').length : null;
  const show = (n: number | null | undefined) => (n === null || n === undefined ? '…' : String(n));

  return (
    <>
      <Header title={t('storage.title')} back backLabel={t('common.back')} />
      <div class="screen">
        <section class="card">
          <h2>{t('storage.status')}</h2>
          <dl class="counts">
            <dt>{t('storage.standalone')}</dt>
            <dd class={facts?.standalone ? 'ok' : 'warn'}>{facts ? (facts.standalone ? yes : no) : '…'}</dd>
            <dt>{t('storage.persisted')}</dt>
            <dd class={facts?.persisted ? 'ok' : 'warn'}>{facts ? (facts.persisted === null ? t('common.unknown') : facts.persisted ? yes : no) : '…'}</dd>
            {facts?.usage !== null && facts?.usage !== undefined && (
              <>
                <dt>{t('storage.usage')}</dt>
                <dd>{formatBytes(facts.usage)}</dd>
              </>
            )}
          </dl>
          <p class="muted small" style="margin:10px 0 0">
            {t('storage.persistHint')}
          </p>
        </section>

        <section class="card">
          <h2>{t('storage.counts')}</h2>
          <dl class="counts">
            <dt>{t('storage.builtins')}</dt>
            <dd>{bundled.recipes.length}</dd>
            <dt>{t('storage.ownRecipes')}</dt>
            <dd>{show(own)}</dd>
            <dt>{t('storage.received')}</dt>
            <dd>{show(received)}</dd>
            <dt>{t('storage.favorites')}</dt>
            <dd>{show(bundle?.favorites.length)}</dd>
            <dt>{t('storage.notes')}</dt>
            <dd>{show(bundle?.notes.length)}</dd>
            <dt>{t('storage.cookLog')}</dt>
            <dd>{show(bundle?.cookLog.length)}</dd>
            <dt>{t('storage.profiles')}</dt>
            <dd>{show(bundle?.profiles.length)}</dd>
          </dl>
        </section>

        <section class="card">
          <h2>{t('storage.backup')}</h2>
          <p class="muted small">{t('storage.backupHint')}</p>
          <dl class="counts">
            <dt>{t('storage.lastBackup')}</dt>
            <dd>{formatWhen(lastBackup)}</dd>
          </dl>
          <div class="actions" style="margin-bottom:0">
            <button type="button" class="btn btn-primary" disabled={!bundle || busy} onClick={() => void makeBackup()}>
              {t('storage.makeBackup')}
            </button>
          </div>
          <div class="status" role="status">
            {status}
          </div>
        </section>

        <section class="card">
          <h2>{t('storage.restore')}</h2>
          <p class="muted small">{t('storage.restoreHint')}</p>
          <input
            ref={fileInput}
            class="file-input"
            type="file"
            accept=".json,.txt,application/json,text/plain"
            tabIndex={-1}
            onChange={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              const f = input.files?.[0];
              input.value = '';
              if (f) void restore(f);
            }}
          />
          <div class="actions" style="margin-bottom:0">
            <button type="button" class="btn" onClick={() => fileInput.current?.click()}>
              {t('storage.restore')}
            </button>
          </div>
          <div class="status" role="status">
            {restoreStatus}
          </div>
        </section>
      </div>
    </>
  );
}
