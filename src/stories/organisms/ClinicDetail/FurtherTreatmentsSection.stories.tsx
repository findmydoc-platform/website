import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from '@storybook/test'

import { FurtherTreatmentsSection } from '@/components/organisms/ClinicDetail'
import type { ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'

const treatments: ClinicDetailTreatment[] = [
  { id: 't-1', name: 'Neurology Consultation', category: 'Specialist Care', priceFromUsd: 380 },
  { id: 't-2', name: 'Pediatric Cardiology Review', category: 'Specialist Care', priceFromUsd: 460 },
  { id: 't-3', name: 'Genetic Counseling', category: 'Specialist Care' },
  { id: 't-4', name: 'Family Nutrition Coaching', category: 'Supportive Care', priceFromUsd: 150 },
  { id: 't-5', name: 'Asthma Management Plan', category: 'Chronic Care', priceFromUsd: 310 },
]

const meta = {
  title: 'Organisms/ClinicDetail/FurtherTreatmentsSection',
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
  tags: ['autodocs'],
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
    await userEvent.click(chooseButtons[0] as HTMLElement)
    await expect(canvas.getByTestId('selected-treatment-output')).toHaveTextContent('Selected treatment: t-1')

    await userEvent.click(canvas.getByRole('button', { name: 'Show more treatments' }))
    await expect(canvas.getByText('Genetic Counseling')).toBeInTheDocument()
  },
}
