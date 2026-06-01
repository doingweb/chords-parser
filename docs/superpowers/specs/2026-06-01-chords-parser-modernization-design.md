# chords-parser Modernization — Design Spec

**Date:** 2026-06-01
**Status:** Approved (design)
**Author:** Chris Antes (with Claude)

## 1. Background

`chords-parser` parses plain-text chord/song files (the format shared online for
guitar et al.) into a structured, typed object model. A song parses into a `Song`
with a `lines` array, where each line is classified as `heading`, `chords`,
`lyric`, or `empty`, preserving horizontal positions so chords can be re-aligned
over lyrics.

The current implementation (local `1.0.0`, three commits, last touched ~2020) has
several problems that block modernization:

- **Runtime grammar read.** `parse.ts` → `parser.ts` does
  `readFileSync('./src/chords.jison')` *at parse time*, from a hardcoded relative
  path. This throws for any consumer not running from the repo root (the published
  package would have been broken).
- **Jison is unmaintained.** Classic `jison@0.4.18` (2017) is CommonJS-only and
  cannot emit ESM; the `jison-gho` fork (2019) is also stale.
- **Stale toolchain.** ESLint 6, Prettier 2, Jest 25, TypeScript 3.8, yarn — all
  years out of date. `yarn.lock` is git-tracked; `dist/` and `yarn-error.log` are
  present on disk but untracked (already covered by `.gitignore`).
- **Metadata cruft.** `package.json` `repository`/`bugs`/`homepage` point at an
  unrelated `doingweb/watney-app` (a copy-paste error). The real remote is
  `git@github.com:doingweb/chords-parser.git`.
- **Latent cross-platform bug.** Imports use wrong filename casing
  (`./lib/song` for `Song.ts`, `./lib/chordLine` for `ChordLine.ts`, etc.). Works
  on case-insensitive macOS, breaks on Linux/CI.

## 2. Goals

Modernize the project into a clean, Deno-native TypeScript library while
**preserving current parse behavior**.

In scope:

1. Make the project Deno-only (runtime and toolchain), JSR-publish-ready.
2. Replace the Jison build step with **Peggy** (maintained PEG parser generator)
   producing a self-contained, zero-runtime-dependency parser.
3. Bring all tooling current (Deno built-in fmt/lint/test; remove npm-era tooling).
4. Remove the `watney-app` metadata cruft.
5. Fix the case-sensitive import bugs.
6. Document the grammar→parser regeneration step in `CLAUDE.md`.

## 3. Non-goals

- **No npm publishing or npm runtime.** No `package.json`, no dnt, no CJS, no dual
  build. Deno world only. (Deno consumers can still use the package via JSR; a
  Node consumer is explicitly not a target.)
- **No actual publishing this round.** Code is written publish-ready (scoped name
  `@doingweb/chords-parser`, JSR config present) but `deno publish` is not run.
- **No parser behavior changes / no chord-coverage fixes.** Known gaps (slash
  chords like `G/B`, `sus`, extended chords beyond the current regex) are
  deferred to a later bug-hunt against the user's Songbook
  (`~/Library/CloudStorage/Dropbox/Projects/Music/Songbook`, ~367 `.txt` files).
  Snapshot tests are the guardrail that behavior is unchanged.
- **No automated grammar/parser drift check, watcher, or repo-local skill.** A
  `CLAUDE.md` note is the only sync mechanism (user decision).

## 4. Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime / consumption | Deno-only, JSR-publish-ready | User prefers Deno; no Node consumer needed. |
| Parser generator | Peggy 5.x | Best-maintained grammar→parser tool (Mar 2026); emits a self-contained parser with **zero runtime deps**; `dts: true` gives types; stays build-time-only. |
| Generated parser | Committed build artifact | Required so JSR publishes from source and fresh clones work without a codegen step. |
| Grammar/parser sync | `CLAUDE.md` note only | User decision; no automation. |
| Lint/format/test | Deno built-ins + `jsr:@std/testing/snapshot` | Removes ~10 stale npm devDeps. |
| Package name | `@doingweb/chords-parser` | `chords-parser` (unscoped) is taken on npm by an unrelated package; scope avoids the collision. |
| Version | `0.1.0` | Signals pre-stable; bug-hunt still pending. |

## 5. Architecture

### 5.1 Parser pipeline

```
chords.peggy  --(deno task codegen / Peggy API)-->  parser.generated.js (+ .d.ts)
                                                          |
                                                          v
                                       parse.ts: parse(text) -> Song
```

- `src/grammar/chords.peggy` is the grammar source of truth, rewritten from the
  Jison BNF+lex grammar into PEG. PEG combines lexing and parsing, which fits this
  line-oriented format cleanly.
- A Peggy **initializer block** imports the `lib/` classes; grammar **actions**
  construct them directly (e.g. `new Chord(text(), location().start.offset)`),
  using Peggy's `location()` for chord positions and lyric offsets. This removes
  Jison's `yy`-injection indirection entirely.
- `deno task codegen` runs Peggy via `scripts/codegen.ts` (using the `npm:peggy`
  API), emitting an **ES-format**, self-contained `src/grammar/parser.generated.js`
  plus `src/grammar/parser.generated.d.ts`. The generated file imports the `lib/`
  classes (ES format supports imports) and has no runtime dependency on Peggy.
- `src/parse.ts` becomes:
  `export function parse(text: string): Song { return new Song(parseGrammar(text), text); }`
  where `parseGrammar` is the generated parser's `parse`.
- `src/index.ts` re-exports `parse` and the public types.

### 5.2 Behavior contract (must be preserved)

For input text, `parse()` returns a `Song { lines: SongLine[]; originalText: string }`.
Each `SongLine` is one of:

| `type` | Class | Fields |
|--------|-------|--------|
| `heading` | `SectionHeading` | `content` (text inside `[...]`) |
| `chords` | `ChordLine` | `chords: Chord[]`, each `Chord { content, position }` (0-based column) |
| `lyric` | `Lyric` | `content`, `offset` (0-based column) |
| `empty` | `EmptyLine` | — |

The chord token grammar is preserved verbatim from the current lexer regex:
`\b[A-G][b#]?((m(aj)?)?(2|4|5|6|7)?(add(2|4|9))?)?\b`. Section headings are
`[ ... ]`; lines that are neither chords-only nor a heading are lyrics; blank
lines are empty. Positions/offsets are 0-based columns matching current output.

### 5.3 Module boundaries

- `grammar/` — grammar source + generated parser. Sole responsibility: text → raw
  `SongLine[]`. Depends on `lib/` (for the constructed node classes).
- `lib/` — plain typed data classes (`Chord`, `ChordLine`, `Lyric`,
  `SectionHeading`, `EmptyLine`, `Song`, `SongLine` interface). No logic. No deps.
- `parse.ts` / `index.ts` — thin public surface. Depend on `grammar/` and `lib/`.
- `scripts/codegen.ts` — build-time only. Depends on `npm:peggy`. Not shipped logic.

## 6. Error handling

- Peggy parsers throw a `SyntaxError` (Peggy's `peg$SyntaxError`) on unparseable
  input, carrying `location` info. `parse()` lets this propagate unchanged; callers
  catch it. This matches the current contract (Jison also threw on parse errors)
  and is not a behavior change we need to design around — the existing fixtures and
  inline cases must continue to parse without throwing.
- Codegen failure (`deno task codegen`) surfaces Peggy's grammar error and exits
  non-zero; the committed parser is left untouched.

## 7. Testing

- `src/__tests__/parse.test.ts` runs under `deno test` with
  `jsr:@std/testing/snapshot`.
- Port the existing cases:
  - Four inline basic examples: "just chords" (`C Cmaj7 Am F G`), "just lyrics"
    (`test test test`), "just a heading" (`[Verse]`), "empty" (`''`).
  - Fixture-directory test: read every file in `src/__fixtures__/` (incl.
    `readme-example.txt` and the newly added Andrew Bird fixture) and snapshot the
    parse result.
- Snapshots are regenerated once with `deno test -- --update` (Deno's snapshot
  format differs from Jest's; the old `.snap` is discarded), then frozen and
  committed. They are the guardrail proving behavior is preserved.
- `deno task check` runs `deno fmt --check`, `deno lint`, and `deno test`.

## 8. File changes

**Delete (git-tracked — `git rm`):** `package.json`, `yarn.lock`, `.eslintrc.js`,
`.eslintignore`, `.prettierrc.js`, `jest.config.js`, `tsconfig.json`,
`src/parser.ts`, `src/@types/jison.d.ts`, `src/chords.jison`,
`src/__snapshots__/parse.test.ts.snap` (Jest-format).

**Delete (untracked — remove from working tree only):** `dist/`,
`yarn-error.log`. (Both are already gitignored; ensure `.gitignore` keeps
covering `dist/`.)

**Add:** `deno.json`, `CLAUDE.md`, `.gitignore`, `src/grammar/chords.peggy`,
`src/grammar/parser.generated.js`, `src/grammar/parser.generated.d.ts`,
`scripts/codegen.ts`, `src/__tests__/parse.test.ts`, regenerated Deno snapshot.

**Modify:** `src/parse.ts` (point at generated parser), `src/index.ts` (re-exports),
`README.md` (Deno/JSR usage; refresh the example and the TODO toward the Songbook
bug-hunt). Fix import casing across `src/` (`./lib/song` → `./lib/Song`, etc.).

**Keep as-is:** `LICENSE`, `.editorconfig`, `.markdownlint.json`, `.vscode/`,
`src/lib/*` class bodies (only import casing fixed), `src/__fixtures__/*`.

### Final layout

```
deno.json   README.md   LICENSE   CLAUDE.md   .gitignore
.editorconfig   .markdownlint.json   .vscode/
src/
  index.ts   parse.ts
  grammar/   chords.peggy   parser.generated.js   parser.generated.d.ts
  lib/       Chord.ts  ChordLine.ts  Lyric.ts  SectionHeading.ts  EmptyLine.ts  Song.ts  SongLine.ts
  __fixtures__/   __tests__/parse.test.ts
scripts/     codegen.ts
```

### deno.json (shape)

```jsonc
{
  "name": "@doingweb/chords-parser",
  "version": "0.1.0",
  "exports": "./src/index.ts",
  "tasks": {
    "codegen": "deno run -A scripts/codegen.ts",
    "test": "deno test -A",
    "fmt": "deno fmt",
    "lint": "deno lint",
    "check": "deno fmt --check && deno lint && deno test -A"
  },
  "imports": {
    "@std/testing": "jsr:@std/testing@^1",
    "peggy": "npm:peggy@^5"
  }
}
```

## 9. CLAUDE.md content (grammar sync note)

`CLAUDE.md` will instruct: the grammar source of truth is
`src/grammar/chords.peggy`; the parser in `src/grammar/parser.generated.*` is a
committed build artifact; **after editing the grammar, run `deno task codegen` and
commit the regenerated parser**; behavior is locked by snapshot tests, so review
snapshot diffs to confirm any change was intended.

## 10. Risks & mitigations

- **Peggy under Deno is "not officially tested."** Only affects running the
  *generator*; the generated parser runs natively. `scripts/codegen.ts` uses the
  Peggy API rather than the CLI for control. Fallback: codegen can run under Node
  (23.x present) if a Deno-specific issue arises — but this does not affect the
  shipped library.
- **PEG grammar must reproduce the exact chord regex and 0-based positions.**
  Mitigated by porting the regex verbatim and locking output with snapshot tests
  ported from the current behavior.
- **Committed generated code can drift from the grammar.** Accepted risk per user
  decision; mitigated only by the `CLAUDE.md` note (no automated check).

## 11. Out-of-scope follow-ups (later)

- Bug-hunt the parser against the Songbook corpus; expand chord coverage
  (slash/sus/extended chords) with new fixtures.
- Decide if/when to actually `deno publish` to JSR.
- Consider `parseFile()` / metadata frontmatter (original README TODO).
