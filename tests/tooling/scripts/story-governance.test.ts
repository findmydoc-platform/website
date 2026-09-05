import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

import { afterEach, describe, expect, it } from 'vitest'

const tempDirectories = new Set<string>()

const validStory = (title: string) => `
const meta = {
  title: '${title}',
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable'],
}

export default meta
`

const createRepo = (files: Record<string, string>) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-governance-'))
  tempDirectories.add(rootDir)

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, content, 'utf8')
  }

  return rootDir
}

const runGovernanceCheck = (rootDir: string, args: string[] = []) =>
  spawnSync(
    process.execPath,
    [path.resolve(process.cwd(), 'scripts/storybook/validate-story-governance.mjs'), ...args],
    {
      cwd: rootDir,
      encoding: 'utf8',
    },
  )

const runGit = (rootDir: string, args: string[]) =>
  execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim()

const initializeGitRepo = (rootDir: string) => {
  runGit(rootDir, ['init', '--initial-branch=main'])
  runGit(rootDir, ['config', 'user.email', 'story-governance@example.com'])
  runGit(rootDir, ['config', 'user.name', 'Story Governance Test'])
  runGit(rootDir, ['add', '.'])
  runGit(rootDir, ['commit', '-m', 'initial stories'])
  return runGit(rootDir, ['rev-parse', 'HEAD'])
}

const commitAll = (rootDir: string, message: string) => {
  runGit(rootDir, ['add', '.'])
  runGit(rootDir, ['commit', '-m', message])
}

afterEach(() => {
  for (const directory of tempDirectories) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
  tempDirectories.clear()
})

describe('story governance CLI', () => {
  it('validates central and colocated stories while keeping global MDX central', () => {
    const rootDir = createRepo({
      'src/components/atoms/Button/Button.stories.tsx': validStory('Shared/Atoms/Button'),
      'src/stories/atoms/Legacy.stories.tsx': validStory('Shared/Atoms/Legacy'),
      'src/stories/pages/storybook/guide.mdx': '<Meta title="Internal/Storybook/Pages/Guide" />',
    })

    const result = runGovernanceCheck(rootDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('passed for 2 story files and 1 MDX docs')
  })

  it('ignores MDX files outside the central Storybook guidance directory', () => {
    const rootDir = createRepo({
      'src/components/atoms/Button/Button.stories.tsx': validStory('Shared/Atoms/Button'),
      'src/components/atoms/Button/notes.mdx': 'Component-local notes without Storybook metadata.',
    })

    const result = runGovernanceCheck(rootDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('passed for 1 story files and 0 MDX docs')
  })

  it('rejects a changed central story when a base ref is supplied', () => {
    const storyPath = 'src/stories/atoms/Legacy.stories.tsx'
    const rootDir = createRepo({
      [storyPath]: validStory('Shared/Atoms/Legacy'),
    })
    const baseRef = initializeGitRepo(rootDir)
    fs.appendFileSync(path.join(rootDir, storyPath), '\n// changed\n', 'utf8')
    commitAll(rootDir, 'change legacy story')

    const result = runGovernanceCheck(rootDir, ['--base-ref', baseRef])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Move new or changed component stories beside their documented source component')
  })

  it('rejects an unstaged central story change when a base ref is supplied', () => {
    const storyPath = 'src/stories/atoms/Legacy.stories.tsx'
    const rootDir = createRepo({
      [storyPath]: validStory('Shared/Atoms/Legacy'),
    })
    const baseRef = initializeGitRepo(rootDir)
    fs.appendFileSync(path.join(rootDir, storyPath), '\n// unstaged change\n', 'utf8')

    const result = runGovernanceCheck(rootDir, ['--base-ref', baseRef])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Move new or changed component stories beside their documented source component')
  })

  it('rejects a staged central story change when a base ref is supplied', () => {
    const storyPath = 'src/stories/atoms/Legacy.stories.tsx'
    const rootDir = createRepo({
      [storyPath]: validStory('Shared/Atoms/Legacy'),
    })
    const baseRef = initializeGitRepo(rootDir)
    fs.appendFileSync(path.join(rootDir, storyPath), '\n// staged change\n', 'utf8')
    runGit(rootDir, ['add', storyPath])

    const result = runGovernanceCheck(rootDir, ['--base-ref', baseRef])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Move new or changed component stories beside their documented source component')
  })

  it('rejects a new untracked central story when a base ref is supplied', () => {
    const rootDir = createRepo({
      'README.md': '# Story governance fixture\n',
    })
    const baseRef = initializeGitRepo(rootDir)
    const storyPath = 'src/stories/atoms/NewLegacy.stories.tsx'
    const absoluteStoryPath = path.join(rootDir, storyPath)
    fs.mkdirSync(path.dirname(absoluteStoryPath), { recursive: true })
    fs.writeFileSync(absoluteStoryPath, validStory('Shared/Atoms/NewLegacy'), 'utf8')

    const result = runGovernanceCheck(rootDir, ['--base-ref', baseRef])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Move new or changed component stories beside their documented source component')
  })

  it('rejects a changed central mjs story when a base ref is supplied', () => {
    const storyPath = 'src/stories/atoms/Legacy.stories.mjs'
    const rootDir = createRepo({
      [storyPath]: validStory('Shared/Atoms/Legacy'),
    })
    const baseRef = initializeGitRepo(rootDir)
    fs.appendFileSync(path.join(rootDir, storyPath), '\n// changed\n', 'utf8')
    commitAll(rootDir, 'change legacy mjs story')

    const result = runGovernanceCheck(rootDir, ['--base-ref', baseRef])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Move new or changed component stories beside their documented source component')
  })

  it('rejects a base-ref option without a value', () => {
    const rootDir = createRepo({
      'src/components/atoms/Button/Button.stories.tsx': validStory('Shared/Atoms/Button'),
    })

    const result = runGovernanceCheck(rootDir, ['--base-ref'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--base-ref requires a Git reference')
  })

  it('allows an unchanged central legacy story when a base ref is supplied', () => {
    const rootDir = createRepo({
      'src/stories/atoms/Legacy.stories.tsx': validStory('Shared/Atoms/Legacy'),
    })
    const baseRef = initializeGitRepo(rootDir)

    const result = runGovernanceCheck(rootDir, ['--base-ref', baseRef])

    expect(result.status).toBe(0)
  })

  it.each([
    ['colocated story', 'src/features/example/Example.stories.tsx'],
    ['explicit story-only prototype', 'src/stories/templates/prototypes/Example.stories.tsx'],
  ])('allows a changed %s', (_label, storyPath) => {
    const rootDir = createRepo({
      'README.md': '# Story governance fixture\n',
    })
    const baseRef = initializeGitRepo(rootDir)
    const absoluteStoryPath = path.join(rootDir, storyPath)
    fs.mkdirSync(path.dirname(absoluteStoryPath), { recursive: true })
    fs.writeFileSync(absoluteStoryPath, validStory('Internal/Example/Atoms/Example'), 'utf8')
    commitAll(rootDir, 'add permitted story')

    const result = runGovernanceCheck(rootDir, ['--base-ref', baseRef])

    expect(result.status).toBe(0)
  })

  it('reports invalid story metadata from a colocated story', () => {
    const rootDir = createRepo({
      'src/components/atoms/Button/Button.stories.tsx': `
const meta = {
  title: 'Shared/Atoms/Button',
  tags: ['autodocs'],
}

export default meta
`,
    })

    const result = runGovernanceCheck(rootDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Missing required tag prefix "domain:"')
    expect(result.stderr).toContain('Missing required tag prefix "layer:"')
    expect(result.stderr).toContain('Missing required tag prefix "status:"')
  })

  it('reports invalid story metadata from a colocated mjs story', () => {
    const rootDir = createRepo({
      'src/components/atoms/Button/Button.stories.mjs': `
const meta = {
  title: 'Shared/Atoms/Button',
  tags: ['autodocs'],
}

export default meta
`,
    })

    const result = runGovernanceCheck(rootDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Missing required tag prefix "domain:"')
    expect(result.stderr).toContain('Missing required tag prefix "layer:"')
    expect(result.stderr).toContain('Missing required tag prefix "status:"')
  })
})
