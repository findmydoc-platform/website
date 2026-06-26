import type { SocialPlatform } from '@/components/molecules/SocialLink'

export type AboutImage = {
  src: string
  alt: string
  width?: number
  height?: number
  sizes?: string
  quality?: number
  objectPosition?: string
}

export type AboutTextItem = {
  text: string
}

export type AboutTextSection = {
  title: string
  items: AboutTextItem[]
}

export type AboutTeamMember = {
  name: string
  role: string
  whatWeDo: string
  image: AboutImage
  profileLinks?: Array<{
    href: string
    label: string
    newTab?: boolean
  }>
  socials?: Partial<Record<SocialPlatform, string>>
}

export type AboutPageProps = {
  hero: {
    title: string
    description: string
    image: AboutImage
  }
  why: AboutTextSection
  team: AboutTeamMember[]
  transparency: AboutTextSection
}
