import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // Chat/UI tests need DOM + Storage. Docblock `@vitest-environment jsdom`
    // is unreliable under Node 26 in CI; match by path so localStorage works.
    environmentMatchGlobs: [
      ["src/chat/**", "jsdom"],
      ["src/components/**", "jsdom"],
      ["src/hooks/**", "jsdom"],
      ["src/pages/**", "jsdom"],
      ["src/lib/**", "jsdom"],
      ["src/app/**", "jsdom"],
    ],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
