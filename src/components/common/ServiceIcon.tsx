"use client";
import { Droplets, Flame, Recycle, Wifi, Zap } from "lucide-react";
import type { ServiceType } from "@/types";
import { cx } from "@/lib/utils";

const ICONS = { agua: Droplets, energia: Zap, gas: Flame, internet: Wifi, aseo: Recycle } as const;
const TONES: Record<ServiceType, string> = {
  agua: "bg-secondary-container text-on-secondary-container",
  energia: "bg-tertiary-container text-on-tertiary-container",
  gas: "bg-primary-container text-on-primary-container",
  internet: "bg-surface-highest text-on-surface-variant",
  aseo: "bg-primary-fixed text-primary",
};

export function ServiceIcon({ type, size = "md" }: { type: ServiceType; size?: "sm" | "md" | "lg" }) {
  const Icon = ICONS[type];
  const dims = { sm: "size-9", md: "size-12", lg: "size-14" }[size];
  return (
    <span aria-hidden="true" className={cx("flex shrink-0 items-center justify-center rounded-full", dims, TONES[type])}>
      <Icon className="size-5" />
    </span>
  );
}
