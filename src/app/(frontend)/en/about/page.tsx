import { aboutMetadata, renderAboutPage } from '../../about/AboutRoute'

export const revalidate = 600

export function generateMetadata() {
  return aboutMetadata('en')
}

export default function AboutRoute() {
  return renderAboutPage('en')
}
