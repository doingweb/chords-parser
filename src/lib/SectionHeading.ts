import SongLine from './SongLine';

export default class SectionHeading implements SongLine {
  type = 'heading';

  constructor(public content: string) {}
}
