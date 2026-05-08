# WUT Auto News Crawler

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](whut-auto-news-crawler.user.js)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Tampermonkey / Violentmonkey userscript. Injects a control panel on WUT School of Automotive Engineering news pages. Concurrent full-site scanning, keyword search, on-demand content & image fetching, and multi-format export.

> Works on `auto.whut.edu.cn/xwsc/`

## Features

- **Full-site scan** — auto-paginate, collect all news titles, links, and publish dates
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
