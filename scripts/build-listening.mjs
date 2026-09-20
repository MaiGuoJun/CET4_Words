import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const sourceDir = path.resolve(projectDir, "..", "..", "work", "sources");
const outputPath = path.join(projectDir, "dist", "data", "listening.json");

const tracks = [
  {
    id: "voa-close-near",
    file: "close-near.html",
    start: "Today we answer a question from Mehdi.",
    end: "<p><em>Anne Ball",
    title: "Close or Near?",
    duration: "2:14",
    source: "VOA Learning English",
    sourceUrl: "https://learningenglish.voanews.com/a/close-or-near-/5166467.html",
    audio: "./audio/close-near.mp3",
    byline: "Anne Ball · Edited by Kelly Jean Kelly"
  },
  {
    id: "voa-ever-never",
    file: "ever-never.html",
    start: "This week we answer a question from Viola in China",
    end: "<p><em>Dr. Jill Robbins wrote",
    title: "Ever or Never?",
    duration: "2:45",
    source: "VOA Learning English",
    sourceUrl: "https://learningenglish.voanews.com/a/ever-or-never/5357398.html",
    audio: "./audio/ever-never.mp3",
    byline: "Dr. Jill Robbins · Edited by Caty Weaver"
  },
  {
    id: "voa-buy-pay",
    file: "buy-pay.html",
    start: "This week on Ask a Teacher, we answer a request from a reader in Guinea.",
    end: "<p><em>Alice Bryant wrote",
    title: "Buy and Pay",
    duration: "2:50",
    source: "VOA Learning English",
    sourceUrl: "https://learningenglish.voanews.com/a/buy-and-pay/5845605.html",
    audio: "./audio/buy-pay.mp3",
    byline: "Alice Bryant · Edited by Mario Ritter, Jr."
  }
];

function decodeEntities(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function extractTranscript(config) {
  const html = fs.readFileSync(path.join(sourceDir, config.file), "utf8");
  const textStart = html.indexOf(config.start);
  if (textStart < 0) throw new Error(`Start marker not found: ${config.file}`);
  const start = html.lastIndexOf("<p", textStart);
  const end = html.indexOf(config.end, textStart);
  if (end < 0) throw new Error(`End marker not found: ${config.file}`);
  return decodeEntities(html.slice(start, end))
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h\d>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const output = tracks.map((track) => {
  const { file, start, end, ...metadata } = track;
  return { ...metadata, transcript: extractTranscript(track) };
});

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify(output.map((track) => ({ id: track.id, characters: track.transcript.length }))));
