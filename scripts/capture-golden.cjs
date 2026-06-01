// Temporary: captures current (Jison) parser output as the golden reference.
// Run with Node from the repo root (parse.ts reads ./src/chords.jison via cwd).
const fs = require("fs");
const path = require("path");

const mod = require("../dist/parse.js");
const parse = mod.default || mod;

const inline = {
  "inline: just chords": "C Cmaj7 Am F G",
  "inline: just lyrics": "test test test",
  "inline: just a heading": "[Verse]",
  "inline: empty": "",
};

const fixturesDir = path.join(__dirname, "..", "src", "__fixtures__");
const fixtures = {};
for (const name of fs.readdirSync(fixturesDir).sort()) {
  fixtures[`fixture: ${name}`] = fs.readFileSync(
    path.join(fixturesDir, name),
    "utf8",
  );
}

const cases = { ...inline, ...fixtures };
const golden = {};
for (const [name, text] of Object.entries(cases)) {
  try {
    golden[name] = { ok: true, value: parse(text) };
  } catch (err) {
    golden[name] = { ok: false, error: String((err && err.message) || err) };
  }
}

fs.writeFileSync(
  path.join(__dirname, "..", "golden.json"),
  JSON.stringify(golden, null, 2) + "\n",
);
console.log(
  `Captured ${Object.keys(golden).length} cases ` +
    `(${Object.values(golden).filter((g) => !g.ok).length} threw).`,
);
