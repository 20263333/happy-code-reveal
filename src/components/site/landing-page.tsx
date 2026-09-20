import { useEffect, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  Check,
  Clock3,
  CreditCard,
  FileSignature,
  Filter,
  HardHat,
  Languages,
  Lock,
  Menu,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
  Wallet,
  X,
  Bot,
  BriefcaseBusiness,
  ClipboardCheck,
  Landmark,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { useAppLogo } from "@/lib/app-logos";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStableSession } from "@/lib/auth-session";
import { submitSitePlanRequest } from "@/lib/site-plan-requests.functions";
import dashboardShot from "@/assets/product/dashboard.png";
import warehouseShot from "@/assets/product/warehouse.png";

type Module = { icon: ComponentType<{ className?: string }>; title: string; text: string };

const CAPABILITY_GROUPS: { title: string; icon: ComponentType<{ className?: string }>; items: Module[] }[] = [
  { title: "Строительство и продажи", icon: Building2, items: [
    { icon: Building2, title: "Проекты, блоки, этажи", text: "Структура ЖК с визуальной схемой квартир и статусами: свободна, бронь, продана, занята." },
    { icon: Filter, title: "Клиенты и воронка", text: "База клиентов, сканирование паспорта, воронка продаж и история обращений." },
    { icon: FileSignature, title: "Договоры и рассрочка", text: "Автонумерация договоров, график рассрочки, печать договора и чека в двух экземплярах." },
    { icon: RefreshCw, title: "Переселение и бартер", text: "Отдельный учёт квартир по переселению и бартерных сделок." },
  ]},
  { title: "Финансы", icon: Landmark, items: [
    { icon: CreditCard, title: "Платежи и должники", text: "Приём оплат в сомони и долларах по курсу НБТ, напоминания по СМС и WhatsApp." },
    { icon: Wallet, title: "Касса", text: "Смены кассира, приход и расход, переводы и Z-отчёт." },
    { icon: BarChart3, title: "Распределение дохода", text: "Себестоимость, чистая прибыль и автоматическое распределение долей партнёров." },
    { icon: Calculator, title: "Отчёты и дашборд", text: "Выручка, расходы, прибыль, налоговые отчёты и фильтры по ЖК и блокам." },
  ]},
  { title: "Строительная площадка", icon: HardHat, items: [
    { icon: Boxes, title: "Склад", text: "Приход, расход, остатки, списание на проекты и автоматические долги поставщикам." },
    { icon: Calculator, title: "Смета и бюджет", text: "Версии смет, сравнение плана и факта, контроль перерасхода." },
    { icon: Clock3, title: "Табель и зарплата", text: "Учёт рабочих, смены через киоск-экран и выплаты." },
    { icon: ClipboardCheck, title: "Качество и безопасность", text: "Проверки, инциденты, разрешения и техника." },
  ]},
  { title: "Управление", icon: BriefcaseBusiness, items: [
    { icon: ShieldCheck, title: "Роли и доступ", text: "Владелец, бухгалтер, складчик, прораб, директор. Доступ настраивается по каждому разделу и вкладке." },
    { icon: Bot, title: "AI-помощник", text: "Помощник владельца: отвечает по данным компании и выполняет действия." },
    { icon: PackageCheck, title: "Поставщики", text: "Долги, оплаты и печать акта сверки по каждому поставщику." },
    { icon: Smartphone, title: "Киоск продаж", text: "Экран в офисе продаж с планировками, зумом схемы и статусами квартир." },
  ]},
];

type PlanCode = "construction" | "construction_sales" | "premium_unlimited";
const PLANS: { code: PlanCode; name: string; caption: string; features: string[] }[] = [
  { code: "construction", name: "СТРОИТЕЛЬСТВО", caption: "Управление проектами, складом и расходами.", features: ["Проекты, блоки, этажи и квартиры (шахматка)", "Склад: приход, расход, остатки", "Смета и график Gantt", "Расходы и бюджет объекта", "Табель и зарплата рабочих", "Техника, качество, безопасность и разрешения"] },
  { code: "construction_sales", name: "СТРОИТЕЛЬСТВО + ПРОДАЖИ", caption: "Всё из тарифа 1 + CRM, договоры и рассрочка.", features: ["Все модули тарифа СТРОИТЕЛЬСТВО", "CRM и воронка продаж", "Клиенты и скан паспорта (ИНН)", "Договоры и печать документов", "Продажи в рассрочку и должники", "СМС-уведомления (OsonSMS) и режим Kiosk"] },
  { code: "premium_unlimited", name: "PREMIUM UNLIMITED", caption: "Все модули без ограничений — финансы, аналитика и AI.", features: ["Все модули тарифов 1 и 2", "Платежи, чеки и долларовая валюта", "Касса и смены кассира", "Поставщики, долги и бартер", "Распределение дохода между партнёрами", "Дашборд, отчёты, AI-ассистент и Excel-импорт"] },
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

function Reveal({ children, className = "", direction = "up" }: { children: ReactNode; className?: string; direction?: "up" | "left" | "right" }) {
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
  return <div ref={ref} data-direction={direction} className={`bp-reveal ${className}`}>{children}</div>;
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
                      <div className="mt-1 text-[11px] opacity-90">{cell.area} {label("м²")}</div>
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
  const { tr, lang } = useT();
  const logoUrl = useAppLogo("light");
  const [signedIn, setSignedIn] = useState(false);
  const [screen, setScreen] = useState(SCREENS[0]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitRequest = useServerFn(submitSitePlanRequest);
  const [requestForm, setRequestForm] = useState({ business_type: "developer", full_name: "", company_name: "", job_title: "", email: "", phone: "" });

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      await submitRequest({ data: { ...requestForm, business_type: requestForm.business_type as "developer" | "management" | "other", plan_code: selectedPlan, locale: lang } });
      toast.success(tr("Заявка успешно отправлена"));
      setSelectedPlan(null);
      setRequestForm({ business_type: "developer", full_name: "", company_name: "", job_title: "", email: "", phone: "" });
    } catch {
      toast.error(tr("Не удалось отправить заявку. Попробуйте ещё раз."));
    } finally {
      setSubmitting(false);
    }
  };

  const navItems = [
    ["Возможности", "#product"],
    ["Модули", "#modules"],
    ["Цены", "#pricing"],
    ["Для строителей", "#builders"],
    ["Для руководителей", "#leaders"],
    ["FAQ", "#faq"],
    ["Контакты", "#contact"],
  ];

  useEffect(() => {
    let active = true;
    getStableSession().then((session) => active && setSignedIn(Boolean(session)));
    return () => { active = false; };
  }, []);

  return (
    <div className="bino-site min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 xl:flex lg:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Binosoz.tj">
            <img src={logoUrl} alt="Binosoz.tj" className="h-8 w-8 object-contain" />
            <span className="font-display text-lg font-extrabold tracking-tight">Binosoz<span className="text-primary">.tj</span></span>
          </a>
          <nav className="hidden items-center gap-5 text-sm font-medium text-muted-foreground xl:flex">
            {navItems.map(([label, href]) => <a key={href} href={href} className="bino-nav-link whitespace-nowrap">{tr(label)}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMobileMenuOpen((value) => !value)} aria-label={tr("Открыть меню")} aria-expanded={mobileMenuOpen}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="border-t border-border bg-background px-5 py-4 xl:hidden">
            <div className="mx-auto grid max-w-7xl gap-1">
              {navItems.map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-foreground hover:bg-muted">{tr(label)}</a>
              ))}
            </div>
          </nav>
        )}
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
          <Reveal direction="right" className="relative mx-auto mt-14 max-w-6xl">
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
               {PROBLEMS.map((block, index) => (
                 <Reveal key={block.title} direction={index % 2 === 0 ? "left" : "right"}>
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
           <Reveal direction="left" className="mx-auto max-w-7xl text-center">
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
            <Reveal direction="right" className="mt-10">
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

        <section id="builders" className="scroll-mt-20 overflow-hidden bg-card px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
            <Reveal direction="left">
              <BrowserFrame><img src={warehouseShot} alt={tr("Контроль стройки и материалов")} className="w-full" loading="lazy" /></BrowserFrame>
            </Reveal>
            <Reveal direction="right">
              <div className="text-xs font-bold uppercase tracking-widest text-success">{tr("Для строителей")}</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Стройка, склад и люди работают вместе")}</h2>
              <p className="mt-5 text-sm leading-7 text-muted-foreground md:text-base">{tr("Прораб отправляет заявку на материал, складчик выдаёт его, а расход сразу относится к нужному проекту. Табель, техника, подрядчики и качество остаются под контролем.")}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {["Заявки и закупки материалов", "Остатки и движение склада", "Табель рабочих и зарплата", "Смета, качество и график"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-background p-4 text-sm font-semibold"><Check className="h-4 w-4 shrink-0 text-success" />{tr(item)}</div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="leaders" className="scroll-mt-20 overflow-hidden px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
            <Reveal direction="left" className="lg:order-1">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">{tr("Для руководителей")}</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Решения на основе точных цифр")}</h2>
              <p className="mt-5 text-sm leading-7 text-muted-foreground md:text-base">{tr("Директор видит продажи, поступления, долги, расходы и прибыль по каждому проекту. Отчёты обновляются вместе с работой команды — без ручного сбора данных.")}</p>
              <div className="mt-7 space-y-3">
                {["Финансы и прибыль по проектам", "Просрочки и план платежей", "Роли и персональные права доступа", "Доли партнёров и распределение дохода"].map((item) => (
                  <div key={item} className="flex items-center gap-3 border-b border-border pb-3 text-sm font-semibold"><Check className="h-4 w-4 shrink-0 text-primary" />{tr(item)}</div>
                ))}
              </div>
            </Reveal>
            <Reveal direction="right" className="lg:order-2">
              <BrowserFrame><img src={dashboardShot} alt={tr("Аналитика для руководителя")} className="w-full" loading="lazy" /></BrowserFrame>
            </Reveal>
          </div>
        </section>

        <section id="modules" className="scroll-mt-20 bg-card px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">{tr("Платформа")}</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Возможности платформы")}</h2>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">{tr("Binosoz.tj охватывает весь цикл застройщика: от первой квартиры до распределения прибыли между партнёрами.")}</p>
            </Reveal>
            <div className="mt-12 space-y-14">
              {CAPABILITY_GROUPS.map((group, groupIndex) => {
                const GroupIcon = group.icon;
                return <div key={group.title}>
                  <Reveal direction={groupIndex % 2 === 0 ? "left" : "right"} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GroupIcon className="h-5 w-5" /></div>
                    <h3 className="font-display text-xl font-extrabold md:text-2xl">{tr(group.title)}</h3>
                  </Reveal>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {group.items.map(({ icon: Icon, title, text }, itemIndex) => (
                      <Reveal key={title} direction={(groupIndex + itemIndex) % 2 === 0 ? "left" : "right"} className="h-full">
                        <article className="bino-card h-full rounded-2xl border border-border bg-background p-6">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                          <h4 className="mt-5 font-display text-base font-bold">{tr(title)}</h4>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{tr(text)}</p>
                        </article>
                      </Reveal>
                    ))}
                  </div>
                </div>;
              })}
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

        <section id="pricing" className="scroll-mt-20 bg-card px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mx-auto max-w-3xl text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">Premium Unlimited</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">{tr("Три тарифа для любой строительной компании")}</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">{tr("Цена индивидуальна — мы подбираем тариф под объём вашей компании. Свяжитесь с нами для точного расчёта.")}</p>
            </Reveal>
            <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
              {PLANS.map((plan, index) => (
                <Reveal key={plan.code} direction={index === 0 ? "left" : index === 2 ? "right" : "up"} className="h-full">
                  <article className={`relative flex h-full flex-col rounded-3xl border p-7 md:p-8 ${index === 1 ? "border-primary bg-primary text-primary-foreground shadow-xl lg:-my-5 lg:py-13" : "border-border bg-muted/60"}`}>
                    {index === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-success px-4 py-1 text-xs font-bold text-success-foreground">{tr("Популярный")}</span>}
                    <div className={`text-xs font-bold ${index === 1 ? "text-primary-foreground/70" : "text-primary"}`}>{tr(`Тариф ${index + 1}`)}</div>
                    <h3 className="mt-2 font-display text-xl font-extrabold">{tr(plan.name)}</h3>
                    <p className={`mt-2 min-h-12 text-sm ${index === 1 ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{tr(plan.caption)}</p>
                    <div className="mt-6 font-display text-2xl font-extrabold">{tr("Индивидуальная цена")}</div>
                    <p className={`mt-1 text-xs ${index === 1 ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{tr("Рассчитывается по объёму вашей компании")}</p>
                    <Button type="button" variant={index === 1 ? "secondary" : "default"} className="mt-6 h-12 w-full rounded-xl" onClick={() => setSelectedPlan(plan.code)}>{tr("Выбрать тариф")}</Button>
                    <ul className="mt-7 space-y-3">
                      {plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm leading-5"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${index === 1 ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"}`}><Check className="h-3 w-3" /></span>{tr(feature)}</li>)}
                    </ul>
                  </article>
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

        <section id="contact" className="scroll-mt-20 px-5 pb-20 lg:px-8">
          <Reveal direction="right" className="bino-band mx-auto max-w-7xl rounded-3xl px-6 py-16 text-center text-primary-foreground">
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

      <Dialog open={selectedPlan !== null} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold">{tr("Заявка на демонстрацию")}</DialogTitle>
            <DialogDescription className="leading-6">{tr("За 15 минут покажем платформу для вашего сценария и ответим на вопросы.")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequest} className="mt-2 space-y-4">
            <div>
              <Label>{tr("Тип бизнеса")}</Label>
              <div className="mt-2 grid grid-cols-3 rounded-xl bg-muted p-1">
                {[["developer", "Строительство"], ["management", "Управление"], ["other", "Другое"]].map(([value, text]) => (
                  <Button key={value} type="button" variant={requestForm.business_type === value ? "default" : "ghost"} className="h-10 rounded-lg px-2 text-xs sm:text-sm" onClick={() => setRequestForm((current) => ({ ...current, business_type: value }))}>{tr(text)}</Button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"><span className="text-muted-foreground">{tr("Выбранный тариф")}:</span> <strong>{tr(PLANS.find((plan) => plan.code === selectedPlan)?.name ?? "")}</strong></div>
            {[["full_name", "Имя", "text"], ["company_name", "Компания", "text"], ["job_title", "Должность", "text"], ["email", "Email", "email"], ["phone", "Телефон", "tel"]].map(([field, placeholder, type]) => (
              <Input key={field} type={type} required minLength={field === "phone" ? 7 : 2} className="h-12 rounded-xl" placeholder={tr(placeholder)} value={requestForm[field as keyof typeof requestForm]} onChange={(event) => setRequestForm((current) => ({ ...current, [field]: event.target.value }))} />
            ))}
            <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl">{submitting ? tr("Отправка…") : tr("Отправить заявку")}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
