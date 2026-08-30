import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const repositoryRoot = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(repositoryRoot, "apps/web/src"),
      // The landing app owns `@` inside its own project below; this list is
      // shared, so its alias is set there rather than here.
      // Tests always exercise the checked-out source, never a stale workspace
      // build left in packages/shared/dist.
      "@thinkclear/shared": resolve(
        repositoryRoot,
        "packages/shared/src/index.ts",
      ),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "shared:spec",
          root: resolve(repositoryRoot, "packages/shared"),
          environment: "node",
          include: ["test/**/*.spec.ts"],
        },
      },
      {
        test: {
          name: "api:spec",
          root: resolve(repositoryRoot, "apps/api"),
          environment: "node",
          include: ["test/**/*.spec.ts"],
        },
      },
      {
        test: {
          name: "api:e2e",
          root: resolve(repositoryRoot, "apps/api"),
          environment: "node",
          include: ["test/**/*.e2e-spec.ts"],
        },
      },
      {
        test: {
          name: "web:spec",
          root: resolve(repositoryRoot, "apps/web"),
          environment: "node",
          include: ["test/**/*.spec.ts"],
        },
      },
      // The landing app has no runtime dependency on anything else here — and
      // still must not drift from it. What it serves to agents now restates
      // facts the API owns (the MCP tool names and their scopes) and facts the
      // platform owns (the `Vary` header in `vercel.json`), so these specs check
      // the copies against the originals. That is the whole reason this project
      // exists: importing `@thinkclear/shared` in a *test* catches the drift
      // without putting it in the bundle.
      {
        resolve: {
          // A project's aliases replace the shared ones rather than adding to
          // them, so `@thinkclear/shared` is restated here — it is the whole
          // point of this project that a spec can reach it.
          alias: {
            "@": resolve(repositoryRoot, "apps/landing/src"),
            "@thinkclear/shared": resolve(
              repositoryRoot,
              "packages/shared/src/index.ts",
            ),
          },
        },
        test: {
          name: "landing:spec",
          root: resolve(repositoryRoot, "apps/landing"),
          environment: "node",
          include: ["test/**/*.spec.ts"],
        },
      },
      resolve(repositoryRoot, "apps/web/vitest.config.ts"),
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: resolve(repositoryRoot, "coverage"),
      include: [
        "packages/shared/src/**/*.ts",
        "apps/api/src/**/*.ts",
        "apps/web/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.d.ts",
        "apps/api/src/generate-openapi.ts",
        "apps/api/src/main.ts",
        "apps/web/src/main.tsx",
      ],
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 80,
        lines: 80,
      },
    },
  },
});
