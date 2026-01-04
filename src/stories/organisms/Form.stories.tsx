import type { Meta, StoryObj } from '@storybook/react-vite'
import { Form, type FormConfig } from '@/components/organisms/Form'
import { withMockRouter } from '../utils/routerDecorator'
import type { UseFormRegister } from 'react-hook-form'

const meta = {
  title: 'Organisms/Form',
  component: Form,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Form>

export default meta

type Story = StoryObj<typeof meta>

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
      <label className="text-sm font-medium">{label}</label>
      <input
        {...register(name, { required })}
        className="rounded-md border border-input bg-background px-3 py-2"
        type="text"
      />
    </div>
  ),
  email: ({ label, register, name, required }: MockFieldProps) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <input
        {...register(name, { required })}
        className="rounded-md border border-input bg-background px-3 py-2"
        type="email"
      />
    </div>
  ),
  textarea: ({ label, register, name, required }: MockFieldProps) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <textarea
        {...register(name, { required })}
        className="rounded-md border border-input bg-background px-3 py-2"
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
