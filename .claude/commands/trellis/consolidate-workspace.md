# consolidate-workspace

You are helping consolidate and clean up the `.trellis/workspace/` directory, which contains session journals and developer work history.

## Your Goal

Analyze workspace journals to identify noise, redundancy, and outdated content, then produce a consolidation plan that compresses session history while preserving critical context.

## What You Should Do

1. **Read all journal files** in `.trellis/workspace/{developer}/`
2. **Identify consolidation opportunities:**
    - Duplicate or near-duplicate session summaries
    - Repetitive problem descriptions across multiple journals
    - Outdated relative time references (e.g., "yesterday", "last week")
    - Scattered conclusions that can be merged
    - Process noise that no longer adds value
3. **Produce a consolidation plan** with:
    - List of redundant content to merge
    - List of outdated content to remove
    - Key conclusions to extract and preserve
    - Proposed file modifications

## What You Must NOT Do

- ❌ Invent work that didn't happen
- ❌ Delete critical decisions or context that future sessions need
- ❌ Turn uncertain observations into definitive conclusions
- ❌ Remove all history — preserve the essential narrative

## Output Format

### Phase 1: Analysis Report

```markdown
## Workspace Consolidation Analysis

### Redundant Content
- [file:line] Duplicate description of X problem
- [file:line] Repeated conclusion about Y

### Outdated Content
- [file:line] Relative date "last Tuesday" (now ambiguous)
- [file:line] Temporary workaround that was later replaced

### Key Conclusions to Preserve
- Conclusion A from sessions 3, 5, 7
- Decision B that affects future work

### Proposed Changes
1. Merge journal-3.md and journal-5.md sections about X
2. Remove outdated workaround notes from journal-2.md
3. Create consolidated summary in journal-latest.md

### Files to Modify
- `.trellis/workspace/{developer}/journal-2.md`
- `.trellis/workspace/{developer}/journal-3.md`
- `.trellis/workspace/{developer}/journal-5.md`
```

### Phase 2: Apply Changes

After user confirms, execute the proposed file modifications using Edit/Write tools.

## Consolidation Principles

- **Compress, don't erase**: Turn 5 similar paragraphs into 1 clear summary
- **Preserve decisions**: Keep "why we chose X over Y" even if brief
- **Normalize time**: Convert relative dates to absolute dates where possible
- **Extract patterns**: If the same issue appeared 3 times, note it once with context
- **Keep continuity**: Future sessions should still understand what happened

## Example Transformation

**Before (scattered across 3 journals):**
```
journal-3.md: "Tried approach A, didn't work because of timeout"
journal-5.md: "Revisited the timeout issue, still blocking"
journal-7.md: "Finally fixed timeout by increasing buffer size to 8KB"
```

**After (consolidated):**
```
journal-latest.md: "Resolved timeout issue (sessions 3-7): increased buffer size to 8KB after multiple attempts with approach A failed."
```

## When to Stop

If workspace is already clean and well-organized, report that no consolidation is needed rather than forcing unnecessary changes.
