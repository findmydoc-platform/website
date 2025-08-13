import type { Payload } from 'payload'
import { seedMedicalSpecialties } from '../medical/medical-specialties-seed'
import { seedAccreditations } from '../medical/accreditations-seed'
import { seedTreatments } from '../medical/treatments-seed'
import { seedCountriesAndCities } from '../locations/countries-cities-seed'
import { seedGlobalsBaseline } from '../globals/globals-seed'
import { seedTags } from '../content/tags-seed'
import { seedCategories } from '../content/categories-seed'

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
 * 3. Accreditations (independent reference data)
 * 4. Countries & cities (geo) before any clinic/doctor/demo data
 * 5. Treatments (depends on medical specialties)
 * 6. Tags (independent content taxonomy)
 * 7. Categories (independent content taxonomy)
 */
export const baselineSeeds: SeedUnit[] = [
  { name: 'globals', run: seedGlobalsBaseline },
  { name: 'medical-specialties', run: seedMedicalSpecialties },
  { name: 'accreditations', run: seedAccreditations },
  { name: 'countries-cities', run: seedCountriesAndCities },
  { name: 'treatments', run: seedTreatments },
  { name: 'tags', run: seedTags },
  { name: 'categories', run: seedCategories },
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
