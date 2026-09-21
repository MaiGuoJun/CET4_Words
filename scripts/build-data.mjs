import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const workspaceDir = path.resolve(projectDir, "..", "..");
const sourceDir = path.join(workspaceDir, "work", "sources");
const cetPath = path.join(sourceDir, "cet_full_list.json");
const ecdictPath = path.join(sourceDir, "ecdict.csv");
const outputPath = path.join(projectDir, "dist", "data", "words.json");

const phraseRows = [
  ["ability", "have the ability to", "有能力做……"],
  ["absence", "in the absence of", "在缺少……的情况下"],
  ["access", "have access to", "有权使用；可以接近"],
  ["account", "take into account", "把……考虑在内"],
  ["according", "according to", "根据；按照"],
  ["achieve", "achieve a goal", "实现目标"],
  ["adapt", "adapt to", "适应……"],
  ["add", "add to", "增加；增添"],
  ["addition", "in addition to", "除……之外还"],
  ["admit", "admit to", "承认……"],
  ["advantage", "take advantage of", "利用；占……的便宜"],
  ["agree", "agree with", "同意；与……一致"],
  ["aim", "aim at", "以……为目标"],
  ["allow", "allow for", "考虑到；顾及"],
  ["answer", "the answer to", "……的答案"],
  ["apologize", "apologize for", "因……道歉"],
  ["apply", "apply for", "申请……"],
  ["approach", "an approach to", "处理……的方法"],
  ["arrive", "arrive at", "到达；得出"],
  ["associate", "associate with", "与……联系；交往"],
  ["attention", "pay attention to", "注意……"],
  ["aware", "be aware of", "意识到……"],
  ["basis", "on the basis of", "以……为基础"],
  ["belief", "believe in", "相信；信任"],
  ["belong", "belong to", "属于……"],
  ["benefit", "benefit from", "从……中受益"],
  ["borrow", "borrow from", "从……借入"],
  ["break", "break down", "出故障；分解"],
  ["bring", "bring about", "导致；引起"],
  ["build", "build up", "逐步建立；增强"],
  ["call", "call for", "需要；要求"],
  ["capable", "be capable of", "有能力做……"],
  ["care", "take care of", "照顾；处理"],
  ["carry", "carry out", "执行；实施"],
  ["catch", "catch up with", "赶上……"],
  ["challenge", "face a challenge", "面对挑战"],
  ["change", "make a change", "作出改变"],
  ["come", "come up with", "想出；提出"],
  ["communicate", "communicate with", "与……沟通"],
  ["compare", "compare with", "与……比较"],
  ["concern", "be concerned about", "担心；关注"],
  ["consist", "consist of", "由……组成"],
  ["contribute", "contribute to", "有助于；促成"],
  ["cope", "cope with", "应对；处理"],
  ["cut", "cut down on", "减少……"],
  ["deal", "deal with", "处理；应对"],
  ["depend", "depend on", "依靠；取决于"],
  ["derive", "derive from", "源自……"],
  ["determine", "be determined to", "决心做……"],
  ["devote", "devote to", "致力于……"],
  ["different", "be different from", "与……不同"],
  ["difficulty", "have difficulty in", "做……有困难"],
  ["distinguish", "distinguish from", "把……与……区分开"],
  ["effect", "have an effect on", "对……有影响"],
  ["effort", "make an effort", "作出努力"],
  ["engage", "engage in", "从事；参加"],
  ["essential", "be essential to", "对……至关重要"],
  ["exclude", "exclude from", "把……排除在外"],
  ["experience", "gain experience", "获得经验"],
  ["expose", "be exposed to", "接触；暴露于……"],
  ["fail", "fail to", "未能做……"],
  ["familiar", "be familiar with", "熟悉……"],
  ["focus", "focus on", "专注于……"],
  ["free", "be free from", "不受……影响"],
  ["good", "be good at", "擅长……"],
  ["graduate", "graduate from", "毕业于……"],
  ["habit", "get into the habit of", "养成……的习惯"],
  ["happen", "happen to", "碰巧；发生在……身上"],
  ["help", "help with", "帮助处理……"],
  ["importance", "attach importance to", "重视……"],
  ["improve", "improve on", "改进；做得更好"],
  ["influence", "have an influence on", "对……有影响"],
  ["insist", "insist on", "坚持……"],
  ["interest", "be interested in", "对……感兴趣"],
  ["involve", "be involved in", "参与；涉及"],
  ["lead", "lead to", "导致；通向"],
  ["look", "look forward to", "期待……"],
  ["maintain", "maintain a balance", "保持平衡"],
  ["make", "make use of", "利用……"],
  ["mind", "keep in mind", "牢记……"],
  ["need", "in need of", "需要……"],
  ["object", "object to", "反对……"],
  ["opportunity", "take the opportunity to", "抓住机会做……"],
  ["participate", "participate in", "参加……"],
  ["pay", "pay for", "为……付款；付出代价"],
  ["prefer", "prefer to", "更愿意做……"],
  ["prevent", "prevent from", "阻止……做……"],
  ["provide", "provide with", "为……提供……"],
  ["reason", "the reason for", "……的原因"],
  ["recover", "recover from", "从……中恢复"],
  ["refer", "refer to", "提到；参考；指的是"],
  ["relation", "in relation to", "关于；与……相比"],
  ["rely", "rely on", "依靠；信赖"],
  ["remind", "remind of", "使想起；提醒"],
  ["respond", "respond to", "回应……"],
  ["responsible", "be responsible for", "对……负责；是……的原因"],
  ["result", "result in", "导致……"],
  ["risk", "at risk", "处于危险中"],
  ["role", "play a role in", "在……中发挥作用"],
  ["search", "search for", "寻找……"],
  ["similar", "be similar to", "与……相似"],
  ["spend", "spend on", "在……上花费"],
  ["succeed", "succeed in", "成功做……"],
  ["suffer", "suffer from", "遭受；患有"],
  ["suitable", "be suitable for", "适合……"],
  ["support", "in support of", "支持……"],
  ["take", "take part in", "参加……"],
  ["think", "think of", "想到；认为"],
  ["time", "take your time", "慢慢来；不用着急"],
  ["translate", "translate into", "翻译成；转化为"],
  ["turn", "turn out", "结果是；证明是"],
  ["way", "in this way", "用这种方式"],
  ["willing", "be willing to", "愿意做……"],
  ["word", "in other words", "换句话说"],
  ["worry", "worry about", "担心……"]
];

const phrases = new Map(phraseRows.map(([word, phrase, phraseMeaning]) => [word, { phrase, phraseMeaning }]));

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else value += char;
  }
  values.push(value);
  return values;
}

function normalizeTranslation(value) {
  if (!value) return "";
  return value
    .replace(/\\n/g, "；")
    .replace(/\[网络\][^；]*/g, "")
    .replace(/；{2,}/g, "；")
    .replace(/^；|；$/g, "")
    .slice(0, 240);
}

const partOfSpeechFallbacks = {
  online: "adj. / adv.",
  app: "n.",
  laptop: "n.",
  download: "n. / v.",
  cyberspace: "n.",
  upload: "n. / v.",
  "according to": "prep.",
  "air-conditioning": "n.",
  am: "v.",
  "cell-phone": "n.",
  internet: "n.",
  "ought to": "aux.",
  "résumé": "n."
};

function extractPartsOfSpeech(value, word) {
  const labels = [];
  const normalized = { n: "n.", pl: "n.", vt: "v.", vi: "v.", v: "v.", a: "adj.", adj: "adj.", adv: "adv.", prep: "prep.", pron: "pron.", num: "num.", conj: "conj.", interj: "interj.", int: "interj.", aux: "aux.", art: "art." };
  for (const match of String(value || "").matchAll(/(?:^|；|\\r；)(n|pl|vt|vi|v|a|adj|adv|prep|pron|num|conj|interj|int|aux|art)\./g)) {
    const label = normalized[match[1]];
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.join(" / ") || partOfSpeechFallbacks[word.toLocaleLowerCase("en-US")] || "";
}

if (!fs.existsSync(cetPath) || !fs.existsSync(ecdictPath)) {
  throw new Error("Missing source data. Download CETVocabulary and ECDICT into work/sources first.");
}

const source = JSON.parse(fs.readFileSync(cetPath, "utf8"));
const cetRows = source["四六级词汇词频排序表"];
const cet4 = cetRows.filter((row) => !row["六级"]);
const target = new Map(cet4.map((row) => [row["单词"].toLocaleLowerCase("en-US"), row]));
const supplements = new Map();

const stream = fs.createReadStream(ecdictPath, { encoding: "utf8" });
const input = readline.createInterface({ input: stream, crlfDelay: Infinity });
let headers = null;
for await (const line of input) {
  if (!headers) {
    headers = parseCsvLine(line);
    continue;
  }
  const values = parseCsvLine(line);
  const word = values[0]?.toLocaleLowerCase("en-US");
  if (!target.has(word)) continue;
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  supplements.set(word, record);
  if (supplements.size === target.size) break;
}

const seen = new Set();
const output = cet4.filter((row) => {
  const normalized = row["单词"].toLocaleLowerCase("en-US");
  if (seen.has(normalized)) return false;
  seen.add(normalized);
  return true;
}).map((row) => {
  const normalized = row["单词"].toLocaleLowerCase("en-US");
  const extra = supplements.get(normalized) || {};
  const phrase = phrases.get(normalized) || {};
  const coreTranslation = String(row["释义"] || "").trim();
  return {
    word: row["单词"],
    phonetic: extra.phonetic || "",
    partOfSpeech: extractPartsOfSpeech(extra.translation, row["单词"]),
    translation: coreTranslation || normalizeTranslation(extra.translation),
    brief: coreTranslation,
    rank: row["序号"],
    frequency: row["词频"],
    category: row["分类"] || "",
    variant: row["其他拼写"] || "",
    ...phrase
  };
});

fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(JSON.stringify({ total: output.length, supplemented: supplements.size, phrases: output.filter((item) => item.phrase).length, outputPath }));
