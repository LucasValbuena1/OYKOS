"use client";
// Encabezado superior: menú móvil, búsqueda, selector de hogar, idioma,
// centro de notificaciones y menú de usuario (cerrar sesión desde cualquier pantalla).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { Bell, LogOut, Menu, Search, UserRound } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/hooks/useAuth";
import { useDueReminders } from "@/hooks/useDueReminders";
import { useHouseholds, useNotifications, useSelectedHousehold, useServices, useVehicles } from "@/hooks/useDomain";
import { useDisclosure } from "@/hooks/useUi";
import { IconButton } from "@/components/ui/Button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cx } from "@/lib/utils";

function GlobalSearch() {
  const { dict, href } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const households = useHouseholds();
  const services = useServices();
  const vehicles = useVehicles();
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return [
      ...households.items
        .filter((h) => `${h.name} ${h.address} ${h.city}`.toLowerCase().includes(q))
        .map((h) => ({ id: h.id, label: h.name, kind: dict.nav.households, path: `/hogares/${h.id}` })),
      ...services.items
        .filter((s) => `${s.provider} ${s.accountNumber} ${dict.serviceTypes[s.type]}`.toLowerCase().includes(q))
        .map((s) => ({ id: s.id, label: `${dict.serviceTypes[s.type]} · ${s.provider}`, kind: dict.nav.services, path: `/servicios/${s.id}` })),
      ...vehicles.items
        .filter((v) => `${v.plate} ${v.brand} ${v.model}`.toLowerCase().includes(q))
        .map((v) => ({ id: v.id, label: `${v.brand} ${v.model} (${v.plate})`, kind: dict.nav.vehicles, path: `/vehiculos/${v.id}` })),
    ].slice(0, 8);
  }, [query, households.items, services.items, vehicles.items, dict]);

  return (
    <form
      role="search"
      className="relative hidden flex-1 md:block md:max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (results[0]) {
          router.push(href(results[0].path));
          setQuery("");
        }
      }}
    >
      <label className="flex items-center gap-3 rounded-full px-3 py-2 focus-within:bg-surface-container">
        <Search aria-hidden="true" className="size-5 text-primary" />
        <span className="sr-only">{dict.header.search}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.header.searchPlaceholder}
          aria-controls={listId}
          aria-expanded={results.length > 0}
          role="combobox"
          aria-autocomplete="list"
          className="w-full bg-transparent text-base outline-none placeholder:text-placeholder"
        />
      </label>
      {results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute top-12 left-0 z-40 w-full overflow-hidden rounded-2xl bg-white py-2 shadow-xl">
          {results.map((r) => (
            <li key={r.id} role="option" aria-selected={false}>
              <Link
                href={href(r.path)}
                onClick={() => setQuery("")}
                className="flex flex-col px-4 py-2 hover:bg-surface-low focus:bg-surface-low"
              >
                <span className="font-semibold text-on-surface">{r.label}</span>
                <span className="text-xs text-on-surface-variant">{r.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function HouseholdSelector() {
  const { dict } = useI18n();
  const { households, selectedId, setSelectedId } = useSelectedHousehold();
  if (households.length < 2) return null;
  return (
    <label className="hidden items-center gap-2 lg:flex">
      <span className="sr-only">{dict.header.household}</span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => setSelectedId(e.target.value)}
        className="h-9 max-w-44 truncate rounded-full bg-surface-container px-3 text-sm font-semibold text-on-surface"
      >
        {households.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserMenu() {
  const { dict, href } = useI18n();
  const { user, logout } = useAuth();
  const menu = useDisclosure();
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (!user) return null;
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        aria-controls={menuId}
        onClick={menu.toggle}
        className="flex items-center gap-2 rounded-full p-0.5"
        aria-label={dict.header.userMenu}
      >
        {user.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photo} alt="" className="size-9 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
            {initials}
          </span>
        )}
        <span className="hidden text-sm font-semibold text-on-surface xl:inline" data-testid="header-user-name">
          {user.name}
        </span>
      </button>
      {menu.isOpen && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              menu.close();
              buttonRef.current?.focus();
            }
          }}
          className="absolute top-12 right-0 z-40 w-56 overflow-hidden rounded-2xl bg-white py-2 shadow-xl"
        >
          <Link role="menuitem" href={href("/perfil")} onClick={menu.close} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-low">
            <UserRound aria-hidden="true" className="size-4" /> {dict.nav.profile}
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-error hover:bg-error-container"
          >
            <LogOut aria-hidden="true" className="size-4" /> {dict.auth.logout}
          </button>
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { dict, href, t } = useI18n();
  const { unread: alertsUnread } = useNotifications();
  const { unread: remindersUnread } = useDueReminders();
  const unread = alertsUnread + remindersUnread;
  return (
    <Link
      href={href("/alertas/notificaciones")}
      className="relative flex size-10 items-center justify-center rounded-full text-secondary hover:bg-surface-container"
      aria-label={unread ? t(dict.header.notificationsUnread, { count: unread }) : dict.header.notifications}
    >
      <Bell aria-hidden="true" className="size-5" />
      {unread > 0 && (
        <span aria-hidden="true" className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function Header({ onOpenMenu, menuOpen, menuId }: { onOpenMenu: () => void; menuOpen: boolean; menuId: string }) {
  const { dict } = useI18n();
  return (
    <header className={cx("no-print sticky top-0 z-30 flex h-20 items-center gap-3 bg-surface/90 px-4 backdrop-blur md:px-10")}>
      <IconButton
        label={dict.header.openMenu}
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        variant="ghost"
        className="lg:hidden"
      >
        <Menu aria-hidden="true" className="size-6" />
      </IconButton>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <HouseholdSelector />
        <LanguageSwitcher />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
