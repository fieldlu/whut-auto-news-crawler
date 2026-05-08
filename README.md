# 武汉理工汽院新闻爬取助手

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](whut-auto-news-crawler.user.js)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Tampermonkey / Violentmonkey 油猴脚本。在武汉理工大学汽车学院新闻页面注入控制面板，全站并发扫描新闻列表、关键词搜索、按需抓取正文与图片、多格式导出。

> 适用于 `auto.whut.edu.cn/xwsc/` 新闻视窗

## 功能

- **全站扫描** — 自动翻页收集所有新闻标题、链接、发布时间
- **并发引擎** — 三档速度可调（温和 / 快速 / 极速），并发抓取
- **关键词搜索** — 实时过滤，支持标题搜索 / 内容搜索
- **按需抓取** — 选中感兴趣的新闻，批量下载正文和图片
- **多格式导出** — ZIP（含图片）、TXT、JSON、Markdown
- **状态持久化** — 扫描进度、搜索词、已访标记跨刷新保留
- **已访色差** — 点击过的标题变灰，浏览器重启后重置

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 打开 [whut-auto-news-crawler.user.js](whut-auto-news-crawler.user.js)
3. 点击 **Raw** → 扩展自动弹出安装页面 → 确认安装
4. 访问 `http://auto.whut.edu.cn/xwsc/` → 面板自动出现

## 使用

```
打开列表页 → 选择速度 → 全站扫描 → 搜索关键词 → 勾选新闻 → 抓取选中 → 导出 ZIP
```

### 速度档位

| 档位 | 扫描并发 | 抓取并发 | 图片并发 | 说明 |
|------|---------|---------|---------|------|
| 🐢 温和 | 3 | 2 | 2 | 模拟人类，最安全 |
| 🚀 快速 | 6 | 4 | 4 | 推荐日常使用 |
| ⚡ 极速 | 12 | 8 | 8 | 批量爬取最快 |

## 开发

```bash
# 克隆仓库
git clone https://github.com/fieldlu/whut-auto-news-crawler.git
```

脚本为单文件 [whut-auto-news-crawler.user.js](whut-auto-news-crawler.user.js)，直接编辑后刷新扩展即可调试。

## 镜像

- GitHub: https://github.com/fieldlu/whut-auto-news-crawler
- Gitee: https://gitee.com/fieldlu/whut-auto-news-crawler

## License

MIT
