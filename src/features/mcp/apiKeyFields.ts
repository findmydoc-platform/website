import type { CollapsibleField, Field, GroupField } from 'payload'

import { clinicOnboardingGrantField, clinicOnboardingToolNames } from './clinicOnboarding'
import { editorialImageGrantField } from './editorialImageGrants'
import { uploadEditorialImageTool } from './editorialImageTool'

type GrantCopy = {
  label: { en: string; de: string }
  description: string
}

const clinicProfileCopy: Record<string, GrantCopy> = {
  find: {
    label: { en: 'Read clinic profiles', de: 'Klinikprofile lesen' },
    description: 'View profile details and public listing status.',
  },
  create: {
    label: { en: 'Create clinic profiles directly', de: 'Klinikprofile direkt anlegen' },
    description: 'Create a standalone profile. Use Onboarding to include the first staff member.',
  },
  update: {
    label: { en: 'Edit clinic profiles', de: 'Klinikprofile bearbeiten' },
    description: 'Change address, opening hours, website and other public details.',
  },
}

const postCopy: Record<string, GrantCopy> = {
  find: {
    label: { en: 'Read posts', de: 'Beiträge lesen' },
    description: 'Find posts and read available drafts.',
  },
  create: {
    label: { en: 'Create posts', de: 'Beiträge anlegen' },
    description: 'Start a German draft or create a post directly.',
  },
  update: {
    label: { en: 'Edit and publish posts', de: 'Beiträge bearbeiten und veröffentlichen' },
    description: 'Revise drafts and publish the selected language.',
  },
}

const permissionComponents = '@/app/(payload)/components/McpPermissionFields'

function permissionSection(
  label: GrantCopy['label'],
  hint: string,
  group: GroupField,
  fields: Field[] = [group],
  copy?: Record<string, GrantCopy>,
): CollapsibleField {
  const describedGroup: GroupField = {
    ...group,
    label: false,
    fields: group.fields.map((field) => {
      if (field.type !== 'checkbox') return field
      const text = copy?.[field.name]
      return {
        ...field,
        ...(text ? { label: text.label } : {}),
        admin: {
          ...field.admin,
          ...(text ? { description: text.description } : {}),
          components: { ...field.admin?.components, Field: `${permissionComponents}#McpPermissionCheckbox` },
        },
      }
    }),
  }
  return {
    type: 'collapsible',
    label,
    fields: fields.map((field) => (field === group ? describedGroup : field)),
    admin: {
      description: hint,
      components: { Field: `${permissionComponents}#McpPermissionSection` },
    },
  }
}

function workflowSection(
  field: CollapsibleField,
  label: GrantCopy['label'],
  hint: string,
  sections: CollapsibleField[],
): CollapsibleField {
  return {
    ...field,
    label,
    fields: sections,
    admin: {
      ...field.admin,
      description: hint,
      initCollapsed: true,
      components: { ...field.admin?.components, Field: `${permissionComponents}#McpPermissionSection` },
    },
  }
}

export function buildMcpApiKeyFields(fields: Field[], collectionGrantAliases: ReadonlySet<string>): Field[] {
  const hiddenCustomTools = new Set([
    ...collectionGrantAliases,
    ...clinicOnboardingToolNames,
    uploadEditorialImageTool.name,
  ])

  // Payload emits one top-level collapsible per collection and one separate group for custom tools.
  return fields.map((field) => {
    if (field.type !== 'collapsible') return field
    const group = field.fields.find(
      (child): child is GroupField & { name: string } =>
        child.type === 'group' && 'name' in child && typeof child.name === 'string',
    )
    if (!group) return field

    if (group.name === 'clinics') {
      return workflowSection(
        field,
        { en: 'Clinic profiles', de: 'Klinikprofile' },
        'Public listing approval stays in Payload Admin. The onboarding decision governs Dashboard access.',
        [
          permissionSection(
            { en: 'Onboarding', de: 'Onboarding' },
            'Each application needs a first staff member. Choose a new account or an activated, unassigned account.',
            clinicOnboardingGrantField,
          ),
          permissionSection(
            { en: 'Profile care', de: 'Profilpflege' },
            'Edit a profile as soon as it exists, even while the application is open.',
            group,
            field.fields,
            clinicProfileCopy,
          ),
        ],
      )
    }

    if (group.name === 'posts') {
      return workflowSection(
        field,
        { en: 'Blog posts', de: 'Blogbeiträge' },
        'Publish German and English independently. Grant image uploads separately.',
        [
          permissionSection(
            { en: 'Posts', de: 'Beiträge' },
            'Start drafts in German. Add English to the same post when available.',
            group,
            field.fields,
            postCopy,
          ),
          permissionSection(
            { en: 'Images', de: 'Bilder' },
            'Use the returned image ID to attach the asset to a draft.',
            editorialImageGrantField,
          ),
        ],
      )
    }

    if (group.name === 'payload-mcp-tool') {
      const customTools: GroupField = {
        ...group,
        fields: group.fields
          .filter((child) => child.type !== 'checkbox' || !hiddenCustomTools.has(child.name))
          .map((child) => (child.type === 'checkbox' ? { ...child, defaultValue: false } : child)),
      }
      return { ...field, fields: field.fields.map((child) => (child === group ? customTools : child)) }
    }

    return field
  })
}
