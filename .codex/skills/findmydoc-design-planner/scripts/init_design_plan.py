#!/usr/bin/env python3
"""Create a self-contained findmydoc design-planning scenario folder."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_ROADMAP_ROOT = REPO_ROOT / "docs" / "roadmap"


def slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if not slug:
        raise ValueError("slug cannot be empty")
    return slug


def build_readme(title: str, topic: str, scenario: str) -> str:
    return f"""# {title}

## Executive Summary

- Scenario:
- Patient problem:
- Patient decision:
- Trust/transparency outcome:

## Current State

- Inspected routes/components/collections:
- Current UX behavior:
- Current limitations:
- Reference screenshots:

## User Journey

1. Patient entry point:
2. Decision moment:
3. Trust-building moment:
4. Uncertainty or failure state:
5. Final outcome:

## Mermaid Flow

```mermaid
flowchart TD
  A["Patient starts {scenario}"] --> B["Reviews transparent information"]
  B --> C["Compares documented options"]
  C --> D["Takes the next allowed action"]
```

## Functional Requirements

### Must

- 

### Should

- 

### Must Not

- 

### Out of Scope

- 

## Visual Mockups

| Mockup | File | Purpose | Functions shown | Notes |
| --- | --- | --- | --- | --- |
| Mobile | `mobile.png` |  |  |  |
| Tablet | `tablet.png` |  |  |  |
| Desktop | `desktop.png` |  |  |  |

## Visible UI Contract

Anything not documented in this table is out of implementation scope.

| UI element | Patient value | Trust/transparency purpose | Data source | Component ownership | Allowed behavior |
| --- | --- | --- | --- | --- | --- |
|  |  |  | Data Gap |  |  |

## Data Model Plan

| Collection/source | Needed fields | Relationship | Permissions | Provenance/freshness | Status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  | Data Gap |  |

## Component Plan

| Feature | Reuse/change/new | Candidate component or module | Notes |
| --- | --- | --- | --- |
|  |  |  |  |

## Differences From Current Implementation

- Mobile:
- Tablet:
- Desktop:

## Acceptance Criteria

- Mobile:
- Tablet:
- Desktop:
- Data source:
- Accessibility:
- Review:

## Specialist Review Handoff

- `plan_design_reviewer`: required against this single scenario folder.
- `mobile_ui_reviewer`:
- `accessibility_reviewer`:
- `security_reviewer`:
- `seo_reviewer`:
- `web_vitals_reviewer`:

## Assumptions and Data Gaps

### Assumptions

- 

### Data Gaps

- 

<!-- topic: {topic}; scenario: {scenario} -->
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--topic", required=True, help="Topic slug or title")
    parser.add_argument("--scenario", required=True, help="Scenario slug or title")
    parser.add_argument("--title", required=True, help="Human-readable README title")
    parser.add_argument(
        "--root",
        default=str(DEFAULT_ROADMAP_ROOT),
        help="Roadmap root directory, defaults to docs/roadmap",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite README.md when it already exists",
    )
    args = parser.parse_args()

    topic = slugify(args.topic)
    scenario = slugify(args.scenario)
    root = Path(args.root)
    target = root / topic / scenario
    target.mkdir(parents=True, exist_ok=True)

    readme_path = target / "README.md"
    if readme_path.exists() and not args.force:
        raise SystemExit(f"README.md already exists: {readme_path}")

    readme_path.write_text(build_readme(args.title, topic, scenario), encoding="utf-8")

    for filename in ("mobile.png", "tablet.png", "desktop.png"):
        placeholder = target / filename
        if not placeholder.exists():
            placeholder.with_suffix(".pending").write_text(
                "Replace with a generated image copied from $CODEX_HOME/generated_images.\n",
                encoding="utf-8",
            )

    print(f"Created design plan scaffold: {target}")
    print("Replace *.pending files with generated mobile.png, tablet.png, and desktop.png.")


if __name__ == "__main__":
    main()
