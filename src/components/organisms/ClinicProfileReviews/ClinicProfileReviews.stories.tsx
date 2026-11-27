import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ClinicProfile } from '@/components/organisms/ClinicProfile/ClinicProfile'
import { clinicDetailFixture, clinicDetailModeratedReviewsFixture } from '@/stories/fixtures/clinicDetail'
import { ClinicProfileReviews } from './ClinicProfileReviews'

const reviewItems = Array.from({ length: 8 }, (_, index) => ({
  id: `review-${index}`,
  kind: 'text' as const,
  authorName: `Patient ${index + 1}`,
  reviewDate: `2026-01-${String(20 - index).padStart(2, '0')}T12:00:00.000Z`,
  ratingValue: index === 0 ? 4 : 5,
  comment: index === 0 ? 'A distinctive test review about preparation.' : `Test review ${index + 1}.`,
  ...(index === 0
    ? { response: { body: 'A test response from the clinic.', clinicName: 'Test clinic', approvedAt: '2026-02-01' } }
    : {}),
}))

const meta = {
  title: 'Domain/Clinic/Organisms/ClinicProfileReviews',
  component: ClinicProfileReviews,
  args: { ratingValue: 4.8, reviews: { totalCount: 12, items: reviewItems, hasMore: true } },
  render: (args) => (
    <ClinicProfile
      data={{
        ...clinicDetailFixture,
        trust: { ...clinicDetailFixture.trust, reviewCount: args.reviews.totalCount, ratingValue: args.ratingValue },
      }}
      favorite={{ isPatient: true, saved: false, onToggle: () => {}, onSignIn: () => {} }}
      share={{ url: 'https://example.test/clinic', onCopy: async () => {} }}
      map={{ allowed: false }}
    >
      <ClinicProfileReviews {...args} />
    </ClinicProfile>
  ),
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs', 'domain:clinic', 'layer:organism', 'status:experimental', 'used-in:route:/clinics/[slug]'],
} satisfies Meta<typeof ClinicProfileReviews>
export default meta
type Story = StoryObj<typeof meta>

export const BrowseLoadedReviews: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('A distinctive test review about preparation.')).toBeVisible()
    await expect(canvas.queryByText('Test review 8.')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByText("Read the clinic's response"))
    await expect(canvas.getByText('A test response from the clinic.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }))
    await expect(canvas.getByText('Test review 8.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search reviews' }), 'distinctive')
    await expect(canvas.getByText('A distinctive test review about preparation.')).toBeVisible()
    await expect(canvas.queryByText('Test review 8.')).not.toBeInTheDocument()
  },
}

export const FilterAndReset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole('searchbox', { name: 'Search reviews' })
    await userEvent.type(search, 'no matching test review')
    await expect(canvas.queryByRole('article')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Clear filters' }))
    await expect(search).toHaveFocus()
    await expect(search).toHaveValue('')
    await expect(canvas.getByText('A distinctive test review about preparation.')).toBeVisible()
  },
}

export const RatingAndSort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Filter reviews by rating' }), '4')
    await expect(canvas.getByText('A distinctive test review about preparation.')).toBeVisible()
    await expect(canvas.queryByText('Test review 2.')).not.toBeInTheDocument()
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Filter reviews by rating' }), 'all')
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort reviews' }), 'highest')
    await expect(canvas.queryByText('A distinctive test review about preparation.')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }))
    await expect(canvas.getByText('A distinctive test review about preparation.')).toBeVisible()
  },
}

export const Moderated: Story = {
  args: { ratingValue: 4.3, reviews: clinicDetailModeratedReviewsFixture.reviews },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const [placeholder, redacted] = args.reviews.items
    if (
      !placeholder ||
      placeholder.kind !== 'placeholder' ||
      !redacted ||
      redacted.kind !== 'text' ||
      !redacted.notice ||
      !redacted.response
    )
      throw new Error('Invalid review fixture')
    await expect(canvas.getByRole('note', { name: 'Review text unavailable' })).toHaveTextContent(placeholder.notice)
    await expect(canvas.getByText(redacted.comment)).toBeVisible()
    await expect(canvas.getByText(redacted.notice)).toBeVisible()
    await userEvent.click(canvas.getByText("Read the clinic's response"))
    await expect(canvas.getByText(redacted.response.body)).toBeVisible()
  },
}

export const NoPublishedReviews: Story = { args: { ratingValue: null, reviews: { totalCount: 0, items: [] } } }
export const PublishedWithoutDisplayableEntries: Story = {
  args: { ratingValue: 4, reviews: { totalCount: 2, items: [], hasMore: true } },
}
export const FullProfile: Story = {}
export const LongReview: Story = {
  args: {
    ratingValue: 5,
    reviews: {
      totalCount: 1,
      items: [
        {
          ...reviewItems[0]!,
          authorName: 'A patient with a particularly long display name that needs to wrap safely',
          comment: 'Detailed feedback '.repeat(80),
        },
      ],
    },
  },
}
