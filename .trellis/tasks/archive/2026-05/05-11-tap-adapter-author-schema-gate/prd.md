# Add schema confirmation gate to tap-adapter-author skill

## Goal

Strengthen the `tap-adapter-author` skill so an agent must explicitly present the adapter schema to the user and receive user confirmation before creating or writing any adapter file.

## What I already know

- The user asked to add a mandatory gate requiring schema confirmation before adapter creation.
- The target skill is `/Users/leo/.claude/skills/tap-adapter-author/SKILL.md`.
- The current skill already asks the agent to show schema drafts and wait for confirmation, but the requirement is spread across Step 5 and the schema rules rather than expressed as a hard blocking gate before installation.
- Existing repo changes in `README.md` and `README.zh.md` predate this work and are out of scope.

## Requirements

- Add an explicit hard gate to the skill: no adapter file may be created, installed, or written until the user confirms the schema.
- Define what must be shown for confirmation: adapter `description`, `site`, `command`, args, `output.fields`, `columns`, and any uncertainty.
- Require an affirmative user response before continuing to adapter creation.
- Make Step 7 depend on the confirmation gate.
- Keep the skill concise and consistent with the existing Chinese workflow style.

## Acceptance Criteria

- [x] The skill has a clearly named mandatory schema confirmation gate.
- [x] The gate explicitly blocks `mkdir`, `Write`, `Edit`, or any creation of `~/.tap/adapters/<site>/<command>.js` before confirmation.
- [x] The runbook references this gate before adapter installation.
- [x] The existing schema confirmation table remains present or is strengthened.

## Out of Scope

- Changing TAP runtime behavior.
- Changing adapter templates unless necessary to reference the gate.
- Modifying project README files.

## Technical Notes

- This is a user-level skill edit, not a TAP application runtime change.
- The target file is outside the repo writable root, so writing may require permission escalation.
