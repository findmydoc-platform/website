import { CollectionConfig } from 'payload'
import { countries } from './common/selectionOptions'
import { isoCodes } from './common/selectionOptions'
import { mainLanguages } from './common/selectionOptions'
import { currencyOptions } from './common/selectionOptions'

export const Countries: CollectionConfig = {
  slug: 'countries',
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
      options: mainLanguages,
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
