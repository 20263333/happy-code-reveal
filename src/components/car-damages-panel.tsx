import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/page-header";
import { toast } from "sonner";
import { usePrefs } from "@/lib/preferences";
import { formatDate } from "@/lib/constants";
import { listCarDamages, upsertCarDamage, deleteCarDamage } from "@/lib/car-damages.functions";

type Damage = {
  id: string;
  damage_date: string;
  vehicle: string;
  amount: number | string;
  notes: string | null;
};

const emptyForm = () => ({
  id: undefined as string | undefined,
  damage_date: new Date().toISOString().slice(0, 10),
  vehicle: "",
  amount: "",
  notes: "",
});

export function CarDamagesPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();
  const listFn = useServerFn(listCarDamages);
  const upsertFn = useServerFn(upsertCarDamage);
  const deleteFn = useServerFn(deleteCarDamage);

  const { data } = useQuery({
    queryKey: ["car-damages", projectId],
    queryFn: () => listFn({ data: { project_id: projectId } }),
  });

  const damages: Damage[] = (data?.damages as any[]) ?? [];
  const total = data?.total ?? 0;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const openNew = () => { setForm(emptyForm()); setOpen(true); };
  const openEdit = (d: Damage) => {
    setForm({
      id: d.id,
      damage_date: d.damage_date,
      vehicle: d.vehicle,
      amount: String(d.amount),
      notes: d.notes ?? "",
    });
    setOpen(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["car-damages", projectId] });
    // partner profit depends on total damages
    qc.invalidateQueries({ queryKey: ["partner-stats", projectId] });
    qc.invalidateQueries({ queryKey: ["partner-dist", projectId] });
    qc.invalidateQueries({ queryKey: ["partner-shares", projectId] });
  };

  const saveM = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: form.id,
        project_id: projectId,
        damage_date: form.damage_date,
        vehicle: form.vehicle.trim(),
        amount: Number(form.amount),
        notes: form.notes.trim() || null,
      },
    }),
    onSuccess: () => {
      toast.success(form.id ? "Навсозӣ шуд" : "Сабт шуд");
      setOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Нест шуд"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const canSave = form.vehicle.trim() && Number(form.amount) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Car className="w-4 h-4" /> Зарари мошин</h3>
          <p className="text-sm text-muted-foreground">
            Зарари умумӣ фақат аз фоидаи шарикон кам мешавад (пропортсионалӣ ба ҳиссаи ҳар шарик). Даромад ва арзиши аслӣ бетағйир мемонанд.
          </p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Илова кардани зарар</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{form.id ? "Тағйири зарар" : "Илова кардани зарар"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Санаи зарар</Label>
                  <Input type="date" value={form.damage_date}
                    onChange={(e) => setForm({ ...form, damage_date: e.target.value })} />
                </div>
                <div>
                  <Label>Тавсифи мошин</Label>
                  <Input value={form.vehicle}
                    onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                    placeholder="Масалан: КамАЗ 65115, рақами 1234 AB 01" />
                </div>
                <div>
                  <Label>Маблағи зарар</Label>
                  <Input type="number" step="0.01" min="0" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="10000" />
                </div>
                <div>
                  <Label>Эзоҳ (ихтиёрӣ)</Label>
                  <Textarea rows={3} value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Бекор</Button>
                <Button disabled={!canSave || saveM.isPending} onClick={() => saveM.mutate()}>Сабт</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {damages.length === 0 ? (
          <EmptyState icon={Car} title="Ҳанӯз сабт нест" description="Ягон зарари мошин сабт нашудааст." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">№</th>
                  <th className="py-2 pr-3">Сана</th>
                  <th className="py-2 pr-3">Мошин</th>
                  <th className="py-2 pr-3">Маблағ</th>
                  <th className="py-2 pr-3">Эзоҳ</th>
                  {canEdit && <th className="py-2 pr-3 text-right">Амал</th>}
                </tr>
              </thead>
              <tbody>
                {damages.map((d, i) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(d.damage_date)}</td>
                    <td className="py-2 pr-3">{d.vehicle}</td>
                    <td className="py-2 pr-3 font-semibold text-red-600">{formatMoney(Number(d.amount))}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{d.notes ?? "—"}</td>
                    {canEdit && (
                      <td className="py-2 pr-3 text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (confirm("Ин сабтро нест кунед?")) delM.mutate(d.id);
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="py-3 pr-3 font-semibold" colSpan={3}>Ҷамъи зарар</td>
                  <td className="py-3 pr-3 font-bold text-red-600 text-base">{formatMoney(total)}</td>
                  <td colSpan={canEdit ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
