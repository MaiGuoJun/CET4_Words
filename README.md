# 蘑菇酱四级

一款为 2026 年 12 月英语四级备考设计的本地优先 PWA。它把词汇基线筛查、每日新词、间隔复习、听音抽测、短篇精听和专注计时放进同一个学习闭环。

## 当前能力

- 每日 20–50 个新词，按剩余词量和考试天数给出建议；
- 24 题分层词汇量小测试，保守跳过明显简单的四级词，错词自动进入学习队列；
- 首周快速筛查会保存累计进度，离开后回来继续当前的 500 词批次；
- “认识 / 模糊 / 不认识”分级与透明复习日程；
- 独立单词本展示全部 4,578 词，可搜索释义，并按已背过、未学习、认识、模糊、不认识及四/六级范围筛选；
- 看词辨义、带中文义项提示的听音选词和短语填空；
- 4,578 个去重后的主背词条：排除 569 个小学基础词与基础语法词后保留 3,454 个四级词，并按考试词频补充 1,124 个带标签的六级词；
- 约 1.1 万条按词性对齐的考频义项：高频词适当补充常考义，低频或容易误导的词性不展示；另含 130 条仍适用于主背词库的高频搭配；
- 三篇可离线使用的 VOA Learning English 精听材料；
- 本地音频导入、原文显隐、变速和 A–B 循环；
- 电脑使用智谱在线 AI + Ollama 本地备用，手机可从 GitHub Pages 直连智谱，支持情景对话、回复朗读、语法纠错、四级词汇提示和语音练习；
- 手机文字和语音对话均支持 GLM-ASR 云端语音输入；AI 回复可按需展开中文翻译，并优先使用 GLM-TTS，自然语音额度不可用或连接超时时自动切换到较慢的设备英语声音；
- 单词卡固定提供“听标准音 → 跟读纠音”，手机获取真人录音超时后自动改用设备英语声音，不会一直停在加载状态；
- AI 跟读在有标准语音时比较内容、发音相似度和节奏；GLM-TTS 没有额度时自动降级为内容准确度与语速连续性评分，不中断练习；
- 15 + 15 分钟专注计时、考试倒计时和 7 天统计；
- Cloudflare Workers + D1 跨设备自动同步，并保留 JSON 学习记录备份与恢复；
- Android Chrome 和 Windows Chrome/Edge 可安装使用。

学习记录和 AI 对话历史默认先保存在当前浏览器；配置 Cloudflare 同步后，会在手机和电脑间自动合并。配置智谱 API Key 后优先使用智谱，调用失败时自动切回本机 Ollama；没有配置 Key 时只使用 Ollama。

单词会优先播放在线词典提供的真人录音，并按设置选择美音或英音；没有对应录音、离线或播放失败时，自动改用设备系统声音。真人录音功能不需要 API Key，但使用时需要联网。

连接 Cloudflare 同步服务后，Pages 版会通过 Worker 代取真人录音，避免手机浏览器因跨域或音频站点连接失败而无法播放。没有真人录音时，已配置的智谱 GLM-TTS 会生成明确标注的自然语音，并可作为本地声学纠音的标准音；这条免费/现有额度路径不要求 Azure。Azure Speech 仍作为可选增强，配置后可返回逐音素准确度、流利度和完整度，密钥只保存在 Worker Secret 中。

当天的新词、抽测和精听全部完成后，“再复习一组”会生成最多 20 个单词的独立复习组，优先选择不会、模糊以及最久未复习的已学词；不会跳转到听力，也不会增加今日新词数量。

Azure Speech 接入需要在 `cloudflare` 目录配置：

```powershell
npx wrangler secret put AZURE_SPEECH_KEY
npx wrangler secret put AZURE_SPEECH_REGION
npx wrangler deploy
```

例如资源区域可能是 `eastasia` 或 `southeastasia`，必须以 Azure“密钥和终结点”页面显示的区域为准。Worker 的 `/health` 会返回 `azureSpeech: true` 表示配置成功。

## 本地运行

项目带有一个不依赖第三方软件包的本机服务。它会打开 `dist` 静态站点，把 AI 请求安全转发给智谱或本机 Ollama，并代为获取真人发音录音：

```powershell
node server.mjs
```

然后打开 `http://127.0.0.1:4174/`。

## 启用 AI 对话

如有智谱开放平台 API Key，在 `.env.local` 中添加：

```dotenv
ZHIPU_API_KEY=你的密钥
ZHIPU_MODEL=glm-5.3-flash
```

电脑端密钥只应保存在 `.env.local`，不要写入 `dist` 或提交到 Git。未配置智谱或智谱暂时不可用时，服务会自动使用下面的 Ollama 备用模型。

手机打开 GitHub Pages 后，可进入 **设置 → 手机 AI 直连**，把同一个智谱 API Key 保存到手机浏览器。它只存在该设备的浏览器存储中，不进入学习记录、Cloudflare 同步、JSON 备份或 GitHub；手机会直接连接智谱，因此电脑关机也能使用 AI。请只在自己的设备上保存密钥，设备丢失或转交他人前先移除。

同一设置区还可选择语音方式：`智谱云识别` 会录制最长 20 秒的单句；文字对话中只填入输入框，语音对话中点击“发送这句”后继续生成 AI 回答。`GLM-TTS` 的语音额度可能与通用文字 Token 分开，没有可用余额或语音资源包时会自动切换到免费的设备英语声音，不影响继续对话。

1. 安装 [Ollama for Windows](https://ollama.com/download/windows)；
2. 在 PowerShell 中运行 `ollama pull qwen3.5:2b` 下载模型；
3. 运行 `node server.mjs`，然后打开 `http://127.0.0.1:4174/`。

默认备用模型为 `qwen3.5:2b`，适合日常对话的速度与中英文纠错。如需更高质量，可在 `.env.local` 中添加 `OLLAMA_MODEL=qwen3.5:4b`。`.env.local` 已加入 `.gitignore`，不会被 Git 提交。AI 服务未启动时，其余学习功能仍可正常使用。

打开 **AI 对话 → 语音对话**，点击“开始语音练习”并允许麦克风即可。选择智谱云识别时，说完点击“发送这句”；选择浏览器识别时，说完停顿即可。AI 只展示真正需要修改的句子，表达正确时不再出现“无需修改”的纠错卡片。录音只用于当次识别，不会保存。

## 手机与电脑自动同步

应用采用互相独立的学习同步和 AI 连接：

- Cloudflare Workers + D1 保存学习记录。电脑关机后，手机仍能学习和同步；
- 手机 AI 可以在 GitHub Pages 上直接连接智谱，不依赖电脑或 Tailscale；
- Tailscale Serve 仅作为可选方案，在电脑开机时让手机使用电脑上的 Ollama AI 和真人发音代理。

Cloudflare 是唯一的同步数据源，不会与 Tailscale 产生两份互相覆盖的云端记录。每台设备仍会保留本地副本，离线修改会在恢复网络后自动合并。同步密码仅保存在各设备浏览器中，不写入代码、Git 仓库或 JSON 备份。

Cloudflare 部署文件位于 `cloudflare/`。首次部署步骤：

```powershell
cd cloudflare
npx wrangler login
npx wrangler d1 create mogu-cet4-sync
```

把命令返回的 `database_id` 填入 `cloudflare/wrangler.toml`，然后执行：

```powershell
npx wrangler d1 execute mogu-cet4-sync --remote --file schema.sql
npx wrangler secret put SYNC_SECRET
npx wrangler deploy
```

部署完成后，在应用设置页填写 Workers 地址和同一个同步密码。手机与电脑各连接一次即可。请使用至少 12 位且不与其他账号共用的密码。

Tailscale 安装后，在电脑登录自己的账号，并在手机登录同一账号。保持 `node server.mjs` 与 Ollama 运行，然后执行 `tailscale serve --bg 4174`。手机打开 Tailscale 提供的 `https://*.ts.net` 地址即可使用本地 AI；电脑休眠或关机时，Cloudflare 同步和其余学习功能不受影响。

## 发布到 GitHub Pages

仓库已包含 GitHub Pages 工作流，线上地址为 `https://maiguojun.github.io/CET4_Words/`。Pages 可在设置页保存设备专用的智谱 API Key，从手机直接使用 AI；若要使用电脑上的 Ollama，则仍需本机地址或 Tailscale 私人入口。

## 数据来源

内容许可和署名见 [DATA-LICENSES.md](./DATA-LICENSES.md)。应用代码采用 MIT License；词汇数据仍受各自的数据许可约束。

重新构建词库时，将 CETVocabulary 的 `cet_full_list.json`、ECDICT 的 `ecdict.csv`，以及八册 `PEPXiaoXue3_1.json` 至 `PEPXiaoXue6_2.json` 放入 `CET_SOURCE_DIR`，再运行 `node scripts/build-data.mjs`。
