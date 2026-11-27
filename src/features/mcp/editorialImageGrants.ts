import type { MCPAccessSettings } from '@payloadcms/plugin-mcp'
import type { GroupField } from 'payload'

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
      admin: { description: 'Upload an image with alt text. Limit of 3.1 MB per file.' },
    },
  ],
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
