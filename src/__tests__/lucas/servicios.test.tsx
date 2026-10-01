// Lucas · Funcionalidad 1 — CRUD de servicios públicos (HU01–HU04)
import { screen, within } from "@testing-library/react";
import { ServicesView, ServiceDetail } from "@/components/services/ServicesView";
import { ServiceForm } from "@/components/services/ServiceForm";
import { servicesStore, invoicesStore, alertRulesStore, incidentsStore, selectedHouseholdStore } from "@/data/stores";
import { validateService, isDuplicateService, lastInvoice, emptyService } from "@/lib/domain/services";
import { renderApp, mockRouter, setSearch } from "../test-utils";

describe("HU01 · Listar servicios", () => {
  it("muestra tipo, empresa, número de cuenta y valor de la última factura", () => {
    renderApp(<ServicesView />);
    const card = screen.getByRole("link", { name: /Enel Colombia[\s\S]*Energía/ });
    expect(card).toHaveTextContent("928374");
    expect(card).toHaveTextContent("$ 142.500");
  });

  it("muestra contador y selector de hogar que filtra el listado", async () => {
    const { user } = renderApp(<ServicesView />);
    expect(screen.getByText("4 servicios")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Hogar"), "h2");
    expect(screen.getByText("2 servicios")).toBeInTheDocument();
    expect(selectedHouseholdStore.get()).toBe("h2");
  });

  it("muestra estado vacío con la acción de registrar el primero", () => {
    servicesStore.set([]);
    renderApp(<ServicesView />);
    expect(screen.getByText("Este hogar no tiene servicios")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Registrar mi primer servicio" })).toBeInTheDocument();
  });

  it("el detalle muestra el historial de facturas del servicio", () => {
    renderApp(<ServiceDetail id="s1" />);
    const table = screen.getByRole("table", { name: "Historial de facturas" });
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 13);
    expect(lastInvoice("s1", invoicesStore.get())?.period).toBe(within(table).getAllByRole("row")[1].querySelector("a")?.getAttribute("href")?.split("_").pop());
  });
});

describe("HU02 · Registrar servicio", () => {
  const input = { ...emptyService("h1"), provider: "EPM", accountNumber: "847291" };

  it("valida los campos obligatorios", () => {
    expect(validateService(emptyService(""), [])).toMatchObject({ householdId: "required", provider: "required", accountNumber: "required" });
  });

  it("no permite el mismo tipo de servicio con el mismo número de cuenta en el hogar", () => {
    expect(isDuplicateService(input, servicesStore.get())).toBe(true);
    expect(validateService(input, servicesStore.get()).accountNumber).toBe("duplicateService");
    expect(isDuplicateService({ ...input, householdId: "h2" }, servicesStore.get())).toBe(false);
  });

  it("al guardar aparece en el listado y queda disponible para facturas", async () => {
    setSearch("hogar=h2");
    const { user } = renderApp(<ServiceForm />);
    await user.selectOptions(screen.getByLabelText(/Tipo de servicio/), "internet");
    await user.type(screen.getByLabelText(/Empresa prestadora/), "Claro");
    await user.type(screen.getByLabelText(/Número de cuenta/), "77001");
    await user.click(screen.getByRole("button", { name: "Registrar servicio" }));
    expect(servicesStore.get().find((s) => s.provider === "Claro")).toMatchObject({ householdId: "h2", type: "internet" });
    expect(mockRouter().push).toHaveBeenCalledWith("/es/servicios");
  });

  it("muestra error claro cuando falta información", async () => {
    const { user } = renderApp(<ServiceForm />);
    await user.click(screen.getByRole("button", { name: "Registrar servicio" }));
    expect(screen.getAllByText("Este campo es obligatorio.").length).toBeGreaterThanOrEqual(2);
  });
});

describe("HU03 · Editar servicio", () => {
  it("precarga el formulario con la información actual", () => {
    renderApp(<ServiceForm id="s2" />);
    expect(screen.getByLabelText(/Empresa prestadora/)).toHaveValue("Enel Colombia");
    expect(screen.getByLabelText(/Día de corte/)).toHaveValue(15);
  });

  it("guarda cambios sin afectar las facturas registradas", async () => {
    const before = invoicesStore.get().filter((i) => i.serviceId === "s2").length;
    const { user } = renderApp(<ServiceForm id="s2" />);
    await user.clear(screen.getByLabelText(/Empresa prestadora/));
    await user.type(screen.getByLabelText(/Empresa prestadora/), "Celsia");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(servicesStore.get().find((s) => s.id === "s2")?.provider).toBe("Celsia");
    expect(invoicesStore.get().filter((i) => i.serviceId === "s2")).toHaveLength(before);
  });

  it("el tipo de servicio no es editable y cancelar conserva los datos", async () => {
    const { user } = renderApp(<ServiceForm id="s2" />);
    expect(screen.getByLabelText(/Tipo de servicio/)).toBeDisabled();
    await user.clear(screen.getByLabelText(/Empresa prestadora/));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(servicesStore.get().find((s) => s.id === "s2")?.provider).toBe("Enel Colombia");
  });
});

describe("HU04 · Eliminar servicio", () => {
  it("la confirmación advierte que se eliminan facturas, alertas e incidentes", async () => {
    const { user } = renderApp(<ServiceDetail id="s1" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Agua/ }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("facturas, alertas e incidentes");
  });

  it("al cancelar permanece en la misma pantalla sin eliminar", async () => {
    const { user } = renderApp(<ServiceDetail id="s1" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Agua/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(servicesStore.get().some((s) => s.id === "s1")).toBe(true);
    expect(mockRouter().push).not.toHaveBeenCalled();
  });

  it("al confirmar elimina el servicio en cascada", async () => {
    const { user } = renderApp(<ServiceDetail id="s1" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Agua/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(servicesStore.get().some((s) => s.id === "s1")).toBe(false);
    expect(invoicesStore.get().some((i) => i.serviceId === "s1")).toBe(false);
    expect(alertRulesStore.get().some((r) => r.serviceId === "s1")).toBe(false);
    expect(incidentsStore.get().some((i) => i.serviceId === "s1")).toBe(false);
  });
});
