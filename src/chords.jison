/*
Parses chord files, a common format used on the internet to share how to play
popular music (usually for guitar and other stringed instruments).

Example:

```
[Verse]
G       C         D            G
This is where the lyrics would go
```
*/

/* lexical grammar */
%lex

%%
\b[A-G][b#]?((m(aj)?)?(2|4|5|6|7)?(add(2|4|9))?)?\b   return 'CHORD';
\[.*\]                                                return 'SECTION_HEADING';
[\n]|$                                                return 'EOL';
\s+                                                   /* skip whitespace */
.*                                                    return 'LYRICS';

/lex

%start song

%% /* language grammar */

song
  : songLines
    {return {
      lines: $1
    };}
  ;
songLines
  : songLine
    {$$ = [$1]}
  | songLines songLine
    {$$ = [...$1, $2]}
  ;
songLine
  : chordLine
  | lyricLine
  | sectionHeading
  | emptyLine
  ;
chordLine
  : chords EOL
    {$$ = {
      type: 'chords',
      chords: $1
    }}
  ;
chords
  : chords chord
    {$$ = [...$1, $2]}
  | chord
    {$$ = [$1]}
  ;
chord
  : CHORD
    {$$ = {
      type: 'chord',
      position: @1.first_column,
      value: $1
    }}
  ;
lyricLine
  : LYRICS EOL
    {$$ = {
      type: 'lyrics',
      offset: @1.first_column,
      value: $1
    }}
  ;
sectionHeading
  : SECTION_HEADING EOL
    {$$ = {
      type: 'heading',
      value: /\[(.*)\]/.exec($1)[1]
    }}
  ;
emptyLine
  : EOL
    {$$ = { type: 'emptyLine' }}
  ;
