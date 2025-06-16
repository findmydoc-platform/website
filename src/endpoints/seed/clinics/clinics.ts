/**
 * Seed data for clinics
 */

import { SupportedLanguages, Countries, ClinicData, clinicStatus } from '../types'

export const clinics: ClinicData[] = [
  {
    name: 'Istanbul Aesthetic Center',
    address: {
      street: 'Bağdat Caddesi',
      houseNumber: '123',
      zipCode: 34728,
      country: 'türkiye' as Countries,
      city: 0,
    },
    contact: {
      email: 'info@istanbulaestheticcenter.com',
      phoneNumber: '+90 212 123 4567',
      website: 'https://www.istanbulaestheticcenter.com',
    },
    imageUrl: 'https://images.unsplash.com/photo-1504439468489-c8920d796a29?q=80&w=1000',
    supportedLanguages: ['english', 'turkish', 'german'] as SupportedLanguages[],
    status: 'approved' as clinicStatus,
  },
  {
    name: 'Estetik International',
    address: {
      street: 'Nispetiye Caddesi',
      houseNumber: '48',
      zipCode: 34340,
      country: 'türkiye' as Countries,
      city: 0,
    },
    contact: {
      email: 'info@estetikinternational.com',
      phoneNumber: '+90 212 987 6543',
      website: 'https://www.estetikinternational.com',
    },
    imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=1000',
    status: 'pending' as clinicStatus,
    supportedLanguages: ['english', 'turkish', 'french'] as SupportedLanguages[],
  },
  {
    name: 'Memorial Health Group',
    address: {
      street: 'Piyalepaşa Bulvarı',
      houseNumber: '74',
      zipCode: 34384,
      country: 'türkiye' as Countries,
      city: 0,
    },
    contact: {
      email: 'info@memorial.com.tr',
      phoneNumber: '+90 212 345 6789',
      website: 'https://www.memorial.com.tr',
    },
    imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1000',
    status: 'approved' as clinicStatus,
    supportedLanguages: ['english', 'turkish', 'arabic'] as SupportedLanguages[],
  },
]
