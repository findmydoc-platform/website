import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

type BiographyRow = Readonly<{
  biography: unknown
  id: number
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractLexicalNodeText(node: unknown): string {
  if (!isRecord(node)) return ''
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  if (node.type === 'linebreak') return '\n'

  return Array.isArray(node.children) ? node.children.map(extractLexicalNodeText).join('') : ''
}

export function flattenLexicalBiography(value: unknown): string | null {
  if (!isRecord(value)) return null

  const root = isRecord(value.root) ? value.root : value
  if (!Array.isArray(root.children)) return null

  const text = root.children
    .map(extractLexicalNodeText)
    .filter((block) => block.trim().length > 0)
    .join('\n\n')
    .trim()

  return text || null
}

function paragraphChildren(paragraph: string) {
  return paragraph.split('\n').flatMap((line, index) => {
    const nodes: Record<string, unknown>[] = []
    if (index > 0) {
      nodes.push({
        type: 'linebreak',
        version: 1,
      })
    }
    if (line) {
      nodes.push({
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: line,
        type: 'text',
        version: 1,
      })
    }
    return nodes
  })
}

export function plainTextBiographyToLexical(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value.trim()) return null

  const children = value
    .trim()
    .split(/\n\s*\n/u)
    .map((paragraph) => ({
      children: paragraphChildren(paragraph),
      direction: null,
      format: '',
      indent: 0,
      type: 'paragraph',
      version: 1,
    }))

  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const biographies = await db.execute(sql`
    SELECT "id", "biography"
    FROM "doctors"
    WHERE "biography" IS NOT NULL
  `)

  await db.execute(sql`
    ALTER TABLE "doctors"
    ALTER COLUMN "biography" SET DATA TYPE varchar
    USING NULL
  `)

  for (const row of biographies.rows as BiographyRow[]) {
    const biography = flattenLexicalBiography(row.biography)
    await db.execute(sql`
      UPDATE "doctors"
      SET "biography" = ${biography}
      WHERE "id" = ${row.id}
    `)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const biographies = await db.execute(sql`
    SELECT "id", "biography"
    FROM "doctors"
    WHERE "biography" IS NOT NULL
  `)

  await db.execute(sql`
    ALTER TABLE "doctors"
    ALTER COLUMN "biography" SET DATA TYPE jsonb
    USING NULL
  `)

  for (const row of biographies.rows as BiographyRow[]) {
    const biography = plainTextBiographyToLexical(row.biography)
    if (!biography) continue

    await db.execute(sql`
      UPDATE "doctors"
      SET "biography" = ${JSON.stringify(biography)}::jsonb
      WHERE "id" = ${row.id}
    `)
  }
}
