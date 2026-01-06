import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { Pagination } from '@/components/molecules/Pagination'

const meta = {
  title: 'Molecules/Pagination',
  component: Pagination,
  tags: ['autodocs'],
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
}

export const EdgeOfRange: Story = {
  args: {
    page: 1,
    totalPages: 3,
    onNavigate: () => undefined,
  },
}
