// Felipe · Funcionalidad 1 — CRUD de hogares y propiedades (HU01–HU04)
import { screen, within } from "@testing-library/react";
import { HouseholdsView } from "@/components/households/HouseholdsView";
import { HouseholdForm } from "@/components/households/HouseholdForm";
import { householdsStore, servicesStore, invoicesStore, vehiclesStore } from "@/data/stores";
import { validateHousehold, countServices, emptyHousehold } from "@/lib/domain/households";
import { renderApp, mockRouter } from "../test-utils";

describe("HU01 · Listar hogares", () => {
  it("muestra cada hogar con nombre, dirección, ciudad y cantidad de servicios", () => {
    renderApp(<HouseholdsView />);
    const list = screen.getByRole("heading", { name: "2 hogares" }).parentElement!;
    const card = within(list).getByRole("link", { name: /Casa Principal/ });
    expect(card).toHaveTextContent("Calle 123 #45-67");
    expect(card).toHaveTextContent("Bogotá");
    expect(card).toHaveTextContent("4 servicios");
  });

  it("muestra un contador con la cantidad de hogares", () => {
    renderApp(<HouseholdsView />);
    expect(screen.getByRole("heading", { name: "2 hogares" })).toBeInTheDocument();
  });

  it("muestra el estado vacío con botón para crear el primer hogar", () => {
    householdsStore.set([]);
    renderApp(<HouseholdsView />);
    expect(screen.getByText("Todavía no tienes hogares")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear mi primer hogar" })).toHaveAttribute("href", "/es/hogares/nuevo");
  });

  it("cada tarjeta lleva al detalle del hogar", () => {
    renderApp(<HouseholdsView selectedId="h2" />);
    expect(screen.getAllByRole("link", { name: /Apartamento Playa/ })[0]).toHaveAttribute("href", "/es/hogares/h2");
    // Aparece en la tarjeta y en la vista detallada
    expect(screen.getByRole("region", { name: "Apartamento Playa" })).toHaveTextContent("Vista detallada");
  });

  it("countServices cuenta solo los servicios del hogar", () => {
    expect(countServices("h1", servicesStore.get())).toBe(4);
    expect(countServices("h2", servicesStore.get())).toBe(2);
  });
});

describe("HU02 · Crear hogar", () => {
  it("valida los campos obligatorios", () => {
    const errors = validateHousehold({ ...emptyHousehold });
    expect(errors).toMatchObject({ name: "required", address: "required", city: "required" });
  });

  it("muestra mensajes de error debajo de los campos al enviar vacío", async () => {
    const { user } = renderApp(<HouseholdForm />);
    await user.click(screen.getByRole("button", { name: "Añadir nuevo hogar" }));
    expect(screen.getAllByText("Este campo es obligatorio.")).toHaveLength(3);
    expect(screen.getByLabelText(/Nombre del hogar/)).toHaveAttribute("aria-invalid", "true");
    expect(householdsStore.get()).toHaveLength(2);
  });

  it("guarda el hogar, vuelve al listado y muestra confirmación", async () => {
    const { user } = renderApp(<HouseholdForm />);
    await user.type(screen.getByLabelText(/Nombre del hogar/), "Finca Guatapé");
    await user.type(screen.getByLabelText(/Dirección/), "Vereda El Roble km 3");
    await user.type(screen.getByLabelText(/Ciudad/), "Guatapé");
    await user.click(screen.getByRole("button", { name: "Añadir nuevo hogar" }));
    expect(householdsStore.get().map((h) => h.name)).toContain("Finca Guatapé");
    expect(mockRouter().push).toHaveBeenCalledWith("/es/hogares");
    expect(screen.getByRole("status")).toHaveTextContent('Hogar "Finca Guatapé" creado correctamente.');
  });

  it("permite cancelar sin guardar", async () => {
    const { user } = renderApp(<HouseholdForm />);
    await user.type(screen.getByLabelText(/Nombre del hogar/), "Temporal");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(householdsStore.get()).toHaveLength(2);
    expect(mockRouter().push).toHaveBeenCalledWith("/es/hogares");
  });
});

describe("HU03 · Editar hogar", () => {
  it("precarga el formulario con la información actual", () => {
    renderApp(<HouseholdForm id="h1" />);
    expect(screen.getByLabelText(/Nombre del hogar/)).toHaveValue("Casa Principal");
    expect(screen.getByLabelText(/Ciudad/)).toHaveValue("Bogotá");
  });

  it("aplica las mismas validaciones de la creación", async () => {
    const { user } = renderApp(<HouseholdForm id="h1" />);
    await user.clear(screen.getByLabelText(/Ciudad/));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByText("Este campo es obligatorio.")).toBeInTheDocument();
    expect(householdsStore.get().find((h) => h.id === "h1")?.city).toBe("Bogotá");
  });

  it("guarda los cambios y se reflejan en el listado", async () => {
    const { user } = renderApp(<HouseholdForm id="h1" />);
    await user.clear(screen.getByLabelText(/Nombre del hogar/));
    await user.type(screen.getByLabelText(/Nombre del hogar/), "Casa Chapinero");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(householdsStore.get().find((h) => h.id === "h1")?.name).toBe("Casa Chapinero");
    expect(mockRouter().push).toHaveBeenCalledWith("/es/hogares/h1");
  });

  it("al cancelar conserva la información original", async () => {
    const { user } = renderApp(<HouseholdForm id="h1" />);
    await user.type(screen.getByLabelText(/Nombre del hogar/), " XX");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(householdsStore.get().find((h) => h.id === "h1")?.name).toBe("Casa Principal");
  });
});

describe("HU04 · Eliminar hogar", () => {
  it("muestra un diálogo de confirmación que advierte la pérdida de información", async () => {
    const { user } = renderApp(<HouseholdsView selectedId="h1" />);
    await user.click(screen.getByRole("button", { name: "Eliminar Casa Principal" }));
    const dialog = screen.getByRole("alertdialog", { name: '¿Eliminar "Casa Principal"?' });
    expect(dialog).toHaveTextContent("También se eliminarán sus servicios, facturas");
  });

  it("al cancelar no elimina nada", async () => {
    const { user } = renderApp(<HouseholdsView selectedId="h1" />);
    await user.click(screen.getByRole("button", { name: "Eliminar Casa Principal" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(householdsStore.get()).toHaveLength(2);
  });

  it("al confirmar elimina el hogar y su información asociada", async () => {
    const { user } = renderApp(<HouseholdsView selectedId="h1" />);
    await user.click(screen.getByRole("button", { name: "Eliminar Casa Principal" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(householdsStore.get().map((h) => h.id)).toEqual(["h2"]);
    expect(servicesStore.get().some((s) => s.householdId === "h1")).toBe(false);
    expect(invoicesStore.get().some((i) => i.householdId === "h1")).toBe(false);
    expect(vehiclesStore.get().some((v) => v.householdId === "h1")).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent('Hogar "Casa Principal" eliminado.');
  });
});
