import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Form } from '@/components/organisms/Form'
import { sampleRichText } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'
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

const sampleForm: FormType = {
  id: 'sample-form',
  title: 'Contact Form',
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
  confirmationMessage: {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: 'Thank you for your submission!',
              type: 'text',
              version: 1,
            },
          ],
        },
      ],
    },
  },
  redirect: undefined,
  emails: [],
} as FormType

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
    introContent: sampleRichText,
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
