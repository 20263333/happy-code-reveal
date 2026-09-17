import { useEffect, useRef, useState, createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, X, Loader2, Trash2, Mic, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { sendAiChatMessage, getAiChatHistory, getAiCredits, clearAiChatHistory } from "@/lib/ai-chat.functions";
import { transcribeAudio } from "@/lib/ai-transcribe.functions";

interface AiAssistantContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const AiAssistantContext = createContext<AiAssistantContextValue>({ open: false, setOpen: () => {} });

export function AiAssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AiAssistantContext.Provider value={{ open, setOpen }}>
      {children}
    </AiAssistantContext.Provider>
  );
}

export function AiAssistantButton({ show }: { show?: boolean }) {
  const { open, setOpen } = useContext(AiAssistantContext);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors"
      aria-label="AI Ёрдамчӣ"
      title="AI Ёрдамчӣ"
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
}

export function AiAssistant() {
  const { open, setOpen } = useContext(AiAssistantContext);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const sendFn = useServerFn(sendAiChatMessage);
  const historyFn = useServerFn(getAiChatHistory);
  const creditsFn = useServerFn(getAiCredits);
  const clearFn = useServerFn(clearAiChatHistory);
  const transcribeFn = useServerFn(transcribeAudio);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) { toast.error("Сабт хеле кӯтоҳ буд"); return; }
        setTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          let bin = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const base64 = btoa(bin);
          const res = await transcribeFn({ data: { base64, mime: blob.type } });
          const text = (res?.text ?? "").trim();
          if (text) setInput((prev) => (prev ? prev + " " : "") + text);
          else toast.error("Матн ёфт нашуд");
        } catch (e: any) {
          toast.error(e?.message ?? "Хатогии транскрипсия");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Дастрасӣ ба микрофон нест");
      stopTracks();
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const { data: history = [] } = useQuery({
    queryKey: ["ai-chat-history"],
    queryFn: () => historyFn(),
    enabled: open,
  });
  const { data: credits } = useQuery({
    queryKey: ["ai-credits"],
    queryFn: () => creditsFn(),
    enabled: open,
  });

  const send = useMutation({
    mutationFn: (text: string) => {
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      const match = path.match(/\/projects\/([0-9a-fA-F-]{36})(?:\/|$)/);
      return sendFn({ data: { text, currentProjectId: match?.[1] ?? null, currentPath: path } });
    },
    onMutate: async (text: string) => {
      await qc.cancelQueries({ queryKey: ["ai-chat-history"] });
      const prev = qc.getQueryData<any[]>(["ai-chat-history"]) ?? [];
      const optimistic = [
        ...prev,
        { id: `tmp-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
      ];
      qc.setQueryData(["ai-chat-history"], optimistic);
      setInput("");
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-chat-history"] });
      qc.invalidateQueries({ queryKey: ["ai-credits"] });
      // AI may touch many modules — refresh broadly.
      for (const key of [
        "floors", "project-blocks", "project", "projects", "apartments",
        "customers", "sales", "payments", "debtors", "expenses",
        "workers", "suppliers", "subcontractors", "equipment",
        "payables", "warehouse-items", "warehouse-receipts", "warehouse-issues",
        "materials", "material-movements", "project-stages", "stages",
        "dashboard", "company-summary",
      ]) qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e: any, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["ai-chat-history"], ctx.prev);
      const msg = e?.message ?? "";
      if (msg.includes("no_credits")) {
        toast.error("Кредитҳо тамом шуданд. Пакет харидорӣ кунед: /ai-credits");
      } else {
        toast.error(msg || "Хатогӣ");
      }
    },
  });

  const clear = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-chat-history"] }),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, send.isPending]);

  const submit = () => {
    const t = input.trim();
    if (!t || send.isPending) return;
    send.mutate(t);
  };

  const freeLeft = credits ? Math.max(0, credits.free_limit - credits.free_used) : 0;
  const totalLeft = freeLeft + (credits?.paid_balance ?? 0);

  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[min(600px,90vh)] w-[min(400px,95vw)] flex-col rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold text-sm">AI Ёрдамчӣ</div>
            <div className="text-[10px] text-muted-foreground">
              {credits ? `${freeLeft}/${credits.free_limit} ройгон · ${credits.paid_balance} харидашуда` : "…"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => clear.mutate()} title="Тоза кардан" disabled={!history.length}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div ref={scrollRef} className="space-y-3 h-full">
          {history.length === 0 && !send.isPending && (
            <div className="text-center text-sm text-muted-foreground py-8 space-y-2">
              <Sparkles className="h-8 w-8 mx-auto text-primary/50" />
              <p className="font-medium">Салом! Ман ёрдамчии AI-и шумо</p>
              <p className="text-xs">Ба ҳамаи модулҳо дастрасӣ дорам: лоиҳа, фурӯш, пардохт, хароҷот, склад, коргарон ва ғайра</p>
              <div className="text-xs text-left space-y-1 mt-4 mx-auto max-w-[260px]">
                <p className="text-muted-foreground">Мисолҳо:</p>
                <p>• "Муштарии нав: Али, +992 900..."</p>
                <p>• "Квартираи 12-ро ба Али фурӯхтем 500000 сом"</p>
                <p>• "Хароҷоти 5000 сом. барои цемент сабт кун"</p>
                <p>• "Кӣ ба ман қарздор аст?"</p>
                <p>• "Хулосаи умумии ширкат"</p>
              </div>

            </div>
          )}
          {history.map((m: any) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            </div>
          ))}
          {send.isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3">
        {totalLeft === 0 && (
          <div className="mb-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            Кредитҳо тамом шуданд. Пакет харидорӣ кунед: <a href="/ai-credits" className="underline">AI Кредитҳо</a>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder={transcribing ? "Транскрипсия…" : recording ? "Сабт шуда истодааст…" : "Паём нависед…"}
            rows={1}
            className="resize-none min-h-[40px] max-h-32"
            disabled={send.isPending || totalLeft === 0 || recording || transcribing}
          />
          <Button
            size="icon"
            variant={recording ? "destructive" : "outline"}
            onClick={recording ? stopRecording : startRecording}
            disabled={send.isPending || totalLeft === 0 || transcribing}
            title={recording ? "Сабтро қатъ кун" : "Овоз сабт кун"}
          >
            {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button size="icon" onClick={submit} disabled={!input.trim() || send.isPending || totalLeft === 0 || recording || transcribing}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
