import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
  LayoutDashboard,
  Lock,
  MessageCircle,
  ScanLine,
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
import heroImage from "@/assets/site-hero.jpg";
import dashboardShot from "@/assets/product/dashboard.png";
import projectsShot from "@/assets/product/sales.png";
import warehouseShot from "@/assets/product/warehouse.png";

type Module = { icon: ComponentType<{ className?: string }>; title: string; text: string; code: string };

const MODULES: Module[] = [
  { icon: Building2, code: "01", title: "Проекты и блоки", text: "Проект → блок → этаж → квартира. Наглядная шахматка со статусами квартир." },
  { icon: Wallet, code: "02", title: "Продажи и рассрочка", text: "Договор, первый взнос, график рассрочки на любое число месяцев и контроль оплат." },
  { icon: Filter, code: "03", title: "CRM-воронка", text: "Заявки клиентов, этапы сделки и напоминания менеджерам." },
  { icon: CreditCard, code: "04", title: "Платежи и должники", text: "Приход денег, просрочки и автоматические напоминания в WhatsApp и СМС." },
  { icon: Calculator, code: "05", title: "Смета", text: "Версии сметы, автоматический расчёт и сравнение плана с фактом." },
  { icon: Boxes, code: "06", title: "Склад", text: "Приход, расход и остатки материалов; списание прямо на проект." },
  { icon: Truck, code: "07", title: "Снабжение", text: "Заявки на материалы от прорабов и контроль закупок." },
  { icon: Clock3, code: "08", title: "Табель и посещаемость", text: "Отметка рабочих на объекте через киоск-экран и расчёт смен." },
  { icon: HardHat, code: "09", title: "Сотрудники и роли", text: "Владелец, бухгалтер, складчик, прораб — у каждого свой доступ." },
  { icon: FileSignature, code: "10", title: "Договоры и разрешения", text: "Шаблоны договоров, сроки разрешительных документов и напоминания." },
  { icon: BarChart3, code: "11", title: "Отчёты и налоги", text: "Выручка, расходы, прибыль по проектам и налоговые отчёты." },
  { icon: MessageCircle, code: "12", title: "WhatsApp и СМС", text: "Автоматические уведомления клиентам о платежах и напоминания." },
];

const SCREENS = [
  { id: "dashboard", label: "Дашборд директора", image: dashboardShot, title: "Ключевые цифры компании на одном экране в реальном времени." },
  { id: "projects", label: "Проекты и блоки", image: projectsShot, title: "Проект → блок → этаж → квартира. Наглядная шахматка со статусами квартир." },
  { id: "warehouse", label: "Склад", image: warehouseShot, title: "Приход, расход и остатки материалов; списание прямо на проект." },
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

export function LandingPage() {
  const { tr } = useT();
  const logoUrl = useAppLogo("dark");
  const [signedIn, setSignedIn] = useState(false);
  const [screen, setScreen] = useState(SCREENS[0]);

  useEffect(() => {
    let active = true;
    getStableSession().then((session) => active && setSignedIn(Boolean(session)));
    return () => { active = false; };
  }, []);

  const enterLabel = signedIn ? tr("Открыть систему") : tr("Войти");

  return (
    <div className="blueprint-site min-h-screen overflow-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Binosoz.tj">
            <img src={logoUrl} alt="" className="h-9 w-9 object-contain" />
            <div>
              <div className="font-display text-base font-bold">Binosoz.tj</div>
              <div className="bp-mono text-[9px] uppercase text-muted-foreground">{tr("Управление стройкой")}</div>
            </div>
          </a>
          <nav className="hidden items-center gap-8 text-xs font-semibold uppercase md:flex">
            <a href="#product" className="bp-nav-link">{tr("Возможности")}</a>
            <a href="#modules" className="bp-nav-link">{tr("Модули")}</a>
            <a href="#how" className="bp-nav-link">{tr("Как это работает")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button asChild size="sm" className="rounded-none">
              <Link to="/auth">{enterLabel}<ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="bp-grid relative min-h-[92svh] overflow-hidden border-b border-border pt-16">
          <img src={heroImage} alt={tr("ERP для строительных компаний Таджикистана")} className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-45 lg:w-[58%]" />
          <div className="bp-hero-shade absolute inset-0" />
          <div className="bp-scan absolute inset-y-0 right-[12%] hidden w-px lg:block" />
          <div className="relative mx-auto grid min-h-[calc(92svh-4rem)] max-w-7xl items-center px-5 py-16 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
            <div className="max-w-4xl animate-fade-in">
              <div className="bp-kicker mb-7 flex items-center gap-3 text-xs uppercase text-accent">
                <span className="h-px w-10 bg-accent" />
                {tr("ERP для строительных компаний Таджикистана")}
              </div>
              <h1 className="max-w-4xl font-display text-5xl font-bold leading-[.96] sm:text-6xl lg:text-8xl">
                {tr("Стройте объекты.")}<br />
                <span className="bp-outline-text">{tr("Управляйте цифрами.")}</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
                {tr("Проекты, блоки и квартиры, продажи и рассрочка, платежи и долги, склад, смета, табель, зарплата и отчёты — всё работает вместе и обновляется в реальном времени.")}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 rounded-none px-6">
                  <Link to="/auth">{signedIn ? tr("Открыть систему") : tr("Начать бесплатно")}<ArrowRight /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-none border-border bg-background/40 px-6">
                  <a href="#product">{tr("Смотреть систему")}</a>
                </Button>
              </div>
            </div>
            <div className="mt-12 self-end border-l border-border pl-5 lg:mb-10 lg:mt-0 lg:justify-self-end">
              <div className="bp-mono text-[10px] uppercase text-muted-foreground">SYSTEM / STATUS</div>
              <div className="mt-3 flex items-center gap-2 text-sm"><span className="bp-status-dot" /> {tr("Все процессы синхронизированы")}</div>
            </div>
          </div>
          <div className="relative mx-auto grid max-w-7xl grid-cols-2 border-x border-t border-border bg-background/80 md:grid-cols-4">
            {[["22+", "модулей в системе"], ["3", "языка интерфейса"], ["24/7", "доступ из любой точки"], ["1", "единая система"]].map(([value, label]) => (
              <div key={label} className="border-b border-r border-border px-5 py-5 md:border-b-0 lg:px-8">
                <div className="bp-mono text-2xl font-bold text-accent">{value}</div>
                <div className="mt-1 text-xs uppercase text-muted-foreground">{tr(label)}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className="bp-grid scroll-mt-16 border-b border-border py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <Reveal className="grid gap-8 lg:grid-cols-[.65fr_1.35fr] lg:items-end">
              <div>
                <div className="bp-kicker text-xs uppercase text-accent">{tr("Система изнутри")}</div>
                <h2 className="mt-4 max-w-lg font-display text-4xl font-bold leading-tight md:text-5xl">{tr("Вся стройка видна на одном экране")}</h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground lg:justify-self-end">{tr("Продажи, платежи и расходы сразу видны в отчётах и на дашборде.")}</p>
            </Reveal>

            <Reveal className="mt-12">
              <div className="flex overflow-x-auto border border-border bg-card" role="tablist" aria-label={tr("Разделы системы")}>
                {SCREENS.map((item, index) => (
                  <Button key={item.id} variant="ghost" onClick={() => setScreen(item)} role="tab" aria-selected={screen.id === item.id} className={`h-12 shrink-0 rounded-none border-r border-border px-5 ${screen.id === item.id ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : "text-muted-foreground"}`}>
                    <span className="bp-mono text-[10px]">0{index + 1}</span>{tr(item.label)}
                  </Button>
                ))}
              </div>
              <div className="bp-screen-frame relative border-x border-b border-border bg-card p-2 sm:p-4">
                <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                  <span className="bp-mono text-[10px] uppercase text-muted-foreground">APP / {screen.id}</span>
                  <span className="flex items-center gap-2 text-[10px] uppercase text-muted-foreground"><span className="bp-status-dot" /> LIVE SYSTEM</span>
                </div>
                <img key={screen.id} src={screen.image} alt={tr(screen.label)} className="bp-screen-image w-full border border-border" loading="lazy" />
                <div className="absolute bottom-6 left-6 max-w-sm border-l-2 border-accent bg-background/95 p-4 shadow-xl sm:bottom-10 sm:left-10">
                  <div className="text-sm font-bold">{tr(screen.label)}</div>
                  <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">{tr(screen.title)}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="modules" className="scroll-mt-16 border-b border-border py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <Reveal className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="bp-kicker text-xs uppercase text-accent">{tr("Цифровая экосистема")}</div>
                <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">{tr("Всё, что нужно застройщику")}</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">{tr("Каждый модуль можно включить по мере роста компании — начните с проектов и продаж.")}</p>
            </Reveal>
            <div className="mt-12 grid border-l border-t border-border sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map(({ icon: Icon, title, text, code }, index) => (
                <Reveal key={title} className="h-full" >
                  <article className="bp-module group relative h-full min-h-60 border-b border-r border-border bg-card/40 p-6 transition-colors">
                    <div className="flex items-start justify-between">
                      <Icon className="h-7 w-7 text-accent" />
                      <span className="bp-mono text-[10px] text-muted-foreground">M/{code}</span>
                    </div>
                    <h3 className="mt-12 font-display text-lg font-bold">{tr(title)}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{tr(text)}</p>
                    <div className="absolute bottom-0 left-0 h-px bg-accent transition-all duration-500 group-hover:w-full" style={{ width: index % 3 === 0 ? "24%" : "0%" }} />
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="bp-grid scroll-mt-16 border-b border-border py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.75fr_1.25fr] lg:px-8">
            <Reveal>
              <div className="bp-kicker text-xs uppercase text-accent">{tr("Рабочий процесс")}</div>
              <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">{tr("Запуск за один день")}</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">{tr("Работает на телефоне и компьютере")}. {tr("Таджикский, русский и 中文")}.</p>
            </Reveal>
            <div className="border-t border-border">
              {[
                ["01", "Регистрируете компанию", "Создаёте аккаунт владельца и получаете свою изолированную базу."],
                ["02", "Добавляете проект и квартиры", "Блоки, этажи, квартиры и цены — шахматка строится автоматически."],
                ["03", "Подключаете сотрудников", "Каждому сотруднику — своя роль и доступ только к своим данным."],
                ["04", "Работаете и смотрите цифры", "Продажи, платежи и расходы сразу видны в отчётах и на дашборде."],
              ].map(([number, title, text]) => (
                <Reveal key={number} className="border-b border-border">
                  <div className="group grid gap-4 py-6 sm:grid-cols-[64px_1fr_1fr] sm:items-start">
                    <span className="bp-mono text-sm text-accent">{number}</span>
                    <h3 className="font-display text-lg font-bold transition-transform group-hover:translate-x-1">{tr(title)}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{tr(text)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card py-20">
          <Reveal className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
            <div>
              <ShieldCheck className="h-10 w-10 text-accent" />
              <h2 className="mt-5 font-display text-3xl font-bold md:text-4xl">{tr("Данные вашей компании под защитой")}</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">{tr("Доступ по ролям, изоляция данных между компаниями, приватное хранение документов и проверка прав на стороне сервера при каждом запросе.")}</p>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {[[Lock, "Данные каждой компании изолированы"], [Users, "Доступ по ролям"], [Smartphone, "Работает на телефоне и компьютере"], [Languages, "Таджикский, русский и 中文"]].map(([Icon, label]) => {
                const FeatureIcon = Icon as ComponentType<{ className?: string }>;
                return <div key={label as string} className="flex min-h-28 items-center gap-4 bg-background p-5"><FeatureIcon className="h-5 w-5 text-accent" /><span className="text-sm font-semibold">{tr(label as string)}</span></div>;
              })}
            </div>
          </Reveal>
        </section>

        <section className="bp-cta relative overflow-hidden py-24 text-center">
          <div className="relative mx-auto max-w-3xl px-5">
            <div className="bp-mono text-xs uppercase text-primary-foreground/70">Binosoz.tj / START</div>
            <h2 className="mt-5 font-display text-4xl font-bold text-primary-foreground md:text-6xl">{tr("Готовы навести порядок в компании?")}</h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-primary-foreground/70">{tr("Создайте аккаунт и добавьте первый проект уже сегодня.")}</p>
            <Button asChild size="lg" variant="secondary" className="mt-8 h-12 rounded-none px-7">
              <Link to="/auth">{signedIn ? tr("Открыть систему") : tr("Начать бесплатно")}<ArrowRight /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center lg:px-8">
          <div className="flex items-center gap-3"><img src={logoUrl} alt="" className="h-7 w-7 object-contain" loading="lazy" /><span>© {new Date().getFullYear()} Binosoz.tj — {tr("Все права защищены.")}</span></div>
          <div className="flex gap-6"><Link to="/trust" className="bp-nav-link">{tr("Безопасность")}</Link><Link to="/auth" className="bp-nav-link">{enterLabel}</Link></div>
        </div>
      </footer>
    </div>
  );
}