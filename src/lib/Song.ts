import SongLine from './SongLine';

export default class Song {
  constructor(public lines: Array<SongLine>, public originalText: string) {}
}
