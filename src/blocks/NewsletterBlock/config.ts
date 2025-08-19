import type { Block } from 'payload'

export const NewsletterBlock: Block = {
  slug: 'newsletterBlock',
  interfaceName: 'NewsletterBlock',
  fields: [
    {
      name: 'fullWidth',
      type: 'checkbox',
      label: 'Hintergrund über volle Breite (Full‑bleed)',
      defaultValue: false,
    },
    {
      name: 'background',
      type: 'select',
      required: true,
      defaultValue: 'primary',
      options: [
        { label: 'Primärfarbe', value: 'primary' },
        { label: 'Sekundärfarbe', value: 'secondary' },
        { label: 'Akzent 1', value: 'accent' },
        { label: 'Akzent 2', value: 'accent-2' },
      ],
    },
    {
      name: 'textcolor',
      type: 'select',
      required: true,
      defaultValue: 'accent',
      options: [
        { label: 'Primärfarbe (Text)', value: 'primary' },
        { label: 'Sekundärfarbe (Text)', value: 'secondary' },
        { label: 'Akzent 1 (Text)', value: 'accent' },
        { label: 'Akzent 2 (Text)', value: 'accent-2' },
      ],
    },
    {
      name: 'text',
      type: 'richText',
      label: 'Textblock',
      required: true,
    },
    {
      name: 'form',
      label: 'Formular auswählen',
      type: 'relationship',
      relationTo: 'forms',
      required: true,
    },
  ],
}
