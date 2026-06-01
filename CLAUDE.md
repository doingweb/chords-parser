# CLAUDE.md

`chords-parser` is a Deno-only TypeScript library that parses plain-text chord
sheets into a typed `Song` model. Published target: JSR as
`@doingweb/chords-parser`.

## Commands

- `deno task test` — run snapshot tests
- `deno task test:update` — update snapshots (after an intended behavior change)
- `deno task codegen` — regenerate the parser from the grammar
- `deno task check` — fmt check + lint + type-check + tests

## Grammar → parser (IMPORTANT)

The parser is generated. The source of truth is `src/grammar/chords.peggy`;
`src/grammar/parser.generated.js` / `.d.ts` are committed build artifacts.

**After editing `src/grammar/chords.peggy`, you MUST run `deno task codegen` and
commit the regenerated parser.** Then run `deno task test` and review any
snapshot diffs to confirm the behavior change was intended (update with
`deno task test:update`).

## Conventions

- Deno-native: explicit `.ts` extensions on relative imports; `deno fmt` /
  `deno lint`.
- No npm/Node toolchain. Node is not a supported runtime.
- Work directly on `master` for this personal project (no feature branches).
