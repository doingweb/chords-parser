import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import parse from './parse';

describe('basic examples', () => {
  test.each([
    ['just chords', 'C Cmaj7 Am F G'],
    ['just lyrics', 'test test test'],
    ['just a heading', '[Verse]'],
    ['empty', ''],
  ])('%s', (_, songText) => {
    expect(parse(songText)).toMatchSnapshot();
  });
});

describe('fixtures', () => {
  const fixturesPath = path.join(__dirname, '__fixtures__');
  const filenames = readdirSync(fixturesPath);

  test.each(filenames)('%s', (filename) => {
    const songText = readFileSync(path.join(fixturesPath, filename), 'utf8');
    expect(parse(songText)).toMatchSnapshot();
  });
});
