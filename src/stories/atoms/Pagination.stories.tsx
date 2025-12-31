import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { within } from '@storybook/testing-library'
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

type PaginationState = {
  activePage: number
  previousDisabled?: boolean
  nextDisabled?: boolean
}

const renderPagination = ({ activePage, previousDisabled, nextDisabled }: PaginationState) => (
  <Pagination>
    <PaginationContent>
      <PaginationItem>
        <PaginationPrevious disabled={previousDisabled} onClick={() => undefined} />
      </PaginationItem>
      <PaginationItem>
        <PaginationLink isActive={activePage === 1} onClick={() => undefined}>
          1
        </PaginationLink>
      </PaginationItem>
      <PaginationItem>
        <PaginationLink isActive={activePage === 2} onClick={() => undefined}>
          2
        </PaginationLink>
      </PaginationItem>
      <PaginationItem>
        <PaginationLink isActive={activePage === 3} onClick={() => undefined}>
          3
        </PaginationLink>
      </PaginationItem>
      <PaginationItem>
        <PaginationEllipsis />
      </PaginationItem>
      <PaginationItem>
        <PaginationLink isActive={activePage === 8} onClick={() => undefined}>
          8
        </PaginationLink>
      </PaginationItem>
      <PaginationItem>
        <PaginationNext disabled={nextDisabled} onClick={() => undefined} />
      </PaginationItem>
    </PaginationContent>
  </Pagination>
)

const assertActivePage = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement)
  const activePage = canvas.getByRole('button', { current: 'page' })
  expect(activePage).toHaveAttribute('aria-current', 'page')
}

const assertFirstPage = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await assertActivePage({ canvasElement })
  const canvas = within(canvasElement)
  const previousButton = canvas.getByLabelText('Go to previous page')
  expect(previousButton).toBeDisabled()
}

const assertLastPage = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await assertActivePage({ canvasElement })
  const canvas = within(canvasElement)
  const nextButton = canvas.getByLabelText('Go to next page')
  expect(nextButton).toBeDisabled()
}

export const Basic: Story = {
  render: () => renderPagination({ activePage: 1 }),
  play: assertActivePage,
}

export const FirstPage: Story = {
  render: () => renderPagination({ activePage: 1, previousDisabled: true }),
  play: assertFirstPage,
}

export const LastPage: Story = {
  render: () => renderPagination({ activePage: 8, nextDisabled: true }),
  play: assertLastPage,
}
