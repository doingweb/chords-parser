// chords.peggy — source of truth for the chord-sheet grammar.
// After editing, regenerate the parser: `deno task codegen` (see CLAUDE.md).
{{
  import Chord from "../lib/Chord.ts";
  import ChordLine from "../lib/ChordLine.ts";
  import Lyric from "../lib/Lyric.ts";
  import SectionHeading from "../lib/SectionHeading.ts";
  import EmptyLine from "../lib/EmptyLine.ts";

  // Canonical chord token, ported verbatim from the original Jison lexer rule:
  //   \b[A-G][b#]?((m(aj)?)?(2|4|5|6|7)?(add(2|4|9))?)?\b
  const CHORD = /^[A-G][b#]?((m(aj)?)?(2|4|5|6|7)?(add(2|4|9))?)?$/;
}}

// A song is zero or more newline-terminated lines followed by one final line
// ended by end-of-input. EOF itself acts as a line terminator — mirroring the
// original Jison lexer's `[\n]|$` rule — so a bare "" parses to a single
// EmptyLine, "[Verse]" (no trailing newline) to one heading, and any file ending
// in "\n" to a trailing EmptyLine.
song
  = head:newlineLine* tail:finalLine { return [...head, tail]; }

newlineLine = c:content "\r"? "\n" { return c; }
finalLine   = c:content !. { return c; }

content
  = chordContent
  / headingContent
  / lyricContent
  / emptyContent

chordContent
  = inlineWs* first:chord rest:(inlineWs+ c:chord { return c; })* inlineWs* &lineEnd
    { return new ChordLine([first, ...rest]); }

chord
  = word:token &{ return CHORD.test(word); }
    { return new Chord(word, location().start.column - 1); }

headingContent
  = "[" inner:$[^\]\n]* "]" inlineWs* &lineEnd
    { return new SectionHeading(inner); }

lyricContent
  = inlineWs* lyric:lyricText &lineEnd { return lyric; }

lyricText
  = text:$[^\n]+ { return new Lyric(text, location().start.column - 1); }

emptyContent
  = inlineWs* &lineEnd { return new EmptyLine(); }

token    = $[^ \t\r\n]+
inlineWs = [ \t]
lineEnd  = "\r"? "\n" / !.
