import type { Block } from 'payload'

export const NewsletterBlock: Block = {
  slug: 'newsletterBlock',
  interfaceName: 'NewsletterBlock',
  fields: [
    {
      name: 'fullWidth',
      type: 'checkbox',
      label: 'Full-width Background (Full-bleed)',
      defaultValue: false,
    },
    {
      name: 'background',
      type: 'select',
      required: true,
      defaultValue: 'primary',
      options: [
        { label: 'Primary Color', value: 'primary' },
        { label: 'Secondary Color', value: 'secondary' },
        { label: 'Accent 1', value: 'accent' },
        { label: 'Accent 2', value: 'accent-2' },
      ],
    },
    {
      name: 'textcolor',
      type: 'select',
      required: true,
      defaultValue: 'accent',
      options: [
        { label: 'Primary Color (Text)', value: 'primary' },
        { label: 'Secondary Color (Text)', value: 'secondary' },
        { label: 'Accent 1 (Text)', value: 'accent' },
        { label: 'Accent 2 (Text)', value: 'accent-2' },
      ],
    },
    {
      name: 'text',
      type: 'richText',
      label: 'Text Block',
      required: true,
    },
    {
      name: 'form',
      label: 'Select Form',
      type: 'relationship',
      relationTo: 'forms',
      required: true,
    },
  ],
}
