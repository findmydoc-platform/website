import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { Pagination } from '@/components/molecules/Pagination'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Shared/Molecules/Pagination',
  component: Pagination,
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
  parameters: {
    docs: {
      description: {
        component:
          'Navigation component for paginated content lists. Displays page numbers with ellipsis for long ranges and handles edge cases (first/last page).',
      },
    },
  },
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  args: {
    page: 4,
    totalPages: 12,
  },
  render: (args) => {
    const [page, setPage] = React.useState(args.page)

    React.useEffect(() => {
      setPage(args.page)
    }, [args.page])

    return (
      <Pagination
        {...args}
        page={page}
        onNavigate={(path) => {
          const match = path.match(/(\d+)$/)

          if (match) {
            setPage(Number(match[1]))
          }
        }}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nextButton = canvas.getByRole('button', { name: /go to next page/i })

    await expect(canvas.getByRole('button', { name: '4' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(nextButton)

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: '5' })).toHaveAttribute('aria-current', 'page')
    })
  },
}

export const EdgeOfRange: Story = {
  args: {
    page: 1,
    totalPages: 3,
    onNavigate: () => undefined,
  },
}

export const Interactive320: Story = withViewportStory(Interactive, 'public320', 'Interactive / 320')
export const Interactive375: Story = withViewportStory(Interactive, 'public375', 'Interactive / 375')
export const Interactive640: Story = withViewportStory(Interactive, 'public640', 'Interactive / 640')
export const Interactive768: Story = withViewportStory(Interactive, 'public768', 'Interactive / 768')
export const Interactive1024: Story = withViewportStory(Interactive, 'public1024', 'Interactive / 1024')
export const Interactive1280: Story = withViewportStory(Interactive, 'public1280', 'Interactive / 1280')
