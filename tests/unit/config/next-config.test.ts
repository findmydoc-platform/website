import { describe, expect, it } from 'vitest'

import nextConfig from '../../../next.config.js'

describe('nextConfig', () => {
  it('includes seed assets in API output tracing', () => {
    expect(nextConfig.outputFileTracingIncludes?.['/api/**/*']).toContain('./src/endpoints/seed/assets/**/*')
  })
})
