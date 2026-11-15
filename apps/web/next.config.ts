import type { NextConfig } from 'next';

const config: NextConfig = {
  // @clauderon/core ships TypeScript source; Next compiles it with the app.
  transpilePackages: ['@clauderon/core'],
};

export default config;
