import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // In a pnpm workspace there is more than one plausible project root, and Next
  // guesses when nobody names one. Both of these have to be the workspace root
  // and they have to agree: dependencies are hoisted to the root's
  // node_modules, so a build rooted at apps/landing traces a subset of what it
  // compiled against.
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  // `next dev` otherwise writes its own AGENTS.md and CLAUDE.md into this
  // directory on every start. The repository already has one CLAUDE.md and it
  // is deliberate; a second one that regenerates itself would both dirty the
  // tree and answer questions the root file answers.
  agentRules: false,
  // There is deliberately no `headers()` adding `Vary: Accept` here. It does
  // not work: Next owns `Vary` on an App Router response and overwrites
  // whatever this config puts there with its own `rsc, next-router-*` list,
  // silently — every other custom header lands, so it looks like it worked.
  // `src/proxy.ts` sets it on the responses it builds, and `vercel.json` sets
  // it on the statically served ones, which is where the CDN is anyway.
};

export default nextConfig;
