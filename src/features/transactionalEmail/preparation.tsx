import { randomUUID } from 'node:crypto'
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
