import { CollectionConfig } from 'payload'

export const Languages: CollectionConfig = {
  slug: 'languages',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'code', 'isActive'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'select',
      required: true,
      options: [
        { label: 'English', value: 'English' },
        { label: 'German', value: 'German' },
        { label: 'French', value: 'French' },
        { label: 'Spanish', value: 'Spanish' },
        { label: 'Italian', value: 'Italian' },
        { label: 'Dutch', value: 'Dutch' },
        { label: 'Portuguese', value: 'Portuguese' },
        { label: 'Russian', value: 'Russian' },
        { label: 'Chinese', value: 'Chinese' },
        { label: 'Japanese', value: 'Japanese' },
        { label: 'Arabic', value: 'Arabic' },
        { label: 'Turkish', value: 'Turkish' },
      ],
      admin: {
        description: 'Select the language',
      },
    },
    {
      name: 'code',
      type: 'select',
      required: true,
      options: [
        { label: 'en', value: 'en' },
        { label: 'de', value: 'de' },
        { label: 'fr', value: 'fr' },
        { label: 'es', value: 'es' },
        { label: 'it', value: 'it' },
        { label: 'nl', value: 'nl' },
        { label: 'pt', value: 'pt' },
        { label: 'ru', value: 'ru' },
        { label: 'zh', value: 'zh' },
        { label: 'ja', value: 'ja' },
        { label: 'ar', value: 'ar' },
        { label: 'tr', value: 'tr' },
      ],
      admin: {
        description: 'Select the ISO language code',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  timestamps: true,
}
