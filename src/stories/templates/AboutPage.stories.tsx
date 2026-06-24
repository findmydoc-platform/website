import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'

import { AboutPage, type AboutPageProps } from '@/components/templates/AboutPage/Component'
import { getStoryImageSrc, storyClinicImages, storyPortraits } from '@/stories/fixtures/assets'
import { withMockRouter } from '../utils/routerDecorator'
import { withViewportStory } from '../utils/viewportMatrix'

const aboutPageArgs: AboutPageProps = {
  hero: {
    title: 'About findmydoc',
    description:
      'We build findmydoc so patients can compare clinic information with more context, and clinics can present their services responsibly.',
    image: {
      src: getStoryImageSrc(storyClinicImages.landing.aboutHero),
      alt: 'findmydoc startup team in a calm office',
    },
  },
  why: {
    title: 'Why findmydoc exists',
    items: [
      {
        text: 'Profile claims, qualifications, reviews, prices, and contact options often arrive as separate signals.',
      },
      {
        text: 'findmydoc gives those signals a shared comparison surface before a patient starts a clinic conversation.',
      },
      {
        text: 'The comparison stays outside medical advice and keeps the decision boundary visible.',
      },
    ],
  },
  team: [
    {
      name: 'Volkan Kablan',
      role: 'CEO',
      whatWeDo:
        'Sets partner standards so commercial decisions stay transparent and aligned with responsible clinic relationships.',
      image: { src: getStoryImageSrc(storyPortraits.team.volkan), alt: 'Volkan Kablan portrait' },
    },
    {
      name: 'Youssef Adlah',
      role: 'CMO',
      whatWeDo: 'Keeps clinic communication grounded in clear service claims instead of overstated promises.',
      image: { src: getStoryImageSrc(storyPortraits.team.youssef), alt: 'Youssef Adlah portrait' },
    },
    {
      name: 'Anil Gökduman',
      role: 'CPO',
      whatWeDo: 'Shapes comparison flows around patient questions, so profile signals become easier to evaluate.',
      image: { src: getStoryImageSrc(storyPortraits.team.anil), alt: 'Anil Gökduman portrait' },
    },
    {
      name: 'Özen Günes',
      role: 'CLO',
      whatWeDo: 'Keeps privacy, legal, and consent expectations visible in patient and clinic interactions.',
      image: { src: getStoryImageSrc(storyPortraits.team.oezen), alt: 'Özen Günes portrait' },
    },
    {
      name: 'Sebastian Schütze',
      role: 'CTO',
      whatWeDo: 'Maintains the platform architecture that keeps profile signals structured, reliable, and accessible.',
      image: { src: getStoryImageSrc(storyPortraits.team.sebastian), alt: 'Sebastian Schütze portrait' },
    },
  ],
  transparency: {
    title: 'What stays transparent',
    items: [
      { text: 'Clinics remain accountable for the information shown on their profiles.' },
      { text: 'Qualification and evidence signals are reviewed before they are presented as trust context.' },
      { text: 'Comparison context stays separate from medical advice, and patients contact clinics directly.' },
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

    await expect(canvas.getByRole('heading', { name: 'About findmydoc' })).toBeInTheDocument()
    const whyHeading = canvas.getByRole('heading', { name: 'Why findmydoc exists' })
    const trustStory = canvas.getByRole('region', { name: /findmydoc trust system scroll story/i })
    const teamHeading = canvas.getByRole('heading', { name: 'The people accountable for the system' })
    const transparencyHeading = canvas.getByRole('heading', { name: 'What stays transparent' })
    const closingHeading = canvas.getByRole('heading', { name: 'Continue with clearer clinic context.' })
    const finalCard = trustStory.querySelector<HTMLElement>('[data-card="2"]')
    const finalLabel = trustStory.querySelector<HTMLElement>('[data-ring-label="2"]')
    const progressBar = trustStory.querySelector<HTMLElement>('[data-progress-bar]')
    const win = canvasElement.ownerDocument.defaultView

    await expect(teamHeading).toBeInTheDocument()
    await expect(transparencyHeading).toBeInTheDocument()
    await expect(closingHeading).toBeInTheDocument()
    await expect(trustStory).toBeInTheDocument()
    expect(finalCard).not.toBeNull()
    expect(finalLabel).not.toBeNull()
    expect(progressBar).not.toBeNull()
    expect(whyHeading.compareDocumentPosition(trustStory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(trustStory.compareDocumentPosition(teamHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(teamHeading.compareDocumentPosition(transparencyHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(transparencyHeading.compareDocumentPosition(closingHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(canvas.getByText(/Profile claims, qualifications, reviews, prices/i)).toBeInTheDocument()
    await expect(canvas.getByText('Scattered information')).toBeInTheDocument()
    await expect(canvas.getByText('Comparison context')).toBeInTheDocument()
    await expect(canvas.getByText('Decision boundary')).toBeInTheDocument()
    expect(canvas.getAllByText(/Patients start with uncertainty\./).length).toBeGreaterThan(0)
    expect(canvas.getAllByText(/We turn trust signals into clearer decisions\./).length).toBeGreaterThan(0)
    expect(canvas.getAllByText(/A clearer path forward for patients and clinics\./).length).toBeGreaterThan(0)
    expect(canvas.getAllByText(/Patient\s*Confidence/).length).toBeGreaterThan(0)
    if (win && finalCard && finalLabel && progressBar) {
      const storyTop = win.scrollY + trustStory.getBoundingClientRect().top
      const maxScroll = Math.max(1, trustStory.scrollHeight - win.innerHeight)

      win.scrollTo(0, storyTop + maxScroll * 0.96)
      win.dispatchEvent(new win.Event('scroll'))

      await waitFor(() => expect(finalCard).toHaveAttribute('data-active', 'true'))
      await waitFor(() => expect(finalLabel).toHaveAttribute('data-visible'))
      expect(Number.parseFloat(progressBar.style.width)).toBeGreaterThan(90)
    }
    await expect(canvas.getByText(/Sets partner standards/i)).toBeInTheDocument()
    await expect(canvas.getByText('Partner standards')).toBeInTheDocument()
    await expect(canvas.getByText('Platform reliability')).toBeInTheDocument()
    await expect(canvas.getByText(/Clinics remain accountable/i)).toBeInTheDocument()
    await expect(canvas.getByText('Medical-advice separation')).toBeInTheDocument()
    expect(canvas.getAllByRole('link', { name: /compare clinics/i })).toHaveLength(2)
    await expect(canvas.getByRole('link', { name: /for clinics/i })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: /register your clinic/i })).toBeInTheDocument()
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
export const Default320Short: Story = withViewportStory(Default, 'public320Short', 'Default / 320 short')
export const Default375Short: Story = withViewportStory(Default, 'public375Short', 'Default / 375 short')

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
