# WUT Auto News Crawler

[![Version](https://img.shields.io/badge/version-1.1.0-blue)](whut-auto-news-crawler.user.js)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Tampermonkey / Violentmonkey userscript. Injects a control panel on WUT School of Automotive Engineering news pages. Concurrent full-site scanning, keyword search, on-demand content & image fetching, and multi-format export.

> 目标站点：[汽车工程学院 · 新闻速递](http://auto.whut.edu.cn/xwsc/)（`auto.whut.edu.cn/xwsc/`）

## 适配的站点结构（2026 新版模板）

| 环节 | 规则 |
|---|---|
| 列表页 | `index.shtml` + `index_1.shtml` … `index_49.shtml`（共 50 页，由页面内 `createPageHTML(...)` 自动识别） |
| 列表容器 | `div.document_list ul li`，每条为 `a[href][title]` + `em` 发布日期 |
| 文章页 | `./YYYYMM/tYYYYMMDD_ID.shtml`，标题在 `.document_main h1`，正文在 `div#content` |
| 配图 | 相对文章目录的 `./W020…jpg`，按文章地址解析 |

## Features

- **Full-site scan** — auto-paginate, collect all news titles, links, and publish dates
- **Auto page range** — reads `createPageHTML()` to know the real page count (currently 50) instead of probing blindly
- **Concurrent engine** — three speed presets (Gentle / Fast / Turbo), parallel fetching
- **Keyword search** — real-time filter, title search or full-content search
- **On-demand fetch** — select specific articles, batch download body text and images
- **Multi-format export** — ZIP (with images), TXT, JSON, Markdown
- **Persistent state** — scan progress, search query, visited marks survive page refresh
- **Visited tracking** — clicked titles turn dim; resets on browser restart

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Open [whut-auto-news-crawler.user.js](whut-auto-news-crawler.user.js)
3. Click **Raw** → extension auto-prompts install → confirm
4. Visit `http://auto.whut.edu.cn/xwsc/` → panel appears

## Usage

```
Open list page → pick speed → scan all → search keyword → select → fetch → export ZIP
```

### Speed presets

| Preset | Scan conc. | Fetch conc. | Image conc. | Notes |
|--------|-----------|-------------|-------------|-------|
| 🐢 Gentle | 3 | 2 | 2 | Safest, mimics human |
| 🚀 Fast | 6 | 4 | 4 | Daily driver |
| ⚡ Turbo | 12 | 8 | 8 | Max throughput |

## Dev

```bash
git clone https://github.com/fieldlu/whut-auto-news-crawler.git
```

Single-file userscript — edit and reload the extension to debug.

## Mirrors

- GitHub: https://github.com/fieldlu/whut-auto-news-crawler
- Gitee: https://gitee.com/fieldlu/whut-auto-news-crawler

## License

MIT

## Changelog

- **1.1.0** — 适配 2026 新版站点（`.shtml` 分页 / `div.document_list` 列表 / `div#content` 正文）；列表解析收敛到 `.document_list` 范围；自动识别总页数；修正配图相对路径解析
- **1.0.0** — 初版：全站扫描、关键词检索、按需抓取正文与配图、ZIP/TXT/JSON/MD 导出
