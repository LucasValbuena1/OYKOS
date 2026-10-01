import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" genera .next/standalone con un server.js mínimo y solo las
  // dependencias necesarias: la imagen de Docker queda liviana (~150 MB).
  output: "standalone",
  poweredByHeader: false,
  // Playwright es opcional (scraping de páginas armadas con JavaScript): no se empaqueta.
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
