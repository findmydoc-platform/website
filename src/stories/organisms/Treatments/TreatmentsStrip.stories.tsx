import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { expect } from '@storybook/jest'
import { userEvent, within } from '@storybook/testing-library'
import { Activity, HeartPulse, Stethoscope, Syringe } from 'lucide-react'

import { TreatmentsStrip, type TreatmentsStripItem } from '@/components/organisms/TreatmentsStrip'

const items: TreatmentsStripItem[] = [
  {
    title: 'Vaccinations',
    description:
      'The Pediatric Department provides vaccinations to help protect children from a range of illnesses and diseases, including measles, mumps, rubella, polio, and others.',
    icon: <Syringe className="size-7" aria-hidden={true} />, // icon-only (decorative)
  },
  {
    title: 'Management of acute illnesses',
    description:
      'The Pediatric Department provides treatment for common childhood illnesses, such as ear infections, strep throat, and viral infections.',
    icon: <Stethoscope className="size-7" aria-hidden={true} />,
  },
  {
    title: 'Treatment of chronic conditions',
    description:
      'The Pediatric Department provides ongoing care and treatment for children with chronic conditions such as asthma, diabetes, and allergies.',
    icon: <HeartPulse className="size-7" aria-hidden={true} />,
  },
  {
    title: 'Developmental screenings',
    description:
      'The Pediatric Department provides regular developmental screenings to identify any delays or concerns and provide early intervention services as needed.',
    icon: <Activity className="size-7" aria-hidden={true} />,
  },
]

const meta = {
  title: 'Organisms/Treatments/TreatmentsStrip',
  component: TreatmentsStrip,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    eyebrow: 'MORE TYPE OF',
    heading: 'Treatments',
    items,
    activeIndex: 2,
  },
} satisfies Meta<typeof TreatmentsStrip>

export default meta

type Story = StoryObj<typeof meta>

export const Static: Story = {}

export const Interactive: Story = {
  render: (args) => {
    const [activeIndex, setActiveIndex] = React.useState(args.activeIndex)

    return (
      <div className="bg-background py-16">
        <TreatmentsStrip {...args} activeIndex={activeIndex} onActiveIndexChange={setActiveIndex} />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const user = userEvent.setup()

    // Switch to the last tile.
    await user.click(canvas.getByRole('button', { name: 'Developmental screenings' }))

    expect(canvas.getByRole('button', { name: 'Developmental screenings' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const LongTextClamped: Story = {
  args: {
    items: items.map((item, idx) =>
      idx === 0
        ? {
            ...item,
            description:
              item.description +
              ' This extra sentence intentionally forces overflow to verify CSS line-clamp and ensure the layout stays aligned across tiles.',
          }
        : item,
    ),
  },
}
