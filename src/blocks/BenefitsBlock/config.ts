import { Block } from 'payload'

export const BenefitsBlock: Block = {
  slug: 'benefits-block',
  labels: {
    singular: 'Vorteile Block',
    plural: 'Vorteile Blöcke',
  },
  fields: [
    {
      name: 'cards',
      label: 'Vorteils-Karten',
      type: 'array',
      minRows: 1,
      maxRows: 4,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Titel',
        },
        {
          name: 'subtitle',
          type: 'text',
          label: 'Untertitel',
        },
        {
          name: 'textColor',
          type: 'select',
          label: 'Textfarbe',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'text_col' } as any),
        },
        {
          name: 'backgroundColor',
          type: 'select',
          label: 'Hintergrundfarbe',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'bg_col' } as any),
        },

        // Bild-Einstellungen
        {
          name: 'imageMode',
          type: 'select',
          label: 'Bild-Darstellung',
          options: [
            { label: 'Im Hintergrund', value: 'background' },
            { label: 'Normal', value: 'normal' },
          ],
          defaultValue: 'background',
          ...({ dbName: 'img_mode' } as any),
        },
        {
          name: 'imagePositionNormal',
          type: 'select',
          label: 'Bildposition (bei normal)',
          options: [
            { label: 'Über dem Titel', value: 'above' },
            { label: 'Unter dem Titel', value: 'below' },
          ],
          ...({ dbName: 'img_pos' } as any),
        },
        {
          name: 'imagePositionBackground',
          type: 'select',
          label: 'Bildposition (bei Hintergrund)',
          options: [
            { label: 'Mitte', value: 'center' },
            { label: 'Unten rechts', value: 'bottom-right' },
            { label: 'Unten links', value: 'bottom-left' },
            { label: 'Oben rechts', value: 'top-right' },
            { label: 'Oben links', value: 'top-left' },
          ],
          ...({ dbName: 'bg_pos' } as any),
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Illustration',
          ...({ dbName: 'img_id' } as any),
        },

        // Button-Einstellungen
        {
          name: 'showButton',
          type: 'checkbox',
          label: 'Button anzeigen?',
          defaultValue: false,
          ...({ dbName: 'show_btn' } as any),
        },
        {
          name: 'linkType',
          type: 'select',
          label: 'Button-Typ',
          options: [
            { label: 'Pfeil', value: 'arrow' },
            { label: 'Text', value: 'text' },
          ],
          defaultValue: 'arrow',
          ...({ dbName: 'link_type' } as any),
        },
        {
          name: 'linkText',
          type: 'text',
          label: 'Button-Text',
          ...({ dbName: 'link_text' } as any),
        },
        {
          name: 'linkTarget',
          type: 'relationship',
          label: 'Verlinkt zu',
          relationTo: ['pages', 'posts'],
          required: false,
          ...({ dbName: 'link_target' } as any),
        },
        {
          name: 'arrowColor',
          type: 'select',
          label: 'Pfeilfarbe',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'arrow_col' } as any),
        },
        {
          name: 'arrowBgColor',
          type: 'select',
          label: 'Button-Hintergrundfarbe',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'arrow_bg' } as any),
        },
      ],
    },
  ],
}
