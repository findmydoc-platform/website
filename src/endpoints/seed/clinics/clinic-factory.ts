/**
 * Factory function to create a clinic data object for seeding
 */
export function createClinicData({
  name,
  thumbnail,
  assignedDoctors = [],
}: {
  name: string
  thumbnail: any
  assignedDoctors?: any[]
}) {
  return {
    name,
    thumbnail: thumbnail.id,
    assignedDoctors: assignedDoctors.map((doctor) => doctor.id),
    active: true,
  }
}

/**
 * Helper function to create slug from clinic name
 */
export function createClinicSlug(name: string, index: number): string {
  return `clinic-${index + 1}`
}
