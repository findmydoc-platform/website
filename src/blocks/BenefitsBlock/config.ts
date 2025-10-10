import { Block } from 'payload'
import type { FieldWithDbName } from './types/dbNameOverride'

export const BenefitsBlock: Block = {
  slug: 'benefitsBlock',
  labels: {
    singular: 'Benefits Block',
    plural: 'Benefits Blocks',
  },
  fields: [
    {
      name: 'cards',
      label: 'Benefit Cards',
      type: 'array',
      minRows: 1,
      maxRows: 4,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Title',
        },
        {
          name: 'subtitle',
          type: 'text',
          label: 'Subtitle',
        },
        {
          name: 'textColor',
          type: 'select',
          label: 'Text Color',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'text_col' } satisfies FieldWithDbName),
        },
        {
          name: 'backgroundColor',
          type: 'select',
          label: 'Background Color',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'bg_col' } satisfies FieldWithDbName),
        },

        // Image Settings
        {
          name: 'imageMode',
          type: 'select',
          label: 'Image Display',
          options: [
            { label: 'As Background', value: 'background' },
            { label: 'Normal', value: 'normal' },
          ],
          defaultValue: 'background',
          ...({ dbName: 'img_mode' } satisfies FieldWithDbName),
        },
        {
          name: 'imagePositionNormal',
          type: 'select',
          label: 'Image Position (normal mode)',
          options: [
            { label: 'Above Title', value: 'above' },
            { label: 'Below Title', value: 'below' },
          ],
          ...({ dbName: 'img_pos' } satisfies FieldWithDbName),
        },
        {
          name: 'imagePositionBackground',
          type: 'select',
          label: 'Image Position (background mode)',
          options: [
            { label: 'Center', value: 'center' },
            { label: 'Bottom Right', value: 'bottom-right' },
            { label: 'Bottom Left', value: 'bottom-left' },
            { label: 'Top Right', value: 'top-right' },
            { label: 'Top Left', value: 'top-left' },
          ],
          ...({ dbName: 'bg_pos' } satisfies FieldWithDbName),
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'platformContentMedia',
          label: 'Illustration',
          ...({ dbName: 'img_id' } satisfies FieldWithDbName),
        },

        // Button Settings
        {
          name: 'showButton',
          type: 'checkbox',
          label: 'Show Button?',
          defaultValue: false,
          ...({ dbName: 'show_btn' } satisfies FieldWithDbName),
        },
        {
          name: 'linkType',
          type: 'select',
          label: 'Button Type',
          options: [
            { label: 'Arrow', value: 'arrow' },
            { label: 'Text', value: 'text' },
          ],
          defaultValue: 'arrow',
          ...({ dbName: 'link_type' } satisfies FieldWithDbName),
        },
        {
          name: 'linkText',
          type: 'text',
          label: 'Button Text',
          ...({ dbName: 'link_text' } satisfies FieldWithDbName),
        },
        {
          name: 'linkTarget',
          type: 'relationship',
          label: 'Link Target',
          relationTo: ['pages', 'posts'],
          required: false,
          ...({ dbName: 'link_target' } satisfies FieldWithDbName),
        },
        {
          name: 'arrowColor',
          type: 'select',
          label: 'Arrow Color',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'arrow_col' } satisfies FieldWithDbName),
        },
        {
          name: 'arrowBgColor',
          type: 'select',
          label: 'Button Background Color',
          options: ['primary', 'secondary', 'accent', 'accent-2'],
          defaultValue: 'primary',
          ...({ dbName: 'arrow_bg' } satisfies FieldWithDbName),
        },
      ],
    },
  ],
}
