import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  Clock3,
  CreditCard,
  FileSignature,
  Filter,
  HardHat,
  Languages,
  Lock,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAppLogo } from "@/lib/app-logos";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { getStableSession } from "@/lib/auth-session";
import dashboardShot from "@/assets/product/dashboard.png";
import warehouseShot from "@/assets/product/warehouse.png";

type Module = { icon: ComponentType<{ className?: string }>; title: string; text: string };

const MODULES: Module[] = [
  { icon: Building2, title: "Проекты и блоки", text: "Проект → блок → этаж → квартира. Наглядная шахматка со статусами квартир." },
  { icon: Wallet, title: "Продажи и рассрочка", text: "Договор, первый взнос, график рассрочки на любое число месяцев и контроль оплат." },
  { icon: Filter, title: "CRM-воронка", text: "Заявки клиентов, этапы сделки и напоминания менеджерам." },
  { icon: CreditCard, title: "Платежи и должники", text: "Приход денег, просрочки и автоматические напоминания в WhatsApp и СМС." },
  { icon: Calculator, title: "Смета", text: "Версии сметы, автоматический расчёт и сравнение плана с фактом." },
  { icon: Boxes, title: "Склад", text: "Приход, расход и остатки материалов; списание прямо на проект." },
  { icon: Truck, title: "Снабжение", text: "Заявки на материалы от прорабов и контроль закупок." },
  { icon: Clock3, title: "Табель и посещаемость", text: "Отметка рабочих на объекте через киоск-экран и расчёт смен." },
  { icon: HardHat, title: "Сотрудники и роли", text: "Владелец, бухгалтер, складчик, прораб — у каждого свой доступ." },
  { icon: FileSignature, title: "Договоры и разрешения", text: "Шаблоны договоров, сроки разрешительных документов и напоминания." },
  { icon: BarChart3, title: "Отчёты и налоги", text: "Выручка, расходы, прибыль по проектам и налоговые отчёты." },
  { icon: MessageCircle, title: "WhatsApp и СМС", text: "Автоматические уведомления клиентам о платежах и напоминания." },
];

const SCREENS: { id: string; label: string; image?: string; title: string }[] = [
  { id: "dashboard", label: "Дашборд директора", image: dashboardShot, title: "Ключевые цифры компании на одном экране в реальном времени." },
  { id: "chess", label: "Шахматка квартир", title: "Проект → блок → этаж → квартира. Наглядная шахматка со статусами квартир." },
  { id: "warehouse", label: "Склад", image: warehouseShot, title: "Приход, расход и остатки материалов; списание прямо на проект." },
];


const PROBLEMS = [
  {
    tone: "primary" as const,
    role: "Застройщик",
    title: "Продажи живут в Excel и чатах",
    items: [
      ["Excel вместо CRM", "У каждого менеджера свой файл. Клиенты и история сделок теряются."],
      ["WhatsApp вместо системы", "Квартиру забронировали в чате. Кто, когда и на каких условиях — никто не помнит."],
      ["Бумажные договоры", "Каждый договор — час правок: опечатки, реквизиты и версии документа."],
      ["Нет аналитики", "Сколько заработали и где теряем деньги — становится ясно слишком поздно."],
    ],
  },
  {
    tone: "success" as const,
    role: "Стройка и склад",
    title: "Расходы считают в тетради",
    items: [
      ["Материалы без учёта", "Цемент привезли, часть пропала — остатки никто не сверяет."],
      ["Рабочие без табеля", "Кто вышел на объект и сколько смен — считают по памяти."],
      ["Смета отдельно от факта", "План в одном файле, реальные расходы — в другом."],
      ["Долги клиентов", "Кто просрочил рассрочку, узнаёте только в конце месяца."],
    ],
  },
];

const FAQ = [
  ["Как начать работать?", "Регистрируете компанию, добавляете первый проект — и система готова. Обучение занимает один день."],
  ["Работает ли на телефоне?", "Да. Система открывается в браузере телефона, планшета и компьютера без установки."],
  ["На каких языках интерфейс?", "Русский, таджикский и English — язык переключается одной кнопкой."],
  ["Данные в безопасности?", "Данные каждой компании изолированы, доступ по ролям, документы хранятся приватно."],
];

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        node.dataset.visible = "true";
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`bp-reveal ${className}`}>{children}</div>;
}

function BrowserFrame({ children, imageKey }: { children: ReactNode; imageKey?: string }) {
  return (
    <div className="bino-frame">
      <div className="bino-frame-bar flex items-center gap-2 px-4 py-3">
        <span className="bino-dot bg-destructive/70" />
        <span className="bino-dot bg-warning/80" />
        <span className="bino-dot bg-success/70" />
        <span className="mx-auto rounded-full bg-background px-4 py-1 text-[11px] text-muted-foreground">binosoz.tj</span>
      </div>
      <div key={imageKey} className="bino-screen-image">{children}</div>
    </div>
  );
}

function ChessMock({ label }: { label: (s: string) => string }) {
  const columns = [1, 2, 3, 4, 5, 6];
  const rows = [
    { floor: 9, cells: [
      { number: 901, area: 72, status: "installment" },
      { number: 902, area: 64, status: "sold" },
      { number: 903, area: 88, status: "available" },
      { number: 904, area: 54, status: "available" },
      { number: 905, area: 78, status: "sold" },
      { number: 906, area: 61, status: "unavailable" },
    ] },
    { floor: 8, cells: [
      { number: 801, area: 72, status: "available" },
      { number: 802, area: 64, status: "installment" },
      { number: 803, area: 88, status: "sold" },
      { number: 804, area: 54, status: "available" },
      { number: 805, area: 78, status: "available" },
      { number: 806, area: 61, status: "sold" },
    ] },
    { floor: 7, cells: [
      { number: 701, area: 72, status: "sold" },
      { number: 702, area: 64, status: "available" },
      { number: 703, area: 88, status: "installment" },
      { number: 704, area: 54, status: "unavailable" },
      { number: 705, area: 78, status: "available" },
      { number: 706, area: 61, status: "available" },
    ] },
    { floor: 6, cells: [
      { number: 601, area: 72, status: "available" },
      { number: 602, area: 64, status: "sold" },
      { number: 603, area: 88, status: "available" },
      { number: 604, area: 54, status: "installment" },
      { number: 605, area: 78, status: "sold" },
      { number: 606, area: 61, status: "available" },
    ] },
  ];
  const tone: Record<string, string> = {
    available: "bg-success text-success-foreground border-success",
    installment: "bg-info text-primary-foreground border-info",
    sold: "bg-destructive text-destructive-foreground border-destructive",
    unavailable: "bg-warning text-warning-foreground border-warning",
  };
  const statusLabel: Record<string, string> = {
    available: "Свободно",
    installment: "Рассрочка",
    sold: "Продано",
    unavailable: "Недоступно",
  };
  return (
    <div className="bg-background p-4 text-left text-foreground md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-extrabold">{label("Шахматка квартир")}</div>
          <div className="text-xs text-muted-foreground">{label("Проект → блок → этаж → квартира")}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {Object.entries(statusLabel).map(([status, text]) => (
            <span key={status} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-semibold">
              <span className={`h-2 w-2 rounded-full ${tone[status].split(" ")[0]}`} />
              {label(text)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card p-3">
        <table className="w-full min-w-[680px] border-separate border-spacing-2 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-20 rounded-lg bg-muted px-3 py-3 text-left text-xs font-bold text-muted-foreground">{label("Этаж")}</th>
              {columns.map((column) => (
                <th key={column} className="rounded-lg bg-muted px-3 py-3 text-center text-xs font-bold text-muted-foreground">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.floor}>
                <td className="sticky left-0 z-10 rounded-lg bg-muted px-3 py-4 text-center font-display text-lg font-extrabold">{row.floor}</td>
                {row.cells.map((cell) => (
                  <td key={cell.number}>
                    <div className={`min-h-20 rounded-xl border p-3 text-center shadow-sm ${tone[cell.status]}`}>
                      <div className="text-xs font-bold">№{cell.number}</div>
                      <div className="mt-1 text-[11px] opacity-90">{cell.area} м²</div>
                      <div className="mt-2 text-[10px] font-semibold opacity-90">{label(statusLabel[cell.status])}</div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { tr } = useT();
  const logoUrl = useAppLogo("light");
  const [signedIn, setSignedIn] = useState(false);
  const [screen, setScreen] = useState(SCREENS[0]);

  useEffect(() => {
    let active = true;
    getStableSession().then((session) => active && setSignedIn(Boolean(session)));
    return () => { active = false; };
  }, []);

  return (
    <div className="bino-site min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Binosoz.tj">
            <img src={logoUrl} alt="Binosoz.tj" className="h-8 w-8 object-contain" />
            <span className="font-display text-lg font-extrabold tracking-tight">Binosoz<span className="text-primary">.tj</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
            <a href="#problem" className="bino-nav-link">{tr("Проблемы")}</a>
            <a href="#product" className="bino-nav-link">{tr("Возможности")}</a>
            <a href="#modules" className="bino-nav-link">{tr("Модули")}</a>
            <a href="#how" className="bino-nav-link">{tr("Как это работает")}</a>
            <a href="#faq" className="bino-nav-link">{tr("Вопросы")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main id="top" className="pt-16">
        <section className="relative overflow-hidden px-5 pb-16 pt-14 lg:px-8 lg:pt-20">
          <div className="bino-glow pointer-events-none absolute left-1/2 top-40 h-[560px] w-[1100px] -translate-x-1/2 opacity-30" />
          <div className="relative mx-auto max-w-5xl text-center animate-fade-in">
            <h1 className="font-display text-4xl font-extrabold uppercase leading-[1.02] sm:text-6xl lg:text-7xl">
              <span className="text-primary">{tr("От продажи квартир")}</span>
              <br />
              {tr("до управления стройкой")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
              {tr("Единая система для строительной компании: проекты, продажи, рассрочка, платежи, склад, смета, табель и отчёты.")}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                <Link to="/auth">{signedIn ? tr("Открыть систему") : tr("Начать бесплатно")}<ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-7 text-base">
                <a href="#product">{tr("Смотреть систему")}</a>
              </Button>
            </div>
          </div>
          <Reveal className="relative mx-auto mt-14 max-w-6xl">
            <BrowserFrame><img src={dashboardShot} alt={tr("Дашборд директора")} className="w-full" /></BrowserFrame>
          </Reveal>
          <div className="relative mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-6 text-center md:grid-cols-4">
            {[["22+", "модулей в системе"], ["3", "языка интерфейса"], ["24/7", "доступ из любой точки"], ["1", "единая система"]].map(([value, label]) => (
              <div key={label}>
                <div className="font-display text-3xl font-extrabold text-primary">{value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{tr(label)}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="problem" className="scroll-mt-20 px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-widest text-destructive">{tr("Проблема")}</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Знакомая ситуация?")}</h2>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">{tr("Если хотя бы один пункт про вашу компанию — Binosoz.tj заменит таблицы, чаты и стопки бумаг.")}</p>
            </Reveal>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {PROBLEMS.map((block) => (
                <Reveal key={block.title}>
                  <div className="h-full rounded-3xl bg-card p-6 md:p-8">
                    <div className={`text-xs font-bold uppercase tracking-widest ${block.tone === "primary" ? "text-primary" : "text-success"}`}>{tr(block.role)}</div>
                    <h3 className="mt-3 font-display text-xl font-bold md:text-2xl">{tr(block.title)}</h3>
                    <div className="mt-6 space-y-3">
                      {block.items.map(([title, text]) => (
                        <div key={title} className="rounded-2xl bg-background p-4">
                          <div className="text-sm font-semibold">{tr(title)}</div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{tr(text)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bino-band px-5 py-20 text-primary-foreground lg:px-8">
          <Reveal className="mx-auto max-w-7xl text-center">
            <h2 className="font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Одна система — вся компания")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-primary-foreground/80 md:text-base">{tr("Binosoz.tj закрывает весь цикл: от первой заявки клиента до последнего отчёта по прибыли.")}</p>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {[[Building2, "Продажи", "CRM, шахматка, договоры"], [RefreshCw, "Полный цикл", "2 в 1"], [Boxes, "Стройка", "Склад, смета, табель"]].map(([Icon, title, text]) => {
                const ItemIcon = Icon as ComponentType<{ className?: string }>;
                return (
                  <div key={title as string} className="flex flex-col items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/15"><ItemIcon className="h-7 w-7" /></div>
                    <div className="mt-4 text-xs uppercase tracking-widest text-primary-foreground/70">{tr(text as string)}</div>
                    <div className="mt-1 font-display text-xl font-bold">{tr(title as string)}</div>
                  </div>
                );
              })}
            </div>
            <div className="mx-auto mt-14 max-w-5xl">
              <BrowserFrame><ChessMock label={tr} /></BrowserFrame>
            </div>
          </Reveal>
        </section>

        <section id="product" className="scroll-mt-20 px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">{tr("Система изнутри")}</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Вся стройка видна на одном экране")}</h2>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">{tr("Продажи, платежи и расходы сразу видны в отчётах и на дашборде.")}</p>
            </Reveal>
            <Reveal className="mt-10">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={tr("Разделы системы")}>
                {SCREENS.map((item) => (
                  <Button
                    key={item.id}
                    variant={screen.id === item.id ? "default" : "outline"}
                    onClick={() => setScreen(item)}
                    role="tab"
                    aria-selected={screen.id === item.id}
                    className="rounded-full px-5"
                  >
                    {tr(item.label)}
                  </Button>
                ))}
              </div>
              <div className="mt-6">
                <BrowserFrame imageKey={screen.id}>
                  {screen.image
                    ? <img src={screen.image} alt={tr(screen.label)} className="w-full" loading="lazy" />
                    : <ChessMock label={tr} />}
                </BrowserFrame>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{tr(screen.title)}</p>
            </Reveal>
          </div>
        </section>

        <section id="modules" className="scroll-mt-20 bg-card px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">{tr("Платформа")}</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Всё, что нужно застройщику")}</h2>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">{tr("Каждый модуль можно включить по мере роста компании — начните с проектов и продаж.")}</p>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map(({ icon: Icon, title, text }) => (
                <Reveal key={title} className="h-full">
                  <article className="bino-card h-full rounded-2xl border border-border bg-background p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="mt-5 font-display text-base font-bold">{tr(title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{tr(text)}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <Reveal>
              <div className="text-xs font-bold uppercase tracking-widest text-primary">{tr("Рабочий процесс")}</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Запуск за один день")}</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">{tr("Работает на телефоне и компьютере")}. {tr("Русский, таджикский и English")}.</p>
              <Button asChild size="lg" className="mt-7 h-12 rounded-full px-7">
                <Link to="/auth">{signedIn ? tr("Открыть систему") : tr("Начать бесплатно")}<ArrowRight /></Link>
              </Button>
            </Reveal>
            <div className="grid gap-4">
              {[
                ["01", "Регистрируете компанию", "Создаёте аккаунт владельца и получаете свою изолированную базу."],
                ["02", "Добавляете проект и квартиры", "Блоки, этажи, квартиры и цены — шахматка строится автоматически."],
                ["03", "Подключаете сотрудников", "Каждому сотруднику — своя роль и доступ только к своим данным."],
                ["04", "Работаете и смотрите цифры", "Продажи, платежи и расходы сразу видны в отчётах и на дашборде."],
              ].map(([number, title, text]) => (
                <Reveal key={number}>
                  <div className="flex gap-5 rounded-2xl bg-card p-6">
                    <span className="font-display text-xl font-extrabold text-primary">{number}</span>
                    <div>
                      <h3 className="font-display text-base font-bold">{tr(title)}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{tr(text)}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 lg:px-8">
          <Reveal className="mx-auto grid max-w-7xl gap-10 rounded-3xl bg-card p-8 lg:grid-cols-2 lg:items-center lg:p-12">
            <div>
              <ShieldCheck className="h-10 w-10 text-primary" />
              <h2 className="mt-5 font-display text-2xl font-extrabold md:text-4xl">{tr("Данные вашей компании под защитой")}</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">{tr("Доступ по ролям, изоляция данных между компаниями, приватное хранение документов и проверка прав на стороне сервера при каждом запросе.")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[[Lock, "Данные каждой компании изолированы"], [Users, "Доступ по ролям"], [Smartphone, "Работает на телефоне и компьютере"], [Languages, "Русский, таджикский и English"]].map(([Icon, label]) => {
                const FeatureIcon = Icon as ComponentType<{ className?: string }>;
                return (
                  <div key={label as string} className="flex items-center gap-3 rounded-2xl bg-background p-4">
                    <FeatureIcon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm font-medium">{tr(label as string)}</span>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </section>

        <section id="faq" className="scroll-mt-20 px-5 pb-20 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <Reveal>
              <h2 className="text-center font-display text-3xl font-extrabold uppercase md:text-4xl">{tr("Частые вопросы")}</h2>
            </Reveal>
            <div className="mt-8 space-y-3">
              {FAQ.map(([question, answer]) => (
                <Reveal key={question}>
                  <details className="group rounded-2xl border border-border bg-card p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold md:text-base">
                      {tr(question)}
                      <Check className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{tr(answer)}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 lg:px-8">
          <Reveal className="bino-band mx-auto max-w-7xl rounded-3xl px-6 py-16 text-center text-primary-foreground">
            <h2 className="font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Готовы навести порядок в компании?")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-primary-foreground/80">{tr("Создайте аккаунт и добавьте первый проект уже сегодня.")}</p>
            <Button asChild size="lg" variant="secondary" className="mt-8 h-12 rounded-full px-7">
              <Link to="/auth">{signedIn ? tr("Открыть систему") : tr("Начать бесплатно")}<ArrowRight /></Link>
            </Button>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Binosoz.tj" className="h-7 w-7 object-contain" loading="lazy" />
            <span>© {new Date().getFullYear()} Binosoz.tj — {tr("Все права защищены.")}</span>
          </div>
          <div className="flex gap-6">
            <Link to="/trust" className="bino-nav-link">{tr("Безопасность")}</Link>
            <Link to="/auth" className="bino-nav-link">{signedIn ? tr("Открыть систему") : tr("Войти")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
