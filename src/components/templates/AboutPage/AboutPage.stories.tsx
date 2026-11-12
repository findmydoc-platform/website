import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { AboutPage, type AboutPageProps } from '@/components/templates/AboutPage/Component'
import { getStoryImageSrc, storyClinicImages, storyPortraits } from '@/stories/fixtures/assets'
import { withMockRouter } from '@/stories/utils/routerDecorator'
import { withViewportStory } from '@/stories/utils/viewportMatrix'

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
      profileLinks: [{ href: '/contact', label: 'Contact' }],
      socials: { github: '#volkan-github', linkedin: '#volkan-linkedin' },
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
      profileLinks: [{ href: '/contact', label: 'Contact' }],
      socials: { github: '#sebastian-github', linkedin: '#sebastian-linkedin' },
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
  play: async ({ canvasElement, name }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'About findmydoc' })).toBeInTheDocument()
    const whyHeading = canvas.getByRole('heading', { name: 'Why findmydoc exists' })
    const trustStory = canvas.getByRole('region', { name: /findmydoc trust system scroll story/i })
    const teamHeading = canvasElement.querySelector<HTMLElement>('#about-accountability-heading')!
    const transparencyHeading = canvas.getByRole('heading', { name: 'What stays transparent' })
    const closingHeading = canvasElement.querySelector<HTMLElement>('#about-closing-actions-heading')!
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
    if (name === 'Default' && win && finalCard && finalLabel && progressBar) {
      const nextFrames = () =>
        new Promise<void>((resolve) => {
          win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()))
        })
      await waitFor(async () => {
        const storyTop = win.scrollY + trustStory.getBoundingClientRect().top
        const maxScroll = Math.max(1, trustStory.getBoundingClientRect().height - win.innerHeight)
        win.scrollTo(0, storyTop + maxScroll * 0.96)
        win.dispatchEvent(new win.Event('scroll'))
        await nextFrames()
        expect(finalCard).toHaveAttribute('data-active', 'true')
      })
      await waitFor(() => expect(finalLabel).toHaveAttribute('data-visible'))
      expect(Number.parseFloat(progressBar.style.width)).toBeGreaterThan(80)
    }
    const teamSpotlight = canvasElement.querySelector<HTMLElement>('[data-about-team-spotlight]')

    expect(teamSpotlight).not.toBeNull()
    await expect(within(teamSpotlight!).getByRole('heading', { name: 'Volkan Kablan' })).toBeInTheDocument()
    await expect(within(teamSpotlight!).getByRole('link', { name: 'Volkan Kablan on LinkedIn' })).toBeInTheDocument()
    await expect(within(teamSpotlight!).getByRole('link', { name: 'Contact' })).toBeInTheDocument()
    const volkanTab = canvas.getByRole('tab', { name: /Volkan Kablan/i })
    const sebastianTab = canvas.getByRole('tab', { name: /Sebastian Schütze/i })

    await expect(canvas.getByRole('tablist', { name: /Team accountability roles/i })).toBeInTheDocument()
    await expect(volkanTab).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(sebastianTab)
    await waitFor(() => {
      const activeSpotlight = canvasElement.querySelector<HTMLElement>('[data-about-team-spotlight]')

      expect(activeSpotlight).not.toBeNull()
      expect(within(activeSpotlight!).getByRole('heading', { name: 'Sebastian Schütze' })).toBeInTheDocument()
      expect(within(activeSpotlight!).getByRole('link', { name: 'Sebastian Schütze on GitHub' })).toBeInTheDocument()
      expect(sebastianTab).toHaveAttribute('aria-selected', 'true')
      expect(volkanTab).toHaveAttribute('aria-selected', 'false')
    })
    await userEvent.keyboard('{Home}')
    await waitFor(() => {
      const activeSpotlight = canvasElement.querySelector<HTMLElement>('[data-about-team-spotlight]')

      expect(activeSpotlight).not.toBeNull()
      expect(within(activeSpotlight!).getByRole('heading', { name: 'Volkan Kablan' })).toBeInTheDocument()
      expect(volkanTab).toHaveAttribute('aria-selected', 'true')
    })
    await expect(canvas.getByText(/Clinics remain accountable/i)).toBeInTheDocument()
    const heroSection = canvas.getByRole('heading', { level: 1 }).closest('section')!
    const closingSection = closingHeading.closest('section')!
    for (const section of [heroSection, closingSection]) {
      const links = within(section).getAllByRole('link')
      expect(links).toHaveLength(2)
      await expect(links[0]).toHaveAttribute('href', '/listing-comparison')
      await expect(links[1]).toHaveAttribute('href', '/partners/clinics')
      for (const link of links) await expect(link).toHaveAccessibleName(/\S/)
    }
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
