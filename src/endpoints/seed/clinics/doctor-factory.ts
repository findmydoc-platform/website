/**
 * Factory function to create a doctor data object for seeding
 */
export function createDoctorData({
  fullName,
  title,
  clinic,
  specialization,
  contact,
  image,
  biography,
  active = true,
}: {
  fullName: string
  title: string
  clinic: any
  specialization: string
  contact: { email: string; phone: string }
  image: any
  biography: string
  active?: boolean
}) {
  return {
    fullName,
    title,
    clinic: clinic.id,
    specialization,
    contact,
    image: image.id,
    biography,
    active,
  }
}
