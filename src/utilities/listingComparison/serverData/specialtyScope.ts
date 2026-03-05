import type { SpecialtyFilterOption, SpecialtyMeta } from './types'

export function buildSpecialtyTree(allSpecialties: SpecialtyMeta[]): Map<number, number[]> {
  const children = new Map<number, number[]>()

  allSpecialties.forEach((specialty) => {
    if (!specialty.parentId) return
    const siblings = children.get(specialty.parentId) ?? []
    siblings.push(specialty.id)
    children.set(specialty.parentId, siblings)
  })

  return children
}

export function collectDescendantSpecialties(seed: number[], specialtyTree: Map<number, number[]>): Set<number> {
  const queue = [...seed]
  const visited = new Set<number>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue

    visited.add(current)
    const children = specialtyTree.get(current) ?? []
    children.forEach((child) => {
      if (!visited.has(child)) {
        queue.push(child)
      }
    })
  }

  return visited
}

function byName(left: SpecialtyMeta, right: SpecialtyMeta): number {
  return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
}

/**
 * Builds deterministic hierarchy options for a single-select specialty sidebar.
 * Options are emitted in pre-order traversal (parent before children).
 */
export function buildSpecialtyFilterOptions(allSpecialties: SpecialtyMeta[]): SpecialtyFilterOption[] {
  const specialtyById = new Map(allSpecialties.map((specialty) => [specialty.id, specialty]))
  const specialtyTree = buildSpecialtyTree(allSpecialties)
  const options: SpecialtyFilterOption[] = []
  const visited = new Set<number>()

  const roots = allSpecialties
    .filter((specialty) => specialty.parentId === null || !specialtyById.has(specialty.parentId))
    .sort(byName)

  const walk = (specialty: SpecialtyMeta, depth: number, parentValue: string | null) => {
    if (visited.has(specialty.id)) return
    visited.add(specialty.id)

    options.push({
      value: String(specialty.id),
      label: specialty.name,
      depth,
      parentValue,
    })

    const childIds = specialtyTree.get(specialty.id) ?? []
    const childNodes = childIds
      .map((childId) => specialtyById.get(childId))
      .filter((child): child is SpecialtyMeta => Boolean(child))
      .sort(byName)

    childNodes.forEach((child) => {
      walk(child, depth + 1, String(specialty.id))
    })
  }

  roots.forEach((root) => walk(root, 0, null))

  // Safety net for cyclic or disconnected records.
  allSpecialties
    .filter((specialty) => !visited.has(specialty.id))
    .sort(byName)
    .forEach((specialty) => walk(specialty, 0, null))

  return options
}

/**
 * Resolves the full parent chain from root to a target specialty.
 */
export function buildSpecialtyPath(
  specialtyId: number | null,
  specialtyById: Map<number, SpecialtyMeta>,
): SpecialtyMeta[] {
  if (specialtyId === null) return []
  const chain: SpecialtyMeta[] = []
  const visited = new Set<number>()
  let cursorId: number | null = specialtyId

  while (cursorId !== null) {
    if (visited.has(cursorId)) break
    visited.add(cursorId)

    const specialty = specialtyById.get(cursorId)
    if (!specialty) break

    chain.push(specialty)
    cursorId = specialty.parentId
  }

  return chain.reverse()
}
