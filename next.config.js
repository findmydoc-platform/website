import { networkInterfaces } from 'node:os'
import { withPayload } from '@payloadcms/next/withPayload'

import { IMAGE_LOCAL_PATTERNS, IMAGE_QUALITIES } from './src/imageConfig.js'
import { getAllowedDevOrigins } from './src/utilities/nextDevOrigins.js'
import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

const SEED_ASSET_TRACING_INCLUDE = './src/endpoints/seed/assets/**/*'
const SEARCH_ROBOTS_HEADER_VALUE = 'noindex, nofollow, noarchive'

const normalizeEnvValue = (value) => {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

const isPreviewRuntime =
  (normalizeEnvValue(process.env.VERCEL_ENV) ?? normalizeEnvValue(process.env.DEPLOYMENT_ENV)) === 'preview'
const blockSearchIndexing = isPreviewRuntime
const isDevelopmentRuntime = process.env.NODE_ENV === 'development'

const allowedDevOrigins = getAllowedDevOrigins({
  configuredOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS,
  isDevelopmentRuntime,
  networkInterfacesByName: networkInterfaces(),
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async headers() {
    return blockSearchIndexing
      ? [
          {
            headers: [
              {
                key: 'X-Robots-Tag',
                value: SEARCH_ROBOTS_HEADER_VALUE,
              },
            ],
            source: '/:path*',
          },
        ]
      : []
  },
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
  outputFileTracingIncludes: {
    '/api/**/*': [SEED_ASSET_TRACING_INCLUDE],
  },
  reactStrictMode: true,
  redirects,
  turbopack: {
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
}

export default withPayload(nextConfig)
