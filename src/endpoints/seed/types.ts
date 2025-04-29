import { Country } from '@/payload-types'

export type SupportedLanguages =
  | 'german'
  | 'english'
  | 'french'
  | 'spanish'
  | 'italian'
  | 'turkish'
  | 'russian'
  | 'arabic'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'portuguese'

export type Countries =
  | 'germany'
  | 'united-states'
  | 'united-kingdom'
  | 'france'
  | 'spain'
  | 'italy'
  | 'türkiye'
  | 'russia'
  | 'china'
  | 'japan'
  | 'south-korea'
  | 'portugal'

export interface ClinicData {
  name: string
  address: {
    street: string
    houseNumber: string
    zipCode: number
    countryName: string
    cityName: string
  }
  contact: {
    email: string
    phoneNumber: string
    website?: string
  }
  imageUrl: string
  active: boolean
  supportedLanguages: SupportedLanguages[]
}

export interface DoctorData {
  fullName: string
  title: 'dr_med' | 'prof_dr_med' | 'pd_dr_med'
  clinicName: string
  specialization: 'orthopedics' | 'sports_medicine' | 'surgery' | 'physiotherapy'
  contact: {
    email: string
    phone: string
  }
  imageUrl: string
  biography: string
  languages: SupportedLanguages[]
  active: boolean
}

export interface CountryData {
  name: string
  isoCode: string
  language: SupportedLanguages
  currency: string
}

export interface CityData {
  name: string
  airportCode: string
  country: Country
  coordinates: [number, number]
}
