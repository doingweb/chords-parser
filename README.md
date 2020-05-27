chords-parser
=============

Parses chord files, a common format used on the internet to share how to play popular music (usually for guitar and other stringed instruments).

Example:

```text
[Verse]
G       C         D            G
This is where the lyrics would go
```

Parses as:

```json
{
  "lines": [
    {
      "content": "Verse",
      "type": "heading",
    },
    {
      "chords": [
        {
          "content": "G",
          "position": 0,
        },
        {
          "content": "C",
          "position": 8,
        },
        {
          "content": "D",
          "position": 18,
        },
        {
          "content": "G",
          "position": 31,
        },
      ],
      "type": "chords",
    },
    {
      "content": "This is where the lyrics would go",
      "offset": 0,
      "type": "lyric",
    },
    {
      "type": "empty",
    },
  ],
  "originalText": "[Verse]
G       C         D            G
This is where the lyrics would go
",
}
```

TODO
----

* More fixtures
* Run some more real songs through it to find bugs
* Add a `parseFile()` that accepts a filename?
  * Specify frontmatter as a custom metadata format?
