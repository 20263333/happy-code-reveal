import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Wallet,
  Users,
  CreditCard,
  Banknote,
  Calculator,
  Boxes,
  Truck,
  Clock,
  ShieldCheck,
  HardHat,
  Tractor,
  FileSignature,
  BadgeCheck,
  BarChart3,
  MessageCircle,
  ScanLine,
  LayoutDashboard,
  PieChart,
  Repeat,
  Filter,
  Receipt,
  Check,
  Smartphone,
  Languages,
  Lock,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAppLogo } from "@/lib/app-logos";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { getStableSession } from "@/lib/auth-session";
import heroImage from "@/assets/site-hero.jpg";

const MODULES: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }[] = [
  { icon: Building2, title: "Проекты и блоки", text: "Проект → блок → этаж → квартира. Наглядная шахматка со статусами квартир." },
  { icon: Wallet, title: "Продажи и рассрочка", text: "Договор, первый взнос, график рассрочки на любое число месяцев и контроль оплат." },
  { icon: Filter, title: "CRM-воронка", text: "Заявки клиентов, этапы сделки и напоминания менеджерам." },
  { icon: Users, title: "Клиенты", text: "Единая база покупателей с документами и историей платежей." },
  { icon: CreditCard, title: "Платежи и должники", text: "Приход денег, просрочки и автоматические напоминания в WhatsApp и СМС." },
  { icon: Banknote, title: "Касса", text: "Смены кассира, приход и расход наличных, Z-отчёт по смене." },
  { icon: Receipt, title: "Расходы и поставщики", text: "Расходы по проектам, счета поставщиков и контроль задолженности." },
  { icon: Calculator, title: "Смета", text: "Версии сметы, автоматический расчёт и сравнение плана с фактом." },
  { icon: Boxes, title: "Склад", text: "Приход, расход и остатки материалов; списание прямо на проект." },
  { icon: Truck, title: "Снабжение", text: "Заявки на материалы от прорабов и контроль закупок." },
  { icon: Clock, title: "Табель и посещаемость", text: "Отметка рабочих на объекте через киоск-экран и расчёт смен." },
  { icon: HardHat, title: "Сотрудники и роли", text: "Владелец, бухгалтер, складчик, прораб — у каждого свой доступ." },
  { icon: ShieldCheck, title: "Субподрядчики", text: "Объёмы работ, акты и расчёты с бригадами." },
  { icon: Tractor, title: "Техника", text: "Учёт техники, работы и простоев на объектах." },
  { icon: FileSignature, title: "Договоры и разрешения", text: "Шаблоны договоров, сроки разрешительных документов и напоминания." },
  { icon: BadgeCheck, title: "Качество и график", text: "Замечания по качеству и план-график работ (Гант)." },
  { icon: BarChart3, title: "Отчёты и налоги", text: "Выручка, расходы, прибыль по проектам и налоговые отчёты." },
  { icon: MessageCircle, title: "WhatsApp и СМС", text: "Автоматические уведомления клиентам о платежах и напоминания." },
  { icon: ScanLine, title: "Сканер паспорта (AI)", text: "Данные клиента распознаются с фото паспорта за секунды." },
  { icon: LayoutDashboard, title: "Дашборд директора", text: "Ключевые цифры компании на одном экране в реальном времени." },
  { icon: PieChart, title: "Доли и пайщики", text: "Учёт долей партнёров и распределение прибыли." },
  { icon: Repeat, title: "Переселение и бартер", text: "Сделки по переселению жильцов и бартерные договорённости." },
];

const STEPS = [
  { title: "Регистрируете компанию", text: "Создаёте аккаунт владельца и получаете свою изолированную базу." },
  { title: "Добавляете проект и квартиры", text: "Блоки, этажи, квартиры и цены — шахматка строится автоматически." },
  { title: "Подключаете сотрудников", text: "Каждому сотруднику — своя роль и доступ только к своим данным." },
  { title: "Работаете и смотрите цифры", text: "Продажи, платежи и расходы сразу видны в отчётах и на дашборде." },
];

const FAQ = [
  { q: "Сколько стоит?", a: "Начать можно бесплатно. Тариф зависит от количества проектов и сотрудников — напишите нам, подберём подходящий." },
  { q: "Нужно ли устанавливать программу?", a: "Нет. Система работает в браузере на телефоне, планшете и компьютере." },
  { q: "Можно перенести данные из Excel?", a: "Да, мы помогаем перенести список квартир, клиентов и графики рассрочки." },
  { q: "На каком языке интерфейс?", a: "Таджикский, русский и китайский — язык переключается в один клик." },
];

export function LandingPage() {
  const { tr } = useT();
  const logoUrl = useAppLogo("light");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStableSession().then((s) => {
      if (!cancelled) setSignedIn(!!s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enterLabel = signedIn ? tr("Открыть систему") : tr("Войти");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Binosoz.tj" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-display text-base font-semibold tracking-tight">Binosoz.tj</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#modules" className="transition-colors hover:text-foreground">{tr("Модули")}</a>
            <a href="#how" className="transition-colors hover:text-foreground">{tr("Как это работает")}</a>
            <a href="#faq" className="transition-colors hover:text-foreground">{tr("Вопросы")}</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <Button asChild size="sm">
              <Link to="/auth">{enterLabel}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt={tr("ERP для строительных компаний Таджикистана")}
            width={1600}
            height={1008}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,oklch(0.18_0.04_260/0.94),oklch(0.18_0.04_260/0.72)_55%,oklch(0.18_0.04_260/0.45))]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
            <Building2 className="h-3.5 w-3.5" />
            {tr("ERP для строительных компаний Таджикистана")}
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.1] text-white md:text-6xl">
            {tr("Весь бизнес застройщика в одной системе")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
            {tr(
              "Проекты, блоки и квартиры, продажи и рассрочка, платежи и долги, склад, смета, табель, зарплата и отчёты — всё работает вместе и обновляется в реальном времени.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground shadow-[var(--shadow-elegant)] hover:bg-accent/90">
              <Link to="/auth">
                {signedIn ? tr("Открыть систему") : tr("Начать бесплатно")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <a href="#modules">{tr("Возможности")}</a>
            </Button>
          </div>

          <ul className="mt-10 grid gap-3 text-sm text-white/80 sm:grid-cols-3">
            {[
              { icon: Smartphone, t: "Работает на телефоне и компьютере" },
              { icon: Languages, t: "Таджикский, русский и 中文" },
              { icon: Lock, t: "Данные каждой компании изолированы" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-white" />
                {tr(t)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4">
          {[
            { v: "22+", l: "модулей в системе" },
            { v: "3", l: "языка интерфейса" },
            { v: "24/7", l: "доступ из любой точки" },
            { v: "0", l: "ручных таблиц Excel" },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-3xl font-semibold text-primary md:text-4xl">{s.v}</div>
              <div className="mt-1 text-sm text-muted-foreground">{tr(s.l)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">{tr("Всё, что нужно застройщику")}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {tr("Каждый модуль можно включить по мере роста компании — начните с проектов и продаж.")}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-elegant)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold">{tr(title)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tr(text)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">{tr("Запуск за один день")}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-border bg-card p-5">
                <div className="font-display text-sm font-semibold text-accent">0{i + 1}</div>
                <h3 className="mt-2 font-display text-base font-semibold">{tr(s.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tr(s.text)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-8 rounded-3xl border border-border bg-[var(--gradient-primary)] p-8 text-primary-foreground md:grid-cols-2 md:p-12">
          <div>
            <ShieldCheck className="h-9 w-9" />
            <h2 className="mt-4 font-display text-2xl font-semibold md:text-3xl">
              {tr("Данные вашей компании под защитой")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-primary-foreground/80">
              {tr(
                "Доступ по ролям, изоляция данных между компаниями, приватное хранение документов и проверка прав на стороне сервера при каждом запросе.",
              )}
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-6">
              <Link to="/trust">{tr("Подробнее о безопасности")}</Link>
            </Button>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              "Владелец, бухгалтер, складчик, прораб — у каждого свой доступ.",
              "Данные каждой компании изолированы",
              "Чеки, договоры и другие загруженные документы хранятся в приватных хранилищах и не доступны по публичным ссылкам.",
            ].map((t) => (
              <li key={t} className="flex gap-3 rounded-xl bg-white/10 p-3.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-primary-foreground/90">{tr(t)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">{tr("Частые вопросы")}</h2>
          <div className="mt-8 space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-display text-base font-semibold">{tr(f.q)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tr(f.a)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">{tr("Готовы навести порядок в компании?")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {tr("Создайте аккаунт и добавьте первый проект уже сегодня.")}
        </p>
        <Button asChild size="lg" className="mt-7">
          <Link to="/auth">
            {signedIn ? tr("Открыть систему") : tr("Начать бесплатно")}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Binosoz.tj" className="h-6 w-6 rounded object-contain" loading="lazy" />
            <span>© {new Date().getFullYear()} Binosoz.tj — {tr("Все права защищены.")}</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/trust" className="transition-colors hover:text-foreground">{tr("Безопасность")}</Link>
            <Link to="/auth" className="transition-colors hover:text-foreground">{enterLabel}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
