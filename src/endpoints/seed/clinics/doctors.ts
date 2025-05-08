import { SupportedLanguages } from '../types'

export type Doctors = {
  firstName: string
  lastName: string
  fullName: string
  title: 'dr' | 'specialist' | 'surgeon' | 'assoc_prof' | 'prof_dr'
  qualifications: string[]
  imageUrl: string
  biography: string
  clinicName: string
  languages: SupportedLanguages[]
  experienceYears: number
  rating: number
}

/**
 * Seed data for plastic surgeons
 */

export const doctors: Doctors[] = [
  {
    firstName: 'Ahmet',
    lastName: 'Yildiz',
    fullName: 'Dr. Ahmet Yildiz',
    title: 'dr',
    qualifications: ['PhD'],
    imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=1000',
    biography:
      'Dr. Ahmet Yildiz is a renowned plastic surgeon with over 20 years of experience in aesthetic and reconstructive surgery.',
    clinicName: 'Istanbul Aesthetic Center',
    languages: ['turkish', 'english'] as SupportedLanguages[],
    experienceYears: 10,
    rating: 4.8,
  },
  {
    firstName: 'Emine',
    lastName: 'Kaya',
    fullName: 'Prof. Dr. Emine Kaya',
    title: 'dr',
    qualifications: ['MD'],
    imageUrl: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=1000',
    biography:
      'Prof. Dr. Emine Kaya is a leading expert in plastic surgery, specializing in facial and body contouring procedures.',
    clinicName: 'Estetik International',
    languages: ['turkish', 'english'] as SupportedLanguages[],
    experienceYears: 13,
    rating: 4.9,
  },
  {
    firstName: 'Mehmet',
    lastName: 'Demir',
    fullName: 'PD Dr. Mehmet Demir',
    title: 'dr',
    qualifications: ['PhD'],
    imageUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000',
    biography:
      'PD Dr. Mehmet Demir has extensive experience in plastic surgery, with a focus on minimally invasive techniques.',
    clinicName: 'Memorial Health Group',
    languages: ['turkish', 'english'] as SupportedLanguages[],
    experienceYears: 7,
    rating: 4.7,
  },
]
