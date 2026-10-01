"use client";
// useTaxDetail — acciones sobre un impuesto: plan de cuotas (HU13),
// descuento por pronto pago (HU14), pago con soporte (HU15) e histórico (HU16).
import { useCallback, useMemo } from "react";
import type { Installment, TaxPayment } from "@/types";
import { useHouseholds, useTaxes, useVehicles } from "./useDomain";
import {
  generateInstallments,
  installmentsMatch,
  installmentsTotal,
  isDiscountActive,
  payableAmount,
  projectTax,
  taxDisplayStatus,
  taxHistory,
} from "@/lib/domain/taxes";

export function useAssetName() {
  const households = useHouseholds();
  const vehicles = useVehicles();
  return useCallback(
    (assetType: "hogar" | "vehiculo", assetId: string) => {
      if (assetType === "hogar") return households.getById(assetId)?.name ?? "—";
      const v = vehicles.getById(assetId);
      return v ? `${v.brand} ${v.model} (${v.plate})` : "—";
    },
    [households, vehicles],
  );
}

export function useTaxDetail(id: string, now: Date = new Date()) {
  const taxes = useTaxes();
  const tax = taxes.getById(id);
  const nowKey = now.toDateString();

  const derived = useMemo(() => {
    if (!tax) return null;
    const today = new Date(nowKey);
    const history = taxHistory(tax, taxes.items);
    return {
      status: taxDisplayStatus(tax, today),
      discountActive: isDiscountActive(tax, today),
      payable: payableAmount(tax, today),
      installmentsTotal: installmentsTotal(tax.installments),
      installmentsMatch: tax.paymentMode === "contado" || installmentsMatch(tax.installments, tax.amount),
      history,
      projection: projectTax(history),
    };
  }, [tax, taxes.items, nowKey]);

  const setCash = useCallback(() => taxes.update(id, { paymentMode: "contado", installments: [] }), [taxes, id]);

  const createPlan = useCallback(
    (count: number, firstDueDate: string) => {
      if (!tax) return;
      taxes.update(id, { paymentMode: "cuotas", installments: generateInstallments(tax.amount, count, firstDueDate) });
    },
    [taxes, id, tax],
  );

  const updateInstallment = useCallback(
    (number: number, changes: Partial<Installment>) => {
      if (!tax) return;
      taxes.update(id, { installments: tax.installments.map((c) => (c.number === number ? { ...c, ...changes } : c)) });
    },
    [taxes, id, tax],
  );

  const saveDiscount = useCallback(
    (percent: number, deadline: string) => taxes.update(id, { discount: { percent, deadline } }),
    [taxes, id],
  );
  const removeDiscount = useCallback(() => taxes.update(id, { discount: undefined }), [taxes, id]);

  const markPaid = useCallback(
    (payment: TaxPayment) =>
      taxes.update(id, {
        status: "pagado",
        payment,
        installments: tax?.installments.map((c) => ({ ...c, paid: true, paidAt: c.paidAt ?? payment.date })) ?? [],
      }),
    [taxes, id, tax],
  );

  const revertPayment = useCallback(
    () =>
      taxes.update(id, {
        status: "pendiente",
        payment: undefined,
        installments: tax?.installments.map((c) => ({ ...c, paid: false, paidAt: undefined })) ?? [],
      }),
    [taxes, id, tax],
  );

  /** Pago de una cuota; si quedan todas pagadas el impuesto pasa a "pagado". */
  const payInstallment = useCallback(
    (number: number, date: string) => {
      if (!tax) return;
      const installments = tax.installments.map((c) => (c.number === number ? { ...c, paid: true, paidAt: date } : c));
      const allPaid = installments.every((c) => c.paid);
      taxes.update(id, {
        installments,
        ...(allPaid ? { status: "pagado" as const, payment: { date, amount: installmentsTotal(installments) } } : {}),
      });
    },
    [taxes, id, tax],
  );

  return { tax, derived, setCash, createPlan, updateInstallment, saveDiscount, removeDiscount, markPaid, revertPayment, payInstallment, remove: () => taxes.remove(id) };
}
