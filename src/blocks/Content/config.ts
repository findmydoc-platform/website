import type { Block, Field } from 'payload'
import { FixedToolbarFeature, HeadingFeature, InlineToolbarFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { link } from '@/fields/link'

const columnFields: Field[] = [
  {
    name: 'size',
    type: 'select',
    defaultValue: 'oneThird',
    options: [
      { label: 'One Third', value: 'oneThird' },
      { label: 'Half', value: 'half' },
      { label: 'Two Thirds', value: 'twoThirds' },
      { label: 'Full', value: 'full' },
    ],
    admin: { width: '25%' },
  },
  {
    name: 'richText',
    type: 'richText',
    editor: lexicalEditor({
      features: ({ rootFeatures }) => [
        ...rootFeatures,
        HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
        FixedToolbarFeature(),
        InlineToolbarFeature(),
      ],
    }),
    label: false,
  },
  {
    type: 'row',
    fields: [
      {
        name: 'image',
        label: 'Image',
        type: 'upload',
        relationTo: 'platformContentMedia',
        admin: {
          width: '50%',
          description: 'Optional image for this column. Alt text is inherited from the Media collection.',
        },
      },
      {
        name: 'imagePosition',
        label: 'Image Position',
        type: 'select',
        defaultValue: 'top',
        options: [
          { label: 'Top', value: 'top' },
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
          { label: 'Bottom', value: 'bottom' },
        ],
        admin: { width: '25%' },
      },
      {
        name: 'imageSize',
        label: 'Image Size',
        type: 'select',
        defaultValue: 'content',
        options: [
          { label: 'Content (Default)', value: 'content' },
          { label: 'Wide', value: 'wide' },
          { label: 'Full Width (Column Width)', value: 'full' },
        ],
        admin: { width: '25%' },
      },
    ],
  },
  {
    name: 'caption',
    label: 'Image Caption',
    type: 'text',
  },
  {
    name: 'enableLink',
    type: 'checkbox',
    label: 'Show Link',
  },
  link({
    overrides: {
      admin: {
        condition: (_data, siblingData) => Boolean(siblingData?.enableLink),
      },
    },
  }),
]

export const Content: Block = {
  slug: 'content',
  interfaceName: 'ContentBlock',
  labels: {
    singular: 'Content',
    plural: 'Contents',
  },
  fields: [
    {
      name: 'columns',
      type: 'array',
      admin: { initCollapsed: true },
      fields: columnFields,
    },
  ],
}
