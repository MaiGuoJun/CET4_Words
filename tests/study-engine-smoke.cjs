const fs = require("node:fs");
const vm = require("node:vm");

let source = fs.readFileSync("dist/app.js", "utf8");
source = source.replace(/init\(\);\s*$/, `
  const exact = scoreTextMatch("I enjoy studying English.", "I enjoy studying English");
  const partial = scoreTextMatch("I enjoy studying English.", "I study");
  const srs = applySRSReview({}, 5, "2026-09-23");
  const sentences = splitTranscriptSentences("First sentence. Second sentence! Is this third?");
  const synthetic = new Float32Array(16000);
  for (let index = 0; index < synthetic.length; index += 1) synthetic[index] = Math.sin(2 * Math.PI * 440 * index / 16000) * 0.25;
  const features = extractPronunciationFeatures(synthetic, 16000);
  const other = new Float32Array(16000);
  for (let index = 0; index < other.length; index += 1) other[index] = Math.sin(2 * Math.PI * 1200 * index / 16000) * 0.25;
  const otherFeatures = extractPronunciationFeatures(other, 16000);
  const sameSound = scorePronunciationFeatures(features, features);
  const differentSound = scorePronunciationFeatures(features, otherFeatures);
  const combined = combinedPronunciationScore({ textScore: 100, soundScore: 80, rhythmScore: 60, sentence: false });
  globalThis.__studyResults = { exact, partial, srs, sentences, featureFrames: features.frames.length, duration: features.duration, combined, sameSound, differentSound };
`);

const storage = new Map();
const context = {
  localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  navigator: {}, window: {}, document: {}, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout,
  AbortController, URL, Blob, Response, Request, TextEncoder, TextDecoder, Date, Intl, console
};
vm.runInNewContext(source, context);
const result = context.__studyResults;
if (result.exact.score !== 100) throw new Error("Exact speech match should score 100");
if (result.partial.score >= result.exact.score) throw new Error("Partial speech match should score lower");
if (result.srs.interval !== 1 || result.srs.repetitions !== 1 || result.srs.due !== "2026-09-24") throw new Error("First successful SRS review should schedule one day later");
if (result.sentences.length !== 3) throw new Error("Transcript should split into three sentences");
if (result.featureFrames < 20 || result.duration < 0.9) throw new Error("Pronunciation feature extraction should retain voiced audio");
if (result.combined !== 83) throw new Error("Pronunciation component weights changed unexpectedly");
if (result.sameSound.soundScore <= result.differentSound.soundScore) throw new Error("Acoustic scoring should prefer identical audio features");
console.log("Study engine smoke test passed");
