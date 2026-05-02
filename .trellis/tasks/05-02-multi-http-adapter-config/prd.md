# brainstorm: multi-http adapter configuration

## Goal

Design a more agent-friendly adapter configuration model for commands that need multiple HTTP requests, such as list-detail joins, pagination, related-object lookup, and browser-cookie-backed API aggregation.

## What I already know

* The current TAP pipeline is linear and stores only one current `data` value.
* A top-level `fetch` step replaces `data` with the fetched JSON result.
* Current multi-request work is usually implemented inside a browser `evaluate` string.
* Current supported pipeline ops are `fetch`, `navigate`, `evaluate`, `intercept`, `select`, `filter`, `map`, `sort`, and `limit`.
* Adapter output is schema-first: `output.fields` defines the JSON contract, and extra pipeline fields are dropped at output time.
* TAP is plain ESM JavaScript with no new dependencies preferred.

## Assumptions (temporary)

* The goal is to improve adapter authoring ergonomics, not to replace JavaScript evaluation entirely.
* Backward compatibility with existing adapters should be preserved.
* The MVP should keep the DSL small enough for humans and agents to write reliably.
* Direct public HTTP and browser-cookie-backed HTTP should both be considered.
* Adapter syntax should stay simple enough that the `tap-adapter-author` skill can choose and fill patterns without complex reasoning.

## Open Questions

* None for the implemented MVP.

## Requirements (evolving)

* Adapter authors should be able to express multiple HTTP requests without embedding all logic in one `evaluate` string.
* Adapter authors should be able to preserve earlier request results while later requests run.
* Common list-detail fan-out should support bounded concurrency.
* Any step that produces data should be able to save it into a named state with `as`.
* Later steps should be able to read from current `data` or any named state with `from`.
* `foreach` should be able to iterate over any named state, not only the immediately previous step result.
* `foreach` output should itself be saveable into a new named state, allowing chained multi-stage composition.
* The adapter DSL should minimize new vocabulary and avoid a separate resource graph or query language.
* Common multi-request patterns should have copy-pasteable templates for adapter authors and skills.
* The design should keep final JSON schema behavior unchanged.
* Existing adapters should continue to work.

## Acceptance Criteria (evolving)

* [x] A list endpoint result can be saved and reused by later steps.
* [x] A detail endpoint can be fetched for each item in a selected list.
* [x] Detail fetches can be concurrency-limited.
* [x] The final output can merge original list item fields with fetched detail fields.
* [x] Multiple independent fetch results can be saved under different names and combined later.
* [x] `foreach` can iterate over a named state produced by an earlier step.
* [x] A `foreach` result can be saved as a new named state and used by subsequent steps.
* [x] The MVP can be explained with three concepts: `as`, `from`, and `foreach`.
* [x] Adapter-author documentation includes simple templates for independent fetches, list-detail, and enrichment.
* [x] Public HTTP and browser-context HTTP have an explicit authoring path.
* [x] Existing simple adapters continue to run unchanged.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate, or manual verification documented if no test suite exists.
* Build passes.
* README and adapter-author references updated if behavior changes.
* `.trellis/spec/` updated because this changes the adapter DSL contract.

## Out of Scope (explicit)

* Full workflow engine semantics.
* Arbitrary graph execution scheduler.
* Non-JSON response parsing beyond current behavior unless explicitly needed later.
* Persistent caching across command runs.

## Technical Notes

* `src/executor.js` currently executes steps sequentially and assigns each step's result to `data`.
* `map` currently has `item`, `index`, `args`, `data`, and `root` contexts.
* `fetch` currently supports URL templating with `{ args, data }`, but does not support headers, method, request body, aliases, timeout, retry, or browser context.
* `evaluate` can express arbitrary multi-request logic today, but hides request topology inside string JavaScript.
* `intercept` can return multiple captured responses, but is capture-driven rather than request orchestration.
* Implemented MVP context model:
  * `as` writes top-level step results to shared `state`.
  * `from` resolves current `data`, a named state value, or a named state path such as `projects.items`.
  * `foreach` runs nested steps with `item` as the original iterated value and `data` as the nested current value.
  * Nested steps receive a local copy of state; only `foreach.as` writes collected results back to shared state.
  * `browserFetch` runs page-context fetch with `credentials: 'include'` by default.

## Verification

* [x] Existing linear pipeline smoke test via direct `executePipeline`.
* [x] New `as` / `from` / `foreach` smoke test via direct `executePipeline`.
* [x] CLI JSON envelope test with a temporary adapter under `/private/tmp/tap-multi-http-adapters`.
* [x] `bun run build`.
* [x] `git diff --check`.

## Research Notes

### What similar workflow/config patterns usually do

* Dataflow-style DSLs commonly separate named intermediate values from the current step result.
* Batch/fan-out patterns commonly provide a `foreach` or matrix-like primitive with bounded concurrency.
* HTTP workflow tools usually expose shared request options such as headers, method, timeout, retry, and response selection.
* Browser automation systems often need a separate "run this fetch inside the browser context" path because cookies/session are not available to host-side HTTP.

### Constraints from this repo

* TAP should remain small and readable.
* No new dependency should be required for the DSL itself.
* Existing pipeline syntax should remain valid.
* Adapter files should stay declarative; custom helper functions in adapter modules are discouraged by current skill guidance.
* Output schema is already explicit and should remain the final contract.

### Feasible approaches here

**Approach A: State primitives plus foreach** (Recommended)

* How it works: add `as` to steps to save results into named state, add `from` selectors to read state, and add `foreach` for list-detail fan-out.
* Pros: Small incremental model, keeps linear pipeline, solves the common multi-request case, preserves existing syntax, and is easy to document as repeatable templates.
* Cons: Requires introducing state context and a nested step executor.

**Approach B: Dedicated `request` / `browserRequest` steps**

* How it works: keep the pipeline linear, but add richer HTTP steps with `save`, `from`, `items`, `merge`, `concurrency`, and browser-context mode.
* Pros: More explicit around HTTP behavior; less general-purpose DSL complexity.
* Cons: Can grow into a large special-case HTTP mini-language; less reusable for non-HTTP fan-out.

**Approach C: Resource graph**

* How it works: adapters define named resources with dependencies, then a final projection maps resources to output rows.
* Pros: Very clear topology for complex business queries; strong foundation for caching and dependency visualization.
* Cons: Bigger conceptual shift; harder to implement; likely too heavy for TAP's current small CLI shape.

## Recommended MVP

Use Approach A: add named state plus `foreach`.

Keep the author-facing model intentionally small:

* `as`: save the step result under a name.
* `from`: read data from current data or a named state path.
* `foreach`: run nested steps for each item in a list and collect the results.

Avoid introducing a separate resource graph, custom join language, or many HTTP-specific keywords in the MVP.

Core syntax sketch:

```js
pipeline: [
  { fetch: { url: 'https://api.example.com/issues?q=${{ args.query }}', as: 'list' } },
  { select: { from: 'list', path: 'items', as: 'items' } },
  {
    foreach: {
      from: 'items',
      as: 'details',
      concurrency: 5,
      steps: [
        { fetch: { url: 'https://api.example.com/issues/${{ item.id }}' } },
        { mapOne: {
          id: '${{ item.id }}',
          title: '${{ item.title }}',
          assignee: '${{ data.assignee.name }}',
          status: '${{ data.status }}',
        }},
      ],
    },
  },
  { select: { from: 'details' } },
  { limit: '${{ args.limit }}' },
]
```

Browser-cookie-backed variant:

```js
pipeline: [
  { navigate: 'https://example.com' },
  { browserFetch: { url: '/api/issues', as: 'list', credentials: 'include' } },
  { select: { from: 'list', path: 'items', as: 'items' } },
  {
    foreach: {
      from: 'items',
      as: 'details',
      concurrency: 5,
      steps: [
        { browserFetch: { url: '/api/issues/${{ item.id }}', credentials: 'include' } },
        { mapOne: {
          id: '${{ item.id }}',
          title: '${{ item.title }}',
          status: '${{ data.status }}',
        }},
      ],
    },
  },
  { select: { from: 'details' } },
]
```

## Decision (ADR-lite)

**Context**: Current pipeline execution has only one current `data` slot. This makes multi-request adapters possible but awkward because request orchestration and result merging usually move into opaque `evaluate` strings.

**Decision**: Use the "named state + foreach" model as the MVP direction. Named state allows multiple fetch results to coexist under explicit names. `foreach` can iterate over any named state, run nested steps per item, and save the collected result into another named state.

**Consequences**: This keeps the existing linear pipeline model while adding enough composition power for common multi-request scenarios. The implementation must define a clear expression/context model so adapter authors can reliably reference current item data, current step data, root state, and named state values. Documentation and `tap-adapter-author` templates should present this as a small set of repeatable patterns, not as a general workflow language.
