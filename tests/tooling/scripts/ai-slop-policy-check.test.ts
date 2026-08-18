import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { isAiSlopRelevantPath, parseArgs, runAiSlopPolicyCheck } from '../../../scripts/ai-slop-policy-check.mjs'

const VALID_AGENTS = `# Codex Instruction Router

## Language Policy

- Chat and explanations in German unless requested otherwise.
- Code and documentation in English.
`

const LONG_INSTRUCTION = Array.from({ length: 205 }, (_, index) => `- Line ${index + 1}`).join('\n')
const MANY_HARD_RULES = Array.from({ length: 25 }, (_, index) => `- Must enforce constraint ${index + 1}.`).join('\n')

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
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': `# Long\n\n${LONG_INSTRUCTION}\n`,
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('exceeds instruction line budget'))).toBe(true)
  })

  it('fails when an instruction file exceeds the hard-rule budget', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': `# Hard rules\n\n${MANY_HARD_RULES}\n`,
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('exceeds hard-rule density budget'))).toBe(true)
  })

  it('fails when an instruction file exceeds the example-block budget', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': '# Examples\n\n```text\none\n```\n\n```text\ntwo\n```\n',
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('exceeds example block budget'))).toBe(true)
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
        'src/AGENTS.md': 'Avoid social filler.',
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

  it('scans Codex agent, rule, and skill instruction surfaces in full-scan mode', () => {
    const rootDir = createRepo({
      extraFiles: {
        '.codex/agents/example-reviewer.toml': 'name = "example_reviewer"\ndescription = "Review one thing."\n',
        '.codex/rules/example.rules': 'prefix_rule(pattern = ["git"], decision = "prompt")\n',
        '.codex/skills/example/SKILL.md': '---\nname: example\ndescription: Example skill.\n---\n\n# Example\n',
        '.codex/skills/example/agents/openai.yaml': "interface:\n  display_name: 'Example'\n",
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(true)
    expect(result.scannedPaths).toContain('.codex/agents/example-reviewer.toml')
    expect(result.scannedPaths).toContain('.codex/rules/example.rules')
    expect(result.scannedPaths).toContain('.codex/skills/example/SKILL.md')
    expect(result.scannedPaths).toContain('.codex/skills/example/agents/openai.yaml')
  })

  it('allows skill reference docs to use a small number of example blocks', () => {
    const rootDir = createRepo({
      extraFiles: {
        '.codex/skills/example/references/reference.md': [
          '# Reference',
          '',
          '```text',
          'example one',
          '```',
          '',
          '```text',
          'example two',
          '```',
          '',
          '```text',
          'example three',
          '```',
          '',
        ].join('\n'),
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(true)
    expect(result.scannedPaths).toContain('.codex/skills/example/references/reference.md')
  })

  it('discovers matching engineering playbooks in full-scan mode', () => {
    const rootDir = createRepo({
      extraFiles: {
        'docs/engineering/new-ai-review-playbook.md': '# Future AI Playbook\n',
        'docs/engineering/new-instruction-review-playbook.md': '# Future Instruction Playbook\n',
      },
    })

    const result = runAiSlopPolicyCheck({ rootDir })

    expect(result.ok).toBe(true)
    expect(result.scannedPaths).toContain('docs/engineering/new-ai-review-playbook.md')
    expect(result.scannedPaths).toContain('docs/engineering/new-instruction-review-playbook.md')
  })

  it('treats nested AGENTS files as relevant in changed-files mode', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': `# Local\n${LONG_INSTRUCTION}\n`,
      },
    })

    const result = runAiSlopPolicyCheck({
      rootDir,
      changedFiles: ['src/components/AGENTS.md'],
    })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('exceeds instruction line budget'))).toBe(true)
  })

  it('treats the mobile playbook as relevant in changed-files mode', () => {
    const rootDir = createRepo({
      extraFiles: {
        'docs/frontend/mobile-ai-playbook.md': `${LONG_INSTRUCTION}\n`,
      },
    })

    const result = runAiSlopPolicyCheck({
      rootDir,
      changedFiles: ['docs/frontend/mobile-ai-playbook.md'],
    })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('exceeds instruction line budget'))).toBe(true)
    expect(result.scannedPaths).toContain('docs/frontend/mobile-ai-playbook.md')
  })

  it.each([
    ['Codex agent TOML', '.codex/agents/example-reviewer.toml'],
    ['Codex rule file', '.codex/rules/example.rules'],
    ['Codex skill markdown', '.codex/skills/example/SKILL.md'],
    ['Codex skill agent metadata', '.codex/skills/example/agents/openai.yaml'],
    ['Nested Codex skill agent metadata', '.codex/skills/productivity/example/agents/openai.yaml'],
    ['AI engineering playbook', 'docs/engineering/new-ai-review-playbook.md'],
    ['instruction engineering playbook', 'docs/engineering/new-instruction-review-playbook.md'],
  ])('treats %s as relevant in changed-files mode', (_label, relativePath) => {
    const rootDir = createRepo({
      extraFiles: {
        [relativePath]: `${LONG_INSTRUCTION}\n`,
      },
    })

    const result = runAiSlopPolicyCheck({
      rootDir,
      changedFiles: [relativePath],
    })

    expect(result.ok).toBe(false)
    expect(result.failures.some((failure) => failure.includes('exceeds instruction line budget'))).toBe(true)
    expect(result.scannedPaths).toContain(relativePath)
  })

  it('exposes the same path relevance check for the pre-push wrapper', () => {
    const rootDir = createRepo({
      extraFiles: {
        '.codex/agents/example-reviewer.toml': 'name = "example_reviewer"\n',
        '.codex/rules/example.rules': 'prefix_rule(pattern = ["git"], decision = "prompt")\n',
        '.codex/skills/example/SKILL.md': '# Example\n',
        '.codex/skills/example/agents/openai.yaml': "interface:\n  display_name: 'Example'\n",
        '.codex/skills/productivity/example/agents/openai.yaml': "interface:\n  display_name: 'Nested example'\n",
        'docs/engineering/new-ai-review-playbook.md': '# Future AI Playbook\n',
        'docs/engineering/new-instruction-review-playbook.md': '# Future Instruction Playbook\n',
        'README.md': '# Not in scope\n',
      },
    })

    const relevantPaths = [
      '.codex/agents/example-reviewer.toml',
      '.codex/rules/example.rules',
      '.codex/skills/example/SKILL.md',
      '.codex/skills/example/agents/openai.yaml',
      '.codex/skills/productivity/example/agents/openai.yaml',
      'docs/engineering/new-ai-review-playbook.md',
      'docs/engineering/new-instruction-review-playbook.md',
    ]

    for (const relativePath of relevantPaths) {
      expect(isAiSlopRelevantPath(rootDir, relativePath)).toBe(true)
    }

    expect(isAiSlopRelevantPath(rootDir, 'README.md')).toBe(false)
  })

  it('keeps changed-files mode scoped to relevant files', () => {
    const rootDir = createRepo({
      extraFiles: {
        'src/components/AGENTS.md': LONG_INSTRUCTION,
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
