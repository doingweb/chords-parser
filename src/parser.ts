import { readFileSync } from 'fs';
import { Parser } from 'jison';

const grammar = readFileSync('./src/chords.jison', 'utf8');

const parser = new Parser(grammar);

export default parser;
