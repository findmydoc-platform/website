import type { Payload } from 'payload'
import { seedMedicalSpecialties } from '../medical/medical-specialties-seed'
import { seedCountriesAndCities } from '../locations/countries-cities-seed'
import { seedGlobalsBaseline } from '../globals/globals-seed'

export interface SeedResult {
  created: number
  updated: number
}
export interface SeedUnit {
  name: string
  run: (payload: Payload) => Promise<SeedResult>
}

// Ordering rationale:
// 1. Globals (navigation etc.)
// 2. Medical Specialties (taxonomy) so doctors can reference them later
// 3. Countries & Cities (geo hierarchy) before clinics/doctors
export const baselineSeeds: SeedUnit[] = [
  { name: 'globals', run: seedGlobalsBaseline },
  { name: 'medical-specialties', run: seedMedicalSpecialties },
  { name: 'countries-cities', run: seedCountriesAndCities },
]

export async function runBaselineSeeds(payload: Payload): Promise<SeedResult[]> {
  const results: SeedResult[] = []
  for (const unit of baselineSeeds) {
    payload.logger.info(`Running baseline seed: ${unit.name}`)
    const res = await unit.run(payload)
    payload.logger.info(`Finished baseline seed: ${unit.name} (created=${res.created}, updated=${res.updated})`)
    results.push(res)
  }
  return results
}
