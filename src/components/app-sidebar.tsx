import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  Users,
  Wallet,
  Receipt,
  LogOut,
  UserCog,
  Settings,
  Shield,
  CreditCard,
  FileText,
  Banknote,
  Boxes,
  FileSignature,
  HandCoins,
  Sparkles,
  ScanLine,
  HardHat,
  Wrench,
  Truck,
  PackageSearch,
  ShieldAlert,
  TrendingUp,
  GanttChartSquare,
  Stamp,
  Landmark,
  LifeBuoy,
  ChevronDown,
  LayoutDashboard,
  ShoppingCart,
  Scale,
  Calculator,
  HardHat as HardHatIcon,
  UsersRound,
  Percent,
  MessageCircle,
} from "lucide-react";
import { useAppLogo } from "@/lib/app-logos";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS, companyModuleEnabled } from "@/lib/constants";
import { useT } from "@/lib/i18n";

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const {
    user,
    roles,
    isOwner,
    isAccountant,
    isManager,
    isWarehouse,
    isDirector,
    isPlatformAdmin,
    companyId,
    department,
    extraPages,
    deniedPages,
    signOut,
  } = useAuth();
  const { t, tr } = useT();
  const faviconUrl = useAppLogo("dark");
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error(e);
    }
    navigate({ to: "/auth", replace: true });
  };

  const warehouseOnly = isWarehouse && !isOwner && !isAccountant;

  const { data: companyAccess } = useQuery({
    queryKey: ["company-access", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await (supabase as any)
        .from("companies")
        .select("subscription_tariff_id, subscription_expires_at, enabled_modules, is_demo")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isPlatformAdmin,
    staleTime: 30 * 60 * 1000,
  });

  const enabledModules = (companyAccess?.enabled_modules as string[] | null) ?? null;
  const mod = (key: string) => companyModuleEnabled(enabledModules, key);

  // Аъзои дастаи фурӯш (менеҷер/корманд) — танҳо дашборди худро мебинад
  const { data: isTeamMember } = useQuery({
    queryKey: ["is-sales-team-member", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await (supabase as any)
        .from("sales_team_members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !isPlatformAdmin,
    staleTime: 30 * 60 * 1000,
  });

  type NavItem = { title: string; url: string; icon: any; show: boolean };
  type NavGroup = { label: string; icon: any; items: NavItem[] };

  let groups: NavGroup[];

  if (isPlatformAdmin) {
    groups = [
      {
        label: t("nav.menu"),
        icon: Shield,
        items: [
          { title: "Super Admin", url: "/admin", icon: Shield, show: true },
          { title: tr("Дастгирӣ"), url: "/support", icon: LifeBuoy, show: true },
        ],
      },
    ];
  } else if (warehouseOnly) {
    groups = [
      {
        label: t("nav.menu"),
        icon: Boxes,
        items: [
          { title: tr("Склад"), url: "/warehouse", icon: Boxes, show: true },
          { title: tr("Настройки"), url: "/settings", icon: Settings, show: true },
        ],
      },
    ];
  } else {
    groups = [
      {
        label: tr("Шуъбаи Фурӯш"),
        icon: ShoppingCart,
        items: [
          {
            title: tr("Дашборд"),
            url: "/dashboard",
            icon: LayoutDashboard,
            show: isOwner || isDirector,
          },
          { title: t("nav.projects"), url: "/projects", icon: Building2, show: mod("projects") },
          { title: t("nav.customers"), url: "/customers", icon: Users, show: mod("customers") },
          {
            title: tr("Воронка фурӯш"),
            url: "/crm-funnel",
            icon: TrendingUp,
            show: (isOwner || isManager || isDirector) && mod("crm-funnel"),
          },
          {
            title: tr("WhatsApp"),
            url: "/whatsapp",
            icon: MessageCircle,
            show: isOwner || isManager || isDirector,
          },
          {
            title: tr("Договор"),
            url: "/contracts",
            icon: FileSignature,
            show: (isOwner || isDirector) && mod("contracts"),
          },
          {
            title: t("nav.payments"),
            url: "/payments",
            icon: Wallet,
            show: (isOwner || isAccountant || isDirector) && mod("payments"),
          },
          {
            title: tr("Должники"),
            url: "/debtors",
            icon: HandCoins,
            show: (isOwner || isAccountant || isDirector) && mod("debtors"),
          },
        ],
      },
      {
        label: tr("Шуъбаи Ҳуқуқӣ"),
        icon: Scale,
        items: [
          {
            title: tr("Договор"),
            url: "/contracts",
            icon: FileSignature,
            show: (isOwner || isDirector) && mod("contracts"),
          },
          {
            title: tr("Иҷозатномаҳо"),
            url: "/permits",
            icon: Stamp,
            show: (isOwner || isAccountant || isDirector) && mod("permits"),
          },
          {
            title: tr("Ҳисоботи давлатӣ"),
            url: "/tax-reports",
            icon: Landmark,
            show: (isOwner || isAccountant || isDirector) && mod("tax-reports"),
          },
        ],
      },
      {
        label: tr("Шуъбаи Муҳосибот"),
        icon: Calculator,
        items: [
          { title: t("nav.expenses"), url: "/expenses", icon: Receipt, show: mod("expenses") },
          { title: tr("Склад"), url: "/warehouse", icon: Boxes, show: mod("warehouse") },
          { title: tr("Снабженец"), url: "/supply", icon: PackageSearch, show: true },
          { title: tr("Поставщики"), url: "/payables", icon: Banknote, show: mod("payables") },
          {
            title: tr("Отчёт ОПУ"),
            url: "/reports",
            icon: FileText,
            show: (isOwner || isAccountant || isDirector) && mod("reports"),
          },
          {
            title: tr("Тарифы и оплата"),
            url: "/billing",
            icon: CreditCard,
            show: isOwner && mod("billing"),
          },
          { title: "AI Кредитҳо", url: "/ai-credits", icon: Sparkles, show: isOwner },
          {
            title: "Скан Кредитҳо",
            url: "/scan-credits",
            icon: ScanLine,
            show: isOwner && mod("scan-credits"),
          },
        ],
      },
      {
        label: tr("Шуъбаи Назорати Сохтмон"),
        icon: HardHatIcon,
        items: [
          { title: t("nav.projects"), url: "/projects", icon: Building2, show: mod("projects") },
          {
            title: tr("Табел"),
            url: "/attendance",
            icon: HardHat,
            show: (isOwner || isAccountant || isManager || isDirector) && mod("attendance"),
          },
          {
            title: tr("Пудратчиён"),
            url: "/subcontractors",
            icon: Wrench,
            show: (isOwner || isAccountant || isManager || isDirector) && mod("subcontractors"),
          },
          {
            title: tr("Техника"),
            url: "/equipment",
            icon: Truck,
            show: (isOwner || isAccountant || isManager || isDirector) && mod("equipment"),
          },
          {
            title: tr("Сифат ва Бехатарӣ"),
            url: "/quality",
            icon: ShieldAlert,
            show: (isOwner || isManager || isDirector) && mod("quality"),
          },
          {
            title: tr("График Gantt"),
            url: "/gantt",
            icon: GanttChartSquare,
            show: (isOwner || isManager || isDirector) && mod("gantt"),
          },
        ],
      },
      {
        label: tr("Шуъбаи Кадр"),
        icon: UsersRound,
        items: [
          { title: t("nav.staff"), url: "/staff", icon: UserCog, show: isOwner && mod("staff") },
          { title: tr("Директорҳо"), url: "/directors", icon: Shield, show: isOwner },
          { title: tr("Ҳиссаи ман"), url: "/my-shares", icon: Percent, show: isDirector },
          { title: tr("Даромади ман"), url: "/my-earnings", icon: Wallet, show: !!isTeamMember },
          {
            title: tr("Настройки"),
            url: "/settings",
            icon: Settings,
            show: !isDirector && mod("settings"),
          },
          { title: tr("Дастгирӣ"), url: "/support", icon: LifeBuoy, show: !isDirector },
        ],
      },
      {
        label: tr("Кассир"),
        icon: Wallet,
        items: [
          {
            title: tr("Кассир"),
            url: "/cashier",
            icon: Wallet,
            show: (isOwner || isAccountant || isDirector) && mod("cashier"),
          },
        ],
      },
    ];
  }

  if (!isPlatformAdmin && !isOwner && !isDirector && !warehouseOnly) {
    const deptGroups: Record<string, NavGroup> = {
      sales: {
        label: tr("Шуъбаи Фурӯш"),
        icon: ShoppingCart,
        items: [
          { title: tr("Дашборд"), url: "/dashboard", icon: LayoutDashboard, show: true },
          { title: t("nav.projects"), url: "/projects", icon: Building2, show: mod("projects") },
          { title: t("nav.customers"), url: "/customers", icon: Users, show: mod("customers") },
          {
            title: tr("Воронка фурӯш"),
            url: "/crm-funnel",
            icon: TrendingUp,
            show: mod("crm-funnel"),
          },
          { title: tr("WhatsApp"), url: "/whatsapp", icon: MessageCircle, show: true },
          { title: tr("Договор"), url: "/contracts", icon: FileSignature, show: mod("contracts") },
          { title: t("nav.payments"), url: "/payments", icon: Wallet, show: mod("payments") },
          { title: tr("Должники"), url: "/debtors", icon: HandCoins, show: mod("debtors") },
        ],
      },
      legal: {
        label: tr("Шуъбаи Ҳуқуқӣ"),
        icon: Scale,
        items: [
          { title: tr("Договор"), url: "/contracts", icon: FileSignature, show: mod("contracts") },
          { title: tr("Иҷозатномаҳо"), url: "/permits", icon: Stamp, show: mod("permits") },
          {
            title: tr("Ҳисоботи давлатӣ"),
            url: "/tax-reports",
            icon: Landmark,
            show: mod("tax-reports"),
          },
        ],
      },
      accounting: {
        label: tr("Шуъбаи Муҳосибот"),
        icon: Calculator,
        items: [
          { title: t("nav.expenses"), url: "/expenses", icon: Receipt, show: mod("expenses") },
          { title: tr("Склад"), url: "/warehouse", icon: Boxes, show: mod("warehouse") },
          { title: tr("Снабженец"), url: "/supply", icon: PackageSearch, show: true },
          { title: tr("Поставщики"), url: "/payables", icon: Banknote, show: mod("payables") },
          { title: tr("Отчёт ОПУ"), url: "/reports", icon: FileText, show: mod("reports") },
          { title: tr("Тарифы и оплата"), url: "/billing", icon: CreditCard, show: mod("billing") },
          { title: "AI Кредитҳо", url: "/ai-credits", icon: Sparkles, show: true },
        ],
      },
      cashier: {
        label: tr("Кассир"),
        icon: Wallet,
        items: [{ title: tr("Кассир"), url: "/cashier", icon: Wallet, show: mod("cashier") }],
      },
      construction: {
        label: tr("Шуъбаи Назорати Сохтмон"),
        icon: HardHatIcon,
        items: [
          { title: t("nav.projects"), url: "/projects", icon: Building2, show: mod("projects") },
          { title: tr("Табел"), url: "/attendance", icon: HardHat, show: mod("attendance") },
          {
            title: tr("Пудратчиён"),
            url: "/subcontractors",
            icon: Wrench,
            show: mod("subcontractors"),
          },
          { title: tr("Техника"), url: "/equipment", icon: Truck, show: mod("equipment") },
          {
            title: tr("Сифат ва Бехатарӣ"),
            url: "/quality",
            icon: ShieldAlert,
            show: mod("quality"),
          },
          { title: tr("График Gantt"), url: "/gantt", icon: GanttChartSquare, show: mod("gantt") },
        ],
      },
      hr: {
        label: tr("Шуъбаи Кадр"),
        icon: UsersRound,
        items: [
          { title: t("nav.staff"), url: "/staff", icon: UserCog, show: mod("staff") },
          { title: tr("Директорҳо"), url: "/directors", icon: Shield, show: true },
          { title: tr("Настройки"), url: "/settings", icon: Settings, show: mod("settings") },
        ],
      },
    };
    const mine = department ? deptGroups[department] : null;
    const allowed = new Set<string>();
    if (mine) for (const it of mine.items) allowed.add(it.url);
    for (const u of extraPages) allowed.add(u);
    for (const u of deniedPages) allowed.delete(u);

    groups = [];
    for (const key of Object.keys(deptGroups) as (keyof typeof deptGroups)[]) {
      const g = deptGroups[key];
      const items = g.items.filter((i) => allowed.has(i.url));
      if (items.length > 0) groups.push({ label: g.label, icon: g.icon, items });
    }
    groups.push({
      label: tr("Дастгирӣ"),
      icon: LifeBuoy,
      items: [{ title: tr("Дастгирӣ"), url: "/support", icon: LifeBuoy, show: true }],
    });
  }

  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  const primaryRole = roles[0] ?? "manager";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link to="/" onClick={closeMobile} className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white overflow-hidden">
            <img src={faviconUrl} alt="Binosoz.tj" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-display text-base font-semibold tracking-tight text-sidebar-foreground">
                {t("app.name")}
              </span>
              <span className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                {t("app.tagline")}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => {
          const visible = group.items.filter((i) => i.show);
          if (visible.length === 0) return null;
          const groupActive = visible.some((i) => isActive(i.url));

          if (collapsed) {
            const GroupIcon = group.icon;
            return (
              <SidebarGroup key={group.label} className="py-1">
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            groupActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          }`}
                          aria-label={group.label}
                        >
                          <GroupIcon className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">{group.label}</TooltipContent>
                  </Tooltip>
                  <PopoverContent side="right" align="start" className="w-56 p-1">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </div>
                    <div className="flex flex-col">
                      {visible.map((item) => (
                        <Link
                          key={group.label + item.url}
                          to={item.url}
                          onClick={closeMobile}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                            isActive(item.url)
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </SidebarGroup>
            );
          }

          return (
            <CollapsibleGroup
              key={group.label}
              label={group.label}
              icon={group.icon}
              defaultOpen={false}
            >
              <SidebarMenu>
                {visible.map((item) => (
                  <SidebarMenuItem key={group.label + item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} onClick={closeMobile} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </CollapsibleGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                title={t("common.logout")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("common.logout")}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              {(user?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{user?.email}</p>
              <p className="text-[10px] text-sidebar-foreground/60">
                {tr(ROLE_LABELS[primaryRole])}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
              title={t("common.logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapsibleGroup({
  label,
  icon: Icon,
  defaultOpen,
  children,
}: {
  label: string;
  icon: any;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <SidebarGroup>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
            <Icon className="h-4 w-4 shrink-0" />
            <SidebarGroupLabel className="!p-0 !h-auto flex-1 text-left">{label}</SidebarGroupLabel>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}
