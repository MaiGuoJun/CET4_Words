# 数据来源与许可

## CETVocabulary

- 来源：<https://github.com/exam-data/CETVocabulary>
- 用途：四级词汇范围、试卷词频顺序、简明释义和分类。
- 数据许可：Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International（CC BY-NC-SA 4.0）。
- 本项目筛除源数据中标记为六级的词条，并转换为浏览器使用的 JSON。该派生数据仅用于非商业学习用途，继续以 CC BY-NC-SA 4.0 提供。

## ECDICT

- 来源：<https://github.com/skywind3000/ECDICT>
- 用途：补充音标和中文释义。
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

## 高频短语

`scripts/build-data.mjs` 中的 100 条高频搭配由本项目整理，可随应用代码按 MIT License 使用。
