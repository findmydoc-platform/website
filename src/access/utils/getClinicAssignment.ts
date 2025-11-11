/**
 * Get the clinic ID that a clinic user is assigned to via their ClinicStaff profile
 * @param user - The authenticated user from req.user
 * @param payload - Payload instance from req.payload
 * @returns Promise<string | null> - The clinic ID or null if not found/applicable
 */
export async function getUserAssignedClinicId(user: any, payload: any): Promise<string | null> {
  // Only applicable for clinic users
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'clinic') {
    return null
  }

  try {
    const clinicStaffResult = await payload.find({
      collection: 'clinicStaff',
      where: {
        user: { equals: user.id },
        status: { equals: 'approved' },
      },
      limit: 1,
    })

    if (clinicStaffResult.docs.length === 0) {
      payload.logger.warn(`No approved clinic staff profile found for user ${user.id}`)
      return null
    }

    const clinicId = clinicStaffResult.docs[0]?.clinic
    return typeof clinicId === 'object' ? clinicId.id : clinicId
  } catch (error) {
    payload.logger.error(error, 'Error getting clinic assignment')
    return null
  }
}
