const fs = require("node:fs");

const app = fs.readFileSync("dist/app.js", "utf8");
const html = fs.readFileSync("dist/index.html", "utf8");
const words = JSON.parse(fs.readFileSync("dist/data/words.json", "utf8"));

const requireText = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
};

if (words.length !== 5754) throw new Error(`Expected 5754 words, found ${words.length}`);
if (words.filter((word) => word.course === "cet4").length !== 3454) throw new Error("Expected 3454 CET-4 course words");
if (words.filter((word) => word.course === "cet6").length !== 2300) throw new Error("Expected 2300 advanced-course words");
if (words.filter((word) => word.isPostgradExtension).length !== 1051) throw new Error("Expected 1051 postgraduate extension words");
if (new Set(words.map((word) => word.word.toLowerCase())).size !== words.length) throw new Error("Word library contains duplicate entries");

requireText(html, 'data-view-target="words"', "word-library navigation");
requireText(html, 'id="wordLibrarySearch"', "word search");
requireText(html, 'data-course-select', "course selector");
requireText(html, 'id="wordLibraryPageJump"', "page jump form");
requireText(html, 'id="wordLibraryPageInput" type="number"', "numeric page input");
requireText(html, 'data-word-filter="learned"', "learned filter");
requireText(html, 'data-word-filter="unlearned"', "unlearned filter");
requireText(html, 'data-word-filter="known"', "known filter");
requireText(html, 'data-word-filter="fuzzy"', "fuzzy filter");
requireText(html, 'data-word-filter="unknown"', "unknown filter");
requireText(app, "function wordLibraryFilteredWords()", "word filtering engine");
requireText(app, "pageSize: 80", "mobile-safe pagination");
requireText(app, "function jumpWordLibraryPage()", "page jump behavior");
requireText(app, "function switchCourse(nextCourse)", "course switching behavior");
requireText(app, "word.phraseMeaning", "phrase/meaning search corpus");
requireText(app, "data-word-list-speak", "word-list pronunciation control");

console.log("Word library smoke test passed");
