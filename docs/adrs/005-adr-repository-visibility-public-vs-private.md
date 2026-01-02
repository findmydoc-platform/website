# ADR: Repository Visibility: Public vs. Private for Early Development

## Status (Table)

| Name               | Content           |
|--------------------|------------------|
| Author             | Sebastian Schütze |
| Version            | 1.0              |
| Date               | 20.04.2025       |
| Status             | approved         |
| Approved by        | Youssef Adlah, Anil Sahin Gökduman, Mehmet Volker Kablan, Özen Günes |

## Background

The startup is in an early development phase, building a healthcare comparison platform using Payload CMS, React, and TypeScript. The project is not yet funded, does not involve sensitive IP, and has no investor visibility. The team considered leveraging GitHub’s public repository features to benefit from advanced free tooling and community feedback.

## Problem Description

GitHub provides valuable security and governance features for public repositories at no cost, which would otherwise require an enterprise plan or Advanced Security license for private repositories. The decision is whether the benefits of making the repository public outweigh the strategic and security risks of code visibility.

## Considerations

### GitHub Feature Comparison: Public vs. Private Repositories

| Feature                                 | Public Repo (Free)     | Private Repo (Paid unless noted) |
|-----------------------------------------|-------------------------|-----------------------------------|
| Secret Scanning                         | Yes                     | Only with Advanced Security       |
| Push Protection (Secrets)               | Yes                     | Only with Advanced Security       |
| CodeQL Code Scanning + Copilot Autofix | Yes                     | Only with Advanced Security       |
| Dependabot Alerts & Fixes              | Yes                     | Yes                               |
| Unlimited GitHub Actions Minutes       | Yes                     | Limited to 2,000/month            |
| GitHub Pages Hosting                    | Yes                     | No                                |
| Security Dashboards                     | Yes                     | Only with Advanced Security       |
| Delegated Alert Dismissal              | Yes (Public Preview)    | Only with Enterprise              |
| Community Pull Requests / Feedback     | Yes                     | No                                |

### Option 1: Public Repository (Chosen)

- **Pros**:
  - Full access to GitHub Advanced Security features (CodeQL, Secret Scanning, etc.)
  - Unlimited CI/CD via GitHub Actions
  - Free GitHub Pages (docs, marketing preview, etc.)
  - Exposure to community-driven improvements and visibility
  - Easy integration with external tools via public APIs and webhooks

- **Cons**:
  - Source code publicly visible
  - No support for SAML SSO or enterprise-level governance
  - Competitors could analyze architecture or process logic

### Option 2: Private Repository

- **Pros**:
  - Code remains hidden and access-controlled
  - Better control over feature rollout and release visibility
  - Aligns with long-term compliance and investor requirements

- **Cons**:
  - Most security features require Advanced Security license (paid)
  - CI/CD usage is limited without additional cost
  - Reduced collaboration visibility and feedback

## Decision with Rationale

We will **make the main repository public** to take advantage of GitHub’s free advanced features for public projects. In our current startup phase, we prioritize access to enterprise-grade tools over secrecy, as we are not yet handling sensitive or proprietary logic. For critical backend logic or future monetization, separate private repositories will be introduced.

## Technical Debt

- Future migration required if investor requirements or compliance concerns arise.
- Infrastructure for splitting public/private logic must be planned early to support scalability.

## Risks

- Potential for competitors to view or reuse parts of our logic or architecture.
- Requires strict secret hygiene and enforcement of gitignore/push protection policies.
- Loss of exclusivity perception if code is visible early.

## Superseded by (Optional)

N/A