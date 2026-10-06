import { buildConfig, type CollectionConfig, type EmailAdapter } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import { plugins } from '@/plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { transactionalEmailEventSchema } from '@/features/transactionalEmail/eventSchema'
import { validateTransactionalEmailStartup } from '@/features/transactionalEmail/environment'
import { protectAuthActionProtocolStorage } from '@/auth/actions/protocol/storage'
import { createPayloadRuntimePoolConfig, payloadDatabaseAvailabilityAfterError } from '@/features/databaseAvailability'
import { createPayloadLoggerConfig } from '@/utilities/logging/payloadLogger'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE } from '@/utilities/contentLocalization'
import { MEDIA_UPLOAD_MAX_BYTES, MEDIA_UPLOAD_TOO_LARGE_MESSAGE } from '@/config/mediaUploadPolicy'
import { canRunPayloadJobs } from '@/access/payloadJobs'
import { seedChunkTask } from '@/endpoints/seed/tasks/seedChunkTask'
import { Footer } from '@/globals/Footer/config'
import { Header } from '@/globals/Header/config'
import { CookieConsent } from '@/globals/CookieConsent/config'
import { LandingPages } from '@/globals/LandingPages/config'

const email: EmailAdapter<void> = () => ({
  defaultFromAddress: 'noreply@findmydoc.invalid',
  defaultFromName: 'findmydoc',
  name: 'silent-ci-email',
  sendEmail: async () => undefined,
})

export function createTestConfig(collections: CollectionConfig[]) {
  if (process.env.NODE_ENV !== 'test' || process.env.CI_DB_COPY !== '1')
    throw new Error('Domain POC requires test mode and a baseline database copy.')
  return buildConfig({
    telemetry: false,
    admin: { user: 'platformStaff' },
    collections,
    globals: [Header, Footer, CookieConsent, LandingPages],
    editor: defaultLexical,
    localization: { locales: [...CONTENT_LOCALES], defaultLocale: DEFAULT_CONTENT_LOCALE, fallback: true },
    db: postgresAdapter({
      push: false,
      pool: createPayloadRuntimePoolConfig(),
      afterSchemaInit: [transactionalEmailEventSchema],
    }),
    hooks: { afterError: [payloadDatabaseAvailabilityAfterError] },
    plugins: [...plugins],
    upload: {
      limits: { fileSize: MEDIA_UPLOAD_MAX_BYTES },
      abortOnLimit: true,
      responseOnLimit: MEDIA_UPLOAD_TOO_LARGE_MESSAGE,
      safeFileNames: true,
      preserveExtension: true,
    },
    secret: process.env.PAYLOAD_SECRET,
    sharp,
    email,
    logger: createPayloadLoggerConfig(process.env),
    typescript: { autoGenerate: false },
    jobs: { access: { run: canRunPayloadJobs }, enableConcurrencyControl: true, tasks: [seedChunkTask] },
    onInit: async (payload) => {
      protectAuthActionProtocolStorage(payload)
      validateTransactionalEmailStartup()
    },
  })
}
