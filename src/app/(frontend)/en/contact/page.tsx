import { contactMetadata, renderContactPage, type ContactPageArgs } from '../../contact/ContactPage'

export function generateMetadata() {
  return contactMetadata('en')
}

export default function ContactPage(args: ContactPageArgs) {
  return renderContactPage('en', args)
}
