/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3001',
        'localhost:3000',
        'localhost:3002',
        'admin.otaxi.fr',
        'obaid-taxi-admin.vercel.app',
        'otaxi.fr',
        'www.otaxi.fr',
        'drivers.otaxi.fr',
      ],
    },
  },
}

export default nextConfig
