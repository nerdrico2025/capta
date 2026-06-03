/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@capta/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
