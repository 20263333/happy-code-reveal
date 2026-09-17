import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, Send, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/support")({
  component: SupportPage,
});

function SupportPage() {
  const { user, companyId, isPlatformAdmin } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: tickets = [] } = useQuery({
    queryKey: ["support-tickets", isPlatformAdmin ? "all" : user?.id],
    queryFn: async () => {
      let q = (supabase as any).from("support_tickets").select("*").order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!subject.trim() || !message.trim()) throw new Error("Мавзӯъ ва матни мушкилро нависед");
      let screenshot_url: string | null = null;
      if (file) {
        const path = `${user!.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("notification-media").upload(path, file);
        if (upErr) throw upErr;
        const { data } = await supabase.storage.from("notification-media").createSignedUrl(path, 60 * 60 * 24 * 365);
        screenshot_url = data?.signedUrl ?? null;
      }
      const { error } = await (supabase as any).from("support_tickets").insert({
        user_id: user!.id, company_id: companyId, subject, message, screenshot_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Мушкил фиристода шуд");
      setSubject(""); setMessage(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reply = useMutation({
    mutationFn: async ({ id, admin_reply, status }: { id: string; admin_reply: string; status: string }) => {
      const { error } = await (supabase as any).from("support_tickets").update({ admin_reply, status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Захира шуд"); qc.invalidateQueries({ queryKey: ["support-tickets"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Дастгирӣ (Исправчник)" subtitle="Мушкилиро ба Super Admin гузориш диҳед" />

      {!isPlatformAdmin && (
        <Card className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Мавзӯъ *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="кутоҳ дар бораи мушкил" />
          </div>
          <div className="space-y-1.5">
            <Label>Матни мушкил *</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="муфассал баён кунед..." />
          </div>
          <div className="space-y-1.5">
            <Label>Сурати экран (ихтиёрӣ)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Send className="h-4 w-4 mr-2" />Фиристодан
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><LifeBuoy className="h-4 w-4" />
          {isPlatformAdmin ? "Ҳамаи мушкилот" : "Мушкилоти ман"}
        </h3>
        {tickets.length === 0 && <p className="text-sm text-muted-foreground">Ҳанӯз чизе нест</p>}
        {tickets.map((t: any) => (
          <TicketRow key={t.id} ticket={t} isPlatformAdmin={isPlatformAdmin} onReply={reply.mutate} />
        ))}
      </div>
    </div>
  );
}

function TicketRow({ ticket, isPlatformAdmin, onReply }: { ticket: any; isPlatformAdmin: boolean; onReply: (v: any) => void }) {
  const [reply, setReply] = useState(ticket.admin_reply ?? "");
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{ticket.subject}</div>
          <div className="text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleString()}</div>
        </div>
        <Badge variant={ticket.status === "closed" ? "default" : "secondary"}>
          {ticket.status === "closed" ? <><CheckCircle2 className="h-3 w-3 mr-1" />Ҳал шуд</> : <><Clock className="h-3 w-3 mr-1" />Кушода</>}
        </Badge>
      </div>
      <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
      {ticket.screenshot_url && (
        <a href={ticket.screenshot_url} target="_blank" rel="noreferrer">
          <img src={ticket.screenshot_url} alt="screenshot" className="max-w-xs rounded border" />
        </a>
      )}
      {ticket.admin_reply && (
        <div className="rounded bg-muted/50 p-2 text-sm">
          <div className="text-xs font-semibold mb-1">Ҷавоби Super Admin:</div>
          {ticket.admin_reply}
        </div>
      )}
      {isPlatformAdmin && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Ҷавоб..." />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onReply({ id: ticket.id, admin_reply: reply, status: "open" })}>Ҷавоб додан</Button>
            <Button size="sm" variant="outline" onClick={() => onReply({ id: ticket.id, admin_reply: reply, status: "closed" })}>Ҳал шуд</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
