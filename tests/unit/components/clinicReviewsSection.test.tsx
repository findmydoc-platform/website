// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ClinicReviewsSection } from '@/components/organisms/ClinicDetail/ClinicReviewsSection'
import type { ClinicDetailReviews } from '@/features/clinicDetail/contracts'

const reviews: ClinicDetailReviews = {
  totalCount: 5,
  items: [
    {
      id: 'review-1',
      kind: 'text',
      reviewDate: '2026-07-27T10:00:00.000Z',
      ratingValue: 5,
      authorName: 'Maya K.',
      comment: 'The care team explained every step and sent clear follow-up information.',
      response: {
        body: 'Thank you for your feedback. We are glad the preparation and follow-up information helped.',
        clinicName: 'Berlin Health Clinic',
        approvedAt: '2026-07-28T10:00:00.000Z',
      },
    },
    {
      id: 'review-2',
      kind: 'text',
      reviewDate: '2026-07-26T10:00:00.000Z',
      ratingValue: 4,
      comment: 'The appointment was well organized and the written plan was helpful.',
    },
    {
      id: 'review-3',
      kind: 'text',
      reviewDate: '2026-07-25T10:00:00.000Z',
      ratingValue: 5,
      comment: 'The team was attentive throughout the consultation.',
    },
    {
      id: 'review-4',
      kind: 'text',
      reviewDate: '2026-07-24T10:00:00.000Z',
      ratingValue: 4,
      comment: 'The follow-up communication was clear and timely.',
    },
    {
      id: 'review-5',
      kind: 'text',
      reviewDate: '2026-07-23T10:00:00.000Z',
      ratingValue: 5,
      comment: 'The clinic prepared us well for the next steps.',
      response: {
        body: 'Thank you for taking the time to share your experience with our team.',
        clinicName: 'Berlin Health Clinic',
        approvedAt: '2026-07-24T11:00:00.000Z',
      },
    },
  ],
}

describe('ClinicReviewsSection clinic responses', () => {
  it('renders approved clinic responses as part of the review card without exposing staff attribution', () => {
    render(<ClinicReviewsSection ratingValue={4.8} reviews={reviews} />)

    expect(screen.getByRole('group', { name: 'Clinic response' })).toBeInTheDocument()
    expect(screen.getByText('Clinic response')).toBeInTheDocument()
    expect(screen.queryByText('Berlin Health Clinic')).not.toBeInTheDocument()
    expect(
      screen.getByText('Thank you for your feedback. We are glad the preparation and follow-up information helped.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/platform staff|clinic staff|moderation/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show more reviews' }))

    expect(screen.getAllByRole('group', { name: 'Clinic response' })).toHaveLength(2)
    expect(
      screen.getByText('Thank you for taking the time to share your experience with our team.'),
    ).toBeInTheDocument()
  })

  it('lets mobile users expand and collapse a long clinic response without truncating the stored text', () => {
    const longBody = [
      'Thank you for taking the time to describe your experience in detail.',
      'We reviewed your feedback with the care and scheduling teams and documented the communication points you raised.',
      'The clinic has clarified the preparation checklist and follow-up process so future patients receive the same information before their appointment.',
      'If you need another copy of the written plan, our team can provide it through the usual patient communication channel.',
    ].join(' ')
    const baseReview = reviews.items[0]
    if (!baseReview || baseReview.kind !== 'text') throw new Error('Expected a text review fixture')

    const longResponseReviews: ClinicDetailReviews = {
      totalCount: 1,
      items: [
        {
          ...baseReview,
          response: {
            body: longBody,
            clinicName: 'Berlin Health Clinic Center for Pediatric and Adolescent Interdisciplinary Specialist Care',
            approvedAt: '2026-07-28T10:00:00.000Z',
          },
        },
      ],
    }

    render(<ClinicReviewsSection ratingValue={5} reviews={longResponseReviews} />)

    const responseBody = screen.getByText(longBody)
    const showMoreButton = screen.getByRole('button', { name: 'Show more' })
    expect(responseBody).toHaveClass('max-h-[10.5rem]')
    expect(showMoreButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(showMoreButton)

    expect(responseBody).not.toHaveClass('max-h-[10.5rem]')
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))

    expect(responseBody).toHaveClass('max-h-[10.5rem]')
    expect(screen.getByRole('button', { name: 'Show more' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows factual redaction context and a real placeholder without review text or response', () => {
    const moderatedReviews: ClinicDetailReviews = {
      totalCount: 2,
      items: [
        {
          id: 'redacted',
          kind: 'text',
          reviewDate: '2026-07-27T10:00:00.000Z',
          ratingValue: 5,
          comment: 'Readable review after narrow removal.',
          notice:
            'Parts of this review were removed to protect legal rights or personal data. The remaining text is unchanged.',
          response: {
            body: 'The clinic response remains visible for a readable redacted review.',
            clinicName: 'Berlin Health Clinic',
            approvedAt: '2026-07-28T10:00:00.000Z',
          },
        },
        {
          id: 'placeholder',
          kind: 'placeholder',
          reviewDate: '2026-07-26T10:00:00.000Z',
          ratingValue: 4,
          notice: 'This review was moderated. Its written content is not publicly available.',
        },
      ],
    }

    render(<ClinicReviewsSection ratingValue={4.5} reviews={moderatedReviews} />)

    expect(screen.getByRole('note', { name: 'Review moderation notice' })).toHaveTextContent(
      'The remaining text is unchanged.',
    )
    expect(screen.getByRole('note', { name: 'Review text unavailable' })).toHaveTextContent(
      'Its written content is not publicly available.',
    )
    expect(
      screen.getByRole('article', {
        name: 'Anonymous patient verified moderated review with unavailable text from Jul 26, 2026',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: 'Clinic response' })).toHaveLength(1)
    expect(screen.queryByText(/Original placeholder text/)).not.toBeInTheDocument()
  })

  it('renders a placeholder as the featured latest review without text or a clinic response', () => {
    const originalLatestReview = reviews.items[0]
    if (!originalLatestReview || originalLatestReview.kind !== 'text') {
      throw new Error('Expected the original latest review fixture to contain text')
    }
    const latestPlaceholderReviews: ClinicDetailReviews = {
      totalCount: 2,
      items: [
        {
          id: 'latest-placeholder',
          kind: 'placeholder',
          reviewDate: '2026-07-28T10:00:00.000Z',
          ratingValue: 4,
          authorName: 'Maya K.',
          notice: 'This review was moderated. Its written content is not publicly available.',
        },
        originalLatestReview,
      ],
    }

    render(<ClinicReviewsSection ratingValue={4.5} reviews={latestPlaceholderReviews} />)

    const latestReview = screen.getByText('Latest review').closest('article')
    expect(latestReview).not.toBeNull()
    const latestReviewQueries = within(latestReview as HTMLElement)
    expect(latestReviewQueries.getByRole('note', { name: 'Review text unavailable' })).toHaveTextContent(
      'Its written content is not publicly available.',
    )
    expect(latestReviewQueries.queryByText(originalLatestReview.comment)).not.toBeInTheDocument()
    expect(latestReviewQueries.queryByRole('group', { name: 'Clinic response' })).not.toBeInTheDocument()
  })
})
