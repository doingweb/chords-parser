import SongLine from "./SongLine.ts";

export default class Lyric implements SongLine {
  type = "lyric";

  constructor(public content: string, public offset: number) {}
}
