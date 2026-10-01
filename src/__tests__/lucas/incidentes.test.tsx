// Lucas · Funcionalidad 2 — Reportes de fallas y cortes (HU05–HU08)
import { fireEvent, screen, within } from "@testing-library/react";
import { IncidentsView } from "@/components/incidents/IncidentsView";
import { IncidentForm } from "@/components/incidents/IncidentForm";
import { incidentsStore } from "@/data/stores";
import {
  chronologicalLog,
  closeIncident,
  filterIncidents,
  nextIncidentCode,
  sortIncidents,
  transitionIncident,
  validateIncident,
  defaultIncidentFilters,
  emptyIncident,
} from "@/lib/domain/incidents";
import { renderApp, mockRouter } from "../test-utils";

const NOW = new Date(2026, 8, 30, 12);

describe("HU05 · Listar incidentes", () => {
  it("muestra servicio, tipo, fecha y estado de cada incidente", () => {
    renderApp(<IncidentsView />);
    const item = screen.getByRole("link", { name: /INC-\d{4}-042/ });
    expect(item).toHaveTextContent("Abierto");
    expect(item).toHaveTextContent("Falla técnica");
    expect(item).toHaveTextContent("Acueducto de Bogotá");
    expect(item).toHaveTextContent("Hoy");
  });

  it("los abiertos aparecen primero", () => {
    const sorted = sortIncidents(incidentsStore.get());
    expect(sorted[0].status).toBe("abierto");
    expect(sorted.at(-1)!.status).toBe("cerrado");
  });

  it("filtra por estado y por servicio afectado", async () => {
    const { user } = renderApp(<IncidentsView />);
    await user.selectOptions(screen.getByLabelText("Estado"), "en_gestion");
    const items = screen.getAllByRole("listitem").filter((li) => li.dataset.status);
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute("data-status", "en_gestion");
    expect(filterIncidents(incidentsStore.get(), { ...defaultIncidentFilters, serviceId: "s1" }).every((i) => i.serviceId === "s1")).toBe(true);
  });

  it("muestra el estado vacío con la acción de reportar una falla", () => {
    incidentsStore.set([]);
    renderApp(<IncidentsView />);
    expect(screen.getByText("No has reportado incidentes")).toBeInTheDocument();
  });
});

describe("HU06 · Reportar falla", () => {
  it("la fecha de inicio no puede ser futura y los campos son obligatorios", () => {
    expect(validateIncident({ ...emptyIncident(), serviceId: "s1", startedAt: "2026-10-05T10:00", description: "Se fue la luz en todo el barrio" }, NOW).startedAt).toBe("futureDate");
    expect(validateIncident(emptyIncident(), NOW)).toMatchObject({ serviceId: "required", startedAt: "required", description: "required" });
  });

  it("genera un código consecutivo", () => {
    expect(nextIncidentCode(incidentsStore.get(), NOW)).toBe("INC-2026-043");
  });

  it("al guardar aparece con estado 'abierto', radicado y evidencia", async () => {
    const { user } = renderApp(<IncidentForm />);
    await user.selectOptions(screen.getByLabelText(/Servicio afectado/), "s2");
    await user.selectOptions(screen.getByLabelText(/Tipo de incidente/), "corte");
    await user.type(screen.getByLabelText(/Fecha y hora de inicio/), "2026-09-01T08:30");
    await user.type(screen.getByLabelText(/^Descripción/), "Corte de energía desde la madrugada");
    await user.type(screen.getByLabelText(/Número de radicado/), "ENEL-1");
    await user.upload(screen.getByLabelText(/Evidencia/), new File(["img"], "foto.png", { type: "image/png" }));
    await screen.findByRole("link", { name: /foto.png/ });
    await user.click(screen.getByRole("button", { name: "Reportar falla" }));
    const created = incidentsStore.get().find((i) => i.filingNumber === "ENEL-1")!;
    expect(created.status).toBe("abierto");
    expect(created.evidence?.name).toBe("foto.png");
    expect(mockRouter().push).toHaveBeenCalledWith(`/es/incidentes/${created.id}`);
  });

  it("rechaza archivos de evidencia con formato no permitido", async () => {
    renderApp(<IncidentForm />);
    fireEvent.change(screen.getByLabelText(/Evidencia/), { target: { files: [new File(["x"], "virus.exe", { type: "application/x-msdownload" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Formato no permitido");
  });
});

describe("HU07 · Actualizar estado del incidente", () => {
  it("cada cambio registra fecha y comentario en la bitácora", () => {
    const inc = incidentsStore.get()[0];
    const next = transitionIncident(inc, "en_gestion", "Visita agendada", NOW);
    expect(next.status).toBe("en_gestion");
    expect(next.log.at(-1)).toEqual({ status: "en_gestion", date: NOW.toISOString(), comment: "Visita agendada" });
  });

  it("la bitácora se muestra en orden cronológico", () => {
    const inc = incidentsStore.get()[1];
    const log = chronologicalLog({ ...inc, log: [...inc.log].reverse() });
    expect(log.map((l) => l.status)).toEqual(["abierto", "en_gestion"]);
  });

  it("desde el detalle se cambia el estado y aparece en la línea de tiempo", async () => {
    const { user } = renderApp(<IncidentsView selectedId="inc1" />);
    const panel = screen.getByRole("region", { name: /Falla técnica · Agua/ });
    await user.selectOptions(within(panel).getByLabelText("Estado"), "resuelto");
    await user.type(within(panel).getByLabelText("Comentario de seguimiento"), "Plomero reparó la tubería");
    await user.click(within(panel).getByRole("button", { name: "Registrar cambio" }));
    expect(incidentsStore.get().find((i) => i.id === "inc1")?.status).toBe("resuelto");
    expect(screen.getByText("Plomero reparó la tubería")).toBeInTheDocument();
  });

  it("permite editar la descripción y el número de radicado", async () => {
    const { user } = renderApp(<IncidentsView selectedId="inc1" />);
    await user.click(screen.getByRole("button", { name: "Editar descripción y radicado" }));
    await user.clear(screen.getByLabelText("Número de radicado"));
    await user.type(screen.getByLabelText("Número de radicado"), "EAAB-NEW");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(incidentsStore.get().find((i) => i.id === "inc1")?.filingNumber).toBe("EAAB-NEW");
  });
});

describe("HU08 · Cerrar incidente", () => {
  it("cerrar registra la fecha de solución y el comentario", () => {
    const closed = closeIncident(incidentsStore.get()[0], "2026-09-29", "Solucionado", NOW);
    expect(closed).toMatchObject({ status: "cerrado", closedAt: "2026-09-29" });
    expect(closed.log.at(-1)?.comment).toBe("Solucionado");
  });

  it("un incidente cerrado sale de los activos pero sigue en el historial", () => {
    const list = incidentsStore.get();
    expect(filterIncidents(list, defaultIncidentFilters).some((i) => i.status === "cerrado")).toBe(false);
    expect(filterIncidents(list, { ...defaultIncidentFilters, showClosed: true }).some((i) => i.status === "cerrado")).toBe(true);
  });

  it("se cierra desde el detalle indicando fecha y comentario", async () => {
    const { user } = renderApp(<IncidentsView selectedId="inc1" />);
    await user.click(screen.getByRole("button", { name: "Cerrar incidente" }));
    await user.type(screen.getByLabelText(/Comentario de cierre/), "La empresa reparó la fuga");
    await user.click(screen.getByRole("button", { name: "Confirmar cierre" }));
    expect(incidentsStore.get().find((i) => i.id === "inc1")?.status).toBe("cerrado");
  });

  it("eliminar pide confirmación; al cancelar no cambia nada y al confirmar se borra", async () => {
    const { user } = renderApp(<IncidentsView selectedId="inc2" />);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Se perderá su bitácora");
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(incidentsStore.get()).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(incidentsStore.get().some((i) => i.id === "inc2")).toBe(false);
  });
});
