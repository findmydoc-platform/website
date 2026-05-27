import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { fields as formFields } from '@/blocks/Form/fields'
import { Form, type FormConfig, type FormProps } from '@/components/organisms/Form'

const meta = {
  title: 'Shared/Organisms/Form',
  component: Form,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Dynamic form builder that renders fields from configuration and delegates submission state to the parent adapter.',
      },
    },
  },
  tags: ['autodocs', 'domain:shared', 'layer:organism', 'status:stable', 'used-in:block:form'],
} satisfies Meta<typeof Form>

export default meta

type Story = StoryObj<typeof meta>

const getRequiredField = (canvas: ReturnType<typeof within>, label: string) => canvas.getByLabelText(new RegExp(label))

const renderSuccessfulSubmissionStory = (args: Story['args']) => {
  const resolvedArgs = args as FormProps
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasSubmitted, setHasSubmitted] = React.useState(false)
  const [error, setError] = React.useState<FormProps['error']>(undefined)

  return (
    <Form
      {...resolvedArgs}
      isLoading={isLoading}
      hasSubmitted={hasSubmitted}
      error={error}
      onSubmit={async () => {
        setError(undefined)
        setIsLoading(true)
        await new Promise((resolve) => {
          window.setTimeout(resolve, 50)
        })
        setIsLoading(false)
        setHasSubmitted(true)
      }}
    />
  )
}

const sampleForm: FormConfig = {
  id: 'sample-form',
  fields: [
    {
      name: 'name',
      label: 'Full Name',
      blockType: 'text',
      required: true,
      width: 50,
    },
    {
      name: 'email',
      label: 'Email Address',
      blockType: 'email',
      required: true,
      width: 50,
    },
    {
      name: 'message',
      label: 'Message',
      blockType: 'textarea',
      required: true,
      width: 100,
    },
  ],
  submitButtonLabel: 'Submit',
  confirmationType: 'message',
  redirect: undefined,
}

const storyFormFields = formFields as unknown as FormProps['fields']

export const Default: Story = {
  args: {
    form: sampleForm,
    enableIntro: true,
    introContent: (
      <div className="prose">
        <p>findmydoc connects patients with trusted clinics across specialties.</p>
      </div>
    ),
    confirmationMessage: (
      <div className="prose">
        <p>Thank you for your submission!</p>
      </div>
    ),
    fields: storyFormFields,
  },
}

export const WithoutIntro: Story = {
  args: {
    form: sampleForm,
    enableIntro: false,
    fields: storyFormFields,
  },
}

export const SecondaryButton: Story = {
  args: {
    form: sampleForm,
    enableIntro: false,
    background: 'secondary',
    fields: storyFormFields,
  },
}

export const SuccessfulSubmission: Story = {
  args: {
    form: sampleForm,
    enableIntro: true,
    introContent: (
      <div className="prose">
        <p>findmydoc connects patients with trusted clinics across specialties.</p>
      </div>
    ),
    confirmationMessage: (
      <div className="prose">
        <p>Thank you for your submission!</p>
      </div>
    ),
    fields: storyFormFields,
  },
  render: renderSuccessfulSubmissionStory,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(getRequiredField(canvas, 'Full Name'), 'Ada Lovelace')
    await userEvent.type(getRequiredField(canvas, 'Email Address'), 'ada@example.com')
    await userEvent.type(getRequiredField(canvas, 'Message'), 'Please tell me more.')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(canvas.getByText('Thank you for your submission!')).toBeInTheDocument()
    })
  },
}

export const ValidationAndSubmit: Story = {
  args: SuccessfulSubmission.args,
  render: renderSuccessfulSubmissionStory,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(canvas.getAllByRole('alert')[0]).toHaveTextContent('This field is required.')
    })

    await userEvent.type(getRequiredField(canvas, 'Full Name'), 'Ada Lovelace')
    await userEvent.type(getRequiredField(canvas, 'Email Address'), 'ada@example.com')
    await userEvent.type(getRequiredField(canvas, 'Message'), 'Please tell me more.')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(canvas.getByText('Thank you for your submission!')).toBeInTheDocument()
    })
  },
}
