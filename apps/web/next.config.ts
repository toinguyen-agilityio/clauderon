import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@clauderon/core", "@clauderon/db", "@clauderon/protocol"],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
};

export default config;
