import "@testing-library/jest-dom";
import { resetAllStores } from "@/lib/store";

// Router de Next simulado: cada prueba puede revisar a dónde se navegó.
export const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn(), refresh: jest.fn() };
let mockPathname = "/es/dashboard";
let mockSearch = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearch,
  notFound: jest.fn(),
  redirect: jest.fn(),
}));

(globalThis as Record<string, unknown>).__setPathname = (p: string) => (mockPathname = p);
(globalThis as Record<string, unknown>).__setSearch = (q: string) => (mockSearch = new URLSearchParams(q));

beforeEach(() => {
  if (typeof window !== "undefined") window.localStorage.clear();
  resetAllStores();
  jest.clearAllMocks();
  mockPathname = "/es/dashboard";
  mockSearch = new URLSearchParams();
});
