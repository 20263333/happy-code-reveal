import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/site/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Binosoz.tj — Идоракунии сохтмон" },
      {
        name: "description",
        content:
          "Барномаи муосир барои ширкатҳои сохтмонӣ: лоиҳа, фурӯш, пардохт, анбор, смета, табел ва ҳисобот дар як система.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Binosoz.tj — ERP/CRM для застройщиков" },
      {
        property: "og:description",
        content:
          "Ведите проекты, продажи квартир, рассрочки, склад и финансы строительной компании в одной системе.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Binosoz.tj — ERP/CRM для застройщиков" },
      {
        name: "twitter:description",
        content:
          "Проекты, продажи квартир, рассрочки, склад и финансы строительной компании в одной системе.",
      },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Binosoz.tj",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://binosoz.tj/",
          description:
            "ERP/CRM для строительных компаний: проекты, продажи квартир, рассрочка, платежи, склад, смета, табель и отчёты.",
          inLanguage: ["tg", "ru", "zh"],
        }),
      },
    ],
  }),
  component: LandingPage,
});
