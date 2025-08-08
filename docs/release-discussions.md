# Release GitHub Discussions

This documents the automated GitHub Discussion creation for releases.

## Overview

When a new release is published, the `post-release.yml` GitHub Actions workflow automatically:

1. **Creates a GitHub Discussion** in the repository with release information
2. **Comments on closed issues** that were included in the release

## Discussion Creation Process

### Workflow: `.github/workflows/post-release.yml`

The workflow includes a `create-discussion` job that:

1. **Queries Repository Metadata**
   - Gets repository ID using GitHub GraphQL API
   - Retrieves available discussion categories

2. **Selects Discussion Category**
   - Prefers categories in this order: "Announcements", "General", "Show and tell"
   - Falls back to the first available category if none of the preferred ones exist

3. **Creates Discussion Content**
   - **Title**: `🚀 Release [tag] is now available!`
   - **Body**: Includes:
     - Release name as header
     - Release date
     - Full release notes/changelog
     - Link to GitHub release page
     - Call-to-action for feedback

4. **Creates Discussion**
   - Uses GitHub GraphQL API `createDiscussion` mutation
   - Logs success/failure to workflow output

### Permissions Required

The workflow requires these permissions:
- `contents: read` - To read release information
- `discussions: write` - To create discussions
- `issues: write` - To comment on issues (existing functionality)

### Error Handling

- If no discussion categories exist, the workflow logs an error and skips discussion creation
- GraphQL API errors are caught and logged with detailed error information
- Workflow continues to process issue comments even if discussion creation fails

## Discussion Content Format

Example discussion created for release `v1.2.3`:

```markdown
# My Application v1.2.3

Released on 12/25/2023

## What's Changed
- Fixed login bug
- Added new dashboard features
- Improved performance

**Full Changelog**: https://github.com/example/repo/compare/v1.2.2...v1.2.3

---

📋 **[View Full Release Notes](https://github.com/example/repo/releases/tag/v1.2.3)**

Feel free to share your thoughts, ask questions, or report any issues with this release!
```

## Removed Components

The following Slack integration components were removed:

- `.github/workflows/slack-release-notification.yml` - Slack notification workflow
- `.github/scripts/github-to-slack.js` - Slack posting script

## Testing

Unit tests for the discussion creation logic are available in:
- `tests/unit/workflows/github-discussions.test.ts`

Run tests with:
```bash
npm test -- tests/unit/workflows/github-discussions.test.ts
```