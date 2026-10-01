// Pruebas transversales: internacionalización (proxy + diccionarios),
// accesibilidad y store persistente.
import { screen } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/Field";
import { HouseholdsView } from "@/components/households/HouseholdsView";
import { createPersistentStore } from "@/lib/store";
import { formatMoney, interpolate, plural } from "@/lib/utils";
import { renderApp, dictEs, dictEn } from "../test-utils";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe("i18n · Diccionarios", () => {
  it("español e inglés tienen exactamente las mismas claves", () => {
    expect(keys(dictEn).sort()).toEqual(keys(dictEs).sort());
  });

  it("interpola variables y pluraliza", () => {
    expect(interpolate("Hola, {name}", { name: "Ana" })).toBe("Hola, Ana");
    expect(plural(dictEs.households.counter, 1)).toBe("1 hogar");
    expect(plural(dictEn.households.counter, 3)).toBe("3 homes");
  });

  it("la interfaz se muestra en inglés con formato de moneda del idioma", () => {
    renderApp(<HouseholdsView />, { locale: "en" });
    expect(screen.getByRole("heading", { level: 1, name: "Home management" })).toBeInTheDocument();
    expect(formatMoney(1500, "es")).toMatch(/1\.500/);
    expect(formatMoney(1500, "en")).toMatch(/1,500/);
  });
});

describe("a11y · Componentes base", () => {
  it("los campos asocian label, aria-invalid y el mensaje de error", () => {
    renderApp(<TextField label="Nombre" name="n" error="required" />);
    const input = screen.getByLabelText("Nombre");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Este campo es obligatorio/);
  });

  it("el diálogo de confirmación es un alertdialog modal con título y se cierra con Escape", async () => {
    const onCancel = jest.fn();
    const { user } = renderApp(<ConfirmDialog open title="¿Eliminar?" message="Texto" onCancel={onCancel} onConfirm={jest.fn()} />);
    const dialog = screen.getByRole("alertdialog", { name: "¿Eliminar?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("el store persiste en localStorage y restaura el valor inicial", () => {
    const store = createPersistentStore("test-key", () => [1]);
    store.set((prev) => [...prev, 2]);
    expect(JSON.parse(localStorage.getItem("oykos:test-key")!)).toEqual([1, 2]);
    store.reset();
    expect(store.get()).toEqual([1]);
  });
});
