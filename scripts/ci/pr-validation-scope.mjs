import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function requiresApplicationValidation(files) {
  if (!Array.isArray(files) || files.some((file) => typeof file !== 'string')) {
    throw new Error('Invalid changed-path list')
  }
  return files.length === 0 || files.some((file) => !file.endsWith('.md'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const required = requiresApplicationValidation(JSON.parse(process.env.CHANGED_FILES ?? ''))
  appendFileSync(process.env.GITHUB_OUTPUT, `validation=${required}\n`)
}
