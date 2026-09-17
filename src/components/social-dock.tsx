import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, MessageCircle, Send, Share2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SocialLinks = { whatsapp?: string; facebook?: string; instagram?: string; telegram?: string };

const DEFS = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "#25D366" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  {
    id: "instagram",
    label: "Instagram",
    icon: Instagram,
    gradient: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  },
  { id: "telegram", label: "Telegram", icon: Send, color: "#0088cc" },
] as const;

export function SocialDock() {
  const [open, setOpen] = useState(false);

  const { data: links } = useQuery<SocialLinks>({
    queryKey: ["platform_settings", "social_links"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "social_links")
        .maybeSingle();
      return (data?.value ?? {}) as SocialLinks;
    },
    staleTime: 60_000,
  });

  const items = DEFS.map((d) => ({ ...d, href: (links?.[d.id as keyof SocialLinks] ?? "").trim() })).filter(
    (d) => d.href,
  );

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-center gap-2">
      {open &&
        items.map((link, idx) => {
          const Icon = link.icon;
          return (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:scale-110"
              style={{
                background: (link as any).gradient ?? (link as any).color,
                animationDelay: `${idx * 50}ms`,
              }}
              aria-label={link.label}
              title={link.label}
            >
              <Icon className="h-5 w-5" />
            </a>
          );
        })}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
        aria-label={open ? "Пинҳон кардани алоқа" : "Алоқаи иҷтимоӣ"}
        title={open ? "Пинҳон кардан" : "Алоқаи иҷтимоӣ"}
      >
        {open ? <X className="h-6 w-6" /> : <Share2 className="h-6 w-6" />}
      </button>
    </div>
  );
}
