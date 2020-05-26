import { readFileSync } from 'fs';
import * as path from 'path';
import parser from './parser';

describe('basic examples', () => {
  it('just chords', () => {
    const songText = 'C Cmaj7 Am F G';

    expect(parser.parse(songText)).toMatchInlineSnapshot(`
      Object {
        "lines": Array [
          Object {
            "chords": Array [
              Object {
                "position": 0,
                "type": "chord",
                "value": "C",
              },
              Object {
                "position": 2,
                "type": "chord",
                "value": "Cmaj7",
              },
              Object {
                "position": 8,
                "type": "chord",
                "value": "Am",
              },
              Object {
                "position": 11,
                "type": "chord",
                "value": "F",
              },
              Object {
                "position": 13,
                "type": "chord",
                "value": "G",
              },
            ],
            "type": "chords",
          },
        ],
      }
    `);
  });

  it('just lyrics', () => {
    const songText = 'test test test';

    expect(parser.parse(songText)).toMatchInlineSnapshot(`
      Object {
        "lines": Array [
          Object {
            "offset": 0,
            "type": "lyrics",
            "value": "test test test",
          },
        ],
      }
    `);
  });

  it('just a heading', () => {
    const songText = '[Verse]';

    expect(parser.parse(songText)).toMatchInlineSnapshot(`
      Object {
        "lines": Array [
          Object {
            "type": "heading",
            "value": "Verse",
          },
        ],
      }
    `);
  });

  it('empty', () => {
    const songText = '';

    expect(parser.parse(songText)).toMatchInlineSnapshot(`
      Object {
        "lines": Array [
          Object {
            "type": "emptyLine",
          },
        ],
      }
    `);
  });

  it.todo('multiline examples');
});
