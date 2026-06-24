// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PREVIEW_DATA_NOTICE_COPY, PreviewDataNotice } from '@/components/templates/PreviewDataNotice/Component'

describe('PreviewDataNotice template', () => {
  it('renders the preview data disclaimer as a non-interactive note', () => {
    render(<PreviewDataNotice />)

    expect(screen.getByRole('note', { name: 'Preview data notice' })).toBeInTheDocument()
    expect(screen.getByText(PREVIEW_DATA_NOTICE_COPY)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
