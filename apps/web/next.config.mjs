/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'otaxi.fr',
        'www.otaxi.fr',
      ],
    },
  },
}

export default nextConfig
