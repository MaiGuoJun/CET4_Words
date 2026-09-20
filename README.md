# 蘑菇酱四级

一款为 2026 年 12 月英语四级备考设计的本地优先 PWA。它把词汇基线筛查、每日新词、间隔复习、听音抽测、短篇精听和专注计时放进同一个学习闭环。

## 当前能力

- 每日 20–50 个新词，按剩余词量和考试天数给出建议；
- 首周快速筛查，重建已有词汇基础；
- “认识 / 模糊 / 不认识”分级与透明复习日程；
- 看词辨义、听音选词和短语填空；
- 4,023 个去重后的四级词条、音标与中文释义，以及 100 个高频搭配；
- 三篇可离线使用的 VOA Learning English 精听材料；
- 本地音频导入、原文显隐、变速和 A–B 循环；
- 15 + 15 分钟专注计时、考试倒计时和 7 天统计；
- JSON 学习记录备份与恢复；
- Android Chrome 和 Windows Chrome/Edge 可安装使用。

所有学习记录默认只保存在当前浏览器，不会上传。

## 本地运行

`dist` 是完整的静态站点目录。由于浏览器安全限制，请通过本地 HTTP 服务运行，而不要直接双击 HTML：

```powershell
cd dist
python -m http.server 4173
```

然后打开 `http://127.0.0.1:4173/`。

## 发布到 GitHub Pages

仓库已包含 GitHub Actions 工作流。把项目推送到 GitHub 的 `main` 分支后，在仓库 **Settings → Pages → Source** 中选择 **GitHub Actions**，工作流会发布 `dist` 目录。

## 数据来源

内容许可和署名见 [DATA-LICENSES.md](./DATA-LICENSES.md)。应用代码采用 MIT License；词汇数据仍受各自的数据许可约束。
