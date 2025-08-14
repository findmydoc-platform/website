import type { Block } from 'payload'
import { FormBlock } from '../Form/config'
import { MediaBlock } from '../MediaBlock/config'
import { Content } from '../Content/config'

export const LayoutBlock: Block = {
  slug: 'layout-block',
  interfaceName: 'LayoutBlock',
  fields: [
    {
      name: 'background',
      type: 'select',
      options: ['primary', 'secondary', 'accent', 'accent-2'],
      defaultValue: 'primary',
      required: true,
    },
    {
      name: 'width',
      type: 'select',
      options: ['full', 'two-thirds', 'half', 'third'],
      defaultValue: 'full',
      required: true,
    },
    {
      name: 'accent',
      type: 'select',
      label: 'Akzent (Ecken-Stil)',
      options: [
        { label: 'Keine', value: 'none' },
        { label: 'Links', value: 'left' },
        { label: 'Rechts', value: 'right' },
      ],
      defaultValue: 'none',
      required: true,
    },
    {
      name: 'content',
      type: 'blocks',
      label: 'Inhalt',
      blocks: [MediaBlock, FormBlock, Content],
    },
  ],
}
