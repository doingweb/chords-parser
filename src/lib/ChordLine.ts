import Chord from './Chord';
import SongLine from './SongLine';

export default class ChordLine implements SongLine {
  type = 'chords';

  constructor(public chords: Array<Chord>) {}
}
