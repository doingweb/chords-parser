import parser from './parser';
import Song from './lib/song';

export default function parse(text: string): Song {
  return new Song(parser.parse(text), text);
}
