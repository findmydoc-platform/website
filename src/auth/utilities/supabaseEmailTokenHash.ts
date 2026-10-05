import { z } from 'zod'

// Supabase Auth GenerateTokenHash returns a lowercase hexadecimal SHA-224 digest.
export const supabaseEmailTokenHashSchema = z.string().regex(/^[a-f0-9]{56}$/)
