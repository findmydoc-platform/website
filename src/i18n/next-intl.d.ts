import type germanMessages from '@findmydoc-platform/ui-copy/de.json'
import 'next-intl'

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof germanMessages
  }
}
