/**
 * Seed data for reviews
 */

export type ReviewData = {
  comment: string
  starRating: number
  status: 'pending' | 'approved' | 'rejected'
}

/**
 * Review content without relationships
 * Relationships (patient, clinic, doctor, treatment) will be assigned programmatically
 */
export const reviewsData: ReviewData[] = [
  {
    comment: 'The procedure was painless and the staff was very professional.',
    starRating: 5,
    status: 'approved',
  },
]
