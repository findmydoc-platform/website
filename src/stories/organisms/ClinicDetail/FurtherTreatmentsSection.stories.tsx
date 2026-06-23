import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { FurtherTreatmentsSection } from '@/components/organisms/ClinicDetail'
import type { ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'
import { withViewportStory } from '../../utils/viewportMatrix'

const treatments: ClinicDetailTreatment[] = [
  {
    id: 't-1',
    name: 'Neurology Consultation',
    category: 'Specialist Care',
    priceFromUsd: 380,
    comparisonLink: { href: '/listing-comparison?treatment=t-1', label: 'Compare clinics for Neurology Consultation' },
  },
  {
    id: 't-2',
    name: 'Pediatric Cardiology Review',
    category: 'Specialist Care',
    priceFromUsd: 460,
    comparisonLink: {
      href: '/listing-comparison?treatment=t-2',
      label: 'Compare clinics for Pediatric Cardiology Review',
    },
  },
  {
    id: 't-3',
    name: 'Genetic Counseling',
    category: 'Specialist Care',
    comparisonLink: { href: '/listing-comparison?treatment=t-3', label: 'Compare clinics for Genetic Counseling' },
  },
  {
    id: 't-4',
    name: 'Family Nutrition Coaching',
    category: 'Supportive Care',
    priceFromUsd: 150,
    comparisonLink: {
      href: '/listing-comparison?treatment=t-4',
      label: 'Compare clinics for Family Nutrition Coaching',
    },
  },
  {
    id: 't-5',
    name: 'Asthma Management Plan',
    category: 'Chronic Care',
    priceFromUsd: 310,
    comparisonLink: { href: '/listing-comparison?treatment=t-5', label: 'Compare clinics for Asthma Management Plan' },
  },
]

const meta = {
  title: 'Domain/Clinic/Organisms/ClinicDetail/FurtherTreatmentsSection',
  component: FurtherTreatmentsSection,
  args: {
    treatments,
    visibleCount: 3,
    onShowMore: fn(),
    onChooseTreatment: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Paginated additional treatments list with explicit choose-treatment actions that feed the clinic contact flow.',
      },
    },
  },
  tags: ['autodocs', 'domain:clinic', 'layer:organism', 'status:stable', 'used-in:block:further-treatments-section'],
} satisfies Meta<typeof FurtherTreatmentsSection>

export default meta

type Story = StoryObj<typeof meta>

function FurtherTreatmentsStoryHarness() {
  const [visibleCount, setVisibleCount] = React.useState(2)
  const [selectedTreatmentId, setSelectedTreatmentId] = React.useState('')

  return (
    <div className="bg-muted py-14">
      <div className="container-content space-y-4">
        <p className="text-sm text-secondary/70" data-testid="selected-treatment-output">
          Selected treatment: {selectedTreatmentId || 'none'}
        </p>

        <FurtherTreatmentsSection
          treatments={treatments}
          visibleCount={visibleCount}
          onShowMore={() => setVisibleCount((count) => count + 2)}
          onChooseTreatment={setSelectedTreatmentId}
        />
      </div>
    </div>
  )
}

export const PaginatedSelection: Story = {
  render: () => <FurtherTreatmentsStoryHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Further Treatments' })).toBeInTheDocument()

    const chooseButtons = canvas.getAllByRole('button', { name: 'Choose Treatment' })
    await expect(canvas.getByRole('link', { name: 'Compare clinics for Neurology Consultation' })).toHaveAttribute(
      'href',
      '/listing-comparison?treatment=t-1',
    )
    await userEvent.click(chooseButtons[0] as HTMLElement)
    await expect(canvas.getByTestId('selected-treatment-output')).toHaveTextContent('Selected treatment: t-1')

    await userEvent.click(canvas.getByRole('button', { name: 'Show more treatments' }))
    await expect(canvas.getByText('Genetic Counseling')).toBeInTheDocument()
  },
}

export const PaginatedSelection320: Story = withViewportStory(
  PaginatedSelection,
  'public320',
  'Paginated selection / 320',
)
export const PaginatedSelection375: Story = withViewportStory(
  PaginatedSelection,
  'public375',
  'Paginated selection / 375',
)
export const PaginatedSelection640: Story = withViewportStory(
  PaginatedSelection,
  'public640',
  'Paginated selection / 640',
)
export const PaginatedSelection768: Story = withViewportStory(
  PaginatedSelection,
  'public768',
  'Paginated selection / 768',
)
export const PaginatedSelection1024: Story = withViewportStory(
  PaginatedSelection,
  'public1024',
  'Paginated selection / 1024',
)
export const PaginatedSelection1280: Story = withViewportStory(
  PaginatedSelection,
  'public1280',
  'Paginated selection / 1280',
)
