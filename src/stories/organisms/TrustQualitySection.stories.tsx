import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

import { TrustQualitySection, type TrustQualitySectionProps } from '@/components/organisms/TrustQualitySection'
import { formatTrustQualityStatValue } from '@/components/organisms/TrustQualitySection'
import { clinicTrust } from '@/stories/fixtures'

const meta = {
  title: 'Domain/Listing/Organisms/TrustQualitySection',
  component: TrustQualitySection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:listing', 'layer:organism', 'status:stable', 'used-in:route:/listing-comparison'],
  args: clinicTrust,
} satisfies Meta<typeof TrustQualitySection>

export default meta

type Story = StoryObj<typeof meta>

const renderMetricUpdatePreview = (args: Story['args']) => {
  const resolvedArgs = args as TrustQualitySectionProps
  const [stats, setStats] = React.useState(resolvedArgs.stats)

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        onClick={() => {
          setStats((currentStats) =>
            currentStats.map((stat, index) =>
              index === 0 && 'value' in stat
                ? {
                    ...stat,
                    value: stat.value + 200,
                  }
                : stat,
            ),
          )
        }}
      >
        Update metrics
      </button>
      <TrustQualitySection {...resolvedArgs} stats={stats} />
    </div>
  )
}

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByText(args.title)).toBeInTheDocument()
    if (args.subtitle) {
      expect(canvas.getByText(args.subtitle)).toBeInTheDocument()
    }

    for (const stat of args.stats) {
      const expectedValueText = 'value' in stat ? formatTrustQualityStatValue(stat) : stat.valueText
      await expect(canvas.findByText(expectedValueText)).resolves.toBeInTheDocument()
      expect(canvas.getByText(stat.label)).toBeInTheDocument()
    }

    if (args.badges) {
      args.badges.forEach((badge) => {
        expect(canvas.getByText(badge)).toBeInTheDocument()
      })
    }
  },
}

export const UpdatesMetricValues: Story = {
  args: {
    title: 'Trust proven quality',
    numberLocale: 'en-US',
    stats: [
      {
        value: 1200,
        suffix: '+',
        label: 'Treatment types',
        Icon: clinicTrust.stats[1]!.Icon,
      },
    ],
  },
  render: renderMetricUpdatePreview,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const statLabel = await canvas.findByText('Treatment types')
    const statCard = statLabel.closest('li')

    if (!statCard) {
      throw new Error('Unable to locate the metric card for Treatment types.')
    }

    const visibleValue = statCard.querySelector('span[aria-hidden="true"]')

    if (!visibleValue) {
      throw new Error('Unable to locate the visible animated value.')
    }

    await waitFor(
      () => {
        expect(visibleValue).toHaveTextContent('1,200+')
      },
      { timeout: 2000 },
    )
    await userEvent.click(canvas.getByRole('button', { name: /update metrics/i }))
    await waitFor(
      () => {
        expect(visibleValue).toHaveTextContent('1,400+')
      },
      { timeout: 2000 },
    )
  },
}

export const MetricUpdatePreview: Story = {
  args: UpdatesMetricValues.args,
  render: renderMetricUpdatePreview,
}
