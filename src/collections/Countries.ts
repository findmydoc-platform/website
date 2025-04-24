import { CollectionConfig } from 'payload'
import { countries, languageOptions, isoCodes, currencyOptions } from './common/selectionOptions'

export const Country: CollectionConfig = {
  slug: 'country',
  admin: {
    useAsTitle: 'countryName',
    defaultColumns: ['countryName', 'isoCode'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'countryName',
      type: 'select',
      options: countries,
      required: true,
      hasMany: false,
    },
    {
      name: 'isoCode',
      type: 'select',
      options: isoCodes,
      required: true,
      hasMany: false,
    },
    {
      name: 'mainLanguage',
      type: 'select',
      options: languageOptions,
      required: true,
    },
    {
      name: 'mainCurrency',
      type: 'select',
      options: currencyOptions,
      required: true,
      hasMany: false,
    },
  ],
}
