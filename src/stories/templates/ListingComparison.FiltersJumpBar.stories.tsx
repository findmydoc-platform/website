import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { ListingFiltersJumpBar } from '@/components/templates/ListingComparison/ListingFiltersJumpBar.client'

const FILTER_TARGET_ID = 'listing-filters-jumpbar-story-target'

const JumpBarDemoPage: React.FC = () => {
  return (
    <div className="bg-muted/30 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:items-start">
          <aside id={FILTER_TARGET_ID} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Filters</p>
            {Array.from({ length: 18 }, (_, index) => (
              <div
                key={index}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              >
                Filter block {index + 1}
              </div>
            ))}
          </aside>

          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scroll down until the left filter column leaves the viewport. Then the jump bar should appear.
            </p>
            {Array.from({ length: 60 }, (_, index) => (
              <article key={index} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-sm font-medium text-foreground">Result card #{index + 1}</p>
                <p className="text-xs text-muted-foreground">
                  Placeholder result to create enough page height for jump-bar visibility checks.
                </p>
              </article>
            ))}
          </section>
        </div>
      </div>

      <ListingFiltersJumpBar targetId={FILTER_TARGET_ID} />
    </div>
  )
}

const meta = {
  title: 'Domain/Listing/Templates/ListingComparison/Parts/Filters Jump Bar',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Floating jump bar that appears when the filter column is out of view and scrolls users back to the filter area.',
      },
    },
  },
  tags: ['autodocs', 'domain:listing', 'layer:template', 'status:stable', 'used-in:route:/listing-comparison'],
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Demo: Story = {
  render: () => <JumpBarDemoPage />,
}
