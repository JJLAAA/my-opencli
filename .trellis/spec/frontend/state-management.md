# State Management

> Not applicable to this project.

---

TAP is a stateless CLI tool. Each invocation is independent — no state is persisted between runs. There is no UI framework or global state layer.

Pipeline data flows linearly: `executePipeline()` threads `data` through each step sequentially and returns the final result. This is the only "state" in the system.
