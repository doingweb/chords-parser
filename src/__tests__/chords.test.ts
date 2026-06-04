import { assertEquals } from "@std/assert";
import parse from "../parse.ts";

function firstLineType(text: string): string {
  return parse(text).lines[0].type;
}

Deno.test("recognizes extended chord vocabulary as chord lines", () => {
  const chordLines = [
    "C G/B Am7b5 Dsus4",
    "Asus4 Dsus2 Gsus4 Asus2",
    "D/F# A/C# F#7/Bb Eb/D",
    "Cmaj7 Bm11 G9 C#dim Eaug",
    "Gm6/D D5/A Cadd9 D7sus2",
    "D A Bm E Em A (F#)", // optional/passing chord in parentheses
  ];
  for (const line of chordLines) {
    assertEquals(firstLineType(line + "\n"), "chords", line);
  }
});

Deno.test("does not misclassify prose as chord lines", () => {
  const lyricLines = [
    "the quick brown fox",
    "Add up the love we made", // starts with a chord-ish word
    "Bee in the garden",
    "Climb every mountain",
  ];
  for (const line of lyricLines) {
    assertEquals(firstLineType(line + "\n"), "lyric", line);
  }
});

Deno.test("strips carriage returns from line content", () => {
  const line = parse("Hello there\r\n").lines[0] as {
    type: string;
    content: string;
  };
  assertEquals(line.type, "lyric");
  assertEquals(line.content, "Hello there");
});
