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
        label: 'Bild',
        type: 'upload',
        relationTo: 'media',
        admin: {
          width: '50%',
          description: 'Optionales Bild für diese Spalte. Alt-Text wird aus der Media-Collection übernommen.',
        },
      },
      {
        name: 'imagePosition',
        label: 'Bild-Position',
        type: 'select',
        defaultValue: 'top',
        options: [
          { label: 'Oben', value: 'top' },
          { label: 'Links', value: 'left' },
          { label: 'Rechts', value: 'right' },
          { label: 'Unten', value: 'bottom' },
        ],
        admin: { width: '25%' },
      },
      {
        name: 'imageSize',
        label: 'Bild-Größe',
        type: 'select',
        defaultValue: 'content',
        options: [
          { label: 'Inhalt (Standard)', value: 'content' },
          { label: 'Breit', value: 'wide' },
          { label: 'Vollbreite (Spaltenbreite)', value: 'full' },
        ],
        admin: { width: '25%' },
      },
    ],
  },
  {
    name: 'caption',
    label: 'Bildunterschrift',
    type: 'text',
  },
  {
    name: 'enableLink',
    type: 'checkbox',
    label: 'Link anzeigen',
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
