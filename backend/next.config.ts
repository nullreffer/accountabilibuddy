import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // API-only backend; no page rendering needed
  output: 'standalone'
};

export default nextConfig;
