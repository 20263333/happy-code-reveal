import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/blog/accounting-guide")({
  head: () => ({
    meta: [
      { title: "Бухгалтерский учёт в строительстве: полное руководство — Binosoz.tj" },
      {
        name: "description",
        content:
          "Как вести бухгалтерский учёт в строительной компании: контроль расходов, документооборот, учёт проектов и материалов. Практическое руководство от Binosoz.tj.",
      },
      { property: "og:title", content: "Бухгалтерский учёт в строительстве — руководство" },
      {
        property: "og:description",
        content:
          "Практическое руководство по бухгалтерскому учёту для застройщиков: расходы, склад, сметы и продажи в одной системе.",
      },
      { property: "og:url", content: "https://binosoz.tj/blog/accounting-guide" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://binosoz.tj/blog/accounting-guide" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Бухгалтерский учёт в строительстве: полное руководство",
          description:
            "Как вести бухгалтерский учёт в строительной компании: контроль расходов, документооборот, учёт проектов и материалов.",
          author: { "@type": "Organization", name: "Binosoz.tj" },
          publisher: {
            "@type": "Organization",
            name: "Binosoz.tj",
            logo: { "@type": "ImageObject", url: "https://binosoz.tj/icon-192.png" },
          },
          mainEntityOfPage: "https://binosoz.tj/blog/accounting-guide",
          inLanguage: "ru",
        }),
      },
    ],
  }),
  component: AccountingGuidePage,
});

function AccountingGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-base font-semibold">
            Binosoz.tj
          </Link>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Войти
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> На главную
        </Link>

        <article className="prose prose-neutral max-w-none dark:prose-invert">
          <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
            Бухгалтерский учёт в строительстве: полное руководство для застройщиков
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Практика, инструменты и типовые ошибки. Как строительной компании навести порядок в
            деньгах, документах и проектах.
          </p>

          <section className="mt-8 space-y-4 text-[15px] leading-7 text-foreground/90">
            <h2 className="font-display text-2xl font-semibold">Почему учёт в стройке сложнее</h2>
            <p>
              Строительная компания одновременно ведёт несколько проектов, десятки поставщиков,
              бригады и субподрядчиков, склад материалов и продажи квартир по рассрочке. Обычная
              бухгалтерия «в тетради» или Excel быстро перестаёт справляться: расходы теряются,
              долги перед поставщиками путаются, а по итогам квартала невозможно понять, какой ЖК
              приносит прибыль, а какой — убыток.
            </p>

            <h2 className="font-display text-2xl font-semibold">Ключевые блоки учёта</h2>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <b>Учёт по проектам (ЖК и блокам).</b> Каждый расход, платёж, приход материалов и
                продажа привязаны к конкретному проекту, блоку и этажу.
              </li>
              <li>
                <b>Склад и материалы.</b> Приход, расход и остатки в реальном времени, чтобы прораб
                не заказывал повторно уже купленный цемент.
              </li>
              <li>
                <b>Смета и факт.</b> Плановая смета сравнивается с фактическими расходами — сразу
                видно перерасход.
              </li>
              <li>
                <b>Продажи и рассрочка.</b> График платежей клиента, автоматические напоминания и
                учёт задолженностей.
              </li>
              <li>
                <b>Поставщики и подрядчики.</b> Долги, акты выполненных работ, платежи по договорам.
              </li>
              <li>
                <b>Зарплата и табель.</b> Учёт рабочих часов бригад и выплат.
              </li>
            </ul>

            <h2 className="font-display text-2xl font-semibold">Типовые ошибки</h2>
            <ol className="ml-5 list-decimal space-y-2">
              <li>Расходы копятся «в общий котёл» без привязки к проекту.</li>
              <li>Склад и бухгалтерия ведутся в разных файлах — остатки не сходятся.</li>
              <li>Продажи и рассрочки в мессенджерах — платежи забываются.</li>
              <li>Нет разграничения ролей: доступ ко всему у всех.</li>
              <li>Документы (чеки, договоры) хранятся у прораба в телефоне.</li>
            </ol>

            <h2 className="font-display text-2xl font-semibold">
              Как Binosoz.tj решает эти задачи
            </h2>
            <p>
              Binosoz.tj — это ERP/CRM для строительных компаний Таджикистана. Данные каждой
              компании изолированы, доступ разграничен по ролям (владелец, бухгалтер, складчик,
              прораб, директор), а все модули работают в одной системе:
            </p>
            <ul className="ml-5 list-none space-y-2">
              {[
                "Проекты, блоки, этажи, квартиры — единая иерархия учёта.",
                "Расходы и платежи с фильтром по ЖК и блоку, печатью и экспортом.",
                "Склад с приходом/расходом и автоматическим списанием на проект.",
                "Смета: планируемые статьи против фактических расходов.",
                "Продажи квартир, рассрочка, автоматические SMS о платежах.",
                "Долги перед поставщиками и должники клиентов — в один клик.",
                "Роли и права: бухгалтер видит финансы, складчик — только склад.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <h2 className="font-display text-2xl font-semibold">С чего начать</h2>
            <p>
              Заведите одну компанию в системе, добавьте первый ЖК с блоками и этажами, перенесите
              открытые долги и активные рассрочки. Дальше учёт наполняется сам — каждый платёж и
              расход, введённый сотрудниками, сразу попадает в отчёты владельца.
            </p>
          </section>

          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">
              Попробуйте Binosoz.tj для своей компании
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Регистрация занимает пару минут — войдите через Google и оставьте заявку на
              подключение компании.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Начать работу
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
