import { aboutMetadata, renderAboutPage } from './AboutRoute'

export const revalidate = 600

export function generateMetadata() {
  return aboutMetadata('de')
}

export default function AboutRoute() {
  return renderAboutPage('de')
}
