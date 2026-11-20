import { ConfirmAuthLinkPage, confirmMetadata, type ConfirmPageProps } from './ConfirmAuthLinkPage'

export const dynamic = 'force-dynamic'

export function generateMetadata(props: ConfirmPageProps) {
  return confirmMetadata(props, 'de')
}

export default function ConfirmPage(props: ConfirmPageProps) {
  return <ConfirmAuthLinkPage {...props} locale="de" />
}
