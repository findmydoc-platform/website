import type { CollapsibleField, Field, GroupField } from 'payload'

import { clinicOnboardingGrantField, clinicOnboardingToolNames } from './clinicOnboarding'
import { editorialImageGrantField } from './editorialImageGrants'
import { uploadEditorialImageTool } from './editorialImageTool'

type GrantCopy = {
  label: string
  description: string
}

const clinicProfileCopy: Record<string, GrantCopy> = {
  find: {
    label: 'Read clinic profiles',
    description: 'View profile details and public listing status.',
  },
  create: {
    label: 'Create clinic profiles directly',
    description: 'Create a standalone profile. Use Onboarding to include the first staff member.',
  },
  update: {
    label: 'Edit clinic profiles',
    description: 'Change address, opening hours, website and other public details.',
  },
}

const postCopy: Record<string, GrantCopy> = {
  find: {
    label: 'Read posts',
    description: 'Find posts and read available drafts.',
  },
  create: {
    label: 'Create posts',
    description: 'Start a German draft or create a post directly.',
  },
  update: {
    label: 'Edit and publish posts',
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
    admin: {
      ...group.admin,
      components: { ...group.admin?.components, Field: `${permissionComponents}#McpPermissionGroup` },
    },
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
        'Clinic profiles',
        'Public listing approval stays in Payload Admin. The onboarding decision governs Dashboard access.',
        [
          permissionSection(
            'Onboarding',
            'Each application needs a first staff member. Choose a new account or an activated, unassigned account.',
            clinicOnboardingGrantField,
          ),
          permissionSection(
            'Profile care',
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
        'Blog posts',
        'Publish German and English independently. Grant image uploads separately.',
        [
          permissionSection(
            'Posts',
            'Start drafts in German. Add English to the same post when available.',
            group,
            field.fields,
            postCopy,
          ),
          permissionSection(
            'Images',
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
