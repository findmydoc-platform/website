import type { Meta, StoryObj } from '@storybook/react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/atoms/pagination'

const meta = {
  title: 'Atoms/Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious onClick={() => undefined} />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink isActive onClick={() => undefined}>
            1
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink onClick={() => undefined}>2</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink onClick={() => undefined}>3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink onClick={() => undefined}>8</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext onClick={() => undefined} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
}
