"use client";
// Hooks base de datos: conectan los stores persistentes con React.
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Store, Updater } from "@/lib/store";
import { uid } from "@/lib/utils";

/** Lee un store y se re-renderiza cuando cambia. */
export function useStore<T>(store: Store<T>): [T, (v: Updater<T>) => void] {
  const value = useSyncExternalStore(store.subscribe, store.get, store.getServerSnapshot);
  return [value, store.set];
}

const noopSubscribe = () => () => {};

/** false durante el SSR / hidratación, true ya en el navegador. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export interface Collection<T extends { id: string }> {
  items: T[];
  getById: (id: string | undefined | null) => T | undefined;
  add: (item: Omit<T, "id"> & { id?: string }) => T;
  update: (id: string, changes: Partial<T>) => void;
  remove: (id: string) => void;
  removeWhere: (predicate: (item: T) => boolean) => void;
}

/** CRUD genérico sobre una colección persistente. */
export function useCollection<T extends { id: string }>(store: Store<T[]>, idPrefix = "id"): Collection<T> {
  const [items, setItems] = useStore(store);

  const getById = useCallback((id: string | undefined | null) => items.find((i) => i.id === id), [items]);

  const add = useCallback(
    (item: Omit<T, "id"> & { id?: string }) => {
      const created = { ...item, id: item.id ?? uid(idPrefix) } as T;
      setItems((prev) => [...prev, created]);
      return created;
    },
    [setItems, idPrefix],
  );

  const update = useCallback(
    (id: string, changes: Partial<T>) =>
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes, id } : i))),
    [setItems],
  );

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), [setItems]);

  const removeWhere = useCallback(
    (predicate: (item: T) => boolean) => setItems((prev) => prev.filter((i) => !predicate(i))),
    [setItems],
  );

  return useMemo(() => ({ items, getById, add, update, remove, removeWhere }), [items, getById, add, update, remove, removeWhere]);
}
