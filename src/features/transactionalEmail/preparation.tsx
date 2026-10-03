import { randomUUID } from 'node:crypto'
import {
  CLINIC_REGISTRATION_RECEIPT_SUBJECT,
  CLINIC_STAFF_INVITATION_SUBJECT,
  ClinicStaffInvitationEmail,
  ClinicRegistrationReceiptEmail,
  type ClinicRegistrationReceiptEmailProps,
  PATIENT_EMAIL_VERIFICATION_SUBJECT,
  PatientEmailVerificationEmail,
} from '@findmydoc-platform/email-templates'
import { Body, Html, Link, Text } from '@react-email/components'
import { render, toPlainText } from '@react-email/render'

export type PreparedMessage = { recipientAddress: string; subject: string; html: string; text: string }
export type LinkGenerator = { generate(): Promise<string> }
export const fakeLinks: LinkGenerator = {
  async generate() {
    return `https://example.test/action/${randomUUID()}`
  },
}

type SyntheticNotificationProps = { actionLink: string }
function SyntheticNotification({ actionLink }: SyntheticNotificationProps) {
  return (
    <Html>
      <Body>
        <Text>A synthetic notification is available.</Text>
        <Link href={actionLink}>View synthetic notification</Link>
      </Body>
    </Html>
  )
}

export async function renderSyntheticNotification(
  recipientAddress: string,
  actionLink: string,
): Promise<PreparedMessage> {
  const html = await render(<SyntheticNotification actionLink={actionLink} />)
  return { recipientAddress, subject: 'Synthetic notification', html, text: toPlainText(html) }
}

export async function renderClinicRegistrationReceipt(
  recipientAddress: string,
  props: ClinicRegistrationReceiptEmailProps,
): Promise<PreparedMessage> {
  const html = await render(<ClinicRegistrationReceiptEmail {...props} />)
  return {
    recipientAddress,
    subject: CLINIC_REGISTRATION_RECEIPT_SUBJECT,
    html,
    text: toPlainText(html),
  }
}

export async function renderPatientEmailVerification(
  recipientAddress: string,
  actionUrl: string,
): Promise<PreparedMessage> {
  const html = await render(<PatientEmailVerificationEmail actionUrl={actionUrl} />)
  return { recipientAddress, subject: PATIENT_EMAIL_VERIFICATION_SUBJECT, html, text: toPlainText(html) }
}

export async function renderClinicStaffInvitation(
  recipientAddress: string,
  actionUrl: string,
): Promise<PreparedMessage> {
  const html = await render(<ClinicStaffInvitationEmail actionUrl={actionUrl} />)
  return { recipientAddress, subject: CLINIC_STAFF_INVITATION_SUBJECT, html, text: toPlainText(html) }
}
