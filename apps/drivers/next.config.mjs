/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3002',
        'drivers.otaxi.fr',
      ],
    },
  },
}

export default nextConfig
