# chords-parser Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize `chords-parser` into a Deno-only, JSR-publish-ready TypeScript library: replace unmaintained Jison with Peggy (build-time codegen, committed zero-runtime-dep parser), adopt Deno's built-in tooling, delete the npm-era toolchain and `watney-app` metadata, fix case-sensitive imports — all while preserving current parse behavior.

**Architecture:** A PEG grammar (`src/grammar/chords.peggy`) is the source of truth. A Deno codegen script runs Peggy to emit a self-contained ES-module parser (`parser.generated.js` + `.d.ts`), committed as a build artifact. `parse.ts` calls the generated parser and wraps the result in a `Song`. The `lib/` data classes are unchanged except for fixed import paths. Behavior preservation is proven by capturing a **golden reference** from the current Jison parser *before* deleting it, then iterating the new grammar until output matches; the verified output is then frozen as Deno snapshot tests.

**Tech Stack:** Deno 2.x (runtime, `deno fmt`/`deno lint`/`deno test`), Peggy 5.x (build-time PEG parser generator via `npm:peggy`), `jsr:@std/testing/snapshot`. Node 23.x is used once, for the golden capture only.

**Spec:** `docs/superpowers/specs/2026-06-01-chords-parser-modernization-design.md`

**Working location:** Work directly on `master`. Do **not** create a branch or worktree (user preference for this personal project). Commit after each task.

---

## Behavior contract (what the new parser must reproduce)

From the current implementation, `parse(text)` returns `Song { lines: SongLine[]; originalText: string }`. Each line:

| `type` | Class | Fields |
|--------|-------|--------|
| `heading` | `SectionHeading` | `content` — text inside `[...]` |
| `chords` | `ChordLine` | `chords: Chord[]`; each `Chord { content, position }` (0-based, per-line column) |
| `lyric` | `Lyric` | `content`, `offset` (0-based, per-line column) |
| `empty` | `EmptyLine` | — |

Canonical chord token, copied verbatim from the original Jison lexer rule:
`\b[A-G][b#]?((m(aj)?)?(2|4|5|6|7)?(add(2|4|9))?)?\b`

**The golden reference captured in Task 1 — not this prose — is the authoritative definition of current behavior**, including edge cases (trailing/blank-line handling, leading-whitespace handling on lyric offsets, lines that mix chords and words, etc.). The grammar is tuned in Task 5 until it matches that golden output.

### Watch-items (known Jison quirks to verify against golden, not assume)

- **Trailing empty line.** The current parser appears to emit a trailing `EmptyLine` from the end-of-input. Confirm exact count from golden.
- **Blank lines.** How runs of blank lines / whitespace-only lines map to `EmptyLine`s.
- **Lyric offset.** Leading whitespace is stripped from lyric `content`; the stripped width shows up in `offset`. Verify.
- **Per-line column.** Chord `position` / lyric `offset` are columns within the line (0-based), not absolute file offsets. Use `location().start.column - 1`, not `.offset`.
- **Mixed lines.** A line like `G blah` is neither pure-chords nor a heading. Jison may have thrown on these; the PEG grammar will instead treat them as lyrics. Any such divergence is surfaced by the golden diff in Task 5 — fix the grammar or, if the new behavior is preferable, record the difference and flag it to the user. Do not silently accept diffs.

---

## File Structure

| Path | Responsibility | Action |
|------|----------------|--------|
| `deno.json` | Single project manifest: name, version, exports, tasks, imports | Create |
| `.gitignore` | Ignore `dist/`, `node_modules/`, coverage, golden scaffolding | Create/replace |
| `CLAUDE.md` | Repo guidance incl. grammar→parser regeneration note | Create |
| `src/grammar/chords.peggy` | PEG grammar — source of truth | Create |
| `src/grammar/parser.generated.js` | Generated ES-module parser (committed artifact) | Create (via codegen) |
| `src/grammar/parser.generated.d.ts` | Types for the generated parser | Create (via codegen) |
| `scripts/codegen.ts` | Build-time: run Peggy → write generated parser | Create |
| `src/parse.ts` | Public `parse(text): Song` — calls generated parser | Modify |
| `src/index.ts` | Public surface — re-export `parse` + types | Modify |
| `src/lib/*.ts` | Data classes (unchanged logic; fix import paths) | Modify (imports only) |
| `src/__tests__/parse.test.ts` | `deno test` + `@std/testing/snapshot` | Create |
| `src/parse.test.ts`, `src/__snapshots__/` | Old Jest test + snapshot | Delete |
| `src/parser.ts`, `src/chords.jison`, `src/@types/jison.d.ts` | Jison runtime path | Delete |
| `package.json`, `yarn.lock`, `.eslintrc.js`, `.eslintignore`, `.prettierrc.js`, `jest.config.js`, `tsconfig.json` | npm-era toolchain | Delete |
| `dist/`, `yarn-error.log`, `node_modules/` | Build output / npm install (untracked) | Delete from working tree |

---

## Task 1: Capture the golden reference (ground truth) from the current parser

This must happen **first**, while the Jison parser still exists. It records exactly what the current parser produces (or throws) for every input, so the new parser can be proven equivalent.

**Files:**
- Create: `scripts/capture-golden.cjs` (temporary scaffolding, deleted in Task 7)
- Create: `golden.json` (temporary scaffolding, deleted in Task 7)

- [ ] **Step 1: Ensure deps + build the current TypeScript to `dist/`**

Run (from repo root):
```bash
npm install
npx tsc
```
Expected: `dist/parse.js` exists/refreshes with no compile errors.

- [ ] **Step 2: Write the capture script**

Create `scripts/capture-golden.cjs`:
```js
// Temporary: captures current (Jison) parser output as the golden reference.
// Run with Node from the repo root (parse.ts reads ./src/chords.jison via cwd).
const fs = require("fs");
const path = require("path");

const mod = require("../dist/parse.js");
const parse = mod.default || mod;

const inline = {
  "inline: just chords": "C Cmaj7 Am F G",
  "inline: just lyrics": "test test test",
  "inline: just a heading": "[Verse]",
  "inline: empty": "",
};

const fixturesDir = path.join(__dirname, "..", "src", "__fixtures__");
const fixtures = {};
for (const name of fs.readdirSync(fixturesDir).sort()) {
  fixtures[`fixture: ${name}`] = fs.readFileSync(
    path.join(fixturesDir, name),
    "utf8",
  );
}

const cases = { ...inline, ...fixtures };
const golden = {};
for (const [name, text] of Object.entries(cases)) {
  try {
    golden[name] = { ok: true, value: parse(text) };
  } catch (err) {
    golden[name] = { ok: false, error: String(err && err.message || err) };
  }
}

fs.writeFileSync(
  path.join(__dirname, "..", "golden.json"),
  JSON.stringify(golden, null, 2) + "\n",
);
console.log(
  `Captured ${Object.keys(golden).length} cases ` +
    `(${Object.values(golden).filter((g) => !g.ok).length} threw).`,
);
```

- [ ] **Step 3: Run the capture**

Run: `node scripts/capture-golden.cjs`
Expected: prints `Captured N cases (M threw).` and writes `golden.json`.

- [ ] **Step 4: Sanity-check the golden output**

Run: `head -40 golden.json`
Expected: JSON with `inline: just chords`, fixtures, etc. Each entry is either `{ ok: true, value: { lines: [...], originalText: ... } }` or `{ ok: false, error: ... }`.

**If any entry threw (`ok: false`)** — especially the newly-added `Andrew Bird - Tables and Chairs.txt` fixture — note it. It means the current parser cannot parse that input. Flag these to the user before continuing; they affect what "preserve behavior" means for those files (see Task 5 watch-items).

- [ ] **Step 5: Commit**

```bash
git add scripts/capture-golden.cjs golden.json
git commit -m "test: capture golden reference of current parser behavior"
```

---

## Task 2: Add Deno project configuration

**Files:**
- Create: `deno.json`
- Create: `.gitignore`

- [ ] **Step 1: Verify Deno is available**

Run: `deno --version`
Expected: `deno 2.x` (any 2.x is fine).

- [ ] **Step 2: Write `deno.json`**

Create `deno.json`:
```jsonc
{
  "name": "@doingweb/chords-parser",
  "version": "0.1.0",
  "exports": "./src/index.ts",
  "tasks": {
    "codegen": "deno run --allow-read --allow-write --allow-net scripts/codegen.ts",
    "test": "deno test --allow-read",
    "test:update": "deno test --allow-read --allow-write -- --update",
    "fmt": "deno fmt",
    "lint": "deno lint",
    "check": "deno fmt --check && deno lint && deno check src/index.ts && deno test --allow-read"
  },
  "imports": {
    "@std/testing": "jsr:@std/testing@^1",
    "peggy": "npm:peggy@^5"
  }
}
```

- [ ] **Step 3: Write `.gitignore`**

Create/replace `.gitignore` with:
```gitignore
# Build output
dist/

# Node (used only for the one-time golden capture)
node_modules/

# Deno
coverage/

# Temporary golden-reference scaffolding (removed in final cleanup)
/golden.json

# OS
.DS_Store
```

- [ ] **Step 4: Verify config parses**

Run: `deno fmt --check deno.json || deno fmt deno.json`
Expected: formats cleanly (no error).

- [ ] **Step 5: Commit**

```bash
git add deno.json .gitignore
git commit -m "build: add Deno project config and gitignore"
```

---

## Task 3: Fix `lib/` imports for Deno (casing + explicit `.ts` extensions)

Deno requires correct filename casing **and** explicit file extensions in relative imports. The current files use neither (`import SongLine from './SongLine'`, plus wrong-case imports elsewhere). Fix every intra-repo import under `src/lib/`. Do not change class logic.

**Files:**
- Modify: `src/lib/ChordLine.ts`, `src/lib/Lyric.ts`, `src/lib/SectionHeading.ts`, `src/lib/EmptyLine.ts`, `src/lib/Song.ts`

- [ ] **Step 1: Fix each import to correct case + `.ts` extension**

In `src/lib/ChordLine.ts`:
```ts
import Chord from "./Chord.ts";
import SongLine from "./SongLine.ts";
```
In `src/lib/Lyric.ts`, `src/lib/SectionHeading.ts`, `src/lib/EmptyLine.ts`:
```ts
import SongLine from "./SongLine.ts";
```
In `src/lib/Song.ts`:
```ts
import SongLine from "./SongLine.ts";
```

(`Chord.ts`, `SongLine.ts` have no relative imports — leave as-is.)

- [ ] **Step 2: Type-check the lib directory under Deno**

Run: `deno check src/lib/Song.ts src/lib/ChordLine.ts`
Expected: no errors. (Importing an `interface` as a default import works because `SongLine` is `export default interface`.)

- [ ] **Step 3: Format**

Run: `deno fmt src/lib/`
Expected: files reformatted to Deno style, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/
git commit -m "fix: use correct import casing and explicit .ts extensions in lib"
```

---

## Task 4: Add the Peggy grammar and codegen script; generate the parser

This produces the first generated parser. It is **not yet expected to match golden** — Task 5 wires it up and tunes it. Here we just get codegen working end-to-end.

**Files:**
- Create: `src/grammar/chords.peggy`
- Create: `scripts/codegen.ts`
- Create (generated): `src/grammar/parser.generated.js`, `src/grammar/parser.generated.d.ts`

- [ ] **Step 1: Write the starting grammar**

Create `src/grammar/chords.peggy`. This is a **starting point**; Task 5 tunes the line/empty/whitespace semantics against golden.
```peggy
// chords.peggy — source of truth for the chord-sheet grammar.
// After editing, regenerate the parser: `deno task codegen` (see CLAUDE.md).
{{
  import Chord from "../lib/Chord.ts";
  import ChordLine from "../lib/ChordLine.ts";
  import Lyric from "../lib/Lyric.ts";
  import SectionHeading from "../lib/SectionHeading.ts";
  import EmptyLine from "../lib/EmptyLine.ts";

  // Canonical chord token, ported verbatim from the original Jison lexer rule:
  //   \b[A-G][b#]?((m(aj)?)?(2|4|5|6|7)?(add(2|4|9))?)?\b
  const CHORD = /^[A-G][b#]?((m(aj)?)?(2|4|5|6|7)?(add(2|4|9))?)?$/;
}}

// A song is zero or more newline-terminated lines followed by one final line
// ended by end-of-input. EOF itself acts as a line terminator — mirroring the
// original Jison lexer's `[\n]|$` rule — so a bare "" parses to a single
// EmptyLine, "[Verse]" (no trailing newline) to one heading, and any file ending
// in "\n" to a trailing EmptyLine. (Verify exact counts against golden.)
song
  = head:newlineLine* tail:finalLine { return [...head, tail]; }

newlineLine = c:content "\r"? "\n" { return c; }
finalLine   = c:content !.         { return c; }

content
  = chordContent
  / headingContent
  / lyricContent
  / emptyContent

chordContent
  = inlineWs* first:chord rest:(inlineWs+ c:chord { return c; })* inlineWs* &lineEnd
    { return new ChordLine([first, ...rest]); }

chord
  = word:token &{ return CHORD.test(word); }
    { return new Chord(word, location().start.column - 1); }

headingContent
  = "[" inner:$[^\n]* "]" inlineWs* &lineEnd
    { return new SectionHeading(inner); }

lyricContent
  = inlineWs* lyric:lyricText &lineEnd { return lyric; }

lyricText
  = text:$[^\n]+ { return new Lyric(text, location().start.column - 1); }

emptyContent
  = inlineWs* &lineEnd { return new EmptyLine(); }

token    = $[^ \t\r\n]+
inlineWs = [ \t]
lineEnd  = "\r"? "\n" / !.
```

Notes on this starting grammar (all to be confirmed against golden in Task 5):
- `lineEnd` is a non-consuming lookahead matching a newline **or** end-of-input;
  the actual terminator is consumed by `newlineLine`/`finalLine`. This is what
  reproduces the EOF-as-EOL trailing-empty behavior without an infinite loop.
- Leading whitespace is consumed before the content token, so chord `position`
  and lyric `offset` (both `location().start.column - 1`) are measured from the
  first non-space character — matching the old lexer's whitespace-skip behavior.
- Ordered choice tries chords → heading → lyric → empty, so a line that is not
  purely chords falls through to a lyric (where Jison may have thrown — see
  watch-items).

- [ ] **Step 2: Write the codegen script**

Create `scripts/codegen.ts`:
```ts
// Build-time codegen: run Peggy over chords.peggy and write a self-contained
// ES-module parser plus a hand-stable .d.ts. No runtime dependency on Peggy.
import peggy from "peggy";

const root = new URL("../", import.meta.url);
const grammarPath = new URL("src/grammar/chords.peggy", root);
const jsOut = new URL("src/grammar/parser.generated.js", root);
const dtsOut = new URL("src/grammar/parser.generated.d.ts", root);

const grammar = await Deno.readTextFile(grammarPath);

const source = peggy.generate(grammar, {
  output: "source",
  format: "es",
}) as unknown as string;

const banner =
  "// @ts-nocheck\n// AUTO-GENERATED by `deno task codegen` from chords.peggy. Do not edit.\n";
await Deno.writeTextFile(jsOut, banner + source + "\n");

const dts = `// AUTO-GENERATED by \`deno task codegen\`. Do not edit.
import type SongLine from "../lib/SongLine.ts";

export function parse(input: string, options?: unknown): SongLine[];
export class SyntaxError extends Error {
  constructor(message: string, expected: unknown, found: unknown, location: unknown);
}
`;
await Deno.writeTextFile(dtsOut, dts);

console.log("Generated src/grammar/parser.generated.js + .d.ts");
```

- [ ] **Step 3: Run codegen**

Run: `deno task codegen`
Expected: prints `Generated src/grammar/parser.generated.js + .d.ts`. (First run downloads `npm:peggy`.)

**If `peggy.generate(..., { output: "source", format: "es" })` does not return a string in this Peggy version**, adjust: capture with `output: "source"` and inspect the return type; Peggy 5 returns the source string for `output: "source"`. If `format: "es"` import-hoisting misbehaves under Deno, fall back to generating to a temp file via the Peggy CLI (`deno run -A npm:peggy --format es -o <file> <grammar>`) inside the script. The grammar's `{{ }}` imports must end up hoisted to the top of the generated module.

- [ ] **Step 4: Confirm the generated parser imports the lib classes and exports `parse`**

Run: `grep -n "export function parse\|from \"../lib/" src/grammar/parser.generated.js | head`
Expected: shows a `parse` export and `import ... from "../lib/...ts"` lines hoisted near the top.

- [ ] **Step 5: Commit**

```bash
git add src/grammar/chords.peggy scripts/codegen.ts src/grammar/parser.generated.js src/grammar/parser.generated.d.ts
git commit -m "feat: add Peggy grammar and codegen for generated parser"
```

---

## Task 5: Wire `parse.ts`/`index.ts` to the generated parser, delete Jison, and tune the grammar to match golden

This is the behavior-preservation core. We make `parse()` use the generated parser, then iterate the grammar (re-running codegen) until output equals the golden reference.

**Files:**
- Modify: `src/parse.ts`, `src/index.ts`
- Delete: `src/parser.ts`, `src/chords.jison`, `src/@types/jison.d.ts`
- Create: `src/__tests__/golden.test.ts` (temporary cross-check, removed in Task 7)
- Iterate: `src/grammar/chords.peggy` (+ re-run `deno task codegen`)

- [ ] **Step 1: Rewrite `src/parse.ts` to use the generated parser**

Replace `src/parse.ts` with:
```ts
import { parse as parseChords } from "./grammar/parser.generated.js";
import Song from "./lib/Song.ts";

export default function parse(text: string): Song {
  return new Song(parseChords(text), text);
}
```

- [ ] **Step 2: Update `src/index.ts` exports**

Replace `src/index.ts` with:
```ts
export { default as parse } from "./parse.ts";
export { default as Song } from "./lib/Song.ts";
export { default as SongLine } from "./lib/SongLine.ts";
export { default as ChordLine } from "./lib/ChordLine.ts";
export { default as Chord } from "./lib/Chord.ts";
export { default as Lyric } from "./lib/Lyric.ts";
export { default as SectionHeading } from "./lib/SectionHeading.ts";
export { default as EmptyLine } from "./lib/EmptyLine.ts";
```

- [ ] **Step 3: Delete the Jison runtime path**

```bash
git rm src/parser.ts src/chords.jison src/@types/jison.d.ts
```
Expected: three files removed. (`src/@types/` may now be empty — remove the dir if so.)

- [ ] **Step 4: Write the temporary golden cross-check test**

Create `src/__tests__/golden.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@^1";
import parse from "../parse.ts";

const golden: Record<string, { ok: boolean; value?: unknown; error?: string }> =
  JSON.parse(await Deno.readTextFile(new URL("../../golden.json", import.meta.url)));

const fixturesDir = new URL("../__fixtures__/", import.meta.url);

function inputFor(name: string): string {
  if (name.startsWith("inline: ")) {
    return {
      "inline: just chords": "C Cmaj7 Am F G",
      "inline: just lyrics": "test test test",
      "inline: just a heading": "[Verse]",
      "inline: empty": "",
    }[name]!;
  }
  return Deno.readTextFileSync(new URL(name.replace("fixture: ", ""), fixturesDir));
}

for (const [name, expected] of Object.entries(golden)) {
  Deno.test(`matches golden — ${name}`, () => {
    const input = inputFor(name);
    if (expected.ok) {
      // Compare structurally via JSON round-trip (class instances vs plain objects).
      assertEquals(JSON.parse(JSON.stringify(parse(input))), expected.value);
    } else {
      // Current parser threw on this input; document divergence rather than assert.
      // The new grammar may parse it instead — surface, don't silently pass.
      let threw = false;
      try {
        parse(input);
      } catch {
        threw = true;
      }
      assertEquals(threw, true, `expected new parser to also reject: ${name}`);
    }
  });
}
```

- [ ] **Step 5: Run the cross-check and read the diffs**

Run: `deno test --allow-read src/__tests__/golden.test.ts`
Expected initially: some failures. Each failure shows exactly how the new parser's output differs from golden.

- [ ] **Step 6: Iterate the grammar until the cross-check passes**

For each failing case: adjust `src/grammar/chords.peggy`, re-run `deno task codegen`, re-run the cross-check. Focus on the watch-items (trailing empty, blank lines, lyric offset, per-line column, mixed lines, greedy heading match).

The starting grammar already models EOF-as-terminator (the trailing-empty / bare-`""` / no-trailing-newline cases), so the most likely *remaining* diffs are: (a) whitespace-only lines — the old Jison lexer's `\s+` skip greedily eats spaces *and* newlines, so a `"   \n"` line may not become an `EmptyLine` the way the starting grammar produces one; and (b) `ok: false` golden entries where the old parser threw on a mixed chord/word line that the new grammar now reads as a lyric. Resolve (a) by tuning the whitespace handling to match golden; for (b) follow the next bullet.

- For `ok: false` golden entries (current parser threw): if the new grammar parses them instead, that's a **deliberate behavior improvement, not a match**. Do **not** contort the grammar to reproduce a crash. Instead, leave the new (parsing) behavior, remove that case from the strict cross-check, and **add it to a list to report to the user** at handoff.

Run after each change: `deno task codegen && deno test --allow-read src/__tests__/golden.test.ts`
Expected (final): all kept cases PASS.

- [ ] **Step 7: Type-check and format**

Run: `deno check src/index.ts && deno fmt`
Expected: no type errors; files formatted.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: replace Jison with generated Peggy parser (behavior matched to golden)"
```

---

## Task 6: Freeze behavior as Deno snapshot tests

With behavior proven equal to golden, create the permanent snapshot test the spec calls for.

**Files:**
- Create: `src/__tests__/parse.test.ts`
- Delete: `src/parse.test.ts`, `src/__snapshots__/parse.test.ts.snap` (old Jest)

- [ ] **Step 1: Remove the old Jest test + snapshot**

```bash
git rm src/parse.test.ts src/__snapshots__/parse.test.ts.snap
```

- [ ] **Step 2: Write the Deno snapshot test**

Create `src/__tests__/parse.test.ts`:
```ts
import { assertSnapshot } from "@std/testing/snapshot";
import parse from "../parse.ts";

const inline: Array<[string, string]> = [
  ["just chords", "C Cmaj7 Am F G"],
  ["just lyrics", "test test test"],
  ["just a heading", "[Verse]"],
  ["empty", ""],
];

for (const [name, text] of inline) {
  Deno.test(`basic: ${name}`, async (t) => {
    await assertSnapshot(t, parse(text));
  });
}

const fixturesDir = new URL("../__fixtures__/", import.meta.url);
for (const entry of Deno.readDirSync(fixturesDir)) {
  if (!entry.isFile) continue;
  Deno.test(`fixture: ${entry.name}`, async (t) => {
    const text = Deno.readTextFileSync(new URL(entry.name, fixturesDir));
    await assertSnapshot(t, parse(text));
  });
}
```

- [ ] **Step 3: Generate the snapshots**

Run: `deno task test:update`
Expected: creates `src/__tests__/__snapshots__/parse.test.ts.snap`; all tests pass with snapshots written.

- [ ] **Step 4: Verify snapshots are frozen (re-run without update)**

Run: `deno task test`
Expected: all tests PASS against the committed snapshot (no update).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add Deno snapshot tests, remove Jest suite"
```

---

## Task 7: Final cleanup — remove npm-era files, scaffolding, README, CLAUDE.md

**Files:**
- Delete (tracked): `package.json`, `yarn.lock`, `.eslintrc.js`, `.eslintignore`, `.prettierrc.js`, `jest.config.js`, `tsconfig.json`
- Delete (scaffolding): `scripts/capture-golden.cjs`, `golden.json`, `src/__tests__/golden.test.ts`
- Delete (untracked working tree): `dist/`, `yarn-error.log`, `node_modules/`
- Create: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Remove tracked npm-era files**

```bash
git rm package.json yarn.lock .eslintrc.js .eslintignore .prettierrc.js jest.config.js tsconfig.json
```

- [ ] **Step 2: Remove golden scaffolding**

```bash
git rm scripts/capture-golden.cjs golden.json src/__tests__/golden.test.ts
```

- [ ] **Step 3: Remove untracked build/install artifacts from the working tree**

```bash
rm -rf dist node_modules yarn-error.log
```
Expected: gone. (`.gitignore` already covers `dist/`/`node_modules/`.)

- [ ] **Step 4: Write `CLAUDE.md`**

Create `CLAUDE.md`:
```markdown
# CLAUDE.md

`chords-parser` is a Deno-only TypeScript library that parses plain-text chord
sheets into a typed `Song` model. Published target: JSR as `@doingweb/chords-parser`.

## Commands

- `deno task test` — run snapshot tests
- `deno task test:update` — update snapshots (after an intended behavior change)
- `deno task codegen` — regenerate the parser from the grammar
- `deno task check` — fmt check + lint + type-check + tests

## Grammar → parser (IMPORTANT)

The parser is generated. The source of truth is `src/grammar/chords.peggy`;
`src/grammar/parser.generated.js` / `.d.ts` are committed build artifacts.

**After editing `src/grammar/chords.peggy`, you MUST run `deno task codegen` and
commit the regenerated parser.** Then run `deno task test` and review any snapshot
diffs to confirm the behavior change was intended (update with `deno task test:update`).

## Conventions

- Deno-native: explicit `.ts` extensions on relative imports; `deno fmt`/`deno lint`.
- No npm/Node toolchain. Node is not a supported runtime.
```

- [ ] **Step 5: Rewrite `README.md`**

Update `README.md`: keep the format description and the parse example, but replace any install/usage notes with Deno/JSR usage:
```markdown
## Usage

```ts
import { parse } from "jsr:@doingweb/chords-parser";

const song = parse("[Verse]\nG       C\nHello there\n");
console.log(song.lines);
```

(Not yet published to JSR.)
```
Also refresh the TODO section to point at the Songbook bug-hunt
(`~/Library/CloudStorage/Dropbox/Projects/Music/Songbook`, ~367 `.txt` files) and
expanded chord coverage. Remove any reference to files that do not exist.

- [ ] **Step 6: Final full check**

Run: `deno task check`
Expected: fmt clean, lint clean, type-check clean, all snapshot tests pass.

- [ ] **Step 7: Confirm the repo is clean and Deno-only**

Run: `git status && ls`
Expected: no `package.json`/`yarn.lock`/`tsconfig.json`; `deno.json`, `CLAUDE.md`, `src/grammar/` present; working tree clean after commit.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove npm-era toolchain and scaffolding; add CLAUDE.md; Deno-only README"
```

---

## Done criteria

- `deno task check` passes (fmt, lint, type-check, snapshot tests).
- `deno task codegen` regenerates `parser.generated.*` deterministically.
- New parser output matches the golden reference for all kept cases; any deliberate
  divergences (inputs the old parser threw on) are reported to the user.
- No npm/Node toolchain files remain; `watney-app` metadata is gone (with `package.json`).
- Repo is Deno-only, JSR-publish-ready as `@doingweb/chords-parser@0.1.0` (not published).

## Deferred (out of scope — later)

- Bug-hunt the grammar against the full Songbook corpus; expand chord coverage
  (slash/sus/extended chords) with new fixtures.
- Actually `deno publish` to JSR.
- `parseFile()` / metadata frontmatter (original README TODO).
```
