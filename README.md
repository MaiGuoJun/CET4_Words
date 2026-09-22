# 蘑菇酱四级

一款为 2026 年 12 月英语四级备考设计的本地优先 PWA。它把词汇基线筛查、每日新词、间隔复习、听音抽测、短篇精听和专注计时放进同一个学习闭环。

## 当前能力

- 每日 20–50 个新词，按剩余词量和考试天数给出建议；
- 首周快速筛查，重建已有词汇基础；
- “认识 / 模糊 / 不认识”分级与透明复习日程；
- 看词辨义、真人发音听音选词和短语填空；
- 4,578 个去重后的主背词条：排除 569 个小学基础词与基础语法词后保留 3,454 个四级词，并按考试词频补充 1,124 个带标签的六级词；
- 分词性考频星级释义，以及 130 条仍适用于主背词库的高频搭配；
- 三篇可离线使用的 VOA Learning English 精听材料；
- 本地音频导入、原文显隐、变速和 A–B 循环；
- Ollama 本地 AI 文字情景对话、回复可选朗读、重点语法纠错、四级词汇提示和免费语音练习；
- 15 + 15 分钟专注计时、考试倒计时和 7 天统计；
- JSON 学习记录备份与恢复；
- Android Chrome 和 Windows Chrome/Edge 可安装使用。

学习记录和 AI 对话历史默认只保存在当前浏览器。AI 回复由本机 Ollama 模型生成，不需要 OpenAI API Key，也不会产生 API 调用费用。

单词会优先播放在线词典提供的真人录音，并按设置选择美音或英音；没有对应录音、离线或播放失败时，自动改用设备系统声音。真人录音功能不需要 API Key，但使用时需要联网。

## 本地运行

项目带有一个不依赖第三方软件包的本机服务。它会打开 `dist` 静态站点，把 AI 请求转发给本机 Ollama，并代为获取真人发音录音：

```powershell
node server.mjs
```

然后打开 `http://127.0.0.1:4174/`。

## 启用本地 AI 对话

1. 安装 [Ollama for Windows](https://ollama.com/download/windows)；
2. 在 PowerShell 中运行 `ollama pull qwen3.5:2b` 下载模型；
3. 运行 `node server.mjs`，然后打开 `http://127.0.0.1:4174/`。

默认模型为 `qwen3.5:2b`，适合日常对话的速度与中英文纠错。如需更高质量，可在 `.env.local` 中添加 `OLLAMA_MODEL=qwen3.5:9b`。`.env.local` 已加入 `.gitignore`，不会被 Git 提交。Ollama 未启动时，其余学习功能仍可正常使用。

打开 **AI 对话 → 本地语音**，点击“开始语音练习”并允许麦克风即可。AI 回复由本机模型生成并由系统声音朗读；语音识别使用 Chrome/Edge 提供的浏览器能力，部分浏览器可能联网完成识别，但应用不会保存录音。

## 发布到 GitHub Pages

仓库已包含手动运行的 GitHub Pages 工作流。目前线上站点保持关闭；准备公开后，可在 GitHub Actions 中手动运行部署流程。本地 AI 需要访问使用者电脑上的 Ollama，因此静态 GitHub Pages 不能直接提供该功能。

## 数据来源

内容许可和署名见 [DATA-LICENSES.md](./DATA-LICENSES.md)。应用代码采用 MIT License；词汇数据仍受各自的数据许可约束。

重新构建词库时，将 CETVocabulary 的 `cet_full_list.json`、ECDICT 的 `ecdict.csv`，以及八册 `PEPXiaoXue3_1.json` 至 `PEPXiaoXue6_2.json` 放入 `CET_SOURCE_DIR`，再运行 `node scripts/build-data.mjs`。
