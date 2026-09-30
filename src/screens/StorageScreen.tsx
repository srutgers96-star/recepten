// '#/more/storage' — status (installed, persisted, usage), counters per table, backup health
// (last backup date, changes since then, a RED line when > 30 days of unbacked-up changes),
// "Back-up maken" (navigator.share({files}) with .json, then the same bytes as .txt, then an
// <a download>), "Herstel" (<input type=file> → importBundle → counters per table) and
// "Exporteer eigen recepten" (a share bundle of own + received recipes, adjusted classics and
// own ingredients, importable on the other phone via the Inbox). Invariant 9: share ONE field.
// Phase 5 (docs/phase-5-spec.md 30-09 "Reset app"): "App resetten" with Ja / Nee / "Ja, maar
// exporteer eerst mijn recepten" (the export share first; the reset only after it succeeded).
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { reloadCelebrateSettings } from '@/celebrate';
import { Header } from '@/components/Header';
import type { BackupBundle } from '@/db/model';
import { useLive } from '@/db/live';
import { LAST_BACKUP_KEY, backupHealth, bundled, exportBundle, getBaseRecipe, importBundle, resetEverything, setSetting, weekCounts, type BackupHealth } from '@/db/repo';
import { nowIso, type Text } from '@/domain/model';
import { applyOverride } from '@/domain/overrides';
import { buildBundleEnvelope, bundleFileName } from '@/domain/share';
import type { Envelope } from '@/domain/token';
import { lang, t } from '@/i18n';
import { refreshShareBadges } from '@/inbox-badge';
import { activeProfile, loadProfiles } from '@/profile';
import { isStandalone } from '@/pwa';
import { navigate } from '@/router';
import { shareJsonFile } from '@/share-actions';

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

/** A phase-3 share bundle (`b: {recipes, patches}`) is not a backup: it belongs in the Inbox. */
function isShareBundle(parsed: unknown): boolean {
  const o = parsed as { t?: unknown; b?: unknown; userRecipes?: unknown } | null;
  return !!o && typeof o === 'object' && o.t === 'b' && !!o.b && typeof o.b === 'object' && !Array.isArray(o.userRecipes);
}

export function StorageScreen() {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [bundle, setBundle] = useState<BackupBundle | null>(null);
  const [exportEnv, setExportEnv] = useState<Envelope | null>(null);
  const [health, setHealth] = useState<BackupHealth | null>(null);
  const [status, setStatus] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restoreMore, setRestoreMore] = useState('');
  const [restoreIsShare, setRestoreIsShare] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetStatus, setResetStatus] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const by = activeProfile.value?.name ?? '';
  // Phase 4 counters (plan / list / pantry), live: a restore updates them at once.
  const week = useLive(weekCounts, []);

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
    // Pre-built so the "Back-up maken" / "Exporteer" taps share at once (user activation is short-lived).
    const [b, h] = await Promise.all([exportBundle(), backupHealth()]);
    setBundle(b);
    setHealth(h);
    const overrides = b.overrides ?? [];
    const names: Record<string, Text> = {};
    for (const o of overrides) {
      const base = await getBaseRecipe(o.baseId);
      if (base) names[o.baseId] = applyOverride(base, o).name;
    }
    const items = { recipes: b.userRecipes, patches: overrides, lineOverrides: b.lineOverrides ?? [], names };
    const opts = by ? { title: `${t('storage.ownRecipes')} · ${by}` } : {};
    const userIngredients = b.userIngredients ?? [];
    const env = buildBundleEnvelope(items, { by, userIngredients }, opts);
    // The export promises ALL own ingredients, not only the referenced ones a share carries
    // (the receiver's dictionary delta dedupes by id and skips older entries anyway).
    if (userIngredients.length) env.dict = { ing: [...userIngredients].sort((a, c) => a.id.localeCompare(c.id)) };
    setExportEnv(env);
  }, [by]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function markBackedUp() {
    const at = nowIso();
    await setSetting(LAST_BACKUP_KEY, at);
    setHealth(await backupHealth());
    void refreshShareBadges();
  }

  async function makeBackup() {
    if (!bundle || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const fresh: BackupBundle = { ...bundle, at: nowIso() };
      const stem = `recepten-${fresh.at.slice(0, 10)}`;
      // navigator.share runs before the first await inside shareJsonFile: still within the tap.
      const r = await shareJsonFile(`${stem}.json`, JSON.stringify(fresh));
      if (r.outcome === 'shared') {
        await markBackedUp();
        setStatus(t('storage.backupShared'));
      } else if (r.outcome === 'downloaded') {
        await markBackedUp();
        setStatus(t('storage.backupDownloaded'));
      } else if (r.outcome === 'failed') {
        setStatus(`${t('storage.backupFailed')}: ${r.error ?? ''}`);
      }
    } catch (e) {
      setStatus(`${t('storage.backupFailed')}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /** Own recipes + adjusted classics in the export bundle (0 = nothing to export). */
  function exportCount(env: Envelope): number {
    const b = env.b as { recipes?: unknown[]; patches?: unknown[] } | undefined;
    return (b?.recipes?.length ?? 0) + (b?.patches?.length ?? 0);
  }

  /** The export share itself (also the first step of "Ja, maar exporteer eerst"). Call within the tap. */
  function shareExport(env: Envelope) {
    const fresh: Envelope = { ...env, at: nowIso() };
    return shareJsonFile(bundleFileName(by || 'export'), JSON.stringify(fresh, null, 2));
  }

  async function exportOwn() {
    if (!exportEnv || busy) return;
    if (exportCount(exportEnv) === 0) {
      setExportStatus(t('storage.exportEmpty'));
      return;
    }
    setBusy(true);
    setExportStatus('');
    try {
      const r = await shareExport(exportEnv);
      if (r.outcome === 'shared') setExportStatus(t('storage.exportShared'));
      else if (r.outcome === 'downloaded') setExportStatus(t('storage.exportDownloaded'));
      else if (r.outcome === 'failed') setExportStatus(`${t('storage.exportFailed')}: ${r.error ?? ''}`);
    } catch (e) {
      setExportStatus(`${t('storage.exportFailed')}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /** Wipes everything and reloads to '#/' (onboarding takes over; the service worker stays). */
  async function doReset() {
    setResetStatus(t('storage.resetting'));
    await resetEverything();
    location.hash = '#/';
    location.reload();
  }

  /**
   * "App resetten" → Ja / "Ja, maar exporteer eerst mijn recepten". With `exportFirst` the
   * own-recipes export share runs first and the reset waits for its promise: only a share that
   * went through (shared or downloaded) is followed by the wipe; cancelled or failed → nothing
   * is wiped. Nothing to export → the button is disabled; should it fire anyway, the person is
   * told nothing was exported and nothing is wiped.
   */
  async function reset(exportFirst: boolean) {
    if (busy) return;
    setBusy(true);
    setResetStatus('');
    try {
      if (exportFirst) {
        if (!exportEnv || exportCount(exportEnv) === 0) {
          setResetStatus(t('storage.exportEmpty'));
          return;
        }
        setResetStatus(t('storage.resetExporting'));
        // navigator.share runs before the first await inside shareJsonFile: still within the tap.
        const r = await shareExport(exportEnv);
        if (r.outcome === 'aborted') {
          setResetStatus(t('storage.resetExportAborted'));
          return;
        }
        if (r.outcome === 'failed') {
          setResetStatus(`${t('storage.resetExportFailed')} ${r.error ?? ''}`.trim());
          return;
        }
      }
      await doReset();
    } catch (e) {
      setResetStatus(`${t('storage.resetFailed')}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File) {
    setRestoreStatus(t('storage.restoring'));
    setRestoreMore('');
    setRestoreIsShare(false);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setRestoreStatus(t('storage.readFailed'));
      return;
    }
    if (isShareBundle(parsed)) {
      setRestoreStatus(t('storage.shareBundle'));
      setRestoreIsShare(true);
      return;
    }
    try {
      const result = await importBundle(parsed as BackupBundle);
      // Refresh the in-memory mirrors of what the restore may have changed (the active profile is
      // kept when this phone already had one; theme and last-backup date are never restored).
      await Promise.all([loadProfiles(), reloadCelebrateSettings()]);
      await reload();
      void refreshShareBadges();
      setRestoreStatus(t('storage.restored', { ...result }));
      // Counted inside the restore transaction: rows a newer local row won against are not in it.
      const more = t('storage.restoredMore', { overrides: result.overrides, lineOverrides: result.lineOverrides, ingredients: result.userIngredients });
      const weekPart = (result.plans ?? 0) + (result.lists ?? 0) + (result.pantry ?? 0) > 0 ? ` · ${t('storage.restoredWeek', { plans: result.plans ?? 0, lists: result.lists ?? 0, pantry: result.pantry ?? 0 })}` : '';
      setRestoreMore(more + weekPart);
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
            <dt>{t('storage.overrides')}</dt>
            <dd>{show(bundle?.overrides?.length ?? (bundle ? 0 : null))}</dd>
            <dt>{t('storage.lineOverrides')}</dt>
            <dd>{show(bundle?.lineOverrides?.length ?? (bundle ? 0 : null))}</dd>
            <dt>{t('storage.ingredients')}</dt>
            <dd>{show(bundle?.userIngredients?.length ?? (bundle ? 0 : null))}</dd>
            <dt>{t('storage.favorites')}</dt>
            <dd>{show(bundle?.favorites.length)}</dd>
            <dt>{t('storage.notes')}</dt>
            <dd>{show(bundle?.notes.length)}</dd>
            <dt>{t('storage.cookLog')}</dt>
            <dd>{show(bundle?.cookLog.length)}</dd>
            <dt>{t('storage.profiles')}</dt>
            <dd>{show(bundle?.profiles.length)}</dd>
            <dt>{t('storage.plan')}</dt>
            <dd>{show(week?.plan)}</dd>
            <dt>{t('storage.list')}</dt>
            <dd>{show(week?.list)}</dd>
            <dt>{t('storage.pantry')}</dt>
            <dd>{show(week?.pantry)}</dd>
          </dl>
        </section>

        <section class={'card' + (health?.overdue ? ' backup-overdue' : '')}>
          <h2>{t('storage.backup')}</h2>
          <p class="muted small">{t('storage.backupHint')}</p>
          <dl class="counts">
            <dt>{t('storage.lastBackup')}</dt>
            <dd>{health ? formatWhen(health.lastBackupAt) : '…'}</dd>
            <dt>{t('storage.unbacked')}</dt>
            <dd class={health && health.unbackedChanges > 0 ? 'warn' : 'ok'}>{health ? t('storage.changes', { n: health.unbackedChanges }) : '…'}</dd>
          </dl>
          {health && health.overdue && (
            <p class="bad backup-overdue-line" role="alert">
              {t(health.lastBackupAt ? 'storage.overdue' : 'storage.overdueNever', { n: health.unbackedChanges })}
            </p>
          )}
          {health && !health.overdue && health.unbackedChanges === 0 && <p class="ok small">{t('storage.upToDate')}</p>}
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
            {restoreIsShare && (
              <button type="button" class="btn btn-primary" onClick={() => navigate('/inbox')}>
                {t('storage.goInbox')}
              </button>
            )}
          </div>
          <div class="status" role="status">
            {restoreStatus}
            {restoreMore && <span class="restore-more">{restoreMore}</span>}
          </div>
        </section>

        <section class="card">
          <h2>{t('storage.export')}</h2>
          <p class="muted small">{t('storage.exportHint')}</p>
          <div class="actions" style="margin-bottom:0">
            <button type="button" class="btn" disabled={!exportEnv || busy} onClick={() => void exportOwn()}>
              {t('storage.export')}
            </button>
          </div>
          <div class="status" role="status">
            {exportStatus}
          </div>
        </section>

        <section class={'card' + (confirmReset ? ' reset-card' : '')}>
          <h2>{t('storage.reset')}</h2>
          <p class="muted small">{t('storage.resetHint')}</p>
          {confirmReset ? (
            <div class="confirm" role="alertdialog" aria-label={t('storage.reset')}>
              <p>{t('storage.resetConfirm')}</p>
              <div class="actions">
                <button type="button" class="btn btn-primary btn-danger" disabled={busy} onClick={() => void reset(false)}>
                  {t('storage.resetYes')}
                </button>
                <button type="button" class="btn" disabled={busy} onClick={() => setConfirmReset(false)}>
                  {t('storage.resetNo')}
                </button>
                <button type="button" class="btn btn-secondary" disabled={busy || !exportEnv || exportCount(exportEnv) === 0} onClick={() => void reset(true)}>
                  {t('storage.resetExportFirst')}
                </button>
              </div>
              <p class="muted small">{exportEnv && exportCount(exportEnv) === 0 ? t('storage.exportEmpty') : t('storage.resetHistoryHint')}</p>
            </div>
          ) : (
            <div class="actions" style="margin-bottom:0">
              <button type="button" class="btn btn-danger" disabled={busy} onClick={() => setConfirmReset(true)}>
                {t('storage.reset')}
              </button>
            </div>
          )}
          <div class="status" role="status">
            {resetStatus}
          </div>
        </section>
      </div>
    </>
  );
}
