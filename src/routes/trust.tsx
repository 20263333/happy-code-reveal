import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, Database, Users, FileText, Mail, ArrowLeft } from "lucide-react";
import { useAppLogo } from "@/lib/app-logos";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Безопасность и конфиденциальность — Binosoz.tj" },
      {
        name: "description",
        content:
          "Как Binosoz.tj защищает данные строительных компаний: доступ по ролям, изоляция данных компаний и приватное хранение документов.",
      },
      { property: "og:title", content: "Безопасность и конфиденциальность — Binosoz.tj" },
      {
        property: "og:description",
        content:
          "Обзор мер безопасности и конфиденциальности Binosoz.tj. Страница поддерживается владельцем приложения.",
      },
    ],
  }),
  component: TrustPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function TrustPage() {
  const { tr } = useT();
  const logoUrl = useAppLogo("light");
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Binosoz.tj" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-display text-base font-semibold">Binosoz.tj</span>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/auth"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr("Назад")}
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold">
            {tr("Безопасность и конфиденциальность")}
          </h1>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {tr(
            "Эта страница поддерживается командой Binosoz.tj и отвечает на частые вопросы о безопасности и конфиденциальности данных в системе. Это редактируемое содержимое приложения, а не независимая сертификация.",
          )}
        </p>

        <div className="mt-8 space-y-4">
          <Section icon={Lock} title={tr("Доступ и аутентификация")}>
            <p>
              {tr(
                "Вход в систему защищён логином и паролем. Каждый сотрудник видит только те данные, к которым ему предоставлен доступ.",
              )}
            </p>
            <p>
              {tr(
                "Права разграничены по ролям (владелец, менеджер, бухгалтер, складчик), а роли хранятся отдельно и проверяются на стороне сервера.",
              )}
            </p>
          </Section>

          <Section icon={Users} title={tr("Изоляция данных компаний")}>
            <p>
              {tr(
                "Данные каждой строительной компании отделены друг от друга. Сотрудники одной компании не видят проекты, клиентов, платежи или склад другой компании.",
              )}
            </p>
            <p>
              {tr(
                "Доступ к проектам дополнительно ограничивается списком назначенных сотрудников.",
              )}
            </p>
          </Section>

          <Section icon={Database} title={tr("Хранение данных")}>
            <p>
              {tr(
                "Данные хранятся в управляемой облачной базе данных с построчными правилами доступа, которые применяются на стороне сервера при каждом запросе.",
              )}
            </p>
          </Section>

          <Section icon={FileText} title={tr("Документы и файлы")}>
            <p>
              {tr(
                "Чеки, договоры и другие загруженные документы хранятся в приватных хранилищах и не доступны по публичным ссылкам.",
              )}
            </p>
          </Section>

          <Section icon={Mail} title={tr("Связь и сообщения о проблемах")}>
            <p>
              {tr(
                "Если вы заметили проблему с безопасностью или у вас есть вопрос о ваших данных, свяжитесь с администратором вашей компании в системе.",
              )}
            </p>
          </Section>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          {tr(
            "Безопасность — это совместная ответственность: платформа предоставляет технические средства защиты, а владелец компании отвечает за управление доступом сотрудников и за свои данные.",
          )}
        </p>
      </main>
    </div>
  );
}
