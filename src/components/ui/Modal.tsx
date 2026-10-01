"use client";
// Diálogo modal accesible: role="dialog", aria-modal, título asociado,
// focus trap y cierre con Escape. Base del diálogo de confirmación del Figma
// ("¿Eliminar 'Casa Principal'?").
import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useUi";
import { useI18n } from "@/i18n/I18nProvider";
import { Button, IconButton } from "./Button";
import { cx } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  role = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  role?: "dialog" | "alertdialog";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const { dict } = useI18n();
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-on-surface/40 p-4 backdrop-blur-sm sm:items-center">
      <div aria-hidden="true" className="absolute inset-0" onClick={onClose} />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[90vh] w-full flex-col gap-5 overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl",
          { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" }[size],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-extrabold text-on-surface">
            {title}
          </h2>
          <IconButton label={dict.common.close} onClick={onClose} variant="ghost" className="-mt-1 -mr-2">
            <X className="size-5" aria-hidden="true" />
          </IconButton>
        </div>
        {description && (
          <div id={descId} className="text-on-surface-variant">
            {description}
          </div>
        )}
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "danger",
  children,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "danger" | "primary";
  children?: ReactNode;
}) {
  const { dict } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      size="sm"
      role="alertdialog"
      footer={
        <>
          <Button variant="tonal" onClick={onCancel}>
            {cancelLabel ?? dict.common.cancel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel ?? dict.common.confirm}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
