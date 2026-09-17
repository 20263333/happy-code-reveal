import {
  HardDrive,
  FolderOpen,
  RefreshCw,
  Unplug,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { useLocalBackup } from "@/lib/use-local-backup";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function LocalBackupTab() {
  const { companyId } = useAuth();

  const { data: company } = useQuery({
    queryKey: ["my-company-name", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await (supabase as any)
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle();
      return data as { name: string } | null;
    },
    enabled: !!companyId,
  });

  const {
    status,
    folderName,
    lastSync,
    syncing,
    error,
    connect,
    disconnect,
    grantPermission,
    syncNow,
    restoreFromFolder,
    restoring,
    restoreReport,
    downloadZip,
    downloading,
    downloadProgress,
  } = useLocalBackup(companyId, company?.name ?? null);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <HardDrive className="h-6 w-6 text-primary mt-0.5" />
        <div className="flex-1">
          <h3 className="font-display text-lg font-semibold">Захира ба компютер</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ҳамаи маълумоти менюҳо автоматӣ ба папкаи компютери шумо (диски C, D ё USB) сабт мешавад
            — ҳар қисмат дар папкаи алоҳида.
          </p>
        </div>
      </div>

      {status === "unsupported" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 text-destructive mt-0.5" />
          <div>
            <div className="font-medium">Ин браузер дастгирӣ намекунад</div>
            <div className="text-muted-foreground text-xs mt-1">
              Барои ин функсия Chrome, Edge ё Opera-и компютерӣ лозим аст. Дар Firefox, Safari ва
              мобилӣ кор намекунад.
            </div>
          </div>
        </div>
      )}

      {status === "disconnected" && (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            Тугмаро пахш кунед → папкаро интихоб кунед (масалан <code>D:\</code> ё USB). Барнома дар
            он ҷо папкаи <code>BinoSoz-…</code> месозад ва бо гузашти вақт маълумоти навро ба он
            илова мекунад.
          </div>
          <Button onClick={connect}>
            <FolderOpen className="h-4 w-4" /> Пайваст кардан ба компютер
          </Button>
        </div>
      )}

      {status === "needs-permission" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <div>
              <div className="font-medium">Иҷозати дастрасӣ лозим аст</div>
              <div className="text-muted-foreground text-xs mt-1">
                Папка: <span className="font-mono">{folderName}</span>. Барои идомаи худкор захира
                иҷозатро тасдиқ кунед.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={grantPermission}>Тасдиқи иҷозат</Button>
            <Button variant="ghost" onClick={disconnect}>
              Қатъ кардан
            </Button>
          </div>
        </div>
      )}

      {status === "connected" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Захира фаъол аст</div>
              <div className="text-muted-foreground text-xs mt-1">
                Папка: <span className="font-mono">{folderName}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                Охирин синхронизатсия:{" "}
                {syncing ? "дар ҷараён…" : lastSync ? lastSync.toLocaleTimeString() : "ҳоло не"}
              </div>
              <div className="text-muted-foreground text-xs mt-1">
                Ҳар 30 сония автоматӣ маълумоти навро илова мекунад.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncNow} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Ҳозир
              синхронизатсия
            </Button>
            <Button variant="ghost" onClick={disconnect}>
              <Unplug className="h-4 w-4" /> Қатъ кардан
            </Button>
          </div>
        </div>
      )}

      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium">Скачат кардани ҳамаи маълумот</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ҳамаи ҷадвалҳо якҷоя дар як файли ZIP сабт мешаванд. Ин роҳ дар телефон, планшет,
              Firefox ва Safari низ кор мекунад.
            </p>
            <Button variant="outline" className="mt-3" onClick={downloadZip} disabled={downloading}>
              <Download className={`h-4 w-4 ${downloading ? "animate-pulse" : ""}`} />
              {downloading
                ? downloadProgress
                  ? `Дар ҷараён… ${downloadProgress.done}/${downloadProgress.total}`
                  : "Дар ҷараён…"
                : "Скачат кардан ZIP"}
            </Button>
          </div>
        </div>
      </div>

      {status !== "unsupported" && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-start gap-3">
            <Upload className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium">Барқарор кардан аз папка</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Агар маълумот тасодуфан нест шуда бошад — папкаи backup-ро интихоб кунед, барнома
                файлҳои <code>.jsonl</code>-ро мехонад ва маълумотро бармегардонад. Такрор намешавад
                (бо
                <code> id </code> тафтиш мегардад).
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={restoreFromFolder}
                disabled={restoring}
              >
                <Upload className={`h-4 w-4 ${restoring ? "animate-pulse" : ""}`} />
                {restoring ? "Дар ҷараён…" : "Интихоби папкаи backup"}
              </Button>

              {restoreReport && (
                <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
                  <div className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                    Барқарорсозӣ анҷом ёфт
                  </div>
                  {Object.entries(restoreReport.inserted).map(([t, n]) => (
                    <div key={t} className="text-muted-foreground">
                      • <span className="font-mono">{t}</span>: {n} запис бархоста шуд
                    </div>
                  ))}
                  {Object.keys(restoreReport.inserted).length === 0 && (
                    <div className="text-muted-foreground">Ҳеҷ маълумоти нав ёфт нашуд.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
        <div>
          • Файлҳо дар формати <code>.jsonl</code> (як сатр = як запис) сабт мешаванд.
        </div>
        <div>
          • Барои ҳар қисмат папкаи алоҳида сохта мешавад: Проекты, Клиентҳо, Договор, Пардохтҳо,
          Склад, Табел, Пудратчиён, Техника, Сифат ва Бехатарӣ ва ғайра.
        </div>
        <div>• Танҳо маълумоти нав илова мешавад — такрор намешавад.</div>
      </div>
    </div>
  );
}
