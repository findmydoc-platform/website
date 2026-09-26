import type { SyntheticWelcomeEmailProps } from '@findmydoc-platform/email-templates'
import { spawnSync } from 'node:child_process'
import { JSDOM } from 'jsdom'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
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

type Step = {
  name?: string
  uses?: string
  with?: Record<string, unknown>
}
type Workflow = { jobs?: Record<string, { steps?: Step[] }> }

describe('private package cache boundary', () => {
  it('keeps package and build artifacts out of restorable Actions caches', () => {
    const directory = path.resolve(import.meta.dirname, '../../.github/workflows')
    for (const file of readdirSync(directory).filter((name) => /\.ya?ml$/.test(name))) {
      const workflow = parse(readFileSync(path.join(directory, file), 'utf8')) as Workflow
      for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
        for (const step of job.steps ?? []) {
          const context = `${file}: ${jobName}: ${step.name ?? step.uses}`
          if (step.uses?.startsWith('pnpm/action-setup@')) {
            expect(step.with?.cache, context).toBe(false)
          }
          if (step.uses?.startsWith('actions/setup-node@')) {
            expect(step.with?.cache, context).toBeUndefined()
            expect(step.with?.['package-manager-cache'], context).toBe(false)
          }
          if (/^actions\/cache(?:\/(?:restore|save))?@/.test(step.uses ?? '')) {
            expect(step.with?.path, context).toBe('~/.cache/ms-playwright')
            expect(step.with?.key, context).toMatch(/^playwright-/)
          }
        }
      }
    }
  })
})

describe('private package update automation', () => {
  it('keeps Dependabot configuration eligible for ordinary PR validation', () => {
    const repository = path.resolve(import.meta.dirname, '../..')
    const workflow = parse(readFileSync(path.join(repository, '.github/workflows/deploy.yml'), 'utf8')) as {
      on: { pull_request?: { paths?: string[]; 'paths-ignore'?: string[] } }
    }

    expect(workflow.on).toHaveProperty('pull_request')
    expect(workflow.on.pull_request?.paths).toBeUndefined()
    const ignoredPatterns = workflow.on.pull_request?.['paths-ignore'] ?? []
    if (ignoredPatterns.length === 0) return

    const ignoredFiles = spawnSync(
      'git',
      ['ls-files', '--', ...ignoredPatterns.map((pattern) => `:(glob)${pattern}`)],
      {
        cwd: repository,
        encoding: 'utf8',
      },
    )

    expect(ignoredFiles.status, ignoredFiles.stderr).toBe(0)
    expect(ignoredFiles.stdout.split('\n')).not.toContain('.github/dependabot.yml')
  })
})
