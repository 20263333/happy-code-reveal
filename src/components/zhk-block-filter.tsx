import { useEffect, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { useGlobalZhk, setGlobalZhk } from "@/lib/zhk-scope";

export type ZhkBlockProject = { id: string; name: string; parent_id: string | null };

export type ZhkBlockValue = { zhkId: string; blockId: string };

/**
 * Каскадный фильтр «ЖК → Блок». Возвращает набор id проектов, попадающих под
 * выбор: если выбран только ЖК — все его блоки + сам ЖК; если выбран блок —
 * только он. `null` означает "все".
 */
export function useZhkBlockFilter(projects: ZhkBlockProject[], value: ZhkBlockValue) {
  return useMemo(() => {
    if (!value.zhkId) return null; // все
    if (value.blockId) return new Set([value.blockId]);
    const ids = new Set<string>([value.zhkId]);
    for (const p of projects) if (p.parent_id === value.zhkId) ids.add(p.id);
    return ids;
  }, [projects, value.zhkId, value.blockId]);
}

export function ZhkBlockFilter({
  projects,
  value,
  onChange,
  className,
}: {
  projects: ZhkBlockProject[];
  value: ZhkBlockValue;
  onChange: (v: ZhkBlockValue) => void;
  className?: string;
}) {
  const { tr } = useT();
  const zhkList = useMemo(() => projects.filter((p) => !p.parent_id), [projects]);
  const blockList = useMemo(
    () => projects.filter((p) => p.parent_id === value.zhkId),
    [projects, value.zhkId],
  );
  const ALL = "__all__";
  const globalZhk = useGlobalZhk();

  // «Все ЖК» нест шуд — ҳамеша як ЖК интихоб мешавад.
  // Интихоб бо тугмаҳои болои барнома ҳамоҳанг аст (як ЖК дар тамоми саҳифаҳо).
  useEffect(() => {
    if (zhkList.length === 0) return;
    const globalValid = globalZhk && zhkList.some((p) => p.id === globalZhk);
    if (!value.zhkId) {
      const next = globalValid ? globalZhk : zhkList[0].id;
      setGlobalZhk(next);
      onChange({ zhkId: next, blockId: "" });
      return;
    }
    if (globalValid && globalZhk !== value.zhkId) {
      onChange({ zhkId: globalZhk, blockId: "" });
    }
  }, [value.zhkId, zhkList, onChange, globalZhk]);

  return (
    <div className={className ?? "flex flex-wrap items-end gap-2"}>
      <div className="space-y-1 min-w-[180px]">
        <Label className="text-xs text-muted-foreground">{tr("ЖК")}</Label>
        <Select
          value={value.zhkId || undefined}
          onValueChange={(v) => { setGlobalZhk(v); onChange({ zhkId: v, blockId: "" }); }}
        >
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {zhkList.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.zhkId && blockList.length > 0 && (
        <div className="space-y-1 min-w-[180px]">
          <Label className="text-xs text-muted-foreground">{tr("Блок")}</Label>
          <Select
            value={value.blockId || ALL}
            onValueChange={(v) => onChange({ ...value, blockId: v === ALL ? "" : v })}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tr("Все блоки")}</SelectItem>
              {blockList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
