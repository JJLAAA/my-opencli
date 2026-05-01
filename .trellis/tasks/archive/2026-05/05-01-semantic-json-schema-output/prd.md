# brainstorm: semantic json schema output

## Goal

Design a detailed approach for making `tap` outputs easier for agents and models to understand after collecting request responses and converting them to JSON. The working direction is semantic adapter output plus machine-readable field metadata, so downstream consumers do not have to guess field meanings from raw API payloads.

## What I already know

* The user wants to advance the earlier discussion as a formal task.
* The immediate deliverable is research and a detailed implementation方案, not code changes yet.
* The preferred high-level direction discussed earlier: adapters should emit stable semantic fields, optionally with schema/field descriptions and metadata.
* `tap` is a Bun ESM CLI with runtime modules in `src/` and site commands in `adapters/<site>/<command>.js`.

## Assumptions (temporary)

* The solution should preserve normal CLI ergonomics for humans while improving machine/agent consumption.
* Raw upstream response fields may remain available for debugging, but should not be the primary model-facing contract.

## Open Questions

* What exact CLI UX should expose schema-aware output?

## Requirements (evolving)

* Research current `tap` output pipeline and adapter patterns.
* Compare feasible designs for semantic fields, schemas, metadata, and raw payload retention.
* Produce a detailed implementation plan with trade-offs, acceptance criteria, and rollout notes.
* Make field meaning available to agents through a stable machine-readable contract, not only through natural-language docs.
* Do not support legacy adapters in the new schema-aware mode.
* Remove the two current built-in adapters as part of the implementation scope.
* Output only fields declared in the adapter schema; undeclared fields should be dropped from schema-aware output.
* Make `--format json` the schema-aware envelope output by default.
* Treat `tap-adapter-author` as the primary path for creating adapters, and update the skill so schema confirmation is a mandatory authoring step.

## Acceptance Criteria (evolving)

* [x] Current output and adapter architecture are summarized with concrete file references.
* [x] At least 2 feasible approaches are compared.
* [x] A recommended approach is selected or ready for user decision.
* [x] MVP scope and out-of-scope items are explicit.
* [x] Implementation steps are small enough to execute safely later.
* [x] `--format json` emits a schema-aware `{ meta, schema, items }` envelope.
* [x] JSON output requires explicit `output.fields`.
* [x] Runtime projects `items` to schema-declared fields only.
* [x] Current built-in adapters are removed.
* [x] `tap-adapter-author` requires schema confirmation before writing adapters.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate once implementation begins.
* Manual CLI verification covers table and JSON output if behavior changes.
* Docs/README updated if output contract changes.
* Backward compatibility and rollout/rollback are considered.

## Out of Scope (explicit)

* Implementing the feature before the方案 is confirmed.
* Designing a full external schema registry unless research shows it is necessary.
* Backward-compatible fallback for old adapters without `output.fields`.
* Runtime inference of field meaning from `columns` or item keys.

## Technical Notes

* Task directory: `.trellis/tasks/05-01-semantic-json-schema-output`
* Need to inspect `src/output.js`, `src/executor.js`, `bin/cli.js`, current adapters, README files, and existing roadmap docs.
* Implementation completed in `src/output.js`, `src/cli.js`, setup/doctor handling, docs, specs, and `skills/tap-adapter-author`.

## Research Notes

### Current repo architecture

* `src/cli.js` loads an adapter, applies default args, detects whether a browser session is needed, executes `adapter.pipeline`, then calls `printOutput(result, format, adapter.columns)`.
* `src/output.js` currently treats JSON as a plain array: it normalizes `data` to `rows` and prints `JSON.stringify(rows, null, 2)`. It does not receive site/command, args, adapter metadata, schema, source, or generated time.
* `adapter.columns` is only used for table column order and help text. It is not a semantic contract; it cannot describe field types, formats, units, nullability, or model-facing meaning.
* Current built-in adapters already manually map upstream fields into semantic-ish output fields:
  * `adapters/bilibili/hot.js`: `title`, `author`, `play`
  * `adapters/linuxdo/news.js`: `title`
* `README.md` / `README.zh.md` document default JSON as a JSON array for agent-friendly parsing, but do not define a schema envelope or field metadata.
* `docs/readonly-data-access-roadmap.md` already points toward stronger schema description and output contracts as a long-term direction.
* There is no committed automated test suite yet; `package.json` only has build/publish scripts.
* `skills/tap-adapter-author/SKILL.md` currently centers adapter authoring around `columns`, with Step 4 decoding fields and Step 5 designing `args + columns`.
* `skills/tap-adapter-author/references/adapter-template.md` still uses templates without `output.fields`.
* `README.md` and `README.zh.md` describe the skill as mapping response fields to output columns, so docs must change together with the skill.

### Cross-layer data flow

```text
Upstream API / DOM / intercepted response
  -> adapter evaluate/select/map
  -> executePipeline result
  -> output formatter
  -> agent/model/tool consumer
```

Boundary risks:

* Upstream fields may be cryptic or unstable (`fancy_title`, `stat.view`, etc.).
* Adapter output fields may be readable to humans but underspecified to machines (`play` could mean view count or playback URL).
* Table output and JSON output currently share the same row shape, so adding metadata directly to every JSON response can break consumers expecting an array.
* User-installed adapters under `~/.tap/adapters` may not adopt new fields immediately, so the core must support graceful fallback.

### External conventions

* JSON Schema supports annotation keywords such as `title`, `description`, `default`, and examples; these are meant to describe data for tools and humans, not only validate it. Reference: https://json-schema.org/understanding-json-schema/reference/annotations
* OpenAPI descriptions use machine-readable documents and schema objects to describe inputs/outputs, but full OpenAPI would be too heavy for local TAP adapter outputs. Reference: https://learn.openapis.org/specification/structure.html
* JSON Lines is useful for streaming record-by-record data, but TAP currently emits bounded command results and table output, so JSONL should be a future output mode rather than the primary schema solution. Reference: https://jsonlines.org/

### Feasible approaches

**Approach A: Keep JSON array, add adapter field metadata only in help/docs**

How it works:

* Add `fields` or richer `columns` metadata to adapters.
* `tap help <site> <command>` shows field descriptions.
* `--format json` remains a plain array.

Pros:

* Minimal breaking change.
* Easy to implement.
* Existing scripts continue to parse JSON arrays.

Cons:

* Model/tool consumers do not receive schema in-band.
* Agent still needs an extra help call or hardcoded adapter knowledge.
* Weak foundation for validation and future provider outputs.

**Approach B: Add an in-band JSON envelope with `meta`, `schema`, and `items`**

How it works:

* Adapter defines semantic output fields, e.g. `output.fields`.
* Default or opt-in JSON can emit:

```json
{
  "meta": {
    "site": "bilibili",
    "command": "hot",
    "generatedAt": "2026-05-01T12:00:00+08:00",
    "resultType": "list"
  },
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "title": { "type": "string", "description": "Video title." },
        "play": { "type": "integer", "description": "View count.", "unit": "views" }
      }
    }
  },
  "items": []
}
```

Pros:

* Best for agents: data and field meaning travel together.
* Creates a real output contract that can later support validation, docs generation, and adapter authoring checks.
* Aligns with the roadmap’s “schema 描述和输出契约” direction.

Cons:

* Breaking if it replaces the current default array.
* Requires CLI/output changes and adapter metadata changes.
* Needs migration design for existing user adapters and scripts.

**Approach C: Dual-mode output: keep array default, add `--format object-json` or `--schema` / `--with-schema`**

How it works:

* Keep `--format json` as the current plain array for compatibility.
* Add a new schema-aware JSON mode, for example:
  * `--format object-json`
  * or `--format json --with-schema`
  * or `--schema` to print only schema.
* Adapter metadata is still added like Approach B, but the envelope is opt-in at first.

Pros:

* Preserves backward compatibility.
* Gives agents an immediate reliable mode.
* Allows gradual migration and documentation.

Cons:

* Two JSON shapes increase CLI surface area.
* If default remains plain array forever, many agent calls may still miss schema.

**Approach D: Embed schema per item**

How it works:

* Each returned item includes `_schema` or `_fieldDescriptions`.

Pros:

* Every record is self-describing.

Cons:

* Very noisy and repetitive.
* Bad for table conversion and larger result sets.
* Encourages consumers to mix data fields with metadata fields.

### Recommended direction

Use Approach B as the target shape, with no legacy adapter fallback:

* Add a canonical adapter output contract: `output.fields`.
* Make `--format json` output the `{ meta, schema, items }` envelope.
* Schema-aware JSON output emits only fields declared in `output.fields`.
* Remove the current built-in adapters instead of migrating them.
* Do not infer schema from `columns` or row keys.
* Do not include undeclared fields in schema-aware output.
* If an adapter lacks `output.fields`, schema-aware execution should fail with an actionable error.
* Update `tap-adapter-author` so adapter creation always includes an explicit schema review and confirmation loop.

### Proposed adapter contract

```js
export default {
  description: 'List currently popular videos from Bilibili.',
  args: [{ name: 'limit', default: 20, description: 'Maximum number of videos to print.' }],
  output: {
    type: 'list',
    itemName: 'video',
    fields: {
      rank: {
        type: 'integer',
        description: 'One-based rank in the returned result set.',
      },
      title: {
        type: 'string',
        description: 'Video title.',
      },
      author: {
        type: 'string',
        description: 'Uploader display name.',
      },
      play: {
        type: 'integer',
        description: 'Video view count.',
        unit: 'views',
      },
    },
  },
  columns: ['rank', 'title', 'author', 'play'],
  pipeline: []
};
```

Notes:

* Keep `columns` for table order. Do not overload it into schema.
* Field metadata should be concise and stable.
* Recommended field metadata keys: `type`, `description`, `format`, `unit`, `nullable`, `enum`, `source`, `examples`.
* Avoid JSON Schema overreach in adapter authoring. Store simple metadata, then derive JSON Schema-like output from it.
* `columns` may become optional if schema-aware JSON becomes the primary output path.

### Proposed output envelope

```json
{
  "meta": {
    "tapVersion": "0.1.0",
    "site": "bilibili",
    "command": "hot",
    "resultType": "list",
    "generatedAt": "2026-05-01T12:00:00+08:00",
    "args": { "limit": 5 }
  },
  "schema": {
    "type": "array",
    "itemName": "video",
    "items": {
      "type": "object",
      "properties": {
        "rank": { "type": "integer", "description": "One-based rank in the returned result set." },
        "title": { "type": "string", "description": "Video title." }
      }
    }
  },
  "items": []
}
```

Runtime behavior:

* `items` should be projected to schema-declared fields only.
* Undeclared fields produced by the pipeline should be dropped before JSON envelope output.
* Adapters without `output.fields` should fail in schema-aware mode.
* No schema should be generated from `columns`.
* Declared fields missing from a row should appear as `null` or trigger a warning/error depending on the final validation policy.

### MVP implementation plan

PR1: remove old built-in adapters and define the contract

* Delete `adapters/bilibili/hot.js`.
* Delete `adapters/linuxdo/news.js`.
* Add adapter contract documentation for required `output.fields`.
* Decide whether pipeline commands without schema are invalid globally or only invalid for schema-aware output.

PR2: schema-aware JSON output

* Change `printOutput` signature to accept an options object including `{ site, command, args, adapter }`.
* Add an envelope formatter that produces `{ meta, schema, items }`.
* Make `--format json` use the envelope formatter.
* Project output rows to schema-declared fields only.

PR3: update adapter-author skill

* Update `skills/tap-adapter-author/SKILL.md`:
  * Step 4 decodes source fields and candidate semantics.
  * Step 5 requires explicit schema confirmation before file write.
  * Final confirmation must show `args`, `output.fields`, `columns` if table remains supported, and pipeline draft.
* Update `skills/tap-adapter-author/references/adapter-template.md` so all templates include `output.fields`.
* Update `skills/tap-adapter-author/references/field-mapping.md` with schema field rules.
* Update README/README.zh skill workflow text from “output columns” to “schema-confirmed output fields”.

PR4: validation hardening

* Add validation for invalid adapter schema shape.
* Add lightweight validation for missing declared fields.
* Consider strict type validation after field projection is working.
* Consider adding a minimal test harness for `output.js` and `help.js` even though no suite exists today.

### Adapter-author skill schema confirmation logic

The skill should not invent final schema silently. It should perform this loop:

1. Decode raw response fields.
   * For each candidate field, record raw path, sample value, observed JS type, page-visible meaning if known, and uncertainty.
2. Propose semantic output fields.
   * Use stable camelCase names.
   * Include `type`, `description`, and optional `format`, `unit`, `nullable`, `source`, `examples`.
   * Prefer domain names such as `viewCount` over vague names such as `play`.
3. Ask the user to confirm the schema before writing the adapter.
   * Show a compact table: output field, raw path, type, description, sample value.
   * Ask one confirmation question: whether to accept, remove fields, rename fields, or clarify meanings.
4. Only after confirmation, generate the adapter with `output.fields`.
5. Verify `tap <site> <command> --format json` returns an envelope whose `items` contain only schema-declared fields.

### Open design choices

* Whether `rank` should be a number or string. Current template rendering returns strings, so making numeric fields truly numeric may require executor/render changes.
* Whether to include `args` in `meta` by default. Useful for reproducibility, but may expose sensitive values if future adapters accept tokens or IDs.
* Whether `generatedAt` should be local timezone, UTC ISO string, or omitted for deterministic test snapshots.

## Decision (ADR-lite)

**Context**: The original proposal considered graceful fallback for old adapters and inferred schema for rows without explicit field metadata. The user clarified that backward compatibility for old adapters is not needed and that current built-in adapters should be removed.

**Decision**: The schema-aware output contract will require explicit adapter schema metadata. Runtime will not infer field meaning from `columns` or item keys. `--format json` will output the schema-aware envelope and only include fields declared in the adapter schema. The two existing built-in adapters will be deleted rather than migrated. Adapter creation will mainly rely on `tap-adapter-author`, and that skill must require user confirmation of `output.fields` before writing an adapter.

**Consequences**: The implementation becomes simpler and the model-facing contract becomes more trustworthy. The trade-off is that existing example commands disappear until new schema-compliant adapters are authored, and any user adapter without explicit schema cannot use JSON output. The skill becomes part of the product contract, not only documentation, because it is responsible for extracting and confirming field semantics at adapter authoring time.
