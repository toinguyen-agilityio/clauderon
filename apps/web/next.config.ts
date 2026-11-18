import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Local dev keeps one .env at the repo root; Next only reads .env files in apps/web.
// Variables already set in the environment win, and deployments have no such file.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  transpilePackages: ["@clauderon/core", "@clauderon/db", "@clauderon/protocol"],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
};

export default config;
