/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@scopeguard/ui', '@scopeguard/db'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost']
    }
  }
};

export default nextConfig;
