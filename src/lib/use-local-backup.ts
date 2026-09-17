import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BACKUP_TABLES,
  appendRows,
  downloadBackupZip,
  getMeta,
  getSavedDirHandle,
  isFileSystemAccessSupported,
  pickAndSaveDir,
  clearSavedDir,
  safeFolderName,
  setMeta,
  verifyPermission,
  pickRestoreDir,
  readBackupFiles,
  type BackupProgress,
} from "@/lib/local-backup";

type Status = "unsupported" | "disconnected" | "needs-permission" | "connected";

export function useLocalBackup(companyId: string | null, companyName: string | null) {
  const [status, setStatus] = useState<Status>(
    isFileSystemAccessSupported() ? "disconnected" : "unsupported",
  );
  const [folderName, setFolderName] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const timerRef = useRef<number | null>(null);

  // On mount, try to restore saved handle
  useEffect(() => {
    if (!isFileSystemAccessSupported()) return;
    (async () => {
      const h = await getSavedDirHandle();
      if (!h) return;
      handleRef.current = h;
      setFolderName(h.name);
      const ok = await verifyPermission(h, false);
      setStatus(ok ? "connected" : "needs-permission");
    })();
  }, []);

  const runSync = useCallback(async () => {
    const h = handleRef.current;
    if (!h || !companyId) return;
    setSyncing(true);
    setError(null);
    try {
      const ok = await verifyPermission(h, false);
      if (!ok) {
        setStatus("needs-permission");
        return;
      }
      const meta = await getMeta();
      const folder =
        meta.companyFolder || `BinoSoz-${safeFolderName(companyName ?? companyId.slice(0, 8))}`;
      const lastMap = { ...meta.lastSyncByTable };
      let totalNew = 0;

      for (const table of BACKUP_TABLES) {
        const since = lastMap[table] ?? "1970-01-01T00:00:00Z";
        const { data, error: qErr } = await (supabase as any).rpc("export_backup_rows", {
          _table: table,
          _since: since,
          _company_id: companyId,
        });
        if (qErr) {
          console.error(`[backup] ${table}:`, qErr.message);
          continue;
        }
        const rows = (data ?? []) as Array<Record<string, unknown>>;
        if (rows.length === 0) continue;
        await appendRows(h, folder, table, rows);
        const latest = rows
          .map((row) => {
            const created = typeof row.created_at === "string" ? row.created_at : "";
            const updated = typeof row.updated_at === "string" ? row.updated_at : "";
            return updated > created ? updated : created;
          })
          .sort()
          .pop();
        if (latest) {
          lastMap[table] = latest;
        }
        totalNew += rows.length;
      }

      await setMeta({ lastSyncByTable: lastMap, companyFolder: folder });
      setLastSync(new Date());
      if (totalNew > 0) {
        console.info(`[backup] ${totalNew} row(s) appended to ${folder}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, [companyId, companyName]);

  // Auto-sync every 10s while connected + on focus/visibility change,
  // so new apartments, sales, clients, expenses appear in the folder almost
  // immediately after the user adds them.
  useEffect(() => {
    if (status !== "connected" || !companyId) return;
    runSync();
    timerRef.current = window.setInterval(runSync, 10_000);
    const onFocus = () => runSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") runSync();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, companyId, runSync]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      const h = await pickAndSaveDir();
      handleRef.current = h;
      setFolderName(h.name);
      setStatus("connected");
      // seed companyFolder in meta
      const meta = await getMeta();
      if (!meta.companyFolder && companyName) {
        await setMeta({
          ...meta,
          companyFolder: `BinoSoz-${safeFolderName(companyName)}`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/AbortError|aborted/i.test(msg)) setError(msg);
    }
  }, [companyName]);

  const grantPermission = useCallback(async () => {
    const h = handleRef.current;
    if (!h) return;
    const ok = await verifyPermission(h, true);
    setStatus(ok ? "connected" : "needs-permission");
  }, []);

  const disconnect = useCallback(async () => {
    await clearSavedDir();
    handleRef.current = null;
    setFolderName(null);
    setLastSync(null);
    setStatus("disconnected");
  }, []);

  const [restoring, setRestoring] = useState(false);
  const [restoreReport, setRestoreReport] = useState<{
    inserted: Record<string, number>;
    skipped: Record<string, number>;
  } | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<BackupProgress | null>(null);

  const downloadZip = useCallback(async () => {
    if (!companyId) return;
    setDownloading(true);
    setDownloadProgress(null);
    setError(null);
    try {
      await downloadBackupZip(companyId, companyName ?? null, supabase, (p) =>
        setDownloadProgress(p),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  }, [companyId, companyName]);

  const restoreFromFolder = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    setRestoreReport(null);
    try {
      const dir = await pickRestoreDir();
      setRestoring(true);
      const fileMap = await readBackupFiles(dir);

      const inserted: Record<string, number> = {};
      const skipped: Record<string, number> = {};

      for (const table of BACKUP_TABLES) {
        const rows = fileMap[table];
        if (!rows || rows.length === 0) continue;
        // Use server-side restore RPC (bypasses RLS, dedupes by id).
        const CHUNK = 500;
        let ok = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { data: n, error: upErr } = await (supabase as any).rpc("restore_backup_rows", {
            _table: table,
            _rows: chunk,
            _company_id: companyId,
          });
          if (upErr) {
            console.error(`[restore] ${table}:`, upErr.message);
            skipped[table] = (skipped[table] ?? 0) + chunk.length;
          } else {
            ok += (n as number) ?? 0;
          }
        }
        inserted[table] = ok;
      }

      setRestoreReport({ inserted, skipped });
      // Refresh lastSync map so we don't re-append restored rows.
      const meta = await getMeta();
      const lastMap = { ...meta.lastSyncByTable };
      for (const table of BACKUP_TABLES) {
        const rows = fileMap[table];
        if (!rows || rows.length === 0) continue;
        const maxTs = rows
          .map((r) => {
            const created = typeof r.created_at === "string" ? r.created_at : "";
            const updated = typeof r.updated_at === "string" ? r.updated_at : "";
            return updated > created ? updated : created;
          })
          .sort()
          .pop();
        if (maxTs && (!lastMap[table] || maxTs > lastMap[table])) {
          lastMap[table] = maxTs;
        }
      }
      await setMeta({ ...meta, lastSyncByTable: lastMap });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/AbortError|aborted/i.test(msg)) setError(msg);
    } finally {
      setRestoring(false);
    }
  }, [companyId]);

  return {
    status,
    folderName,
    lastSync,
    syncing,
    error,
    connect,
    disconnect,
    grantPermission,
    syncNow: runSync,
    restoreFromFolder,
    restoring,
    restoreReport,
    downloadZip,
    downloading,
    downloadProgress,
  };
}
