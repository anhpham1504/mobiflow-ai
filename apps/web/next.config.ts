import type { NextConfig } from 'next';

const config: NextConfig = { output: 'standalone', poweredByHeader: false, agentRules: false, transpilePackages: ['@mobiflow/contracts'] };
export default config;
