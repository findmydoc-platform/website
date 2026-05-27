export const renderAttachmentMarkdown = (options: { altText?: string; assetHref: string; body?: string }): string => {
  const parts = []
  const body = options.body?.trim()
  if (body) {
    parts.push(body)
  }

  parts.push(`![${options.altText ?? 'attachment'}](${options.assetHref})`)

  return `${parts.join('\n\n')}\n`
}
