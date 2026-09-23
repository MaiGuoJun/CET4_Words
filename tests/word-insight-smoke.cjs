const fs = require("node:fs");
const vm = require("node:vm");

let source = fs.readFileSync("dist/app.js", "utf8");
source = source.replace(/init\(\);\s*$/, `
  words = __words;
  initializeWordInsightIndex();
  const cases = ["create", "transport", "employ", "educate", "inform"];
  globalThis.__results = cases.map((name) => {
    const word = wordLookup.get(name);
    const insight = word ? buildWordInsight(word) : null;
    return {
      name,
      exists: Boolean(word),
      derivatives: insight?.derivatives.map((item) => item.word) || [],
      affixes: insight?.affixes.map((item) => item.label) || [],
      roots: insight?.roots.map((item) => item.label) || [],
      mnemonic: insight?.mnemonic || ""
    };
  });
`);

const storage = new Map();
const context = {
  __words: JSON.parse(fs.readFileSync("dist/data/words.json", "utf8")),
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  },
  navigator: {},
  window: {},
  document: {},
  matchMedia: () => ({ matches: false }),
  setTimeout,
  clearTimeout,
  AbortController,
  URL,
  Blob,
  Response,
  Request,
  TextEncoder,
  TextDecoder,
  Date,
  Intl,
  console
};

vm.runInNewContext(source, context);
const byName = Object.fromEntries(context.__results.map((item) => [item.name, item]));

if (!byName.create.exists || !byName.inform.exists) throw new Error("Expected smoke-test words are missing");
if (!byName.transport.affixes.includes("trans-")) throw new Error("transport should expose trans-");
if (!byName.transport.roots.includes("port")) throw new Error("transport should expose port");
if (byName.transport.derivatives[0] !== "port") throw new Error("A direct family base should rank before sibling words");
if (byName.create.mnemonic.length < 20) throw new Error("create should receive a mnemonic");

console.log(JSON.stringify(context.__results, null, 2));
