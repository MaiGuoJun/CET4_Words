# 数据来源与许可

## CETVocabulary

- 来源：<https://github.com/exam-data/CETVocabulary>
- 用途：四、六级词汇范围、试卷词频顺序、简明释义和分类。
- 数据许可：Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International（CC BY-NC-SA 4.0）。
- 本项目先排除与人教版小学英语词表重合的词目及少量基础语法词，四级课程保留 3,454 词；高级课程收齐 1,249 个六级核心词。两套课程分开学习和统计。该派生数据仅用于非商业学习用途，继续以 CC BY-NC-SA 4.0 提供。

## 人教版小学英语词表索引

- 来源：<https://github.com/kajweb/dict>
- 用途：读取三至六年级上下册八份 PEP 词表中的 `headWord`，建立小学基础词排除集合。
- 本项目不复制该仓库中的释义、例句或音频，只用词目做集合比对。原仓库说明数据抓取自有道背单词；若未来公开商业化，应重新审核该来源的授权链。

## ECDICT

- 来源：<https://github.com/skywind3000/ECDICT>
- 用途：补充音标和中文释义。
- 中国考研英语扩展：从带 `ky`（考研）标签、且不与本项目四/六级课程及小学词表重复的词中按 BNC/FRQ 常用度选取 1,051 词；界面明确标为“考研扩展”，不计入六级大纲词。
- 仓库许可：MIT License。原仓库说明其数据由多个公开资料与社区贡献逐步整理而成；若未来公开商业化，应重新审核来源链。

## VOA Learning English

- 来源与使用说明：<https://learningenglish.voanews.com/p/6861.html>
- 内置材料：Close or Near?、Ever or Never?、Buy and Pay。
- 用途：内置音频与对应原文。
- VOA Learning English 说明其原创文本和 MP3 属于美国政府作品，可作为公有领域内容复用；第三方通讯社内容不在此范围。这里选用的三篇页面均明确署名为 VOA Learning English 作者原创。

## 在线单词真人发音

- 接口：<https://dictionaryapi.dev/>
- 数据来源：Free Dictionary API 返回的 Wiktionary / Wikimedia Commons 发音音频；应用也会直接查询 Wikimedia Commons 作为备用来源。
- 用途：在用户点击发音或进入听音选词时在线播放，不随本仓库重新分发。
- 各条录音的来源与许可由接口随音频返回；应用在成功播放后显示对应来源和许可名称。没有可用真人录音时，应用会退回设备系统声音。

## Azure Speech 自然语音与发音评测（可选）

- 服务：Microsoft Azure AI Speech
- 文档：<https://learn.microsoft.com/azure/ai-services/speech-service/>
- 用途：仅在没有真人录音时生成明确标注的自然语音；对用户主动提交的短录音进行逐音素发音评测。
- 许可与费用：遵循用户自己的 Azure 订阅条款和用量计费；本仓库不包含 Azure 密钥或 Azure 生成的音频文件。

## 智谱 GLM-TTS（可选）

- 服务：智谱开放平台 GLM-TTS。
- 用途：在用户已配置自己的 API Key 时，为缺少真人录音的单词生成明确标注的自然语音，并作为本地声学纠音的标准音。
- 许可与费用：遵循用户自己的智谱账户条款和额度；音频按需生成，不随仓库分发。

## 高频短语

`scripts/build-data.mjs` 中的高频搭配由本项目整理；排除小学基础词后，当前主背词库保留 130 条，可随应用代码按 MIT License 使用。

## 义项考频星级

义项星级是面向四级复习的学习权重，不是官方公布的分义项统计。生成规则以 CETVocabulary 的试卷词频和核心释义为主，用 ECDICT 拆分词性并补充常见义；生成时先按词典词性分组，再把核心中文义与同词性的候选义匹配，避免把名词中文义挂到动词标签。前 1,200 个高频词可保留更多常考义，常见歧义词另经人工校正并由回归检查保护。最高频义为 3 星，其后按 0.5 星递减，低相关词性不进入学习卡片。
