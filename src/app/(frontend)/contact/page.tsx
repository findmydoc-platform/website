import { contactMetadata, renderContactPage, type ContactPageArgs } from './ContactPage'

export function generateMetadata() {
  return contactMetadata('de')
}

export default function ContactPage(args: ContactPageArgs) {
  return renderContactPage('de', args)
}
