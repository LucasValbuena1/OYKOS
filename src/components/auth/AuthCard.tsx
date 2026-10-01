"use client";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

/** Tarjeta centrada de las pantallas de autenticación (Figma: Login). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <main id="contenido" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="self-end lg:absolute lg:top-6 lg:right-6">
          <LanguageSwitcher />
        </div>
        <div className="flex w-full max-w-md flex-col gap-6 rounded-[20px] bg-surface-container px-8 py-10 shadow-xl sm:px-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <Logo />
            <h1 className="text-2xl font-extrabold text-on-surface">{title}</h1>
            {subtitle && <p className="text-on-surface-variant">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
      <div
        aria-hidden="true"
        className="relative hidden flex-1 overflow-hidden bg-surface lg:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #bbece3 0, transparent 40%), radial-gradient(circle at 80% 70%, #cde9dc 0, transparent 45%), linear-gradient(135deg, #f0fcf8, #e5f0ec)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Logo className="scale-[2.5] opacity-20" />
        </div>
      </div>
    </div>
  );
}
