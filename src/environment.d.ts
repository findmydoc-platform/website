declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URI: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string
      DEPLOYMENT_ENV?: string
      NEXT_PUBLIC_DEPLOYMENT_ENV?: string
      VERCEL_ENV?: string
      NEXT_PUBLIC_VERCEL_ENV?: string
      PREVIEW_GUARD_ENABLED?: string
      PAYLOAD_DB_PUSH?: string
      NEXT_PUBLIC_HEADER_LOGO_SRC?: string
      NEXT_PUBLIC_FOOTER_LOGO_SRC?: string
      NEXT_PUBLIC_PREVIEW_LOGO_SRC?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
