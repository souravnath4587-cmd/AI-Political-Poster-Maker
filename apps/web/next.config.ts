import type { NextConfig } from 'next';

// The browser only talks to this app's origin; /api/* is proxied to the Express backend.
// This keeps the session cookie first-party (see tech-stack.md §4.5).
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@app/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
