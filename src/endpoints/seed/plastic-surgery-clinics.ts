/**
 * Seed data for plastic surgery clinics
 */

import { SupportedLanguages, Countries } from './types'

export const plasticSurgeryClinics = [
  {
    name: 'Istanbul Aesthetic Center',
    foundingYear: 2005,
    country: 'türkiye' as Countries,
    city: 'Istanbul',
    street: 'Bağdat Caddesi 123',
    zipCode: '34728',
    contact: {
      email: 'info@istanbulaestheticcenter.com',
      phone: '+90 212 123 4567',
      website: 'https://www.istanbulaestheticcenter.com',
    },
    imageUrl: 'https://images.unsplash.com/photo-1504439468489-c8920d796a29?q=80&w=1000',
    active: true,
    supportedLanguages: ['english', 'turkish', 'german'] as SupportedLanguages[],
  },
  {
    name: 'Estetik International',
    foundingYear: 1999,
    country: 'türkiye' as Countries,
    city: 'Istanbul',
    street: 'Nispetiye Caddesi 48',
    zipCode: '34340',
    contact: {
      email: 'info@estetikinternational.com',
      phone: '+90 212 987 6543',
      website: 'https://www.estetikinternational.com',
    },
    imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=1000',
    active: true,
    supportedLanguages: ['english', 'turkish', 'french'] as SupportedLanguages[],
  },
  {
    name: 'Memorial Health Group',
    foundingYear: 2000,
    country: 'türkiye' as Countries,
    city: 'Istanbul',
    street: 'Piyalepaşa Bulvarı 74',
    zipCode: '34384',
    contact: {
      email: 'info@memorial.com.tr',
      phone: '+90 212 345 6789',
      website: 'https://www.memorial.com.tr',
    },
    imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1000',
    active: true,
    supportedLanguages: ['english', 'turkish', 'arabic'] as SupportedLanguages[],
  },
]
