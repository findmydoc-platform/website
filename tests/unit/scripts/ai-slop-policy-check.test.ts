import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { runAiSlopPolicyCheck } from '../../../scripts/ai-slop-policy-check.mjs'

const VALID_POLICY = `# AI Anti Slop
## Tone
Use direct and factual language.
## Evidence
Assumption: Document what is inferred.
Confidence: 0.0-1.0 with rationale.
## Uncertainty
State unknowns explicitly.
## Forbidden Patterns
No filler language.
## Workflow
Apply the rules before merging.
`

const VALID_AGENTS = `# Router
- Route: .github/instructions/ai-anti-slop.instructions.md
`

const VALID_COPILOT = `# Copilot
Follow project instructions.
`

const tempDirectories = new Set<string>()

afterEach(() => {
  for (const dirPath of tempDirectories) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
  tempDirectories.clear()
})

type RepoSetupOptions = {
  policyContent?: string
  agentsContent?: string
  copilotContent?: string
  extraFiles?: Record<string, string>
}

function createRepo(options: RepoSetupOptions = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-slop-policy-'))
  tempDirectories.add(rootDir)

  fs.mkdirSync(path.join(rootDir, '.github', 'instructions'), { recursive: true })
  fs.mkdirSync(path.join(rootDir, '.github', 'prompts'), { recursive: true })
  fs.mkdirSync(path.join(rootDir, '.github', 'agents'), { recursive: true })

  fs.writeFileSync(
    path.join(rootDir, '.github', 'instructions', 'ai-anti-slop.instructions.md'),
    options.policyContent ?? VALID_POLICY,
    'utf8',
  )
  fs.writeFileSync(path.join(rootDir, 'AGENTS.md'), options.agentsContent ?? VALID_AGENTS, 'utf8')
  fs.writeFileSync(
    path.join(rootDir, '.github', 'copilot-instructions.md'),
    options.copilotContent ?? VALID_COPILOT,
    'utf8',
  )

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
  it('passes in full-scan mode for a valid setup', () => {
    const rootDir = createRepo()

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(true)
    expect(result.failures).toHaveLength(0)
    expect(result.changedFilesMode).toBe(false)
  })

  it('fails in changed-files mode when a changed file contains banned filler', () => {
    const rootDir = createRepo({
      extraFiles: {
        '.github/instructions/reviewer.instructions.md': 'Great question, we can do that quickly.',
      },
    })

    const result = runAiSlopPolicyCheck({
      rootDir,
      changedFiles: ['.github/instructions/reviewer.instructions.md'],
    })

    expect(result.ok).toBe(false)
    expect(result.changedFilesMode).toBe(true)
    expect(result.failures.some((failure) => failure.includes('banned filler phrase found'))).toBe(true)
  })

  it('ignores unchanged legacy files in changed-files mode', () => {
    const rootDir = createRepo({
      extraFiles: {
        '.github/instructions/legacy.instructions.md': 'Great question, this is legacy content.',
      },
    })

    const result = runAiSlopPolicyCheck({
      rootDir,
      changedFiles: ['README.md'],
    })

    expect(result.ok).toBe(true)
    expect(result.failures).toHaveLength(0)
    expect(result.changedFilesMode).toBe(true)
    expect(result.scannedFiles).toBe(0)
  })

  it('still enforces required policy structure in changed-files mode', () => {
    const rootDir = createRepo({
      policyContent: VALID_POLICY.replace('## Workflow', '## Flow'),
    })

    const result = runAiSlopPolicyCheck({
      rootDir,
      changedFiles: [],
    })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('missing required heading: "## Workflow"'))).toBe(true)
  })
})
