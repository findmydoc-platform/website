import type { User } from '@supabase/supabase-js'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { ensurePatientOnAuth } from '@/hooks/ensurePatientOnAuth'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { bindInquiryPreparationPasswordSignIn } from '@/features/inquiryCommunication/service'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'

/** Only the server-observed successful password sign-in may grant this preparation authority. */
export async function continueInquiryPreparationAfterPasswordSignIn(headers: Headers, user: User) {
  const binding = readPreparationBinding(headers)
  if (
    !binding ||
    !user.email ||
    !user.email_confirmed_at ||
    user.app_metadata?.user_type !== 'patient' ||
    (user.banned_until && Date.parse(user.banned_until) > Date.now())
  )
    return
  const payload = await getPayload({ config })
  const req = await createLocalReq({}, payload)
  const patient = await ensurePatientOnAuth({
    payload,
    req,
    authData: {
      supabaseUserId: user.id,
      userEmail: user.email,
      userType: 'patient',
      firstName: typeof user.user_metadata?.first_name === 'string' ? user.user_metadata.first_name : undefined,
      lastName: typeof user.user_metadata?.last_name === 'string' ? user.user_metadata.last_name : undefined,
    },
  })
  if (!patient || patient.supabaseUserId !== user.id) return
  await bindInquiryPreparationPasswordSignIn(req, {
    binding,
    subject: user.id,
    patientId: patient.id,
    email: normalizeEmail(user.email),
  })
}
