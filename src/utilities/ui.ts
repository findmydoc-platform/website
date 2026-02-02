/**
 * Utility functions for UI components automatically added by ShadCN and used in a few of our frontend components and blocks.
 *
 * Other functions may be exported from here in the future or by installing other shadcn components.
 */

import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    // Custom typography utilities defined in `src/app/(frontend)/globals.css`.
    // Without this, `twMerge` doesn't recognize `text-size-*` as a font-size utility
    // and can incorrectly drop it when combined with `text-foreground`.
    theme: {
      text: ['big', 'normal', 'small', 'size-32', 'size-40', 'size-56', 'size-72'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
