# consolidate-spec

You are helping consolidate and maintain the `.trellis/spec/` directory, which contains project-specific coding standards, conventions, and guidelines.

## Your Goal

Analyze spec documents to identify redundancy, conflicts, and outdated rules, then produce a consolidation plan that improves spec quality without inventing new rules.

## What You Should Do

1. **Read all spec files** in `.trellis/spec/` (frontend/, backend/, guides/, etc.)
2. **Read real task data** to ground the analysis: scan `.trellis/tasks/*/prd.md` and `.trellis/tasks/archive/*/prd.md` to understand what task types actually occur in this project. Use these as the "typical tasks" for context efficiency analysis — do not invent task types.
3. **Identify quality issues:**
   - Duplicate rules stated in multiple files
   - Conflicting guidance (file A says X, file B says Y)
   - Outdated rules that no longer match current practice
   - Inconsistent terminology or structure
   - Rules that should be merged or reorganized
   - **Checklist quality**: whether each layer's `index.md` has a Pre-Development Checklist that accurately routes to specific files
   - **guides/ vs spec/ boundary**: whether content is in the right place
   - **Context efficiency**: file boundaries that are too coarse or too fine
4. **Produce a consolidation plan** with proposed file modifications

## What You Must NOT Do

- ❌ Invent new rules or conventions
- ❌ Promote workspace conclusions into spec without explicit evidence
- ❌ Change rule meaning when only rephrasing
- ❌ Delete rules that are still actively used
- ❌ Make spec more restrictive without clear justification

## Output Format

### Phase 1: Analysis Report

```markdown
## Spec Consolidation Analysis

### Duplicate Rules
- `frontend/components.md:15` and `frontend/patterns.md:42` both define component naming
- `backend/api.md:8` and `backend/rest.md:12` both specify error response format

### Conflicting Rules
- `frontend/state.md:20` says "use Redux"
- `frontend/hooks.md:35` says "prefer Context API"
- **Conflict**: State management approach unclear

### Outdated Rules
- `backend/database.md:50` references deprecated ORM version
- `frontend/styling.md:12` mentions removed CSS framework

### Structural Issues
- Inconsistent heading levels across files
- No clear hierarchy between frontend/ and backend/

### Checklist Quality Issues
<!-- NEW: analyze whether index.md files have effective Pre-Development Checklists -->
For each layer's `index.md`, check:
1. Does a "Pre-Development Checklist" section exist?
2. Are entries written as verb phrases describing intent ("Adding a platform", "Modifying error handling") rather than nouns ("Platform", "Error")?
3. Does every file listed in Guidelines Index have at least one matching checklist entry?
4. Are there task types (from real prd.md data) that no checklist entry covers?

Report findings as:
- `backend/index.md`: no Pre-Development Checklist → AI falls back to filename guessing
- `docs/index.md`: checklist uses noun entries ("Error handling") → hard to match against prd verb phrases
- No checklist entry covers "modifying hook output format" → gap; tasks of this type get no routing guidance

### guides/ vs spec/ Boundary Issues
<!-- NEW: check whether content is in the right place -->
Rule:
- spec/<layer>/*.md = "how to write" → must contain concrete contracts: signatures, field lists, error matrices, code examples
- guides/*.md = "what to think about before writing" → must be short checklists that point to spec files, not repeat their content

Report findings as:
- `backend/conventions.md` contains only "remember to check X before Y" reminders → move to guides/
- `guides/api-guide.md` contains concrete error response schemas → move to spec/
- `guides/cross-layer.md` duplicates rules already in `backend/error-handling.md` → trim to pointer only

### Context Efficiency Issues
<!-- UPDATED: use real task types from prd.md files, not invented ones -->
Using the task types discovered from `.trellis/tasks/*/prd.md`:

For each real task type, ask:
1. Which spec files must be read to fully execute this task? More than 2 non-index files → consider merging
2. After reading a file, what fraction of content is irrelevant to the current task? High ratio + small used section → split

Also check file size: files injected into sub-agent context windows via jsonl should be focused. A file over ~200 lines that covers multiple unrelated concerns is a candidate for splitting regardless of task coverage.

Common signals:
- A file is loaded in almost every task but only a small section is used → split out that section
- Completing one task requires reading 3+ files to piece together full context → merge related content
- A checklist entry points to an entire large file when only one section is relevant → point to the specific section instead (`file.md#section-heading`)

### Proposed Changes
1. Merge duplicate component naming rules into `frontend/components.md`
2. Resolve state management conflict by checking recent code
3. Update or remove deprecated ORM reference
4. Standardize heading structure across all spec files
5. Add Pre-Development Checklist to `docs/index.md`
6. Move "remember to check X" reminders from `backend/conventions.md` to `guides/`

### Files to Modify
- `.trellis/spec/frontend/components.md`
- `.trellis/spec/frontend/patterns.md`
- `.trellis/spec/backend/database.md`
- `.trellis/spec/docs/index.md`        ← add checklist
- `.trellis/spec/backend/conventions.md` ← move content to guides/
```

### Phase 2: Apply Changes

After user confirms, execute the proposed file modifications:
- Use **Edit** (not Write) to modify existing files, to avoid overwriting unrelated content
- When moving content between files, verify the destination section exists before inserting
- After any structural change (new file, split, merge), update the relevant `index.md` Guidelines Index table and Pre-Development Checklist to reflect the new file layout
- If a checklist entry is added or modified, verify it uses a verb phrase ("Adding X", "Modifying Y"), not a noun

## Consolidation Principles

- **Merge duplicates**: One canonical rule is better than three scattered ones
- **Resolve conflicts**: Don't leave contradictory guidance
- **Flag, don't delete**: If unsure whether a rule is outdated, mark it for review
- **Preserve intent**: When rephrasing, keep the original constraint
- **Improve structure**: Make rules easier to find and understand
- **Maintain stability**: Spec should feel like a trusted reference, not a moving target
- **Checklist first**: A well-organized spec with a broken checklist still fails at the point of use — fix checklists before fixing file structure

## Conflict Resolution Strategy

When you find conflicting rules:
1. Check if one is clearly outdated
2. Look for evidence in recent code (via grep/read)
3. If both seem valid, flag the conflict and ask user to decide
4. Don't guess — preserve both temporarily if uncertain

## When to Stop

If spec is already well-organized with no significant duplication, conflicts, or checklist gaps, report that no consolidation is needed rather than forcing unnecessary changes.
