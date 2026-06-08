import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { ClinicDetail } from '@/components/templates/ClinicDetailConcepts'
import {
  clinicDetailFixture,
  clinicDetailNoReviewsFixture,
  clinicDetailReviewsPartiallyLoadedFixture,
  clinicDetailReviewsPendingTextFixture,
} from '@/stories/fixtures/clinicDetail'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Domain/Clinic/Templates/ClinicDetail',
  component: ClinicDetail,
  args: {
    data: clinicDetailFixture,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Main desktop clinic detail concept with synchronized doctor/treatment contact flow and a real contact form.',
      },
    },
  },
  tags: ['autodocs', 'domain:clinic', 'layer:template', 'status:stable', 'used-in:route:/clinics/[slug]'],
} satisfies Meta<typeof ClinicDetail>

export default meta

type Story = StoryObj<typeof meta>

export const Main_Default: Story = {
  render: (args) => <ClinicDetail {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Berlin Health Clinic' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Patient Reviews' })).toBeInTheDocument()
    await expect(canvas.getByText('5 reviews')).toBeInTheDocument()
    await expect(canvas.getByText('Maya K.')).toBeInTheDocument()
    await expect(canvas.getAllByText('Verified patient').length).toBeGreaterThan(0)
    await expect(
      canvas.getByText(/The clinic team explained each step clearly before the appointment/),
    ).toBeInTheDocument()

    const showMoreButton = canvas.getByRole('button', { name: 'Show more reviews' })
    showMoreButton.focus()
    await expect(showMoreButton).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await expect(canvas.getByText(/Helpful doctors and transparent next steps for follow-up care/)).toBeInTheDocument()
    await expect(
      canvas.getByText(/Good coordination before the visit and clear information after the appointment/),
    ).toBeInTheDocument()
    await expect(canvas.getByRole('article', { name: 'Verified patient review from Dec 18, 2025' })).toHaveFocus()
    expect(canvas.getAllByText('Showing 5 reviews of 5 reviews.').length).toBeGreaterThan(0)

    await expect(canvas.getByRole('heading', { name: 'Treatments' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Further Treatments' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Our Doctors' })).toBeInTheDocument()

    const contactDoctorLinks = canvas.getAllByRole('link', { name: 'Contact Doctor' })
    await expect(contactDoctorLinks.length).toBeGreaterThan(0)
    await expect(contactDoctorLinks[0]).toHaveAttribute('href', '#clinic-contact-form')

    const doctorSelect = canvas.getByRole('combobox', { name: 'Doctor' })
    const treatmentSelect = canvas.getByRole('combobox', { name: 'Treatment' })

    await expect(doctorSelect).toHaveValue('')
    await expect(treatmentSelect).toHaveValue('')
  },
}

export const Edge_NoReviews_FallbackText: Story = {
  args: {
    data: clinicDetailNoReviewsFixture,
  },
  render: (args) => <ClinicDetail {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'No patient reviews yet' })).toBeInTheDocument()
    await expect(canvas.getByText('0 reviews')).toBeInTheDocument()
    await expect(canvas.getByText('Approved reviews will appear here after moderation.')).toBeInTheDocument()
  },
}

export const Edge_ReviewsPendingText_FallbackText: Story = {
  args: {
    data: clinicDetailReviewsPendingTextFixture,
  },
  render: (args) => <ClinicDetail {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Approved review text is being connected' })).toBeInTheDocument()
    await expect(canvas.getByText('2 reviews')).toBeInTheDocument()
    await expect(canvas.getByText('Review text is not ready for public display yet.')).toBeInTheDocument()
    await expect(
      canvas.getByText('Approved review records exist, but text content is not ready for public display yet.'),
    ).toBeInTheDocument()
  },
}

export const Edge_ReviewsPartiallyLoaded_CountText: Story = {
  args: {
    data: clinicDetailReviewsPartiallyLoadedFixture,
  },
  render: (args) => <ClinicDetail {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Patient Reviews' })).toBeInTheDocument()
    await expect(canvas.getByText('2 reviews loaded')).toBeInTheDocument()
    await expect(canvas.getByText('Showing 2 reviews loaded on this page of 248 reviews.')).toBeInTheDocument()
    await expect(
      canvas.getByText(/The clinic team explained each step clearly before the appointment/),
    ).toBeInTheDocument()
  },
}

export const Main_WithGuestFavoriteAction: Story = {
  args: {
    data: clinicDetailFixture,
    favorite: {
      isPatient: false,
      favoriteId: null,
      loginHref: '/login/patient?next=%2Fclinics%2Fberlin-health-clinic',
    },
  },
  render: (args) => <ClinicDetail {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Save clinic' })).toHaveAttribute(
      'href',
      '/login/patient?next=%2Fclinics%2Fberlin-health-clinic',
    )
  },
}

export const MainDefault320: Story = withViewportStory(Main_Default, 'public320', 'Main default / 320')
export const MainDefault375: Story = withViewportStory(Main_Default, 'public375', 'Main default / 375')
export const MainDefault640: Story = withViewportStory(Main_Default, 'public640', 'Main default / 640')
export const MainDefault768: Story = withViewportStory(Main_Default, 'public768', 'Main default / 768')
export const MainDefault1024: Story = withViewportStory(Main_Default, 'public1024', 'Main default / 1024')
export const MainDefault1280: Story = withViewportStory(Main_Default, 'public1280', 'Main default / 1280')

export const NoReviews320: Story = withViewportStory(Edge_NoReviews_FallbackText, 'public320', 'No reviews / 320')
export const NoReviews375: Story = withViewportStory(Edge_NoReviews_FallbackText, 'public375', 'No reviews / 375')
export const NoReviews640: Story = withViewportStory(Edge_NoReviews_FallbackText, 'public640', 'No reviews / 640')
export const NoReviews768: Story = withViewportStory(Edge_NoReviews_FallbackText, 'public768', 'No reviews / 768')
export const NoReviews1024: Story = withViewportStory(Edge_NoReviews_FallbackText, 'public1024', 'No reviews / 1024')
export const NoReviews1280: Story = withViewportStory(Edge_NoReviews_FallbackText, 'public1280', 'No reviews / 1280')

export const ReviewsPendingText320: Story = withViewportStory(
  Edge_ReviewsPendingText_FallbackText,
  'public320',
  'Reviews pending text / 320',
)
export const ReviewsPendingText375: Story = withViewportStory(
  Edge_ReviewsPendingText_FallbackText,
  'public375',
  'Reviews pending text / 375',
)
export const ReviewsPendingText640: Story = withViewportStory(
  Edge_ReviewsPendingText_FallbackText,
  'public640',
  'Reviews pending text / 640',
)
export const ReviewsPendingText768: Story = withViewportStory(
  Edge_ReviewsPendingText_FallbackText,
  'public768',
  'Reviews pending text / 768',
)
export const ReviewsPendingText1024: Story = withViewportStory(
  Edge_ReviewsPendingText_FallbackText,
  'public1024',
  'Reviews pending text / 1024',
)
export const ReviewsPendingText1280: Story = withViewportStory(
  Edge_ReviewsPendingText_FallbackText,
  'public1280',
  'Reviews pending text / 1280',
)

export const ReviewsPartiallyLoaded320: Story = withViewportStory(
  Edge_ReviewsPartiallyLoaded_CountText,
  'public320',
  'Reviews partially loaded / 320',
)
export const ReviewsPartiallyLoaded375: Story = withViewportStory(
  Edge_ReviewsPartiallyLoaded_CountText,
  'public375',
  'Reviews partially loaded / 375',
)
export const ReviewsPartiallyLoaded640: Story = withViewportStory(
  Edge_ReviewsPartiallyLoaded_CountText,
  'public640',
  'Reviews partially loaded / 640',
)
export const ReviewsPartiallyLoaded768: Story = withViewportStory(
  Edge_ReviewsPartiallyLoaded_CountText,
  'public768',
  'Reviews partially loaded / 768',
)
export const ReviewsPartiallyLoaded1024: Story = withViewportStory(
  Edge_ReviewsPartiallyLoaded_CountText,
  'public1024',
  'Reviews partially loaded / 1024',
)
export const ReviewsPartiallyLoaded1280: Story = withViewportStory(
  Edge_ReviewsPartiallyLoaded_CountText,
  'public1280',
  'Reviews partially loaded / 1280',
)
