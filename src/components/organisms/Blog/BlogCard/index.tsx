/**
 * BlogCard Compound Components
 *
 * Refactored from prop-based variants to compound components following the "Rule of 3 Booleans" pattern.
 * Each variant is optimized for specific use cases with appropriate aspect ratios and visual treatments.
 *
 * Usage:
 * ```tsx
 * import { BlogCard } from '@/components/organisms/Blog/BlogCard'
 *
 * <BlogCard.Overlay {...props} />    // Featured card (21:9)
 * <BlogCard.Simple {...props} />     // Grid card (4:3)
 * <BlogCard.Enhanced {...props} />   // Homepage card with author
 * <BlogCard.Overview {...props} />   // Related posts (16:10)
 * ```
 */

// Export compound components as namespace
export { Overlay } from './Overlay'
export { Simple } from './Simple'
export { Enhanced } from './Enhanced'
export { Overview } from './Overview'

// Namespace object for dot-notation usage
import { Overlay } from './Overlay'
import { Simple } from './Simple'
import { Enhanced } from './Enhanced'
import { Overview } from './Overview'

export const BlogCard = {
  Overlay,
  Simple,
  Enhanced,
  Overview,
}

// Export types
export type { BlogCardBaseProps, BlogCardImageProps, BlogCardAuthorProps } from '@/utilities/blog/normalizePost'
export type { EnhancedVariant, EnhancedProps } from './Enhanced'
export type { OverlayProps } from './Overlay'

/**
 * Legacy default export for backward compatibility
 * @deprecated Use BlogCard.Simple or specific variants instead
 * This exists only to keep existing code working during migration
 */
export default Simple
