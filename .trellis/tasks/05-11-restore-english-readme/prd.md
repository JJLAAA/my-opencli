# Restore English Default README

## Goal

Restore the repository default `README.md` to English because the default project README should be English. Keep the Chinese version available as `README.zh.md`.

## What I already know

- The user reported that the README currently only has a Chinese default, but the default should be English.
- `README.md` and `README.zh.md` currently contain the same Chinese content.
- `.trellis/spec/core/index.md` and `.trellis/spec/adapters/index.md` both state that documentation should be written in English.
- Git history contains an English `README.md` at commit `62907cc`, before later commits copied Chinese content into the default README.

## Requirements

- Replace `README.md` with an English version.
- Preserve `README.zh.md` as the Chinese version.
- Keep a visible link from `README.md` to `README.zh.md`.
- Do not change runtime behavior.

## Acceptance Criteria

- [ ] `README.md` starts with English prose.
- [ ] `README.zh.md` remains Chinese.
- [ ] `README.md` links to `README.zh.md`.
- [ ] Git diff only contains documentation/task workflow changes for this request.

## Definition of Done

- Documentation updated.
- Basic diff inspection completed.
- No runtime tests required because no application code changes.

## Out of Scope

- Rewriting all project documentation.
- Changing CLI behavior, adapter contracts, package metadata, or generated binaries.

## Technical Notes

- A prior English README is available via `git show 62907cc:README.md`.
- Current Chinese README content remains preserved in `README.zh.md`.
