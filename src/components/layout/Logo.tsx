import { cx } from "@/lib/utils";

/** Logotipo de Oykos (casa + nombre), como en el Figma. */
export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5", className)}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8" fill="none">
        <path
          d="M4 15.5 16 5l12 10.5M8 12.5V27h16V12.5"
          stroke={light ? "#ffffff" : "#404847"}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13 27v-7h6v7" stroke={light ? "#ffffff" : "#404847"} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M21 4c2 1 3 3 2.5 5-2-.2-3.3-1.6-2.5-5Z" fill={light ? "#bbece3" : "#3d6b64"} />
      </svg>
      <span className={cx("text-2xl font-extrabold tracking-tight", light ? "text-white" : "text-on-surface-variant")}>Oykos</span>
    </span>
  );
}
