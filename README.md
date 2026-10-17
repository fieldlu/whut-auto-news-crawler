# WUT 全站新闻抓取助手

[![Version](https://img.shields.io/badge/version-2.1.0-blue)](whut-auto-news-crawler.user.js)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Tampermonkey / Violentmonkey 用户脚本。在**武汉理工大学任意栏目页**（`*.whut.edu.cn`）注入控制面板，自动识别栏目与分页，整栏并发抓取标题、日期、正文与配图，支持关键词检索与多格式导出。

> 目标站点：**武汉理工大学全站**（`*.whut.edu.cn`）
>
> 已对全校 **52 个二级站点**做过结构探测，识别出 33 个站点、78 个栏目；严格校验后的可用清单见 [docs/site-coverage.md](docs/site-coverage.md)。

## 适配的站点结构（2026 新版模板）

脚本不写死站点，而是从**当前地址反推栏目**，因此同一套代码适配所有同构栏目：

| 环节 | 规则 |
|---|---|
| 栏目推断 | 当前路径去掉 `index(_N).shtml` 与 `/YYYYMM/文章名`，得到栏目根，如 `/xydt/`、`/tzgg/xygg/` |
| 列表页 | `<栏目根>index.shtml` + `index_1.shtml` … 一直递增，直到 404 或空列表（后缀跟随当前页，`.html` 站点同样适用） |
| 列表容器 | 依次尝试 `.document_list` / `.news_list` / `.list_news` / `.article-list`，都没有则全页扫描 |
| 文章判定 | TRS 命名 `tYYYYMMDD_ID.shtml`，或任何非首页的 `.shtml` / `.html` 链接 |
| 正文容器 | `div#content`（auto 模板）/ `div.article-box`（smee 模板）/ 其它常见容器，最后回退到"段落最多的 div" |
| 配图 | 相对文章目录的路径，按文章 URL 解析 |

## Features

- **Full-site scan** — auto-paginate, collect all news titles, links, and publish dates
- **Scan to the last page** — keeps paginating until 404 / empty page; `createPageHTML()` is only a progress hint, never a hard stop
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
4. 打开任意栏目页（如 `http://smee.whut.edu.cn/xydt/`）→ 面板出现并自动开始扫描

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

## License

MIT

## Changelog

- **2.1.0** — 运行时自适应：扫描前先探测分页方式（`createPageHTML` 参数 / 实测 `index_N` 后缀）、跟随栏目 JS 跳转壳页、按"子元素文章链接最多"自动挑选列表容器；正文容器补充 `.TRS_Editor`、`#vsb_content`；新增 [站点覆盖记录](docs/site-coverage.md)

- **2.0.0** — 通用化：`@match` 扩到 `*://*.whut.edu.cn/*`，从当前地址反推栏目、自动识别分页后缀；列表/正文选择器同时兼容 `.document_list` 与 `.news_list` 两套模板；只在栏目页自动开扫，文章页提供「+ 添加当前页」

- **1.2.0** — 改为「一直抓到最后一页」：站点声明的页数只作进度参考，不再截断扫描；安全上限由 60 提升到 999（面板可改）

- **1.1.0** — 适配 2026 新版站点（`.shtml` 分页 / `div.document_list` 列表 / `div#content` 正文）；列表解析收敛到 `.document_list` 范围；自动识别总页数；修正配图相对路径解析
- **1.0.0** — 初版：全站扫描、关键词检索、按需抓取正文与配图、ZIP/TXT/JSON/MD 导出
