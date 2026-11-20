import { recoveryRequestMetadata } from '../../../../auth/password/reset/recoveryRequestMetadata'

export { default } from '../../../../auth/password/reset/page'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  return recoveryRequestMetadata('en')
}
