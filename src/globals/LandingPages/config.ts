import type { Field, GlobalConfig } from 'payload'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { link } from '@/fields/link'
import { landingSocialHosts, validateLandingHref } from '@/utilities/landing/safeLandingHref'

import { revalidateLandingPages } from './hooks/revalidateLandingPages'

const socialLandingLinkMessage = 'Use # or an https:// URL for the matching social network.'
const landingCtaButtonTextMaxLength = 48

const validateLandingCtaButtonText = (value: string | string[] | null | undefined): true | string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Button text is required.'
  }

  if (value.trim().length > landingCtaButtonTextMaxLength) {
    return `Use ${landingCtaButtonTextMaxLength} characters or fewer.`
  }

  return true
}

const pageSeoFields: Field[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
    admin: {
      description: 'Browser and search title for this landing route.',
    },
  },
  {
    name: 'description',
    type: 'textarea',
    required: true,
    admin: {
      description: 'Search description for this landing route.',
    },
  },
]

const heroFields: Field[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
    admin: {
      description: 'Main hero headline.',
    },
  },
  {
    name: 'description',
    type: 'textarea',
    required: true,
    admin: {
      description: 'Hero supporting text.',
    },
  },
  {
    name: 'image',
    type: 'relationship',
    relationTo: 'platformContentMedia',
    required: true,
    admin: {
      description: 'Hero image shown on this landing route.',
    },
  },
]

const sectionIntroFields: Field[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
    admin: {
      description: 'Section headline.',
    },
  },
  {
    name: 'description',
    type: 'textarea',
    required: true,
    admin: {
      description: 'Section supporting text.',
    },
  },
]

const faqFields: Field[] = [
  ...sectionIntroFields,
  {
    name: 'items',
    type: 'array',
    required: true,
    minRows: 1,
    admin: {
      description: 'FAQ questions and answers.',
      initCollapsed: true,
    },
    fields: [
      {
        name: 'question',
        type: 'text',
        required: true,
      },
      {
        name: 'answer',
        type: 'textarea',
        required: true,
      },
    ],
  },
]

const testimonialsField: Field = {
  name: 'testimonials',
  type: 'array',
  required: true,
  minRows: 1,
  admin: {
    description: 'Testimonials shown in the carousel.',
    initCollapsed: true,
  },
  fields: [
    {
      name: 'quote',
      type: 'textarea',
      required: true,
    },
    {
      name: 'author',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'text',
      required: true,
    },
    {
      name: 'image',
      type: 'relationship',
      relationTo: 'platformContentMedia',
      required: true,
      admin: {
        description: 'Portrait shown for this testimonial.',
      },
    },
  ],
}

const featuresField: Field = {
  name: 'items',
  type: 'array',
  required: true,
  minRows: 1,
  admin: {
    description: 'Feature items shown in the landing feature section.',
    initCollapsed: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'subtitle',
      type: 'text',
      required: false,
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'icon',
      type: 'select',
      required: true,
      options: [
        { label: 'Check Circle', value: 'checkCircle' },
        { label: 'Target', value: 'target' },
        { label: 'Trending Up', value: 'trendingUp' },
        { label: 'Eye', value: 'eye' },
      ],
      admin: {
        description: 'Icon shown next to this feature.',
      },
    },
  ],
}

const processFields: Field[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
  },
  {
    name: 'subtitle',
    type: 'textarea',
    required: true,
  },
  {
    name: 'steps',
    type: 'array',
    required: true,
    minRows: 1,
    admin: {
      description: 'Process timeline steps.',
      initCollapsed: true,
    },
    fields: [
      {
        name: 'step',
        type: 'number',
        required: true,
      },
      {
        name: 'title',
        type: 'text',
        required: true,
      },
      {
        name: 'description',
        type: 'textarea',
        required: true,
      },
      {
        name: 'image',
        type: 'relationship',
        relationTo: 'platformContentMedia',
        required: true,
        admin: {
          description: 'Image shown for this process step.',
        },
      },
    ],
  },
]

const ctaButtonFields = (): Field[] => [
  {
    name: 'buttonText',
    type: 'text',
    required: true,
    maxLength: landingCtaButtonTextMaxLength,
    validate: validateLandingCtaButtonText,
  },
  link({
    appearances: false,
    disableLabel: true,
    overrides: {
      label: 'Button link',
      required: true,
    },
  }),
]

const ctaFields: Field[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
  },
  ...ctaButtonFields(),
]

const compactTextItemsField = (description: string): Field => ({
  name: 'items',
  type: 'array',
  required: true,
  minRows: 1,
  maxRows: 3,
  admin: {
    description,
    initCollapsed: true,
  },
  fields: [
    {
      name: 'text',
      type: 'textarea',
      required: true,
    },
  ],
})

const teamField: Field = {
  name: 'team',
  type: 'array',
  required: true,
  minRows: 1,
  admin: {
    description: 'Team members shown on the clinic partner landing page.',
    initCollapsed: true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'text',
      required: true,
    },
    {
      name: 'image',
      type: 'relationship',
      relationTo: 'platformContentMedia',
      required: true,
      admin: {
        description: 'Portrait shown for this team member.',
      },
    },
    {
      name: 'isPhoto',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'photoDisplay',
      type: 'select',
      defaultValue: 'grayscale',
      options: [
        { label: 'Original', value: 'original' },
        { label: 'Grayscale', value: 'grayscale' },
      ],
    },
    {
      name: 'socials',
      type: 'group',
      fields: [
        {
          name: 'meta',
          type: 'text',
          required: false,
          validate: (value: string | string[] | null | undefined) =>
            validateLandingHref(value, { allowedHosts: landingSocialHosts.meta, message: socialLandingLinkMessage }),
        },
        {
          name: 'x',
          type: 'text',
          required: false,
          validate: (value: string | string[] | null | undefined) =>
            validateLandingHref(value, { allowedHosts: landingSocialHosts.x, message: socialLandingLinkMessage }),
        },
        {
          name: 'instagram',
          type: 'text',
          required: false,
          validate: (value: string | string[] | null | undefined) =>
            validateLandingHref(value, {
              allowedHosts: landingSocialHosts.instagram,
              message: socialLandingLinkMessage,
            }),
        },
        {
          name: 'linkedin',
          type: 'text',
          required: false,
          validate: (value: string | string[] | null | undefined) =>
            validateLandingHref(value, {
              allowedHosts: landingSocialHosts.linkedin,
              message: socialLandingLinkMessage,
            }),
        },
        {
          name: 'github',
          type: 'text',
          required: false,
          validate: (value: string | string[] | null | undefined) =>
            validateLandingHref(value, { allowedHosts: landingSocialHosts.github, message: socialLandingLinkMessage }),
        },
      ],
    },
  ],
}

const aboutTeamField: Field = {
  name: 'team',
  type: 'array',
  required: true,
  minRows: 1,
  maxRows: 8,
  admin: {
    description: 'Team members shown with responsibility details on the about page.',
    initCollapsed: true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'text',
      required: true,
    },
    {
      name: 'image',
      type: 'relationship',
      relationTo: 'platformContentMedia',
      required: true,
      admin: {
        description: 'Portrait shown for this team member.',
      },
    },
    {
      name: 'whatWeDo',
      type: 'textarea',
      required: true,
      admin: {
        description: 'One concise responsibility line for this team member.',
      },
    },
  ],
}

const pricingFields: Field[] = [
  ...sectionIntroFields,
  {
    name: 'plans',
    type: 'array',
    required: true,
    minRows: 1,
    admin: {
      description: 'Partner pricing cards.',
      initCollapsed: true,
    },
    fields: [
      { name: 'price', type: 'text', required: true },
      { name: 'billingLabel', type: 'text', required: false },
      { name: 'plan', type: 'text', required: true },
      { name: 'description', type: 'textarea', required: true },
      {
        name: 'highlights',
        type: 'array',
        required: false,
        fields: [{ name: 'text', type: 'text', required: true }],
      },
      { name: 'buttonText', type: 'text', required: true },
      { name: 'badge', type: 'text', required: false },
      {
        name: 'layout',
        type: 'select',
        required: true,
        defaultValue: 'primary',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Compact', value: 'compact' },
        ],
      },
    ],
  },
]

const pricingModelField: Field = {
  name: 'pricingModel',
  type: 'array',
  required: false,
  admin: {
    description: 'Pricing model explanation items.',
    initCollapsed: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea', required: true },
  ],
}

export const LandingPages: GlobalConfig = {
  slug: 'landingPages',
  access: {
    read: () => true,
    update: ({ req }) => isPlatformBasicUser({ req }),
  },
  admin: {
    group: 'Content & Media',
    description: 'CMS-managed content for fixed landing routes.',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          name: 'home',
          label: 'Home landing',
          fields: [
            {
              name: 'seo',
              type: 'group',
              fields: pageSeoFields,
            },
            {
              name: 'hero',
              type: 'group',
              fields: heroFields,
            },
            testimonialsField,
            {
              name: 'testimonialsIntro',
              type: 'group',
              fields: sectionIntroFields,
            },
            {
              name: 'categoriesIntro',
              type: 'group',
              fields: sectionIntroFields,
            },
            {
              name: 'features',
              type: 'group',
              fields: [
                ...sectionIntroFields,
                {
                  name: 'backgroundImage',
                  type: 'relationship',
                  relationTo: 'platformContentMedia',
                  required: true,
                  admin: {
                    description: 'Feature-section background image.',
                  },
                },
                featuresField,
              ],
            },
            {
              name: 'process',
              type: 'group',
              fields: processFields,
            },
            {
              name: 'faq',
              type: 'group',
              fields: faqFields,
            },
            {
              name: 'blogTeaser',
              type: 'group',
              fields: sectionIntroFields,
            },
            {
              name: 'contact',
              type: 'group',
              fields: sectionIntroFields,
            },
          ],
        },
        {
          name: 'clinicPartners',
          label: 'Clinic partner landing',
          fields: [
            {
              name: 'seo',
              type: 'group',
              fields: pageSeoFields,
            },
            {
              name: 'hero',
              type: 'group',
              fields: heroFields,
            },
            {
              name: 'features',
              type: 'group',
              fields: [...sectionIntroFields, featuresField],
            },
            {
              name: 'process',
              type: 'group',
              fields: processFields,
            },
            {
              name: 'categoriesIntro',
              type: 'group',
              fields: sectionIntroFields,
            },
            {
              name: 'cta',
              type: 'group',
              fields: ctaFields,
            },
            teamField,
            {
              name: 'teamIntro',
              type: 'group',
              fields: sectionIntroFields,
            },
            {
              name: 'teamCta',
              label: 'Team CTA',
              type: 'group',
              fields: ctaButtonFields(),
            },
            testimonialsField,
            {
              name: 'testimonialsIntro',
              type: 'group',
              fields: sectionIntroFields,
            },
            {
              name: 'pricing',
              type: 'group',
              fields: pricingFields,
            },
            pricingModelField,
            {
              name: 'faq',
              type: 'group',
              fields: faqFields,
            },
            {
              name: 'blogTeaser',
              type: 'group',
              fields: sectionIntroFields,
            },
            {
              name: 'registrationIntro',
              type: 'group',
              fields: sectionIntroFields,
            },
            {
              name: 'contact',
              type: 'group',
              fields: sectionIntroFields,
            },
          ],
        },
        {
          name: 'about',
          label: 'About page',
          fields: [
            {
              name: 'seo',
              type: 'group',
              fields: pageSeoFields,
            },
            {
              name: 'hero',
              type: 'group',
              fields: heroFields,
            },
            {
              name: 'why',
              type: 'group',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                },
                compactTextItemsField('Short statements shown in the why-we-exist section.'),
              ],
            },
            aboutTeamField,
            {
              name: 'transparency',
              type: 'group',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                },
                compactTextItemsField('Transparency points shown near the end of the about page.'),
              ],
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateLandingPages],
  },
}
