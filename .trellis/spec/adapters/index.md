# Adapter Development Guidelines

> Best practices for writing TAP adapters (the user-facing extension point).

---

## Overview

"Adapters" are the frontend of TAP — declarative `.js` files that define what to fetch and how to transform it. The core engine handles execution. This directory covers adapter authoring conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Adapter file layout and resolution order | Active |
| [Adapter Guidelines](./adapter-guidelines.md) | Adapter command contract, output schema, pipeline steps, CDP patterns | Active |
| [Adapter Pack Management](./adapter-pack-management.md) | Remote pack install/list/remove contracts | Active |
| [Quality Guidelines](./quality-guidelines.md) | Required patterns, forbidden patterns, testing | Active |

---

## Pre-Development Checklist

- [ ] **Writing or updating an adapter command**: read [Adapter Guidelines](./adapter-guidelines.md#adapter-structure), [Adapter Guidelines](./adapter-guidelines.md#json-output-contract), and [Quality Guidelines](./quality-guidelines.md#testing-an-adapter).
- [ ] **Changing adapter discovery or path resolution**: read [Directory Structure](./directory-structure.md#adapter-resolution-contract).
- [ ] **Changing adapter pack install, list, remove, source parsing, manifests, conflicts, or `--force` behavior**: read [Adapter Pack Management](./adapter-pack-management.md).
- [ ] **Reviewing adapter output schema, field masking, columns, or test coverage**: read [Adapter Guidelines](./adapter-guidelines.md#json-output-contract) and [Quality Guidelines](./quality-guidelines.md#required-patterns).

---

**Language**: All documentation should be written in **English**.
