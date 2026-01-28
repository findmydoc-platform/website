---
name: product-design
description: Automates design review, token extraction, component mapping, and implementation planning. Reduces design handoff from 6-10 hours to 5 minutes via direct Figma MCP integration. Auto-invoke when user mentions design review, Figma mockup, or design handoff.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task, TodoWrite
version: 1.1.0
---

# Product Design Skill

Automate design handoff from Figma to code with design system intelligence. Extract tokens, map components, detect drift, generate implementation plans.

## When to Invoke

Auto-invoke when user says:

- "Review this design"
- "Analyze Figma mockup"
- "Design handoff for [feature]"
- "Check design system impact"
- "Plan implementation for design"
- "Extract tokens from Figma"
- "What changed in the design?"

## What This Does

**5-Step Workflow**:

1. **Design Analysis**: Extract patterns, components, tokens from Figma
2. **Codebase Audit**: Compare design vs implementation, find drift
3. **Implementation Planning**: Generate phased task breakdown
4. **Task Assignment**: Create Navigator task document
5. **Handoff**: Ask user to review or start implementation

**Time Savings**: 6-10 hours → 15-20 minutes (95% reduction)

## Prerequisites

### Required

1. **Python Dependencies**

   ```bash
   cd .github/skills/product-design
   ./setup.sh  # Automated installation
   # OR manually: pip install -r requirements.txt
   ```

2. **Figma Desktop** (for automated workflow)
   - Download: https://www.figma.com/downloads/
   - Enable MCP: Figma → Preferences → Enable local MCP Server
   - Must be running during design reviews

3. **Project Structure**

- `tmp/product-design/` for generated (temporary) artifacts
- Project with components (React/Vue/Svelte)

### Optional (Enhanced Features)

- **Figma Enterprise**: Code Connect for automatic component mapping
- **Tailwind CSS**: Design token integration via @theme
- **Storybook**: Component documentation and visual regression

### Installation

**Quick start**:

```bash
cd .github/skills/product-design
./setup.sh
```

See `INSTALL.md` for detailed installation guide and troubleshooting.

## Workflow Protocol

### Step 0: Check Setup (Auto-Run)

**Before starting, verify Python dependencies installed**:

```bash
# Repo root (run from repo root)
REPO_ROOT="$PWD"

# Check if venv exists
if [ ! -d "$REPO_ROOT/.github/skills/product-design/venv" ]; then
  echo "❌ product-design skill not set up"
  echo ""
  echo "Run setup (30 seconds):"
  echo "  cd $REPO_ROOT/.github/skills/product-design && ./setup.sh"
  echo ""
  echo "Or use manual workflow (no Python needed)"
  exit 1
fi
```

**If setup missing**:

- Show setup instructions
- Offer manual workflow as alternative
- **Do not proceed** with automated Figma workflow

**If setup complete**:

- Continue to Step 1 (Design Analysis)

---

### Step 1: Design Analysis

**Objective**: Extract design patterns from Figma or manual description

#### With Figma MCP (Automated) ✨ SIMPLIFIED

**New Architecture** (v1.1.0+): Python directly connects to Figma MCP - no manual orchestration!

```python
# Python can connect to Figma MCP directly (report/plan only)
from figma_mcp_client import FigmaMCPClient

async with FigmaMCPClient() as client:
  metadata = await client.get_metadata()
  variables = await client.get_variable_defs()
  code_connect_map = await client.get_code_connect_map()  # optional
```

**Workflow** (report/plan only):

1. Capture design data via MCP (metadata + variables; avoid `get_design_context` by default)
2. Save a combined JSON file: `tmp/product-design/figma_combined.json`
3. Run `design_analyzer.py` against the combined JSON
4. Run audit/mapping scripts and generate an implementation plan (no code changes)

**Benefits**:

- ✅ No manual MCP tool calls by Claude
- ✅ Progressive refinement (smart token usage)
- ✅ Automatic connection management
- ✅ Built-in error handling

**Requirements**:

- Figma Desktop running
- MCP enabled in preferences
- Python dependencies installed (`./setup.sh`)

#### Manual Workflow (No MCP)

```markdown
**Ask user for design information**:

What is the feature name? [e.g., "Dashboard Redesign"]

Figma link (optional): [figma.com/file/...]

**Design Tokens**:
List new or modified tokens:

- Colors (name: value, e.g., "primary-600: #2563EB")
- Spacing (e.g., "spacing-lg: 24px")
- Typography (e.g., "heading-xl: 36px/600")
- Other (radius, shadow, etc.)

**Components**:
List components in design:

- Component name
- Type (atom, molecule, organism)
- Variants (if any, e.g., "Button: primary/secondary, sm/md/lg")
- Similar to existing component? (name if known)

**Proceed to Step 2** after gathering information
```

#### Run design_analyzer.py

```bash
# Prepare input (MCP or manual JSON)
# MCP: Save outputs into tmp/product-design/
# Manual: Create JSON from user input

python3 .github/skills/product-design/functions/design_analyzer.py \
  --figma-data tmp/product-design/figma_combined.json \
  --ui-kit-inventory tmp/product-design/ui-kit-inventory.json \
  --output tmp/product-design/analysis_results.json
```

**Analysis Output**:

- New components not in UI kit
- Similar components (reuse opportunities)
- New design tokens
- Breaking changes (if any)

---

### Step 2: Codebase Audit

**Objective**: Compare design vs implementation, detect drift

#### Token Extraction

```bash
python3 .github/skills/product-design/functions/token_extractor.py \
  --figma-variables tmp/product-design/figma_variables.json \
  --output tmp/product-design/token_extraction.json \
  --profile .github/skills/product-design/profiles/findmydoc.json
```

**Output**: DTCG formatted tokens + diff summary

#### Component Mapping

```bash
python3 .github/skills/product-design/functions/component_mapper.py \
  --figma-components tmp/product-design/analysis_results.json \
  --code-connect-map tmp/product-design/figma_code_connect.json \
  --project-root . \
  --output tmp/product-design/component_mappings.json \
  --profile .github/skills/product-design/profiles/findmydoc.json
```

**Output**: Figma component → code component mappings with confidence scores

#### Design System Audit

```bash
# Combine data for auditor
python3 .github/skills/product-design/functions/design_system_auditor.py \
  --figma-data tmp/product-design/combined_figma.json \
  --code-data tmp/product-design/combined_code.json \
  --output tmp/product-design/audit_results.json \
  --profile .github/skills/product-design/profiles/findmydoc.json
```

**Audit Results**:

- Token alignment (in sync, drift, missing, unused)
- Component reuse opportunities
- Tailwind v4 CSS-first recommendations (edits to `src/app/(frontend)/globals.css`)
- Priority level (critical, high, medium, low)

---

### Step 3: Implementation Planning

**Objective**: Generate phased implementation task document

#### Generate Task Document

```bash
python3 .github/skills/product-design/functions/implementation_planner.py \
  --task-id "TASK-{{next_task_number}}" \
  --feature-name "{{feature_name}}" \
  --analysis-results tmp/product-design/combined_analysis.json \
  --review-reference "tmp/product-design/reviews/{{date}}-{{feature-slug}}.md" \
  --output tmp/product-design/plans/TASK-{{next_task_number}}-{{feature-slug}}.md \
  --profile .github/skills/product-design/profiles/findmydoc.json
```

**Task Document Includes**:

- Phased implementation (tokens → atoms → molecules → organisms)
- Complexity estimates per phase
- Acceptance criteria checklist
- Files to modify
- Testing strategy
- Rollout plan

#### Create Design Review Report

**Use template**: `templates/design-review-report.md`

**Save to**: `tmp/product-design/reviews/YYYY-MM-DD-{{feature-name}}.md`

**Contents**:

- Design analysis summary
- Token changes (added/modified/removed)
- Component changes (new/extended/breaking)
- Design system impact
- Implementation recommendations

---

### Step 4: Task Assignment

**Objective**: Create task and assign context for implementation

#### Create PM Ticket (if configured)

```markdown
**If PM tool configured** (Linear, GitHub Issues, Jira):

- Create ticket with task summary
- Link to task document and design review
- Assign to frontend developer or team

**If no PM tool**:

- Skip ticket creation
- Task document serves as source of truth
```

#### Update Navigator Documentation

```markdown
**Update files**:

1. `tmp/product-design/plans/TASK-{{number}}-{{feature}}.md` (created in Step 3)
2. `tmp/product-design/reviews/{{date}}-{{feature}}.md` (design review)

**Use TodoWrite** to track implementation phases
```

---

### Step 5: Implementation Handoff

**Objective**: Present results and get user decision

#### Present Summary

```markdown
✅ Design review complete for {{Feature Name}}

**Generated Documentation**:

- Design review: `tmp/product-design/reviews/{{date}}-{{feature}}.md`
- Implementation plan: `tmp/product-design/plans/TASK-{{number}}-{{feature}}.md`
  {{#if pm_configured}}- PM ticket: {{ticket_id}} (status: ready for development){{/if}}

**Summary**:

- Design Tokens: {{new_count}} new, {{modified_count}} modified
- Components: {{new_components}} new, {{extend_components}} to extend
- Estimated Time: {{total_hours}} hours
- Complexity: {{complexity_level}}
  {{#if breaking_changes}}- ⚠️ Breaking Changes: {{breaking_count}} component(s){{/if}}

**Next Steps**:
[1] Start implementation now
[2] Review plan first (load task document)
[3] Modify plan before starting

**Recommended**: After implementation, set up visual regression testing:
"Set up visual regression for {{components}}"

This ensures pixel-perfect implementation and prevents future drift (15 min setup).

Reply with choice or "Start implementation"
```

#### User Decision Branches

**If user chooses [1] or says "Start implementation"**:

```markdown
1. Load task document: `Read tmp/product-design/plans/TASK-{{number}}-{{feature}}.md`
2. Load design review: `Read tmp/product-design/reviews/{{date}}-{{feature}}.md`
3. Begin Phase 1 (typically design tokens)
4. Follow autonomous completion protocol when done
5. After completion, suggest: "Set up visual regression for {{components}}" (optional but recommended)
```

**If user chooses [2]**:

```markdown
1. Load and display task document
2. Highlight key phases and acceptance criteria
3. Ask: "Ready to start or need changes?"
```

**If user chooses [3]**:

```markdown
1. Load task document
2. Ask what modifications needed
3. Edit task document
4. Regenerate if major changes
5. Then proceed to implementation
```

---

## Predefined Functions

### functions/design_analyzer.py

**Purpose**: Extract design patterns from Figma MCP data or manual input

**Usage**:

```bash
python3 .github/skills/product-design/functions/design_analyzer.py \
  --figma-data /path/to/figma_mcp_combined.json \
  --ui-kit-inventory tmp/product-design/ui-kit-inventory.json \
  --output tmp/product-design/analysis.json
```

**Input Format** (figma_mcp_combined.json):

```json
{
  "metadata": { ... },  // get_metadata response
  "variables": { ... }, // get_variable_defs response
  "code_connect_map": { ... } // get_code_connect_map response (optional)
}
```

**Output**: Component analysis with categorization (atom/molecule/organism) + similarity scores

---

### functions/token_extractor.py

**Purpose**: Convert Figma variables to DTCG format with diff

**Usage**:

```bash
python3 .github/skills/product-design/functions/token_extractor.py \
  --figma-variables /path/to/figma_variables.json \
  --format full \
  --output tmp/product-design/tokens.json \
  --profile .github/skills/product-design/profiles/findmydoc.json
```

**Output Formats**:

- `full`: DTCG tokens + diff + summary
- `tokens-only`: Just DTCG tokens
- `diff-only`: Just diff and summary

**DTCG Format** (W3C Design Tokens spec):

```json
{
  "color": {
    "primary": {
      "500": {
        "$value": "#3B82F6",
        "$type": "color",
        "$description": "Primary brand color"
      }
    }
  }
}
```

---

### functions/component_mapper.py

**Purpose**: Map Figma components to codebase components

**Usage**:

```bash
python3 .github/skills/product-design/functions/component_mapper.py \
  --figma-components /path/to/analysis_results.json \
  --code-connect-map /path/to/code_connect.json \
  --project-root . \
  --output tmp/product-design/mappings.json \
  --profile .github/skills/product-design/profiles/findmydoc.json
```

**Mapping Strategy**:

1. Code Connect first (100% confidence)
2. Fuzzy name matching (70%+ confidence)
3. Unmapped = needs creation

**Output**: Mappings with confidence scores + variant prop mapping

---

### functions/design_system_auditor.py

**Purpose**: Audit design system for drift and reuse opportunities

**Usage**:

```bash
python3 .github/skills/product-design/functions/design_system_auditor.py \
  --figma-data /path/to/combined_figma.json \
  --code-data /path/to/combined_code.json \
  --output tmp/product-design/audit.json \
  --profile .github/skills/product-design/profiles/findmydoc.json
```

**Audit Checks**:

- Token alignment (drift detection)
- Component reuse opportunities (similarity >70%)
- Unused tokens (cleanup candidates)
- Priority level assignment

---

### functions/implementation_planner.py

**Purpose**: Generate Navigator task document with phased breakdown

**Usage**:

```bash
python3 .github/skills/product-design/functions/implementation_planner.py \
  --task-id "TASK-16" \
  --feature-name "Dashboard Redesign" \
  --analysis-results /path/to/combined_analysis.json \
  --review-reference "tmp/product-design/reviews/2025-10-21-dashboard.md" \
  --output tmp/product-design/plans/TASK-16-dashboard-redesign.md \
  --profile .github/skills/product-design/profiles/findmydoc.json
```

**Output**: Complete Navigator task document with:

- Phased implementation (atomic design order)
- Complexity estimates (Low/Medium/High)
- Acceptance criteria per phase
- Testing strategy
- Rollout plan

---

## Templates

### templates/design-review-report.md

**When**: Step 3 - Creating design review documentation

**Structure**:

```markdown
# Design Review: {{Feature Name}}

**Date**: {{YYYY-MM-DD}}
**Figma**: [Link]({{figma_url}})
**Reviewer**: Navigator Product Design Skill

## New Design Tokens

[Token changes]

## New Components Required

[Component list with categories]

## Design System Impact

[High/Medium/Low impact analysis]

## Implementation Recommendations

[Phased approach]
```

---

## Artifacts (Temporary by Default)

This repo defaults generated outputs to `tmp/product-design/`.

### Initial Setup (Optional)

```bash
mkdir -p tmp/product-design/reviews tmp/product-design/plans

# Optional inventory inputs for better reuse suggestions
touch tmp/product-design/ui-kit-inventory.json
```

**ui-kit-inventory.json**:

```json
{
  "components": [
    {
      "name": "Button",
      "path": "src/components/atoms/button.tsx",
      "category": "atom",
      "variants": ["primary", "secondary", "ghost"],
      "figma_link": "..."
    }
  ],
  "tokens": {}
}
```

### File Loading Strategy

**Never load**:

- All design review reports (50+ files = 250k+ tokens)
- Full Figma MCP responses (can be 350k+ tokens)

**Always load when skill active**:

- `ui-kit-inventory.json` (~3k tokens)
- Specific design review for current task (~5k tokens)

**Total**: ~10k tokens vs 150k+ (93% reduction)

---

## Figma MCP Integration

### MCP Server Detection

**On skill invocation**:

1. Check for Figma MCP tools availability
2. Detect local vs remote server
3. Adjust workflow based on capabilities

**Local Server** (Recommended):

- URL: `http://127.0.0.1:3845/mcp`
- Tools: All (metadata, variables, code_connect, design_context)
- Requires: Figma Desktop app running

**Remote Server** (Fallback):

- URL: `https://mcp.figma.com/mcp`
- Tools: Limited (no code_connect, requires explicit URLs)
- Requires: Internet connection, explicit Figma links

### Handling Token Limits

**Problem**: Large screens return >350k tokens (exceeds default 25k limit)

**Solution**:

```markdown
1. Use `get_metadata` first (sparse XML, ~5k tokens)
2. Parse metadata to identify component node IDs
3. Prefer variables + metadata only; only fetch extra context if strictly needed
4. Aggregate results from multiple small calls

**Environment Variable** (recommended):
export MAX_MCP_OUTPUT_TOKENS=100000
```

### MCP Tool Usage

**get_metadata**: Always first for large designs

- Returns sparse XML with node IDs, types, names
- Low token cost (~5-10k)
- Use to plan component extraction strategy

**get_variable_defs**: Extract all design tokens

- One call gets all variables
- Moderate token cost (~10-20k)
- Critical for token extraction

**get_code_connect_map**: Get component mappings

- Requires Figma Enterprise plan
- Returns node_id → code_path mappings
- Highest confidence mappings

**get_design_context**: Extract component code

- Use per-component (NOT full screen)
- Can generate React/Vue/HTML via prompting
- Highest token cost - use sparingly

---

## Tailwind CSS Integration (findmydoc)

### Design Tokens → Tailwind v4 (CSS-first)

This repo uses Tailwind v4 CSS-first tokens in `src/app/(frontend)/globals.css`:

- Define primitive values in `:root`
- Map them to Tailwind theme tokens via `@theme inline`

The skill should output a report/plan describing edits to that file (no automatic code changes).

### Figma Auto Layout → Tailwind Classes

**Translation Rules** (apply during code generation):

```
Direction:
  Horizontal → flex-row
  Vertical → flex-col

Spacing:
  Gap → gap-{token}
  Padding → p-{token}, px-{token}, py-{token}

Alignment:
  Start → items-start, justify-start
  Center → items-center, justify-center
  Space Between → justify-between

Sizing:
  Hug → w-auto / h-auto
  Fill → flex-1
  Fixed → w-{value} / h-{value}
```

---

## Token Optimization

### Navigator Principles

**Load on demand**:

- Design review for current task only
- UI kit inventory (always needed)
- Design tokens (always needed)

**Use Task agent for codebase searches**:

- Finding all component files (60-80% token savings)
- Searching for token usage in `src/app/(frontend)/globals.css`
- Analyzing component variant patterns

**Compact after completion**:

- Clear context after design review
- Preserve task document in marker
- Clean slate for implementation

---

## Troubleshooting

### "Figma MCP tool not found"

**Issue**: MCP server not available

**Solutions**:

1. Check Figma Desktop app is running (for local server)
2. Verify MCP server added: `claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp`
3. Fall back to manual workflow (still provides value)

### "Token limit exceeded"

**Issue**: `get_design_context` response too large

**Solutions**:

1. Use `get_metadata` first, then fetch components individually
2. Set `MAX_MCP_OUTPUT_TOKENS=100000`
3. Break design into smaller selections in Figma

### "No components found in codebase"

**Issue**: `component_mapper.py` finds no matches

**Solutions**:

1. Check `--project-root` points to correct directory
2. Verify component file extensions (tsx, jsx, vue)
3. Check components aren't in excluded directories (node_modules)

### "Design tokens not in the expected format"

**Issue**: The repo uses Tailwind v4 CSS-first tokens (CSS variables + `@theme inline`), not a token build pipeline.

**Solutions**:

1. Use `token_extractor.py` as a reporting tool (diff/summary)
2. Apply changes manually in `src/app/(frontend)/globals.css` (`:root` and `@theme inline`)
3. Keep changes additive where possible to avoid breaking existing utilities

---

## Success Metrics

### Efficiency Gains

**Before**: 6-10 hours per design handoff
**After**: 15-20 minutes
**Savings**: 95% time reduction

### Quality Metrics

- Design system drift detected automatically
- 100% token consistency via automated sync
- Component reuse rate tracked
- Implementation accuracy via acceptance criteria

---

## Example Usage

```
User: "Review the dashboard redesign from Figma: https://figma.com/file/..."

Navigator:
1. Checks for Figma MCP availability
2. Extracts metadata, variables, code_connect_map
3. Runs design_analyzer.py → finds 3 new components, 12 new tokens
4. Runs token_extractor.py → generates DTCG tokens, finds 5 drift issues
5. Runs component_mapper.py → maps 2 components, 1 new needed
6. Runs design_system_auditor.py → priority: HIGH (drift detected)
7. Runs implementation_planner.py → generates TASK-17 with 3 phases
8. Creates design review report
9. Presents summary with [Start/Review/Modify] options

User: "Start implementation"

Navigator:
1. Loads TASK-17 document
2. Begins Phase 1: Design Tokens
3. Updates `src/app/(frontend)/globals.css` (`:root` + `@theme inline`) with 12 new tokens
4. Verifies affected pages/components render correctly
5. Commits changes
6. Moves to Phase 2: StatBadge component
7. ... continues through all phases
8. Autonomous completion when done
```

---

**Last Updated**: 2025-10-21
**Navigator Version**: 3.2.0 (target)
**Skill Version**: 1.0.0
