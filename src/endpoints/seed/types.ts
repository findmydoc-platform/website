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

export type clinicStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export interface ClinicData {
  name: string
  address: {
    street: string
    houseNumber: string
    zipCode: number
    country: string
    city: number
  }
  contact: {
    email: string
    phoneNumber: string
    website?: string
  }
  imageUrl: string
  supportedLanguages: SupportedLanguages[]
  status: clinicStatus
}

export interface DoctorData {
  firstName: string
  lastName: string
  fullName: string
  title: 'dr' | 'specialist' | 'surgeon' | 'assoc_prof' | 'prof_dr'
  clinicName: string
  imageUrl: string
  biography: string
  languages: SupportedLanguages[]
  qualifications: string[]
  experienceYears: number
  rating: number
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
