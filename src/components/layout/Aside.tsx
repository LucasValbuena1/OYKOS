"use client";
// Menú lateral del Figma. En escritorio es fijo; en celular es un drawer.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Building2,
  CalendarDays,
  Car,
  Home,
  LayoutDashboard,
  Receipt,
  Sparkles,
  Upload,
  UserCog,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { Dictionary } from "@/i18n/types";
import { cx } from "@/lib/utils";
import { Logo } from "./Logo";

type NavKey = keyof Dictionary["nav"];

export const NAV_ITEMS: { key: NavKey; path: string; icon: LucideIcon }[] = [
  { key: "dashboard", path: "/dashboard", icon: LayoutDashboard },
  { key: "calendar", path: "/calendario", icon: CalendarDays },
  { key: "households", path: "/hogares", icon: Home },
  { key: "services", path: "/servicios", icon: Zap },
  { key: "invoices", path: "/facturas", icon: Receipt },
  { key: "taxes", path: "/impuestos", icon: Building2 },
  { key: "vehicles", path: "/vehiculos", icon: Car },
  { key: "alerts", path: "/alertas", icon: BellRing },
  { key: "assistant", path: "/asistente", icon: Sparkles },
  { key: "incidents", path: "/incidentes", icon: AlertTriangle },
];

export const NAV_FOOTER: { key: NavKey; path: string; icon: LucideIcon }[] = [
  { key: "reports", path: "/reportes", icon: Upload },
  { key: "profile", path: "/perfil", icon: UserCog },
];

export function isActivePath(pathname: string, locale: string, path: string) {
  const full = `/${locale}${path}`;
  return pathname === full || pathname.startsWith(`${full}/`);
}

function NavLink({ item, onNavigate }: { item: (typeof NAV_ITEMS)[number]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { dict, locale, href } = useI18n();
  const active = isActivePath(pathname, locale, item.path);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={href(item.path)}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-bold tracking-wider uppercase transition",
          active ? "bg-primary text-on-primary shadow" : "text-on-surface-variant hover:bg-surface-high",
        )}
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        {dict.nav[item.key]}
      </Link>
    </li>
  );
}

export function Aside({ onNavigate, id }: { onNavigate?: () => void; id?: string }) {
  const { dict, href } = useI18n();
  return (
    <aside
      id={id}
      aria-label={dict.nav.label}
      className="flex h-full w-72 flex-col border-r border-outline-variant bg-surface-container"
    >
      <div className="px-8 pt-10 pb-8">
        <Link href={href("/dashboard")} onClick={onNavigate} aria-label={dict.nav.home}>
          <Logo />
        </Link>
      </div>
      <nav aria-label={dict.nav.main} className="flex flex-1 flex-col justify-between gap-6 overflow-y-auto px-4 pb-6">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.key} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
        <ul className="flex flex-col gap-1 border-t border-outline-variant pt-4">
          {NAV_FOOTER.map((item) => (
            <NavLink key={item.key} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
