import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  // @react-pdf/renderer uses canvas + Node.js internals — must run as external module
  serverExternalPackages: ['@react-pdf/renderer', 'canvas'],
  transpilePackages: ['react-markdown', 'remark-gfm'],
  // Skip ESLint and type errors during builds — run separately
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.pinimg.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },         // YouTube thumbnails
      { protocol: 'https', hostname: 'img.youtube.com' },     // YouTube alt thumbnails
    ],
  },
}

export default nextConfig
