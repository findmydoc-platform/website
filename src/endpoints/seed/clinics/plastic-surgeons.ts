import { SupportedLanguages } from '../types'

export type Surgeons = {
  firstName: string
  lastName: string
  title: string
  qualifications: string[]
  contact: {
    email: string
    phone: string
  }
  imageUrl: string
  biography: string
  clinicName: string
  languages: SupportedLanguages[]
  experienceYears: number
  rating?: number
}

/**
 * Seed data for plastic surgeons
 */

export const plasticSurgeons: Surgeons[] = [
  {
    firstName: 'Ahmet',
    lastName: 'Yildiz',
    title: 'dr',
    qualifications: ['PhD', 'MD'],
    contact: {
      email: 'ahmet.yildiz@istanbulaestheticcenter.com',
      phone: '+90 212 123 4567',
    },
    imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=1000',
    biography:
      'Dr. Ahmet Yildiz is a renowned plastic surgeon with over 20 years of experience in aesthetic and reconstructive surgery.',
    clinicName: 'Istanbul Aesthetic Center',
    languages: ['turkish', 'english'] as SupportedLanguages[],
    experienceYears: 20,
    rating: 4.8,
  },
  {
    firstName: 'Emine',
    lastName: 'Kaya',
    title: 'prof_dr',
    qualifications: ['BDS'],
    contact: {
      email: 'emine.kaya@estetikinternational.com',
      phone: '+90 212 987 6543',
    },
    imageUrl: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=1000',
    biography:
      'Prof. Dr. Emine Kaya is a leading expert in plastic surgery, specializing in facial and body contouring procedures.',
    clinicName: 'Estetik International',
    languages: ['turkish', 'english'] as SupportedLanguages[],
    experienceYears: 25,
    rating: 4.9,
  },
  {
    firstName: 'Mehmet',
    lastName: 'Demir',
    title: 'prof_dr',
    qualifications: ['MSc', 'Board Certifications'],
    contact: {
      email: 'mehmet.demir@memorial.com.tr',
      phone: '+90 212 345 6789',
    },
    imageUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000',
    biography:
      'PD Dr. Mehmet Demir has extensive experience in plastic surgery, with a focus on minimally invasive techniques.',
    clinicName: 'Memorial Health Group',
    languages: ['turkish', 'english'] as SupportedLanguages[],
    experienceYears: 15,
    rating: 4.7,
  },
]
