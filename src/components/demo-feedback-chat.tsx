import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function DemoFeedbackChat() {
  const { user, companyId } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["demo-feedback-mine", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("demo_feedback")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && open,
  });

  const send = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await (supabase as any).from("demo_feedback").insert({
        user_id: user!.id,
        company_id: companyId ?? null,
        message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["demo-feedback-mine"] });
      toast.success("Ташаккур! Пешниҳоди шумо ба Super Admin равон шуд.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items, open]);

  const submit = () => {
    const t = text.trim();
    if (!t || send.isPending) return;
    send.mutate(t);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:scale-105 transition-transform"
          aria-label="Пешниҳод"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[min(600px,90vh)] w-[min(400px,95vw)] flex-col rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold text-sm">Фикру пешниҳод</div>
                <div className="text-[10px] text-muted-foreground">Ба Super Admin равон мешавад</div>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-3">
            <div ref={scrollRef} className="space-y-3">
              {items.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8 space-y-2">
                  <MessageSquare className="h-8 w-8 mx-auto text-primary/50" />
                  <p className="font-medium">Пешниҳоди худро нависед</p>
                  <p className="text-xs">Кадом имконият ба барнома илова шавад? Чӣ намерасад?</p>
                </div>
              )}
              {items.map((m: any) => (
                <div key={m.id} className="space-y-1">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">
                      {m.message}
                    </div>
                  </div>
                  {m.admin_reply && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl bg-muted text-foreground px-3 py-2 text-sm whitespace-pre-wrap">
                        <div className="text-[10px] font-semibold text-primary mb-1">Super Admin</div>
                        {m.admin_reply}
                      </div>
                    </div>
                  )}
                  {m.is_resolved && (
                    <div className="flex justify-end">
                      <div className="flex items-center gap-1 text-[10px] text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Ҳал шуд
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Пешниҳоди худро нависед…"
                rows={1}
                className="resize-none min-h-[40px] max-h-32"
                disabled={send.isPending}
              />
              <Button size="icon" onClick={submit} disabled={!text.trim() || send.isPending}>
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
