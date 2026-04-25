# Type Safety

> Not applicable to this project.

---

TAP uses plain JavaScript (no TypeScript). There is no type system, no validation library, and no runtime schema validation.

Adapter shape correctness is enforced by convention: `{ args, columns, pipeline }`. If a field is missing or malformed, the CLI will fail at runtime with a natural JS error.
