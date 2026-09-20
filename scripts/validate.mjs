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
if (words.length !== 4023) throw new Error(`Expected 4023 unique CET-4 words, found ${words.length}`);
if (wordNames.size !== words.length) throw new Error("Word list contains duplicates");
if (words.filter((item) => item.phrase).length !== 100) throw new Error("Expected exactly 100 curated phrases");
if (words.filter((item) => item.phonetic).length < 3980) throw new Error("Too many words are missing phonetics");
if (words.some((item) => !item.translation || !Number.isFinite(item.rank))) throw new Error("Word data has missing required fields");

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
  phonetics: words.filter((item) => item.phonetic).length,
  phrases: words.filter((item) => item.phrase).length,
  listeningTracks: tracks.length,
  listeningCharacters: tracks.reduce((total, item) => total + item.transcript.length, 0)
}));
