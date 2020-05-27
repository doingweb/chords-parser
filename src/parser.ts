import { readFileSync } from 'fs';
import { Parser } from 'jison';
import Chord from './lib/Chord';
import ChordLine from './lib/chordLine';
import Lyric from './lib/Lyric';
import SectionHeading from './lib/sectionHeading';
import EmptyLine from './lib/emptyLine';

const grammar = readFileSync('./src/chords.jison', 'utf8');

const parser = new Parser(grammar);
parser.yy.Chord = Chord;
parser.yy.ChordLine = ChordLine;
parser.yy.Lyric = Lyric;
parser.yy.SectionHeading = SectionHeading;
parser.yy.EmptyLine = EmptyLine;

export default parser;
