# Core Engine Development Guidelines

> Best practices for TAP core engine development (`src/`, `bin/`, `npm/`).

---

## Overview

"Core" in TAP is the execution engine — CDP session management, pipeline runner, output formatting, and npm distribution. This directory covers engine-side conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Core module layout, side-command routing, naming | Active |
| [Error Handling](./error-handling.md) | Exit codes, fail(), error patterns | Active |
| [Local Runtime](./local-runtime.md) | Setup, browser lifecycle, doctor, local state | Active |
| [Npm Distribution](./npm-distribution.md) | Split npm packages, wrapper runtime, publish flow | Active |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, build, code review checklist | Active |
| [Logging Guidelines](./logging-guidelines.md) | Console rules, no debug traces | Active |

---

## Pre-Development Checklist

- [ ] **Changing core module layout or side-command routing**: read [Directory Structure](./directory-structure.md#module-organization) and [Directory Structure](./directory-structure.md#cli-side-commands).
- [ ] **Changing TAP bundled skills**: read [Directory Structure](./directory-structure.md#bundled-skill-source-ownership); update `skills/<skill-name>/` and `src/bundled-skills.js`, not locally installed assistant skill directories.
- [ ] **Changing structured errors, exit codes, or failure classification**: read [Error Handling](./error-handling.md#exit-codes), [Error Handling](./error-handling.md#fail--structured-error-exit), and [Error Handling](./error-handling.md#error-patterns-by-category).
- [ ] **Changing logging, stdout/stderr behavior, or output channels**: read [Logging Guidelines](./logging-guidelines.md#rules), then [Error Handling](./error-handling.md#fail--structured-error-exit) for user-facing failures.
- [ ] **Changing setup, browser lifecycle, doctor, local state, or config paths**: read [Local Runtime](./local-runtime.md).
- [ ] **Changing npm package distribution, platform packages, publish scripts, or wrapper runtime**: read [Npm Distribution](./npm-distribution.md).
- [ ] **Reviewing core code quality, dependencies, build behavior, or cleanup guarantees**: read [Quality Guidelines](./quality-guidelines.md#code-review-checklist).

---

**Language**: All documentation should be written in **English**.
