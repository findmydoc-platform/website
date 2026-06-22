import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'

export const HOME_BREADCRUMB: BreadcrumbItem = {
  label: 'Home',
  href: '/',
}

export const CLINICS_BREADCRUMB: BreadcrumbItem = {
  label: 'Clinics',
  href: '/listing-comparison',
}

export const createBlogBreadcrumb = (href = '/posts'): BreadcrumbItem => ({
  label: 'Blog',
  href,
})
