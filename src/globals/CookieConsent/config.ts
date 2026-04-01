import type { GlobalConfig } from 'payload'

import { MANAGED_LEGAL_PAGE_SLUGS } from '@/utilities/legalPages'
import { revalidateCookieConsent } from './hooks/revalidateCookieConsent'

export const CookieConsent: GlobalConfig = {
  slug: 'cookieConsent',
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable cookie banner',
          defaultValue: true,
          admin: {
            width: '25%',
          },
        },
        {
          name: 'consentVersion',
          type: 'number',
          label: 'Consent version',
          defaultValue: 2,
          required: true,
          admin: {
            description: 'Increase this number when the consent wording or behavior changes.',
            width: '25%',
          },
        },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Banner',
          fields: [
            {
              type: 'collapsible',
              label: 'Banner copy',
              admin: {
                initCollapsed: false,
              },
              fields: [
                {
                  name: 'bannerTitle',
                  type: 'text',
                  label: 'Title',
                  required: true,
                  defaultValue: 'Cookies on findmydoc',
                },
                {
                  name: 'bannerDescription',
                  type: 'textarea',
                  label: 'Description',
                  required: true,
                  defaultValue:
                    'We use essential cookies to keep the site working and optional cookies to understand usage and improve the experience.',
                },
              ],
            },
            {
              type: 'collapsible',
              label: 'Button labels',
              admin: {
                initCollapsed: false,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'acceptLabel',
                      type: 'text',
                      label: 'Accept button label',
                      required: true,
                      admin: {
                        width: '33.33%',
                      },
                      defaultValue: 'Accept all',
                    },
                    {
                      name: 'rejectLabel',
                      type: 'text',
                      label: 'Reject button label',
                      required: true,
                      admin: {
                        width: '33.33%',
                      },
                      defaultValue: 'Reject all',
                    },
                    {
                      name: 'customizeLabel',
                      type: 'text',
                      label: 'Customize button label',
                      required: true,
                      admin: {
                        width: '33.33%',
                      },
                      defaultValue: 'Customize',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Settings',
          fields: [
            {
              type: 'collapsible',
              label: 'Dialog copy',
              admin: {
                initCollapsed: false,
              },
              fields: [
                {
                  name: 'settingsTitle',
                  type: 'text',
                  label: 'Title',
                  required: true,
                  defaultValue: 'Cookie settings',
                },
                {
                  name: 'settingsDescription',
                  type: 'textarea',
                  label: 'Description',
                  required: true,
                  defaultValue: 'Choose which optional cookies you allow. Essential cookies are always active.',
                },
              ],
            },
            {
              type: 'collapsible',
              label: 'Consent categories',
              admin: {
                initCollapsed: false,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'essentialLabel',
                      type: 'text',
                      label: 'Essential cookies label',
                      required: true,
                      admin: {
                        width: '30%',
                      },
                      defaultValue: 'Essential cookies',
                    },
                    {
                      name: 'essentialDescription',
                      type: 'textarea',
                      label: 'Essential cookies description',
                      required: true,
                      admin: {
                        width: '70%',
                      },
                      defaultValue: 'Required for core site functionality, security, and consent persistence.',
                    },
                  ],
                },
                {
                  name: 'optionalCategories',
                  type: 'array',
                  label: 'Optional categories',
                  labels: {
                    singular: 'Category',
                    plural: 'Categories',
                  },
                  required: true,
                  minRows: 0,
                  maxRows: 4,
                  defaultValue: [
                    {
                      key: 'analytics',
                      label: 'Analytics cookies',
                      description: 'Help us understand how the site is used so we can improve it.',
                    },
                    {
                      key: 'functional',
                      label: 'Functional cookies',
                      description: 'Remember helpful preferences and support a smoother experience.',
                    },
                  ],
                  fields: [
                    {
                      name: 'key',
                      type: 'text',
                      label: 'Key',
                      required: true,
                      admin: {
                        width: '30%',
                        description: 'Stable identifier used in code and consent storage.',
                      },
                    },
                    {
                      name: 'label',
                      type: 'text',
                      label: 'Label',
                      required: true,
                      admin: {
                        width: '35%',
                      },
                    },
                    {
                      name: 'description',
                      type: 'textarea',
                      label: 'Description',
                      required: true,
                      admin: {
                        width: '35%',
                      },
                    },
                  ],
                  admin: {
                    description: 'Optional cookie categories shown in the consent dialog.',
                    initCollapsed: true,
                    components: {
                      RowLabel: '@/globals/CookieConsent/RowLabel#RowLabel',
                    },
                  },
                },
              ],
            },
            {
              type: 'collapsible',
              label: 'Dialog buttons',
              admin: {
                initCollapsed: true,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'cancelLabel',
                      type: 'text',
                      label: 'Cancel button label',
                      required: true,
                      admin: {
                        width: '33.33%',
                      },
                      defaultValue: 'Cancel',
                    },
                    {
                      name: 'saveLabel',
                      type: 'text',
                      label: 'Save button label',
                      required: true,
                      admin: {
                        width: '33.33%',
                      },
                      defaultValue: 'Save preferences',
                    },
                    {
                      name: 'reopenLabel',
                      type: 'text',
                      label: 'Reopen label',
                      required: true,
                      admin: {
                        width: '33.33%',
                      },
                      defaultValue: 'Cookie settings',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Privacy Link',
          fields: [
            {
              type: 'collapsible',
              label: 'Privacy policy link',
              admin: {
                initCollapsed: false,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'privacyPolicyPage',
                      type: 'relationship',
                      relationTo: 'pages',
                      required: false,
                      hasMany: false,
                      admin: {
                        description: 'Select the page used for the privacy policy link.',
                        width: '70%',
                      },
                      filterOptions: {
                        slug: {
                          in: MANAGED_LEGAL_PAGE_SLUGS,
                        },
                      },
                    },
                    {
                      name: 'privacyPolicyLabel',
                      type: 'text',
                      label: 'Label',
                      required: true,
                      admin: {
                        width: '30%',
                      },
                      defaultValue: 'Privacy Policy',
                    },
                  ],
                },
              ],
            },
            {
              name: 'privacyPolicyUrl',
              type: 'text',
              label: 'Fallback URL',
              required: true,
              defaultValue: '/privacy-policy',
              admin: {
                hidden: true,
                description: 'Fallback URL used when no privacy policy page is selected.',
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateCookieConsent],
  },
}
