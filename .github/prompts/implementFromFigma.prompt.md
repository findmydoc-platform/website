---
name: implementFromFigma
description: Implement or refine UI components from Figma designs using tools and project context
argument-hint: Describe the Figma node, target component/file, and any special requirements
agent: agent
---
You are GitHub Copilot helping implement or refine a UI component
from a Figma design in the current project, using the available
Figma MCP tools where helpful.

Follow this process:

1. **Understand the context**
   - The user will provide: the Figma URL or node description, the target
     component/file path, and the type of component (for example, footer
     template, hero organism, card molecule).
   - Use the Figma MCP tools as needed to fetch context:
     - `get_design_context` to get layout, structure, and any
       auto-generated React/Tailwind code for the selected node.
     - `get_screenshot` to view the rendered design and verify
       spacing, alignment, and visual details.
     - `get_figjam` (when working from FigJam) to inspect
       flows or annotations that describe intended behavior.
   - Treat any repository instructions files (for example,
     `.github/copilot-instructions.md` or `.github/instructions/**`) as the
     source of truth for stack, styling system, and architecture.

2. **Research best practices (via docs / web tools)**
   - Use documentation or web-search tools (for example,
     `mcp_ref_tools_ref_search_documentation` or
     `vscode-websearchforcopilot_webSearch`, if available) to gather a short
     summary of best practices for this kind of UI: semantics,
     accessibility, layout, and responsiveness.
   - From that research, output 3–5 concise bullets of guidelines you will
     follow when editing the code.

3. **Plan the implementation**
   - Identify the appropriate atomic level (atom, molecule, organism,
     template, page) for the target component.
   - Decide whether to update an existing component or create a new one,
     based on the provided file path and current code.
   - Keep public APIs (props, exports) stable unless a small,
     clearly-justified change is necessary.

4. **Apply changes in this repository**
   - Use the Figma design (layout, spacing, typography, hierarchy) and the
     current implementation to update or create code that:
     - closely matches the Figma design visually,
     - uses semantic HTML and accessibility best practices,
     - respects the project’s styling system and architecture (no new
       dependencies or ad-hoc patterns),
     - keeps components presentational unless explicitly told otherwise.
   - When you have file access, make edits directly to the relevant files
     instead of only suggesting large code snippets.

5. **Stories or examples (if applicable)**
   - If the project uses Storybook
   or similar, update or add a story for the
     component to cover the main state(s) and any important variants.

6. **Output format**
   - List the files you changed (paths only) with a 1–2 sentence summary per
     file.
   - Summarize the applied best-practice guidelines in a few bullets.
   - Note any follow-up TODOs or open questions in a short bullet list.
