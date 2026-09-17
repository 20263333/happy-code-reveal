// Local backup via File System Access API OR downloadable ZIP.
// The owner picks a folder once (C:/, D:/, USB…), we store the DirectoryHandle
// in IndexedDB, then auto-append new rows to .jsonl files in that folder.
//
// Files created inside the folder:
//   {company}/{menu-section}/{table}.jsonl
//
// Each row is one JSON object per line (append-only, no duplicates —
// filtered by created_at > last_synced_at per table).
//
// Browsers that do not support showDirectoryPicker (Firefox, Safari, mobile,
// tablet) can still download the same data as a single ZIP file.

import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const DB_NAME = "binosoz-backup";
const STORE = "handles";
const HANDLE_KEY = "root-dir";
const META_KEY = "meta"; // { lastSyncByTable: Record<string,string>, companyFolder: string }

export type BackupMeta = {
  lastSyncByTable: Record<string, string>;
  companyFolder: string;
};

export const BACKUP_TABLES = [
  "projects",
  "customers",
  "contract_templates",
  "floors",
  "apartments",
  "customer_documents",
  "customer_interactions",
  "sales",
  "payment_schedule",
  "payments",
  "expenses",
  "payables",
  "payable_payments",
  "suppliers",
  "warehouse_items",
  "warehouse_receipts",
  "warehouse_issues",
  "materials",
  "material_movements",
  "workers",
  "attendance",
  "worker_payments",
  "subcontractors",
  "subcontract_works",
  "subcontract_acts",
  "subcontract_payments",
  "equipment",
  "equipment_usage",
  "equipment_maintenance",
  "project_budgets",
  "estimates",
  "estimate_items",
  "estimate_documents",
  "resettlements",
  "barter_deals",
  "project_stages",
  "stage_updates",
  "quality_checks",
  "hidden_work_acts",
  "site_incidents",
  "permits",
  "tax_reports",
  "company_directors",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * Map each backup table to a human-readable subfolder inside the company
 * root, so files are grouped by app section (Продажаҳо, Расходҳо, …).
 */
export const TABLE_SECTION: Record<BackupTable, string> = {
  projects: "Проекты",
  floors: "Проекты",
  apartments: "Проекты",
  project_budgets: "Проекты",
  project_stages: "Проекты",
  stage_updates: "Проекты",
  sales: "Продажаҳо",
  payment_schedule: "Продажаҳо",
  customers: "Клиентҳо",
  customer_documents: "Клиентҳо",
  customer_interactions: "Клиентҳо",
  contract_templates: "Договор",
  payments: "Пардохтҳо",
  expenses: "Расходҳо",
  payables: "Қарзҳо",
  payable_payments: "Қарзҳо",
  suppliers: "Поставщики",
  warehouse_items: "Склад",
  warehouse_receipts: "Склад",
  warehouse_issues: "Склад",
  materials: "Склад",
  material_movements: "Склад",
  workers: "Табел",
  attendance: "Табел",
  worker_payments: "Маош",
  subcontractors: "Пудратчиён",
  subcontract_works: "Пудратчиён",
  subcontract_acts: "Пудратчиён",
  subcontract_payments: "Пудратчиён",
  equipment: "Техника",
  equipment_usage: "Техника",
  equipment_maintenance: "Техника",
  estimates: "Смета",
  estimate_items: "Смета",
  estimate_documents: "Смета",
  resettlements: "Переселение",
  barter_deals: "Бартер",
  quality_checks: "Сифат ва Бехатарӣ",
  hidden_work_acts: "Сифат ва Бехатарӣ",
  site_incidents: "Сифат ва Бехатарӣ",
  permits: "Иҷозатномаҳо",
  tax_reports: "Ҳисоботи давлатӣ",
  company_directors: "Директорҳо",
};

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// ---------- IndexedDB (minimal wrapper) ----------
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Handle & permission ----------
export async function getSavedDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const h = await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY);
    return h ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask the user to pick a folder (C:/, D:/, USB…). We store the handle so
 * subsequent sessions don't need re-picking (but the browser may re-prompt
 * for permission after a restart).
 */
export async function pickAndSaveDir(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error("File System Access API дар ин браузер дастрас нест");
  }
  // @ts-expect-error non-standard options accepted by Chromium
  const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    mode: "readwrite",
    startIn: "documents",
    id: "binosoz-backup",
  });
  await idbSet(HANDLE_KEY, handle);
  return handle;
}

export async function clearSavedDir(): Promise<void> {
  await idbDel(HANDLE_KEY);
  await idbDel(META_KEY);
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  withPrompt = false,
): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  const h = handle as unknown as {
    queryPermission: (o: typeof opts) => Promise<PermissionState>;
    requestPermission: (o: typeof opts) => Promise<PermissionState>;
  };
  const q = await h.queryPermission(opts);
  if (q === "granted") return true;
  if (!withPrompt) return false;
  const r = await h.requestPermission(opts);
  return r === "granted";
}

// ---------- Meta ----------
export async function getMeta(): Promise<BackupMeta> {
  const m = await idbGet<BackupMeta>(META_KEY);
  return m ?? { lastSyncByTable: {}, companyFolder: "" };
}

export async function setMeta(meta: BackupMeta): Promise<void> {
  await idbSet(META_KEY, meta);
}

// ---------- File ops ----------
async function getOrCreateSubdir(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return await root.getDirectoryHandle(name, { create: true });
}

/**
 * Append rows to `{companyFolder}/{section}/{table}.jsonl`.
 * Each app section (Продажаҳо, Расходҳо, Склад…) gets its own subfolder,
 * so files are grouped by module, not dumped flat.
 */
export async function appendRows(
  root: FileSystemDirectoryHandle,
  companyFolder: string,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const companyDir = await getOrCreateSubdir(root, companyFolder);
  const section = TABLE_SECTION[table as BackupTable] ?? "Дигар";
  const sectionDir = await getOrCreateSubdir(companyDir, section);
  const fileHandle = await sectionDir.getFileHandle(`${table}.jsonl`, { create: true });

  // Merge by id, so changed records update the local file instead of creating
  // duplicate lines on every sync.
  const file = await fileHandle.getFile();
  const existing = await file.text();
  const merged = new Map<string, Record<string, unknown>>();

  for (const line of existing.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    try {
      const parsed = JSON.parse(l) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : l;
      merged.set(id, parsed);
    } catch {
      // skip corrupt line
    }
  }

  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : JSON.stringify(row);
    merged.set(id, row);
  }

  const writable = await fileHandle.createWritable();
  try {
    const chunk =
      Array.from(merged.values())
        .map((r) => JSON.stringify(r))
        .join("\n") + "\n";
    await writable.write(chunk);
  } finally {
    await writable.close();
  }
}

/** Sanitize a company name into a safe folder name. */
export function safeFolderName(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "company"
  );
}

/**
 * Ask user to pick a backup folder (one-time for restore). We do NOT save
 * the handle — restore is a manual, one-off operation.
 */
export async function pickRestoreDir(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error("File System Access API дар ин браузер дастрас нест");
  }
  // @ts-expect-error non-standard options accepted by Chromium
  return await window.showDirectoryPicker({
    mode: "read",
    startIn: "documents",
    id: "binosoz-restore",
  });
}

/**
 * Read all `.jsonl` files under the picked root. Returns a map of
 * table -> rows. Looks for files both at the root AND inside any single
 * company subfolder (BinoSoz-*), so the user can pick either level.
 */
export async function readBackupFiles(
  root: FileSystemDirectoryHandle,
): Promise<Record<string, Record<string, unknown>[]>> {
  const result: Record<string, Record<string, unknown>[]> = {};

  const walk = async (dir: FileSystemDirectoryHandle) => {
    const entries = (
      dir as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }
    ).entries();
    for await (const [name, entry] of entries) {
      if (entry.kind === "file" && name.endsWith(".jsonl")) {
        const table = name.replace(/\.jsonl$/, "");
        const file = await (entry as FileSystemFileHandle).getFile();
        const text = await file.text();
        const rows: Record<string, unknown>[] = [];
        for (const line of text.split("\n")) {
          const l = line.trim();
          if (!l) continue;
          try {
            rows.push(JSON.parse(l));
          } catch {
            // skip corrupt line
          }
        }
        if (rows.length > 0) {
          result[table] = (result[table] ?? []).concat(rows);
        }
      } else if (entry.kind === "directory") {
        await walk(entry as FileSystemDirectoryHandle);
      }
    }
  };

  await walk(root);
  return result;
}

// ---------- Downloadable ZIP (works in every browser) ----------
export type BackupProgress = {
  table: string;
  done: number;
  total: number;
};

/**
 * Fetch every backup table and package it as a ZIP file that the browser
 * downloads immediately. Works on mobile/tablet/Firefox/Safari where the
 * File System Access API is unavailable.
 */
export async function downloadBackupZip(
  companyId: string,
  companyName: string | null,
  supabaseClient: typeof supabase,
  onProgress?: (p: BackupProgress) => void,
): Promise<void> {
  const zip = new JSZip();
  const folderName = `BinoSoz-${safeFolderName(companyName ?? companyId.slice(0, 8))}`;
  const root = zip.folder(folderName);
  if (!root) throw new Error("Failed to create ZIP root folder");

  const total = BACKUP_TABLES.length;

  for (let i = 0; i < BACKUP_TABLES.length; i++) {
    const table = BACKUP_TABLES[i];
    onProgress?.({ table, done: i, total });

    const { data, error: qErr } = await (supabaseClient as any).rpc("export_backup_rows", {
      _table: table,
      _since: "1970-01-01T00:00:00Z",
      _company_id: companyId,
    });

    if (qErr) {
      console.error(`[backup-zip] ${table}:`, qErr.message);
      continue;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) continue;

    const section = TABLE_SECTION[table] ?? "Дигар";
    const sectionFolder = root.folder(section);
    if (!sectionFolder) continue;

    const chunk = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
    sectionFolder.file(`${table}.jsonl`, chunk);
  }

  onProgress?.({ table: "", done: total, total });

  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `${folderName}-${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(blob, fileName);
}
