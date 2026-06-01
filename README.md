# chords-parser

Parses chord files — a common format used online to share how to play popular
music (usually for guitar and other stringed instruments) — into a typed model.

Deno-only; published target: [JSR](https://jsr.io) as `@doingweb/chords-parser`.

## Usage

```ts
import { parse } from "jsr:@doingweb/chords-parser";

const song = parse("[Verse]\nG       C\nHello there\n");
console.log(song.lines);
```

> Not yet published to JSR.

## Example

Input:

```text
[Verse]
G       C         D            G
This is where the lyrics would go
```

Parses to a `Song` whose `lines` classify each line as `heading`, `chords`,
`lyric`, or `empty`, preserving column positions:

```jsonc
{
  "lines": [
    { "content": "Verse", "type": "heading" },
    {
      "chords": [
        { "content": "G", "position": 0 },
        { "content": "C", "position": 8 },
        { "content": "D", "position": 18 },
        { "content": "G", "position": 31 }
      ],
      "type": "chords"
    },
    {
      "content": "This is where the lyrics would go",
      "offset": 0,
      "type": "lyric"
    },
    { "type": "empty" }
  ],
  "originalText": "[Verse]\nG       C         D            G\n..."
}
```

## Development

```sh
deno task test        # run snapshot tests
deno task codegen     # regenerate the parser from the grammar
deno task check       # fmt check + lint + type-check + tests
```

The parser is generated from `src/grammar/chords.peggy`, a
[Peggy](https://peggyjs.org) PEG grammar. The generated
`src/grammar/parser.generated.*` files are committed build artifacts — after
editing the grammar, run `deno task codegen` and commit the result. See
[`CLAUDE.md`](./CLAUDE.md).

## TODO

- Bug-hunt the grammar against a larger song corpus; expand chord coverage
  (slash chords like `G/B`, `sus`, extended chords).
- More fixtures.
- `parseFile()` accepting a filename, possibly with frontmatter metadata.
