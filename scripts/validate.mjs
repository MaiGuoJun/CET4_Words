import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(projectDir, "dist");
const required = [
  "index.html",
  "styles.css",
  "app.js",
  "sw.js",
  "manifest.webmanifest",
  "icon.svg",
  "data/words.json",
  "data/listening.json",
  "audio/close-near.mp3",
  "audio/ever-never.mp3",
  "audio/buy-pay.mp3"
];

const missing = required.filter((file) => !fs.existsSync(path.join(dist, file)));
if (missing.length) throw new Error(`Missing files: ${missing.join(", ")}`);

const words = JSON.parse(fs.readFileSync(path.join(dist, "data", "words.json"), "utf8"));
const wordNames = new Set(words.map((item) => item.word.toLocaleLowerCase("en-US")));
if (words.length !== 5754) throw new Error(`Expected 5754 unique study words, found ${words.length}`);
if (wordNames.size !== words.length) throw new Error("Word list contains duplicates");
const cet4Count = words.filter((item) => item.level === "CET4" && !item.isCET6Supplement).length;
const cet6Count = words.filter((item) => item.level === "CET6" && item.isCET6Supplement).length;
const postgradCount = words.filter((item) => item.level === "POSTGRAD" && item.isPostgradExtension).length;
if (cet4Count + cet6Count + postgradCount !== words.length || !cet4Count || !cet6Count || !postgradCount) throw new Error("Word level labels are incomplete");
if (cet4Count !== 3454 || cet6Count !== 1249 || postgradCount !== 1051) throw new Error(`Unexpected level split: ${cet4Count} CET-4 / ${cet6Count} CET-6 / ${postgradCount} postgraduate`);
if (words.filter((item) => item.course === "cet4").length !== 3454 || words.filter((item) => item.course === "cet6").length !== 2300) throw new Error("Course split is incomplete");
const excludedBasicSamples = ["the", "a", "to", "apple", "banana", "book", "cat", "dog", "job", "pencil", "red", "work"];
const retainedBasic = excludedBasicSamples.filter((word) => wordNames.has(word));
if (retainedBasic.length) throw new Error(`Basic primary words remain: ${retainedBasic.join(", ")}`);
const phraseEntries = words.reduce((total, item) => total + (item.phrases?.length || 0), 0);
if (phraseEntries < 120) throw new Error(`Expected at least 120 curated phrase entries, found ${phraseEntries}`);
if (words.filter((item) => item.phonetic).length < 5400) throw new Error("Too many words are missing phonetics");
if (words.some((item) => !item.translation || !item.partOfSpeech || !Number.isFinite(item.rank))) throw new Error("Word data has missing required fields");
if (words.filter((item) => item.senses?.length > 1).length < 250) throw new Error("Too few words have ranked multi-sense entries");
const meaningCount = words.reduce((total, word) => total + word.senses.reduce((count, sense) => count + sense.meaning.split("；").filter(Boolean).length, 0), 0);
if (meaningCount < 10_000) throw new Error(`Too few exam-relevant meanings: ${meaningCount}`);
for (const word of words) {
  if (!Array.isArray(word.senses) || !word.senses.length) throw new Error(`${word.word} has no ranked senses`);
  if (word.senses[0].stars !== 3) throw new Error(`${word.word} does not start with a three-star sense`);
  word.senses.forEach((sense, index) => {
    if (!sense.partOfSpeech || !sense.meaning) throw new Error(`${word.word} has an incomplete sense`);
    if (sense.stars < 1 || sense.stars > 3 || !Number.isInteger(sense.stars * 2)) throw new Error(`${word.word} has an invalid star score`);
    if (index && sense.stars > word.senses[index - 1].stars) throw new Error(`${word.word} senses are not ordered by exam frequency`);
  });
}

const requireSense = (word, partOfSpeech, pattern) => {
  const item = words.find((entry) => entry.word.toLocaleLowerCase("en-US") === word);
  const sense = item?.senses.find((entry) => entry.partOfSpeech === partOfSpeech);
  if (!sense || !pattern.test(sense.meaning)) throw new Error(`${word} is missing its curated ${partOfSpeech} sense`);
};
const requirePrimarySense = (word, partOfSpeech, pattern, senseCount) => {
  const item = words.find((entry) => entry.word.toLocaleLowerCase("en-US") === word);
  const primary = item?.senses?.[0];
  if (!primary || primary.partOfSpeech !== partOfSpeech || !pattern.test(primary.meaning)) {
    throw new Error(`${word} has an incorrect primary sense`);
  }
  if (senseCount && item.senses.length !== senseCount) {
    throw new Error(`${word} has ${item.senses.length} senses; expected ${senseCount}`);
  }
};
requireSense("sheet", "n.", /床单/);
requireSense("good", "adj.", /好的/);
requireSense("mark", "n.", /分数/);
requireSense("approach", "n.", /方法/);
requireSense("medical", "adj.", /医疗的/);
requirePrimarySense("minute", "n.", /分钟/, 2);
requirePrimarySense("though", "conj.", /尽管|虽然/, 2);
requirePrimarySense("patient", "adj.", /耐心/, 2);
requirePrimarySense("current", "adj.", /当前|现行/, 2);
requirePrimarySense("content", "n.", /内容/, 2);
requirePrimarySense("fit", "adj.", /健康|合适/, 2);
requirePrimarySense("grant", "v.", /同意|准予/, 2);
requirePrimarySense("gather", "v.", /聚集|搜集/, 2);
requirePrimarySense("medium", "adj.", /中等/, 2);
requirePrimarySense("novel", "adj.", /新颖|新奇/, 2);
requirePrimarySense("relative", "n.", /亲戚|亲属/, 2);
requirePrimarySense("household", "n.", /一户|家庭/, 2);
requirePrimarySense("accord", "n.", /协议|一致/, 2);
requirePrimarySense("cause", "v.", /造成|引起/, 2);
requirePrimarySense("claim", "v.", /索要|声称/, 2);
requirePrimarySense("decline", "v.", /拒绝|下降/, 2);
requirePrimarySense("guide", "v.", /指引|指导/, 2);
requirePrimarySense("lie", "n.", /谎话|谎言/, 2);
requirePrimarySense("peer", "v.", /凝视/, 2);
requirePrimarySense("spot", "v.", /发现|认出/, 2);
requirePrimarySense("touch", "v.", /触摸|感动/, 2);
requirePrimarySense("however", "adv.", /然而/, 2);
requirePrimarySense("graduate", "v.", /毕业/, 2);
requirePrimarySense("release", "v.", /释放|解除/, 2);
requirePrimarySense("boost", "v.", /增加|促进/, 2);
if (words.find((entry) => entry.word === "sheet").senses.some((sense) => sense.partOfSpeech === "v.")) throw new Error("sheet still exposes its low-frequency verb sense");

const tracks = JSON.parse(fs.readFileSync(path.join(dist, "data", "listening.json"), "utf8"));
if (tracks.length !== 3) throw new Error("Expected three built-in listening tracks");
for (const track of tracks) {
  if (!track.audio.startsWith("./audio/")) throw new Error(`${track.id} does not use a bundled audio file`);
  if (track.transcript.length < 1000) throw new Error(`${track.id} transcript is unexpectedly short`);
  const audioPath = path.join(dist, track.audio.replace(/^\.\//, ""));
  if (fs.statSync(audioPath).size < 1_000_000) throw new Error(`${track.id} audio is unexpectedly small`);
}

const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
if (!html.includes("viewport-fit=cover")) throw new Error("Mobile viewport metadata is missing");
if (!html.includes("manifest.webmanifest")) throw new Error("PWA manifest link is missing");
if (/正式版将|TODO/i.test(html + fs.readFileSync(path.join(dist, "data", "listening.json"), "utf8"))) {
  throw new Error("Placeholder content remains in the final site");
}

const manifest = JSON.parse(fs.readFileSync(path.join(dist, "manifest.webmanifest"), "utf8"));
if (manifest.display !== "standalone" || !manifest.icons?.length) throw new Error("PWA manifest is incomplete");

console.log(JSON.stringify({
  files: required.length,
  words: words.length,
  cet4: cet4Count,
  cet6Supplement: cet6Count,
  postgradExtension: postgradCount,
  phonetics: words.filter((item) => item.phonetic).length,
  phraseWords: words.filter((item) => item.phrase).length,
  phraseEntries,
  meaningCount,
  multiSenseWords: words.filter((item) => item.senses.length > 1).length,
  listeningTracks: tracks.length,
  listeningCharacters: tracks.reduce((total, item) => total + item.transcript.length, 0)
}));
