import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import { Form, type FormConfig, type FormProps } from '@/components/organisms/Form'
import type { UseFormRegister } from 'react-hook-form'

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

// Mock fields components for Storybook
type MockFieldProps = {
  label?: string
  name: string
  required?: boolean
  register: UseFormRegister<Record<string, unknown>>
} & Record<string, unknown>

const mockFields = {
  text: ({ label, register, name, required }: MockFieldProps) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        {...register(name, { required })}
        className="rounded-md border border-input bg-background px-3 py-2"
        id={name}
        type="text"
      />
    </div>
  ),
  email: ({ label, register, name, required }: MockFieldProps) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        {...register(name, { required })}
        className="rounded-md border border-input bg-background px-3 py-2"
        id={name}
        type="email"
      />
    </div>
  ),
  textarea: ({ label, register, name, required }: MockFieldProps) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <textarea
        {...register(name, { required })}
        className="rounded-md border border-input bg-background px-3 py-2"
        id={name}
        rows={4}
      />
    </div>
  ),
}

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
    fields: mockFields,
  },
}

export const WithoutIntro: Story = {
  args: {
    form: sampleForm,
    enableIntro: false,
    fields: mockFields,
  },
}

export const SecondaryButton: Story = {
  args: {
    form: sampleForm,
    enableIntro: false,
    background: 'secondary',
    fields: mockFields,
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
    fields: mockFields,
  },
  render: renderSuccessfulSubmissionStory,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Full Name'), 'Ada Lovelace')
    await userEvent.type(canvas.getByLabelText('Email Address'), 'ada@example.com')
    await userEvent.type(canvas.getByLabelText('Message'), 'Please tell me more.')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(canvas.getByText('Thank you for your submission!')).toBeInTheDocument()
    })
  },
}
