import { parse } from './parse';

it('tokenizes chords', () => {
  expect(parse('Cmaj7')).toMatchInlineSnapshot(
    `"Let's parse that 5-character long thing 📖"`
  );
});
