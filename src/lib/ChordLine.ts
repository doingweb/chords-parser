import type Chord from "./Chord.ts";
import type SongLine from "./SongLine.ts";

export default class ChordLine implements SongLine {
  type = "chords";

  constructor(public chords: Array<Chord>) {}
}
