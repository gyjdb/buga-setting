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

// 洞察之眼（光冠版，2026-09-22 定稿）：放射光刃之下的眼睛，悬于海浪之上。源文件在 plates-src/emblem/final。
function bookEmblem(label = "洞察之眼") {
  return `<svg class="book-emblem" viewBox="-100 -104 200 192" role="img" aria-label="${label}"><path fill="currentColor" d="M-71.31 -32.48L-95.39 -39.08L-77.64 -21.52ZM-55.68 -41.65L-81.89 -57.6L-65.94 -31.4ZM-35.93 -47.92L-61.04 -75.08L-50.07 -39.75ZM-13.48 -50.78L-33.34 -89.8L-31.03 -46.08ZM10 -50L0 -100L-10 -50ZM31.03 -46.08L33.34 -89.8L13.48 -50.78ZM50.07 -39.75L61.04 -75.08L35.93 -47.92ZM65.94 -31.4L81.89 -57.6L55.68 -41.65ZM77.64 -21.52L95.39 -39.08L71.31 -32.48ZM-79 0Q0 -68 79 0Q0 -30 -79 0ZM-79 0Q0 56 79 0Q0 32 -79 0Z"/><path fill="currentColor" fill-rule="evenodd" d="M-18 0a18 18 0 1 0 36 0a18 18 0 1 0 -36 0ZM-11.16 -0.9A12.6 12.6 0 0 1 0.9 -11.88A17.1 17.1 0 0 0 -11.16 -0.9Z"/><path class="book-emblem-sea" d="M-66 56Q-52.14 56 -49.5 45Q-46.86 56 -33 56Q-19.14 56 -16.5 45Q-13.86 56 0 56Q13.86 56 16.5 45Q19.14 56 33 56Q46.86 56 49.5 45Q52.14 56 66 56L66 64Q52.14 64 49.5 57.95Q46.86 64 33 64Q19.14 64 16.5 57.95Q13.86 64 0 64Q-13.86 64 -16.5 57.95Q-19.14 64 -33 64Q-46.86 64 -49.5 57.95Q-52.14 64 -66 64ZM-42 77Q-30.24 77 -28 68Q-25.76 77 -14 77Q-2.24 77 0 68Q2.24 77 14 77Q25.76 77 28 68Q30.24 77 42 77L42 84Q30.24 84 28 79.05Q25.76 84 14 84Q2.24 84 0 79.05Q-2.24 84 -14 84Q-25.76 84 -28 79.05Q-30.24 84 -42 84Z"/></svg>`;
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

// 封面与书名页（2026-09-24 作者选定封面 C：档案馆藏本）。按 210 × 299.5 的纸面设计，book.css 的 .fz-page
// 以容器宽度为单位等比缩放，首页书架、阅读器与排版样张共用。只用已定的文字：书名、副题、竖排三词、
// 作者（罗恩·萨米利安，外文拼法见编者材料第十节）、作序者 Turaman；拉丁标签只管结构（FA29–FA32）。
const BOOK_AUTHOR = ["罗恩·萨米利安", "Ron Samilian"], BOOK_COLLEGE = ["克鲁兹帝国 · 圣埃博松学院", "St. Ebosson College · Empire of Kruz"];
const BOOK_ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
let bookStampCount = 0;
// 晨光级的日轮纹：第二章写晨光级馆藏“封面左上角镌着一枚暖白色的日轮纹”；本书是 Aurēa 公开读物。
function bookSun(label = "日轮纹") {
  const rays = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${(20 + 10.5 * Math.cos(a)).toFixed(1)}" y1="${(20 + 10.5 * Math.sin(a)).toFixed(1)}" x2="${(20 + 14.5 * Math.cos(a)).toFixed(1)}" y2="${(20 + 14.5 * Math.sin(a)).toFixed(1)}"/>`; }).join("");
  return `<svg class="fz-sun" viewBox="0 0 40 40" role="img" aria-label="${label}"><circle cx="20" cy="20" r="7.5" fill="#f7efda" stroke="#c4a15f" stroke-width="1.2"/><g stroke="#c4a15f" stroke-width="1.2" stroke-linecap="round">${rays}</g></svg>`;
}
// 拉丁馆藏章（编者材料第十节）：环上 ARCHIVUM · TURRIS · ALBAE · AURĒA，中间是洞察之眼。
function bookStamp() {
  const id = "fz-stamp-" + (++bookStampCount);
  const eye = bookEmblem("").replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg class="fz-stamp" viewBox="0 0 100 100" role="img" aria-label="馆藏章：Archivum Turris Albae · Aurēa"><defs><path id="${id}" d="M50 50m-36.5 0a36.5 36.5 0 1 1 73 0a36.5 36.5 0 1 1 -73 0"/></defs><circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="50" cy="50" r="44.4" fill="none" stroke="currentColor" stroke-width=".6"/><circle cx="50" cy="50" r="28.5" fill="none" stroke="currentColor" stroke-width=".9"/><text class="fz-stamp-text"><textPath href="#${id}" textLength="227" lengthAdjust="spacing">ARCHIVUM · TURRIS · ALBAE · AURĒA ·</textPath></text><g transform="translate(50 51.5) scale(.2)">${eye}</g></svg>`;
}
function bookCoverHTML() {
  return `<div class="fz-page fz-cover" role="img" aria-label="${BOOK_TITLE}封面">
    <div class="fz-spine" aria-hidden="true"></div>
    <div class="fz-emboss" aria-hidden="true">${bookEmblem("")}</div>
    ${bookSun("晨光级的日轮纹")}
    <p class="fz-kicker">Archivum Turris Albae</p>
    <p class="fz-latin" lang="la">De Foedere<br>Argenteo</p>
    <p class="fz-cn">${BOOK_TITLE}</p>
    <p class="fz-sub" lang="en">${BOOK_SUBTITLE}</p>
    <span class="fz-rule"></span>
    <p class="fz-author"><span lang="en">${BOOK_AUTHOR[1]}</span><small>${BOOK_AUTHOR[0]}</small></p>
    <p class="fz-pref" lang="la">Praefatio · Turaman</p>
    <p class="fz-vert" lang="la">Mores · Urbes · Leges</p>
    <div class="fz-tabs" aria-hidden="true">${BOOK_ROMANS.map(r => `<span>${r}</span>`).join("")}</div>
    <div class="fz-label"><p class="fz-label-t"><span>DFA</span><i lang="la">Archivum Turris Albae</i></p><p class="fz-label-m">${BOOK_TITLE}</p><p class="fz-label-n" lang="la"><span>Capitula I–IX</span><span>Gradus <b>Aurēa</b></span></p></div>
    ${bookStamp()}
  </div>`;
}
function bookTitleHTML() {
  return `<div class="fz-page fz-title">
    <p class="fz-kicker">Archivum Turris Albae</p>
    <h1 class="fz-latin" lang="la">De<br>Foedere<br>Argenteo</h1>
    <p class="fz-vert" lang="la">Mores · Urbes · Leges</p>
    <p class="fz-cn">${BOOK_TITLE}</p>
    <p class="fz-sub" lang="en">${BOOK_SUBTITLE}</p>
    <span class="fz-rule"></span>
    <dl class="fz-credits">
      <div><dt lang="la">Auctor</dt><dd><span lang="en">${BOOK_AUTHOR[1]}</span><small lang="en">${BOOK_COLLEGE[1]}</small><small class="fz-cn-note">${BOOK_AUTHOR[0]} · ${BOOK_COLLEGE[0]}</small></dd></div>
      <div><dt lang="la">Praefatio</dt><dd><span lang="en">Turaman</span><small class="fz-cn-note">图拉曼·秘银·奥瑟坦</small></dd></div>
      <div><dt lang="la">Capitula</dt><dd><span>I – IX</span></dd></div>
      <div><dt lang="la">Gradus</dt><dd><span class="fz-circled" lang="la">Aurēa</span></dd></div>
    </dl>
    <div class="fz-device">${bookEmblem("洞察之眼")}</div>
    ${bookStamp()}
  </div>`;
}

// 衬页：蓝色纸面上一排排小的洞察之眼，贴一张档案馆的藏书票（Ex libris；拉丁文只管结构）。
function bookEndpaperHTML() {
  const id = "fz-pat-" + (++bookStampCount);
  const eye = bookEmblem("").replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<div class="fz-page fz-endpaper" aria-hidden="true">
    <svg class="fz-pattern" viewBox="0 0 210 299.5" preserveAspectRatio="none"><defs><pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse"><g transform="translate(6.5 6.5) scale(.055)">${eye}</g><g transform="translate(19.5 19.5) scale(.055)">${eye}</g></pattern></defs><rect width="210" height="299.5" fill="url(#${id})"/></svg>
    <div class="fz-plate"><p class="fz-plate-ex" lang="la">Ex libris</p><div class="fz-plate-emb">${bookEmblem("")}</div><p class="fz-plate-name" lang="la">Archivum Turris Albae</p><span class="fz-plate-rule"></span><p class="fz-plate-n" lang="la"><span>DFA</span><span>Gradus Aurēa</span></p></div>
  </div>`;
}

// A reading location is a source block + UTF-16 offset, independent of page size.
const BOOK_POSITION_KEY = "buga.fengtuzhi.position.v2";
// Desktop reader keeps the archive sidebar docked; readers may collapse it (open/closed).
const BOOK_NAV_KEY = "buga.fengtuzhi.nav";
// Supplied Terra reference pages are approximately 1380 x 1968; no physical trim size is inferred.
const BOOK_PAPER_RATIO = 1380 / 1968;
// Body text is always 15 CSS px. The page is sized to the window instead of scaling the type:
// it fills the available height up to the standard 690 x 984 page, and only a very small
// window scales a minimum-size page down.
const BOOK_PAGE_MAX = 690, BOOK_PAGE_MIN = 340, BOOK_SPREAD_MIN = 420;
function bookPaperLayout(width, height) {
  const tall = Math.min(BOOK_PAGE_MAX, height * BOOK_PAPER_RATIO);
  const spread = width >= 2 * Math.min(tall, BOOK_SPREAD_MIN) ? 2 : 1;
  const fits = Math.min(tall, width / spread);
  // Whole 4 px steps keep small window changes from re-paginating the book.
  const pageWidth = Math.max(BOOK_PAGE_MIN, Math.floor(fits / 4) * 4);
  const pageHeight = Math.floor(pageWidth / BOOK_PAPER_RATIO);
  const scale = Math.min(1, fits / pageWidth);
  return { spread, pageWidth, pageHeight, scale, width: Math.floor(pageWidth * spread * scale), height: Math.floor(pageHeight * scale) };
}
let activeBookReader = null;
function bookStored(key) { try { return localStorage.getItem(key); } catch { return null; } }
function bookStore(key, value) { try { localStorage.setItem(key, value); } catch {} }
function bookNavDocked() { return !!document.body.dataset.bookReader && !matchMedia("(max-width:780px)").matches; }
function bookToggleNav() {
  document.body.dataset.bookNav = document.body.dataset.bookNav === "closed" ? "open" : "closed";
  bookStore(BOOK_NAV_KEY, document.body.dataset.bookNav);
  archiveNavSync();
}
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
      // A section heading never ends a page: carry it over with the paragraph it introduces.
      const carry = items.length > 1 && /^H[34]$/.test(items.at(-1).node.tagName) ? items.pop() : null;
      if (items.length) pages.push({ section: section.id, title: section.title, items });
      items = []; measure.replaceChildren();
      if (carry) { measure.append(carry.node); items.push(carry); }
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

// 书页版（book-pages.js，实体页面 210 × 299.5 mm、正文 10pt）整页缩放显示；缩放后正文小于 8px（缩放比 0.6）时
// 默认改用文字版。读者可以在顶栏手动选择；缩放比低于 0.5（手机）只有文字版。
const BOOK_MODE_KEY = "buga.fengtuzhi.mode";
const BOOK_FIXED_AUTO = 0.6, BOOK_FIXED_FLOOR = 0.5;
// 书页版放大：0 为适合窗口，否则是相对纸本实际大小的比例（1 即 100%，10pt 正文约 13px）。
const BOOK_ZOOM_KEY = "buga.fengtuzhi.zoom", BOOK_ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5];
const BOOK_PREFACE_PATH = "07_WORLD_GUIDE/银色联盟风土志_序.md";

// 文字版的分节：目录、序、九章（章首图、正文、插图与图示）、终页。编号 `${节}:${序号}` 与书页版的 data-block 一致；
// 插图用 `${章}:fig-${编号}`，不占正文序号。
function bookSections(chapters, doc, extra = {}) {
  const { plan, plates, preface } = extra;
  const sections = [];
  const add = (id, title, nodes) => {
    let n = 0;
    sections.push({ id, title, blocks: nodes.map(node => ({ node, key: node.dataset?.bookKey || `${id}:${n++}` })) });
  };
  add("book-contents", "目录", [bookElement('<h2 class="reader-contents-title">目录 <span lang="la">Index</span></h2>'), ...chapters.map(c => bookElement(`<a class="reader-toc-link" href="#/doc/${doc.id}?anchor=${encodeURIComponent(c.id.replace(/^section-/, ""))}"><span>${esc(c.roman)}</span><span>${esc(c.name)}<small lang="en">${esc(c.meta.en || "")}</small></span></a>`))]);
  if (preface?.length) {
    const paras = [...preface], sign = paras.length > 1 && /^图拉曼/.test(paras.at(-1)) ? paras.pop() : "";
    const nodes = [bookElement('<h2 class="reader-preface-title">序 <span lang="la">Praefatio</span></h2>'), ...paras.map((t, i) => { const p = document.createElement("p"); p.className = "reader-preface" + (i ? "" : " salute"); p.textContent = t; return p; })];
    if (sign) nodes.push(bookElement(`<div class="reader-signoff"><p>${esc(sign)}</p><span class="sig"><img src="assets/plates/sign.webp" alt="Turaman" width="614" height="151"></span></div>`));
    add("book-preface", "序", nodes);
  }
  for (const c of chapters) {
    const figures = plan && plates ? BookPages.flowFigures(c, plan, plates) : { plate: null, after: new Map() };
    const m = figures.plate && plates[figures.plate];
    // 题记与书页版章首相同（第二、六章）；放在章首块里，不占正文段落的序号，阅读位置不变。
    const ep = c.meta.epigraph;
    const epigraph = ep ? `<blockquote class="reader-epigraph"><p>${esc(ep[0])}</p>${ep[1] ? `<p lang="la">${esc(ep[1])}</p>` : ""}<footer>—— ${esc(ep[2])}</footer></blockquote>` : "";
    const header = bookElement(`<header class="reader-chapter" id="${esc(c.id)}">${m ? `<img class="reader-chapter-plate" src="assets/plates/${figures.plate}.webp" alt="" width="${m.w}" height="${m.h}">` : ""}<p class="book-kicker">Capitulum ${esc(c.roman)}</p><h2>${esc(c.name)}</h2><p lang="en">${esc(c.meta.en || "")}</p>${epigraph}</header>`);
    const nodes = [header];
    // Keep each member of the Twelve Rings together where space permits.
    c.nodes.forEach((source, si) => {
      if (/^(UL|OL)$/.test(source.tagName)) {
        [...source.children].forEach((li, i) => { const list = source.cloneNode(false); if (list.tagName === "OL") list.start = i + 1; list.append(li.cloneNode(true)); nodes.push(list); });
      } else nodes.push(source.cloneNode(true));
      nodes.push(...(figures.after.get(si) || []));
    });
    nodes.find(n => n.tagName === "P")?.classList.add("reader-opening");
    add(c.id.replace(/^section-/, ""), c.name, nodes);
  }
  add("book-end", "终页", [bookElement(`<div class="reader-ending"><p class="book-end" lang="la">Finis</p><p class="book-end-cn">全书完</p><span class="book-rule"></span><p>${BOOK_TITLE}</p><a href="#/doc/${doc.id}?anchor=book-contents">回到目录</a><a href="#/home">返回白塔档案馆</a></div>`)]);
  return sections;
}

async function bookDetail(doc, params, serial) {
  const notesDoc = docAt(BOOK_NOTES_PATH), prefaceDoc = docAt(BOOK_PREFACE_PATH);
  const optional = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
  const [content, notes, prefaceContent, plan, plates] = await Promise.all([bookFetch(doc), notesDoc ? bookFetch(notesDoc).catch(() => null) : null, prefaceDoc ? bookFetch(prefaceDoc).catch(() => null) : null, optional("book-plan.json"), optional("assets/plates/manifest.json")]);
  if (serial !== routeSerial) return;
  const chapters = bookChapters(content.html || "");
  if (!chapters.length) { await prototypeDetail(doc, params, serial); return; }
  const sources = notes ? bookSources(notes.html) : new Map();
  const preface = BookPages.parsePreface(prefaceContent?.html);
  const sections = bookSections(chapters, doc, { plan, plates, preface }), saved = bookPosition();
  const controller = new AbortController(), { signal } = controller;
  archiveObserver = controller;
  document.title = BOOK_TITLE + " / " + index.title;
  document.body.dataset.bookReader = "true";
  document.body.dataset.bookNav = bookStored(BOOK_NAV_KEY) === "closed" ? "closed" : "open";
  main.dataset.view = "book";
  main.dataset.readerId = doc.id; main.dataset.readerRoute = "doc";
  const siteTitle = document.querySelector(".topbar-title"), previousTitle = siteTitle.textContent;
  const menu = document.querySelector("#menu-toggle"), previousMenu = menu.innerHTML;
  menu.innerHTML = archiveIcon("menu");
  menu.title = "档案馆导航";
  siteTitle.textContent = BOOK_TITLE;
  archiveNavSync();
  let pages = [], current = 0, spreadSize = 2, generation = 0, timer, cursor = saved, layout = "", book = null;
  const icon = d => `<svg class="reader-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  main.innerHTML = `<section class="reader" aria-label="${BOOK_TITLE}阅读器">
    <div class="reader-desk"><button type="button" class="reader-turn" data-turn="-1" aria-label="上一页" title="上一页（←）">${icon("M15 4l-8 8 8 8")}</button><div class="reader-stage" aria-busy="true"><div class="reader-leaves"></div><button type="button" class="reader-curl prev" data-turn="-1" tabindex="-1" aria-hidden="true"></button><button type="button" class="reader-curl next" data-turn="1" tabindex="-1" aria-hidden="true"></button><p class="reader-loading" role="status">正在排版…</p></div><button type="button" class="reader-turn" data-turn="1" aria-label="下一页" title="下一页（→）">${icon("M9 4l8 8-8 8")}</button></div>
    <nav class="reader-controls" aria-label="翻页"><button type="button" data-turn="-1" aria-label="上一页">← <span>上一页</span></button><span class="reader-progress" role="status" aria-live="polite"></span><button type="button" data-turn="1" aria-label="下一页"><span>下一页</span> →</button></nav>
    <dialog class="reader-dialog" aria-labelledby="reader-panel-title"><header><h2 id="reader-panel-title"></h2><button type="button" data-close aria-label="关闭面板">关闭 ×</button></header><div class="reader-panel-body"></div></dialog>
    <div class="reader-measure reader-prose" aria-hidden="true" inert></div>
  </section>`;
  const root = main.querySelector(".reader"), desk = root.querySelector(".reader-desk"), stage = root.querySelector(".reader-stage"), leaves = root.querySelector(".reader-leaves");
  // Book tools sit in the top bar; the sidebar stays the archive's own navigation.
  const entries = [["book-cover", "", "封面"], ["book-title", "", "书名页"], ...(preface ? [["book-preface", "", "序"]] : []), ...chapters.map(c => [c.id.replace(/^section-/, ""), c.roman, c.name]), ["book-end", "", "终页"]];
  const sectionLabel = new Map([["book-contents", "目录"], ["book-sources", "本书所据"], ...entries.map(([slug, roman, name]) => [slug, roman ? `${roman} · ${name}` : name])]);
  const bar = bookElement(`<div class="reader-bar"><div class="reader-toc"><button type="button" class="reader-toc-button" aria-expanded="false" aria-controls="reader-toc-menu"><span class="reader-toc-current">目录</span>${icon("M6 9l6 6 6-6")}</button><div class="reader-toc-menu" id="reader-toc-menu" hidden><p class="reader-toc-heading">本书目录 <span lang="la">Index</span></p><nav aria-label="本书目录">${entries.map(([slug, roman, name]) => `<a data-book-section="${esc(slug)}" href="#/doc/${doc.id}?anchor=${encodeURIComponent(slug)}"><span>${esc(roman)}</span>${esc(name)}</a>`).join("")}</nav><div class="reader-toc-foot"><button type="button" data-panel="sources">来源与编校</button><a href="#/doc/${doc.id}?view=record">完整正文与著录</a></div></div></div><span class="reader-progress" role="status" aria-live="polite"></span><div class="reader-mode" role="group" aria-label="版式" hidden><button type="button" data-mode="book" aria-pressed="false" title="按实体书页排版，带插图与边栏">书页</button><button type="button" data-mode="text" aria-pressed="false" title="按窗口重新排版，字更大">文字</button></div><div class="reader-zoom" role="group" aria-label="书页缩放" hidden><button type="button" data-zoom="-1" aria-label="缩小" title="缩小（−）">${icon("M10.5 17.5a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM15.5 15.5L21 21M7.5 10.5h6")}</button><button type="button" class="reader-zoom-level" data-zoom="0" title="恢复为适合窗口（0）。100% 即纸本实际大小">适合</button><button type="button" data-zoom="1" aria-label="放大" title="放大（+）。也可以按住 Ctrl 滚动滚轮，或双击书页">${icon("M10.5 17.5a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM15.5 15.5L21 21M7.5 10.5h6M10.5 7.5v6")}</button></div><button type="button" class="reader-sources" data-panel="sources">来源与编校</button></div>`);
  siteTitle.after(bar);
  const measure = root.querySelector(".reader-measure"), loading = root.querySelector(".reader-loading");
  const progress = [...root.querySelectorAll(".reader-progress"), bar.querySelector(".reader-progress")];
  const tocButton = bar.querySelector(".reader-toc-button"), tocMenu = bar.querySelector(".reader-toc-menu"), tocCurrent = bar.querySelector(".reader-toc-current");
  const modeGroup = bar.querySelector(".reader-mode");
  const zoomGroup = bar.querySelector(".reader-zoom"), zoomLevel = bar.querySelector(".reader-zoom-level");
  const dialog = root.querySelector("dialog"), panelBody = root.querySelector(".reader-panel-body");
  const startOf = page => {
    const item = page?.items[0];
    return item ? { section: page.section, block: item.key, offset: item.start } : page ? { section: page.section } : null;
  };
  const locate = position => {
    if (!position) return 0;
    let n = position.block ? pages.findIndex(p => p.items.some(i => i.key === position.block && i.start <= position.offset && (i.end > position.offset || i.start === i.end))) : -1;
    if (n < 0) n = pages.findIndex(p => p.section === position.section && !p.void);
    // Section headings inside a chapter keep their own anchors (section-<slug>).
    if (n < 0) n = pages.findIndex(p => p.heads?.includes(position.section) || p.items.some(i => i.node?.id === "section-" + position.section));
    return Math.max(0, n);
  };
  const positionFrom = query => {
    if (query.get("resume") === "1") return bookPosition() || { section: bookStored(BOOK_RESUME_KEY) };
    if (!query.has("anchor")) return bookPosition();
    return { section: query.get("anchor"), block: query.get("block"), offset: Number(query.get("offset")) || 0 };
  };
  function toc(open) {
    tocMenu.hidden = !open;
    tocButton.setAttribute("aria-expanded", String(open));
    if (!open) return;
    const target = tocMenu.querySelector("[aria-current]") || tocMenu.querySelector("a");
    target.scrollIntoView({ block: "nearest" }); target.focus({ preventScroll: true });
  }
  function show(n, { remember = true, exact = null } = {}) {
    if (!pages.length) return;
    current = Math.floor(Math.max(0, Math.min(pages.length - 1, n)) / spreadSize) * spreadSize;
    const focusedLeaf = document.activeElement.closest?.(".reader-leaf");
    [...leaves.children].forEach((leaf, i) => { leaf.hidden = i < current || i >= current + spreadSize; });
    if (focusedLeaf?.hidden) stage.focus({ preventScroll: true });
    root.querySelectorAll('[data-turn="-1"]').forEach(b => { b.disabled = current === 0; });
    root.querySelectorAll('[data-turn="1"]').forEach(b => { b.disabled = current + spreadSize >= pages.length; });
    const visible = pages.slice(current, current + spreadSize), shown = new Set(visible.map(p => p.section));
    const range = `${current + 1}${visible.length > 1 ? "–" + (current + visible.length) : ""}`;
    progress.forEach(p => { p.textContent = `${range} / ${pages.length}`; });
    // Name the chapter the spread leads into; the title spread keeps the title page.
    const lead = visible.at(-1);
    stage.classList.toggle("is-closed", visible.some(p => p.void));
    tocCurrent.textContent = sectionLabel.get(lead.section) || lead.title;
    tocMenu.querySelectorAll("[data-book-section]").forEach(a => {
      if (shown.has(a.dataset.bookSection)) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    stage.setAttribute("aria-label", `第 ${range.replace("–", " 至 ")} 页`);
    cursor = exact || startOf(pages[current]);
    if (remember && cursor) rememberPosition();
  }
  function rememberPosition() {
    if (cursor) {
      bookStore(BOOK_POSITION_KEY, JSON.stringify(cursor));
      if (chapters.some(c => c.id === "section-" + cursor.section)) bookStore(BOOK_RESUME_KEY, cursor.section);
      const query = new URLSearchParams({ anchor: cursor.section, block: cursor.block || "", offset: String(cursor.offset || 0) });
      history.replaceState(history.state, "", `#/doc/${doc.id}?${query}`);
    }
  }
  const turn = delta => {
    if (stage.getAttribute("aria-busy") === "true" || dialog.open) return;
    finishFlip();
    const target = current + delta * spreadSize;
    if (target < 0 || target >= pages.length) return;
    toc(false);
    // 放大时书页比台面大，翻页直接换页；减少动态效果时也不播动画。
    if (root.dataset.zoom === "in" || matchMedia("(prefers-reduced-motion:reduce)").matches || !flipTo(delta, target)) {
      show(target);
      if (root.dataset.zoom === "in") stage.scrollTo(0, 0);
    }
  };
  // 翻页：当前一页绕书脊翻过去，正面是这一页、背面是下一页，底下露出下一对开的另一页；翻完才换成下一对开（show）。
  // 用的是书页的副本，放在书页层里（与书页同一比例），翻完即拆。连按时先把正在翻的这一页翻完。
  let flipping = null;
  function finishFlip() { if (flipping) flipping.finish(); }
  function flipTo(delta, target) {
    const leaf = i => leaves.children[i], two = spreadSize === 2, forward = delta > 0;
    const left = leaf(current);
    if (!left || left.hidden) return false;
    const W = left.offsetWidth, H = left.offsetHeight;
    // turning：翻动的那一页；back：它的背面；under：翻开后露出的那一页；x：翻动页所在的位置；spine：书脊在翻动页的哪一边。
    let turning, back = null, under = null, x = left.offsetLeft, spine = "left";
    if (two && forward) { turning = leaf(current + 1); back = leaf(target); under = leaf(target + 1); x += W; }
    else if (two) { turning = left; back = leaf(target + 1); under = leaf(target); spine = "right"; }
    else if (forward) { turning = left; under = leaf(target); }
    else turning = leaf(target);
    if (!turning) return false;
    const copy = source => {
      const c = source.cloneNode(true), cs = getComputedStyle(source);
      c.hidden = false; c.removeAttribute("aria-label");
      c.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
      c.style.setProperty("width", W + "px"); c.style.setProperty("height", H + "px");
      c.style.setProperty("background-color", cs.backgroundColor); c.style.setProperty("background-image", cs.backgroundImage);
      return c;
    };
    const part = (tag, cls, background) => { const n = document.createElement(tag); n.className = cls; if (background) n.style.setProperty("background", background); return n; };
    const place = n => { n.style.setProperty("left", x + "px"); n.style.setProperty("width", W + "px"); n.style.setProperty("height", H + "px"); return n; };
    const shade = side => `linear-gradient(${side === "left" ? 90 : 270}deg, #0000004d, #00000012 38%, #ffffff14)`;
    const overlay = part("div", "reader-flip"); overlay.setAttribute("aria-hidden", "true");
    let cast = null;
    if (under) {
      const u = place(part("div", "flip-under")); u.append(copy(under));
      cast = part("i", "flip-cast", `linear-gradient(${spine === "left" ? 90 : 270}deg, #00000066, #0000 58%)`); u.append(cast);
      overlay.append(u);
    }
    const sheet = place(part("div", "flip-leaf")); sheet.style.setProperty("transform-origin", spine === "left" ? "0 50%" : "100% 50%");
    const front = part("div", "flip-face"), frontShade = part("i", "flip-shade", shade(spine));
    front.append(copy(turning), frontShade); sheet.append(front);
    let backShade = null;
    if (back) { const b = part("div", "flip-face flip-back"); backShade = part("i", "flip-shade", shade(spine === "left" ? "right" : "left")); b.append(copy(back), backShade); sheet.append(b); }
    overlay.append(sheet); leaves.append(overlay);
    stage.classList.add("is-flipping");
    // 合上的封面：往回翻到封面时，台面先透明，免得左边露出纸色。
    if (!forward && pages.slice(target, target + spreadSize).some(p => p.void)) stage.classList.add("is-closed");
    const angle = two ? (spine === "left" ? -180 : 180) : -92;
    const turnFrames = two || forward ? [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${angle}deg)` }] : [{ transform: `rotateY(${angle}deg)` }, { transform: "rotateY(0deg)" }];
    const timing = { duration: two ? 700 : 520, easing: "cubic-bezier(.42,.08,.3,1)", fill: "forwards" };
    const motion = sheet.animate(turnFrames, timing);
    frontShade.animate(two || forward ? [{ opacity: 0 }, { opacity: .7, offset: .5 }, { opacity: .7 }] : [{ opacity: .7 }, { opacity: 0 }], timing);
    backShade?.animate([{ opacity: .7 }, { opacity: .7, offset: .5 }, { opacity: 0 }], timing);
    cast?.animate([{ opacity: 0 }, { opacity: 1, offset: .45 }, { opacity: 0 }], timing);
    let done = false;
    const commit = () => {
      if (done) return;
      done = true; flipping = null;
      motion.cancel(); overlay.remove(); stage.classList.remove("is-flipping");
      show(target);
      if (root.dataset.zoom === "in") stage.scrollTo(0, 0);
    };
    motion.onfinish = commit;
    flipping = { finish: commit };
    return true;
  }
  // 书页版只排一次（页面尺寸固定），之后只随窗口缩放。
  let building = null;
  function buildBook() {
    building ||= (async () => {
      const host = document.createElement("div");
      host.className = "fzb reader-build"; host.setAttribute("aria-hidden", "true"); host.inert = true;
      root.append(host);
      await Promise.all([document.fonts.load('10pt "Archive Song"'), document.fonts.load('900 10pt "Archive Sans"'), document.fonts.load('10pt "Book Latin"'), document.fonts.load('italic 10pt "Book Latin"'), document.fonts.load('10pt "Book Label"'), document.fonts.load('15pt "Hand"', (preface || []).join("") + "白塔馆员")]);
      const result = await BookPages.build({ bookChapters: chapters, plan, plates, sources: BookPages.parseSources(notes?.html), preface, host, cancelled: () => signal.aborted });
      host.remove();
      return result;
    })();
    return building;
  }
  // 书页版放大：整页缩到窗口里字太小时用。放大后书页在台面里滚动或拖动；翻页回到左上角。
  let fit = null, shownScale = 1, zoom = Number(bookStored(BOOK_ZOOM_KEY)) || 0;
  const zoomMax = BOOK_ZOOM_STEPS.at(-1);
  const zoomTarget = () => !fit ? 1 : zoom > fit.scale * 1.02 ? Math.min(zoom, zoomMax) : fit.scale;
  function sizeBook(focus) {
    if (!fit) return;
    const s = zoomTarget(), zoomed = s > fit.scale, pw = BookPages.PAGE_W, ph = BookPages.PAGE_H;
    // 放大前后，焦点（指针位置或视野中心）下的那一点保持不动。
    const before = stage.getBoundingClientRect();
    const fx = focus ? focus.x - before.left : stage.clientWidth / 2, fy = focus ? focus.y - before.top : stage.clientHeight / 2;
    const px = (stage.scrollLeft + fx) / shownScale, py = (stage.scrollTop + fy) / shownScale;
    root.dataset.zoom = zoomed ? "in" : "fit";
    stage.style.width = Math.floor(zoomed ? Math.min(pw * fit.spread * s, fit.W) : pw * fit.spread * s) + "px";
    stage.style.height = Math.floor(zoomed ? Math.min(ph * s, fit.H) : ph * s) + "px";
    leaves.style.transform = `scale(${s})`;
    shownScale = s;
    if (zoomed) {
      const after = stage.getBoundingClientRect();
      stage.scrollLeft = px * s - (focus ? focus.x - after.left : stage.clientWidth / 2);
      stage.scrollTop = py * s - (focus ? focus.y - after.top : stage.clientHeight / 2);
    } else stage.scrollTo(0, 0);
    zoomLevel.textContent = zoomed ? Math.round(s * 100) + "%" : "适合";
    zoomGroup.querySelector('[data-zoom="-1"]').disabled = !zoomed;
    zoomGroup.querySelector('[data-zoom="1"]').disabled = s >= zoomMax - 0.001;
  }
  function setZoom(value, focus) {
    if (!fit) return;
    zoom = value > fit.scale * 1.02 ? Math.min(value, zoomMax) : 0;
    bookStore(BOOK_ZOOM_KEY, String(zoom));
    sizeBook(focus);
  }
  function stepZoom(delta, focus) {
    if (!fit) return;
    const s = zoomTarget();
    if (delta > 0) setZoom(BOOK_ZOOM_STEPS.find(z => z > s * 1.02) ?? zoomMax, focus);
    else setZoom([...BOOK_ZOOM_STEPS].reverse().find(z => z < s * 0.98) ?? 0, focus);
  }
  let pending = positionFrom(params);
  async function paginate() {
    finishFlip();
    const box = getComputedStyle(desk), gap = parseFloat(box.columnGap) || 0;
    const side = [...desk.querySelectorAll(".reader-turn")].reduce((w, b) => w + (b.offsetWidth ? b.offsetWidth + gap : 0), 0);
    const W = Math.max(240, desk.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight) - side);
    const H = Math.max(240, desk.clientHeight - parseFloat(box.paddingTop) - parseFloat(box.paddingBottom));
    // 书页版能不能用、默认用不用。
    const pw = BookPages.PAGE_W, ph = BookPages.PAGE_H;
    const s2 = Math.min(W / (2 * pw), H / ph), s1 = Math.min(W / pw, H / ph), pref = bookStored(BOOK_MODE_KEY);
    const possible = !!(plan && plates) && s1 >= BOOK_FIXED_FLOOR;
    const auto = possible && Math.max(s1, s2) >= BOOK_FIXED_AUTO;
    const fixedMode = possible && (pref === "book" || (pref !== "text" && auto));
    modeGroup.hidden = !possible;
    modeGroup.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.mode === "book") === fixedMode)));
    root.dataset.mode = fixedMode ? "book" : "text";
    zoomGroup.hidden = !fixedMode;
    if (!fixedMode) { fit = null; shownScale = 1; delete root.dataset.zoom; stage.scrollTo(0, 0); }
    if (fixedMode) {
      const spread = s2 >= BOOK_FIXED_AUTO || s2 >= s1 * 0.9 ? 2 : 1, scale = spread === 2 ? s2 : s1;
      fit = { scale, spread, W, H };
      sizeBook();
      const key = "book:" + spread;
      if (key === layout && pages.length) return;
      const ticket = ++generation, locationBefore = pending || cursor;
      stage.setAttribute("aria-busy", "true"); loading.hidden = false;
      book ||= await buildBook();
      if (!book || signal.aborted || ticket !== generation) return;
      spreadSize = spread; layout = key;
      root.dataset.spread = String(spread);
      leaves.classList.add("fzb");
      leaves.style.width = (pw * spread) + "px"; leaves.style.height = ph + "px";
      const fragment = document.createDocumentFragment();
      pages = [];
      book.meta.forEach((m, i) => {
        if (m.void && spread === 1) return;
        const leaf = document.createElement("article"); leaf.className = "reader-leaf reader-fixed" + (m.void ? " reader-void" : ""); leaf.hidden = true;
        leaf.setAttribute("aria-label", `${m.title || ""}${m.folio ? " · " + m.folio : ""}`);
        leaf.append(book.pages[i]);
        fragment.append(leaf);
        pages.push({ section: m.section, title: m.title, items: m.items, heads: m.heads, void: m.void });
      });
      leaves.replaceChildren(fragment);
      const restored = pending || locationBefore;
      show(locate(restored), { exact: restored?.block || restored?.section ? restored : null });
      pending = null;
      loading.hidden = true; stage.setAttribute("aria-busy", "false");
      return;
    }
    const paper = bookPaperLayout(W, H);
    leaves.classList.remove("fzb");
    stage.style.width = paper.width + "px";
    stage.style.height = paper.height + "px";
    leaves.style.transform = paper.scale < 1 ? `scale(${paper.scale})` : "";
    // Same page size: the text flow is unchanged, only the desk around it moved.
    const key = `text:${paper.spread}:${paper.pageWidth}`;
    if (key === layout && pages.length) return;
    const ticket = ++generation, locationBefore = pending || cursor;
    stage.setAttribute("aria-busy", "true"); loading.hidden = false;
    spreadSize = paper.spread;
    root.dataset.spread = String(spreadSize);
    root.dataset.paper = paper.pageWidth < 440 ? "compact" : "standard";
    leaves.style.width = (paper.pageWidth * spreadSize) + "px";
    leaves.style.height = paper.pageHeight + "px";
    const padding = Math.round(Math.min(54, Math.max(24, paper.pageWidth * 0.078)));
    root.style.setProperty("--reader-pad", padding + "px");
    root.style.setProperty("--paper-k", (paper.pageHeight / 984).toFixed(3));
    const height = paper.pageHeight - 105; // 38 padding + 42 running head + 25 folio
    root.style.setProperty("--reader-height", height + "px");
    measure.style.width = (paper.pageWidth - padding * 2) + "px";
    const next = await bookPaginate(sections, measure, height, () => signal.aborted || ticket !== generation);
    if (!next || signal.aborted || ticket !== generation) return;
    // Cover and title page are fixed full-page designs (bookCoverHTML/bookTitleHTML), not flowed text.
    // Like a real book: in a spread the closed cover lies alone on the right; opened, the endpaper faces the title page.
    const fixed = (section, title, special, extra = {}) => ({ section, title, items: [], fixed: true, special, ...extra });
    pages = spreadSize === 2
      ? [fixed("book-cover", "封面", "", { void: true }), fixed("book-cover", "封面", bookCoverHTML()), fixed("book-title", "衬页", bookEndpaperHTML()), fixed("book-title", "书名页", bookTitleHTML()), ...next]
      : [fixed("book-cover", "封面", bookCoverHTML()), fixed("book-title", "书名页", bookTitleHTML()), ...next];
    layout = key;
    const fragment = document.createDocumentFragment();
    pages.forEach((page, i) => {
      const leaf = document.createElement("article"); leaf.className = "reader-leaf"; leaf.hidden = true;
      leaf.setAttribute("aria-label", `${page.title} · 第 ${i + 1} 页`);
      if (page.fixed) { leaf.classList.add(page.void ? "reader-void" : "reader-special"); leaf.innerHTML = page.special; fragment.append(leaf); return; }
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
    finishFlip();
    const position = positionFrom(query) || { section: "book-title" };
    if (dialog.open) dialog.close();
    toc(false);
    if (!pages.length || stage.getAttribute("aria-busy") === "true") { pending = position; return; }
    show(locate(position), { exact: position });
    if (root.dataset.zoom === "in") stage.scrollTo(0, 0);
    if (matchMedia("(max-width:780px)").matches) {
      document.querySelector("#sidebar").classList.remove("open");
      archiveNavSync();
    }
    stage.focus({ preventScroll: true });
  }
  let panelTrigger = null;
  function openPanel(trigger) {
    panelTrigger = trigger.closest(".reader-toc-menu") ? tocButton : trigger;
    toc(false);
    const title = root.querySelector("#reader-panel-title");
    title.textContent = "来源与编校";
    const visible = pages.slice(current, current + spreadSize);
    const chapterIds = [...new Set(visible.map(p => p.section))];
    const selected = chapters.filter(c => chapterIds.includes(c.id.replace(/^section-/, "")));
    panelBody.innerHTML = `<p>本书是馆藏读物，所述制度以现行法典为准。以下是正文所据的来源与编校记录。</p>${selected.map(c => `<section class="reader-source"><h3>${esc(c.label)}</h3><p>${sources.get(c.label) || "请查阅完整编者材料。"}</p></section>`).join("")}<nav class="reader-source-links">${notesDoc ? linkDoc(notesDoc.id, "完整编者材料") : ""}<a href="#/doc/${doc.id}?view=record">馆藏著录与完整正文</a></nav>`;
    dialog.showModal();
  }
  function handleClick(event) {
    const button = event.target.closest("button");
    if (button === tocButton) toc(tocMenu.hidden);
    else if (button?.hasAttribute("data-turn")) turn(Number(button.dataset.turn));
    else if (button?.dataset.panel) openPanel(button);
    else if (button?.hasAttribute("data-close")) dialog.close();
    else if (button?.dataset.zoom) { const d = Number(button.dataset.zoom); if (d) stepZoom(d); else setZoom(0); }
    else if (button?.dataset.mode) { bookStore(BOOK_MODE_KEY, button.dataset.mode); pending = cursor; paginate().catch(failed); }
    const link = event.target.closest("a[href]");
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      const hash = link.getAttribute("href");
      if (hash.startsWith(`#/doc/${doc.id}?anchor=`)) {
        event.preventDefault();
        navigate(new URLSearchParams(hash.split("?")[1]));
      }
    }
  }
  root.addEventListener("click", handleClick, { signal });
  bar.addEventListener("click", handleClick, { signal });
  document.addEventListener("click", event => { if (!tocMenu.hidden && !event.target.closest(".reader-toc")) toc(false); }, { signal });
  dialog.addEventListener("close", () => panelTrigger?.focus({ preventScroll: true }), { signal });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !tocMenu.hidden) { toc(false); tocButton.focus(); return; }
    // 书页版里 + − 0（含 Ctrl/⌘ 组合）缩放书页：整页适合窗口时，浏览器自身的缩放放不大书页。
    const zoomKey = { "+": 1, "=": 1, "-": -1, "_": -1, "0": 0 }[event.key];
    if (fit && zoomKey !== undefined && !dialog.open && tocMenu.hidden && !event.altKey && !event.target.closest?.("input,textarea,select,[contenteditable]")) {
      event.preventDefault(); if (zoomKey) stepZoom(zoomKey); else setZoom(0); return;
    }
    if (dialog.open || !tocMenu.hidden || (document.querySelector("#sidebar.open") && matchMedia("(max-width:780px)").matches) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest?.("input,textarea,select,[contenteditable]")) return;
    if (["ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(event.key)) {
      event.preventDefault(); turn(["ArrowLeft", "PageUp"].includes(event.key) ? -1 : 1);
    }
  }, { signal });
  let touch = null;
  stage.tabIndex = -1;
  stage.addEventListener("touchstart", event => {
    touch = event.touches.length === 1 && root.dataset.zoom !== "in" && !event.target.closest("a,button,.reader-oversized") ? { x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now() } : null;
  }, { passive: true, signal });
  stage.addEventListener("touchend", event => {
    if (!touch || !event.changedTouches.length || !getSelection().isCollapsed) return;
    const dx = event.changedTouches[0].clientX - touch.x, dy = event.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - touch.time < 700) turn(dx < 0 ? 1 : -1);
    touch = null;
  }, { passive: true, signal });
  // 放大后：鼠标拖动平移；Ctrl（⌘）加滚轮或触控板捏合缩放；双击书页放大或还原。
  let drag = null, dragged = false;
  stage.addEventListener("pointerdown", event => {
    dragged = false;
    if (root.dataset.zoom !== "in" || event.pointerType !== "mouse" || event.button !== 0 || event.target.closest("a,button")) return;
    drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop, id: event.pointerId };
  }, { signal });
  stage.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    if (!dragged) { dragged = true; stage.setPointerCapture(drag.id); stage.classList.add("is-dragging"); }
    stage.scrollLeft = drag.left - dx; stage.scrollTop = drag.top - dy;
  }, { signal });
  const endDrag = () => { drag = null; stage.classList.remove("is-dragging"); };
  stage.addEventListener("pointerup", endDrag, { signal });
  stage.addEventListener("pointercancel", endDrag, { signal });
  stage.addEventListener("dragstart", event => { if (root.dataset.zoom === "in") event.preventDefault(); }, { signal });
  desk.addEventListener("wheel", event => {
    if (!fit || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    setZoom(zoomTarget() * Math.min(1.25, Math.max(0.8, Math.exp(-event.deltaY * 0.002))), { x: event.clientX, y: event.clientY });
  }, { passive: false, signal });
  stage.addEventListener("dblclick", event => {
    if (!fit || event.target.closest("a,button")) return;
    getSelection().removeAllRanges();
    if (zoomTarget() > fit.scale) setZoom(0);
    else setZoom(BOOK_ZOOM_STEPS.find(z => z >= Math.max(1, fit.scale * 1.3)) ?? zoomMax, { x: event.clientX, y: event.clientY });
  }, { signal });
  stage.addEventListener("click", event => {
    if (dragged) { dragged = false; return; }
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
    const size = `${desk.clientWidth}:${desk.clientHeight}`;
    if (size !== previousSize) { previousSize = size; schedule(); }
  });
  activeBookReader = {
    docId: doc.id, navigate,
    destroy() {
      controller.abort(); observer.disconnect(); clearTimeout(timer); generation++;
      if (dialog.open) dialog.close();
      bar.remove();
      delete document.body.dataset.bookNav;
      delete document.body.dataset.bookReader; siteTitle.textContent = previousTitle; menu.innerHTML = previousMenu; menu.removeAttribute("title");
      activeBookReader = null;
    }
  };
  try {
    await Promise.all([document.fonts.load('16px "Archive Song"'), document.fonts.load('16px "Archive Sans"'), document.fonts.load('50px "Book Latin"'), document.fonts.load('14px "Book Label"'), document.fonts.load('20px "Hand"', (preface || []).join("")), BookPages.loadNoteFont(chapters, plan, "16px")]);
    if (signal.aborted) return;
    await paginate();
    if (signal.aborted) return;
    previousSize = `${desk.clientWidth}:${desk.clientHeight}`; observer.observe(desk);
  } catch (error) { failed(error); }
}
