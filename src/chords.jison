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
    {return $1}
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
    {$$ = new yy.ChordLine($1)}
  ;
chords
  : chord
    {$$ = [$1]}
  | chords chord
    {$$ = [...$1, $2]}
  ;
chord
  : CHORD
    {$$ = new yy.Chord($1, @1.first_column)}
  ;
lyricLine
  : LYRICS EOL
    {$$ = new yy.Lyric($1, @1.first_column)}
  ;
sectionHeading
  : SECTION_HEADING EOL
    {$$ = new yy.SectionHeading(/\[(.*)\]/.exec($1)[1])}
  ;
emptyLine
  : EOL
    {$$ = new yy.EmptyLine()}
  ;
