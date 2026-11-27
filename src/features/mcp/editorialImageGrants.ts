import type { MCPAccessSettings } from '@payloadcms/plugin-mcp'
import type { Field, GroupField } from 'payload'

import { uploadEditorialImageTool } from './editorialImageTool'

export const editorialImageGrantField: GroupField = {
  type: 'group',
  name: 'blogMedia',
  label: false,
  fields: [
    {
      type: 'checkbox',
      name: 'upload',
      label: { en: 'Upload editorial images', de: 'Redaktionelle Bilder hochladen' },
      defaultValue: false,
    },
  ],
}

export function groupEditorialImageGrants(fields: Field[]): Field[] {
  return fields.map((field) => {
    if (field.type !== 'collapsible') return field
    return {
      ...field,
      fields: field.fields.map((nested) =>
        nested.type === 'group' && 'name' in nested && nested.name === 'payload-mcp-tool'
          ? {
              ...nested,
              fields: nested.fields.filter(
                (item) => item.type !== 'checkbox' || item.name !== uploadEditorialImageTool.name,
              ),
            }
          : nested,
      ),
    }
  })
}

export function mapEditorialImageGrants(settings: MCPAccessSettings): MCPAccessSettings {
  const grant = settings.blogMedia
  const canUpload = typeof grant === 'object' && grant !== null && 'upload' in grant && grant.upload === true
  return {
    ...settings,
    'payload-mcp-tool': {
      ...settings['payload-mcp-tool'],
      [uploadEditorialImageTool.name]: canUpload,
    },
  }
}
