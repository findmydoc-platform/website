import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { AboutPage, type AboutPageProps } from '@/components/templates/AboutPage/Component'
import { getStoryImageSrc, storyClinicImages, storyPortraits } from '@/stories/fixtures/assets'
import { withMockRouter } from '../utils/routerDecorator'
import { withViewportStory } from '../utils/viewportMatrix'

const aboutPageArgs: AboutPageProps = {
  hero: {
    title: 'Clearer clinic decisions start with better information.',
    description:
      'findmydoc helps patients compare clinic information with confidence and helps clinics present their services responsibly.',
    image: {
      src: getStoryImageSrc(storyClinicImages.listing.consultation),
      alt: 'Doctor and patient discussing clinic information',
    },
  },
  why: {
    title: 'Why we exist',
    items: [
      { text: 'We bring clarity to clinic information so comparisons are fair and decisions are easier.' },
      { text: 'We hold clinic information accountable through verification and responsible presentation.' },
      { text: 'We keep the next step simple by connecting patients and clinics directly.' },
    ],
  },
  team: [
    {
      name: 'Volkan Kablan',
      role: 'CEO',
      whatWeDo: 'Shape finance and partner operations so clinic growth stays sustainable, measurable, and transparent.',
      image: { src: getStoryImageSrc(storyPortraits.team.volkan), alt: 'Volkan Kablan portrait' },
    },
    {
      name: 'Youssef Adlah',
      role: 'CMO',
      whatWeDo:
        'Lead growth and partnerships to connect the right patients with the right clinics through clear communication and strong relationships.',
      image: { src: getStoryImageSrc(storyPortraits.team.youssef), alt: 'Youssef Adlah portrait' },
    },
    {
      name: 'Anil Gökduman',
      role: 'CPO',
      whatWeDo:
        'Own product strategy and user experience to make clinic comparisons simple, relevant, and trustworthy for patients.',
      image: { src: getStoryImageSrc(storyPortraits.team.anil), alt: 'Anil Gökduman portrait' },
    },
    {
      name: 'Özen Günes',
      role: 'CLO',
      whatWeDo:
        'Ensure legal integrity, data protection, and responsible engagement across all our relationships with patients and clinics.',
      image: { src: getStoryImageSrc(storyPortraits.team.oezen), alt: 'Özen Günes portrait' },
    },
    {
      name: 'Sebastian Schütze',
      role: 'CTO',
      whatWeDo:
        'Build and maintain a secure, reliable platform so clinic information is structured, up to date, and easy to access.',
      image: { src: getStoryImageSrc(storyPortraits.team.sebastian), alt: 'Sebastian Schütze portrait' },
    },
  ],
  transparency: {
    title: 'What we keep transparent',
    items: [
      { text: 'Clinics own their profile information.' },
      { text: 'Qualification signals are reviewed before visibility.' },
      { text: 'Patients contact clinics directly.' },
    ],
  },
}

const meta = {
  title: 'Domain/Landing/Templates/AboutPage',
  component: AboutPage,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:template', 'status:stable', 'used-in:route:/about'],
  args: aboutPageArgs,
} satisfies Meta<typeof AboutPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: /clearer clinic decisions/i })).toBeInTheDocument()
    await expect(canvas.getByText('People behind the platform')).toBeInTheDocument()
    await expect(canvas.getByText(/We bring clarity to clinic information/i)).toBeInTheDocument()
    await expect(canvas.getByText(/Shape finance and partner operations/i)).toBeInTheDocument()
    await expect(canvas.getByText(/Clinics own their profile information/i)).toBeInTheDocument()
    expect(canvas.getAllByRole('link', { name: /compare clinics/i })).toHaveLength(1)
    await expect(canvas.getByRole('link', { name: /for clinics/i })).toBeInTheDocument()
    await expect(canvas.queryByRole('heading', { name: /ready to continue/i })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('link', { name: /meet the team/i })).not.toBeInTheDocument()
  },
}

export const LongerTeamResponsibilities: Story = {
  args: {
    team: aboutPageArgs.team.map((member) => ({
      ...member,
      whatWeDo: `${member.whatWeDo} This line intentionally runs longer to verify that the editorial team layout keeps spacing calm and readable across viewport widths.`,
    })),
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')

export const LongerTeamResponsibilities320: Story = withViewportStory(
  LongerTeamResponsibilities,
  'public320',
  'Longer team responsibilities / 320',
)
export const LongerTeamResponsibilities375: Story = withViewportStory(
  LongerTeamResponsibilities,
  'public375',
  'Longer team responsibilities / 375',
)
export const LongerTeamResponsibilities640: Story = withViewportStory(
  LongerTeamResponsibilities,
  'public640',
  'Longer team responsibilities / 640',
)
export const LongerTeamResponsibilities768: Story = withViewportStory(
  LongerTeamResponsibilities,
  'public768',
  'Longer team responsibilities / 768',
)
export const LongerTeamResponsibilities1024: Story = withViewportStory(
  LongerTeamResponsibilities,
  'public1024',
  'Longer team responsibilities / 1024',
)
export const LongerTeamResponsibilities1280: Story = withViewportStory(
  LongerTeamResponsibilities,
  'public1280',
  'Longer team responsibilities / 1280',
)
