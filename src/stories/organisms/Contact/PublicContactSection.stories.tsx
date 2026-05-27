import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { PublicContactSection } from '@/components/organisms/Contact'
import { withViewportStory } from '../../utils/viewportMatrix'

const submitContact = fn(async () => undefined)

const meta = {
  title: 'Domain/Contact/Organisms/PublicContactSection',
  component: PublicContactSection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:contact', 'layer:organism', 'status:stable', 'used-in:route:/contact'],
  args: {
    onSubmitContact: submitContact,
    title: 'Contact',
    description: 'Reach out to learn how we can help your clinic grow.',
    submissionMetadata: {
      source: 'storybook',
    },
  },
} satisfies Meta<typeof PublicContactSection>

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

export const PartnerLandingContext: Story = {
  args: {
    formContext: 'clinic_partner_landing',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const onSubmitContact = args.onSubmitContact

    await userEvent.type(canvas.getByLabelText('Name'), 'Alex Morgan')
    await userEvent.type(canvas.getByLabelText('Email'), 'alex@findmydoc.com')
    await userEvent.type(canvas.getByLabelText('Message'), 'I would like to discuss partnership options.')

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(onSubmitContact).toHaveBeenCalledWith(
        'public-contact',
        {
          source: 'storybook',
          form_context: 'clinic_partner_landing',
          name: 'Alex Morgan',
          email: 'alex@findmydoc.com',
          message: 'I would like to discuss partnership options.',
        },
        'Could not send your request right now.',
      )
    })
  },
}

const validationAndSubmitBase: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const onSubmitContact = args.onSubmitContact

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(canvas.getByText('Name is required.')).toBeInTheDocument()
    })

    await userEvent.type(canvas.getByLabelText('Name'), 'Alex Morgan')
    await userEvent.type(canvas.getByLabelText('Email'), 'alex@findmydoc.com')
    await userEvent.type(
      canvas.getByLabelText('Message'),
      'I would like to discuss partnership options for our clinic.',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(onSubmitContact).toHaveBeenCalledWith(
        'public-contact',
        {
          source: 'storybook',
          name: 'Alex Morgan',
          email: 'alex@findmydoc.com',
          message: 'I would like to discuss partnership options for our clinic.',
        },
        'Could not send your request right now.',
      )
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
