export type PatientInquiryCreationContext =
  | { kind: 'guest' }
  | {
      account: {
        email: string
        firstName: string
        lastName: string
        phoneNumber: string
      }
      kind: 'authenticated'
      loginHref: string
    }
  | { kind: 'reauthentication-required'; loginHref: string }

export const hasSupabaseAuthenticationAttempt = ({
  cookieNames,
  headers,
}: {
  cookieNames: readonly string[]
  headers: Headers
}): boolean =>
  headers.has('authorization') || cookieNames.some((name) => name.startsWith('sb-') && name.includes('-auth-token'))
