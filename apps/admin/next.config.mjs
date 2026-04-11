/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3001',
        'otaxi.fr',
        'www.otaxi.fr',
        'obaid-taxi-admin.vercel.app',
      ],
    },
  },
}

export default nextConfig
