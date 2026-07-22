import { describe, expect, it } from 'vitest'

import { parsePlaywrightJourneyCaptureArgs } from '../../../scripts/playwright-journey-capture'

describe('parsePlaywrightJourneyCaptureArgs', () => {
  it('uses the canonical desktop viewport by default', () => {
    expect(parsePlaywrightJourneyCaptureArgs(['--journey', 'admin.clinics.approve-pending'])).toMatchObject({
      journeyId: 'admin.clinics.approve-pending',
      viewportHeight: 720,
      viewportWidth: 1280,
    })
  })

  it('accepts explicit viewport dimensions', () => {
    expect(
      parsePlaywrightJourneyCaptureArgs([
        '--journey=admin.clinics.approve-pending',
        '--viewport-width=375',
        '--viewport-height',
        '812',
      ]),
    ).toMatchObject({
      viewportHeight: 812,
      viewportWidth: 375,
    })
  })

  it('rejects invalid viewport dimensions', () => {
    expect(() =>
      parsePlaywrightJourneyCaptureArgs(['--journey=admin.clinics.approve-pending', '--viewport-width=0']),
    ).toThrow('Invalid value for --viewport-width: 0')
  })
})
