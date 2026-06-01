import Chord from "./Chord.ts";
import SongLine from "./SongLine.ts";

export default class ChordLine implements SongLine {
  type = "chords";

  constructor(public chords: Array<Chord>) {}
}
