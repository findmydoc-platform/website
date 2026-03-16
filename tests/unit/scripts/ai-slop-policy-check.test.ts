import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { parseArgs, runAiSlopPolicyCheck } from '../../../scripts/ai-slop-policy-check.mjs'

const VALID_AGENTS = `# Codex Instruction Router

## Language Policy

- Chat and explanations in German unless requested otherwise.
- Code and documentation in English.

## AI Anti-Slop Policy v2

Scope exception: Global scope is intentional because this policy defines cross-repository communication quality defaults.

Rule budget:

- Max 8 hard rules in this section.
- Max 120 lines in this section.

## Priorities

- P0 correctness.
- P1 task completion.
- P2 style.

## Required Output Quality

- Rule 1: Use direct and factual wording.
- Rule 2: Separate facts from recommendations.
- Rule 3: Keep outputs concise.

## Uncertainty & Evidence

- Rule 4: Mark assumptions explicitly.
- Rule 5: Add confidence statements when evidence is incomplete.

Assumption:
Confidence:

## Forbidden Patterns

- Rule 6: Do not use social filler.
- Rule 7: Do not hide uncertainty.

## Scope & Brevity

- Rule 8: Use only necessary constraints.
`

const tempDirectories = new Set<string>()

afterEach(() => {
  for (const dirPath of tempDirectories) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
  tempDirectories.clear()
})

type RepoSetupOptions = {
  agentsContent?: string
  extraFiles?: Record<string, string>
}

function createRepo(options: RepoSetupOptions = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-slop-policy-'))
  tempDirectories.add(rootDir)

  fs.writeFileSync(path.join(rootDir, 'AGENTS.md'), options.agentsContent ?? VALID_AGENTS, 'utf8')

  if (options.extraFiles) {
    for (const [relativePath, content] of Object.entries(options.extraFiles)) {
      const absolutePath = path.join(rootDir, relativePath)
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
      fs.writeFileSync(absolutePath, content, 'utf8')
    }
  }

  return rootDir
}

describe('runAiSlopPolicyCheck', () => {
  it('passes for a valid minimal setup', () => {
    const rootDir = createRepo()

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(true)
    expect(result.failures).toHaveLength(0)
    expect(result.changedFilesMode).toBe(false)
  })

  it('fails when an instruction file exceeds the line budget', () => {
    const longBody = Array.from({ length: 205 }, (_, index) => `- Line ${index + 1}`).join('\n')
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': `# Long\n\n${longBody}\n`,
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('exceeds instruction line budget'))).toBe(true)
  })

  it('fails when the root anti-slop section is missing', () => {
    const rootDir = createRepo({
      agentsContent: '# Router\n\nNo anti-slop section here.\n',
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(
      result.failures.some((failure) => failure.includes('missing required heading: "## AI Anti-Slop Policy v2"')),
    ).toBe(true)
  })

  it('fails when policy hard-rule budget is exceeded', () => {
    const rootDir = createRepo({
      agentsContent: `${VALID_AGENTS}\n- Rule 9: Extra hard rule.\n`,
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('exceeds policy hard-rule budget'))).toBe(true)
  })

  it('fails on conflicting language policies', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': 'Chat and explanations in English.',
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('Conflicting chat language policies'))).toBe(true)
  })

  it('fails on conflicting tone policies', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': 'Allow social filler when the user is unsure.',
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('Conflicting tone policies'))).toBe(true)
  })

  it('ignores -- separator in CLI argument parsing', () => {
    const parsed = parseArgs(['--', '--changed-files', 'AGENTS.md,src/components/AGENTS.md'])

    expect(parsed.changedFiles).toEqual(['AGENTS.md', 'src/components/AGENTS.md'])
    expect(parsed.mode).toBe('strict')
  })

  it('scans nested AGENTS files in full-scan mode', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': '# Local\n- Keep component rules focused.\n',
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(true)
    expect(result.scannedPaths).toContain('src/components/AGENTS.md')
  })

  it('treats nested AGENTS files as relevant in changed-files mode', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': '# Local\nGreat question\n',
      },
    })

    const result = runAiSlopPolicyCheck({
      rootDir,
      changedFiles: ['src/components/AGENTS.md'],
    })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('banned filler phrase found'))).toBe(true)
  })

  it('keeps changed-files mode scoped to relevant files', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': 'Great question, this exists but was not changed.',
      },
    })

    const result = runAiSlopPolicyCheck({
      rootDir,
      changedFiles: ['README.md'],
    })

    expect(result.ok).toBe(true)
    expect(result.changedFilesMode).toBe(true)
    expect(result.scannedFiles).toBe(0)
  })
})
