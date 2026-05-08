// ==UserScript==
// @name         WUT Auto News Crawler
// @namespace    https://github.com/fieldlu/whut-auto-news-crawler
// @version      1.0.0
// @description  Concurrent full-site news scanner with keyword search, on-demand content & image fetching, and multi-format export. Three speed presets.
// @author       FieldLu
// @match        http://auto.whut.edu.cn/*
// @match        https://auto.whut.edu.cn/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 常量 ====================
    const BASE_URL = 'http://auto.whut.edu.cn/xwsc/index';
    const BASE_DOMAIN = 'http://auto.whut.edu.cn/xwsc/';
    const BASE_SITE = 'http://auto.whut.edu.cn';
    const DEFAULT_MAX_PAGES = 60;
    const RETRY_MAX = 3;

    // 速度配置: [scan并发, detail并发, img并发, 延迟倍数(0~1)]
    const SPEED = [
        { name: '🐢 温和', sc: 3, dc: 2, ic: 2, dm: 1 },
        { name: '🚀 快速', sc: 6, dc: 4, ic: 4, dm: 0.25 },
        { name: '⚡ 极速', sc: 12, dc: 8, ic: 8, dm: 0 },
    ];

    // ==================== 状态 ====================
    const S = {
        status: 'idle',
        phase: '',
        curPage: 0,
        maxPages: DEFAULT_MAX_PAGES,
        totalScanned: 0,
        scanPagesDone: 0,
        detailDone: 0,
        detailFail: 0,
        shouldStop: false,
        abortCtrl: null,
        speed: GM_getValue('speed', 1),     // 0|1|2
        autoScan: GM_getValue('autoScan', true),
        allNews: [],
        filteredIdx: [],
        searchMode: 'title',
        sortBy: 'page',
        sortAsc: true,
        selected: new Set(),
        expanded: new Set(),
        detailTargets: [],
        visited: new Set(JSON.parse(unsafeWindow.sessionStorage.getItem('wnc_visited') || '[]')),
        nextId: 1,
        donePages: GM_getValue('donePages', []), // 已扫描完成的页码列表（防并发漏页）
    };

    function spd() { return SPEED[S.speed]; }

    // ==================== CSS (略，同 v2) ====================
    GM_addStyle(`
#wnc-panel{position:fixed;top:60px;left:calc(100% - 480px);width:460px;height:580px;background:#1e1e2e;color:#cdd6f4;border-radius:12px;box-shadow:0 8px 48px rgba(0,0,0,.55);z-index:99999;font-family:'Microsoft YaHei','PingFang SC',sans-serif;font-size:13px;display:flex;flex-direction:column;overflow:hidden;resize:both;min-width:380px;min-height:420px;}
#wnc-panel.mini{height:38px!important;min-height:38px!important;resize:none;}
#wnc-hdr{height:38px;background:#313244;border-radius:12px 12px 0 0;cursor:move;display:flex;align-items:center;padding:0 10px;flex-shrink:0;gap:8px;}
#wnc-hdr .t{flex:1;font-weight:700;font-size:14px;color:#f5c2e7;overflow:hidden;white-space:nowrap;}
#wnc-hdr button{width:28px;height:28px;border:none;background:transparent;color:#a6adc8;cursor:pointer;border-radius:6px;font-size:18px;line-height:28px;text-align:center;padding:0;flex-shrink:0;}
#wnc-hdr button:hover{background:#45475a;color:#cdd6f4;}
#wnc-hdr .btn-x:hover{background:#f38ba8;color:#1e1e2e;}
#wnc-tabs{display:flex;background:#313244;padding:0 8px;gap:1px;flex-shrink:0;}
#wnc-tabs .tb{padding:7px 18px;color:#6c7086;cursor:pointer;border-radius:8px 8px 0 0;font-size:12px;font-weight:500;transition:background .15s,color .15s;}
#wnc-tabs .tb:hover{color:#cdd6f4;}
#wnc-tabs .tb.on{background:#1e1e2e;color:#f5c2e7;}
#wnc-tabs .tb .badge{display:inline-block;background:#cba6f7;color:#1e1e2e;border-radius:8px;padding:0 6px;font-size:10px;margin-left:4px;min-width:16px;text-align:center;}
#wnc-body{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;}
#wnc-body::-webkit-scrollbar{width:5px;}
#wnc-body::-webkit-scrollbar-thumb{background:#45475a;border-radius:3px;}
.wnc-tab-c{display:none;flex-direction:column;gap:8px;flex:1;}
.wnc-tab-c.on{display:flex;}
.wnc-row{display:flex;gap:8px;align-items:center;}
.wnc-row label{font-size:12px;color:#a6adc8;white-space:nowrap;}
.wnc-row input,.wnc-row select{flex:1;padding:5px 8px;background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:6px;font-size:12px;outline:none;min-width:0;}
.wnc-row input:focus,.wnc-row select:focus{border-color:#cba6f7;}
.wnc-row select{cursor:pointer;}
.wnc-btn{padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;transition:background .15s,opacity .15s;white-space:nowrap;}
.wnc-btn:disabled{opacity:.4;cursor:not-allowed;}
.wnc-btn-pri{background:#cba6f7;color:#1e1e2e;}
.wnc-btn-pri:hover:not(:disabled){background:#b4befe;}
.wnc-btn-dan{background:#f38ba8;color:#1e1e2e;}
.wnc-btn-dan:hover:not(:disabled){background:#eba0ac;}
.wnc-btn-warn{background:#fab387;color:#1e1e2e;}
.wnc-btn-warn:hover:not(:disabled){background:#f9e2af;}
.wnc-btn-ok{background:#a6e3a1;color:#1e1e2e;}
.wnc-btn-ok:hover:not(:disabled){background:#94e2d5;}
.wnc-btn-ghost{background:transparent;color:#a6adc8;border:1px solid #45475a;}
.wnc-btn-ghost:hover:not(:disabled){background:#313244;color:#cdd6f4;}
.wnc-btn-xs{padding:2px 8px;font-size:11px;}
.wnc-prog-wrap{background:#313244;border-radius:6px;height:22px;overflow:hidden;}
.wnc-prog-fill{height:100%;width:0%;background:linear-gradient(90deg,#cba6f7,#f5c2e7);border-radius:6px;transition:width .3s;display:flex;align-items:center;justify-content:center;font-size:11px;color:#1e1e2e;font-weight:700;}
.wnc-stats{display:flex;gap:14px;font-size:12px;color:#a6adc8;flex-wrap:wrap;}
.wnc-stats .v{color:#f5c2e7;font-weight:700;}
#wnc-log{background:#11111b;border-radius:8px;height:120px;overflow-y:auto;padding:8px;font-size:11px;font-family:'Cascadia Code','Fira Code',Consolas,monospace;line-height:1.5;flex-shrink:0;}
#wnc-log::-webkit-scrollbar{width:4px;}
#wnc-log::-webkit-scrollbar-thumb{background:#45475a;border-radius:2px;}
.li{color:#a6adc8;}.lok{color:#a6e3a1;}.lw{color:#fab387;}.le{color:#f38ba8;}.lf{color:#f5c2e7;font-weight:700;}
.wnc-res-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.wnc-res-top input{flex:1;min-width:120px;}
.wnc-res-info{font-size:11px;color:#6c7086;}
#wnc-res-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;}
#wnc-res-list::-webkit-scrollbar{width:4px;}
#wnc-res-list::-webkit-scrollbar-thumb{background:#45475a;border-radius:2px;}
.wnc-empty{color:#6c7086;font-size:12px;padding:30px;text-align:center;}
.wnc-item{background:#313244;border-radius:8px;padding:7px 10px;font-size:12px;transition:background .15s;display:flex;gap:8px;align-items:flex-start;}
.wnc-item:hover{background:#45475a;}
.wnc-item.sel{outline:1px solid #cba6f7;}
.wnc-item .cb{flex-shrink:0;margin-top:2px;accent-color:#cba6f7;cursor:pointer;}
.wnc-item .ib{flex:1;min-width:0;}
.wnc-item .it{color:#cdd6f4;font-weight:500;word-break:break-all;}.wnc-item .it a:hover{color:#cba6f7!important;text-decoration:underline!important;}.wnc-item .it a:visited,.wnc-item.visited .it a{color:#6c7086!important;}
.wnc-item .im{color:#6c7086;font-size:11px;margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;}
.wnc-item .tag{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:500;}
.tag-ok{background:#a6e3a1;color:#1e1e2e;}.tag-pend{background:#fab387;color:#1e1e2e;}.tag-fail{background:#f38ba8;color:#1e1e2e;}
.wnc-item .id{display:none;padding:6px 0 0 0;border-top:1px solid #45475a;margin-top:6px;}
.wnc-item.exp .id{display:block;}
.wnc-item .ic{max-height:180px;overflow-y:auto;background:#1e1e2e;padding:8px;border-radius:6px;color:#bac2de;line-height:1.6;white-space:pre-wrap;font-size:12px;}
.wnc-item .ii{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}
.wnc-item .ii img{max-width:110px;max-height:80px;border-radius:4px;object-fit:cover;border:2px solid #45475a;cursor:pointer;}
.wnc-item .ii img:hover{border-color:#cba6f7;}
.wnc-item .ic::-webkit-scrollbar{width:3px;}
.wnc-item .ic::-webkit-scrollbar-thumb{background:#45475a;border-radius:2px;}
#wnc-img-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.88);z-index:999999;display:flex;align-items:center;justify-content:center;cursor:pointer;}
#wnc-img-modal img{max-width:92vw;max-height:92vh;border-radius:8px;}
.wnc-tgl{position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0;}
.wnc-tgl input{opacity:0;width:0;height:0;}
.wnc-tgl .sl{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#45475a;border-radius:22px;transition:.2s;}
.wnc-tgl .sl:before{content:"";position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#cdd6f4;border-radius:50%;transition:.2s;}
.wnc-tgl input:checked+.sl{background:#cba6f7;}
.wnc-tgl input:checked+.sl:before{transform:translateX(18px);background:#1e1e2e;}
.wnc-speed-row{display:flex;gap:4px;}
.wnc-speed-row button{padding:4px 10px;font-size:11px;border:1px solid #45475a;border-radius:6px;background:transparent;color:#6c7086;cursor:pointer;transition:all .15s;}
.wnc-speed-row button.on{border-color:#cba6f7;color:#f5c2e7;background:#313244;}
.wnc-speed-row button:hover{color:#cdd6f4;}
`);

    // ==================== 工具 ====================
    const $ = (s, c) => (c || document).querySelector(s);
    const $$ = (s, c) => [...(c || document).querySelectorAll(s)];
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function escHTML(s) {
        if (!s) return '';
        const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
    }
    function safeName(s) {
        return (s || 'untitled').replace(/[\\/*?:"<>|]/g, '').trim().slice(0, 50);
    }
    function fmtTime() { return new Date().toLocaleTimeString('zh-CN', { hour12: false }); }
    function resolveUrl(link, base) {
        try {
            if (link.startsWith('./')) return new URL(link.slice(2), base || BASE_DOMAIN).href;
            if (link.startsWith('../')) return new URL(link.slice(3), base || BASE_DOMAIN).href;
            if (link.startsWith('http')) return link;
            if (link.startsWith('/')) return BASE_SITE + link;
            return new URL(link, base || BASE_DOMAIN).href;
        } catch { return link; }
    }

    // ==================== 并发工具 ====================
    // 对数组执行并发处理（有上限）
    async function pooledMap(items, concurrency, fn) {
        const results = new Array(items.length);
        let idx = 0;
        async function worker() {
            while (idx < items.length && !S.shouldStop) {
                const i = idx++;
                try { results[i] = await fn(items[i], i); } catch (e) { results[i] = e; }
            }
        }
        const ws = [];
        for (let i = 0; i < Math.min(concurrency, items.length); i++) ws.push(worker());
        await Promise.all(ws);
        return results;
    }

    // ==================== Storage ====================
    function sk(k) { return 'wnc_' + k; }
    function saveNews() {
        const slim = S.allNews.map(n => ({
            id: n.id, title: n.title, link: n.link, page: n.page,
            foundAt: n.foundAt, fetched: n.fetched, content: n.content,
            dateText: n.dateText,
            images: (n.images || []).map(im => ({ url: im.url, filename: im.filename })),
        }));
        GM_setValue(sk('news'), JSON.stringify(slim));
        GM_setValue(sk('nextId'), S.nextId);
    }
    function loadNews() {
        const raw = GM_getValue(sk('news'), null);
        if (!raw) return [];
        return JSON.parse(raw).map(n => ({
            ...n, images: (n.images || []).map(im => ({ ...im, blob: null })),
        }));
    }
    function saveState() { GM_setValue(sk('speed'), S.speed); GM_setValue(sk('autoScan'), S.autoScan); GM_setValue(sk('sortBy'), S.sortBy); GM_setValue(sk('sortAsc'), S.sortAsc); GM_setValue(sk('searchQuery'), $('#wnc-search')?.value || ''); GM_setValue(sk('searchMode'), S.searchMode); GM_setValue(sk('activeTab'), $$('#wnc-tabs .tb.on')[0]?.dataset?.tab || 'scan'); }

    // ==================== Log ====================
    function log(msg, cls) {
        const el = $('#wnc-log');
        if (!el) return;
        const d = document.createElement('div');
        d.className = cls || 'li';
        d.textContent = `[${fmtTime()}] ${msg}`;
        el.appendChild(d);
        el.scrollTop = el.scrollHeight;
    }

    // ==================== 网络 ====================
    async function fetchRetry(url, retries = RETRY_MAX, signal = null) {
        for (let i = 0; i < retries; i++) {
            if (signal?.aborted || S.shouldStop) return null;
            try {
                if (i > 0) await sleep(Math.min(Math.pow(2, i) * 800, 6000) + Math.random() * 800);
                return await fetch(url, { signal: signal || AbortSignal.timeout(25000) });
            } catch (e) {
                // 用户主动暂停/取消 → 不再重试
                if (e.name === 'AbortError' || signal?.aborted || S.shouldStop) return null;
                // 其他错误（网络超时等）→ 继续重试
            }
        }
        return null;
    }

    async function downloadImg(url) {
        try {
            const resp = await fetchRetry(url);
            if (!resp || !resp.ok) return null;
            return await resp.blob();
        } catch { return null; }
    }

    // ==================== DOM 解析 ====================
    function parseHTML(html) { return new DOMParser().parseFromString(html, 'text/html'); }

    function isEndPage(doc) {
        const txt = (doc.body?.textContent || '').trim();
        const flags = ['暂无新闻', '没有找到相关记录', '没有任何内容', '暂无内容', '没有新闻', '无相关数据', '没有符合条件的记录', '暂无数据'];
        if (flags.some(f => txt.includes(f))) return true;
        if (txt.length < 400) return true;
        const exclude = ['更多', '全部', '查看更多', '返回', '首页', '上一页', '下一页', '尾页'];
        let cnt = 0;
        for (const a of doc.querySelectorAll('a[href]')) {
            const h = a.getAttribute('href'), t = a.textContent.trim();
            if (!h || h.startsWith('javascript:') || h.startsWith('#')) continue;
            if (!(h.startsWith('./') || h.startsWith('../') || (h.startsWith('/') && h.includes('xwsc')))) continue;
            if (t.length <= 3 || exclude.some(w => t.includes(w))) continue;
            cnt++;
        }
        return cnt === 0;
    }

    function extractAllLinks(doc, curPage) {
        const results = [];
        const exclude = ['更多', '全部', '查看更多', '返回', '首页', '上一页', '下一页', '尾页', '最后一页', '末页'];
        for (const a of doc.querySelectorAll('a[href]')) {
            const href = a.getAttribute('href').trim(), title = a.textContent.trim();
            if (!href || href.startsWith('javascript:') || href.startsWith('#')) continue;
            if (!(href.startsWith('./') || href.startsWith('../') || (href.startsWith('/') && href.includes('xwsc')))) continue;
            if (title.length <= 3 || exclude.some(w => title.includes(w))) continue;
            if (/^\d+$/.test(title)) continue;
            // 提取发布时间（多策略）
            let dateText = '';
            const row = a.closest('li,tr,div');
            if (row) {
                // 策略1：常用 class 名
                const byClass = row.querySelector('span.date,span.time,span.news_time,em,i.date,i.time,.date,.time,.news-date,.pub-date');
                if (byClass) dateText = byClass.textContent.trim();
                // 策略2：在行内搜索日期格式文本
                if (!dateText) {
                    const spans = row.querySelectorAll('span,i,em,font,time,td');
                    for (const s of spans) {
                        const t = s.textContent.trim();
                        if (/^\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}/.test(t)) { dateText = t; break; }
                    }
                }
                // 策略3：整行文本正则匹配
                if (!dateText) {
                    const m = row.textContent.match(/(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}[日]?\s*\d{1,2}:\d{2}(:\d{2})?)/);
                    if (m) dateText = m[1];
                    else {
                        const m2 = row.textContent.match(/(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}[日]?)/);
                        if (m2) dateText = m2[1];
                    }
                }
            }
            results.push({ title, link: href, page: curPage, dateText });
        }
        return results;
    }

    function extractContent(doc) {
        const selectors = ['div.article-content', 'div.v_news_content', 'div.content', 'div.article', 'div.news-content', 'div#content', 'div.main_content', 'div.text', 'div.detail-content', 'div.news_detail'];
        let cd = null;
        for (const s of selectors) { cd = doc.querySelector(s); if (cd) break; }
        if (!cd) {
            for (const el of doc.querySelectorAll('div,section,article')) {
                if (['content', 'article', 'detail', 'text', 'main', 'body'].some(k => ((el.id || '') + ' ' + (el.className || '')).toLowerCase().includes(k))) { cd = el; break; }
            }
        }
        if (!cd) {
            let mp = 0, best = null;
            for (const d of doc.querySelectorAll('div')) { const c = d.querySelectorAll('p').length; if (c > mp && c >= 2) { mp = c; best = d; } }
            if (best && mp >= 3) cd = best;
        }
        if (!cd) cd = doc.body;
        if (!cd) return { text: '', images: [] };

        const clone = cd.cloneNode(true);
        clone.querySelectorAll('script,style,iframe,.share,.author,.time,.info,.footer,.header,.sidebar,.navigation,.comment').forEach(el => el.remove());

        const imgs = [];
        clone.querySelectorAll('img').forEach((img, i) => {
            let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
            if (src && !src.startsWith('data:')) {
                let fn = ''; try { const u = new URL(src, BASE_SITE); const bn = u.pathname.split('/').pop(); fn = (bn && bn.includes('.')) ? bn : `image_${i + 1}.jpg`; } catch { fn = `image_${i + 1}.jpg`; }
                if (fn.length > 80) { const ext = fn.lastIndexOf('.'); fn = ext > 0 ? fn.slice(0, 60) + fn.slice(ext) : fn; }
                imgs.push({ url: src, filename: safeName(fn).replace(/[\\/*?:"<>|]/g, '_') });
            }
        });

        clone.querySelectorAll('img').forEach((img, i) => { img.replaceWith(doc.createTextNode(`[${img.getAttribute('alt') || '图片' + (i + 1)}]`)); });
        let text = clone.textContent.trim();
        if (!text || text.length < 100) { const paras = $$('p', doc).map(p => p.textContent.trim()).filter(Boolean); if (paras.length > 0) text = paras.join('\n\n'); }
        return { text, images: imgs };
    }

    // ==================== 并发扫描引擎 ====================
    async function scanAllPages() {
        S.status = 'scanning'; S.phase = 'scan'; S.shouldStop = false;
        S.abortCtrl = new AbortController();
        S.donePages = S.donePages || [];
        const doneSet = new Set(S.donePages);
        S.scanPagesDone = doneSet.size;
        refreshUI();

        const cfg = spd();
        log('========== 开始全站扫描 ==========', 'lf');
        log(`速度: ${cfg.name} | 并发: ${cfg.sc} | 最大页: ${S.maxPages}`);

        const seen = new Set(S.allNews.map(n => n.link));
        let nextPage = 0;
        let foundEnd = false;
        let pagesDone = doneSet.size;
        let conseqFails = 0;  // 连续失败计数

        async function worker() {
            while (!foundEnd && !S.shouldStop && nextPage < S.maxPages) {
                // 跳过已完成的页
                let myPage;
                while (true) {
                    myPage = nextPage++;
                    if (myPage >= S.maxPages) return;
                    if (!doneSet.has(myPage)) break;
                }

                const url = myPage === 0 ? `${BASE_URL}.shtml` : `${BASE_URL}_${myPage}.shtml`;

                const resp = await fetchRetry(url, RETRY_MAX, S.abortCtrl.signal);
                if (!resp) {
                    conseqFails++;
                    if (conseqFails >= 3) { log(`${conseqFails} 次连续失败 → 假设已达末页`, 'lw'); foundEnd = true; break; }
                    continue;
                }
                conseqFails = 0;
                if (!resp.ok) {
                    if (resp.status === 404) { log('404 → 已达末页', 'lok'); foundEnd = true; break; }
                    conseqFails++;
                    if (conseqFails >= 4) { foundEnd = true; break; }
                    continue;
                }

                const html = await resp.text();
                const doc = parseHTML(html);

                if (isEndPage(doc)) { log(`第 ${myPage + 1} 页 → 末页`, 'lok'); foundEnd = true; break; }

                const links = extractAllLinks(doc, myPage + 1);
                let added = 0;
                for (const l of links) {
                    if (!seen.has(l.link)) {
                        seen.add(l.link);
                        S.allNews.push({ id: S.nextId++, title: l.title, link: l.link, page: l.page, foundAt: new Date().toLocaleString(), fetched: false, content: '', dateText: l.dateText, images: [] });
                        added++;
                    }
                }

                doneSet.add(myPage);
                pagesDone++;
                S.totalScanned = S.allNews.length;
                if (myPage > S.curPage) S.curPage = myPage;
                S.scanPagesDone = pagesDone;

                log(`  第 ${myPage + 1} 页: +${added} 条 (累计 ${S.totalScanned}) | 进度 ${pagesDone} 页`, added > 0 ? 'lok' : 'li');
                saveNews();
                // 持久化已完成页列表
                S.donePages = [...doneSet];
                GM_setValue(sk('donePages'), S.donePages);
                refreshUI();
                applyFilter();

                if (cfg.dm > 0) await sleep(Math.random() * cfg.dm * 1500);
            }
        }

        const ws = [];
        for (let i = 0; i < cfg.sc; i++) ws.push(worker());
        await Promise.all(ws);

        S.abortCtrl = null;

        if (S.shouldStop) {
            S.status = 'paused';
            log('扫描已暂停（页码追踪已保存，继续时不会重复）', 'lw');
        } else {
            S.donePages = []; GM_deleteValue(sk('donePages'));
            S.status = 'idle';
            S.phase = '';
            log(`========== 扫描完成！共 ${S.totalScanned} 条新闻 ==========`, 'lok');
        }
        refreshUI();
    }

    // ==================== 并发详情抓取 ====================
    async function fetchSelectedDetails(idList) {
        S.status = 'fetching'; S.phase = 'detail'; S.shouldStop = false;
        S.abortCtrl = new AbortController();
        S.detailDone = S.allNews.filter(n => n.fetched).length;
        refreshUI();

        S.detailTargets = [...idList];  // 保存目标列表供暂停后继续
        const targets = S.allNews.filter(n => idList.includes(n.id) && !n.fetched);
        if (targets.length === 0) { log('没有需要抓取的新闻', 'li'); S.detailTargets = []; S.status = 'idle'; S.phase = ''; refreshUI(); return; }

        const cfg = spd();
        log(`========== 并发抓取 ${targets.length} 条详情 (并发:${cfg.dc}, 图片并发:${cfg.ic}) ==========`, 'lf');

        let nextIdx = 0;

        async function worker() {
            while (nextIdx < targets.length && !S.shouldStop) {
                const i = nextIdx++;
                const n = targets[i];
                const newsUrl = resolveUrl(n.link);

                let ok = false;
                for (let a = 0; a < 3 && !ok && !S.shouldStop; a++) {
                    try {
                        if (a > 0) { log(`  [${n.title.slice(0, 25)}...] 重试 ${a + 1}/3`, 'lw'); await sleep(3000); }
                        const resp = await fetchRetry(newsUrl, RETRY_MAX, S.abortCtrl.signal);
                        if (!resp || !resp.ok) continue;
                        const html = await resp.text();
                        const doc = parseHTML(html);
                        const { text, images } = extractContent(doc);
                        if (text && text.length >= 40) {
                            n.content = text;

                            // 并发下载图片
                            if (images.length > 0) {
                                const imgResults = await pooledMap(images, cfg.ic, async (im) => {
                                    if (S.shouldStop) return { url: im.url, filename: im.filename, blob: null };
                                    const full = resolveUrl(im.url, newsUrl);
                                    const blob = await downloadImg(full);
                                    return { url: full, filename: im.filename, blob };
                                });
                                n.images = imgResults.filter(r => r && !(r instanceof Error));
                            } else {
                                n.images = [];
                            }

                            n.fetched = true; ok = true; S.detailDone++;
                            const imgOk = n.images.filter(im => im.blob).length;
                            log(`  ✓ [${n.title.slice(0, 30)}] ${text.length}字, ${imgOk}/${images.length}图`, 'lok');
                        }
                    } catch (e) { log(`  ✗ ${e.message}`, 'le'); }
                }
                if (!ok) { S.detailFail++; log(`  ✗ 失败: ${n.title}`, 'le'); }

                saveNews();
                refreshUI();
                applyFilter();
                if (cfg.dm > 0) await sleep(cfg.dm * 1500 + Math.random() * cfg.dm * 1000);
            }
        }

        const ws = [];
        for (let i = 0; i < cfg.dc; i++) ws.push(worker());
        await Promise.all(ws);

        S.abortCtrl = null;
        if (S.shouldStop) {
            S.status = 'paused';
        } else {
            S.detailTargets = [];
            S.status = 'idle';
            S.phase = '';
            log(`========== 详情抓取完成 (共已抓取 ${S.detailDone} 条) ==========`, 'lok');
        }
        refreshUI();
    }

    // ==================== 过滤 & 排序 ====================
    function applyFilter() {
        const q = ($('#wnc-search')?.value || '').trim().toLowerCase();
        let list = [...S.allNews];
        if (q) {
            if (S.searchMode === 'title') list = list.filter(n => n.title.toLowerCase().includes(q));
            else list = list.filter(n => n.title.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q)));
        }
        list.sort((a, b) => {
            let va, vb;
            if (S.sortBy === 'title') { va = a.title; vb = b.title; }
            else if (S.sortBy === 'date') { va = (a.dateText || '').replace(/[年月]/g, '-').replace(/[日]/g, ''); vb = (b.dateText || '').replace(/[年月]/g, '-').replace(/[日]/g, ''); }
            else { va = a.page; vb = b.page; }
            if (typeof va === 'number') return S.sortAsc ? va - vb : vb - va;
            return S.sortAsc ? va.localeCompare(vb, 'zh') : vb.localeCompare(va, 'zh');
        });
        S.filteredIdx = list.map(n => n.id);
        renderResultList();
        const infoEl = $('#wnc-res-info'); if (infoEl) infoEl.textContent = `显示 ${list.length} / ${S.allNews.length} 条`;
        const cntEl = $('#wnc-rescnt'); if (cntEl) cntEl.textContent = S.allNews.length;
    }

    function renderResultList() {
        const el = $('#wnc-res-list'); if (!el) return;
        // 保存当前展开状态
        $$('.wnc-item.exp', el).forEach(div => S.expanded.add(Number(div.dataset.nid)));
        if (S.filteredIdx.length === 0) { el.innerHTML = '<div class="wnc-empty">📭 没有匹配的新闻</div>'; return; }
        const frag = document.createDocumentFragment();
        for (const nid of S.filteredIdx) {
            const n = S.allNews.find(x => x.id === nid); if (!n) continue;
            const div = document.createElement('div');
            div.className = 'wnc-item' + (S.visited.has(n.id) ? ' visited' : '') + (S.selected.has(n.id) ? ' sel' : '') + (S.expanded.has(n.id) ? ' exp' : ''); div.dataset.nid = n.id;
            const tag = n.fetched ? '<span class="tag tag-ok">✓ 已抓取</span>' : '<span class="tag tag-pend">⏳ 待抓取</span>';
            const bc = n.images ? n.images.filter(im => im.blob).length : 0;
            const ic = n.images ? n.images.length : 0;
            let det = '';
            if (n.fetched) {
                const pv = n.content.length > 2500 ? n.content.slice(0, 2500) + '\n\n... (导出查看全文)' : n.content;
                let ih = '';
                if (n.images && n.images.length > 0) {
                    ih = '<div class="ii">' + n.images.map(im => {
                        // 缓存 blob URL 避免重复 createObjectURL 导致内存泄漏
                        if (im.blob && !im._blobUrl) im._blobUrl = URL.createObjectURL(im.blob);
                        const src = im._blobUrl || im.url;
                        return `<img src="${escHTML(src)}" title="${escHTML(im.filename)}" loading="lazy">`;
                    }).join('') + '</div>';
                }
                det = `<div class="id"><div class="ic">${escHTML(pv)}</div>${ih}</div>`;
            }
            div.innerHTML = `<input type="checkbox" class="cb" ${S.selected.has(n.id) ? 'checked' : ''}><div class="ib"><div class="it"><a href="${escHTML(resolveUrl(n.link))}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${escHTML(n.title)}</a></div><div class="im">第${n.page}页 | ${tag} | ${n.foundAt}${n.fetched ? ' | 图:' + bc + '/' + ic : ''}${n.dateText ? ' | ' + escHTML(n.dateText) : ''}</div>${det}</div>`;
            div.querySelector('.ib').addEventListener('click', e => {
                if (e.target.tagName === 'IMG' || e.target.tagName === 'A') return;
                div.classList.toggle('exp');
                if (div.classList.contains('exp')) S.expanded.add(n.id);
                else S.expanded.delete(n.id);
            });
            div.querySelector('.cb').addEventListener('click', e => {
                e.stopPropagation();
                if (e.target.checked) S.selected.add(n.id); else S.selected.delete(n.id);
                div.classList.toggle('sel', S.selected.has(n.id));
                updateSelCount();
            });
            frag.appendChild(div);
        }
        el.innerHTML = ''; el.appendChild(frag); updateSelCount();
    }

    function updateSelCount() { const el = $('#wnc-sel-count'); if (el) el.textContent = S.selected.size; }

    // ==================== UI 刷新 ====================
    function refreshUI() {
        const sm = { idle: '就绪', scanning: '扫描中', fetching: '抓取中', done: '完成', paused: '已暂停' };
        const st = $('#wnc-stat-status'); if (st) st.textContent = sm[S.status] || S.status;
        const sp = $('#wnc-stat-page'); if (sp) sp.textContent = S.curPage > 0 ? S.curPage + 1 : '-';
        const sf = $('#wnc-stat-total'); if (sf) sf.textContent = S.totalScanned;
        const sd = $('#wnc-stat-done'); if (sd) sd.textContent = S.detailDone;
        const fl = $('#wnc-stat-fail'); if (fl) fl.textContent = S.detailFail;

        const pg = $('#wnc-prog-fill');
        if (pg) {
            if (S.status === 'scanning') {
                const done = S.scanPagesDone || 0;
                const pct = Math.min(Math.round(done / S.maxPages * 100), 99);
                pg.style.width = pct + '%'; pg.textContent = `扫描中 ${done}/${S.maxPages} 页`;
            } else if (S.status === 'fetching') {
                const pending = S.allNews.filter(n => !n.fetched).length;
                const done = S.detailDone;
                const total = pending + done || 1;
                pg.style.width = Math.min(Math.round(done / total * 100), 99) + '%';
                pg.textContent = `详情 ${done}/${total}`;
            } else {
                pg.style.width = S.totalScanned > 0 ? '100%' : '0%';
                pg.textContent = S.totalScanned > 0 ? '✓ 扫描完成' : '';
            }
        }

        const scanning = S.status === 'scanning' || S.status === 'fetching';
        const bs = $('#wnc-btn-scan'); if (bs) bs.disabled = scanning;
        const bp = $('#wnc-btn-pause'); if (bp) bp.disabled = !scanning;
        const br = $('#wnc-btn-resume'); if (br) { br.style.display = S.status === 'paused' ? '' : 'none'; br.disabled = false; }
        const bf = $('#wnc-btn-fetchsel'); if (bf) bf.disabled = S.selected.size === 0 || scanning;
        const be = $('#wnc-btn-export'); if (be) be.disabled = S.allNews.filter(n => n.fetched).length === 0 || scanning;
        const bx = $('#wnc-btn-exportsel'); if (bx) bx.disabled = S.selected.size === 0 || scanning;
        $('#wnc-rescnt').textContent = S.allNews.length;
    }

    // ==================== ZIP 导出 ====================
    async function doExport(idList, fmt) {
        if (fmt === 'zip' && typeof JSZip === 'undefined') { alert('JSZip 未加载，请刷新后重试'); return; }
        const items = S.allNews.filter(n => idList.includes(n.id));

        if (fmt === 'json') {
            downloadBlob(new Blob([JSON.stringify(items.map(n => ({ title: n.title, url: resolveUrl(n.link), page: n.page, date: n.dateText, content: n.content, images: (n.images || []).map(im => im.url) })), null, 2)], { type: 'application/json' }), `新闻_${nowDate()}.json`);
            log(`✓ 已导出 ${items.length} 条 (JSON)`, 'lok');
            return;
        }
        if (fmt === 'md') {
            let md = ''; items.forEach(n => { md += `# ${n.title}\n\n- 页码: ${n.page}\n- 链接: ${resolveUrl(n.link)}\n${n.dateText ? '- 日期: ' + n.dateText + '\n' : ''}\n---\n\n${n.content || ''}\n\n${(n.images || []).map(im => `![${im.filename}](${im.url})`).join('\n\n')}\n\n`; });
            downloadBlob(new Blob([md], { type: 'text/markdown' }), `新闻_${nowDate()}.md`);
            log(`✓ 已导出 ${items.length} 条 (Markdown)`, 'lok');
            return;
        }
        if (fmt === 'txt') {
            let txt = ''; items.forEach(n => { txt += `标题: ${n.title}\n页码: ${n.page}\n链接: ${resolveUrl(n.link)}\n${n.dateText ? '日期: ' + n.dateText + '\n' : ''}${'='.repeat(50)}\n\n${n.content || ''}\n\n`; });
            downloadBlob(new Blob([txt], { type: 'text/plain' }), `新闻_${nowDate()}.txt`);
            log(`✓ 已导出 ${items.length} 条 (TXT)`, 'lok');
            return;
        }
        // ZIP
        const zip = new JSZip();
        const fetched = items.filter(n => n.fetched);
        fetched.forEach(n => {
            const f = zip.folder(safeName(n.title));
            f.file(safeName(n.title) + '.txt', `标题: ${n.title}\n页码: ${n.page}\n链接: ${resolveUrl(n.link)}\n${n.dateText ? '日期: ' + n.dateText + '\n' : ''}图片: ${n.images.filter(im => im.blob).length}/${n.images.length} 张\n${'='.repeat(50)}\n\n${n.content}`);
            const imf = f.folder('images'); n.images.forEach(im => { if (im.blob) imf.file(im.filename, im.blob); });
        });
        const pending = items.filter(n => !n.fetched);
        if (pending.length) { let pt = '未抓取详情:\n' + '='.repeat(40) + '\n'; pending.forEach(n => pt += `- ${n.title} (第${n.page}页) ${resolveUrl(n.link)}\n`); zip.file('未抓取列表.txt', pt); }
        zip.file('摘要.txt', `导出时间: ${new Date().toLocaleString()}\n总计: ${items.length} 条\n已抓取: ${fetched.length} 条`);
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `新闻_ZIP_${nowDate()}.zip`);
        log(`✓ ZIP 已导出 (${fetched.length} 条)`, 'lok');
    }

    function downloadBlob(blob, name) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); }
    function nowDate() { return new Date().toISOString().slice(0, 10); }

    // ==================== 构建 UI ====================
    function buildUI() {
        const panel = document.createElement('div');
        panel.id = 'wnc-panel';
        const speedBtns = SPEED.map((p, i) => `<button class="${i === S.speed ? 'on' : ''}" data-sp="${i}">${p.name}</button>`).join('');
        const sc = SPEED[S.speed];
        panel.innerHTML = `
<div id="wnc-hdr"><span class="t">📰 WUT Auto News Crawler</span><button title="最小化" id="wnc-min">−</button><button title="关闭" class="btn-x" id="wnc-close">×</button></div>
<div id="wnc-tabs">
    <div class="tb on" data-tab="scan">📡 扫描</div>
    <div class="tb" data-tab="results">📋 结果 <span class="badge" id="wnc-rescnt">0</span></div>
    <div class="tb" data-tab="settings">⚙ 设置</div>
</div>
<div id="wnc-body">
    <div class="wnc-tab-c on" data-tab="scan">
        <div class="wnc-row"><label>最大页</label><input type="number" id="wnc-maxpages" value="${DEFAULT_MAX_PAGES}" min="1" max="300" style="width:70px"><span style="font-size:11px;color:#6c7086;">|</span><span style="font-size:11px;color:#a6adc8;">速度:</span><span class="wnc-speed-row" id="wnc-speed-btns">${speedBtns}</span><span id="wnc-speed-info" style="font-size:10px;color:#6c7086;">(并发${sc.sc}/${sc.dc}/${sc.ic})</span></div>
        <div class="wnc-row">
            <button class="wnc-btn wnc-btn-pri" id="wnc-btn-scan">▶ 全站扫描</button>
            <button class="wnc-btn wnc-btn-warn" id="wnc-btn-pause" disabled>⏸ 暂停</button>
            <button class="wnc-btn wnc-btn-ok" id="wnc-btn-resume" style="display:none">▶ 继续</button>
            <button class="wnc-btn wnc-btn-dan wnc-btn-xs" id="wnc-btn-reset">↺ 清空</button>
        </div>
        <div class="wnc-prog-wrap"><div class="wnc-prog-fill" id="wnc-prog-fill"></div></div>
        <div class="wnc-stats">
            <span>状态: <span class="v" id="wnc-stat-status">就绪</span></span>
            <span>当前页: <span class="v" id="wnc-stat-page">-</span></span>
            <span>已收集: <span class="v" id="wnc-stat-total">0</span></span>
            <span>已抓取: <span class="v" id="wnc-stat-done" style="color:#a6e3a1">0</span></span>
            <span>失败: <span class="v" id="wnc-stat-fail" style="color:#f38ba8">0</span></span>
        </div>
        <div id="wnc-log"></div>
    </div>
    <div class="wnc-tab-c" data-tab="results">
        <div class="wnc-res-top">
            <input type="text" id="wnc-search" placeholder="🔍 搜索标题...">
            <button class="wnc-btn wnc-btn-ghost wnc-btn-xs" id="wnc-btn-mode">标题</button>
            <select id="wnc-sort" style="width:60px;flex:none;"><option value="page">页码</option><option value="title">标题</option><option value="date">日期</option></select>
            <button class="wnc-btn wnc-btn-ghost wnc-btn-xs" id="wnc-btn-sortdir">↑</button>
        </div>
        <div class="wnc-res-top">
            <span class="wnc-res-info" id="wnc-res-info">显示 0 / 0 条</span><span style="flex:1"></span>
            <button class="wnc-btn wnc-btn-ghost wnc-btn-xs" id="wnc-btn-selall">全选</button>
            <button class="wnc-btn wnc-btn-ghost wnc-btn-xs" id="wnc-btn-selnone">取消</button>
            <button class="wnc-btn wnc-btn-warn wnc-btn-xs" id="wnc-btn-fetchsel" disabled>📥 抓取选中</button>
            <span style="font-size:11px;color:#a6adc8;">已选 <span id="wnc-sel-count">0</span></span>
        </div>
        <div class="wnc-res-top">
            <span style="font-size:11px;color:#6c7086;">导出:</span>
            <button class="wnc-btn wnc-btn-ok wnc-btn-xs" id="wnc-btn-export" disabled>📦 ZIP全部</button>
            <button class="wnc-btn wnc-btn-ok wnc-btn-xs" id="wnc-btn-exportsel" disabled>📦 ZIP选中</button>
            <button class="wnc-btn wnc-btn-ghost wnc-btn-xs" id="wnc-btn-export-txt">TXT</button>
            <button class="wnc-btn wnc-btn-ghost wnc-btn-xs" id="wnc-btn-export-json">JSON</button>
            <button class="wnc-btn wnc-btn-ghost wnc-btn-xs" id="wnc-btn-export-md">MD</button>
        </div>
        <div id="wnc-res-list"><div class="wnc-empty">尚未扫描，请先在「扫描」标签页开始扫描</div></div>
    </div>
    <div class="wnc-tab-c" data-tab="settings">
        <div class="wnc-row"><label>打开网站时自动扫描</label><label class="wnc-tgl"><input type="checkbox" id="wnc-auto-scan" ${S.autoScan ? 'checked' : ''}><span class="sl"></span></label></div>
        <div class="wnc-row"><label>默认最大页数</label><input type="number" id="wnc-def-maxpages" value="${DEFAULT_MAX_PAGES}" min="1" max="500" style="width:80px"><button class="wnc-btn wnc-btn-ghost wnc-btn-xs" id="wnc-btn-save-settings">保存</button></div>
        <div style="margin-top:12px;padding:10px;background:#313244;border-radius:8px;font-size:12px;color:#a6adc8;line-height:1.8;">
            <b style="color:#f5c2e7;">⚡ 速度说明</b><br>
            🐢 温和: 并发3/2/2，有延迟 — 模拟人类，最安全<br>
            🚀 快速: 并发6/4/4，低延迟 — 推荐日常<br>
            ⚡ 极速: 并发12/8/8，零延迟 — 批量爬取最快<br><br>
            并发数依次为: 扫描页 | 抓详情 | 下图片
        </div>
    </div>
</div>`;
        document.body.appendChild(panel);
        return panel;
    }

    function wireEvents() {
        // 拖拽
        let dx, dy;
        $('#wnc-hdr').addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            const r = $('#wnc-panel').getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top;
            const mv = ev => { $('#wnc-panel').style.left = (ev.clientX - dx) + 'px'; $('#wnc-panel').style.top = (ev.clientY - dy) + 'px'; };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', () => { document.removeEventListener('mousemove', mv); }, { once: true });
        });

        $('#wnc-min').addEventListener('click', () => $('#wnc-panel').classList.toggle('mini'));
        $('#wnc-close').addEventListener('click', () => {
            if (S.status === 'scanning' || S.status === 'fetching') { if (!confirm('任务进行中，确定关闭？')) return; }
            S.shouldStop = true; if (S.abortCtrl) S.abortCtrl.abort();
            $('#wnc-panel').remove();
        });

        // Tabs
        $$('#wnc-tabs .tb').forEach(t => t.addEventListener('click', () => {
            $$('#wnc-tabs .tb').forEach(x => x.classList.remove('on')); t.classList.add('on');
            $$('#wnc-body .wnc-tab-c').forEach(x => x.classList.remove('on'));
            $(`#wnc-body .wnc-tab-c[data-tab="${t.dataset.tab}"]`).classList.add('on');
            if (t.dataset.tab === 'results') applyFilter();
            saveState();
        }));

        // 速度切换
        $$('#wnc-speed-btns button').forEach(b => b.addEventListener('click', () => {
            S.speed = parseInt(b.dataset.sp);
            $$('#wnc-speed-btns button').forEach(x => x.classList.remove('on')); b.classList.add('on');
            const c = SPEED[S.speed];
            const info = $('#wnc-speed-info'); if (info) info.textContent = `(并发${c.sc}/${c.dc}/${c.ic})`;
            saveState();
        }));

        // 扫描
        $('#wnc-btn-scan').addEventListener('click', async () => {
            S.maxPages = parseInt($('#wnc-maxpages').value) || DEFAULT_MAX_PAGES;
            S.curPage = 0; S.shouldStop = false; S.donePages = []; S.scanPagesDone = 0;
            GM_deleteValue(sk('donePages'));
            S.detailDone = S.allNews.filter(n => n.fetched).length;
            refreshUI(); await scanAllPages(); refreshUI();
        });
        $('#wnc-btn-pause').addEventListener('click', () => { S.shouldStop = true; if (S.abortCtrl) S.abortCtrl.abort(); refreshUI(); });
        $('#wnc-btn-resume').addEventListener('click', async () => {
            S.shouldStop = false; refreshUI();
            if (S.phase === 'scan') await scanAllPages();
            else if (S.phase === 'detail') {
                await fetchSelectedDetails(S.detailTargets);
            }
            refreshUI();
        });
        $('#wnc-btn-reset').addEventListener('click', () => {
            if (!confirm('清空所有已收集的新闻数据？（不可恢复）')) return;
            S.allNews.forEach(n => n.images && n.images.forEach(im => { if (im._blobUrl) URL.revokeObjectURL(im._blobUrl); }));
            S.allNews = []; S.filteredIdx = []; S.selected.clear(); S.expanded.clear(); S.totalScanned = 0; S.scanPagesDone = 0;
            S.detailDone = 0; S.detailFail = 0; S.detailTargets = [];
            S.curPage = 0; S.nextId = 1; S.status = 'idle'; S.phase = ''; S.donePages = [];
            GM_deleteValue(sk('news')); GM_deleteValue(sk('nextId')); GM_deleteValue(sk('donePages')); $('#wnc-log').innerHTML = '';

            refreshUI(); applyFilter();
        });

        // 搜索
        $('#wnc-search').addEventListener('input', () => { applyFilter(); saveState(); });
        $('#wnc-btn-mode').addEventListener('click', () => { S.searchMode = S.searchMode === 'title' ? 'content' : 'title'; $('#wnc-btn-mode').textContent = S.searchMode === 'title' ? '标题' : '内容'; applyFilter(); saveState(); });

        // 排序
        $('#wnc-sort').value = S.sortBy; $('#wnc-btn-sortdir').textContent = S.sortAsc ? '↑' : '↓';
        $('#wnc-sort').addEventListener('change', () => { S.sortBy = $('#wnc-sort').value; saveState(); applyFilter(); });
        $('#wnc-btn-sortdir').addEventListener('click', () => { S.sortAsc = !S.sortAsc; $('#wnc-btn-sortdir').textContent = S.sortAsc ? '↑' : '↓'; saveState(); applyFilter(); });

        // 选择
        $('#wnc-btn-selall').addEventListener('click', () => { S.filteredIdx.forEach(id => S.selected.add(id)); applyFilter(); });
        $('#wnc-btn-selnone').addEventListener('click', () => { S.selected.clear(); applyFilter(); });

        // 抓取
        $('#wnc-btn-fetchsel').addEventListener('click', async () => { if (S.selected.size > 0) await fetchSelectedDetails([...S.selected]); });

        // 导出
        $('#wnc-btn-export').addEventListener('click', () => {
            const ids = S.allNews.filter(n => n.fetched).map(n => n.id);
            if (ids.length === 0) { alert('没有已抓取的新闻'); return; }
            doExport(ids, 'zip');
        });
        $('#wnc-btn-exportsel').addEventListener('click', () => { if (S.selected.size === 0) { alert('请先选中'); return; } doExport([...S.selected], 'zip'); });
        $('#wnc-btn-export-txt').addEventListener('click', () => doExport(S.selected.size > 0 ? [...S.selected] : S.allNews.map(n => n.id), 'txt'));
        $('#wnc-btn-export-json').addEventListener('click', () => doExport(S.selected.size > 0 ? [...S.selected] : S.allNews.map(n => n.id), 'json'));
        $('#wnc-btn-export-md').addEventListener('click', () => doExport(S.selected.size > 0 ? [...S.selected] : S.allNews.map(n => n.id), 'md'));

        // 标题链接点击 → 标记已访
        document.addEventListener('click', e => {
            const a = e.target.closest('.wnc-item .it a');
            if (a) {
                const item = a.closest('.wnc-item');
                if (item) {
                    const nid = Number(item.dataset.nid);
                    S.visited.add(nid);
                    item.classList.add('visited');
                    unsafeWindow.sessionStorage.setItem('wnc_visited', JSON.stringify([...S.visited]));
                }
            }
        });

        // 图片预览
        document.addEventListener('click', e => {
            if (e.target.closest('#wnc-img-modal')) { e.target.closest('#wnc-img-modal').remove(); return; }
            const img = e.target.closest('.ii img');
            if (img) { const m = document.createElement('div'); m.id = 'wnc-img-modal'; m.innerHTML = `<img src="${img.src}">`; document.body.appendChild(m); }
        });

        // 设置
        $('#wnc-auto-scan').addEventListener('change', () => { S.autoScan = $('#wnc-auto-scan').checked; saveState(); });
        $('#wnc-btn-save-settings').addEventListener('click', () => {
            const v = parseInt($('#wnc-def-maxpages').value);
            if (v > 0 && v <= 500) { S.maxPages = v; $('#wnc-maxpages').value = v; saveState(); log('设置已保存', 'lok'); }
        });
    }

    // ==================== 初始化 ====================
    function init() {
        buildUI(); wireEvents();

        S.allNews = loadNews();
        S.nextId = GM_getValue(sk('nextId'), 1);
        S.totalScanned = S.allNews.length;
        S.detailDone = S.allNews.filter(n => n.fetched).length;
        S.sortBy = GM_getValue(sk('sortBy'), 'page');
        S.sortAsc = GM_getValue(sk('sortAsc'), true);
        S.searchMode = GM_getValue(sk('searchMode'), 'title');
        $('#wnc-sort').value = S.sortBy;
        $('#wnc-btn-sortdir').textContent = S.sortAsc ? '↑' : '↓';
        $('#wnc-btn-mode').textContent = S.searchMode === 'title' ? '标题' : '内容';

        // 恢复搜索词
        const savedQuery = GM_getValue(sk('searchQuery'), '');
        if (savedQuery) { $('#wnc-search').value = savedQuery; }

        // 恢复上次活跃 Tab
        const activeTab = GM_getValue(sk('activeTab'), 'scan');
        $$('#wnc-tabs .tb').forEach(x => x.classList.remove('on'));
        const targetTab = $(`#wnc-tabs .tb[data-tab="${activeTab}"]`);
        if (targetTab) targetTab.classList.add('on');
        $$('#wnc-body .wnc-tab-c').forEach(x => x.classList.remove('on'));
        const targetBody = $(`#wnc-body .wnc-tab-c[data-tab="${activeTab}"]`);
        if (targetBody) targetBody.classList.add('on');

        if (S.allNews.length > 0) log(`已恢复 ${S.allNews.length} 条新闻数据`);
        refreshUI(); applyFilter();

        // 智能检测当前页
        const curUrl = window.location.href;
        if (curUrl.includes('/xwsc/')) {
            if (/index(_\d+)?\.shtml/.test(curUrl) || curUrl.endsWith('/xwsc/')) {
                log('📍 检测到新闻列表页', 'lok');
            } else if (/\.shtml$/.test(curUrl)) {
                log(`📍 检测到新闻详情页: "${document.title}"`);
                const btn = document.createElement('button');
                btn.className = 'wnc-btn wnc-btn-warn wnc-btn-xs'; btn.textContent = '+ 添加当前页'; btn.style.marginLeft = '8px';
                btn.addEventListener('click', async () => {
                    const link = window.location.pathname + window.location.search;
                    if (S.allNews.some(n => n.link === link)) { log('该新闻已在列表中', 'lw'); return; }
                    const { text, images } = extractContent(document);
                    S.allNews.push({ id: S.nextId++, title: document.title, link, page: 0, foundAt: new Date().toLocaleString(), fetched: true, content: text, dateText: '', images: [] });
                    const cfg = spd();
                    if (images.length > 0) {
                        const results = await pooledMap(images, cfg.ic, async im => {
                            const full = resolveUrl(im.url, window.location.href);
                            const blob = await downloadImg(full);
                            return { url: full, filename: im.filename, blob };
                        });
                        S.allNews[S.allNews.length - 1].images = results.filter(r => r && !(r instanceof Error));
                    }
                    S.totalScanned = S.allNews.length; S.detailDone++; saveNews(); refreshUI(); applyFilter();
                    log(`✓ 已添加: ${document.title}`, 'lok');
                });
                $('#wnc-btn-scan').parentNode.appendChild(btn);
            }
        }

        if (S.autoScan && S.allNews.length === 0) {
            log('🚀 自动扫描已启用，1 秒后开始...');
            setTimeout(async () => { await scanAllPages(); refreshUI(); }, 1000);
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else window.addEventListener('DOMContentLoaded', init);
})();
