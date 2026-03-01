import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { expect, userEvent, within } from '@storybook/test'
import { Activity, HeartPulse, Stethoscope, Syringe } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
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

const sparseSingleTreatment: TreatmentsStripItem[] = [items[0]!]
const sparseDualTreatments: TreatmentsStripItem[] = [items[0]!, items[2]!]
const sparseTriadTreatments: TreatmentsStripItem[] = [items[0]!, items[1]!, items[2]!]

const meta = {
  title: 'Organisms/Treatments/TreatmentsStrip',
  component: TreatmentsStrip,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    layoutMode: {
      control: 'select',
      options: ['auto', 'fixed', 'adaptive'],
    },
  },
  tags: ['autodocs'],
  args: {
    eyebrow: 'MORE TYPE OF',
    heading: 'Treatments',
    items,
    activeIndex: 2,
    layoutMode: 'auto',
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

export const LayoutModeAutoSparse: Story = {
  name: 'Layout Mode - Auto (Sparse)',
  args: {
    heading: 'Auto Layout Sparse',
    items: sparseDualTreatments,
    activeIndex: 0,
    layoutMode: 'auto',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const grid = canvasElement.querySelector('[data-layout-mode]')
    expect(grid).toHaveAttribute('data-layout-mode', 'adaptive')
    expect(grid).toHaveAttribute('data-column-count', '2')
    expect(canvas.getByRole('heading', { name: 'Vaccinations' })).toBeInTheDocument()
  },
}

export const LayoutModeFixedSparse: Story = {
  name: 'Layout Mode - Fixed (Sparse)',
  args: {
    heading: 'Fixed Layout Sparse',
    items: sparseDualTreatments,
    activeIndex: 0,
    layoutMode: 'fixed',
  },
  play: async ({ canvasElement }) => {
    const grid = canvasElement.querySelector('[data-layout-mode]')
    expect(grid).toHaveAttribute('data-layout-mode', 'fixed')
    expect(grid).toHaveAttribute('data-column-count', '4')
  },
}

export const LayoutModeAdaptiveSparse: Story = {
  name: 'Layout Mode - Adaptive (Sparse)',
  args: {
    heading: 'Adaptive Layout Sparse',
    items: sparseTriadTreatments,
    activeIndex: 1,
    layoutMode: 'adaptive',
  },
  play: async ({ canvasElement }) => {
    const grid = canvasElement.querySelector('[data-layout-mode]')
    expect(grid).toHaveAttribute('data-layout-mode', 'adaptive')
    expect(grid).toHaveAttribute('data-column-count', '3')
  },
}

export const SparseProposalA_CompactCenterSingle: Story = {
  name: 'Sparse Proposal A - Single Spotlight',
  args: {
    heading: 'Single Curated Spotlight',
    items: sparseSingleTreatment,
    activeIndex: 0,
  },
  render: (args) => (
    <div className="bg-background py-16">
      <TreatmentsStrip {...args} />
      <div className="mx-auto mt-6 grid max-w-[1240px] grid-cols-1 gap-4 px-4 md:grid-cols-3 md:px-8">
        <Card className="border-primary/15">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-secondary">Fast intake</p>
            <p className="mt-1 text-sm text-secondary/75">One contact point from first message to travel planning.</p>
          </CardContent>
        </Card>
        <Card className="border-primary/15">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-secondary">Clear cost range</p>
            <p className="mt-1 text-sm text-secondary/75">Price framing before booking so patients can compare.</p>
          </CardContent>
        </Card>
        <Card className="border-primary/15">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-secondary">Aftercare support</p>
            <p className="mt-1 text-sm text-secondary/75">Follow-up checklist and remote care coordination included.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('heading', { name: 'Single Curated Spotlight' })).toBeInTheDocument()
    expect(canvas.getByRole('heading', { name: 'Vaccinations' })).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: 'Vaccinations' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const SparseProposalB_BalancedDuo: Story = {
  name: 'Sparse Proposal B - Dual Core',
  args: {
    heading: 'Dual Core Treatments',
    items: sparseDualTreatments,
    activeIndex: 0,
  },
  render: (args) => (
    <div className="bg-background py-16">
      <TreatmentsStrip {...args} />
      <div className="mx-auto mt-6 max-w-[1240px] px-4 md:px-8">
        <Card className="border-primary/15 bg-secondary/5">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
            <div>
              <p className="text-base font-semibold text-secondary">Two-path comparison</p>
              <p className="mt-1 text-sm text-secondary/75">
                Present two high-demand treatments prominently and route uncertain users to assisted triage.
              </p>
            </div>
            <Button type="button" className="rounded-full px-5">
              Ask care advisor
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('heading', { name: 'Vaccinations' })).toBeInTheDocument()
    expect(canvas.getByRole('heading', { name: 'Treatment of chronic conditions' })).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: 'Vaccinations' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const SparseProposalC_ThreeColumnFocus: Story = {
  name: 'Sparse Proposal C - Triad Focus',
  args: {
    heading: 'Triad Focus',
    items: sparseTriadTreatments,
    activeIndex: 1,
  },
  render: (args) => (
    <div className="bg-background py-16">
      <TreatmentsStrip {...args} />
      <div className="mx-auto mt-6 grid max-w-[1240px] grid-cols-1 gap-4 px-4 md:grid-cols-[2fr_1fr] md:px-8">
        <Card className="border-primary/15">
          <CardContent className="p-5">
            <p className="text-base font-semibold text-secondary">Curated set stays compact</p>
            <p className="mt-1 text-sm text-secondary/75">
              Three cards keep the hero rhythm balanced. Additional treatments can stay in the next list section.
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/15">
          <CardContent className="p-5">
            <p className="text-base font-semibold text-secondary">Best for</p>
            <p className="mt-1 text-sm text-secondary/75">
              Clinics with one flagship line and two complementary options.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('heading', { name: 'Triad Focus' })).toBeInTheDocument()
    expect(canvas.getByRole('heading', { name: 'Management of acute illnesses' })).toBeInTheDocument()
    expect(canvas.getByRole('heading', { name: 'Treatment of chronic conditions' })).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: 'Management of acute illnesses' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

export const SparseProposalD_HybridRail: Story = {
  name: 'Sparse Proposal D - Triad Interactive',
  args: {
    heading: 'Triad Interactive',
    items: sparseTriadTreatments,
    activeIndex: 0,
  },
  render: (args) => {
    const [activeIndex, setActiveIndex] = React.useState(0)

    return (
      <div className="bg-background py-16">
        <TreatmentsStrip {...args} activeIndex={activeIndex} onActiveIndexChange={setActiveIndex} />
        <div className="mx-auto mt-6 max-w-[1240px] px-4 md:px-8">
          <Card className="border-primary/15">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-secondary">Active spotlight</p>
                <p className="mt-1 text-sm text-secondary/75">
                  Current focus: <span className="font-medium text-secondary">{args.items[activeIndex]?.title}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {args.items.map((item, idx) => (
                  <Button
                    key={`chip-${item.title}`}
                    type="button"
                    variant={idx === activeIndex ? 'default' : 'outline'}
                    className="rounded-full px-4"
                    onClick={() => setActiveIndex(idx)}
                  >
                    {item.title}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const user = userEvent.setup()
    await user.click(canvas.getByRole('button', { name: 'Treatment of chronic conditions' }))
    expect(canvas.getByRole('button', { name: 'Treatment of chronic conditions' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}
