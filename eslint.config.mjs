// One flat config covers the monorepo. Plugins stay at the root so individual
// workspaces do not each grow their own lint toolchain.
//
// Formatting is deliberately not ESLint's job: eslint-config-prettier is last
// and disables conflicting stylistic rules. Run both `pnpm lint` and
// `pnpm format:check` when verifying a change.
import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import turbo from "eslint-plugin-turbo";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/",
      "**/.next/",
      "**/.turbo/",
      "coverage/",
      // Written by `next build`; its contents are three reference directives.
      "apps/landing/next-env.d.ts",
      "apps/web/.vitest-attachments/",
      "**/__screenshots__/",
      // Generated contracts have their own generators and must not be edited.
      "apps/api/openapi.json",
      "apps/web/src/lib/api-types.d.ts",
      // Vendored skills and local agent state are outside the app's toolchain.
      ".agents/",
      ".context/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  // These rules need TypeScript's program. Keep them on source directories
  // claimed by the workspace tsconfigs rather than forcing configs or fixtures
  // into an unrelated project.
  {
    files: ["{apps,packages}/*/src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          // Async React callbacks and mutation handlers are intentionally
          // passed through void-returning framework APIs.
          checksVoidReturn: {
            attributes: false,
            properties: false,
            variables: false,
          },
        },
      ],
    },
  },
  // An underscore is the explicit escape hatch for a required-but-unused
  // positional parameter or destructured binding.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  { languageOptions: { globals: globals.node } },
  {
    files: ["apps/{web,landing}/{src,test}/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  {
    ...turbo.configs["flat/recommended"],
    files: ["apps/{web,landing}/src/**/*.{ts,tsx}"],
  },
  {
    ...reactHooks.configs.flat.recommended,
    files: ["apps/{web,landing}/{src,test}/**/*.{ts,tsx}"],
  },
  {
    // These effects intentionally reset local editor state in response to
    // controlled open/selection props. They are synchronization, not derived
    // render state; the core hooks and dependency rules remain enabled. The
    // exception is the web app's — apps/landing has no editors and keeps it.
    files: ["apps/web/{src,test}/**/*.{ts,tsx}"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  prettier,
);
