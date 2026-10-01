// Gabriela · Funcionalidad 3 — Vehículos y costo de mantenerlos (HU09–HU13)
import { screen, within } from "@testing-library/react";
import { VehiclesView, VehicleDetail } from "@/components/vehicles/VehiclesView";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { vehiclesStore, taxesStore, vehicleExpensesStore } from "@/data/stores";
import { normalizePlate, validateVehicle, vehicleCost, emptyVehicle } from "@/lib/domain/vehicles";
import { renderApp, mockRouter } from "../test-utils";

const NOW = new Date(2026, 8, 30);

describe("HU09 · Listar vehículos", () => {
  it("muestra placa, marca, modelo, año y hogar", () => {
    renderApp(<VehiclesView />);
    const card = screen.getByRole("link", { name: /Mazda 3 Grand Touring/ });
    expect(card).toHaveTextContent("ABC 123");
    expect(card).toHaveTextContent("2022");
    expect(card).toHaveTextContent("Casa Principal");
  });

  it("muestra el contador de vehículos", () => {
    renderApp(<VehiclesView />);
    expect(screen.getByText("2 vehículos")).toBeInTheDocument();
  });

  it("muestra estado vacío con la acción de registrar el primero", () => {
    vehiclesStore.set([]);
    renderApp(<VehiclesView />);
    expect(screen.getByRole("link", { name: "Registrar mi primer vehículo" })).toHaveAttribute("href", "/es/vehiculos/nuevo");
  });
});

describe("HU10 · Registrar vehículo", () => {
  const input = { ...emptyVehicle("h1"), brand: "Kia", model: "Picanto", year: 2024 };

  it("valida el formato de la placa (carro y moto)", () => {
    expect(validateVehicle({ ...input, plate: "AB123" }, [], undefined, NOW).plate).toBe("plate");
    expect(validateVehicle({ ...input, plate: "abc 123" }, [], undefined, NOW).plate).toBeUndefined();
    expect(validateVehicle({ ...input, plate: "XYZ45F", type: "moto" }, [], undefined, NOW).plate).toBeUndefined();
  });

  it("no permite placas repetidas ni años fuera de rango", () => {
    expect(validateVehicle({ ...input, plate: "ABC-123" }, vehiclesStore.get(), undefined, NOW).plate).toBe("plateTaken");
    expect(validateVehicle({ ...input, plate: "KKK111", year: 2028 }, [], undefined, NOW).year).toBe("yearRange");
    expect(validateVehicle({ ...input, plate: "KKK111", year: 2027 }, [], undefined, NOW).year).toBeUndefined();
  });

  it("al guardar aparece en el listado", async () => {
    const { user } = renderApp(<VehicleForm />);
    await user.type(screen.getByLabelText(/Placa/), "kkk111");
    await user.type(screen.getByLabelText(/Marca/), "Kia");
    await user.type(screen.getByLabelText(/Modelo/), "Picanto");
    await user.click(screen.getByRole("button", { name: "Añadir vehículo" }));
    expect(vehiclesStore.get().find((v) => v.plate === "KKK111")).toBeTruthy();
    expect(mockRouter().push).toHaveBeenCalledWith("/es/vehiculos");
  });
});

describe("HU11 · Editar vehículo", () => {
  it("precarga el formulario con los datos del vehículo", () => {
    renderApp(<VehicleForm id="v1" />);
    expect(screen.getByLabelText(/Placa/)).toHaveValue("ABC123");
    expect(screen.getByLabelText(/Hogar asociado/)).toHaveValue("h1");
  });

  it("permite cambiar el hogar asociado con las mismas validaciones", async () => {
    const { user } = renderApp(<VehicleForm id="v1" />);
    await user.selectOptions(screen.getByLabelText(/Hogar asociado/), "h2");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(vehiclesStore.get().find((v) => v.id === "v1")?.householdId).toBe("h2");
  });

  it("al editar no se considera duplicada su propia placa, pero sí la de otro", () => {
    const list = vehiclesStore.get();
    const v1 = list.find((v) => v.id === "v1")!;
    expect(validateVehicle(v1, list, "v1", NOW).plate).toBeUndefined();
    expect(validateVehicle({ ...v1, plate: "XYZ987" }, list, "v1", NOW).plate).toBe("plateTaken");
    expect(normalizePlate(" xyz-987 ")).toBe("XYZ987");
  });
});

describe("HU12 · Eliminar vehículo", () => {
  it("la confirmación advierte que se eliminan impuestos y gastos", async () => {
    const { user } = renderApp(<VehicleDetail id="v1" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Mazda/ }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("También se eliminarán los impuestos y gastos asociados");
    expect(dialog).toHaveTextContent("Se eliminarán 2 impuestos y 3 gastos.");
  });

  it("al cancelar no elimina nada", async () => {
    const { user } = renderApp(<VehicleDetail id="v1" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Mazda/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(vehiclesStore.get()).toHaveLength(2);
  });

  it("al confirmar elimina el vehículo en cascada", async () => {
    const { user } = renderApp(<VehicleDetail id="v1" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Mazda/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(vehiclesStore.get().some((v) => v.id === "v1")).toBe(false);
    expect(taxesStore.get().some((t) => t.assetId === "v1")).toBe(false);
    expect(vehicleExpensesStore.get().some((e) => e.vehicleId === "v1")).toBe(false);
  });
});

describe("HU13 · Ver detalle y costo del vehículo", () => {
  it("suma el costo acumulado del periodo separado en impuestos y gastos", () => {
    const cost = vehicleCost(
      "v9",
      [{ id: "t", type: "vehicular", assetType: "vehiculo", assetId: "v9", year: 2026, amount: 500, dueDate: "2026-05-01", status: "pendiente", paymentMode: "contado", installments: [], createdAt: "" }],
      [
        { id: "e1", vehicleId: "v9", category: "combustible", description: "", amount: 100, date: "2026-06-01" },
        { id: "e2", vehicleId: "v9", category: "otro", description: "", amount: 999, date: "2025-01-01" },
      ],
      "2026-01-01",
      "2026-12-31",
    );
    expect(cost).toMatchObject({ taxes: 500, expenses: 100, total: 600 });
  });

  it("muestra datos, impuestos asociados y gastos registrados", () => {
    renderApp(<VehicleDetail id="v1" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mazda 3 Grand Touring");
    expect(screen.getByRole("heading", { name: "Impuestos asociados" }).parentElement).toHaveTextContent("Impuesto vehicular");
    expect(screen.getByText("Cambio de aceite", { exact: false })).toBeInTheDocument();
  });

  it("al cambiar el periodo cambia el costo acumulado", async () => {
    const { user } = renderApp(<VehicleDetail id="v1" />);
    const before = screen.getByTestId("vehicle-total").textContent;
    await user.clear(screen.getByLabelText("Desde"));
    await user.type(screen.getByLabelText("Desde"), new Date().toISOString().slice(0, 10));
    expect(screen.getByTestId("vehicle-total").textContent).not.toBe(before);
  });

  it("tiene la opción de volver al listado", () => {
    renderApp(<VehicleDetail id="v1" />);
    expect(screen.getByRole("link", { name: "Volver a vehículos" })).toHaveAttribute("href", "/es/vehiculos");
  });
});
