import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { HeroOverviewSection } from '@/components/organisms/ClinicDetail'
import { Container } from '@/components/molecules/Container'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
import { withViewportStory } from '../../utils/viewportMatrix'

const heroDoctors = clinicDetailFixture.doctors.slice(0, 6)
const singleDoctor = clinicDetailFixture.doctors.slice(0, 1)
const longGalleryCaption = Array.from(
  { length: 18 },
  (_, index) =>
    `Section ${index + 1}: The clinic team explains the reception, accessibility, arrival process, and patient support available before an appointment.`,
).join(' ')
const longCaptionGalleryImages = clinicDetailFixture.galleryImages
  .slice(0, 1)
  .map((image) => ({ ...image, caption: longGalleryCaption }))

const meta = {
  title: 'Domain/Clinic/Organisms/ClinicDetail/HeroOverviewSection',
  component: HeroOverviewSection,
  args: {
    clinicName: clinicDetailFixture.clinicName,
    breadcrumbs: clinicDetailFixture.breadcrumbs,
    description: clinicDetailFixture.description,
    galleryImages: clinicDetailFixture.galleryImages,
    heroImage: clinicDetailFixture.heroImage,
    trust: clinicDetailFixture.trust,
    doctors: heroDoctors,
    activeDoctorId: '',
    onDoctorSelect: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Hero section with clinic overview, trust snapshot, and interactive available doctors list used on the clinic detail page.',
      },
    },
  },
  tags: ['autodocs', 'domain:clinic', 'layer:organism', 'status:stable', 'used-in:block:hero-overview-section'],
} satisfies Meta<typeof HeroOverviewSection>

export default meta

type Story = StoryObj<typeof meta>

function HeroOverviewSectionStoryHarness() {
  const [activeDoctorId, setActiveDoctorId] = React.useState('')

  return (
    <div className="bg-muted py-8">
      <Container className="space-y-4">
        <p className="text-sm text-secondary/70" data-testid="active-doctor-output">
          Active doctor: {activeDoctorId || 'none'}
        </p>
        <HeroOverviewSection
          clinicName={clinicDetailFixture.clinicName}
          breadcrumbs={clinicDetailFixture.breadcrumbs}
          description={clinicDetailFixture.description}
          galleryImages={clinicDetailFixture.galleryImages}
          heroImage={clinicDetailFixture.heroImage}
          trust={clinicDetailFixture.trust}
          doctors={heroDoctors}
          activeDoctorId={activeDoctorId}
          onDoctorSelect={setActiveDoctorId}
        />
      </Container>
    </div>
  )
}

export const InteractiveDoctorSelection: Story = {
  render: () => <HeroOverviewSectionStoryHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Berlin Health Clinic' })).toBeInTheDocument()
    await expect(canvas.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    const doctorButton = canvas.getByRole('button', { name: `Select ${heroDoctors[1]?.name}` })

    await userEvent.click(doctorButton)
    await expect(canvas.getByTestId('active-doctor-output')).toHaveTextContent(`Active doctor: ${heroDoctors[1]?.id}`)
  },
}

export const VisualReference: Story = {
  render: (args) => (
    <div className="bg-muted py-8">
      <Container>
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </Container>
    </div>
  ),
}

export const SingleDoctorCompactState: Story = {
  args: {
    doctors: singleDoctor,
    activeDoctorId: singleDoctor[0]?.id ?? '',
  },
  render: (args) => (
    <div className="bg-muted py-8">
      <Container>
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </Container>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('1 listed specialist')).toBeInTheDocument()
    await expect(canvas.getAllByRole('button').length).toBeGreaterThanOrEqual(1)
  },
}

export const EmptyDoctorsState: Story = {
  args: {
    doctors: [],
    activeDoctorId: '',
  },
  render: (args) => (
    <div className="bg-muted py-8">
      <Container>
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </Container>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('0 listed specialists')).toBeInTheDocument()
    await expect(canvas.getByText(/No doctors are currently listed for this clinic/i)).toBeInTheDocument()
  },
}

export const GalleryInteraction: Story = {
  render: (args) => (
    <div className="bg-muted py-8">
      <Container>
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </Container>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const openButton = canvas.getByRole('button', { name: 'View all 12 photos for Berlin Health Clinic' })

    await userEvent.click(openButton)

    const body = within(document.body)
    await expect(await body.findByRole('dialog')).toBeInTheDocument()
    await expect(body.getByText('Photo 1 of 12')).toBeInTheDocument()
    const carousel = body.getByRole('region', { name: 'Berlin Health Clinic photos' })
    carousel.focus()
    await expect(carousel).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(body.getByText('Photo 2 of 12')).toBeInTheDocument())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(openButton).toHaveFocus())
  },
}

export const SingleGalleryImage: Story = {
  args: {
    galleryImages: clinicDetailFixture.galleryImages.slice(0, 1),
  },
  render: (args) => (
    <div className="bg-muted py-8">
      <Container>
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </Container>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const openButton = canvas.getByRole('button', { name: 'View photo for Berlin Health Clinic' })
    await expect(canvas.getByRole('img', { name: 'Bright clinic reception and patient welcome area' })).toBeVisible()

    await userEvent.click(openButton)

    const body = within(document.body)
    await expect(await body.findByRole('dialog')).toBeInTheDocument()
    await expect(body.getByText('Photo 1 of 1')).toBeInTheDocument()
    await expect(body.queryByRole('button', { name: 'Previous slide' })).toBeNull()
    await expect(body.queryByRole('button', { name: 'Next slide' })).toBeNull()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(openButton).toHaveFocus())
  },
}

export const EmptyGalleryFallback: Story = {
  args: {
    galleryImages: [],
  },
  render: (args) => (
    <div className="bg-muted py-8">
      <Container>
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </Container>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: /photos? for Berlin Health Clinic/i })).toBeNull()
    await expect(canvas.getByRole('img', { name: 'Modern clinic exterior' })).toBeVisible()
  },
}

const longGalleryCaptionBase: Story = {
  args: {
    galleryImages: longCaptionGalleryImages,
  },
  render: (args) => (
    <div className="bg-muted py-8">
      <Container>
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </Container>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const openButton = canvas.getByRole('button', { name: 'View photo for Berlin Health Clinic' })

    await userEvent.click(openButton)

    const body = within(document.body)
    const caption = await body.findByText(longGalleryCaption)
    await expect(caption).toHaveAttribute('tabindex', '0')
    await waitFor(() => expect(caption.scrollHeight).toBeGreaterThan(caption.clientHeight))
    await expect(window.getComputedStyle(caption).overflowY).toBe('auto')

    caption.focus()
    await expect(caption).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(openButton).toHaveFocus())
  },
}

export const LongGalleryCaption375Short: Story = withViewportStory(
  longGalleryCaptionBase,
  'public375Short',
  'Long gallery caption / 375 short',
)

export const InteractiveDoctorSelection320: Story = withViewportStory(
  InteractiveDoctorSelection,
  'public320',
  'Interactive doctor selection / 320',
)
export const InteractiveDoctorSelection375: Story = withViewportStory(
  InteractiveDoctorSelection,
  'public375',
  'Interactive doctor selection / 375',
)
export const InteractiveDoctorSelection640: Story = withViewportStory(
  InteractiveDoctorSelection,
  'public640',
  'Interactive doctor selection / 640',
)
export const InteractiveDoctorSelection768: Story = withViewportStory(
  InteractiveDoctorSelection,
  'public768',
  'Interactive doctor selection / 768',
)
export const InteractiveDoctorSelection1024: Story = withViewportStory(
  InteractiveDoctorSelection,
  'public1024',
  'Interactive doctor selection / 1024',
)
export const InteractiveDoctorSelection1280: Story = withViewportStory(
  InteractiveDoctorSelection,
  'public1280',
  'Interactive doctor selection / 1280',
)
