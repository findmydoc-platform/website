import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from '@storybook/test'

import { HeroOverviewSection } from '@/components/organisms/ClinicDetail'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
import { withViewportStory } from '../../utils/viewportMatrix'

const heroDoctors = clinicDetailFixture.doctors.slice(0, 6)
const singleDoctor = clinicDetailFixture.doctors.slice(0, 1)

const meta = {
  title: 'Domain/Clinic/Organisms/ClinicDetail/HeroOverviewSection',
  component: HeroOverviewSection,
  args: {
    clinicName: clinicDetailFixture.clinicName,
    description: clinicDetailFixture.description,
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
    <div className="bg-muted py-14">
      <div className="container-content space-y-4">
        <p className="text-sm text-secondary/70" data-testid="active-doctor-output">
          Active doctor: {activeDoctorId || 'none'}
        </p>
        <HeroOverviewSection
          clinicName={clinicDetailFixture.clinicName}
          description={clinicDetailFixture.description}
          heroImage={clinicDetailFixture.heroImage}
          trust={clinicDetailFixture.trust}
          doctors={heroDoctors}
          activeDoctorId={activeDoctorId}
          onDoctorSelect={setActiveDoctorId}
        />
      </div>
    </div>
  )
}

export const InteractiveDoctorSelection: Story = {
  render: () => <HeroOverviewSectionStoryHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Berlin Health Clinic' })).toBeInTheDocument()
    const doctorButton = canvas.getByRole('button', { name: `Select ${heroDoctors[1]?.name}` })

    await userEvent.click(doctorButton)
    await expect(canvas.getByTestId('active-doctor-output')).toHaveTextContent(`Active doctor: ${heroDoctors[1]?.id}`)
  },
}

export const SingleDoctorCompactState: Story = {
  args: {
    doctors: singleDoctor,
    activeDoctorId: singleDoctor[0]?.id ?? '',
  },
  render: (args) => (
    <div className="bg-muted py-14">
      <div className="container-content">
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </div>
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
    <div className="bg-muted py-14">
      <div className="container-content">
        <HeroOverviewSection {...args} onDoctorSelect={fn()} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('0 listed specialists')).toBeInTheDocument()
    await expect(canvas.getByText(/No doctors are currently listed for this clinic/i)).toBeInTheDocument()
  },
}

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
