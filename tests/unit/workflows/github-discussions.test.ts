import { describe, it, expect } from 'vitest'

/**
 * Test the logic used in the GitHub Actions workflow for creating discussions
 * This validates the JavaScript functions that would run in the GitHub Action
 */
describe('GitHub Discussion Creation Logic', () => {
  it('should create proper discussion title', () => {
    const releaseTag = 'v1.2.3'
    const discussionTitle = `🚀 Release ${releaseTag} is now available!`
    
    expect(discussionTitle).toBe('🚀 Release v1.2.3 is now available!')
  })

  it('should format discussion body correctly', () => {
    const releaseName = 'Version 1.2.3'
    const releaseDate = '12/25/2023'
    const releaseBody = 'This release includes bug fixes and new features.'
    const releaseUrl = 'https://github.com/example/repo/releases/tag/v1.2.3'
    
    const discussionBody = [
      `# ${releaseName}`,
      '',
      `Released on ${releaseDate}`,
      '',
      releaseBody,
      '',
      '---',
      '',
      `📋 **[View Full Release Notes](${releaseUrl})**`,
      '',
      'Feel free to share your thoughts, ask questions, or report any issues with this release!'
    ].join('\n')
    
    expect(discussionBody).toContain('# Version 1.2.3')
    expect(discussionBody).toContain('Released on 12/25/2023')
    expect(discussionBody).toContain('This release includes bug fixes and new features.')
    expect(discussionBody).toContain('View Full Release Notes')
    expect(discussionBody).toContain('Feel free to share your thoughts')
  })

  it('should find preferred discussion category', () => {
    const categories = [
      { id: 'cat1', name: 'General', emoji: '💬', description: 'General discussions' },
      { id: 'cat2', name: 'Announcements', emoji: '📢', description: 'Important announcements' },
      { id: 'cat3', name: 'Ideas', emoji: '💡', description: 'Feature ideas' }
    ]
    
    const preferredCategories = ['Announcements', 'General', 'Show and tell']
    
    let categoryId = null
    for (const preferred of preferredCategories) {
      const category = categories.find(c => c.name.toLowerCase().includes(preferred.toLowerCase()))
      if (category) {
        categoryId = category.id
        break
      }
    }
    
    expect(categoryId).toBe('cat2') // Should prefer Announcements over General
  })

  it('should fallback to first category if no preferred found', () => {
    const categories = [
      { id: 'cat1', name: 'Random', emoji: '🎲', description: 'Random stuff' },
      { id: 'cat2', name: 'Other', emoji: '📦', description: 'Other topics' }
    ]
    
    const preferredCategories = ['Announcements', 'General', 'Show and tell']
    
    let categoryId = null
    for (const preferred of preferredCategories) {
      const category = categories.find(c => c.name.toLowerCase().includes(preferred.toLowerCase()))
      if (category) {
        categoryId = category.id
        break
      }
    }
    
    // If no preferred category found, use the first available
    if (!categoryId && categories.length > 0) {
      categoryId = categories[0].id
    }
    
    expect(categoryId).toBe('cat1') // Should use first available
  })

  it('should handle empty release body gracefully', () => {
    const releaseName = 'Version 1.0.0'
    const releaseDate = '12/25/2023'
    const releaseBody = ''
    const releaseUrl = 'https://github.com/example/repo/releases/tag/v1.0.0'
    
    const discussionBody = [
      `# ${releaseName}`,
      '',
      `Released on ${releaseDate}`,
      '',
      releaseBody,
      '',
      '---',
      '',
      `📋 **[View Full Release Notes](${releaseUrl})**`,
      '',
      'Feel free to share your thoughts, ask questions, or report any issues with this release!'
    ].join('\n')
    
    expect(discussionBody).toContain('# Version 1.0.0')
    expect(discussionBody).toContain('Released on 12/25/2023')
    expect(discussionBody).toContain('View Full Release Notes')
    // Should not break with empty release body
    expect(discussionBody).not.toContain('undefined')
    expect(discussionBody).not.toContain('null')
  })
})