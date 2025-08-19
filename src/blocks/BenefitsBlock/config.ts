import { Block } from 'payload'
import type { FieldWithDbName } from './types/dbNameOverride'

export const BenefitsBlock: Block = {
  slug: 'benefitsBlock',
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
          ...({ dbName: 'text_col' } satisfies FieldWithDbName),
        },
        {
          name: 'backgroundColor',
          type: 'select',
          label: 'Hintergrundfarbe',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'bg_col' } satisfies FieldWithDbName),
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
          ...({ dbName: 'img_mode' } satisfies FieldWithDbName),
        },
        {
          name: 'imagePositionNormal',
          type: 'select',
          label: 'Bildposition (bei normal)',
          options: [
            { label: 'Über dem Titel', value: 'above' },
            { label: 'Unter dem Titel', value: 'below' },
          ],
          ...({ dbName: 'img_pos' } satisfies FieldWithDbName),
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
          ...({ dbName: 'bg_pos' } satisfies FieldWithDbName),
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Illustration',
          ...({ dbName: 'img_id' } satisfies FieldWithDbName),
        },

        // Button-Einstellungen
        {
          name: 'showButton',
          type: 'checkbox',
          label: 'Button anzeigen?',
          defaultValue: false,
          ...({ dbName: 'show_btn' } satisfies FieldWithDbName),
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
          ...({ dbName: 'link_type' } satisfies FieldWithDbName),
        },
        {
          name: 'linkText',
          type: 'text',
          label: 'Button-Text',
          ...({ dbName: 'link_text' } satisfies FieldWithDbName),
        },
        {
          name: 'linkTarget',
          type: 'relationship',
          label: 'Verlinkt zu',
          relationTo: ['pages', 'posts'],
          required: false,
          ...({ dbName: 'link_target' } satisfies FieldWithDbName),
        },
        {
          name: 'arrowColor',
          type: 'select',
          label: 'Pfeilfarbe',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'arrow_col' } satisfies FieldWithDbName),
        },
        {
          name: 'arrowBgColor',
          type: 'select',
          label: 'Button-Hintergrundfarbe',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'arrow_bg' } satisfies FieldWithDbName),
        },
      ],
    },
  ],
}
