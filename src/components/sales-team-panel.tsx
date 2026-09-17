import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Users, Trash2, Wallet, RefreshCw } from "lucide-react";
import {
  listSalesTeam, createSalesTeamMember, deleteSalesTeamMember, paySalesTeamMember, syncSalesPartners,
} from "@/lib/sales-team.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePrefs } from "@/lib/preferences";
import { formatDate } from "@/lib/constants";

type Kind = "manager" | "staff";

const KIND_LABEL: Record<Kind, string> = { manager: "Менеҷер", staff: "Корманд" };

export function SalesTeamPanel() {
  const { formatMoney } = usePrefs();
  const qc = useQueryClient();
  const listFn = useServerFn(listSalesTeam);
  const createFn = useServerFn(createSalesTeamMember);
  const deleteFn = useServerFn(deleteSalesTeamMember);
  const payFn = useServerFn(paySalesTeamMember);
  const syncFn = useServerFn(syncSalesPartners);

  const syncM = useMutation({
    mutationFn: () => syncFn({}),
    onSuccess: (r: any) => toast.success(`Ба барномаи дуюм фиристода шуд: ${r?.members ?? 0} аъзо`),
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  const { data } = useQuery({ queryKey: ["sales-team"], queryFn: () => listFn({}) });
  const members: any[] = data?.members ?? [];

  const [addKind, setAddKind] = useState<Kind | null>(null);
  const [form, setForm] = useState({ fullname: "", email: "", password: "", percent: "" });
  const [payFor, setPayFor] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const reset = () => { setAddKind(null); setForm({ fullname: "", email: "", password: "", percent: "" }); };

  const createM = useMutation({
    mutationFn: () => createFn({
      data: {
        fullname: form.fullname.trim(),
        kind: addKind as Kind,
        percent: Number(form.percent || 0),
        email: form.email.trim() || null,
        password: form.password.trim() || null,
      },
    }),
    onSuccess: () => { toast.success("Илова шуд"); reset(); qc.invalidateQueries({ queryKey: ["sales-team"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Нест шуд"); qc.invalidateQueries({ queryKey: ["sales-team"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  const payM = useMutation({
    mutationFn: () => payFn({ data: { member_id: payFor.id, amount: Number(payAmount), note: payNote || null } }),
    onSuccess: () => {
      toast.success("Пардохт сабт шуд");
      setPayFor(null); setPayAmount(""); setPayNote("");
      qc.invalidateQueries({ queryKey: ["sales-team"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  const group = (kind: Kind) => members.filter((m) => m.kind === kind);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold flex items-center gap-2 mr-auto">
          <Users className="h-4 w-4 text-muted-foreground" /> Дастаи фурӯш
        </h3>
        <Button size="sm" onClick={() => setAddKind("manager")}>
          <UserPlus className="mr-2 h-4 w-4" /> Илова кардани менеҷер
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAddKind("staff")}>
          <UserPlus className="mr-2 h-4 w-4" /> Илова кардани корманд
        </Button>
        <Button size="sm" variant="secondary" disabled={syncM.isPending} onClick={() => syncM.mutate()}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncM.isPending ? "animate-spin" : ""}`} /> Синхронизатсия
        </Button>
      </div>

      {(["manager", "staff"] as Kind[]).map((kind) => (
        <div key={kind} className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{KIND_LABEL[kind]}ҳо</div>
          {group(kind).length === 0 ? (
            <p className="text-sm text-muted-foreground">Ҳанӯз нест</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2 pr-3">ФИШ</th>
                    <th className="py-2 pr-3">Фоиз</th>
                    <th className="py-2 pr-3">Кор кардааст</th>
                    <th className="py-2 pr-3">Гирифтааст</th>
                    <th className="py-2 pr-3">Бақия</th>
                    <th className="py-2 text-right">Амал</th>
                  </tr>
                </thead>
                <tbody>
                  {group(kind).map((m) => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">
                        {m.fullname}
                        {m.email && <div className="text-xs text-muted-foreground">{m.email}</div>}
                      </td>
                      <td className="py-2 pr-3">{Number(m.percent)}%</td>
                      <td className="py-2 pr-3">{formatMoney(m.earned)}</td>
                      <td className="py-2 pr-3 text-emerald-600">{formatMoney(m.paid)}</td>
                      <td className={`py-2 pr-3 font-semibold ${m.balance > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {formatMoney(m.balance)}
                      </td>
                      <td className="py-2 text-right space-x-2 whitespace-nowrap">
                        <Button
                          size="sm" variant="outline" disabled={m.balance <= 0}
                          onClick={() => {
                            setPayFor(m);
                            setPayAmount(String(Math.round(m.balance * 100) / 100));
                          }}
                        >
                          <Wallet className="mr-1 h-4 w-4" /> Пардохт
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteM.mutate(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {(data?.payouts?.length ?? 0) > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Таърихи пардохтҳо</div>
          <div className="space-y-1 max-h-56 overflow-y-auto text-sm">
            {data!.payouts.slice(0, 50).map((p: any) => (
              <div key={p.id} className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">
                  {formatDate(p.paid_at)} — {members.find((m) => m.id === p.member_id)?.fullname ?? "—"}
                </span>
                <span className="font-semibold">{formatMoney(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!addKind} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Илова кардани {addKind ? KIND_LABEL[addKind].toLowerCase() : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ФИШ</Label>
              <Input value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
            </div>
            <div>
              <Label>Фоиз (%)</Label>
              <Input type="number" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} />
            </div>
            <div>
              <Label>Email (барои ворид шудан, ихтиёрӣ)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Парол</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={createM.isPending || form.fullname.trim().length < 2}
              onClick={() => createM.mutate()}
            >
              Сабт кардан
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Пардохт — {payFor?.fullname}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Бақия: <b>{payFor ? formatMoney(payFor.balance) : ""}</b>
            </p>
            <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Маблағ" />
            <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Эзоҳ" />
          </div>
          <DialogFooter>
            <Button disabled={payM.isPending || !(Number(payAmount) > 0)} onClick={() => payM.mutate()}>
              Сабт кардан
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
