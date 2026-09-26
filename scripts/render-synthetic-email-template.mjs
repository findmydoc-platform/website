import { SYNTHETIC_WELCOME_SUBJECT, SyntheticWelcomeEmail } from '@findmydoc-platform/email-templates'
import { render, toPlainText } from '@react-email/render'
import { createElement } from 'react'

export async function renderSyntheticEmailTemplate(props) {
  const html = await render(createElement(SyntheticWelcomeEmail, props))
  return { subject: SYNTHETIC_WELCOME_SUBJECT, html, text: toPlainText(html) }
}
