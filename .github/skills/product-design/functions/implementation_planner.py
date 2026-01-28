#!/usr/bin/env python3
"""
Generate implementation task documentation from design review analysis.
Creates phased breakdown with acceptance criteria and complexity estimates.
"""

import json
import argparse
import os
from datetime import datetime
from typing import Dict, List, Any

from skill_profile import load_profile


def estimate_complexity(component_category: str, has_variants: bool, breaking_change: bool) -> tuple:
    """
    Estimate implementation complexity and time.

    Args:
        component_category: atom, molecule, organism, template
        has_variants: Whether component has variants/props
        breaking_change: Whether this is a breaking change

    Returns:
        Tuple of (complexity_level, estimated_hours)
    """
    base_hours = {
        'atom': 2,
        'molecule': 3,
        'organism': 5,
        'template': 8
    }

    hours = base_hours.get(component_category, 3)

    if has_variants:
        hours += 1

    if breaking_change:
        hours += 2

    if hours <= 2:
        complexity = 'Low'
    elif hours <= 4:
        complexity = 'Medium'
    else:
        complexity = 'High'

    return complexity, hours


def generate_token_phase(
    new_tokens: List[Dict[str, Any]],
    modified_tokens: List[Dict[str, Any]],
    tailwind_css_path: str,
) -> Dict[str, Any]:
    """Generate Phase 1: Design Tokens implementation plan."""
    total_tokens = len(new_tokens) + len(modified_tokens)
    hours = max(1, total_tokens // 10 + 1)  # 10 tokens per hour estimate

    subtasks = [
        f"Add {len(new_tokens)} new tokens to CSS variables (Tailwind v4 CSS-first)" if new_tokens else None,
        f"Update {len(modified_tokens)} modified CSS variables" if modified_tokens else None,
        "Map CSS variables into Tailwind theme tokens via `@theme inline`",
        "Verify token usage does not introduce regressions"
    ]

    acceptance_criteria = [
        f"All {total_tokens} new/modified tokens are defined in CSS variables",
        "New tokens are mapped in `@theme inline` where needed",
        "No breaking changes to existing token references"
    ]

    return {
        'name': 'Design Tokens',
        'priority': 'High',
        'estimated_hours': hours,
        'description': f'Add and update {total_tokens} design tokens',
        'subtasks': [task for task in subtasks if task],
        'acceptance_criteria': acceptance_criteria,
        'files_to_modify': [
            tailwind_css_path
        ]
    }


def component_category_to_folder(component_category: str) -> str:
    """Map atomic design category to this repo's folder naming."""
    normalized = component_category.strip().lower()

    if normalized == 'atom':
        return 'atoms'
    if normalized == 'molecule':
        return 'molecules'
    if normalized == 'organism':
        return 'organisms'
    if normalized == 'template':
        return 'templates'

    return 'molecules'


def generate_component_phase(
    component: Dict[str, Any],
    phase_number: int,
    components_root: str,
    stories_root: str,
    unit_components_tests_root: str,
) -> Dict[str, Any]:
    """Generate component implementation phase."""
    comp_name = component.get('name')
    category = component.get('category', 'molecule')
    properties = component.get('properties', {})
    similar_to = component.get('similar_to', [])

    has_variants = bool(properties.get('variants'))
    breaking_change = component.get('breaking_change', False)

    complexity, hours = estimate_complexity(category, has_variants, breaking_change)

    # Determine approach
    if similar_to and similar_to[0]['similarity'] >= 0.7:
        approach = f"Extend existing {similar_to[0]['name']} component"
        action = 'extend'
    else:
        approach = f"Create new {category} component"
        action = 'create'

    # Generate subtasks based on action
    category_folder = component_category_to_folder(category)

    component_file = f"{components_root}/{category_folder}/{comp_name}.tsx"
    story_file = f"{stories_root}/{category_folder}/{comp_name}.stories.tsx"
    test_file = f"{unit_components_tests_root}/{comp_name}.test.tsx"

    if action == 'extend':
        subtasks = [
            f"Add new variant props to {similar_to[0]['name']}",
            "Update TypeScript interface with new props",
            "Add styles for new variants",
            "Update existing tests",
            "Add Storybook stories for new variants"
        ]
        files = [
            similar_to[0].get('path', component_file),
            test_file,
            story_file
        ]
    else:
        subtasks = [
            f"Create {comp_name} component file",
            "Implement TypeScript props interface",
            "Add styles (CSS modules/Tailwind)",
            "Write unit tests",
            "Create Storybook stories"
        ]
        files = [
            component_file,
            test_file,
            story_file
        ]

    acceptance_criteria = [
        f"{comp_name} renders correctly with all variants",
        "100% test coverage for new props/variants" if action == 'extend' else "90%+ test coverage",
        "Storybook shows all component states",
        "No visual regression in existing components" if action == 'extend' else "Passes visual regression tests",
        "Accessibility audit passes (a11y addon)"
    ]

    if breaking_change:
        acceptance_criteria.insert(0, "Migration guide created for breaking changes")
        subtasks.append("Create migration documentation")

    return {
        'number': phase_number,
        'name': comp_name,
        'category': category,
        'priority': 'High' if breaking_change else 'Medium',
        'complexity': complexity,
        'estimated_hours': hours,
        'approach': approach,
        'subtasks': subtasks,
        'files_to_modify': files,
        'acceptance_criteria': acceptance_criteria,
        'breaking_change': breaking_change
    }


def generate_task_document(task_id: str,
                          feature_name: str,
                          analysis_results: Dict[str, Any],
                          review_reference: str,
                          profile: Dict[str, Any]) -> str:
    """
    Generate complete Navigator task document.

    Args:
        task_id: Task identifier (e.g., "TASK-16")
        feature_name: Feature name (e.g., "Dashboard Redesign")
        analysis_results: Combined analysis from all functions
        review_reference: Path to design review report

    Returns:
        Markdown task document
    """
    date = datetime.now().strftime('%Y-%m-%d')

    # Extract data
    new_tokens = analysis_results.get('new_tokens', [])
    modified_tokens = analysis_results.get('token_diff', {}).get('modified', [])
    new_components = analysis_results.get('new_components', [])
    similar_components = analysis_results.get('similar_components', [])
    breaking_changes = analysis_results.get('breaking_changes', [])

    # Generate phases
    phases = []

    tailwind_css_path = (
        profile.get('paths', {}).get('tailwindCss')
        if isinstance(profile.get('paths', {}), dict)
        else None
    )
    if not isinstance(tailwind_css_path, str) or not tailwind_css_path:
        tailwind_css_path = 'src/app/(frontend)/globals.css'

    components_root = profile.get('paths', {}).get('components', {}) if isinstance(profile.get('paths', {}), dict) else {}
    if not isinstance(components_root, dict):
        components_root = {}

    stories_root = profile.get('paths', {}).get('stories', {}) if isinstance(profile.get('paths', {}), dict) else {}
    if not isinstance(stories_root, dict):
        stories_root = {}

    unit_components_tests_root = profile.get('paths', {}).get('tests', {}) if isinstance(profile.get('paths', {}), dict) else {}
    if not isinstance(unit_components_tests_root, dict):
        unit_components_tests_root = {}

    components_base = 'src/components'
    stories_base = 'src/stories'
    tests_base = 'tests/unit/components'

    # Prefer profile paths
    atoms_components_path = components_root.get('atoms')
    if isinstance(atoms_components_path, str) and atoms_components_path:
        components_base = os.path.dirname(atoms_components_path)

    atoms_stories_path = stories_root.get('atoms')
    if isinstance(atoms_stories_path, str) and atoms_stories_path:
        stories_base = os.path.dirname(atoms_stories_path)

    if isinstance(unit_components_tests_root.get('unitComponentsDir'), str):
        tests_base = unit_components_tests_root['unitComponentsDir']

    # Phase 1: Always start with tokens if any exist
    if new_tokens or modified_tokens:
        phases.append(generate_token_phase(new_tokens, modified_tokens, tailwind_css_path))

    # Phase 2+: Component implementations
    for i, comp in enumerate(new_components + similar_components, start=2):
        phases.append(generate_component_phase(comp, i, components_base, stories_base, tests_base))

    # Calculate totals
    total_hours = sum(phase.get('estimated_hours', 0) for phase in phases)
    total_complexity = 'High' if total_hours > 10 else 'Medium' if total_hours > 5 else 'Low'

    # Build markdown document
    doc = f"""# {task_id}: {feature_name} Implementation

**Created**: {date}
**Status**: Ready for Development
**Priority**: High
**Complexity**: {total_complexity}
**Estimated Time**: {total_hours} hours

---

## Context

Implement {feature_name} from Figma mockup with design system integration.

**Design Review**: `{review_reference}`

---

## Overview

**Changes Required**:
- Design Tokens: {len(new_tokens)} new, {len(modified_tokens)} modified
- Components: {len(new_components)} new, {len(similar_components)} to extend
- Breaking Changes: {len(breaking_changes)}

**Implementation Strategy**: Phased approach following atomic design hierarchy

---

## Implementation Phases

"""

    # Add each phase
    for i, phase in enumerate(phases, start=1):
        doc += f"""### Phase {i}: {phase['name']}

**Priority**: {phase['priority']}
**Complexity**: {phase.get('complexity', 'Medium')}
**Estimated Time**: {phase['estimated_hours']} hours

#### Approach
{phase.get('approach', phase.get('description', 'Implement component following project patterns'))}

#### Subtasks
"""
        for subtask in phase['subtasks']:
            doc += f"- {subtask}\n"

        doc += f"""
#### Files to Modify
"""
        for file in phase.get('files_to_modify', []):
            doc += f"- `{file}`\n"

        doc += f"""
**Acceptance Criteria**:
"""
        for criterion in phase['acceptance_criteria']:
            doc += f"- [ ] {criterion}\n"

        doc += "\n---\n\n"

    # Add testing strategy
    doc += """## Testing Strategy

### Unit Tests
- All new/modified components
- Test all variants and props
- Error states and edge cases
- Target: 90%+ coverage

### Stories / Visual Coverage
- Add/extend Storybook stories under src/stories/**
- Verify all variants and states are represented

### Integration Tests
- Test component composition
- Verify design token usage
- Test responsive behavior

### Accessibility
- Run a11y addon in Storybook
- Keyboard navigation testing
- Screen reader verification
- WCAG 2.2 Level AA compliance

---

## Rollout Plan

1. **Phase 1: Tokens** (no visual changes, safe to deploy)
2. **Phase 2-N: Components** (incremental deployment)
   - Deploy each component after testing
   - Monitor for issues before next phase
3. **Final: Integration** (full feature integration)

**Rollback Strategy**: Each phase is independent and can be reverted

---

## Success Metrics

- [ ] 100% design fidelity vs Figma mockup
- [ ] All acceptance criteria met
- [ ] No visual regressions
- [ ] All accessibility checks pass
- [ ] Performance budget maintained (no layout shifts)

---

## Design System Impact

**UI Kit Inventory**: Update after each component completion

**Token Additions**: {len(new_tokens)} new tokens added to design system

**Component Reuse**: {len(similar_components)} opportunities to extend existing components

---

## Notes

{f"⚠️  **Breaking Changes**: {len(breaking_changes)} component(s) require migration - see phase details" if breaking_changes else "✅ No breaking changes - backward compatible implementation"}

---

**Last Updated**: {date}
**Navigator Version**: 3.2.0
"""

    return doc


def main():
    parser = argparse.ArgumentParser(
        description='Generate implementation task document from design review'
    )
    parser.add_argument(
        '--task-id',
        required=True,
        help='Task identifier (e.g., TASK-16)'
    )
    parser.add_argument(
        '--feature-name',
        required=True,
        help='Feature name (e.g., "Dashboard Redesign")'
    )
    parser.add_argument(
        '--analysis-results',
        required=True,
        help='Path to JSON file with combined analysis results'
    )
    parser.add_argument(
        '--review-reference',
        required=True,
        help='Path to design review report'
    )
    parser.add_argument(
        '--profile',
        help='Path to repo profile JSON (default: profiles/findmydoc.json)'
    )
    parser.add_argument(
        '--output',
        help='Output file path (default: stdout)'
    )

    args = parser.parse_args()

    # Load analysis results
    with open(args.analysis_results, 'r') as f:
        analysis_results = json.load(f)

    profile = load_profile(args.profile)

    # Generate task document
    task_doc = generate_task_document(
        args.task_id,
        args.feature_name,
        analysis_results,
        args.review_reference,
        profile
    )

    # Output
    if args.output:
        with open(args.output, 'w') as f:
            f.write(task_doc)
    else:
        print(task_doc)


if __name__ == '__main__':
    main()
