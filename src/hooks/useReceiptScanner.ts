"use client";
// useReceiptScanner — Alejandro · F3 (HU10–HU14, HU16). Máquina de estados del
// escaneo: archivo → escaneo/extracción con Claude → revisión → factura con
// link de pago y estado de cada paso.
import { useCallback, useState } from "react";
import type { Attachment, Invoice, ReceiptExtraction, ScanProcessing, Service } from "@/types";
import { useInvoices, useServices } from "./useDomain";
import { readFileAsDataUrl } from "@/lib/utils";
import { validateReceiptFile, type ReceiptFileError } from "@/lib/domain/receipts";
import { lookupPaymentLink } from "@/lib/paymentLinkClient";

export type ScanPhase = "idle" | "scanning" | "extracting" | "review" | "failed";
export type ScanError = "unreadable" | "aiUnavailable" | "aiNotConfigured" | "unauthorized" | "network" | "type" | "size";
const KNOWN_ERRORS: ScanError[] = ["unreadable", "aiUnavailable", "aiNotConfigured", "unauthorized", "type", "size"];

export interface ScanResult {
  extraction: ReceiptExtraction;
}

/** Llama a la ruta de IA con el recibo (base64). */
export async function requestExtraction(attachment: Attachment, services: Pick<Service, "provider" | "type">[]): Promise<ScanResult> {
  const res = await fetch("/api/ai/scan-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mediaType: attachment.type,
      data: attachment.dataUrl.split(",")[1] ?? "",
      knownProviders: services.map((s) => ({ provider: s.provider, type: s.type })),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(res.status === 401 ? "unauthorized" : (body.error ?? "aiUnavailable"));
  }
  return (await res.json()) as ScanResult;
}

export function useReceiptScanner() {
  const services = useServices();
  const invoices = useInvoices();
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [fileError, setFileError] = useState<ReceiptFileError>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const scan = useCallback(
    async (file: Attachment) => {
      setError(null);
      setPhase("scanning");
      try {
        // Pequeña pausa para que el usuario vea el paso de escaneo antes de la extracción
        await new Promise((r) => setTimeout(r, 300));
        setPhase("extracting");
        const data = await requestExtraction(file, services.items);
        setResult(data);
        setPhase("review");
      } catch (e) {
        const code = (e as Error).message as ScanError;
        setError(KNOWN_ERRORS.includes(code) ? code : "network");
        setPhase("failed");
      }
    },
    [services.items],
  );

  const selectFile = useCallback(
    async (file: File | undefined) => {
      setFileError(null);
      if (!file) return;
      const problem = validateReceiptFile(file);
      if (problem) {
        setFileError(problem);
        return;
      }
      const att: Attachment = { name: file.name, type: file.type, size: file.size, dataUrl: await readFileAsDataUrl(file) };
      setAttachment(att);
      await scan(att);
    },
    [scan],
  );

  /** HU10: reintentar con el mismo archivo (sin volver a cargarlo). */
  const retry = useCallback(() => {
    if (attachment) void scan(attachment);
  }, [attachment, scan]);

  const reset = useCallback(() => {
    setPhase("idle");
    setAttachment(null);
    setResult(null);
    setError(null);
    setFileError(null);
  }, []);

  /**
   * HU13/HU14: crea la factura confirmada de inmediato (paso del link "en
   * curso") y luego busca el link de pago en segundo plano (HU16).
   */
  const confirm = useCallback(
    (values: Pick<Invoice, "serviceId" | "period" | "consumption" | "amount" | "dueDate"> & { reference?: string; cutoffDate?: string }): Invoice => {
      const svc = services.getById(values.serviceId);
      const now = new Date();
      const processing: ScanProcessing = {
        scan: { status: "success", finishedAt: now.toISOString() },
        extraction: { status: "success", finishedAt: now.toISOString() },
        paymentLink: { status: "running" },
      };
      const created = invoices.add({
        ...values,
        reference: values.reference?.trim() || undefined,
        cutoffDate: values.cutoffDate || undefined,
        householdId: svc?.householdId ?? "",
        status: "pendiente",
        source: "ia",
        attachment: attachment ?? undefined,
        processing,
        createdAt: now.toISOString(),
      });
      void lookupPaymentLink(svc?.provider ?? "", values.reference).then(({ link, step }) => {
        invoices.update(created.id, { paymentLink: link, processing: { ...processing, paymentLink: step } });
      });
      return created;
    },
    [services, invoices, attachment],
  );

  return { phase, attachment, fileError, error, result, selectFile, retry, reset, confirm, services: services.items };
}
