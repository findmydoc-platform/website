import { describe, expect, it } from 'vitest'
import {
  getPlaywrightJourneyCaptureHelpText,
  parsePlaywrightJourneyCaptureArgs,
} from '../../../scripts/playwright-journey-capture'

describe('playwright-journey-capture argument parsing', () => {
  it('requires a journey id and keeps the session persona defaults', () => {
    expect(
      parsePlaywrightJourneyCaptureArgs([
        '--persona',
        'clinic',
        '--journey',
        'clinic.doctors.create-and-link-specialty',
      ]),
    ).toEqual({
      baseUrl: 'http://localhost:3000/',
      help: false,
      journeyId: 'clinic.doctors.create-and-link-specialty',
      outputDir: 'output/playwright/journeys',
      persona: 'clinic',
      stateFile: 'output/playwright/sessions/clinic.local.json',
    })
  })

  it('supports explicit output directories', () => {
    expect(
      parsePlaywrightJourneyCaptureArgs(['--journey=admin.clinics.create-draft', '--output-dir', 'tmp/journeys']),
    ).toMatchObject({
      journeyId: 'admin.clinics.create-draft',
      outputDir: 'tmp/journeys',
      persona: 'admin',
    })
  })

  it('mentions journey capture usage in the help text', () => {
    expect(getPlaywrightJourneyCaptureHelpText()).toContain('pnpm playwright:journey:capture')
  })
})
