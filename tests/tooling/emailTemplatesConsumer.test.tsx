import {
  APPEAL_DECIDED_SUBJECT,
  APPEAL_RECEIVED_SUBJECT,
  AppealDecidedEmail,
  AppealReceivedEmail,
  CLINIC_PASSWORD_RECOVERY_SUBJECT,
  CLINIC_REGISTRATION_RECEIPT_SUBJECT,
  CLINIC_STAFF_INVITATION_SUBJECT,
  CONVERSATION_MESSAGE_SUBJECT,
  ClinicPasswordRecoveryEmail,
  ClinicRegistrationReceiptEmail,
  ClinicStaffInvitationEmail,
  ConversationMessageEmail,
  EmailAction,
  EmailHeading,
  EmailLayout,
  EmailText,
  PATIENT_EMAIL_VERIFICATION_SUBJECT,
  PATIENT_PASSWORD_RECOVERY_SUBJECT,
  PLATFORM_PASSWORD_RECOVERY_SUBJECT,
  PatientEmailVerificationEmail,
  PatientPasswordRecoveryEmail,
  PlatformPasswordRecoveryEmail,
  REPORT_DECIDED_SUBJECT,
  REPORT_RECEIVED_SUBJECT,
  ReportDecidedEmail,
  ReportReceivedEmail,
  SYNTHETIC_WELCOME_SUBJECT,
  SyntheticWelcomeEmail,
  type AffectedReportDecisionStatus,
  type AppealAppellantDecisionStatus,
  type AppealDecidedEmailProps,
  type AppealReceivedEmailProps,
  type ClinicPasswordRecoveryEmailProps,
  type ClinicRegistrationReceiptEmailProps,
  type ClinicStaffInvitationEmailProps,
  type ConversationMessageEmailProps,
  type EmailActionProps,
  type EmailHeadingProps,
  type EmailLayoutProps,
  type EmailTextProps,
  type OriginalReporterAppealDecisionStatus,
  type PatientEmailVerificationEmailProps,
  type PatientPasswordRecoveryEmailProps,
  type PlatformPasswordRecoveryEmailProps,
  type ReportCategory,
  type ReportDecidedEmailProps,
  type ReportReceivedEmailProps,
  type ReporterReportDecisionStatus,
  type SyntheticWelcomeEmailProps,
} from '@findmydoc-platform/email-templates'
import { spawnSync } from 'node:child_process'
import { JSDOM } from 'jsdom'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { renderSyntheticEmailTemplate } from '../../scripts/render-synthetic-email-template.mjs'

const publicTemplateComponents = [
  AppealDecidedEmail,
  AppealReceivedEmail,
  ClinicPasswordRecoveryEmail,
  ClinicRegistrationReceiptEmail,
  ClinicStaffInvitationEmail,
  ConversationMessageEmail,
  EmailAction,
  EmailHeading,
  EmailLayout,
  EmailText,
  PatientEmailVerificationEmail,
  PatientPasswordRecoveryEmail,
  PlatformPasswordRecoveryEmail,
  ReportDecidedEmail,
  ReportReceivedEmail,
  SyntheticWelcomeEmail,
]

const publicTemplateSubjects = [
  APPEAL_DECIDED_SUBJECT,
  APPEAL_RECEIVED_SUBJECT,
  CLINIC_PASSWORD_RECOVERY_SUBJECT,
  CLINIC_REGISTRATION_RECEIPT_SUBJECT,
  CLINIC_STAFF_INVITATION_SUBJECT,
  CONVERSATION_MESSAGE_SUBJECT,
  PATIENT_EMAIL_VERIFICATION_SUBJECT,
  PATIENT_PASSWORD_RECOVERY_SUBJECT,
  PLATFORM_PASSWORD_RECOVERY_SUBJECT,
  REPORT_DECIDED_SUBJECT,
  REPORT_RECEIVED_SUBJECT,
  SYNTHETIC_WELCOME_SUBJECT,
]

const publicTemplateProps = [
  { category: 'Other', actionUrl: 'https://example.com' } satisfies ReportReceivedEmailProps,
  {
    audience: 'reporter',
    decisionCategory: 'Other',
    status: 'action-taken',
    actionUrl: 'https://example.com',
  } satisfies ReportDecidedEmailProps,
  {
    audience: 'affected',
    decisionCategory: 'Other',
    status: 'content-restricted',
    actionUrl: 'https://example.com',
  } satisfies ReportDecidedEmailProps,
  { decisionCategory: 'Other', actionUrl: 'https://example.com' } satisfies AppealReceivedEmailProps,
  {
    audience: 'appellant',
    decisionCategory: 'Other',
    status: 'restriction-remains',
    actionUrl: 'https://example.com',
  } satisfies AppealDecidedEmailProps,
  {
    audience: 'original-reporter',
    decisionCategory: 'Other',
    status: 'no-action',
    actionUrl: 'https://example.com',
  } satisfies AppealDecidedEmailProps,
  { actionUrl: 'https://example.com' } satisfies PlatformPasswordRecoveryEmailProps,
  { actionUrl: 'https://example.com' } satisfies ClinicPasswordRecoveryEmailProps,
  { actionUrl: 'https://example.com' } satisfies PatientPasswordRecoveryEmailProps,
  { actionUrl: 'https://example.com' } satisfies ClinicStaffInvitationEmailProps,
  { actionUrl: 'https://example.com' } satisfies PatientEmailVerificationEmailProps,
  { actionUrl: 'https://example.com' } satisfies ConversationMessageEmailProps,
  { fullName: 'Avery', clinicName: 'North Clinic' } satisfies ClinicRegistrationReceiptEmailProps,
  { firstName: 'Avery', actionUrl: 'https://example.com' } satisfies SyntheticWelcomeEmailProps,
  { children: 'Continue', href: 'https://example.com' } satisfies EmailActionProps,
  { children: 'Heading' } satisfies EmailHeadingProps,
  { children: 'Content', preview: 'Preview' } satisfies EmailLayoutProps,
  { children: 'Content' } satisfies EmailTextProps,
] as const

const publicTemplateUnionValues = ['Other', 'action-taken', 'content-restricted', 'restriction-remains'] satisfies [
  ReportCategory,
  ReporterReportDecisionStatus,
  AffectedReportDecisionStatus,
  AppealAppellantDecisionStatus,
]

const originalReporterDecisionStatus: OriginalReporterAppealDecisionStatus = 'no-action'

describe('private email template package', () => {
  it('exposes the complete shared template contract through the package root', () => {
    expect(publicTemplateComponents.every((component) => typeof component === 'function')).toBe(true)
    expect(publicTemplateSubjects.every((subject) => typeof subject === 'string' && subject.length > 0)).toBe(true)
    expect(publicTemplateProps).toHaveLength(18)
    expect(publicTemplateUnionValues).toHaveLength(4)
    expect(originalReporterDecisionStatus).toBe('no-action')
  })

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
  it('scopes private package updates without replacing public npm resolution', () => {
    const configuration = parse(
      readFileSync(path.resolve(import.meta.dirname, '../../.github/dependabot.yml'), 'utf8'),
    ) as {
      registries: Record<string, { type: string; url: string; scope?: string; 'replaces-base'?: boolean }>
      updates: { 'package-ecosystem': string; directory: string; registries?: string[]; allow?: unknown }[]
    }
    const npmUpdate = configuration.updates.find((update) => update['package-ecosystem'] === 'npm')

    expect(npmUpdate).toMatchObject({ directory: '/', registries: ['github-packages'] })
    expect(npmUpdate?.allow).toBeUndefined()
    expect(configuration.registries['github-packages']).toMatchObject({
      type: 'npm-registry',
      url: 'https://npm.pkg.github.com',
    })
    for (const registry of Object.values(configuration.registries)) {
      if (registry.type !== 'npm-registry') continue
      expect(registry.scope).toBeUndefined()
      expect(registry['replaces-base']).not.toBe(true)
    }

    const npmrc = readFileSync(path.resolve(import.meta.dirname, '../../.npmrc'), 'utf8')
    expect(npmrc).toMatch(/^registry=https:\/\/registry\.npmjs\.org\/?$/m)
    expect(npmrc).toMatch(/^@findmydoc-platform:registry=https:\/\/npm\.pkg\.github\.com\/?$/m)
  })

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
