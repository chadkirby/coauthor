# @ckirby/coauthor

> Edge-native local-first sync and AI co-authoring engine for Cloudflare Durable Objects and Swift.

`@ckirby/coauthor` provides building blocks for inexpensive, local-first synchronization and autonomous AI agent co-authoring across web and native mobile apps (iOS / macOS).

## Architectural Foundations

1. **State-Based Join-Semilattice (Per-Register LWW):** Commutative, associative, and idempotent register merging (`mergeStamp`) prevents conflict resolution races without complex operational transformation or fragile append-only transaction logs.
2. **Subpath Exports:**
   - `@ckirby/coauthor/core`: Zero-dependency join-semilattice merge and fractional indexing.
   - `@ckirby/coauthor/do`: Cloudflare SQLite Durable Object register tables and patch helpers.
   - `@ckirby/coauthor/agent`: Short handle projection (`L1..Ln`) and $O(1)$ touched-ID precondition checking for LLM tool calls.
   - `@ckirby/coauthor/wasi`: In-memory preview-1 WASI runner for executing pure compiled domain engines (`wasm32-wasip1`) inside Cloudflare Workers (`workerd`).
3. **CoauthorKit (SwiftPM):** Native Swift mirror package ensuring 100% mathematical parity across iOS, macOS, and Cloudflare Workers.

## Installation

### Node / Cloudflare Workers
```bash
pnpm add @ckirby/coauthor
```

### Swift Package Manager (iOS / macOS)
Add to your `Package.swift`:
```swift
dependencies: [
    .package(url: "https://github.com/chadkirby/coauthor.git", from: "0.1.0")
]
```

## License
MIT © Chad Kirby
