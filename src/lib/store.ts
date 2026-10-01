// Store persistente mínimo sobre localStorage, pensado para usarse con
// useSyncExternalStore (hook oficial de React para fuentes externas).
//
// ¿Por qué no useState + useEffect? Porque varios componentes/páginas leen
// las mismas colecciones: con un store externo todos se enteran del cambio,
// incluso entre pestañas (evento "storage"), y el SSR no se rompe porque el
// servidor usa el snapshot inicial (getServerSnapshot).
export type Updater<T> = T | ((prev: T) => T);

export interface Store<T> {
  key: string;
  get: () => T;
  getServerSnapshot: () => T;
  set: (value: Updater<T>) => void;
  subscribe: (listener: () => void) => () => void;
  reset: () => void;
}

const registry: Store<unknown>[] = [];
export const STORAGE_PREFIX = "oykos:";

export function createPersistentStore<T>(key: string, initial: () => T): Store<T> {
  const storageKey = STORAGE_PREFIX + key;
  let serverSnapshot: T | undefined;
  let value: T | undefined;
  let loaded = false;
  const listeners = new Set<() => void>();

  const getInitial = () => {
    if (serverSnapshot === undefined) serverSnapshot = initial();
    return serverSnapshot;
  };

  const load = (): T => {
    if (typeof window === "undefined") return getInitial();
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* JSON inválido o storage bloqueado: se usa el valor inicial */
    }
    return getInitial();
  };

  const persist = (v: T) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(v));
    } catch {
      /* cuota llena: se mantiene en memoria */
    }
  };

  const emit = () => listeners.forEach((l) => l());

  const store: Store<T> = {
    key,
    get: () => {
      if (!loaded) {
        value = load();
        loaded = true;
      }
      return value as T;
    },
    getServerSnapshot: getInitial,
    set: (next) => {
      const prev = store.get();
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (Object.is(resolved, prev)) return;
      value = resolved;
      persist(resolved);
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === storageKey) {
          loaded = false;
          listener();
        }
      };
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
    reset: () => {
      serverSnapshot = undefined;
      value = getInitial();
      loaded = true;
      if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
      emit();
    },
  };

  registry.push(store as Store<unknown>);
  return store;
}

/** Restaura todos los stores al valor inicial (se usa en las pruebas). */
export function resetAllStores() {
  registry.forEach((s) => s.reset());
}
