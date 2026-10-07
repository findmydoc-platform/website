import { execFileSync } from 'node:child_process'
import { validateInput } from './common.mjs'

export function parseNameStatus(output) {
  const fields = output.split('\0')
  if (fields.at(-1) === '') fields.pop()
  const changes = []
  for (let index = 0; index < fields.length;) {
    const raw = fields[index++]
    const status = raw[0]
    if (!/^(?:[MADT]|[RC]\d{1,3})$/.test(raw)) throw new Error('Unsupported change status')
    const first = fields[index++]
    if (status === 'R' || status === 'C') changes.push({ status, previousPath: first, path: fields[index++] })
    else changes.push({ status, path: first })
  }
  const input = { changes }
  if (!validateInput(input).valid) throw new Error('Invalid or empty change manifest')
  return input
}

export function collectChanges(base, head, { cwd = process.cwd() } = {}) {
  try {
    if (![base, head].every((ref) => /^[a-f0-9]{40}$/.test(ref))) throw new Error('Full revisions required')
    const mergeBase = execFileSync('git', ['merge-base', base, head], { cwd, encoding: 'utf8' }).trim()
    const output = execFileSync('git', ['diff', '--name-status', '-z', '--find-renames', mergeBase, head], {
      cwd,
      encoding: 'utf8',
    })
    return { ...parseNameStatus(output), base, head, mergeBase }
  } catch {
    return { changes: [], classificationFailed: true, base, head }
  }
}
