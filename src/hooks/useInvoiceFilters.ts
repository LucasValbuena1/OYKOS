"use client";
// Estado de filtros del listado de facturas (Gabriela · HU01).
import { useState } from "react";
import { defaultInvoiceFilters, type InvoiceFilters } from "@/lib/domain/invoices";

export function useInvoiceFilters(initial: InvoiceFilters = defaultInvoiceFilters) {
  const [filters, setFilters] = useState<InvoiceFilters>(initial);
  const toggleServiceType = (type: InvoiceFilters["serviceTypes"][number]) =>
    setFilters((f) => ({
      ...f,
      serviceTypes: f.serviceTypes.includes(type) ? f.serviceTypes.filter((t) => t !== type) : [...f.serviceTypes, type],
    }));
  return {
    filters,
    setStatus: (status: InvoiceFilters["status"]) => setFilters((f) => ({ ...f, status })),
    setHousehold: (householdId: string) => setFilters((f) => ({ ...f, householdId })),
    toggleServiceType,
    clear: () => setFilters(defaultInvoiceFilters),
  };
}

