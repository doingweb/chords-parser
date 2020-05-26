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
      "type": "heading",
      "value": "Verse",
    },
    {
      "chords": [
        {
          "position": 0,
          "type": "chord",
          "value": "G",
        },
        {
          "position": 8,
          "type": "chord",
          "value": "C",
        },
        {
          "position": 18,
          "type": "chord",
          "value": "D",
        },
        {
          "position": 31,
          "type": "chord",
          "value": "G",
        },
      ],
      "type": "chords",
    },
    {
      "offset": 0,
      "type": "lyrics",
      "value": "This is where the lyrics would go",
    }
  ]
}
```

TODO
----

* Proper API w/Types
* Rewrite tests for new API
* Tests for multiline inputs
* Run some more real songs through it to find bugs
