"use client";
// Cambia el segmento [lang] de la URL y guarda la preferencia en una cookie.
// Reparto de responsabilidades:
//   proxy.ts   → decide el idioma cuando la URL no lo trae (cookie o Accept-Language).
//   este archivo → cambio manual del usuario: reemplaza /es/... por /en/... y
//                  guarda la cookie para que el proxy la respete la próxima vez.
import { usePathname, useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { locales, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { cx } from "@/lib/utils";

export function switchLocalePath(pathname: string, next: Locale): string {
  const segments = pathname.split("/");
  segments[1] = next;
  return segments.join("/") || `/${next}`;
}

/** Guarda la preferencia para que el proxy la use en próximas visitas. */
export function persistLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, dict } = useI18n();

  function switchTo(next: Locale) {
    persistLocale(next);
    router.push(switchLocalePath(pathname, next) + window.location.search);
  }

  return (
    <div role="group" aria-label={dict.language.label} className="flex items-center gap-1 rounded-full bg-surface-container p-1">
      {!compact && <Languages aria-hidden="true" className="mx-1 size-4 text-on-surface-variant" />}
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => switchTo(l)}
          aria-pressed={l === locale}
          aria-label={dict.language.names[l]}
          className={cx(
            "rounded-full px-2.5 py-1 text-xs font-bold uppercase transition",
            l === locale ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-high",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
