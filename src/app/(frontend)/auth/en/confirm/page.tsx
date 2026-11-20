import { ConfirmAuthLinkPage, confirmMetadata, type ConfirmPageProps } from '../../confirm/ConfirmAuthLinkPage'

export const dynamic = 'force-dynamic'

export function generateMetadata(props: ConfirmPageProps) {
  return confirmMetadata(props, 'en')
}

export default function ConfirmPage(props: ConfirmPageProps) {
  return <ConfirmAuthLinkPage {...props} locale="en" />
}
