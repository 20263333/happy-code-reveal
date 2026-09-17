import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, createRootRouteWithContext, HeadContent, Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { PreferencesProvider } from "@/lib/preferences";
import { InstallPrompt } from "@/components/install-prompt";
import { setupQueryPersistence } from "@/lib/query-persist";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#13315c" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Binosoz.tj" },
      { title: "Binosoz.tj — Управление застройкой" },
      { name: "description", content: "ERP/CRM для строительных компаний: проекты, продажи квартир, платежи и расходы." },
      { property: "og:title", content: "Binosoz.tj — Управление застройкой" },
      { name: "twitter:title", content: "Binosoz.tj — Управление застройкой" },
      { property: "og:description", content: "ERP/CRM для строительных компаний: проекты, продажи квартир, платежи и расходы." },
      { name: "twitter:description", content: "ERP/CRM для строительных компаний: проекты, продажи квартир, платежи и расходы." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/cvQCMZ1TEmXLGjzWHZFvt0umYkc2/social-images/social-1782659498572-1000072133.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/cvQCMZ1TEmXLGjzWHZFvt0umYkc2/social-images/social-1782659498572-1000072133.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "shortcut icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Binosoz.tj",
          url: "https://binosoz.tj",
          logo: "https://binosoz.tj/icon-192.png",
          description: "ERP/CRM для строительных компаний Таджикистана.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Binosoz.tj",
          url: "https://binosoz.tj",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Binosoz.tj",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: "ERP/CRM платформа для застройщиков: проекты, продажи, платежи, склад, смета.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "TJS" },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="font-display text-6xl font-semibold">404</h1>
        <p className="mt-2 text-muted-foreground">Страница не найдена</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">На главную</a>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => {
    console.error(error);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-xl font-semibold">Что-то пошло не так</h1>
          <p className="mt-2 text-sm text-muted-foreground">Обновите страницу или вернитесь на главную.</p>
          <a href="/" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">На главную</a>
        </div>
      </div>
    );
  },
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { setupQueryPersistence(queryClient); }, [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <I18nProvider>
          <TooltipProvider>
            <Outlet />
            <InstallPrompt />
            <Toaster position="top-right" richColors />
          </TooltipProvider>
        </I18nProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
