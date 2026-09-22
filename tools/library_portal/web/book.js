"use strict";

// 《银色联盟风土志》：馆藏读物的对开阅读视图。只改变呈现，正文与编者材料仍来自原文件。
const BOOK_TITLE = "银色联盟风土志";
const BOOK_NOTES_PATH = "07_WORLD_GUIDE/银色联盟风土志_编者材料.md";
const BOOK_NUMERALS = { 一: "壹", 二: "贰", 三: "叁", 四: "肆", 五: "伍", 六: "陆", 七: "柒", 八: "捌", 九: "玖", 十: "拾" };
const BOOK_RESUME_KEY = "buga.fengtuzhi.lastChapter";

// 续读位置只存在本机浏览器；读不到时页面照常显示。
function bookResume(list) {
  let slug;
  try { slug = localStorage.getItem(BOOK_RESUME_KEY); } catch { return null; }
  const item = slug && list.find(h => (h.slug || h.id.replace(/^section-/, "")) === slug);
  if (!item) return null;
  const [, num, name] = item.label.match(/^([一二三四五六七八九十]+)、(.+)$/) || [];
  return { slug, label: num ? `第${num}章　${name}` : item.label };
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
      chapters.push({ id: node.id, label: node.textContent, num, name, nodes: [] });
    } else if (chapters.length) chapters.at(-1).nodes.push(node);
  }
  return chapters;
}
// 编者材料“各章来源”一节：<li><strong>一、天上的国度</strong>：链接……</li>
function bookSources(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html").body, map = new Map();
  for (const li of parsed.querySelectorAll("li")) {
    const label = li.querySelector("strong")?.textContent.trim();
    if (!label || !/^[一二三四五六七八九十]+、/.test(label)) continue;
    const clone = li.cloneNode(true);
    clone.querySelector("strong").remove();
    map.set(label, clone.innerHTML.replace(/^\s*[：:]\s*/, ""));
  }
  return map;
}
function bookFirstSentence(chapter) {
  const text = chapter.nodes.find(n => n.tagName === "P")?.textContent || "";
  const sentence = text.match(/^.*?[。；]/)?.[0] || text;
  return sentence.length > 46 ? sentence.slice(0, 44) + "……" : sentence;
}
function bookBody(chapter) {
  const nodes = chapter.nodes.map(n => n.cloneNode(true));
  const first = nodes.find(n => n.tagName === "P");
  if (first) {
    first.classList.add("book-opening");
    const walker = document.createTreeWalker(first, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode();
    if (text && text.data.trim()) {
      const lead = text.data.trimStart(), cap = document.createElement("span");
      cap.className = "book-initial"; cap.setAttribute("aria-hidden", "true"); cap.textContent = lead[0];
      const rest = document.createTextNode(lead.slice(1));
      const spoken = document.createElement("span"); spoken.className = "sr-only"; spoken.textContent = lead[0];
      text.replaceWith(cap, spoken, rest);
    }
  }
  return nodes.map(n => n.outerHTML).join("");
}
async function bookDetail(doc, params, serial) {
  const notesDoc = docAt(BOOK_NOTES_PATH);
  const [content, notes] = await Promise.all([bookFetch(doc), notesDoc ? bookFetch(notesDoc).catch(() => null) : null]);
  if (serial !== routeSerial) return;
  const chapters = bookChapters(content.html || ""), sources = notes ? bookSources(notes.html) : new Map();
  if (!chapters.length) { await prototypeDetail(doc, params, serial); return; }
  document.title = BOOK_TITLE + " / " + index.title;
  main.dataset.view = "book";
  main.dataset.readerId = doc.id; main.dataset.readerRoute = "doc";
  const anchor = c => `#/doc/${doc.id}?anchor=${encodeURIComponent(c.id.replace(/^section-/, ""))}`;
  const record = `#/doc/${doc.id}?view=record`;
  const resume = bookResume(chapters);
  const contents = chapters.map(c => `<li><a href="${anchor(c)}"><span class="book-toc-num">${esc(BOOK_NUMERALS[c.num] || c.num)}</span><span class="book-toc-name">${esc(c.name)}</span><span class="book-toc-leader" aria-hidden="true"></span><span class="book-toc-ord">第${esc(c.num)}章</span></a><p>${esc(bookFirstSentence(c))}</p></li>`).join("");
  const spreads = chapters.map((c, i) => `<section class="book-spread book-chapter" aria-labelledby="${esc(c.id)}">
    <div class="book-page book-verso"><div class="book-verso-inner">
      <p class="book-chapter-ord">第${esc(c.num)}章</p>
      <span class="book-numeral" aria-hidden="true">${esc(BOOK_NUMERALS[c.num] || c.num)}</span>
      <h2 id="${esc(c.id)}" class="book-chapter-title">${esc(c.name)}</h2>
      <span class="book-rule" aria-hidden="true"></span>
      ${sources.has(c.label) ? `<aside class="book-marginalia" aria-label="馆员批注：${esc(c.name)}所据文献"><p class="book-marginalia-head">馆员批注 · 本章所据</p><p>${sources.get(c.label)}</p></aside>` : ""}
      <nav class="book-turn" aria-label="翻阅">${i ? `<a href="${anchor(chapters[i - 1])}">← ${esc(chapters[i - 1].name)}</a>` : `<a href="#/doc/${doc.id}?anchor=book-contents">← 目录</a>`}${i < chapters.length - 1 ? `<a href="${anchor(chapters[i + 1])}">${esc(chapters[i + 1].name)} →</a>` : ""}</nav>
    </div></div>
    <div class="book-page book-recto">
      <header class="book-running-head" aria-hidden="true"><span>${BOOK_TITLE}</span><span>第${esc(c.num)}章　${esc(c.name)}</span></header>
      <div class="book-text">${bookBody(c)}</div>
      <p class="book-folio" aria-hidden="true">${esc(BOOK_NUMERALS[c.num] || c.num)}</p>
    </div>
  </section>`).join("");
  main.innerHTML = `<nav class="document-breadcrumb" aria-label="面包屑">${archiveReturnToResults()}<a href="#/home">档案馆</a><span>/</span><a href="${browseUrl({ collection: doc.collection })}">馆藏读物</a><span>/</span><span>${BOOK_TITLE}</span></nav>
  <div class="book-shelfmark">
    <p><span class="book-shelf-badge">馆藏读物</span>克鲁兹帝国圣埃博松学院一位学者对银色联盟的记述。本书不是法典，所述制度以现行法典为准；页边的馆员批注列出每章所据文献。</p>
    <nav aria-label="馆藏著录"><a href="${record}">馆藏著录</a>${notesDoc ? linkDoc(notesDoc.id, "编者材料") : ""}</nav>
  </div>
  <article class="book" aria-label="${BOOK_TITLE}">
    <nav class="book-thumbs" aria-label="书口索引"><ol>${chapters.map(c => `<li><a href="${anchor(c)}" title="第${esc(c.num)}章　${esc(c.name)}"><span aria-hidden="true">${esc(BOOK_NUMERALS[c.num] || c.num)}</span><span class="sr-only">第${esc(c.num)}章　${esc(c.name)}</span></a></li>`).join("")}</ol></nav>
    <section class="book-spread book-front" aria-label="扉页与目录">
      <span class="book-ribbon" aria-hidden="true"></span>
      <div class="book-page book-verso book-titlepage">
        <p class="book-imprint">克鲁兹帝国　圣埃博松学院</p>
        <div class="book-title-block">
          <h1 class="book-title">${BOOK_TITLE}</h1>
          <p class="book-author">著者姓名待定　著</p>
        </div>
        <div class="book-seal" role="img" aria-label="朱印：白塔档案馆藏"><span>白塔</span><span>馆藏</span></div>
      </div>
      <div class="book-page book-recto book-contents" id="section-book-contents" tabindex="-1">
        <h2 class="book-contents-title">目　录</h2>
        ${resume ? `<p class="book-resume"><a href="#/doc/${doc.id}?anchor=${encodeURIComponent(resume.slug)}">上次读到 · ${esc(resume.label)} →</a></p>` : ""}
        <ol class="book-toc">
          <li class="book-toc-pending"><span class="book-toc-num">序</span><span class="book-toc-name">图拉曼·秘银·奥瑟坦</span><span class="book-toc-leader" aria-hidden="true"></span><span class="book-toc-ord">待撰</span></li>
          ${contents}
        </ol>
      </div>
    </section>
    ${spreads}
    <section class="book-spread book-colophon" aria-label="版权页">
      <div class="book-page book-verso"><p class="book-end">全书完</p></div>
      <div class="book-page book-recto"><dl>
        <div><dt>书名</dt><dd>${BOOK_TITLE}</dd></div>
        <div><dt>著者</dt><dd>克鲁兹帝国圣埃博松学院学者（姓名待定）</dd></div>
        <div><dt>序</dt><dd>图拉曼·秘银·奥瑟坦（待撰）</dd></div>
        <div><dt>入藏</dt><dd>白塔档案馆 · 馆藏读物</dd></div>
        <div><dt>底本</dt><dd>${linkDoc(doc.id, doc.path.split("/").pop())}</dd></div>
      </dl></div>
    </section>
  </article>`;
  bookFollow(chapters, anchor);
  const target = params.get("anchor") && document.getElementById("section-" + params.get("anchor"));
  if (target) requestAnimationFrame(() => { target.scrollIntoView(); target.tabIndex = -1; target.focus({ preventScroll: true }); });
}
// 随阅读位置标出书口索引的当前章，并记下续读位置；← → 翻到上一章、下一章。
function bookFollow(chapters, anchor) {
  const spreads = [...main.querySelectorAll(".book-chapter")], thumbs = [...main.querySelectorAll(".book-thumbs a")];
  archiveObserver = new AbortController();
  const signal = archiveObserver.signal;
  let current = -2, scheduled = false;
  const update = () => {
    scheduled = false;
    let index = -1;
    for (const [i, spread] of spreads.entries()) { if (spread.getBoundingClientRect().top > innerHeight * 0.4) break; index = i; }
    if (index === current) return;
    current = index;
    thumbs.forEach((a, i) => { if (i === index) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    if (index >= 0) bookRemember(chapters[index]);
  };
  window.addEventListener("scroll", () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }, { passive: true, signal });
  document.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest?.("input,textarea,select,[contenteditable],.table-wrap")) return;
    const next = current + (event.key === "ArrowRight" ? 1 : -1);
    if (next < -1 || next >= chapters.length) return;
    event.preventDefault();
    location.hash = next === -1 ? `/doc/${main.dataset.readerId}?anchor=book-contents` : anchor(chapters[next]).slice(1);
  }, { signal });
  update();
}
