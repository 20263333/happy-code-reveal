import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/site/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Binosoz.tj — ERP/CRM для строительных компаний" },
      {
        name: "description",
        content:
          "Платформа для застройщиков Таджикистана: проекты и квартиры, продажи и рассрочка, платежи, склад, смета, табель и отчёты в одной системе.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Binosoz.tj — ERP/CRM для застройщиков" },
      {
        property: "og:description",
        content:
          "Ведите проекты, продажи квартир, рассрочки, склад и финансы строительной компании в одной системе.",
      },
      { property: "og:url", content: "https://binosoz.tj/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Binosoz.tj — ERP/CRM для застройщиков" },
      {
        name: "twitter:description",
        content:
          "Проекты, продажи квартир, рассрочки, склад и финансы строительной компании в одной системе.",
      },
    ],
    links: [{ rel: "canonical", href: "https://binosoz.tj/" }],
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
