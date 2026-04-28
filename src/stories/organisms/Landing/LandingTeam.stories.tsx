import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

import { LandingTeam } from '@/components/organisms/Landing'
import { clinicTeamData } from '@/stories/fixtures/listings'
import { withViewportStory } from '../../utils/viewportMatrix'

const getTeamMemberByName = (name: string) => {
  const member = clinicTeamData.find((teamMember) => teamMember.name === name)

  if (!member) {
    throw new Error(`Missing team member fixture for: ${name}`)
  }

  return member
}

const volkanMember = getTeamMemberByName('Volkan Kablan')
const anilMember = getTeamMemberByName('Anil Gökduman')
const youssefMember = getTeamMemberByName('Youssef Adlah')

const meta = {
  title: 'Domain/Landing/Organisms/LandingTeam',
  component: LandingTeam,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-team'],
  args: {
    team: clinicTeamData,
    title: 'Our Team',
    description:
      'We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology.',
  },
} satisfies Meta<typeof LandingTeam>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Our Team')).toBeInTheDocument()
    await expect(canvas.getByText('Volkan Kablan')).toBeInTheDocument()
    await expect(canvas.getByText('Anil Gökduman')).toBeInTheDocument()
  },
}

export const MixedPhotoDisplayModes: Story = {
  args: {
    team: [
      { ...volkanMember, isPhoto: true, photoDisplay: 'original' },
      { ...anilMember, isPhoto: true, photoDisplay: 'grayscale' },
      { ...youssefMember, isPhoto: false },
    ],
    title: 'Photo Display Modes',
    description: 'Shows original and grayscale photo rendering, while placeholder images remain unchanged.',
  },
}

const carouselNavigationBase: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slides = canvas.getAllByRole('group')
    const firstSlide = slides[0]!

    const nextButton = canvas.getByRole('button', { name: 'Next slide' })
    const prevButton = canvas.getByRole('button', { name: 'Previous slide' })
    const initialLeft = firstSlide.getBoundingClientRect().left

    await expect(nextButton).toBeEnabled()
    await expect(prevButton).toBeEnabled()

    await userEvent.click(nextButton)
    await waitFor(() => {
      expect(firstSlide.getBoundingClientRect().left).toBeLessThan(initialLeft)
    })

    const afterNextLeft = firstSlide.getBoundingClientRect().left
    await userEvent.click(prevButton)
    await waitFor(() => {
      expect(firstSlide.getBoundingClientRect().left).toBeGreaterThan(afterNextLeft)
    })
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')

export const MixedPhotoDisplayModes320: Story = withViewportStory(
  MixedPhotoDisplayModes,
  'public320',
  'Photo display modes / 320',
)
export const MixedPhotoDisplayModes375: Story = withViewportStory(
  MixedPhotoDisplayModes,
  'public375',
  'Photo display modes / 375',
)
export const MixedPhotoDisplayModes640: Story = withViewportStory(
  MixedPhotoDisplayModes,
  'public640',
  'Photo display modes / 640',
)
export const MixedPhotoDisplayModes768: Story = withViewportStory(
  MixedPhotoDisplayModes,
  'public768',
  'Photo display modes / 768',
)
export const MixedPhotoDisplayModes1024: Story = withViewportStory(
  MixedPhotoDisplayModes,
  'public1024',
  'Photo display modes / 1024',
)
export const MixedPhotoDisplayModes1280: Story = withViewportStory(
  MixedPhotoDisplayModes,
  'public1280',
  'Photo display modes / 1280',
)

export const CarouselNavigation320: Story = withViewportStory(
  carouselNavigationBase,
  'public320',
  'Carousel navigation / 320',
)
export const CarouselNavigation375: Story = withViewportStory(
  carouselNavigationBase,
  'public375',
  'Carousel navigation / 375',
)
export const CarouselNavigation640: Story = withViewportStory(
  carouselNavigationBase,
  'public640',
  'Carousel navigation / 640',
)
export const CarouselNavigation768: Story = withViewportStory(
  carouselNavigationBase,
  'public768',
  'Carousel navigation / 768',
)
export const CarouselNavigation1024: Story = withViewportStory(
  carouselNavigationBase,
  'public1024',
  'Carousel navigation / 1024',
)
export const CarouselNavigation1280: Story = withViewportStory(
  carouselNavigationBase,
  'public1280',
  'Carousel navigation / 1280',
)
