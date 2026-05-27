import * as React from 'react'

export function RefreshRouteOnSave({ serverURL }) {
  return React.createElement('div', null, `Live preview connected to ${serverURL ?? ''}`)
}
