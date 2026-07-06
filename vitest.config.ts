import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,js}"],
    exclude: ["tests/auth.test.ts", "tests/kb.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
      ],
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },
  },
});
