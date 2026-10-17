# 站点覆盖与探测记录

> 数据采集时间：2026-10-17。学校二级站点会调整，此表仅作参考；脚本本身是**运行时自适应**的，不依赖这张表。

## 探测范围

从学校主站 [学院设置](http://www.whut.edu.cn/xuexiaogaikuang/xysz/) 汇总出 **52 个二级站点**，逐个抓首页、枚举栏目、校验文章链接同构性（同一前缀占比 ≥60%、条目 ≥5），再实测翻页方式。

结果：**33 个站点**能识别出真正的列表栏目，共 78 个候选栏目；其中大量是首页轮播里的"假链接"，严格校验后有效栏目如下。

## 已验证栏目

| 站点 | 栏目 | 分页 | 列表 | 正文 |
|---|---|---|---|---|
| auto.whut.edu.cn | `/xwsc/` | `createPageHTML(50)` → `index_N.shtml` | `.document_list` | `#content` |
| smee.whut.edu.cn | `/xydt/` | `createPageHTML(37)` → `index_N.shtml` | `.news_list` | `.article-box` |
| smee.whut.edu.cn | `/tzgg/xygg/` | `createPageHTML(4)` → `index_N.shtml` | `.news_list` | `.article-box` |
| stle.whut.edu.cn | `/bks/` | `createPageHTML(5)` → `index_N.shtml` | `ul.list` | `.article-box` |
| sneee.whut.edu.cn | `/rdjj/` | `createPageHTML` → `index_N.shtml` | `ul.list` | `.content` |

## 遇到的三类站点差异

1. **分页参数不同**：多数是 `index_N.shtml`，个别站点后缀是 `.html`；脚本读取 `createPageHTML(总数, 当前, 名称, 后缀)` 后按真实后缀拼地址。
2. **JS 跳转壳页**：部分栏目本身是个空壳，内容在 `<script>window.location="./xygg/"</script>` 指向的下一级。脚本在扫描前会跟随一次跳转并更新栏目根。
3. **列表容器命名不一致**：`.document_list` / `.news_list` / `ul.list` 都有。脚本先试已知 class，再按"直接子元素里文章链接最多的容器"自动挑选。

## 已知不可用（截至采集时间）

- `maths.whut.edu.cn/tzgg/`、`sfl.whut.edu.cn/tzgg/` 跳转到 `/tzgg/xygg/`，但目标 404，属站点自身问题
- `jwc.whut.edu.cn/xyxw/`、`fost.whut.edu.cn/tzgg/` 返回 404
- `zs.whut.edu.cn/zyjs/` 是内容页而非列表页，无分页

## 如何补充新栏目

打开目标栏目页 → 面板出现即说明识别成功；若显示"未识别"，把该栏目 URL 附在 Issue 里，通常只需补一个列表容器 class 或分页后缀。
