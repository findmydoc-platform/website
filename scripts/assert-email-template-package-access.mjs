import { readFile } from 'node:fs/promises'

const packageName = '@findmydoc-platform/email-templates'
const token = process.env.NODE_AUTH_TOKEN

if (!token) {
  console.error('NODE_AUTH_TOKEN with GitHub Packages read access is required before installing dependencies.')
  process.exitCode = 1
} else {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const version = manifest.dependencies?.[packageName]

  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    console.error(`${packageName} must be pinned to an exact stable version.`)
    process.exitCode = 1
  } else {
    try {
      const response = await fetch('https://npm.pkg.github.com/@findmydoc-platform%2Femail-templates', {
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.npm.install-v1+json' },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        console.error(`GitHub Packages denied ${packageName}@${version} metadata access (HTTP ${response.status}).`)
        process.exitCode = 1
      } else {
        const metadata = await response.json()
        if (!Object.hasOwn(metadata.versions ?? {}, version)) {
          console.error(`GitHub Packages did not resolve the pinned ${packageName}@${version}.`)
          process.exitCode = 1
        }
      }
    } catch {
      console.error(`Could not verify GitHub Packages access to ${packageName}@${version}.`)
      process.exitCode = 1
    }
  }
}
