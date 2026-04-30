/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output produces a self-contained `.next/standalone` folder
  // with only the deps the runtime actually uses → ~150MB Docker image
  // instead of ~1GB. Required by the production Dockerfile.
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '200mb' } },
}
export default nextConfig
