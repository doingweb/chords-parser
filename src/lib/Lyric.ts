import SongLine from './SongLine';

export default class Lyric implements SongLine {
  type = 'lyric';

  constructor(public content: string, public offset: number) {}
}
