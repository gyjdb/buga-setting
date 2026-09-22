"use strict";

// 《银色联盟风土志》：馆藏读物的对开阅读视图。只改变呈现，正文与编者材料仍来自原文件。
// 装帧参照《大地巡旅》：中文管内容，拉丁文、英文与罗马数字管结构（作者决定 FA29–FA32）。
const BOOK_TITLE = "银色联盟风土志";
const BOOK_LATIN = "De Foedere Argenteo";
const BOOK_SUBTITLE = "A Survey of the Silver Alliance";
const BOOK_NOTES_PATH = "07_WORLD_GUIDE/银色联盟风土志_编者材料.md";
const BOOK_RESUME_KEY = "buga.fengtuzhi.lastChapter";
const BOOK_ROMAN = { 一: "I", 二: "II", 三: "III", 四: "IV", 五: "V", 六: "VI", 七: "VII", 八: "VIII", 九: "IX", 十: "X" };
// 英文章名与拉丁底纹词；题记只用法典现成的话。
const BOOK_CHAPTERS = {
  一: { en: "A Kingdom in the Sky", ghost: "Caelum" },
  二: { en: "The White Tower and the Great Library", ghost: "Bibliotheca", epigraph: ["知识改变命运。", "Scientia fatum mutat.", "白塔铭言"] },
  三: { en: "The Making of a Wizard", ghost: "Disciplina" },
  四: { en: "Magic and Its Limits", ghost: "Magia" },
  五: { en: "Among the Cities", ghost: "Civitates" },
  六: { en: "The Parliament and the Twelve Rings", ghost: "Concilium", epigraph: ["向知识致敬，向真理致敬。", "", "奈塔斯大殿的齐诵之辞"] },
  七: { en: "Origins", ghost: "Origo" },
  八: { en: "The Edges of the Sky", ghost: "Fines" },
  九: { en: "The Turning Year", ghost: "Annus" }
};
// 第一章资料卡：均为现行事实。
const BOOK_SUMMARY = [
  ["主体民族", "Gens", "布加人（白银之民）"],
  ["首府", "Caput", "卡奈奇"],
  ["城邦", "Civitates", "约三十座浮空城"],
  ["法定货币", "Moneta", "阿根特，一阿根特合一百星"],
  ["象征", "Signum", "洞察之眼"]
];
const BOOK_LEVELS = ["Aurēa", "Vesperā", "Stellāra", "Abyssāra", "Nihilāra"];

// 洞察之眼：悬于碧蓝海洋之上的眼睛（布加徽记）。
function bookEmblem(label = "洞察之眼") {
  return `<svg class="book-emblem" viewBox="0 0 120 120" role="img" aria-label="${label}"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M60 13v-8M60 99v-5M31 21l-5-6M89 21l5-6M18 35l-7-3M102 35l7-3" stroke-width="1.6"/><path d="M12 56Q60 16 108 56Q60 96 12 56Z" stroke-width="2.4"/><path d="M22 56Q60 26 98 56" stroke-width="0.9" opacity=".55"/><circle cx="60" cy="56" r="17" stroke-width="1.8"/><circle cx="60" cy="56" r="11.5" stroke-width="0.8" opacity=".6"/><circle cx="60" cy="56" r="6" fill="currentColor" stroke="none"/><circle cx="56.5" cy="52.5" r="1.7" fill="var(--paper)" stroke="none"/></g><g class="book-emblem-sea" fill="none" stroke-linecap="round" stroke-width="2"><path d="M16 100q7-5.5 14 0t14 0t14 0t14 0t14 0t14 0"/><path d="M24 110q7-5.5 14 0t14 0t14 0t14 0t14 0" opacity=".6"/></g></svg>`;
}
function bookSeal(text, label) {
  return `<svg class="book-seal" viewBox="0 0 100 100" role="img" aria-label="${label}"><defs><path id="book-seal-ring" d="M50 50m-37 0a37 37 0 1 1 74 0a37 37 0 1 1-74 0"/></defs><circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="50" cy="50" r="44.5" fill="none" stroke="currentColor" stroke-width=".6"/><circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" stroke-width=".9"/><text class="book-seal-text"><textPath href="#book-seal-ring">${text}</textPath></text><path d="M31 50Q50 36 69 50Q50 64 31 50Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="50" cy="50" r="5.5" fill="currentColor"/><path d="M36 61q3.5-3 7 0t7 0t7 0t7 0" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>`;
}

// 续读位置只存在本机浏览器；读不到时页面照常显示。
function bookResume(list) {
  let slug;
  try { slug = localStorage.getItem(BOOK_RESUME_KEY); } catch { return null; }
  const item = slug && list.find(h => (h.slug || h.id.replace(/^section-/, "")) === slug);
  if (!item) return null;
  const [, num, name] = item.label.match(/^([一二三四五六七八九十]+)、(.+)$/) || [];
  return { slug, label: num ? `Capitulum ${BOOK_ROMAN[num] || num} · ${name}` : item.label };
}
function bookRemember(chapter) {
  try { localStorage.setItem(BOOK_RESUME_KEY, chapter.id.replace(/^section-/, "")); } catch {}
}

function bookFetch(doc) {
  return fetch("docs/" + doc.id + ".json").then(r => { if (!r.ok) throw new Error("正文读取失败（" + r.status + "）"); return r.json(); });
}
function bookChapters(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html").body;
  const chapters = [];
  for (const node of [...parsed.children]) {
    if (node.tagName === "H1") continue;
    if (node.tagName === "H2") {
      const [, num = "", name = node.textContent] = node.textContent.match(/^([一二三四五六七八九十]+)、(.+)$/) || [];
      chapters.push({ id: node.id, label: node.textContent, num, name, roman: BOOK_ROMAN[num] || num, meta: BOOK_CHAPTERS[num] || {}, nodes: [] });
    } else if (chapters.length) chapters.at(-1).nodes.push(node);
  }
  return chapters;
}
// 编者材料“各章来源”一节：<li><strong>一、天上的国度</strong>：链接……</li>
function bookSources(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html").body, map = new Map();
  for (const li of parsed.querySelectorAll("li")) {
    const label = li.querySelector("strong")?.textContent.trim();
    if (!label || !/^[一二三四五六七八九十]+、/.test(label) || map.has(label)) continue;
    const clone = li.cloneNode(true);
    clone.querySelector("strong").remove();
    map.set(label, clone.innerHTML.replace(/^\s*[：:]\s*/, ""));
  }
  return map;
}
function bookBody(chapter) {
  const nodes = chapter.nodes.map(n => n.cloneNode(true));
  nodes.find(n => n.tagName === "P")?.classList.add("book-opening");
  return nodes.map(n => n.outerHTML).join("");
}
function bookRecord(chapter, sources) {
  if (!sources.has(chapter.label)) return "";
  return `<aside class="book-record" aria-label="馆员批注：${esc(chapter.name)}所据文献">
    <header class="book-record-head">
      <div><span class="book-record-title">Archivum Turris Albae · Acta</span><p>档案归档 / 馆员批注 · 本章所据</p></div>
      <dl>
        <div><dt>归档号 <i>Numerus</i></dt><dd>DFA · ${esc(chapter.roman)}</dd></div>
        <div><dt>权限等级 <i>Gradus</i></dt><dd class="book-levels">${BOOK_LEVELS.map((l, i) => `<span${i ? "" : ' class="on"'}>${l}</span>`).join("")}</dd></div>
      </dl>
    </header>
    <div class="book-record-body"><p class="book-record-label">Fontes · Capitulum ${esc(chapter.roman)}</p><p>${sources.get(chapter.label)}</p></div>
    <span class="book-visum" aria-label="审阅章：VISUM">Visum</span>
  </aside>`;
}
function bookOpener(c) {
  const m = c.meta, ep = m.epigraph;
  return `<div class="book-opener">
      <span class="book-ghost" aria-hidden="true">${esc(m.ghost || "")}</span>
      ${bookEmblem()}
      <p class="book-cap"><span>Capitulum</span><b>${esc(c.roman)}</b></p>
      <h2 id="${esc(c.id)}" class="book-chapter-title">${esc(c.name)}</h2>
      ${m.en ? `<p class="book-chapter-en" lang="en">${esc(m.en)}</p>` : ""}
      ${ep ? `<div class="book-epigraph"><span class="book-kicker">Epigraphe</span><blockquote><p>${esc(ep[0])}</p>${ep[1] ? `<p class="book-epigraph-latin" lang="la">${esc(ep[1])}</p>` : ""}<footer>—— ${esc(ep[2])}</footer></blockquote></div>` : ""}
    </div>`;
}
function bookSummary() {
  return `<aside class="book-summary" aria-label="资料卡"><p class="book-kicker">Summarium</p><dl>${BOOK_SUMMARY.map(([cn, la, v]) => `<div><dt>${cn}<i lang="la">${la}</i></dt><dd>${v}</dd></div>`).join("")}</dl></aside>`;
}

// A reading location is a source block + UTF-16 offset, independent of page size.
const BOOK_POSITION_KEY = "buga.fengtuzhi.position.v2";
const BOOK_FONT_KEY = "buga.fengtuzhi.fontSize";
let activeBookReader = null;
function bookStored(key) { try { return localStorage.getItem(key); } catch { return null; } }
function bookStore(key, value) { try { localStorage.setItem(key, value); } catch {} }
function bookPosition() { try { return JSON.parse(bookStored(BOOK_POSITION_KEY)) || null; } catch { return null; } }
function bookElement(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// Slice DOM text without flattening emphasis/links or modifying the source manuscript.
function bookSlice(node, start, end) {
  const copy = node.cloneNode(false), walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const texts = []; let text, length = 0;
  while ((text = walker.nextNode())) { texts.push({ node: text, start: length }); length += text.length; }
  if (!texts.length || (start === 0 && end === length)) return node.cloneNode(true);
  const point = offset => {
    const item = texts.find(t => offset <= t.start + t.node.length) || texts.at(-1);
    return [item.node, Math.max(0, Math.min(item.node.length, offset - item.start))];
  };
  const range = document.createRange();
  if (start === 0) range.setStart(node, 0); else range.setStart(...point(start));
  if (end === length) range.setEnd(node, node.childNodes.length); else range.setEnd(...point(end));
  copy.append(range.cloneContents());
  if (start) { copy.removeAttribute("id"); copy.classList.add("reader-continuation"); }
  return copy;
}

async function bookPaginate(sections, measure, height, cancelled = () => false) {
  const pages = [];
  for (const section of sections) {
    let items = [];
    measure.replaceChildren();
    const flush = () => {
      if (items.length) pages.push({ section: section.id, title: section.title, items });
      items = []; measure.replaceChildren();
    };
    for (const block of section.blocks) {
      let offset = 0;
      const length = block.node.textContent.length;
      do {
        if (cancelled()) return null;
        const part = bookSlice(block.node, offset, length);
        measure.append(part);
        const fits = () => measure.scrollHeight <= height + 0.5;
        if (fits()) {
          items.push({ node: part, key: block.key, start: offset, end: length });
          break;
        }
        part.remove();
        const splittable = /^(P|UL|OL|BLOCKQUOTE)$/.test(block.node.tagName) && length > offset;
        const available = height - measure.getBoundingClientRect().height;
        if (!splittable || (items.length && available < 80)) {
          if (items.length) { flush(); continue; }
          // Oversize figures/tables remain accessible in very short viewports.
          part.classList.add("reader-oversized");
          measure.append(part); items.push({ node: part, key: block.key, start: offset, end: length });
          break;
        }
        let lo = offset, hi = length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2), candidate = bookSlice(block.node, offset, mid);
          measure.append(candidate);
          const ok = fits(); candidate.remove();
          if (ok) lo = mid; else hi = mid - 1;
        }
        if (lo === offset) {
          if (items.length) { flush(); continue; }
          part.classList.add("reader-oversized");
          items.push({ node: part, key: block.key, start: offset, end: length }); break;
        }
        // Avoid cutting surrogate pairs, opening punctuation, and Latin words.
        const plain = block.node.textContent;
        if (/[\uD800-\uDBFF]/.test(plain[lo - 1])) lo--;
        while (lo > offset + 1 && /[（《「『“‘〈【]/.test(plain[lo - 1])) lo--;
        if (/[A-Za-z]/.test(plain[lo - 1]) && /[A-Za-z]/.test(plain[lo])) {
          const word = plain.slice(offset, lo).match(/[A-Za-z]+$/)?.[0];
          if (word && word.length < 24 && lo - word.length > offset) lo -= word.length;
        }
        // Move a little text to the following page to avoid a one-line tail.
        const charsPerLine = Math.floor(measure.clientWidth / parseFloat(getComputedStyle(measure).fontSize));
        if (length - lo < charsPerLine && lo - offset > charsPerLine * 3) lo -= charsPerLine;
        if (/[\uD800-\uDBFF]/.test(plain[lo - 1])) lo--;
        while (lo > offset + 1 && /[，。！？；：、）》」』”’〉】]/.test(plain[lo])) lo--;
        const fragment = bookSlice(block.node, offset, lo);
        items.push({ node: fragment, key: block.key, start: offset, end: lo });
        offset = lo; flush();
        if (pages.length % 6 === 0) await new Promise(requestAnimationFrame);
      } while (offset < length);
    }
    flush();
  }
  return pages;
}

function bookSections(chapters, doc) {
  const sections = [];
  const add = (id, title, nodes) => sections.push({ id, title, blocks: nodes.map((node, i) => ({ node, key: `${id}:${i}` })) });
  add("book-title", "书名页", [bookElement(`<div class="reader-title"><p class="book-kicker">白塔档案馆 · 馆藏读物</p><h1 class="book-title"><span class="book-title-latin" lang="la">De<br>Foedere<br>Argenteo</span><span class="book-title-cn">${BOOK_TITLE}</span></h1><p class="book-subtitle" lang="en">${BOOK_SUBTITLE}</p><span class="book-rule"></span><p class="book-byline">克鲁兹帝国 · 圣埃博松学院</p>${bookEmblem()}</div>`)]);
  add("book-contents", "目录", [bookElement('<h2 class="reader-contents-title">目录 <span lang="la">Index</span></h2>'), ...chapters.map(c => bookElement(`<a class="reader-toc-link" href="#/doc/${doc.id}?anchor=${encodeURIComponent(c.id.replace(/^section-/, ""))}"><span>${esc(c.roman)}</span><span>${esc(c.name)}<small lang="en">${esc(c.meta.en || "")}</small></span></a>`))]);
  for (const c of chapters) {
    const header = bookElement(`<header class="reader-chapter" id="${esc(c.id)}"><p class="book-kicker">Capitulum ${esc(c.roman)}</p><h2>${esc(c.name)}</h2><p lang="en">${esc(c.meta.en || "")}</p></header>`);
    const nodes = [header];
    // Keep each member of the Twelve Rings together where space permits.
    for (const source of c.nodes) {
      if (/^(UL|OL)$/.test(source.tagName)) {
        [...source.children].forEach((li, i) => { const list = source.cloneNode(false); if (list.tagName === "OL") list.start = i + 1; list.append(li.cloneNode(true)); nodes.push(list); });
      } else nodes.push(source.cloneNode(true));
    }
    nodes.find(n => n.tagName === "P")?.classList.add("reader-opening");
    add(c.id.replace(/^section-/, ""), c.name, nodes);
  }
  add("book-end", "终页", [bookElement(`<div class="reader-ending"><p class="book-end" lang="la">Finis</p><p class="book-end-cn">全书完</p><span class="book-rule"></span><p>${BOOK_TITLE}</p><a href="#/doc/${doc.id}?anchor=book-contents">回到目录</a><a href="#/home">返回白塔档案馆</a></div>`)]);
  return sections;
}

async function bookDetail(doc, params, serial) {
  const notesDoc = docAt(BOOK_NOTES_PATH);
  const [content, notes] = await Promise.all([bookFetch(doc), notesDoc ? bookFetch(notesDoc).catch(() => null) : null]);
  if (serial !== routeSerial) return;
  const chapters = bookChapters(content.html || "");
  if (!chapters.length) { await prototypeDetail(doc, params, serial); return; }
  const sources = notes ? bookSources(notes.html) : new Map();
  const sections = bookSections(chapters, doc), saved = bookPosition();
  const controller = new AbortController(), { signal } = controller;
  archiveObserver = controller;
  document.title = BOOK_TITLE + " / " + index.title;
  document.body.dataset.bookReader = "true";
  main.dataset.view = "book";
  main.dataset.readerId = doc.id; main.dataset.readerRoute = "doc";
  const siteTitle = document.querySelector(".topbar-title"), previousTitle = siteTitle.textContent;
  const menu = document.querySelector("#menu-toggle"), previousMenu = menu.innerHTML;
  menu.innerHTML = archiveIcon("menu") + "档案馆";
  siteTitle.textContent = BOOK_TITLE;
  archiveNavSync();
  const storedFont = Number(bookStored(BOOK_FONT_KEY));
  let fontSize = storedFont >= 16 && storedFont <= 24 ? storedFont : matchMedia("(max-width:700px)").matches ? 18 : 19;
  let pages = [], current = 0, spreadSize = 2, generation = 0, timer, cursor = saved;
  main.innerHTML = `<section class="reader" aria-label="${BOOK_TITLE}阅读器">
    <nav class="reader-toolbar" aria-label="阅读工具"><button type="button" data-panel="contents">目录</button><span class="reader-chapter-label"></span><button type="button" data-panel="settings" aria-label="字号与阅读设置">字号</button><button type="button" data-panel="sources">来源与编校</button></nav>
    <div class="reader-stage" aria-busy="true"><div class="reader-leaves"></div><p class="reader-loading" role="status">正在排版…</p></div>
    <nav class="reader-controls" aria-label="翻页"><button type="button" data-turn="-1" aria-label="上一页">← <span>上一页</span></button><span class="reader-progress" role="status" aria-live="polite"></span><button type="button" data-turn="1" aria-label="下一页"><span>下一页</span> →</button></nav>
    <dialog class="reader-dialog" aria-labelledby="reader-panel-title"><header><h2 id="reader-panel-title"></h2><button type="button" data-close aria-label="关闭面板">关闭 ×</button></header><div class="reader-panel-body"></div></dialog>
    <div class="reader-measure reader-prose" aria-hidden="true" inert></div>
  </section>`;
  const root = main.querySelector(".reader"), stage = root.querySelector(".reader-stage"), leaves = root.querySelector(".reader-leaves");
  const measure = root.querySelector(".reader-measure"), loading = root.querySelector(".reader-loading");
  const progress = root.querySelector(".reader-progress"), chapterLabel = root.querySelector(".reader-chapter-label");
  const dialog = root.querySelector("dialog"), panelBody = root.querySelector(".reader-panel-body");
  const chapterUrl = slug => `#/doc/${doc.id}?anchor=${encodeURIComponent(slug)}`;
  const startOf = page => {
    const item = page?.items[0];
    return item ? { section: page.section, block: item.key, offset: item.start } : null;
  };
  const locate = position => {
    if (!position) return 0;
    let n = pages.findIndex(p => p.items.some(i => i.key === position.block && i.start <= position.offset && (i.end > position.offset || i.start === i.end)));
    if (n < 0) n = pages.findIndex(p => p.section === position.section);
    return Math.max(0, n);
  };
  const positionFrom = query => {
    if (query.get("resume") === "1") return bookPosition() || { section: bookStored(BOOK_RESUME_KEY) };
    if (!query.has("anchor")) return bookPosition();
    return { section: query.get("anchor"), block: query.get("block"), offset: Number(query.get("offset")) || 0 };
  };
  function show(n, { remember = true, exact = null } = {}) {
    if (!pages.length) return;
    current = Math.floor(Math.max(0, Math.min(pages.length - 1, n)) / spreadSize) * spreadSize;
    const focusedLeaf = document.activeElement.closest?.(".reader-leaf");
    [...leaves.children].forEach((leaf, i) => { leaf.hidden = i < current || i >= current + spreadSize; });
    if (focusedLeaf?.hidden) stage.focus({ preventScroll: true });
    root.querySelector('[data-turn="-1"]').disabled = current === 0;
    root.querySelector('[data-turn="1"]').disabled = current + spreadSize >= pages.length;
    progress.textContent = `${current + 1}${spreadSize === 2 && current + 1 < pages.length ? "—" + (current + 2) : ""} / ${pages.length}`;
    chapterLabel.textContent = [...new Set(pages.slice(current, current + spreadSize).map(p => p.title))].join(" / ");
    stage.setAttribute("aria-label", `第 ${current + 1}${spreadSize === 2 && current + 1 < pages.length ? " 至 " + (current + 2) : ""} 页`);
    cursor = exact || startOf(pages[current]);
    if (remember && cursor) {
      bookStore(BOOK_POSITION_KEY, JSON.stringify(cursor));
      if (chapters.some(c => c.id === "section-" + cursor.section)) bookStore(BOOK_RESUME_KEY, cursor.section);
      const query = new URLSearchParams({ anchor: cursor.section, block: cursor.block || "", offset: String(cursor.offset || 0) });
      history.replaceState(history.state, "", `#/doc/${doc.id}?${query}`);
    }
  }
  const turn = delta => {
    if (stage.getAttribute("aria-busy") === "true" || dialog.open) return;
    const target = current + delta * spreadSize;
    if (target < 0 || target >= pages.length) return;
    show(target);
    if (!matchMedia("(prefers-reduced-motion:reduce)").matches) leaves.animate([{ opacity: .4, transform: `translateX(${delta * 8}px)` }, { opacity: 1, transform: "none" }], { duration: 160, easing: "ease-out" });
  };
  let pending = positionFrom(params);
  async function paginate() {
    const ticket = ++generation, locationBefore = pending || cursor;
    stage.setAttribute("aria-busy", "true"); loading.hidden = false;
    root.style.setProperty("--reader-font", fontSize + "px");
    const width = stage.clientWidth;
    spreadSize = width >= 920 ? 2 : 1;
    root.dataset.spread = String(spreadSize);
    const leafWidth = width / spreadSize, padding = leafWidth < 450 ? 22 : 44;
    root.style.setProperty("--reader-pad", padding + "px");
    const height = stage.clientHeight - 100;
    root.style.setProperty("--reader-height", height + "px");
    measure.style.width = (leafWidth - padding * 2) + "px";
    const next = await bookPaginate(sections, measure, height, () => signal.aborted || ticket !== generation);
    if (!next || signal.aborted || ticket !== generation) return;
    pages = next;
    const fragment = document.createDocumentFragment();
    pages.forEach((page, i) => {
      const leaf = document.createElement("article"); leaf.className = "reader-leaf"; leaf.hidden = true;
      leaf.setAttribute("aria-label", `${page.title} · 第 ${i + 1} 页`);
      leaf.innerHTML = `<header class="reader-running"><span>${esc(page.title)}</span><span lang="la">De Foedere Argenteo</span></header><div class="reader-prose"></div><footer class="reader-folio">${i + 1}</footer>`;
      const prose = leaf.querySelector(".reader-prose");
      for (const item of page.items) {
        const node = item.node.cloneNode(true);
        node.dataset.block = item.key; node.dataset.start = item.start; node.dataset.end = item.end;
        prose.append(node);
      }
      fragment.append(leaf);
    });
    leaves.replaceChildren(fragment);
    const restored = pending || locationBefore;
    show(locate(restored), { exact: restored });
    pending = null;
    loading.hidden = true; stage.setAttribute("aria-busy", "false");
  }
  function navigate(query) {
    const position = positionFrom(query) || { section: "book-title" };
    if (dialog.open) dialog.close();
    if (!pages.length || stage.getAttribute("aria-busy") === "true") { pending = position; return; }
    show(locate(position), { exact: position });
    stage.focus({ preventScroll: true });
  }
  let panelTrigger = null;
  function openPanel(kind, trigger) {
    panelTrigger = trigger;
    const title = root.querySelector("#reader-panel-title");
    if (kind === "contents") {
      title.textContent = "目录";
      panelBody.innerHTML = `<a class="reader-panel-link" href="${chapterUrl("book-title")}">书名页</a>${chapters.map(c => `<a class="reader-panel-link" href="${chapterUrl(c.id.replace(/^section-/, ""))}"><span>${esc(c.roman)}</span>${esc(c.name)}</a>`).join("")}<a class="reader-panel-link" href="${chapterUrl("book-end")}">终页</a>`;
    } else if (kind === "settings") {
      title.textContent = "阅读设置";
      panelBody.innerHTML = `<label class="reader-font-setting">正文字号 <select aria-label="正文字号">${[16,17,18,19,20,21,22,23,24].map(n => `<option value="${n}"${n === fontSize ? " selected" : ""}>${n}</option>`).join("")}</select></label><p>字号与续读位置保存在此浏览器中。窗口或字号改变时，将回到原来的段落附近。</p><a href="#/doc/${doc.id}?view=record">查看完整正文与馆藏著录</a>`;
    } else {
      title.textContent = "来源与编校";
      const visible = pages.slice(current, current + spreadSize);
      const chapterIds = [...new Set(visible.map(p => p.section))];
      const selected = chapters.filter(c => chapterIds.includes(c.id.replace(/^section-/, "")));
      panelBody.innerHTML = `<p>本书是馆藏读物，所述制度以现行法典为准。以下是正文所据的来源与编校记录。</p>${selected.map(c => `<section class="reader-source"><h3>${esc(c.label)}</h3><p>${sources.get(c.label) || "请查阅完整编者材料。"}</p></section>`).join("")}<nav class="reader-source-links">${notesDoc ? linkDoc(notesDoc.id, "完整编者材料") : ""}<a href="#/doc/${doc.id}?view=record">馆藏著录与完整正文</a></nav>`;
    }
    dialog.showModal();
  }
  root.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (button?.hasAttribute("data-turn")) turn(Number(button.dataset.turn));
    else if (button?.dataset.panel) openPanel(button.dataset.panel, button);
    else if (button?.hasAttribute("data-close")) dialog.close();
    const link = event.target.closest("a[href]");
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      const hash = link.getAttribute("href");
      if (hash.startsWith(`#/doc/${doc.id}?anchor=`)) {
        event.preventDefault();
        navigate(new URLSearchParams(hash.split("?")[1]));
      }
    }
  }, { signal });
  dialog.addEventListener("close", () => panelTrigger?.focus({ preventScroll: true }), { signal });
  panelBody.addEventListener("change", event => {
    if (event.target.matches("select")) { fontSize = Number(event.target.value); bookStore(BOOK_FONT_KEY, String(fontSize)); schedule(); }
  }, { signal });
  document.addEventListener("keydown", event => {
    if (dialog.open || document.querySelector("#sidebar.open") || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest?.("input,textarea,select,[contenteditable]")) return;
    if (["ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(event.key)) {
      event.preventDefault(); turn(["ArrowLeft", "PageUp"].includes(event.key) ? -1 : 1);
    }
  }, { signal });
  let touch = null;
  stage.tabIndex = -1;
  stage.addEventListener("touchstart", event => {
    touch = event.touches.length === 1 && !event.target.closest("a,button,.reader-oversized") ? { x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now() } : null;
  }, { passive: true, signal });
  stage.addEventListener("touchend", event => {
    if (!touch || !event.changedTouches.length || !getSelection().isCollapsed) return;
    const dx = event.changedTouches[0].clientX - touch.x, dy = event.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - touch.time < 700) turn(dx < 0 ? 1 : -1);
    touch = null;
  }, { passive: true, signal });
  stage.addEventListener("click", event => {
    if (event.target.closest("a,button") || !getSelection().isCollapsed) return;
    const box = stage.getBoundingClientRect(), x = event.clientX - box.left;
    if (x < 22) turn(-1); else if (x > box.width - 22) turn(1);
  }, { signal });
  function schedule() { clearTimeout(timer); timer = setTimeout(() => paginate().catch(failed), 120); }
  function failed(error) {
    if (signal.aborted) return;
    loading.hidden = false;
    loading.innerHTML = `分页暂未完成。<a href="#/doc/${doc.id}?view=record">打开完整正文</a>`;
    stage.setAttribute("aria-busy", "false"); console.error(error);
  }
  let previousSize = "";
  const observer = new ResizeObserver(() => {
    const size = `${stage.clientWidth}:${stage.clientHeight}`;
    if (size !== previousSize) { previousSize = size; schedule(); }
  });
  activeBookReader = {
    docId: doc.id, navigate,
    destroy() {
      controller.abort(); observer.disconnect(); clearTimeout(timer); generation++;
      if (dialog.open) dialog.close();
      delete document.body.dataset.bookReader; siteTitle.textContent = previousTitle; menu.innerHTML = previousMenu;
      activeBookReader = null;
    }
  };
  try {
    await Promise.all([document.fonts.load('19px "Archive Song"'), document.fonts.load('19px "Archive Sans"'), document.fonts.load('50px "Book Latin"'), document.fonts.load('14px "Book Label"')]);
    if (signal.aborted) return;
    await paginate();
    if (signal.aborted) return;
    previousSize = `${stage.clientWidth}:${stage.clientHeight}`; observer.observe(stage);
  } catch (error) { failed(error); }
}
