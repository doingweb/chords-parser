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
