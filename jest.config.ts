import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest configura SWC, CSS y variables de entorno igual que Next.js.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testMatch: ["<rootDir>/src/__tests__/**/*.test.{ts,tsx}"],
  collectCoverageFrom: ["src/lib/**/*.ts", "src/hooks/**/*.ts", "src/components/**/*.tsx", "!src/**/*.d.ts"],
};

// @formatjs/intl-localematcher (usado por el proxy de idioma) se publica como ESM:
// se permite que SWC lo transforme.
const jestConfig = createJestConfig(config);
const loadConfig = async () => {
  const resolved = await jestConfig();
  resolved.transformIgnorePatterns = ["/node_modules/(?!(@formatjs)/)", "^.+\\.module\\.(css|sass|scss)$"];
  return resolved;
};
export default loadConfig;
