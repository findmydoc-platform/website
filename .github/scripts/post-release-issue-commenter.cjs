/**
 * Post-release issue commenter helpers.
 *
 * The workflow should only comment on issues that were actually completed
 * in the release window. GitHub's `state_reason` gives us the explicit
 * closure reason so we can exclude `not_planned`, `duplicate`, and similar
 * closures.
 */

function isEligibleClosedIssueForRelease({ issue, previousReleaseDate, releaseDate }) {
  if (!issue || issue.pull_request || !issue.closed_at) {
    return false
  }

  if (issue.state_reason !== 'completed') {
    return false
  }

  const closedAt = new Date(issue.closed_at)
  if (Number.isNaN(closedAt.getTime())) {
    return false
  }

  return closedAt >= previousReleaseDate && closedAt <= releaseDate
}

function filterEligibleClosedIssuesForRelease(issues, { previousReleaseDate, releaseDate }) {
  return issues.filter((issue) =>
    isEligibleClosedIssueForRelease({
      issue,
      previousReleaseDate,
      releaseDate,
    }),
  )
}

module.exports = {
  filterEligibleClosedIssuesForRelease,
  isEligibleClosedIssueForRelease,
}
