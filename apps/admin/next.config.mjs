import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3001'],
    },
  },
  webpack: (config) => {
    // Force single React instance in monorepo to avoid styled-jsx conflicts
    config.resolve.alias['react'] = path.resolve(__dirname, 'node_modules/react')
    config.resolve.alias['react-dom'] = path.resolve(__dirname, 'node_modules/react-dom')
    return config
  },
}

export default nextConfig
