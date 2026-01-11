import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { expect } from '@storybook/jest'
import { userEvent, within } from '@storybook/testing-library'
import { Activity, HeartPulse, Stethoscope, Syringe } from 'lucide-react'

import { TreatmentsStrip, type TreatmentsStripItem } from '@/components/organisms/TreatmentsStrip'

const longVaccinationDescription = [
  'The Pediatric Department provides vaccinations to help protect children from a wide range of illnesses and diseases,',
  'including measles, mumps, rubella, polio, and others. In many cases, vaccinations are the single most effective',
  'intervention we can offer to reduce serious complications, hospitalizations, and long-term health issues.',
  'Parents receive detailed counseling about vaccine schedules, potential side effects, and what to expect before and after',
  'each appointment. Our team also coordinates catch-up vaccination plans for children who may have missed earlier doses,',
  'ensuring that every child has the opportunity to be fully protected. For families who are traveling or relocating, we',
  'review international guidelines and adapt the vaccination plan accordingly, so that protection is continuous and tailored',
  'to their specific situation. This long text is intentionally verbose to test how the layout behaves when descriptions are',
  'much longer than usual and should be clamped visually in the Treatments section.',
].join(' ')

const items: TreatmentsStripItem[] = [
  {
    title: 'Vaccinations',
    description: longVaccinationDescription,
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
            description: longVaccinationDescription,
          }
        : item,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find the visible description for the first tile. We filter by both text
    // content and the clamp class, then take the first match if available.
    const matches = canvas.getAllByText((content, element) => {
      return Boolean(element && element.classList.contains('line-clamp-4') && content.includes('vaccinations'))
    })

    const descr = matches[0]!

    // It should have the clamp class and actually clip overflowing content
    expect(descr).toHaveClass('line-clamp-4')
    const cs = window.getComputedStyle(descr)
    expect(cs.overflow).toBe('hidden')

    // In a real browser environment, clamped text will have more content
    // than the box can show, so scrollHeight should be greater than clientHeight.
    expect(descr.scrollHeight).toBeGreaterThan(descr.clientHeight)
  },
}
