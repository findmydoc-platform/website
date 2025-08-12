import type { Payload } from 'payload'
import { seedMedicalSpecialties } from '../medical/medical-specialties-seed'
import { seedCountriesAndCities } from '../locations/countries-cities-seed'
import { seedGlobalsBaseline } from '../globals/globals-seed'

// Types -------------------------------------------------------------------------------------------------

export interface SeedResult {
  created: number
  updated: number
}
export interface NamedSeedResult extends SeedResult { name: string }
export interface SeedUnit { name: string; run: (payload: Payload) => Promise<SeedResult> }

/**
 * Ordered list of baseline seed units. Order ensures downstream references are valid:
 * 1. Globals (navigation)
 * 2. Medical specialties (taxonomy) for later relations
 * 3. Countries & cities (geo) before any clinic/doctor/demo data
 */
export const baselineSeeds: SeedUnit[] = [
  { name: 'globals', run: seedGlobalsBaseline },
  { name: 'medical-specialties', run: seedMedicalSpecialties },
  { name: 'countries-cities', run: seedCountriesAndCities },
]

/** Run all baseline seed units sequentially (fail‑fast handled by caller). */
export async function runBaselineSeeds(payload: Payload): Promise<NamedSeedResult[]> {
  const results: NamedSeedResult[] = []

  for (const unit of baselineSeeds) {
    payload.logger.info(`Running baseline seed: ${unit.name}`)
    const res = await unit.run(payload)
    payload.logger.info(`Finished baseline seed: ${unit.name} (created=${res.created}, updated=${res.updated})`)
    results.push({ name: unit.name, ...res })
  }

  return results
}
