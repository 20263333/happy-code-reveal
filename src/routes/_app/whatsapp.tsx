import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Send, Settings, ScrollText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sendWhatsappMessage } from "@/lib/whatsapp.functions";
import { backfillWhatsappAvatars } from "@/lib/whatsapp-avatars.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp (Wappi) — Binosoz.tj" },
      {
        name: "description",
        content: "Чатҳои WhatsApp-и мизоҷон дар CRM: паёмҳои воридотӣ ва содиротӣ.",
      },
    ],
  }),
  component: WhatsappPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳",
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓ хонда шуд",
  undelivered: "⚠️ нарасид",
  failed: "✕ хато",
};

function fmtTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WhatsappPage() {
  const { companyId, user, isOwner, isPlatformAdmin, isDirector } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const send = useServerFn(sendWhatsappMessage);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: allChats = [] } = useQuery({
    queryKey: ["wa-chats", companyId],
    enabled: !!companyId,
    refetchInterval: 10000,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_chats")
        .select("id, customer_id, phone, display_name, avatar_url, last_direction, last_message_at, last_message_text, unread_count")
        .eq("company_id", companyId!)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(500);
      return data ?? [];
    },
  });

  // Рекорди менеҷерии корбари ҷорӣ (агар вай менеҷери фурӯш бошад)
  const { data: myManager } = useQuery({
    queryKey: ["wa-my-manager", companyId, user?.id, user?.email],
    enabled: !!companyId && !!user,
    queryFn: async () => {
      const email = (user!.email ?? "").toLowerCase();
      const { data } = await (supabase as any)
        .from("sales_team_members")
        .select("id")
        .eq("company_id", companyId!)
        .eq("kind", "manager")
        .eq("is_active", true)
        .or(`user_id.eq.${user!.id},email.eq.${email}`);
      return (data ?? [])[0] ?? null;
    },
  });

  const isPrivileged = !!(isOwner || isPlatformAdmin || isDirector);

  // Лидҳои таъиншуда ба ин менеҷер (барои филтри чатҳо)
  const { data: myCustomers = [] } = useQuery({
    queryKey: ["wa-my-customers", companyId, myManager?.id],
    enabled: !!companyId && !!myManager && !isPrivileged,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("customers")
        .select("id, phone")
        .eq("company_id", companyId!)
        .eq("assigned_manager_id", myManager!.id);
      return data ?? [];
    },
  });

  const chats = useMemo(() => {
    let list = allChats as any[];
    // Менеҷер танҳо чатҳои лидҳои худашро мебинад
    if (!isPrivileged && myManager) {
      const ids = new Set(myCustomers.map((c: any) => c.id));
      const phones = new Set(
        myCustomers.map((c: any) => String(c.phone ?? "").replace(/\D/g, "")).filter(Boolean),
      );
      list = list.filter(
        (c) =>
          (c.customer_id && ids.has(c.customer_id)) ||
          phones.has(String(c.phone ?? "").replace(/\D/g, "")),
      );
    }
    // Аввал чатҳои беҷавоб (охирин паём воридотӣ), баъд ҷавобдодашудаҳо
    return [...list].sort((a, b) => {
      const aUn = a.last_direction === "incoming" ? 0 : 1;
      const bUn = b.last_direction === "incoming" ? 0 : 1;
      if (aUn !== bUn) return aUn - bUn;
      return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime();
    });
  }, [allChats, isPrivileged, myManager, myCustomers]);

  const active = useMemo(() => chats.find((c: any) => c.id === activeId) ?? null, [chats, activeId]);

  const { data: messages = [] } = useQuery({
    queryKey: ["wa-messages", activeId],
    enabled: !!activeId,
    refetchInterval: 5000,
    staleTime: 2500,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("id, direction, body, media_url, media_meta, message_type, status, sent_at")
        .eq("chat_id", activeId!)
        .order("sent_at", { ascending: false })
        .limit(200);
      return (data ?? []).slice().reverse();
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeId]);

  // Кушодани чат: сабзак мемонад, танҳо рақам гум мешавад.
  // unread_count дар база танҳо ҳангоми ҶАВОБ (outgoing) сифр мешавад.
  // seenCounts[chatId] = чанд паёми нохонударо менеҷер аллакай дидааст.
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!activeId) return;
    const current = chats.find((c: any) => c.id === activeId)?.unread_count ?? 0;
    setSeenCounts((prev) => {
      const seen = prev[activeId] ?? 0;
      return current > seen ? { ...prev, [activeId]: current } : prev;
    });
  }, [activeId, chats]);

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!activeId || !text.trim()) return;
      await send({ data: { chatRowId: activeId, body: text.trim() } });
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["wa-messages", activeId] });
      qc.invalidateQueries({ queryKey: ["wa-chats", companyId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Фиристодан ноком шуд"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp (Wappi)"
        subtitle="Паёмҳои воридотӣ ва содиротии WhatsApp дар як ҷо. Мизоҷи нав автоматӣ сохта мешавад."
      />

      <Tabs defaultValue="chats">
        <TabsList>
          <TabsTrigger value="chats"><MessageCircle className="h-4 w-4 mr-1" />Чатҳо</TabsTrigger>
          {isPrivileged && <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Танзимот</TabsTrigger>}
          <TabsTrigger value="logs"><ScrollText className="h-4 w-4 mr-1" />Журнал</TabsTrigger>
        </TabsList>

        <TabsContent value="chats" className="mt-4">
          {chats.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Ҳоло чат нест"
              description="Аз рақами дигар ба WhatsApp-и ширкат паём фиристед — чат худкор пайдо мешавад."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
              <div className="rounded-xl border border-border divide-y divide-border max-h-[70vh] overflow-y-auto">
                {chats.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-3 hover:bg-muted/60 transition ${
                      c.id === activeId ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {c.display_name || `+${c.phone}`}
                      </span>
                      {(() => {
                        const unread = c.unread_count ?? 0;
                        const pending = unread - (seenCounts[c.id] ?? 0);
                        if (pending > 0)
                          return (
                            <span className="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center justify-center">
                              {pending}
                            </span>
                          );
                        if (unread > 0)
                          return (
                            <span
                              title="Дида шуд, ҷавоб дода нашудааст"
                              className="shrink-0 w-2.5 h-2.5 rounded-full bg-green-500"
                            />
                          );
                        return null;
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {c.last_message_text ?? "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {fmtTime(c.last_message_at)}
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-border flex flex-col max-h-[70vh]">
                {!active ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8">
                    Чатро интихоб кунед
                  </div>
                ) : (
                  <>
                    <div className="border-b border-border p-3">
                      <div className="font-medium">{active.display_name || `+${active.phone}`}</div>
                      <div className="text-xs text-muted-foreground">+{active.phone}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {messages.map((m: any) => (
                        <div
                          key={m.id}
                          className={`max-w-[75%] rounded-lg p-2 text-sm ${
                            m.direction === "outgoing"
                              ? "ml-auto bg-primary/10"
                              : "bg-muted"
                          }`}
                        >
                          {m.media_url && (
                            <a
                              href={m.media_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs underline mb-1"
                            >
                              <Paperclip className="h-3 w-3" />
                              Файл ({m.message_type})
                            </a>
                          )}
                          {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                          <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
                            <span>{fmtTime(m.sent_at)}</span>
                            {m.direction === "outgoing" && (
                              <span>{STATUS_LABEL[m.status] ?? m.status}</span>
                            )}
                          </div>
                          {m.error_text && (
                            <div className="text-[10px] text-destructive mt-1">{m.error_text}</div>
                          )}
                        </div>
                      ))}
                      <div ref={endRef} />
                    </div>
                    <div className="border-t border-border p-3 flex gap-2">
                      <Textarea
                        rows={2}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Паём нависед..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMut.mutate();
                          }
                        }}
                      />
                      <Button
                        onClick={() => sendMut.mutate()}
                        disabled={sendMut.isPending || !text.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <WhatsappSettings companyId={companyId} />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <WhatsappLogs companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WhatsappSettings({ companyId }: { companyId: string | null }) {
  const qc = useQueryClient();
  const [profileId, setProfileId] = useState("");
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");

  const { data: account } = useQuery({
    queryKey: ["wa-account", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_accounts")
        .select("*")
        .eq("company_id", companyId!)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (account) {
      setProfileId(account.profile_id ?? "");
      setLabel(account.label ?? "");
      setPhone(account.phone ?? "");
    }
  }, [account]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profileId.trim()) {
        if (!account) throw new Error("Profile ID лозим аст");
        const { error } = await supabase.from("whatsapp_accounts").delete().eq("id", account.id);
        if (error) throw error;
        return;
      }
      const payload = {
        company_id: companyId!,
        profile_id: profileId.trim(),
        label: label.trim() || null,
        phone: phone.trim() || null,
        enabled: true,
      };
      const { error } = account
        ? await supabase.from("whatsapp_accounts").update(payload).eq("id", account.id)
        : await supabase.from("whatsapp_accounts").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Нигоҳ дошта шуд");
      qc.invalidateQueries({ queryKey: ["wa-account", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!account) return;
      const { error } = await supabase.from("whatsapp_accounts").delete().eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setProfileId("");
      setLabel("");
      setPhone("");
      qc.setQueryData(["wa-account", companyId], null);
      qc.invalidateQueries({ queryKey: ["wa-account", companyId] });
      toast.success("Маълумоти Wappi пурра тоза шуд");
    },
    onError: (e: any) => toast.error(e.message ?? "Тоза кардан ноком шуд"),
  });

  const backfillFn = useServerFn(backfillWhatsappAvatars);
  const backfill = useMutation({
    mutationFn: () => backfillFn({}),
    onSuccess: (r: any) => {
      toast.success(`Аксҳо нав шуданд: ${r.updated} аз ${r.total}`);
      qc.invalidateQueries({ queryKey: ["wa-chats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  // Суроғаи доимӣ (Wappi бояд маҳз ба ин фиристад)
  const webhookUrl =
    "https://project--63d19137-8c20-4d78-9f11-31bd62013944.lovable.app/api/public/hooks/whatsapp-leads";

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground break-all">
        Webhook URL барои Wappi: <b>{webhookUrl}</b>
        <br />
        Токенҳо (WAPPI_API_TOKEN, WAPPI_WEBHOOK_AUTH_TOKEN) танҳо дар сервер нигоҳ дошта мешаванд.
      </div>
      <div>
        <Label>Wappi Profile ID *</Label>
        <Input value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="xxxxxxxx-xxxx-..." />
      </div>
      <div>
        <Label>Ном (ихтиёрӣ)</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="WhatsApp-и фурӯш" />
      </div>
      <div>
        <Label>Рақами WhatsApp (ихтиёрӣ)</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+992..." />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending || remove.isPending}>
          Нигоҳ доштан
        </Button>
        {account && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={remove.isPending || save.isPending}>
                <Trash2 className="h-4 w-4" />
                Тоза кардани маълумот
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Маълумоти Wappi тоза шавад?</AlertDialogTitle>
                <AlertDialogDescription>
                  Profile ID, ном ва рақами WhatsApp пурра нест мешаванд. Чатҳои пешина боқӣ мемонанд.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Бекор кардан</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => remove.mutate()}
                >
                  Тоза кардан
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="text-sm font-medium">Аксҳои профили лидҳо</div>
        <p className="text-xs text-muted-foreground">
          Аксҳои лидҳои кӯҳнаро аз WhatsApp боргирӣ карда, доимӣ нигоҳ медорад. Профили Wappi бояд
          пайваст (QR скан шуда) бошад.
        </p>
        <Button variant="outline" onClick={() => backfill.mutate()} disabled={backfill.isPending}>
          {backfill.isPending ? "Боргирӣ..." : "Аксҳоро нав кун"}
        </Button>
      </div>
    </div>
  );
}

function WhatsappLogs({ companyId }: { companyId: string | null }) {
  const { data: logs = [] } = useQuery({
    queryKey: ["wa-logs", companyId],
    enabled: !!companyId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  if (logs.length === 0)
    return <EmptyState icon={ScrollText} title="Журнал холӣ" description="Ҳоло рӯйдоде сабт нашудааст" />;

  return (
    <div className="rounded-xl border border-border divide-y divide-border max-h-[70vh] overflow-y-auto">
      {logs.map((l: any) => (
        <div key={l.id} className="p-3 text-sm flex items-start gap-3">
          <Badge variant={l.level === "error" ? "destructive" : l.level === "warn" ? "secondary" : "outline"}>
            {l.event ?? l.level}
          </Badge>
          <div className="flex-1">
            <div>{l.message}</div>
            <div className="text-[10px] text-muted-foreground">{fmtTime(l.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
