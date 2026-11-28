import {
  generateClinicProfileMetadata,
  renderClinicProfile,
  type ClinicDetailPageArgs,
} from '@/app/(frontend)/clinics/[slug]/clinicProfile'

export const dynamic = 'force-dynamic'

export default function ClinicProfilePage(args: ClinicDetailPageArgs) {
  return renderClinicProfile(args, 'en')
}

export function generateMetadata(args: ClinicDetailPageArgs) {
  return generateClinicProfileMetadata(args, 'en')
}
