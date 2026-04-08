/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3001',
        'obaid-taxi-admin.vercel.app',
        'obaid-taxi-admin-h452p7r3b-zebreyn-9679s-projects.vercel.app',
      ],
    },
  },
}

export default nextConfig
