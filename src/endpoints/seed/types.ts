export interface ClinicData {
  name: string
  foundingYear: number
  country: string
  city: string
  street: string
  zipCode: string
  contact: {
    email: string
    phone: string
    website?: string
  }
  imageUrl: string
  active: boolean
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
  active: boolean
}

export interface ClinicDoc {
  id: string
  name: string
  foundingYear: number
  country: string
  city: string
  street: string
  zipCode: string
  contact: {
    email: string
    phone: string
    website?: string
  }
  thumbnail: string // Media ID
  assignedDoctors?: string[] // Doctor IDs
  active: boolean
  slug: string
}

export interface DoctorDoc {
  fullName: string
  title: string
  clinic: string // Clinic ID
  specialization: string
  contact: {
    email: string
    phone: string
  }
  image: string // Media ID
  biography: string
  active: boolean
}
