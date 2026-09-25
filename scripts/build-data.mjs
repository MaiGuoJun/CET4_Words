import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const workspaceDir = path.resolve(projectDir, "..", "..");
const sourceDir = process.env.CET_SOURCE_DIR
  ? path.resolve(process.env.CET_SOURCE_DIR)
  : path.join(workspaceDir, "work", "sources");
const cetPath = path.join(sourceDir, "cet_full_list.json");
const ecdictPath = path.join(sourceDir, "ecdict.csv");
const outputPath = path.join(projectDir, "dist", "data", "words.json");
const ADVANCED_COURSE_WORD_COUNT = 2300;
const PRIMARY_BOOK_PATTERN = /^PEPXiaoXue[3-6]_[12]\.json$/;
const elementaryGrammarWords = new Set(`
  the a an to of and or but if so as than
  i you he she it we they me him her us them
  my your his its our their mine yours hers ours theirs
  this that these those who whom whose what which when where why how
  be am is are was were been being have has had do does did
  can could may might must shall should will would not no yes
  in on at by for from with up down out here there now then
  one two three four five six seven eight nine ten
  all any some many much more most few little only very
`.trim().split(/\s+/));

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
  ["worry", "worry about", "担心……"],
  ["able", "be able to", "能够做……"],
  ["accept", "accept responsibility for", "承担……的责任"],
  ["account", "account for", "解释；占据一定比例"],
  ["afraid", "be afraid of", "害怕……"],
  ["ask", "ask for", "请求；要求得到"],
  ["base", "be based on", "以……为基础"],
  ["case", "in this case", "在这种情况下"],
  ["cause", "the cause of", "……的原因"],
  ["charge", "be in charge of", "负责；主管"],
  ["charge", "free of charge", "免费"],
  ["connect", "connect with", "与……连接；联系"],
  ["consider", "consider doing", "考虑做……"],
  ["demand", "in demand", "需求量大；受欢迎"],
  ["difference", "make a difference", "产生影响；带来改变"],
  ["due", "due to", "由于；因为"],
  ["end", "in the end", "最后；最终"],
  ["fact", "in fact", "事实上"],
  ["famous", "be famous for", "因……而著名"],
  ["full", "be full of", "充满……"],
  ["get", "get rid of", "摆脱；除去"],
  ["give", "give up", "放弃"],
  ["go", "go through", "经历；仔细检查"],
  ["impact", "have an impact on", "对……产生影响"],
  ["increase", "an increase in", "……的增长"],
  ["job", "do a good job", "把事情做好"],
  ["job", "on the job", "在工作中；在职"],
  ["keep", "keep up with", "跟上……"],
  ["known", "be known for", "因……而闻名"],
  ["likely", "be likely to", "很可能做……"],
  ["matter", "no matter", "无论；不管"],
  ["means", "by means of", "借助；通过"],
  ["order", "in order to", "为了做……"],
  ["particular", "in particular", "尤其；特别"],
  ["place", "take place", "发生；举行"],
  ["point", "point out", "指出"],
  ["possible", "as soon as possible", "尽快"],
  ["prepare", "prepare for", "为……作准备"],
  ["proud", "be proud of", "为……感到自豪"],
  ["purpose", "for the purpose of", "为了……"],
  ["put", "put forward", "提出；推荐"],
  ["ready", "be ready for", "为……做好准备"],
  ["regard", "regard as", "把……视为……"],
  ["related", "be related to", "与……有关"],
  ["replace", "replace with", "用……替换……"],
  ["require", "require doing", "需要被做……"],
  ["response", "in response to", "作为对……的回应"],
  ["result", "result from", "由……引起"],
  ["satisfied", "be satisfied with", "对……感到满意"],
  ["set", "set up", "建立；设立"],
  ["suppose", "be supposed to", "应该；被期望做……"],
  ["terms", "in terms of", "就……而言"],
  ["use", "make use of", "利用……"],
  ["used", "be used to", "习惯于……"],
  ["work", "work out", "解决；计算出；锻炼"],
  ["worth", "be worth doing", "值得做……"],
  ["wrong", "go wrong", "出错；出故障"]
];

const phraseIndex = new Map();
for (const [word, text, meaning] of phraseRows) {
  if (!phraseIndex.has(word)) phraseIndex.set(word, []);
  phraseIndex.get(word).push({ text, meaning });
}

const senseOverrides = new Map(Object.entries({
  the: [{ partOfSpeech: "art.", meaning: "这（个）；那（个）；特指的人或事物", stars: 3 }],
  a: [{ partOfSpeech: "art.", meaning: "一（个）；某一；每一", stars: 3 }],
  to: [
    { partOfSpeech: "prep.", meaning: "到；向；对于", stars: 3 },
    { partOfSpeech: "inf.", meaning: "用于动词不定式", stars: 2.5 }
  ],
  have: [
    { partOfSpeech: "v.", meaning: "有；拥有；经历", stars: 3 },
    { partOfSpeech: "aux.", meaning: "用于完成时", stars: 2.5 }
  ],
  that: [
    { partOfSpeech: "conj.", meaning: "引导从句：……；以至于", stars: 3 },
    { partOfSpeech: "pron.", meaning: "那；那个", stars: 2.5 },
    { partOfSpeech: "adj.", meaning: "那；那个", stars: 2 },
    { partOfSpeech: "adv.", meaning: "那么；那样", stars: 1.5 }
  ],
  for: [
    { partOfSpeech: "prep.", meaning: "为了；给；对于；因为", stars: 3 },
    { partOfSpeech: "conj.", meaning: "因为", stars: 2 }
  ],
  on: [
    { partOfSpeech: "prep.", meaning: "在……上；关于；在……时候", stars: 3 },
    { partOfSpeech: "adv.", meaning: "继续；向前", stars: 2 }
  ],
  as: [
    { partOfSpeech: "conj.", meaning: "当……时；因为；随着；正如", stars: 3 },
    { partOfSpeech: "prep.", meaning: "作为；像……一样", stars: 2.5 },
    { partOfSpeech: "adv.", meaning: "同样地；和……一样", stars: 2 }
  ],
  more: [
    { partOfSpeech: "adj.", meaning: "更多的；更大的", stars: 3 },
    { partOfSpeech: "adv.", meaning: "更；更加", stars: 2.5 },
    { partOfSpeech: "pron.", meaning: "更多的人或事物", stars: 2 }
  ],
  this: [
    { partOfSpeech: "pron.", meaning: "这；这个", stars: 3 },
    { partOfSpeech: "adj.", meaning: "这；这个；本", stars: 2.5 }
  ],
  one: [
    { partOfSpeech: "num.", meaning: "一；一个", stars: 3 },
    { partOfSpeech: "pron.", meaning: "一个人或事物", stars: 2.5 }
  ],
  well: [
    { partOfSpeech: "adv.", meaning: "好；很好地；充分地", stars: 3 },
    { partOfSpeech: "adj.", meaning: "健康的；良好的", stars: 2.5 },
    { partOfSpeech: "n.", meaning: "井；泉水", stars: 1.5 },
    { partOfSpeech: "v.", meaning: "涌出", stars: 1 }
  ],
  about: [
    { partOfSpeech: "prep.", meaning: "关于；在……周围", stars: 3 },
    { partOfSpeech: "adv.", meaning: "大约；到处", stars: 2.5 }
  ],
  time: [
    { partOfSpeech: "n.", meaning: "时间；次数；时代；时机", stars: 3 },
    { partOfSpeech: "v.", meaning: "安排时间；计时", stars: 1.5 }
  ],
  work: [
    { partOfSpeech: "v.", meaning: "工作；运转；产生效果", stars: 3 },
    { partOfSpeech: "n.", meaning: "工作；劳动；作品", stars: 2.5 }
  ],
  use: [
    { partOfSpeech: "v.", meaning: "使用；利用", stars: 3 },
    { partOfSpeech: "n.", meaning: "使用；用途；用法", stars: 2.5 }
  ],
  part: [
    { partOfSpeech: "n.", meaning: "部分；零件；角色", stars: 3 },
    { partOfSpeech: "v.", meaning: "分开；分离", stars: 2 }
  ],
  follow: [{ partOfSpeech: "v.", meaning: "跟随；遵循；接着发生", stars: 3 }],
  charge: [
    { partOfSpeech: "v.", meaning: "收费；指控；充电", stars: 3 },
    { partOfSpeech: "n.", meaning: "费用；负责；指控", stars: 2.5 }
  ]
}));

const coreSenseSupplements = new Map(Object.entries({
  question: [["v.", "询问；质疑"]],
  answer: [["v.", "回答；答复"]],
  mark: [["n.", "标记；记号；分数"]],
  base: [["v.", "以……为基础"]],
  change: [["n.", "变化；改变；零钱"]],
  good: [["adj.", "好的；优良的；有益的"]],
  end: [["v.", "结束；终止"]],
  human: [["adj.", "人类的；有人性的"]],
  look: [["v.", "看；看起来"]],
  research: [["v.", "研究；调查"]],
  increase: [["v.", "增加；增长"]],
  pay: [["n.", "工资；报酬"]],
  result: [["v.", "导致；结果为"]],
  report: [["v.", "报告；报道"]],
  public: [["adj.", "公共的；公众的"]],
  call: [["v.", "打电话；称呼；呼叫"]],
  another: [["adj.", "另一个；又一"]],
  general: [["adj.", "一般的；总的；普遍的"], ["n.", "将军"]],
  medical: [["adj.", "医疗的；医学的"]],
  lead: [["n.", "领导；领先；铅"]],
  cost: [["n.", "成本；费用；代价"]],
  offer: [["n.", "提议；报价"]],
  experience: [["v.", "经历；体验"]],
  test: [["v.", "测试；检验"]],
  future: [["adj.", "未来的；将来的"]],
  care: [["n.", "关心；照料；小心"]],
  minute: [["n.", "分钟；分；片刻"]],
  patient: [["adj.", "有耐心的；耐心的"]],
  current: [["adj.", "当前的；现行的"]],
  medium: [["adj.", "中等的；中等大小的"]],
  novel: [["adj.", "新颖的；新奇的"]],
  relative: [["n.", "亲戚；亲属"]],
  plan: [["v.", "计划；打算"]],
  sense: [["v.", "感觉到；意识到"]],
  control: [["v.", "控制；管理"]],
  rise: [["v.", "上升；升起"]],
  value: [["v.", "重视；给……估价"]],
  individual: [["adj.", "个人的；个别的"]],
  drive: [["n.", "驾驶；驱动力"]],
  interest: [["v.", "使感兴趣"]],
  support: [["v.", "支持；支撑"]],
  market: [["v.", "销售；推销"]],
  form: [["v.", "形成；组成"]],
  present: [["n.", "现在；礼物"], ["adj.", "现在的；出席的"]],
  record: [["v.", "记录；记载"]],
  demand: [["v.", "要求；需要"]],
  challenge: [["v.", "挑战；质疑"]],
  store: [["v.", "储存；保存"]],
  check: [["v.", "检查；核对"]],
  list: [["v.", "列出；列入清单"]],
  average: [["adj.", "平均的；普通的"]],
  break: [["n.", "休息；中断；破裂"]],
  note: [["v.", "注意；记录"]],
  graduate: [["v.", "毕业"], ["n.", "毕业生"]],
  interview: [["v.", "采访；面试"]],
  focus: [["n.", "焦点；重点"]],
  access: [["n.", "使用权"]],
  approach: [["n.", "方法"]],
  language: [["n.", "风格"]],
  cause: [["v.", "造成；引起"]],
  issue: [["n.", "期；期刊"]],
  order: [["n.", "订单"]],
  paper: [["n.", "试卷"]],
  poor: [["adj.", "糟糕的；质量差的"]],
  though: [["conj.", "尽管；虽然"]],
  customer: [["n.", "顾客"]],
  ever: [["adv.", "从来；曾经"]],
  matter: [["n.", "问题；事情"]],
  involve: [["v.", "涉及；包含"]],
  fail: [["v.", "破产；倒闭"]],
  item: [["n.", "物品；一件商品"]],
  project: [["n.", "项目"]],
  claim: [["v.", "索要；声称；宣称"]],
  decline: [["v.", "拒绝；谢绝；下降"]],
  please: [["v.", "使愉快；使满意"]],
  content: [["n.", "内容；含量；目录"]],
  gap: [["n.", "差距；分歧"]],
  figure: [["n.", "人物"]],
  fit: [["adj.", "健康的；合适的"]],
  alone: [["adv.", "仅仅；只有"]],
  couple: [["n.", "情侣；夫妻"]],
  realize: [["v.", "认识到；意识到"]],
  device: [["n.", "方法；手段"]],
  court: [["n.", "球场"]],
  engage: [["v.", "吸引；占用"]],
  manage: [["v.", "设法做到"]],
  aspect: [["n.", "样子；外观"]],
  specific: [["adj.", "具体的；详细而明确的"]],
  conduct: [["v.", "开展；进行"]],
  reveal: [["v.", "展现；揭示"]],
  prefer: [["v.", "偏爱；更喜欢"]],
  derive: [["v.", "取得；获得"]],
  intend: [["v.", "想要；打算"]],
  grant: [["v.", "同意；授予；准予"]],
  establish: [["v.", "查实；证实"]],
  union: [["n.", "一致；联合"]],
  manner: [["n.", "方式；方法"]],
  truth: [["n.", "真相；事实"]],
  bit: [["n.", "一点；少量"]],
  boost: [["v.", "往上推；增加；促进"]],
  communicate: [["v.", "交流；沟通"]],
  facility: [["n.", "天资；才能"]],
  generate: [["v.", "引起；产生"]],
  deliver: [["v.", "传输；递送"]],
  household: [["n.", "一户；家庭"]],
  context: [["n.", "环境；背景"]],
  illustrate: [["v.", "给……加插图"]],
  eliminate: [["v.", "淘汰；排除"]],
  cope: [["v.", "处理；应付"]],
  crowd: [["v.", "聚集；挤满"]],
  contingent: [["n.", "代表团；一队人"]],
  accord: [["n.", "协议；一致"]],
  gather: [["v.", "聚集；搜集"]],
  guide: [["v.", "指引；指导"]],
  lie: [["n.", "谎话；谎言"]],
  peer: [["v.", "凝视；仔细看"]],
  spot: [["v.", "发现；认出"]],
  touch: [["v.", "触摸；感动；接触"]]
}));

const preferredPartOfSpeech = new Map(Object.entries({
  good: "adj.",
  mark: "n.",
  look: "v.",
  public: "adj.",
  call: "v.",
  general: "adj.",
  medical: "adj.",
  minute: "n.",
  though: "conj.",
  patient: "adj.",
  current: "adj.",
  content: "n.",
  fit: "adj.",
  grant: "v.",
  gather: "v.",
  medium: "adj.",
  novel: "adj.",
  relative: "n.",
  household: "n.",
  accord: "n.",
  cause: "v.",
  claim: "v.",
  decline: "v.",
  guide: "v.",
  lie: "n.",
  peer: "v.",
  spot: "v.",
  touch: "v.",
  however: "adv.",
  graduate: "v.",
  release: "v.",
  boost: "v.",
  contingent: "n."
}));

const blockedPartOfSpeech = new Map(Object.entries({
  sheet: ["v."],
  company: ["v."],
  medical: ["n."],
  spot: ["adj."]
}));

const removedMeanings = new Map(Object.entries({
  passage: ["移居"],
  answer: ["回报", "答辩"],
  mark: ["马克"],
  sheet: ["印刷品"],
  choice: ["精选品"],
  increase: ["利益"],
  paragraph: ["短评"],
  important: ["大量的"],
  report: ["传说", "爆炸声"],
  health: ["蓬勃"],
  develop: ["洗印"],
  cause: ["目标"],
  technology: ["术语"],
  matter: ["重要", "原因"],
  issue: ["后果", "流出"],
  paper: ["证券"],
  present: ["瞄准"],
  general: ["一般", "大体", "常规"],
  specific: ["具体地", "特定地"]
}));

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

const partOfSpeechLabels = {
  n: "n.",
  pl: "n.",
  vt: "v.",
  vi: "v.",
  v: "v.",
  a: "adj.",
  s: "adj.",
  adj: "adj.",
  adv: "adv.",
  r: "adv.",
  prep: "prep.",
  pron: "pron.",
  num: "num.",
  conj: "conj.",
  interj: "interj.",
  int: "interj.",
  aux: "aux.",
  art: "art."
};
const partOfSpeechPattern = Object.keys(partOfSpeechLabels).join("|");

const corpusPartOfSpeechLabels = {
  n: "n.", v: "v.", a: "adj.", s: "adj.", d: "adv.", r: "adv.",
  p: "prep.", c: "conj.", u: "aux.", m: "num.", q: "num."
};

function parseCorpusPartOfSpeech(value) {
  const weights = new Map();
  String(value || "").split("/").forEach((entry) => {
    const match = entry.trim().match(/^([a-z]+):(\d+(?:\.\d+)?)$/i);
    if (!match) return;
    const label = corpusPartOfSpeechLabels[match[1].toLocaleLowerCase("en-US")];
    if (!label) return;
    weights.set(label, (weights.get(label) || 0) + Number(match[2]));
  });
  return weights;
}

function cleanMeaning(value) {
  if (/^\s*\[[^\]]+\]/.test(String(value || ""))) return "";
  return String(value || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\-—\s]+|[.\-—\s]+$/g, "")
    .trim();
}

function parseDictionarySenses(value) {
  const source = String(value || "").replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\r/g, "\n");
  const expression = new RegExp(`(?:^|\\n)(${partOfSpeechPattern})\\.\\s*([\\s\\S]*?)(?=\\n(?:${partOfSpeechPattern})\\.\\s*|\\n\\[[^\\]]+\\]|$)`, "g");
  const groups = new Map();
  for (const match of source.matchAll(expression)) {
    if (/^\s*\[[^\]]+\]/.test(match[2])) continue;
    const partOfSpeech = partOfSpeechLabels[match[1]];
    const meanings = match[2]
      .split(/[，,；;]/)
      .map(cleanMeaning)
      .filter((meaning) => meaning && meaning.length <= 32);
    if (!meanings.length) continue;
    if (!groups.has(partOfSpeech)) groups.set(partOfSpeech, []);
    const bucket = groups.get(partOfSpeech);
    meanings.forEach((meaning) => {
      if (!bucket.includes(meaning)) bucket.push(meaning);
    });
  }
  return [...groups].map(([partOfSpeech, meanings]) => ({ partOfSpeech, meanings }));
}

function extractPartsOfSpeech(value, word) {
  const source = String(value || "").replace(/\\r/g, "").replace(/\\n/g, "\n");
  const expression = new RegExp(`(?:^|\\n)(${partOfSpeechPattern})\\.`, "g");
  const labels = [...source.matchAll(expression)]
    .map((match) => partOfSpeechLabels[match[1]])
    .filter((label, index, all) => all.indexOf(label) === index);
  return labels.join(" / ") || partOfSpeechFallbacks[word.toLocaleLowerCase("en-US")] || "";
}

function splitCoreMeanings(value) {
  return String(value || "")
    .split(/[、，,；;]/)
    .map(cleanMeaning)
    .filter(Boolean);
}

function comparableMeaning(value) {
  return cleanMeaning(value)
    .replace(/[…\.·\-—_\s()（）“”‘’的地得着了]/g, "")
    .toLocaleLowerCase("zh-CN");
}

function meaningSimilarity(left, right) {
  const a = comparableMeaning(left);
  const b = comparableMeaning(right);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 100 + Math.min(a.length, b.length);
  const rightCharacters = new Set([...b]);
  const overlap = [...new Set([...a])].filter((character) => rightCharacters.has(character)).length;
  return (overlap / Math.max(1, Math.min(new Set(a).size, rightCharacters.size))) * 10;
}

function boundedMeaningSimilarity(left, right) {
  const score = meaningSimilarity(left, right);
  return score >= 100 ? 12 : score;
}

function chinesePartOfSpeechHint(meaning) {
  const value = String(meaning || "").trim();
  if (/的$/.test(value)) return "adj.";
  if (/地$/.test(value)) return "adv.";
  return "";
}

function buildRankedSenses(coreTranslation, dictionaryTranslation, fallbackPartOfSpeech, corpusPartOfSpeech, rank) {
  const coreMeanings = splitCoreMeanings(coreTranslation || normalizeTranslation(dictionaryTranslation));
  const dictionaryGroups = parseDictionarySenses(dictionaryTranslation);
  if (!dictionaryGroups.length) {
    return [{
      partOfSpeech: fallbackPartOfSpeech || "词义",
      meaning: coreMeanings.join("；") || "暂无释义",
      stars: 3
    }];
  }

  const usageWeights = parseCorpusPartOfSpeech(corpusPartOfSpeech);
  const selected = new Map();
  coreMeanings.forEach((meaning, index) => {
    const candidates = dictionaryGroups.flatMap((group, groupIndex) => group.meanings.map((candidate, candidateIndex) => {
      const semanticScore = boundedMeaningSimilarity(meaning, candidate);
      const usageScore = (usageWeights.get(group.partOfSpeech) || 0) * 0.12;
      const hint = chinesePartOfSpeechHint(meaning);
      const grammarScore = hint === group.partOfSpeech ? 4 : hint ? -2 : 0;
      return { group, groupIndex, candidate, candidateIndex, semanticScore, score: semanticScore + usageScore + grammarScore };
    })).sort((left, right) => right.score - left.score || right.semanticScore - left.semanticScore || left.groupIndex - right.groupIndex || left.candidateIndex - right.candidateIndex);
    const best = candidates[0];
    if (!best || best.semanticScore < 3.5) return;
    if (!selected.has(best.group.partOfSpeech)) {
      selected.set(best.group.partOfSpeech, { group: best.group, matchedMeanings: [], matchScore: 0, firstIndex: index });
    }
    const entry = selected.get(best.group.partOfSpeech);
    if (!entry.matchedMeanings.includes(best.candidate)) entry.matchedMeanings.push(best.candidate);
    entry.matchScore += best.score;
    entry.firstIndex = Math.min(entry.firstIndex, index);
  });

  if (!selected.size) {
    const fallback = [...dictionaryGroups].sort((left, right) => (usageWeights.get(right.partOfSpeech) || 0) - (usageWeights.get(left.partOfSpeech) || 0))[0];
    selected.set(fallback.partOfSpeech, { group: fallback, matchedMeanings: [], matchScore: usageWeights.get(fallback.partOfSpeech) || 0, firstIndex: 0 });
  }

  if (rank <= 1600) {
    dictionaryGroups.forEach((group) => {
      if (selected.has(group.partOfSpeech)) return;
      const semanticScore = Math.max(0, ...coreMeanings.flatMap((meaning) => group.meanings.map((candidate) => boundedMeaningSimilarity(meaning, candidate))));
      const usageScore = usageWeights.get(group.partOfSpeech) || 0;
      if (usageScore >= 18) {
        selected.set(group.partOfSpeech, { group, matchedMeanings: [], matchScore: semanticScore + usageScore * 0.12, firstIndex: coreMeanings.length });
      }
    });
  }

  const maxSenseCount = rank <= 1200 ? 4 : rank <= 2600 ? 3 : 2;
  const primaryMeaningCount = rank <= 1200 ? 4 : rank <= 2600 ? 3 : 2;
  const secondaryMeaningCount = rank <= 1200 ? 3 : rank <= 2600 ? 2 : 1;
  return [...selected.values()]
    .sort((left, right) => left.firstIndex - right.firstIndex
      || right.matchScore - left.matchScore
      || (usageWeights.get(right.group.partOfSpeech) || 0) - (usageWeights.get(left.group.partOfSpeech) || 0)
      || dictionaryGroups.indexOf(left.group) - dictionaryGroups.indexOf(right.group))
    .slice(0, maxSenseCount)
    .map((entry, index) => {
      const meanings = [...entry.matchedMeanings];
      const maxMeanings = index === 0 ? primaryMeaningCount : secondaryMeaningCount;
      for (const candidate of entry.group.meanings) {
        if (meanings.length >= maxMeanings) break;
        const repeatsExisting = meanings.some((meaning) => meaningSimilarity(meaning, candidate) >= 100);
        if (!repeatsExisting) meanings.push(candidate);
      }
      return {
        partOfSpeech: entry.group.partOfSpeech,
        meaning: meanings.join("；") || entry.group.meanings.slice(0, maxMeanings).join("；"),
        stars: Math.max(1, 3 - index * 0.5)
      };
    });
}

function curateSenses(word, sourceSenses, rank) {
  const blocked = new Set(blockedPartOfSpeech.get(word) || []);
  const senses = sourceSenses.filter((sense) => !blocked.has(sense.partOfSpeech)).map((sense) => ({ ...sense }));
  const supplements = coreSenseSupplements.get(word) || [];
  supplements.forEach(([partOfSpeech, meaning]) => {
    const existing = senses.find((sense) => sense.partOfSpeech === partOfSpeech);
    if (existing) {
      const meanings = [];
      [...meaning.split("；"), ...existing.meaning.split("；")].filter(Boolean).forEach((candidate) => {
        if (!meanings.some((current) => meaningSimilarity(current, candidate) >= 100)) meanings.push(candidate);
      });
      existing.meaning = meanings.slice(0, rank <= 1200 ? 5 : 4).join("；");
    } else {
      senses.push({ partOfSpeech, meaning, stars: 1 });
    }
  });
  const removed = new Set(removedMeanings.get(word) || []);
  for (let index = senses.length - 1; index >= 0; index -= 1) {
    const meanings = senses[index].meaning.split("；").filter((meaning) => meaning && !removed.has(meaning));
    if (!meanings.length) senses.splice(index, 1);
    else senses[index].meaning = meanings.join("；");
  }
  const preferred = preferredPartOfSpeech.get(word);
  if (preferred) senses.sort((left, right) => Number(right.partOfSpeech === preferred) - Number(left.partOfSpeech === preferred));
  return senses.slice(0, rank <= 1200 ? 4 : 3).map((sense, index) => ({
    ...sense,
    stars: Math.max(1, 3 - index * 0.5)
  }));
}

function dictionaryFrequencyRank(record) {
  const ranks = [record.bnc, record.frq]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  return ranks.length ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
}

function dictionaryBrief(record) {
  const groups = parseDictionarySenses(record.translation);
  const weights = parseCorpusPartOfSpeech(record.pos);
  return [...groups]
    .sort((left, right) => (weights.get(right.partOfSpeech) || 0) - (weights.get(left.partOfSpeech) || 0))
    .flatMap((group) => group.meanings.slice(0, 2))
    .slice(0, 3)
    .join("、");
}

if (!fs.existsSync(cetPath) || !fs.existsSync(ecdictPath)) {
  throw new Error("Missing source data. Download CETVocabulary and ECDICT into work/sources first.");
}

const source = JSON.parse(fs.readFileSync(cetPath, "utf8"));
const cetRows = source["四六级词汇词频排序表"];
const primaryBookFiles = fs.readdirSync(sourceDir).filter((file) => PRIMARY_BOOK_PATTERN.test(file)).sort();
if (primaryBookFiles.length !== 8) {
  throw new Error(`Expected 8 PEP primary-school word books in ${sourceDir}, found ${primaryBookFiles.length}`);
}

const primaryWords = new Set();
for (const file of primaryBookFiles) {
  const lines = fs.readFileSync(path.join(sourceDir, file), "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const word = String(JSON.parse(line).headWord || "").trim().toLocaleLowerCase("en-US");
    if (/^[a-z]+(?:-[a-z]+)?$/.test(word)) primaryWords.add(word);
  }
}
for (const word of elementaryGrammarWords) primaryWords.add(word);

const uniqueRows = [];
const sourceWords = new Set();
for (const row of cetRows) {
  const normalized = row["单词"].toLocaleLowerCase("en-US");
  if (sourceWords.has(normalized)) continue;
  sourceWords.add(normalized);
  uniqueRows.push(row);
}

const excludedPrimary = uniqueRows.filter((row) => !row["六级"] && primaryWords.has(row["单词"].toLocaleLowerCase("en-US")));
const cet4 = uniqueRows.filter((row) => !row["六级"] && !primaryWords.has(row["单词"].toLocaleLowerCase("en-US")));
const cet6Candidates = uniqueRows.filter((row) => row["六级"] && !primaryWords.has(row["单词"].toLocaleLowerCase("en-US")));
if (cet6Candidates.length >= ADVANCED_COURSE_WORD_COUNT) {
  throw new Error(`Advanced course target ${ADVANCED_COURSE_WORD_COUNT} must exceed the ${cet6Candidates.length} CET-6 words`);
}
const selectedRows = [...cet4, ...cet6Candidates];
const target = new Map(selectedRows.map((row) => [row["单词"].toLocaleLowerCase("en-US"), row]));
const supplements = new Map();
const postgradCandidates = new Map();

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
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  if (target.has(word)) supplements.set(word, record);
  const tags = new Set(String(record.tag || "").toLocaleLowerCase("en-US").split(/\s+/).filter(Boolean));
  if (
    tags.has("ky")
    && !sourceWords.has(word)
    && !primaryWords.has(word)
    && /^[a-z]+(?:-[a-z]+)?$/.test(word)
    && record.translation
    && parseDictionarySenses(record.translation).length
  ) postgradCandidates.set(word, record);
}

const postgradNeeded = ADVANCED_COURSE_WORD_COUNT - cet6Candidates.length;
const selectedPostgrad = [...postgradCandidates.values()]
  .sort((left, right) => dictionaryFrequencyRank(left) - dictionaryFrequencyRank(right)
    || Number(right.collins || 0) - Number(left.collins || 0)
    || left.word.localeCompare(right.word, "en"))
  .slice(0, postgradNeeded);
if (selectedPostgrad.length !== postgradNeeded) {
  throw new Error(`Expected ${postgradNeeded} postgraduate extension words, found ${selectedPostgrad.length}`);
}

const cet4CourseRanks = new Map(cet4.map((row, index) => [row["单词"].toLocaleLowerCase("en-US"), index + 1]));
const cet6CourseRanks = new Map(cet6Candidates.map((row, index) => [row["单词"].toLocaleLowerCase("en-US"), index + 1]));

const seen = new Set();
const output = selectedRows.filter((row) => {
  const normalized = row["单词"].toLocaleLowerCase("en-US");
  if (seen.has(normalized)) return false;
  seen.add(normalized);
  return true;
}).map((row) => {
  const normalized = row["单词"].toLocaleLowerCase("en-US");
  const extra = supplements.get(normalized) || {};
  const coreTranslation = String(row["释义"] || "").trim();
  const fallbackPartOfSpeech = extractPartsOfSpeech(extra.translation, row["单词"]);
  const generatedSenses = senseOverrides.get(normalized)
    || buildRankedSenses(coreTranslation, extra.translation, fallbackPartOfSpeech, extra.pos, row["序号"]);
  const senses = curateSenses(normalized, generatedSenses, row["序号"]);
  const phraseList = phraseIndex.get(normalized) || [];
  const primaryPhrase = phraseList[0];
  return {
    word: row["单词"],
    level: row["六级"] ? "CET6" : "CET4",
    isCET6Supplement: Boolean(row["六级"]),
    course: row["六级"] ? "cet6" : "cet4",
    courseRank: row["六级"] ? cet6CourseRanks.get(normalized) : cet4CourseRanks.get(normalized),
    phonetic: extra.phonetic || "",
    partOfSpeech: [...new Set(senses.map((sense) => sense.partOfSpeech))].join(" / "),
    translation: senses.map((sense) => sense.meaning).join("；"),
    senses,
    brief: coreTranslation,
    rank: row["序号"],
    frequency: row["词频"],
    category: row["分类"] || "",
    variant: row["其他拼写"] || "",
    ...(primaryPhrase ? { phrase: primaryPhrase.text, phraseMeaning: primaryPhrase.meaning, phrases: phraseList } : {})
  };
});

const maxSourceRank = Math.max(...uniqueRows.map((row) => Number(row["序号"]) || 0));
selectedPostgrad.forEach((extra, index) => {
  const normalized = extra.word.toLocaleLowerCase("en-US");
  const courseRank = cet6Candidates.length + index + 1;
  const coreTranslation = dictionaryBrief(extra);
  const fallbackPartOfSpeech = extractPartsOfSpeech(extra.translation, extra.word);
  const generatedSenses = buildRankedSenses(coreTranslation, extra.translation, fallbackPartOfSpeech, extra.pos, maxSourceRank + courseRank);
  const senses = curateSenses(normalized, generatedSenses, maxSourceRank + courseRank);
  const phraseList = phraseIndex.get(normalized) || [];
  const primaryPhrase = phraseList[0];
  output.push({
    word: extra.word,
    level: "POSTGRAD",
    isCET6Supplement: false,
    isPostgradExtension: true,
    course: "cet6",
    courseRank,
    phonetic: extra.phonetic || "",
    partOfSpeech: [...new Set(senses.map((sense) => sense.partOfSpeech))].join(" / "),
    translation: senses.map((sense) => sense.meaning).join("；"),
    senses,
    brief: coreTranslation,
    rank: maxSourceRank + courseRank,
    frequency: Math.max(0, 100_000 - dictionaryFrequencyRank(extra)),
    category: "考研扩展",
    variant: "",
    ...(primaryPhrase ? { phrase: primaryPhrase.text, phraseMeaning: primaryPhrase.meaning, phrases: phraseList } : {})
  });
});

fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(JSON.stringify({
  total: output.length,
  cet4: output.filter((item) => item.level === "CET4").length,
  cet6: output.filter((item) => item.level === "CET6").length,
  postgradExtension: output.filter((item) => item.level === "POSTGRAD").length,
  advancedCourse: output.filter((item) => item.course === "cet6").length,
  excludedPrimary: excludedPrimary.length,
  primarySourceWords: primaryWords.size,
  supplemented: supplements.size,
  phraseWords: output.filter((item) => item.phrase).length,
  phraseEntries: output.reduce((total, item) => total + (item.phrases?.length || 0), 0),
  senseEntries: output.reduce((total, item) => total + item.senses.length, 0),
  outputPath
}));
