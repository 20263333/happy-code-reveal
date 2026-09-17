import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { sendWhatsappMessage } from "@/lib/whatsapp.functions";
import { pushLeadChange } from "@/lib/funnel-sync.functions";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Phone, MessageCircle, ClipboardList, Plus, Search, Pencil, Send, Menu } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_app/crm-funnel")({
  head: () => ({ meta: [{ title: "Воронка фурӯш — Binosoz.tj" }] }),
  component: CrmFunnelPage,
});

const STAGES = [
  { v: "lead", l: "Лиди нав", bar: "bg-warning" },
  { v: "contacted", l: "Занги аввал", bar: "bg-warning" },
  { v: "no_answer", l: "Занг нагирифт", bar: "bg-destructive" },
  { v: "meeting", l: "Вохӯрӣ таъин шуд", bar: "bg-primary" },
  { v: "thinking", l: "Фикр мекунад", bar: "bg-accent" },
  { v: "hold", l: "Брони квартира", bar: "bg-warning" },
  { v: "contract", l: "Шартнома", bar: "bg-success" },
  { v: "lost", l: "Ғайримақсаднок", bar: "bg-muted-foreground" },
];

/** Овозро (ptt/audio) ҳамчун манбаи плеер бармегардонад, вагарна null */
function audioSrc(m: any): string | null {
  const type = String(m?.message_type ?? "").toLowerCase();
  const isAudioType = /ptt|voice|audio/.test(type);
  const url = m?.media_url ? String(m.media_url) : "";
  if (url && (isAudioType || /\.(ogg|oga|opus|mp3|m4a|wav|aac)(\?|$)/i.test(url))) return url;

  // Баъзан Wappi мазмуни base64-и файлро дар body мефиристад
  const body = typeof m?.body === "string" ? m.body.trim() : "";
  if (body.length > 200 && /^[A-Za-z0-9+/=]+$/.test(body.slice(0, 200))) {
    const mime = body.startsWith("T2dnUw")
      ? "audio/ogg"
      : body.startsWith("SUQz") || body.startsWith("//")
        ? "audio/mpeg"
        : body.startsWith("UklGR")
          ? "audio/wav"
          : isAudioType
            ? "audio/ogg"
            : null;
    if (mime) return `data:${mime};base64,${body.replace(/\s+/g, "")}`;
  }
  return url && isAudioType ? url : null;
}

const AVATAR_TONES = [
  "bg-primary/15 text-primary",
  "bg-success/15 text-success",
  "bg-warning/25 text-warning-foreground",
  "bg-accent/15 text-accent",
  "bg-destructive/15 text-destructive",
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function toneFor(id: string) {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % AVATAR_TONES.length;
  return AVATAR_TONES[n];
}

/** Акси профили WhatsApp; агар линк кор накунад — ҳарфҳои ном нишон дода мешавад. */
function LeadAvatar({
  src,
  id,
  name,
  size = 44,
}: {
  src?: string | null;
  id: string;
  name: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (src && !broken)
    return (
      <img
        src={src}
        alt=""
        style={style}
        onError={() => setBroken(true)}
        className="flex-shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  return (
    <div
      style={style}
      className={`flex flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${toneFor(id)}`}
    >
      {initials(name || "?")}
    </div>
  );
}



function CrmFunnelPage() {
  const { companyId, isDirector, isOwner, isPlatformAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [detail, setDetail] = useState<any>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const canModify = !isDirector;

  const { data: customers = [] } = useQuery({
    queryKey: ["crm-funnel", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("customers")
        .select("*, sales(id), manager:sales_team_members!customers_assigned_manager_id_fkey(id, fullname)")
        .eq("company_id", companyId)
        .not("status", "in", "(active,closed)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: managers = [] } = useQuery({
    queryKey: ["crm-managers", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("sales_team_members")
        .select("id, fullname, kind, is_active")
        .eq("company_id", companyId)
        .eq("kind", "manager")
        .eq("is_active", true)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Рекорди менеҷерии корбари ҷорӣ (агар вай менеҷери фурӯш бошад)
  const { data: myManager } = useQuery({
    queryKey: ["crm-my-manager", companyId, user?.id, user?.email],
    queryFn: async () => {
      if (!companyId || !user) return null;
      const email = (user.email ?? "").toLowerCase();
      const { data } = await (supabase as any)
        .from("sales_team_members")
        .select("id")
        .eq("company_id", companyId)
        .eq("kind", "manager")
        .eq("is_active", true)
        .or(`user_id.eq.${user.id},email.eq.${email}`);
      return (data ?? [])[0] ?? null;
    },
    enabled: !!companyId && !!user,
  });

  // Соҳиб/админ/директор ҳамаро мебинад; менеҷер танҳо лидҳои худашро
  const isPrivileged = !!(isOwner || isPlatformAdmin || isDirector);
  const visibleCustomers = !isPrivileged && myManager
    ? customers.filter((c: any) => c.assigned_manager_id === myManager.id)
    : customers;

  // Аксҳои профил + ҳолати ҷавоб — як дархости сабук
  const { data: waChats = [] } = useQuery({
    queryKey: ["crm-wa-chats", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("whatsapp_chats")
        .select("customer_id, phone, avatar_url, last_direction")
        .eq("company_id", companyId)
        .limit(2000);
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const avatarFor = (c: any): string | null => {
    const byId = waChats.find((w: any) => w.customer_id && w.customer_id === c.id && w.avatar_url);
    if (byId) return byId.avatar_url;
    const d9 = String(c.phone ?? "").replace(/\D/g, "").slice(-9);
    if (d9.length === 9) {
      const byPhone = waChats.find((w: any) => w.avatar_url && String(w.phone ?? "").replace(/\D/g, "").slice(-9) === d9);
      if (byPhone) return byPhone.avatar_url;
    }
    return null;
  };

  const answeredChats = waChats.filter((w: any) => w.last_direction === "outgoing");

  const isAnswered = (c: any): boolean => {
    if (answeredChats.some((w: any) => w.customer_id && w.customer_id === c.id)) return true;
    const d9 = String(c.phone ?? "").replace(/\D/g, "").slice(-9);
    if (d9.length === 9) {
      return answeredChats.some((w: any) => String(w.phone ?? "").replace(/\D/g, "").slice(-9) === d9);
    }
    return false;
  };

  const distribute = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("distribute_unassigned_leads", { _company_id: companyId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["crm-funnel", companyId] });
      toast.success(`${n ?? 0} лид байни менеҷерҳо тақсим шуд`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pushLead = useServerFn(pushLeadChange);

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await (supabase as any).from("customers").update({ funnel_stage: stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crm-funnel", companyId] });
      toast.success("Марҳила иваз шуд");
      pushLead({ data: { leadId: vars.id } }).catch(() => {});
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Харидорон (sale доранд) ҳамеша дар марҳилаи «Шартнома» нишон дода мешаванд,
  // новобаста аз он ки funnel_stage-и кӯҳна онҳо «Лиди нав» буда бошад.
  const stageOf = (c: any) => ((c.sales ?? []).length > 0 ? "contract" : (c.funnel_stage || "lead"));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? visibleCustomers.filter((c: any) =>
        (c.fullname ?? "").toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q))
    : visibleCustomers;

  const stats = STAGES.map((s) => ({
    ...s,
    items: filtered.filter((c: any) => stageOf(c) === s.v),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">СДЕЛКАҲО</h1>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ҷустуҷӯ ва филтр"
              className="h-9 w-64 pl-8"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filtered.length} сделка
          </span>
          {canModify && (
            <Button onClick={() => setNewLeadOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />Сделкаи нав
            </Button>
          )}
          {canModify && isPrivileged && (
            <Button
              size="sm"
              variant="outline"
              disabled={distribute.isPending || managers.length === 0}
              title={managers.length === 0 ? "Аввал дар «Дастаи фурӯш» менеҷерҳо илова кунед" : ""}
              onClick={() => distribute.mutate()}
            >
              <Users className="mr-1 h-4 w-4" />Тақсим кардан ({managers.length})
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4">
        {stats.map((s) => (
          <div
            key={s.v}
            className={`flex w-64 flex-shrink-0 flex-col rounded-lg bg-muted/40 transition ${
              overStage === s.v ? "ring-2 ring-primary" : ""
            }`}
            onDragOver={(e) => { if (canModify) { e.preventDefault(); setOverStage(s.v); } }}
            onDragLeave={() => setOverStage((p) => (p === s.v ? null : p))}
            onDrop={() => {
              setOverStage(null);
              if (canModify && dragId) { moveStage.mutate({ id: dragId, stage: s.v }); setDragId(null); }
            }}
          >
            <div className={`h-1 rounded-t-lg ${s.bar}`} />
            <div className="px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.l}</div>
              <div className="text-[11px] text-muted-foreground/80">{s.items.length} сделка</div>
            </div>
            <div className="flex-1 space-y-1.5 px-2 pb-3">
              {s.items.map((c: any) => (
                <div
                  key={c.id}
                  draggable={canModify}
                  onDragStart={() => { if (canModify) setDragId(c.id); }}
                  onClick={() => setDetail(c)}
                  className="relative cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition hover:shadow-md"
                >
                  {isAnswered(c) && (
                    <span
                      className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30"
                      title="Менеҷер ҷавоб додааст"
                    />
                  )}
                  <div className="flex gap-3">
                    <div className="flex flex-shrink-0 flex-col items-center gap-1">
                      <LeadAvatar src={avatarFor(c)} id={c.id} name={c.fullname} size={44} />

                      {c.crm_fields?.probability && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          🎯 {String(c.crm_fields.probability).replace(/%+$/, "")}%
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-medium text-muted-foreground">
                          {c.manager?.fullname ? `👤 ${c.manager.fullname}` : "Менеҷер нест"}
                        </span>
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground/70">{formatDate(c.created_at)}</span>
                      </div>
                      {(c.crm_fields?.comments ?? c.crm_fields?.comment ?? c.notes) && (
                        <div className="truncate text-xs italic text-muted-foreground">{c.crm_fields?.comments ?? c.crm_fields?.comment ?? c.notes}</div>
                      )}
                      <div className="truncate text-sm font-semibold text-primary">{c.fullname}</div>
                      {c.phone && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{c.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {s.items.length === 0 && (
                <div className="rounded-md border border-dashed border-border/70 py-6 text-center text-[11px] text-muted-foreground">
                  Холӣ
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {customers.length === 0 && <EmptyState icon={Users} title="Лидҳо нест" description="Тугмаи «Сделкаи нав»-ро зер кунед ё аз саҳифаи Мизоҷҳо илова кунед" />}

      {detail && <CustomerDrawer customer={detail} canEdit={canModify} onClose={() => setDetail(null)} />}
      {newLeadOpen && <NewLeadDialog onClose={() => setNewLeadOpen(false)} />}
    </div>
  );
}


function NewLeadDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  const [form, setForm] = useState({ fullname: "", phone: "", stage: "lead", notes: "" });

  const pushLead = useServerFn(pushLeadChange);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.fullname.trim()) throw new Error("Ном лозим аст");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: row, error } = await (supabase as any).from("customers").insert({
        company_id: companyId,
        fullname: form.fullname.trim(),
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        funnel_stage: form.stage,
        status: "new",
        created_by: user?.id,
      }).select("id").single();
      if (error) throw error;
      return row?.id as string | undefined;
    },
    onSuccess: (id) => {
      toast.success("Лид илова шуд");
      qc.invalidateQueries({ queryKey: ["crm-funnel", companyId] });
      if (id) pushLead({ data: { leadId: id } }).catch(() => {});
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Лиди нав</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Ном *</Label><Input value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} placeholder="Ном ва насаб" /></div>
          <div><Label>Телефон</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+992..." /></div>
          <div>
            <Label>Марҳила</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.filter((s) => s.v !== "lost").map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Эзоҳ</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Кадом квартираро мехоҳад, буҷет ва ғ." rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Бекор</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Сабт</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function CustomerDrawer({ customer, canEdit, onClose }: { customer: any; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  const [form, setForm] = useState({ kind: "call", direction: "out", subject: "", body: "", outcome: "" });
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(customer.fullname || "");
  const [waText, setWaText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const stage = STAGES.find((s) => s.v === (customer.funnel_stage || "lead"));

  const pushLead = useServerFn(pushLeadChange);

  const renameMut = useMutation({
    mutationFn: async () => {
      const v = nameDraft.trim();
      if (!v) throw new Error("Ном холӣ аст");
      const { error } = await (supabase as any).from("customers").update({ fullname: v }).eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ном иваз шуд");
      setEditName(false);
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      pushLead({ data: { leadId: customer.id } }).catch(() => {});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["cust-inter", customer.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("customer_interactions")
        .select("*").eq("customer_id", customer.id).order("interaction_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // WhatsApp чат аз рӯи рақами телефон
  const { data: waChat } = useQuery({
    queryKey: ["cust-wa-chat", companyId, customer.phone],
    queryFn: async () => {
      if (!companyId || !customer.phone) return null;
      const digits = String(customer.phone).replace(/\D/g, "").slice(-9);
      if (digits.length < 9) return null;
      const { data: chats } = await (supabase as any).from("whatsapp_chats")
        .select("id, avatar_url").eq("company_id", companyId).ilike("phone", `%${digits}`).limit(5);
      return (chats ?? []).find((c: any) => c.avatar_url) ?? (chats ?? [])[0] ?? null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: waMessages = [] } = useQuery({
    queryKey: ["cust-wa", waChat?.id],
    queryFn: async () => {
      if (!waChat?.id) return [];
      const { data: msgs } = await (supabase as any).from("whatsapp_messages")
        .select("id, direction, body, media_url, media_meta, message_type, sent_at")
        .eq("chat_id", waChat.id).order("sent_at", { ascending: false }).limit(100);
      return (msgs ?? []).slice().reverse();
    },
    enabled: !!waChat?.id,
    refetchInterval: 8000,
    staleTime: 4000,
  });


  const sendWa = useServerFn(sendWhatsappMessage);
  const sendWaMut = useMutation({
    mutationFn: async () => {
      const body = waText.trim();
      if (!waChat?.id || !body) return;
      await sendWa({ data: { chatRowId: waChat.id, body } });
    },
    onSuccess: () => {
      setWaText("");
      qc.invalidateQueries({ queryKey: ["cust-wa", waChat?.id] });
      qc.invalidateQueries({ queryKey: ["wa-messages"] });
      qc.invalidateQueries({ queryKey: ["wa-chats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Фиристодан ноком шуд"),
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("customer_interactions").insert({
        company_id: companyId, customer_id: customer.id,
        kind: form.kind, direction: form.direction, subject: form.subject,
        body: form.body, outcome: form.outcome, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сабт шуд");
      setForm({ kind: "call", direction: "out", subject: "", body: "", outcome: "" });
      qc.invalidateQueries({ queryKey: ["cust-inter", customer.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col overflow-hidden p-0 md:h-[85vh]">
        <DialogHeader className="border-b border-border bg-muted/30 px-5 py-3">
          <DialogTitle className="flex items-center gap-3">
            <LeadAvatar src={waChat?.avatar_url} id={customer.id} name={customer.fullname} size={36} />

            <div>
              {editName ? (
                <div className="flex items-center gap-2">
                  <Input className="h-8 w-64 text-sm" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
                  <Button size="sm" className="h-8" onClick={() => renameMut.mutate()} disabled={renameMut.isPending}>Сабт</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditName(false)}>Бекор</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{customer.fullname}</span>
                  {canEdit && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setNameDraft(customer.fullname || ""); setEditName(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
              <div className="mt-0.5 flex items-center gap-2 text-xs font-normal text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{stage?.l}</Badge>
                <span>№{String(customer.id).slice(0, 8)}</span>
                <span>{formatDate(customer.created_at)}</span>
              </div>
            </div>
            <Button
              size="icon"
              variant="outline"
              className="ml-auto h-9 w-9 shrink-0 md:hidden"
              onClick={() => setShowInfo((v) => !v)}
              aria-label="Маълумоти сделка"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Чап: майдонҳои сделка (дар телефон паси тугмаи меню) */}
          <div className={`${showInfo ? "block" : "hidden"} max-h-[45%] w-full flex-shrink-0 overflow-y-auto border-b border-border p-4 md:block md:max-h-none md:w-80 md:border-b-0 md:border-r`}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Асосӣ</div>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-[11px] text-muted-foreground">Муштарӣ</dt><dd className="font-medium">{customer.fullname}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Телефон</dt><dd className="font-medium">{customer.phone || "—"}</dd></div>
              {customer.email && <div><dt className="text-[11px] text-muted-foreground">Email</dt><dd className="font-medium">{customer.email}</dd></div>}
              <div><dt className="text-[11px] text-muted-foreground">Марҳила</dt><dd><Badge variant="secondary" className="text-[11px]">{stage?.l}</Badge></dd></div>
              {customer.notes && <div><dt className="text-[11px] text-muted-foreground">Эзоҳ</dt><dd className="text-xs">{customer.notes}</dd></div>}
            </dl>

            <ManagerPicker customer={customer} canEdit={canEdit} />

            <DealFields customer={customer} canEdit={canEdit} />


            {canEdit && <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Илова кардани алоқа</div>
              <div className="space-y-2">
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Занг</SelectItem>
                    <SelectItem value="meeting">Вохӯрӣ</SelectItem>
                    <SelectItem value="message">Паём</SelectItem>
                    <SelectItem value="note">Эзоҳ</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.outcome} onValueChange={(v) => setForm({ ...form, outcome: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Натиҷа" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interested">Мароқ дорад</SelectItem>
                    <SelectItem value="callback">Занг заниед</SelectItem>
                    <SelectItem value="refused">Рад кард</SelectItem>
                    <SelectItem value="booked">Бронь кард</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="h-8 text-xs" placeholder="Мавзӯъ" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                <Textarea className="text-xs" placeholder="Тавсиф..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={2} />
                <Button size="sm" className="w-full" onClick={() => add.mutate()} disabled={add.isPending}>Сабт</Button>
              </div>
            </div>}
          </div>

          {/* Марказ: чат ва таърих */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {waMessages.length > 0 && (
                <div className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">WhatsApp</div>
              )}
              {waMessages.map((m: any) => {
                const isOut = m.direction === "out" || m.direction === "outgoing";
                return (
                <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm shadow-sm ${
                    isOut ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {(() => {
                      const audio = audioSrc(m);
                      if (audio) return <audio controls preload="none" src={audio} className="h-9 w-64 max-w-full" />;
                      return (
                        <>
                          {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                          {m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer" className="text-xs underline">Файл</a>}
                        </>
                      );
                    })()}
                    <div className={`mt-1 text-right text-[10px] ${isOut ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatDate(m.sent_at)}
                    </div>
                  </div>
                </div>
                );
              })}
              {waMessages.length === 0 && interactions.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">Таърих холӣ</div>
              )}
              {interactions.length > 0 && (
                <>
                  <div className="mb-1 mt-4 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Таърихи алоқаҳо ({interactions.length})
                  </div>
                  {interactions.map((i: any) => (
                    <div key={i.id} className="rounded-md bg-muted/50 p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">{i.kind}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(i.interaction_at)}</span>
                      </div>
                      {i.subject && <div className="mt-1 font-medium">{i.subject}</div>}
                      {i.body && <div className="mt-1 text-xs text-muted-foreground">{i.body}</div>}
                      {i.outcome && <Badge className="mt-1 text-xs" variant="secondary">{i.outcome}</Badge>}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Қуттии фиристодани паёми WhatsApp */}
            <div className="border-t border-border p-3">
              {waChat ? (
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={1}
                    className="max-h-28 min-h-[36px] flex-1 resize-none text-sm"
                    placeholder="Паёми WhatsApp нависед..."
                    value={waText}
                    onChange={(e) => setWaText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendWaMut.mutate();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => sendWaMut.mutate()}
                    disabled={sendWaMut.isPending || !waText.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center text-xs text-muted-foreground">
                  Барои ин муштарӣ чати WhatsApp нест — аввал аз WhatsApp паём фиристед ё рақамро санҷед
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



// ===== Майдонҳои иловагии сделка (мисли amoCRM) =====
type FieldDef = { k: string; l: string; t: "text" | "num" | "select" | "area"; opts?: string[] };

const DEAL_FIELDS: FieldDef[] = [
  { k: "budget", l: "Бюджет", t: "num" },
  { k: "down_payment", l: "Первоначальный взнос", t: "num" },
  { k: "probability", l: "Вероятность покупки (%)", t: "select", opts: ["10%", "25%", "50%", "75%", "100%"] },
  { k: "lead_source", l: "Источник ЛИД", t: "select", opts: ["Таргет", "Instagram", "WhatsApp", "Занг", "Тавсия", "Сайт", "Дигар"] },
  { k: "purchase_goal", l: "Цель покупки", t: "select", opts: ["Для проживания", "Инвестиция", "Барои иҷора", "Дигар"] },
  { k: "district", l: "Предпочитаемый район", t: "text" },
  { k: "purchase_term", l: "Планируемый срок покупки", t: "select", opts: ["Дар 1 моҳ", "1-3 моҳ", "3-6 моҳ", "6-12 моҳ", "Муайян нест"] },
  { k: "payment_method", l: "Способ оплаты (финансы)", t: "select", opts: ["100% пардохт", "Рассрочка", "Ипотека", "Бартер"] },
  { k: "client_portrait", l: "Портрет Клиента", t: "select", opts: ["Оила", "Ҷавон", "Инвестор", "Хориҷӣ", "Дигар"] },
  { k: "installment_term", l: "Срок рассрочки", t: "text" },
  { k: "comments", l: "Комментарий", t: "area" },
  { k: "block", l: "Блок", t: "text" },
  { k: "city", l: "Город", t: "text" },
  { k: "price_per_m2", l: "Цена за м²", t: "num" },
  { k: "rooms", l: "Количество комнат", t: "num" },
  { k: "apartment_no", l: "Номер квартиры", t: "text" },
  { k: "floor", l: "Этаж", t: "num" },
  { k: "area", l: "Площадь", t: "num" },
  { k: "company", l: "Компания", t: "text" },
  { k: "work_phone", l: "Раб. тел.", t: "text" },
];

function ManagerPicker({ customer, canEdit }: { customer: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const { companyId } = useAuth();

  const { data: managers = [] } = useQuery({
    queryKey: ["crm-managers", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("sales_team_members")
        .select("id, fullname")
        .eq("company_id", companyId)
        .eq("kind", "manager")
        .eq("is_active", true)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const pushLead = useServerFn(pushLeadChange);

  const assign = useMutation({
    mutationFn: async (managerId: string) => {
      const { error } = await (supabase as any)
        .from("customers").update({ assigned_manager_id: managerId }).eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Менеҷер иваз шуд");
      qc.invalidateQueries({ queryKey: ["crm-funnel", companyId] });
      pushLead({ data: { leadId: customer.id } }).catch(() => {});
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Менеҷери масъул</div>
      {canEdit ? (
        <Select
          value={customer.assigned_manager_id ?? ""}
          onValueChange={(v) => assign.mutate(v)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Интихоб кунед" /></SelectTrigger>
          <SelectContent>
            {managers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.fullname}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <div className="text-sm font-medium">{customer.manager?.fullname ?? "—"}</div>
      )}
    </div>
  );
}

function DealFields({ customer, canEdit }: { customer: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(customer.crm_fields ?? {}) }));
  const [dirty, setDirty] = useState(false);

  const pushLead = useServerFn(pushLeadChange);

  const save = useMutation({
    mutationFn: async () => {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) if (String(v ?? "").trim() !== "") clean[k] = String(v).trim();
      const { error } = await (supabase as any).from("customers").update({ crm_fields: clean }).eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      toast.success("Маълумот нигоҳ дошта шуд");
      qc.invalidateQueries({ queryKey: ["crm-funnel", companyId] });
      pushLead({ data: { leadId: customer.id } }).catch(() => {});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string, v: string) => { setValues((p) => ({ ...p, [k]: v })); setDirty(true); };

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Маълумоти сделка</div>
      <div className="space-y-2">
        {DEAL_FIELDS.map((f) => (
          <div key={f.k} className="grid grid-cols-[1fr_1.2fr] items-center gap-2">
            <span className="text-[11px] leading-tight text-muted-foreground">{f.l}</span>
            {!canEdit ? (
              <span className="truncate text-xs">{values[f.k] || "—"}</span>
            ) : f.t === "area" ? (
              <Textarea
                className="min-h-[60px] text-xs"
                value={values[f.k] ?? ""}
                placeholder="Комментарийро дастӣ нависед..."
                rows={3}
                onChange={(e) => set(f.k, e.target.value)}
              />
            ) : f.t === "select" ? (
              <Select value={values[f.k] ?? ""} onValueChange={(v) => set(f.k, v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Выбрать" /></SelectTrigger>
                <SelectContent>
                  {f.opts!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-7 text-xs"
                type={f.t === "num" ? "number" : "text"}
                value={values[f.k] ?? ""}
                placeholder="..."
                onChange={(e) => set(f.k, e.target.value)}
              />
            )}
          </div>
        ))}
        {canEdit && (
          <Button size="sm" className="w-full" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            Нигоҳ доштан
          </Button>
        )}
      </div>
    </div>
  );
}
