import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

import { LandingContact } from '@/components/organisms/Landing'
import { createMockFetchDecorator } from '../../utils/fetchDecorator'
import { createDelayedJsonResponse } from '../../utils/mockHelpers'
import { withViewportStory } from '../../utils/viewportMatrix'

const mockFetch: typeof fetch = async () => createDelayedJsonResponse({ success: true })

const meta = {
  title: 'Domain/Landing/Organisms/LandingContact',
  component: LandingContact,
  decorators: [createMockFetchDecorator(mockFetch)],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-contact'],
  args: {
    title: 'Contact',
    description: 'Reach out to learn how we can help your clinic grow.',
  },
} satisfies Meta<typeof LandingContact>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText('Name')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Email')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Message')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeInTheDocument()
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')

const validationAndSubmitBase: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(canvas.getByText('Email is required.')).toBeInTheDocument()
    })

    await userEvent.type(canvas.getByLabelText('Name'), 'Alex Morgan')
    await userEvent.type(canvas.getByLabelText('Email'), 'alex@findmydoc.com')
    await userEvent.type(
      canvas.getByLabelText('Message'),
      'I would like to discuss partnership options for our clinic.',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(canvas.getByText('Your request has been sent successfully.')).toBeInTheDocument()
    })
  },
}

export const ValidationAndSubmit320: Story = withViewportStory(
  validationAndSubmitBase,
  'public320',
  'Validation and submit / 320',
)
export const ValidationAndSubmit375: Story = withViewportStory(
  validationAndSubmitBase,
  'public375',
  'Validation and submit / 375',
)
export const ValidationAndSubmit640: Story = withViewportStory(
  validationAndSubmitBase,
  'public640',
  'Validation and submit / 640',
)
export const ValidationAndSubmit768: Story = withViewportStory(
  validationAndSubmitBase,
  'public768',
  'Validation and submit / 768',
)
export const ValidationAndSubmit1024: Story = withViewportStory(
  validationAndSubmitBase,
  'public1024',
  'Validation and submit / 1024',
)
export const ValidationAndSubmit1280: Story = withViewportStory(
  validationAndSubmitBase,
  'public1280',
  'Validation and submit / 1280',
)
export const ValidationAndSubmit320Short: Story = withViewportStory(
  validationAndSubmitBase,
  'public320Short',
  'Validation and submit / 320 short',
)
export const ValidationAndSubmit375Short: Story = withViewportStory(
  validationAndSubmitBase,
  'public375Short',
  'Validation and submit / 375 short',
)
