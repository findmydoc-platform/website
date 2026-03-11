const UI_PATH_PATTERNS = [
  /^src\/app\/(frontend|payload)\//,
  /^src\/components\//,
  /^src\/blocks\//,
  /^src\/stories\//,
  /^src\/cssVariables\.js$/,
  /^src\/app\/\(frontend\)\/globals\.css$/,
]

const LOCAL_PATH_PATTERN = /(^|[\s(])(?:\.\/|\.\.\/|\/Users\/|[A-Za-z]:\\|tmp\/|playwright-report\/|test-results\/)/

const GH_IMAGE_URL_PATTERNS = [
  /^https:\/\/github\.com\/user-attachments\/assets\//,
  /^https:\/\/user-images\.githubusercontent\.com\//,
  /^https:\/\/private-user-images\.githubusercontent\.com\//,
  /^https:\/\/gist\.githubusercontent\.com\//,
  /^https:\/\/raw\.githubusercontent\.com\//,
]

export function parseCliArgs(argv) {
  const options = {
    pr: null,
    screenshotPaths: [],
    uiChange: 'auto',
    headless: false,
    timeoutMs: 120000,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--pr') {
      options.pr = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (token === '--screenshot') {
      const value = argv[index + 1]
      if (value) options.screenshotPaths.push(value)
      index += 1
      continue
    }

    if (token === '--screenshots') {
      const value = argv[index + 1] ?? ''
      const paths = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      options.screenshotPaths.push(...paths)
      index += 1
      continue
    }

    if (token === '--ui-change') {
      options.uiChange = (argv[index + 1] ?? 'auto').toLowerCase()
      index += 1
      continue
    }

    if (token === '--headless') {
      options.headless = true
      continue
    }

    if (token === '--timeout-ms') {
      const parsed = Number(argv[index + 1] ?? '120000')
      options.timeoutMs = Number.isFinite(parsed) ? parsed : 120000
      index += 1
    }
  }

  if (!['auto', 'true', 'false'].includes(options.uiChange)) {
    throw new Error('--ui-change must be one of: auto|true|false')
  }

  return options
}

export function resolveUiChange(uiChangeFlag, screenshotPaths, changedFiles) {
  if (uiChangeFlag === 'true') return true
  if (uiChangeFlag === 'false') return false
  if (screenshotPaths.length > 0) return true
  return changedFiles.some((filePath) => UI_PATH_PATTERNS.some((pattern) => pattern.test(filePath)))
}

export function isAbsolutePath(pathLike) {
  return pathLike.startsWith('/') || /^[A-Za-z]:\\/.test(pathLike)
}

export function ensureScreenshotsSection(body) {
  const normalizedBody = typeof body === 'string' ? body : ''
  const sectionMatch = findScreenshotsSection(normalizedBody)

  if (sectionMatch) {
    return {
      body: normalizedBody,
      changed: false,
      section: sectionMatch,
    }
  }

  const separator = normalizedBody.endsWith('\n') || normalizedBody.length === 0 ? '' : '\n'
  const nextBody = `${normalizedBody}${separator}\nScreenshots:\n`
  return {
    body: nextBody,
    changed: true,
    section: findScreenshotsSection(nextBody),
  }
}

export function findScreenshotsSection(body) {
  const lines = body.split('\n')
  const startIndex = lines.findIndex((line) => /^\s*Screenshots:\s*$/i.test(line))
  if (startIndex < 0) return null

  let endIndex = lines.length
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\s*[A-Z][A-Za-z\- ]+:\s*$/.test(line) && !/^\s*Screenshots:\s*$/i.test(line)) {
      endIndex = index
      break
    }
  }

  return {
    startLine: startIndex,
    endLine: endIndex,
    text: lines.slice(startIndex, endIndex).join('\n'),
  }
}

export function parseImageUrls(text) {
  const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g
  const markdownLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g
  const urls = []

  for (const regex of [markdownImageRegex, markdownLinkRegex]) {
    let match = regex.exec(text)
    while (match) {
      urls.push(match[1].trim())
      match = regex.exec(text)
    }
  }

  return [...new Set(urls)]
}

export function isLocalOrRelativePath(value) {
  if (!value) return false
  if (value.startsWith('http://') || value.startsWith('https://')) return false
  if (LOCAL_PATH_PATTERN.test(value)) return true
  return value.startsWith('/') || value.startsWith('./') || value.startsWith('../')
}

export function isAllowedGitHubImageUrl(url) {
  return GH_IMAGE_URL_PATTERNS.some((pattern) => pattern.test(url))
}

export function validateScreenshotsSection(body) {
  const section = findScreenshotsSection(body)
  if (!section) {
    return {
      valid: false,
      reason: 'Screenshots section is missing from PR body.',
    }
  }

  if (isLocalOrRelativePath(section.text)) {
    return {
      valid: false,
      reason: 'Screenshots section contains local or relative paths.',
    }
  }

  const urls = parseImageUrls(section.text)
  if (urls.length === 0) {
    return {
      valid: false,
      reason: 'Screenshots section does not contain any image URLs.',
    }
  }

  const invalidUrls = urls.filter((url) => !isAllowedGitHubImageUrl(url))
  if (invalidUrls.length > 0) {
    return {
      valid: false,
      reason: `Screenshots section contains non-GitHub image URLs: ${invalidUrls.join(', ')}`,
    }
  }

  return {
    valid: true,
    urls,
  }
}

export function findNewUrls(beforeUrls, afterUrls) {
  const beforeSet = new Set(beforeUrls)
  return afterUrls.filter((url) => !beforeSet.has(url))
}
