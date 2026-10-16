// '#/more/storage' — status (installed, persisted, usage), counters per table, and two clearly
// named blocks (phase 6, docs/phase-6-spec.md 13G — "knoppen zeggen wat ze doen"):
//   1. "Back-up voor mezelf": ONE file with everything on this phone (own + received recipes,
//      favourites, notes, cook log, profiles, week plan; photos optional via the "Met foto's"
//      toggle) with backup health (last backup date, changes since then, a RED line when > 30
//      days of unbacked-up changes). "Terugzetten" (Herstel: <input type=file> → importBundle →
//      counters per table) sits inside this block, since it is the way back.
//   2. "Mijn recepten aan iemand geven": a share bundle of own + received recipes, adjusted
//      classics and own ingredients; the other phone imports it through the paste box (In & uit).
// Each block has one primary button "Bewaar of deel" that opens a small choice sheet (the same
// .sheet-* / .add-menu-row shell as the "+" menu of Recipes): "Delen" (share sheet: WhatsApp to
// yourself, Drive, Files; falls back to a download) or "Download" (straight to Downloads, after
// which the status says "Opgeslagen als <naam> in Downloads"), one sentence of explanation each.
// Both bundles are pre-built so navigator.share still runs inside the tap on a choice row
// (invariant 9: share ONE field; user activation is short-lived). Honest per phone (invariant
// 13): on Android a download lands in Downloads (verified, A-bis.9); on the iPhone Safari asks
// first and the file should turn up in Files → Downloads, so the hint and the status say so.
// Nothing to give yet (no own recipes or adjustments) → the give-away says so up front and its
// button is disabled; the backup is always possible.
// Phase 5 (docs/phase-5-spec.md 30-09 "Reset app"): "App resetten" with Ja / Nee / "Ja, maar
// deel eerst mijn recepten" (the give-away share first; the reset only after it succeeded).
// Phase 5 block D: the with-photos bundle is built ahead of the tap (default OFF — photos make
// the file many times larger; the hint shows the real size once it is packed). A restore reports
// how many photos came back (same recipeId+at = already here, not re-added).
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { reloadBadgeSettings } from '@/badges';
import { reloadCelebrateSettings } from '@/celebrate';
import { isIOS } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import type { BackupBundle } from '@/db/model';
import { useLive } from '@/db/live';
import { LAST_BACKUP_KEY, backupHealth, bundled, countPhotos, exportBundle, getBaseRecipe, importBundle, logShareEvent, resetEverything, setSetting, weekCounts, type BackupHealth } from '@/db/repo';
import { nowIso, type Text } from '@/domain/model';
import { applyOverride } from '@/domain/overrides';
import { buildBundleEnvelope, bundleFileName } from '@/domain/share';
import type { Envelope } from '@/domain/token';
import { lang, t } from '@/i18n';
import { refreshShareBadges } from '@/inbox-badge';
import { activeProfile, loadProfiles } from '@/profile';
import { isStandalone } from '@/pwa';
import { navigate } from '@/router';
import { downloadBlob, shareJsonFile } from '@/share-actions';
import { reloadSoundSettings } from '@/sounds';
import { reloadSpeechSettings } from '@/speech';
import { reloadShowAmounts } from '@/step-amounts';
import { reloadVoiceSettings } from '@/voice';

interface Facts {
  standalone: boolean;
  persisted: boolean | null;
  usage: number | null;
}

/** Which "Bewaar of deel" choice sheet is open: the backup's or the give-away's. */
type Menu = 'backup' | 'give' | null;

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

/** "Download": the plain <a download> straight away (no share sheet), same result shape as shareJsonFile. */
function downloadJson(name: string, json: string): { outcome: 'downloaded' | 'failed'; name: string; error?: string } {
  try {
    downloadBlob(name, new Blob([json], { type: 'application/json' }));
    return { outcome: 'downloaded', name };
  } catch (e) {
    return { outcome: 'failed', name, error: String(e) };
  }
}

/** The backup file name for today (the same stem makeBackup() uses, so the sheet shows the real name). */
function backupFileName(): string {
  return `recepten-${nowIso().slice(0, 10)}.json`;
}

/** After a download: where the file went, honest per phone (Android: Downloads; iPhone: Files → Downloads, if accepted). */
function savedLine(name: string): string {
  return isIOS() ? t('storage.savedDownloadsIos', { name }) : t('storage.savedDownloads', { name });
}

export function StorageScreen() {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [bundle, setBundle] = useState<BackupBundle | null>(null);
  const [bundleBytes, setBundleBytes] = useState<number | null>(null);
  const [exportEnv, setExportEnv] = useState<Envelope | null>(null);
  const [exportBytes, setExportBytes] = useState<number | null>(null);
  const [health, setHealth] = useState<BackupHealth | null>(null);
  const [status, setStatus] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restoreMore, setRestoreMore] = useState('');
  const [restoreIsShare, setRestoreIsShare] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetStatus, setResetStatus] = useState('');
  // 13G: the "Bewaar of deel" choice sheet (Delen / Download) of one of the two blocks.
  const [menu, setMenu] = useState<Menu>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const by = activeProfile.value?.name ?? '';
  // Phase 4 counters (plan / list / pantry), live: a restore updates them at once.
  const week = useLive(weekCounts, []);
  // Phase 5 block D: "Met foto's" on the backup (default off) + the live photo counter.
  const [withPhotos, setWithPhotos] = useState(false);
  const [photoBundle, setPhotoBundle] = useState<{ bundle: BackupBundle; bytes: number } | null>(null);
  const photoCount = useLive(countPhotos, []);
  // Bumped by reload() so the with-photos bundle is rebuilt after a restore even when the photo
  // count did not change (a restore may add recipes/notes/cook log without new photos).
  const [reloadTick, setReloadTick] = useState(0);

  // Pre-built like the photo-less bundle: the share tap must not wait for base64 encoding, or
  // navigator.share would run outside the user gesture. Rebuilt when the photo set changes
  // (a restore adds photos live through the countPhotos liveQuery) and on every reload().
  useEffect(() => {
    if (!withPhotos) {
      setPhotoBundle(null);
      return;
    }
    let gone = false;
    setPhotoBundle(null);
    void exportBundle({ withPhotos: true })
      .then((b) => {
        if (!gone) setPhotoBundle({ bundle: b, bytes: new Blob([JSON.stringify(b)]).size });
      })
      .catch((e: unknown) => console.error('exportBundle withPhotos', e));
    return () => {
      gone = true;
    };
  }, [withPhotos, photoCount, reloadTick]);

  // Escape closes the choice sheet (the backdrop tap and the × do the same).
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const reload = useCallback(async () => {
    setReloadTick((n) => n + 1);
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
    // Pre-built so a choice in the "Bewaar of deel" sheet shares at once (user activation is short-lived).
    const [b, h] = await Promise.all([exportBundle(), backupHealth()]);
    setBundle(b);
    // The size shown in the sheet (photo-less; the with-photos size comes from photoBundle).
    setBundleBytes(new Blob([JSON.stringify(b)]).size);
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
    // The give-away promises ALL own ingredients, not only the referenced ones a share carries
    // (the receiver's dictionary delta dedupes by id and skips older entries anyway).
    if (userIngredients.length) env.dict = { ing: [...userIngredients].sort((a, c) => a.id.localeCompare(c.id)) };
    setExportEnv(env);
    setExportBytes(new Blob([JSON.stringify(env, null, 2)]).size);
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

  /** "Delen" (share sheet, download as the fallback) or "Download" (straight to Downloads). */
  async function makeBackup(how: 'share' | 'download') {
    // With the toggle on, the pre-built with-photos bundle is shared (the button stays disabled
    // while it is still being packed); the normal path stays photo-less.
    const source = withPhotos ? photoBundle?.bundle : bundle;
    if (!source || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const fresh: BackupBundle = { ...source, at: nowIso() };
      const name = backupFileName();
      const json = JSON.stringify(fresh);
      // navigator.share runs before the first await inside shareJsonFile: still within the tap.
      const r = how === 'share' ? await shareJsonFile(name, json) : downloadJson(name, json);
      if (r.outcome === 'shared') {
        await markBackedUp();
        setStatus(t('storage.backupShared'));
      } else if (r.outcome === 'downloaded') {
        await markBackedUp();
        setStatus(savedLine(r.name));
      } else if (r.outcome === 'failed') {
        setStatus(`${t('storage.backupFailed')}: ${r.error ?? ''}`);
      }
    } catch (e) {
      setStatus(`${t('storage.backupFailed')}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /** Own recipes + adjusted classics in the give-away bundle (0 = nothing to give). */
  function exportCount(env: Envelope): number {
    const b = env.b as { recipes?: unknown[]; patches?: unknown[] } | undefined;
    return (b?.recipes?.length ?? 0) + (b?.patches?.length ?? 0);
  }

  /** The recipe ids in the give-away bundle (adjusted classics by their own id) for the "In & uit" log. */
  function exportIds(env: Envelope): string[] {
    const b = env.b as { recipes?: Array<{ id?: unknown }>; patches?: Array<{ baseId?: unknown }> } | undefined;
    return [...(b?.recipes ?? []).map((r) => r.id), ...(b?.patches ?? []).map((p) => p.baseId)].filter((id): id is string => typeof id === 'string' && id !== '');
  }

  /** 13A-2: the give-away went out (share sheet 'shared', or the file landed in Downloads) — one 'bundle' row, like Recepten → Selecteer → Exporteer. */
  function logExportShared(env: Envelope) {
    void logShareEvent({ at: nowIso(), direction: 'out', kind: 'bundle', who: null, count: exportCount(env), recipeIds: exportIds(env) }).catch((e: unknown) => console.error('logShareEvent', e));
  }

  /** The give-away share itself (also the first step of "Ja, maar deel eerst mijn recepten"). Call within the tap. */
  function shareExport(env: Envelope, how: 'share' | 'download' = 'share') {
    const fresh: Envelope = { ...env, at: nowIso() };
    const name = bundleFileName(by || 'export');
    const json = JSON.stringify(fresh, null, 2);
    return how === 'share' ? shareJsonFile(name, json) : Promise.resolve(downloadJson(name, json));
  }

  async function exportOwn(how: 'share' | 'download') {
    if (!exportEnv || busy) return;
    if (exportCount(exportEnv) === 0) {
      setExportStatus(t('storage.exportEmpty'));
      return;
    }
    setBusy(true);
    setExportStatus('');
    try {
      const r = await shareExport(exportEnv, how);
      if (r.outcome === 'shared') {
        logExportShared(exportEnv);
        setExportStatus(t('storage.giveShared'));
      } else if (r.outcome === 'downloaded') {
        logExportShared(exportEnv);
        setExportStatus(savedLine(r.name));
      } else if (r.outcome === 'failed') setExportStatus(`${t('storage.exportFailed')}: ${r.error ?? ''}`);
    } catch (e) {
      setExportStatus(`${t('storage.exportFailed')}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /** "Bewaar of deel" tapped: open the choice sheet of that block (nothing to give → say so, no sheet). */
  function openMenu(which: Exclude<Menu, null>) {
    if (busy) return;
    if (which === 'give') {
      if (!exportEnv) return;
      if (exportCount(exportEnv) === 0) {
        setExportStatus(t('storage.exportEmpty'));
        return;
      }
    }
    setMenu(which);
  }

  /**
   * A row in the choice sheet. The sheet closes and the action runs in the SAME click handler,
   * so navigator.share (inside shareJsonFile, before its first await) still sits in the tap.
   */
  function choose(how: 'share' | 'download') {
    const which = menu;
    setMenu(null);
    if (which === 'backup') void makeBackup(how);
    else if (which === 'give') void exportOwn(how);
  }

  /** Wipes everything and reloads to '#/' (onboarding takes over; the service worker stays). */
  async function doReset() {
    setResetStatus(t('storage.resetting'));
    await resetEverything();
    location.hash = '#/';
    location.reload();
  }

  /**
   * "App resetten" → Ja / "Ja, maar deel eerst mijn recepten". With `exportFirst` the
   * give-away share runs first and the reset waits for its promise: only a share that
   * went through (shared or downloaded) is followed by the wipe; cancelled or failed → nothing
   * is wiped. Nothing to share → the button is disabled; should it fire anyway, the person is
   * told nothing was shared and nothing is wiped.
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
      // Refresh the in-memory mirrors of what the restore may have changed: profiles, confetti,
      // timer sound/vibrate, read-aloud, voice commands, "Toon hoeveelheden" and badges (the active profile is kept
      // when this phone already had one; theme and last-backup date are never restored).
      await Promise.all([loadProfiles(), reloadCelebrateSettings(), reloadSoundSettings(), reloadSpeechSettings(), reloadVoiceSettings(), reloadShowAmounts(), reloadBadgeSettings()]);
      await reload();
      void refreshShareBadges();
      setRestoreStatus(t('storage.restored', { ...result }));
      // Counted inside the restore transaction: rows a newer local row won against are not in it.
      const more = t('storage.restoredMore', { overrides: result.overrides, lineOverrides: result.lineOverrides, ingredients: result.userIngredients });
      const weekPart = (result.plans ?? 0) + (result.lists ?? 0) + (result.pantry ?? 0) > 0 ? ` · ${t('storage.restoredWeek', { plans: result.plans ?? 0, lists: result.lists ?? 0, pantry: result.pantry ?? 0 })}` : '';
      const photosPart = (result.photos ?? 0) > 0 ? ` · ${result.photos === 1 ? t('storage.restoredPhotosOne') : t('storage.restoredPhotos', { n: result.photos ?? 0 })}` : '';
      setRestoreMore(more + weekPart + photosPart);
    } catch (e) {
      setRestoreStatus((e as Error)?.message === 'invalid-bundle' ? t('storage.invalid') : `${t('common.error')}: ${String(e)}`);
    }
  }

  const yes = t('common.yes');
  const no = t('common.no');
  const own = bundle ? bundle.userRecipes.filter((r) => r.origin.kind !== 'received').length : null;
  const received = bundle ? bundle.userRecipes.filter((r) => r.origin.kind === 'received').length : null;
  const show = (n: number | null | undefined) => (n === null || n === undefined ? '…' : String(n));
  const backupReady = !!bundle && !busy && !(withPhotos && !photoBundle);
  // Nothing to give yet: said up front under the sentence, and the button stays disabled.
  const giveEmpty = !!exportEnv && exportCount(exportEnv) === 0;
  const giveReady = !!exportEnv && !busy && !giveEmpty;

  // What the open sheet is about: its title and the file it will save or share (name + size).
  const menuTitle = menu === 'backup' ? t('storage.backupTitle') : menu === 'give' ? t('storage.giveTitle') : '';
  const menuFile =
    menu === 'backup'
      ? { name: backupFileName(), bytes: withPhotos ? (photoBundle?.bytes ?? null) : bundleBytes }
      : menu === 'give'
        ? { name: bundleFileName(by || 'export'), bytes: exportBytes }
        : null;
  // Honest per phone (invariant 13): Android lands the file in Downloads (verified, A-bis.9); on the
  // iPhone the phone asks first and the file should appear in Files → Downloads (DEVICE-TEST verifies).
  const downloadHint = isIOS() ? t('storage.chooseDownloadHintIos') : t('storage.chooseDownloadHint');

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
            <dt>{t('storage.photos')}</dt>
            <dd>{show(photoCount)}</dd>
          </dl>
        </section>

        {/* Block 1 — "Back-up voor mezelf": everything, for this phone (or a new one) via Herstel. */}
        <section class={'card storage-block' + (health?.overdue ? ' backup-overdue' : '')}>
          <h2>{t('storage.backupTitle')}</h2>
          <p class="muted small">{t('storage.backupWhat')}</p>
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
          <label class="setting backup-photos">
            <div class="label">
              {t('storage.withPhotos')}
              <small>
                {photoCount === undefined
                  ? '…'
                  : photoCount === 0
                    ? t('storage.withPhotosNone')
                    : withPhotos
                      ? photoBundle
                        ? photoCount === 1
                          ? t('storage.withPhotosSizeOne', { size: formatBytes(photoBundle.bytes) })
                          : t('storage.withPhotosSize', { n: photoCount, size: formatBytes(photoBundle.bytes) })
                        : t('storage.withPhotosBuilding')
                      : photoCount === 1
                        ? t('storage.withPhotosHintOne')
                        : t('storage.withPhotosHint', { n: photoCount })}
              </small>
            </div>
            <span class="switch">
              <input
                type="checkbox"
                checked={withPhotos}
                disabled={busy || !photoCount}
                onChange={(e) => setWithPhotos((e.currentTarget as HTMLInputElement).checked)}
              />
              <span class="track" />
            </span>
          </label>
          <div class="actions" style="margin-bottom:0">
            <button type="button" class="btn btn-primary" aria-haspopup="dialog" disabled={!backupReady} onClick={() => openMenu('backup')}>
              {t('storage.saveOrShare')}
            </button>
          </div>
          <div class="status" role="status">
            {status}
          </div>

          {/* The way back: Herstel, one sentence, inside the backup block. */}
          <div class="storage-sub">
            <h3>{t('storage.restoreTitle')}</h3>
            <p class="muted small">{t('storage.restoreWhat')}</p>
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
              <button type="button" class="btn" disabled={busy} onClick={() => fileInput.current?.click()}>
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
          </div>
        </section>

        {/* Block 2 — "Mijn recepten aan iemand geven": only recipes and adjustments, for another phone. */}
        <section class="card storage-block">
          <h2>{t('storage.giveTitle')}</h2>
          <p class="muted small">{t('storage.giveWhat')}</p>
          {giveEmpty && <p class="muted small storage-empty">{t('storage.exportEmpty')}</p>}
          <div class="actions" style="margin-bottom:0">
            <button type="button" class="btn btn-primary" aria-haspopup="dialog" disabled={!giveReady} onClick={() => openMenu('give')}>
              {t('storage.saveOrShare')}
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

      {/* 13G: the "Bewaar of deel" choice — Delen / Download, one sentence each; same shell as the "+" menu. */}
      {menu && menuFile && (
        <div class="sheet-backdrop" onClick={() => setMenu(null)}>
          <div class="sheet" role="dialog" aria-modal="true" aria-label={menuTitle} onClick={(e) => e.stopPropagation()}>
            <div class="sheet-head">
              <h2>{menuTitle}</h2>
              <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={() => setMenu(null)}>
                ×
              </button>
            </div>
            <div class="sheet-body add-menu save-menu">
              <p class="muted small save-menu-file">
                {menuFile.bytes === null ? t('storage.fileLineNoSize', { name: menuFile.name }) : t('storage.fileLine', { name: menuFile.name, size: formatBytes(menuFile.bytes) })}
              </p>
              <button type="button" class="add-menu-row" onClick={() => choose('share')}>
                <strong>{t('storage.chooseShare')}</strong>
                <span class="muted small">{t('storage.chooseShareHint')}</span>
              </button>
              <button type="button" class="add-menu-row" onClick={() => choose('download')}>
                <strong>{t('storage.download')}</strong>
                <span class="muted small">{downloadHint}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
