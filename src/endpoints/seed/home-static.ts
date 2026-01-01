import type { RequiredDataFromCollectionSlug } from 'payload'

// Used for pre-seeded content so that the homepage is not empty
export const homeStatic: RequiredDataFromCollectionSlug<'pages'> = {
  slug: 'home',
  _status: 'published',
  meta: {
    description: 'findmydoc helps medical travelers discover trusted clinics and specialists.',
    title: 'findmydoc',
  },
  title: 'Home',
  layout: [],
}
