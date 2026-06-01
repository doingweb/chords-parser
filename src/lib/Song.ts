import SongLine from "./SongLine.ts";

export default class Song {
  constructor(public lines: Array<SongLine>, public originalText: string) {}
}
