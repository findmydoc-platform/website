'use client'

import { FieldDescription, FieldError, FieldLabel, RenderFields, useField } from '@payloadcms/ui'
import type { CheckboxFieldClientProps, CollapsibleFieldClientProps } from 'payload'
import { useId, useState } from 'react'
import './index.scss'

export function McpPermissionSection({
  field: { admin, fields, label },
  indexPath,
  parentPath,
  parentSchemaPath,
  path,
  permissions,
  readOnly,
}: CollapsibleFieldClientProps) {
  const { disabled } = useField({ path })
  const panelId = useId()
  const overview = admin?.initCollapsed === true
  const [expanded, setExpanded] = useState(!overview)

  const hint = admin?.description && (
    <FieldDescription
      path={path}
      description={admin.description}
      className={overview ? 'mcp-permission-section__overview' : 'mcp-permission-section__hint'}
    />
  )

  return (
    <div className="mcp-permission-section">
      {overview && hint}
      <button
        type="button"
        className="mcp-permission-section__toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <FieldLabel as="span" label={label} unstyled />
      </button>
      <div id={panelId} className="mcp-permission-section__panel" hidden={!expanded}>
        {!overview && hint}
        <RenderFields
          fields={fields}
          margins="small"
          parentIndexPath={indexPath}
          parentPath={parentPath}
          parentSchemaPath={parentSchemaPath}
          permissions={permissions}
          readOnly={readOnly || disabled}
        />
      </div>
    </div>
  )
}

export function McpPermissionCheckbox({
  field: { admin, label, required },
  path: initialPath,
  readOnly,
}: CheckboxFieldClientProps) {
  const { disabled, path, setValue, showError, value } = useField<boolean>({ potentiallyStalePath: initialPath })
  const id = useId()
  const descriptionId = admin?.description ? `${id}-description` : undefined
  const errorId = showError ? `${id}-error` : undefined

  return (
    <div className="mcp-permission-checkbox">
      {showError && (
        <div id={errorId}>
          <FieldError path={path} showError={showError} />
        </div>
      )}
      <label className="mcp-permission-checkbox__label" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          name={path}
          checked={Boolean(value)}
          disabled={readOnly || disabled}
          required={required}
          aria-invalid={showError || undefined}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
          onChange={(event) => setValue(event.currentTarget.checked)}
        />
        <FieldLabel as="span" label={label} unstyled />
      </label>
      {descriptionId && (
        <div id={descriptionId}>
          <FieldDescription path={path} description={admin?.description} />
        </div>
      )}
    </div>
  )
}
