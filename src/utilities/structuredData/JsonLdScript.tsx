import type { JsonLdNode } from './types'
import { cleanJsonLdNode, cleanJsonLdNodes } from './internal'

export type JsonLdScriptProps = {
  data: JsonLdNode | JsonLdNode[] | null | undefined
}

const serializeJsonLd = (data: JsonLdNode | JsonLdNode[]): string => JSON.stringify(data).replace(/</g, '\\u003c')

export function JsonLdScript({ data }: JsonLdScriptProps) {
  const jsonLd = Array.isArray(data) ? cleanJsonLdNodes(data) : cleanJsonLdNode(data)

  if (!jsonLd || (Array.isArray(jsonLd) && jsonLd.length === 0)) return null

  if (Array.isArray(jsonLd)) {
    return (
      <>
        {jsonLd.map((node, index) => (
          <script key={index} type="application/ld+json">
            {serializeJsonLd(node)}
          </script>
        ))}
      </>
    )
  }

  return <script type="application/ld+json">{serializeJsonLd(jsonLd)}</script>
}
