import type { SyntheticWelcomeEmailProps } from '@findmydoc-platform/email-templates'
import { spawnSync } from 'node:child_process'
import { JSDOM } from 'jsdom'
import { renderSyntheticEmailTemplate } from '../../scripts/render-synthetic-email-template.mjs'

describe('private email template package', () => {
  it('fails clearly before installation when package-read authentication is missing', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-email-template-package-access.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_AUTH_TOKEN: '' },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('NODE_AUTH_TOKEN with GitHub Packages read access is required')
  })

  it('renders the public synthetic template to HTML and plain text in Website', async () => {
    const actionUrl = 'https://example.com/start'
    const props = { firstName: 'Avery', actionUrl } satisfies SyntheticWelcomeEmailProps
    const { subject, html, text } = await renderSyntheticEmailTemplate(props)
    const document = new JSDOM(html).window.document

    expect(subject).toBe('Welcome to findmydoc')
    expect(document.querySelector('h1')?.textContent).toBe('Hello, Avery')
    expect(document.querySelector('a')?.href).toBe(actionUrl)
    expect(document.body.textContent).toContain('This fictional message demonstrates the findmydoc email style.')
    expect(text.toLowerCase()).toContain('hello, avery')
    expect(text).toContain('Continue to a fictional findmydoc example')
    expect(text).toContain(actionUrl)
  })
})
