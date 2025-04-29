/**
 * Factory function to create a doctor data object for seeding
 */
export function createDoctorData({
  firstName,
  lastName,
  fullName,
  title,
  clinic,
  qualifications,
  contact,
  image,
  biography,
  rating,
  experienceYears,
  languages,
}: {
  firstName: string
  lastName: string
  fullName: string
  title: string
  clinic: any
  qualifications: string
  contact: { email: string; phone: string }
  image: any
  biography: string
  rating?: number
  experienceYears?: number
  languages?: string[]
}) {
  return {
    firstName,
    lastName,
    fullName,
    title,
    clinic: clinic.id,
    qualifications,
    contact,
    image: image.id,
    biography,
    languages,
    experienceYears,
    rating,
  }
}
