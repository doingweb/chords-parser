import { assertEquals } from "jsr:@std/assert@^1";
import parse from "../parse.ts";

const golden: Record<string, { ok: boolean; value?: unknown; error?: string }> =
  JSON.parse(
    await Deno.readTextFile(new URL("../../golden.json", import.meta.url)),
  );

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
  return Deno.readTextFileSync(
    new URL(name.replace("fixture: ", ""), fixturesDir),
  );
}

for (const [name, expected] of Object.entries(golden)) {
  Deno.test(`matches golden — ${name}`, () => {
    const input = inputFor(name);
    if (expected.ok) {
      // Compare structurally via JSON round-trip (class instances vs plain objects).
      assertEquals(JSON.parse(JSON.stringify(parse(input))), expected.value);
    } else {
      // Current parser threw on this input; document divergence rather than assert.
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
