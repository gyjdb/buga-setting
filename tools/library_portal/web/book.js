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
  const runningHead = `<header class="book-running-head" aria-hidden="true"><span>${BOOK_TITLE}</span><span lang="la">${BOOK_LATIN}</span></header>`;
  const contents = chapters.map(c => `<li><a href="${anchor(c)}"><span class="book-toc-num">${esc(c.roman)}</span><span class="book-toc-name">${esc(c.name)}</span>${c.meta.en ? `<span class="book-toc-en" lang="en">${esc(c.meta.en)}</span>` : ""}</a></li>`).join("");
  const spreads = chapters.map((c, i) => `<section class="book-spread book-chapter" aria-labelledby="${esc(c.id)}">
    <div class="book-page book-verso"><div class="book-verso-inner">
      <span class="book-folio-side" aria-hidden="true">${esc(c.roman)}</span>
      ${bookOpener(c)}
      ${i === 0 ? bookSummary() : ""}
      ${bookRecord(c, sources)}
      <nav class="book-turn" aria-label="翻阅">${i ? `<a href="${anchor(chapters[i - 1])}"><span lang="la">Capitulum ${esc(chapters[i - 1].roman)}</span>${esc(chapters[i - 1].name)}</a>` : `<a href="#/doc/${doc.id}?anchor=book-contents"><span lang="la">Index</span>目录</a>`}${i < chapters.length - 1 ? `<a href="${anchor(chapters[i + 1])}"><span lang="la">Capitulum ${esc(chapters[i + 1].roman)}</span>${esc(chapters[i + 1].name)}</a>` : ""}</nav>
    </div></div>
    <div class="book-page book-recto">
      ${runningHead}
      <div class="book-recto-body">
        <div class="book-text">${bookBody(c)}</div>
      </div>
      <p class="book-folio" aria-hidden="true">${esc(c.roman)}</p>
      <span class="book-edge" aria-hidden="true" lang="en">Capitulum ${esc(c.roman)} · ${esc(c.meta.en || c.name)}</span>
    </div>
  </section>`).join("");
  main.innerHTML = `<nav class="document-breadcrumb" aria-label="面包屑">${archiveReturnToResults()}<a href="#/home">档案馆</a><span>/</span><a href="${browseUrl({ collection: doc.collection })}">馆藏读物</a><span>/</span><span>${BOOK_TITLE}</span></nav>
  <div class="book-shelfmark">
    <p><span class="book-shelf-badge">馆藏读物 · Aurēa</span>克鲁兹帝国圣埃博松学院一位学者对银色联盟的记述。本书不是法典，所述制度以现行法典为准；每章左页的档案记录纸列出所据文献。</p>
    <nav aria-label="馆藏著录"><a href="${record}">馆藏著录</a>${notesDoc ? linkDoc(notesDoc.id, "编者材料") : ""}</nav>
  </div>
  <article class="book" aria-label="${BOOK_TITLE}">
    <nav class="book-thumbs" aria-label="书口索引"><ol>${chapters.map(c => `<li><a href="${anchor(c)}" title="Capitulum ${esc(c.roman)} · ${esc(c.name)}"><span aria-hidden="true">${esc(c.roman)}</span><span class="sr-only">第${esc(c.num)}章　${esc(c.name)}</span></a></li>`).join("")}</ol></nav>
    <section class="book-spread book-front" aria-label="书名页与目录">
      <span class="book-ribbon" aria-hidden="true"></span>
      <div class="book-page book-verso book-titlepage">
        <span class="book-band" aria-hidden="true"></span>
        <h1 class="book-title"><span class="book-title-latin" lang="la">De<br>Foedere<br>Argenteo</span><span class="book-title-cn">${BOOK_TITLE}</span></h1>
        <p class="book-subtitle" lang="en">${BOOK_SUBTITLE}</p>
        <span class="book-rule" aria-hidden="true"></span>
        <p class="book-byline">克鲁兹帝国 · 圣埃博松学院<br>著者姓名待定　著<br>图拉曼·秘银·奥瑟坦　序</p>
        <p class="book-title-vertical" lang="la" aria-hidden="true">Mores · Urbes · Leges</p>
        ${bookSeal("ARCHIVUM · TURRIS · ALBAE · AURĒA · ", "馆藏章：Archivum Turris Albae")}
      </div>
      <div class="book-page book-recto book-contents" id="section-book-contents" tabindex="-1">
        ${runningHead}
        <div class="book-contents-inner">
          <h2 class="book-contents-title">目录<span lang="la">Index</span></h2>
          ${resume ? `<p class="book-resume"><a href="#/doc/${doc.id}?anchor=${encodeURIComponent(resume.slug)}">上次读到 · ${esc(resume.label)} →</a></p>` : ""}
          <ol class="book-toc">
            <li class="book-toc-pending"><span class="book-toc-num">—</span><span class="book-toc-name">序　图拉曼·秘银·奥瑟坦（待撰）</span><span class="book-toc-en" lang="la">Praefatio</span></li>
            ${contents}
          </ol>
        </div>
      </div>
    </section>
    ${spreads}
    <section class="book-spread book-colophon" aria-label="版权页">
      <div class="book-page book-verso"><p class="book-end" lang="la">Finis</p><p class="book-end-cn">全书完</p></div>
      <div class="book-page book-recto"><dl>
        <div><dt>书名<i lang="la">Titulus</i></dt><dd>${BOOK_TITLE}<span lang="la">${BOOK_LATIN}</span></dd></div>
        <div><dt>著者<i lang="la">Auctor</i></dt><dd>克鲁兹帝国圣埃博松学院学者（姓名待定）</dd></div>
        <div><dt>序<i lang="la">Praefatio</i></dt><dd>图拉曼·秘银·奥瑟坦（待撰）</dd></div>
        <div><dt>入藏<i lang="la">Archivum</i></dt><dd>白塔档案馆 · 馆藏读物 · Aurēa</dd></div>
        <div><dt>底本<i lang="la">Exemplar</i></dt><dd>${linkDoc(doc.id, doc.path.split("/").pop())}</dd></div>
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
