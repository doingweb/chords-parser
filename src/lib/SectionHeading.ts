import SongLine from "./SongLine.ts";

export default class SectionHeading implements SongLine {
  type = "heading";

  constructor(public content: string) {}
}
