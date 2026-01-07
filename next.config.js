import { withPayload } from '@payloadcms/next/withPayload'

import {
  DEFAULT_IMAGE_QUALITY,
  IMAGE_LOCAL_PATTERNS,
  IMAGE_QUALITIES,
} from './src/imageConfig.js'
import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    localPatterns: IMAGE_LOCAL_PATTERNS,
    qualities: IMAGE_QUALITIES,
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
      // Allow placeholder images used in stories/fixtures
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
  reactStrictMode: true,
  redirects,
  turbopack: {
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
}

export default withPayload(nextConfig)
