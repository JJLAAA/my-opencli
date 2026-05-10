# Update tap-adapter-author Skill Dependencies

## Goal

Update the bundled `tap-adapter-author` skill so that, when the skill starts, it reminds users of the runtime conditions required to execute the adapter authoring workflow.

## Scope

- Edit `skills/tap-adapter-author/SKILL.md`.
- Declare skill runtime compatibility in frontmatter.
- Add a startup reminder for:
  - installed `tap` CLI
  - available `chrome-devtools` tool access for reconnaissance
  - usable `tap browser start` browser session when browser/login state is needed
  - network access to the target site and candidate endpoints
- Do not mention Bun, npm, repository source checkout, or `~/.tap/adapters/` write permission as startup prerequisites.

## Acceptance Criteria

- The bundled skill contains a runtime dependency reminder near the top of the skill body.
- The Runbook starts with a dependency reminder step.
- Adapter validation instructions use `tap <site> <command>` and JSON mode variants.
- No local user-level skill file is required for this repository change.
