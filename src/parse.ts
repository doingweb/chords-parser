// @deno-types="./grammar/parser.generated.d.ts"
import { parse as parseChords } from "./grammar/parser.generated.js";
import Song from "./lib/Song.ts";

export default function parse(text: string): Song {
  return new Song(parseChords(text), text);
}
