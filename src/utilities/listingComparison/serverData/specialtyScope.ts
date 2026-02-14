import type { SpecialtyMeta } from './types'

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
