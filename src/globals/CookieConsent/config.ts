import type { GlobalConfig } from 'payload'

import {
  COOKIE_CONSENT_CATEGORY_REGISTRY,
  COOKIE_CONSENT_TOOL_SELECT_OPTIONS,
  DEFAULT_COOKIE_CONSENT_CATEGORY_SETTINGS,
} from '@/features/cookieConsent'
import { MANAGED_LEGAL_PAGE_SLUGS } from '@/utilities/legalPages'
import { revalidateCookieConsent } from './hooks/revalidateCookieConsent'
import { validateCookieConsentToolAssignments } from './validateCookieConsent'

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
          label: 'Enable cookie consent',
          defaultValue: true,
          admin: {
            width: '25%',
          },
        },
        {
          name: 'consentVersion',
          type: 'number',
          label: 'Consent version',
          defaultValue: 3,
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
          label: 'Consent prompt',
          fields: [
            {
              type: 'collapsible',
              label: 'Prompt copy',
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
              label: 'Primary actions',
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
            {
              type: 'collapsible',
              label: 'Secondary actions',
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
          label: 'Settings',
          fields: [
            {
              type: 'collapsible',
              label: 'Privacy policy',
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
                      required: true,
                      hasMany: false,
                      admin: {
                        description: 'Select the page that should be linked from the consent dialog.',
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
              type: 'collapsible',
              label: 'Settings copy',
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
              ],
            },
            {
              name: 'optionalCategorySettings',
              type: 'group',
              label: 'Optional categories',
              required: true,
              defaultValue: DEFAULT_COOKIE_CONSENT_CATEGORY_SETTINGS,
              admin: {
                description:
                  'Official optional cookie categories shown in the consent dialog. Categories are fixed; only labels, enabled state, and tool assignments can be edited.',
              },
              fields: [
                {
                  name: 'functional',
                  type: 'group',
                  label: 'Functional',
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'enabled',
                          type: 'checkbox',
                          label: 'Enabled',
                          defaultValue: true,
                          admin: {
                            width: '20%',
                          },
                        },
                        {
                          name: 'label',
                          type: 'text',
                          label: 'Label',
                          required: true,
                          defaultValue: COOKIE_CONSENT_CATEGORY_REGISTRY.functional.label,
                          admin: {
                            width: '80%',
                          },
                        },
                      ],
                    },
                    {
                      name: 'tools',
                      type: 'select',
                      label: 'Tools',
                      required: false,
                      hasMany: true,
                      defaultValue: [...COOKIE_CONSENT_CATEGORY_REGISTRY.functional.tools],
                      admin: {
                        description: 'Select the hard-coded tools that are governed by this category.',
                      },
                      options: COOKIE_CONSENT_TOOL_SELECT_OPTIONS,
                    },
                  ],
                },
                {
                  name: 'analytics',
                  type: 'group',
                  label: 'Analytics',
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'enabled',
                          type: 'checkbox',
                          label: 'Enabled',
                          defaultValue: true,
                          admin: {
                            width: '20%',
                          },
                        },
                        {
                          name: 'label',
                          type: 'text',
                          label: 'Label',
                          required: true,
                          defaultValue: COOKIE_CONSENT_CATEGORY_REGISTRY.analytics.label,
                          admin: {
                            width: '80%',
                          },
                        },
                      ],
                    },
                    {
                      name: 'tools',
                      type: 'select',
                      label: 'Tools',
                      required: false,
                      hasMany: true,
                      defaultValue: [...COOKIE_CONSENT_CATEGORY_REGISTRY.analytics.tools],
                      admin: {
                        description: 'Select the hard-coded tools that are governed by this category.',
                      },
                      options: COOKIE_CONSENT_TOOL_SELECT_OPTIONS,
                    },
                  ],
                },
                {
                  name: 'marketing',
                  type: 'group',
                  label: 'Marketing',
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'enabled',
                          type: 'checkbox',
                          label: 'Enabled',
                          defaultValue: true,
                          admin: {
                            width: '20%',
                          },
                        },
                        {
                          name: 'label',
                          type: 'text',
                          label: 'Label',
                          required: true,
                          defaultValue: COOKIE_CONSENT_CATEGORY_REGISTRY.marketing.label,
                          admin: {
                            width: '80%',
                          },
                        },
                      ],
                    },
                    {
                      name: 'tools',
                      type: 'select',
                      label: 'Tools',
                      required: false,
                      hasMany: true,
                      defaultValue: [...COOKIE_CONSENT_CATEGORY_REGISTRY.marketing.tools],
                      admin: {
                        description: 'Select the hard-coded tools that are governed by this category.',
                      },
                      options: COOKIE_CONSENT_TOOL_SELECT_OPTIONS,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        validateCookieConsentToolAssignments(data)
        return data
      },
    ],
    afterChange: [revalidateCookieConsent],
  },
}
