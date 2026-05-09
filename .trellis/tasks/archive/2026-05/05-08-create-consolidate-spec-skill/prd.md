# Create consolidate-spec skill

## Goal

Create a project-level Codex skill named `consolidate-spec` for analyzing and planning consolidation of `.trellis/spec/` documents.

## What I already know

- The user provided the full skill prompt and asked to focus on making the skill `description` correct.
- The skill should live in the current project directory.
- Project-level skills already live under `.agents/skills/`.

## Requirements

- Create `.agents/skills/consolidate-spec/SKILL.md`.
- Preserve the user's provided workflow and output format in the skill body.
- Write a high-quality frontmatter `description` that triggers for spec consolidation, redundancy/conflict analysis, checklist quality, guides/spec boundary review, and context efficiency review.
- Do not add unnecessary bundled resources.

## Acceptance Criteria

- [x] The skill exists at `.agents/skills/consolidate-spec/SKILL.md`.
- [x] The frontmatter includes only `name` and `description`.
- [x] The description clearly says when to use the skill.
- [x] Skill validation passes.

## Verification

- Official `quick_validate.py` could not run because the local Python environment is missing `yaml`.
- Manual YAML validation with Ruby passed the same key checks used by `quick_validate.py`: frontmatter parses, allowed keys only, valid hyphen-case name, no angle brackets, description under 1024 characters.

## Out of Scope

- Running the consolidation workflow now.
- Modifying `.trellis/spec/` content.
