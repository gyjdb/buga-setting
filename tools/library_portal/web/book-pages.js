"use strict";
// 《银色联盟风土志》书页排版：按实体页面（210 × 299.5 mm）排整本书，阅读器的书页版与整书样张共用。
// 正文 10pt、行距 1.95（作者 2026-09-23 选定）。节标题读正文里的三级、四级标题；插图、批注、图示与图注按
// book-plan.json 放置，插图读 assets/plates/（export_plates.mjs 导出）。样式在 book-pages.css，全部限定在 .fzb 之内。
// 依赖 book.js：bookSlice、bookEmblem、bookCoverHTML、bookEndpaperHTML、bookTitleHTML。
// 段落片段标上 data-block / data-start / data-end，编号与阅读器文字版（bookSections）一致，续读位置可以互通。
const BookPages = (() => {
  const MM = 96 / 25.4, PAGE_W = 210 * MM, PAGE_H = 299.5 * MM;
  const PT = 10, LEADING = 1.95;
  const NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const $ = (s, r = document) => r.querySelector(s);
  const el = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fits = box => box.scrollHeight <= box.clientHeight + 0.5;
  const pad3 = n => String(n).padStart(3, "0");
  const roman = n => ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][n] || String(n);
  const slug = id => String(id || "").replace(/^section-/, "");

  // 第一章资料卡：编者材料第十节登记的现行事实。
  const SUMMARY = [["主体民族", "Gens", "布加人（白银之民）"], ["首府", "Caput", "卡奈奇"], ["城邦", "Civitates", "约三十座浮空城"], ["法定货币", "Moneta", "阿根特，一阿根特合一百星"], ["象征", "Signum", "洞察之眼"]];
  // 五级印记：按第二章的文字描述画的示意。
  const SEALS = [
    ["晨光级", "Aurēa", "全体公民；经外务部批准，也可有限度地向地上学者开放", '<circle cx="20" cy="20" r="7.5" fill="#f7efda" stroke="#c4a15f" stroke-width="1.2"/><g stroke="#c4a15f" stroke-width="1.2" stroke-linecap="round">' + Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${(20 + 10.5 * Math.cos(a)).toFixed(1)}" y1="${(20 + 10.5 * Math.sin(a)).toFixed(1)}" x2="${(20 + 14.5 * Math.cos(a)).toFixed(1)}" y2="${(20 + 14.5 * Math.sin(a)).toFixed(1)}"/>`; }).join("") + "</g>"],
    ["薄暮级", "Vesperā", "持有学术资质的公民可以借阅", '<defs><linearGradient id="fzb-silver" x1="0" x2="1"><stop offset="0" stop-color="#e3e7ea"/><stop offset="1" stop-color="#99a4ad"/></linearGradient></defs><path d="M20 5a15 15 0 0 1 0 30Z" fill="url(#fzb-silver)" stroke="#7d8891" stroke-width="1"/><path d="M20 5a15 15 0 0 0 0 30" fill="none" stroke="#b9c1c7" stroke-width=".8" stroke-dasharray="1.6 1.6"/>'],
    ["星辉级", "Stellāra", "只能在专设的星辉密阁中查阅", '<path d="M9 28L20 12L31 28" fill="none" stroke="#1f3f7a" stroke-width="1"/>' + [[9, 28], [20, 12], [31, 28]].map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0-4.6L1.3-1.4L4.6-1.2L2-.8L2.9 3.8L0 1.4L-2.9 3.8L-2-.8L-4.6-1.2L-1.3-1.4Z" fill="#1f3f7a"/>`).join("")],
    ["深渊级", "Abyssāra", "须经馆长批准并另取专门许可，全程有高阶守护者陪同", '<circle cx="20" cy="20" r="14" fill="none" stroke="#17191c" stroke-width="1"/><circle cx="20" cy="20" r="10" fill="none" stroke="#17191c" stroke-width="1.4"/><circle cx="20" cy="20" r="6" fill="#17191c"/>'],
    ["虚无级", "Nihilāra", "没有可见标识；存放在虚无之匣，位置只由历任馆长口传", '<rect x="7" y="7" width="26" height="26" rx="2" fill="none" stroke="#b9bdc0" stroke-width=".8" stroke-dasharray="2 2"/>']
  ];
  // 图示与补充框下的编者小注（旁白字体，noteText 也要读到）。
  const FIGURE_NOTE = "据本章正文整理", SEALS_NOTE = "印记按正文描述绘制，仅为示意。";
  // 十五环：据第三章（学徒、准巫师、大巫师；登塔、执业、执照）与第四章（第十环、权限、弦魔法）整理。
  const RINGS = (() => {
    const cell = n => `<span class="r${n >= 10 ? " high" : ""}${n === 15 ? " gods" : ""}">${n}</span>`;
    const marks = [[3, "可申请登塔"], [4, "执业巫师的门槛"], [10, "分界：此后施法会损伤法力池的上限"], [13, "白银之民豁免损伤至此"], [14, "一般人的终点；不发执照，须经十二环许可"], [15, "属于诸神；只有弦魔法有这一环的术式"]];
    return `<figure class="rings"><div class="kicker">Figura</div><h5>十五环</h5>
      <div class="bands"><span>学徒</span><span>准巫师</span><span>大巫师</span></div>
      <div class="scale">${Array.from({ length: 15 }, (_, i) => cell(i + 1)).join("")}</div>
      <ol class="marks">${marks.map(([n, t]) => `<li><b>${n}</b>${t}</li>`).join("")}</ol>
      <div class="note-s">据第三、四章正文整理；准巫师与大巫师以七环“左右”为界。</div></figure>`;
  })();

  // ---------- 读入 ----------
  // 编者材料第二节“各章来源”：<li><strong>一、天上的国度</strong>：……；……</li>
  function parseSources(html) {
    const map = new Map();
    for (const li of new DOMParser().parseFromString(html || "", "text/html").body.querySelectorAll("li")) {
      const label = li.querySelector("strong")?.textContent.trim() || "";
      const [, num] = label.match(/^([一二三四五六七八九十]+)、/) || [];
      if (!num || map.has(num)) continue;
      const copy = li.cloneNode(true); copy.querySelector("strong").remove();
      map.set(num, copy.textContent.replace(/^\s*[：:]\s*/, "").split(/；/).map(s => s.trim().replace(/。$/, "")).filter(Boolean));
    }
    return map;
  }
  // 序：单独存放的文件（07_WORLD_GUIDE/银色联盟风土志_序.md），一级标题以下的段落；末段是落款。
  function parsePreface(html) {
    const paras = [...new DOMParser().parseFromString(html || "", "text/html").body.children].filter(n => n.tagName === "P").map(n => n.textContent.trim()).filter(Boolean);
    return paras.length ? paras : null;
  }
  // 由 bookChapters（book.js）的结果整理出每章的段落与标题；key 与 bookSections 的编号一致（章首是 0）。
  function prepareChapters(bookChapters, plan) {
    return bookChapters.map(c => {
      const p = plan.chapters.find(x => x.num === c.num);
      if (!p) throw new Error("排版计划里没有第" + c.num + "章");
      const cs = slug(c.id), ch = { ...p, id: c.id, slug: cs, name: c.name, label: c.label, blocks: [], heads: [], warn: [] };
      let ri = 1;
      for (const node of c.nodes) {
        if (/^H[34]$/.test(node.tagName)) ch.heads.push({ at: ch.blocks.length, title: node.textContent.trim(), level: node.tagName === "H3" ? 1 : 2, slug: slug(node.id), key: `${cs}:${ri++}` });
        else if (node.tagName === "P") ch.blocks.push({ kind: "p", node, text: node.textContent, key: `${cs}:${ri++}` });
        else if (/^(UL|OL)$/.test(node.tagName)) for (const li of node.children) {
          const src = li.children.length === 1 && li.firstElementChild.tagName === "P" ? li.firstElementChild : li;
          ch.blocks.push({ kind: "li", node: src, text: src.textContent, key: `${cs}:${ri++}` });
        } else { ch.warn.push("未排入的正文元素 " + node.tagName); ri++; }
      }
      ch.find = prefix => { const i = ch.blocks.findIndex(b => b.text.trim().startsWith(prefix)); if (i < 0) ch.warn.push("找不到段落“" + prefix + "”"); return i; };
      return ch;
    });
  }

  // ---------- 版面组件（阅读器文字版的插图也用这一套） ----------
  function makers(plates) {
    const img = id => { const m = plates[id] || { w: 1, h: 1 }; return `<img src="assets/plates/${id}.webp" alt="" loading="lazy" width="${m.w}" height="${m.h}">`; };
    return {
      img,
      plate: it => el(`<figure class="plt${it.blend ? " blend" : ""}">${img(it.id)}<figcaption>${esc(it.caption)}</figcaption></figure>`),
      note: it => el(`<figure class="note" aria-label="图拉曼的批注">${img(it.id)}</figure>`),
      card: () => el(`<section class="card" aria-label="资料卡"><p class="kicker">Summarium</p><dl>${SUMMARY.map(([cn, la, v]) => `<dt>${cn}<i lang="la">${la}</i></dt><dd>${v}</dd>`).join("")}</dl></section>`),
      figure: it => el(it.what === "vault"
        ? `<figure class="fig"><p class="kicker">Figura</p><h5>白塔的三级封存</h5><div class="vault"><div><b>银封</b>塔内的常规封存层</div><div><b>深封</b>以多重封印隔绝的深层封存库</div><div><b>终封</b>白塔最深处的位面折叠空间；守护法师以个人法则印记封缄，开启须经银色十二环许可</div></div><p class="note-s">${FIGURE_NOTE}</p></figure>`
        : `<figure class="fig"><p class="kicker">Figura</p><h5>白塔的四阶银袍</h5><ol class="ladder"><li><b>守护法师</b><em>大银杖 · 仅一人</em><span>从持杖巫师中选出；能施展十环法术；守护工作二百年以上</span></li><li><b>持杖巫师</b><em>银杖</em><span>服务满一百年；更高一级考核；白银学会高级学术资质</span></li><li><b>银袍法师</b><em>银色长袍</em><span>服务五十年；法则领悟与封印学考核</span></li><li><b>塔卫</b><em>素银短袍</em><span>文库整理、封存库外围安保、陪同初登塔者、塔体巡护</span></li></ol><p class="note-s">${FIGURE_NOTE}</p></figure>`),
      box: () => el(`<section class="supp"><span class="tag">Supplementaria</span><h4>大图书馆的五级馆藏</h4>${SEALS.map(([cn, la, rule, svg]) => `<div class="seal-row"><svg viewBox="0 0 40 40" aria-hidden="true">${svg}</svg><div><b>${cn}</b><i lang="la">${la}</i></div><span>${rule}</span></div>`).join("")}<div class="note-s">${SEALS_NOTE}</div></section>`),
      inline: it => {
        if (!it.id) return el(RINGS);
        const node = el(`<figure class="inline${it.blend ? " blend" : ""}">${img(it.id)}<figcaption>${esc(it.caption)}</figcaption></figure>`);
        node.style.setProperty("--w", (it.width || 112) + "mm");
        return node;
      },
      strip: it => el(`<figure class="strip"><div class="row">${it.ids.map((id, i) => `<div>${img(id)}<span>${esc(it.labels[i])}</span></div>`).join("")}</div><figcaption>${esc(it.caption)}</figcaption></figure>`),
      insert: it => el(`<figure class="sheet" aria-label="图拉曼夹在书里的一页方格纸">${img(it.id)}</figure>`)
    };
  }

  // ---------- 旁白字体 ----------
  // 章首导语（第一个节标题之前的段落）、图注、资料卡说明、题记署名与编者小注用旁白字体（book-note.css 的 "Note"，按字切片）。
  // 排版前先载入这些字，不然会按后备字体测量，字体到位后导语框、侧栏可能溢出。阅读器文字版也调用。
  function noteText(bookChapters, plan) {
    const leads = bookChapters.map(c => { const out = []; for (const n of c.nodes) { if (/^H[34]$/.test(n.tagName)) break; out.push(n.textContent); } return out.join(""); });
    const figures = (plan?.chapters || []).flatMap(p => [...(p.items || []).map(it => it.caption || ""), p.epigraph ? p.epigraph[2] : ""]);
    return [...leads, ...figures, ...SUMMARY.map(s => s[2]), FIGURE_NOTE, SEALS_NOTE, "—"].join("");
  }
  const loadNoteFont = (bookChapters, plan, size = "10pt") => document.fonts.load(`${size} "Note"`, noteText(bookChapters, plan));

  // ---------- 排整本书 ----------
  // host：已挂在文档里、带 .fzb 的容器（排版要实际测量）。返回页面元素与每页的位置信息。
  async function build({ bookChapters, plan, plates, sources, preface, host, cancelled = () => false }) {
    await loadNoteFont(bookChapters, plan);
    const M = makers(plates), chapters = prepareChapters(bookChapters, plan);
    const pages = [], toc = [];
    let prefaceStart = null;
    host.replaceChildren();
    const newPage = (kind, section) => {
      const index = pages.length;
      const page = el(`<article class="page ${index % 2 ? "recto" : "verso"} ${kind}"></article>`);
      page.dataset.section = section; page.occupied = [];
      host.append(page); pages.push(page);
      return page;
    };
    // 书口索引的位置用 data-k 配合 book-pages.css；门户的内容安全策略不允许标记里写 style 属性。
    const thumb = (ch, full) => `<div class="thumb${full ? " full" : ""}" data-k="${NUMS.indexOf(ch.num)}"></div>`;
    const pathText = (ch, verso) => verso ? `Capitulum ${ch.roman}　<i>${esc(ch.name)}</i>` : `Capitulum ${ch.roman} · ${esc(ch.en)}`;
    const head = () => `<div class="rh" aria-hidden="true"><span class="a">银色联盟风土志</span><span class="b">De Foedere Argenteo</span></div>`;
    const bodyPage = ch => {
      const page = newPage("body", ch.slug); page.dataset.chapter = ch.num;
      page.innerHTML = `${head()}<div class="main flow"></div><div class="side"></div><div class="folio"><span></span></div><div class="path" aria-hidden="true">${pathText(ch, page.classList.contains("verso"))}</div>${thumb(ch)}`;
      return page;
    };
    const chromePage = (kind, section, html) => { const page = newPage(kind, section); page.innerHTML = html; return page; };
    const section = h => {
      const node = el(h.level === 1 ? `<div class="sec"><h3 id="fzb-${esc(h.slug)}">${esc(h.title)}</h3></div>` : `<div class="sub"><h4 id="fzb-${esc(h.slug)}">${esc(h.title)}</h4></div>`);
      node.dataset.block = h.key; node.dataset.start = 0; node.dataset.end = h.title.length; node.dataset.head = h.slug;
      return node;
    };
    const paragraph = (block, start, end, cont) => {
      const part = bookSlice(block.node, start, end), p = document.createElement("p");
      p.append(...part.childNodes);
      p.className = [block.kind === "li" ? "item" : "", cont ? "cont" : ""].filter(Boolean).join(" ");
      p.dataset.block = block.key; p.dataset.start = start; p.dataset.end = end;
      return p;
    };
    const lineHeight = PT * 96 / 72 * LEADING, perLine = Math.floor(112 * MM / (PT * 96 / 72));

    function layoutChapter(ch) {
      const ep = ch.epigraph;
      const opener = newPage("opener", ch.slug); opener.dataset.chapter = ch.num;
      opener.innerHTML = `<img class="plate" src="assets/plates/${ch.plate}.webp" alt="">${thumb(ch, true)}
        <div class="ghost" aria-hidden="true">${esc(ch.ghost)}</div><div class="numeral" aria-hidden="true">${ch.roman}</div>
        <p class="cap"><span>Capitulum</span><b>${ch.roman}</b></p><h1 data-block="${ch.slug}:0" data-start="0" data-end="1">${esc(ch.name)}</h1><p class="en" lang="en">${esc(ch.en)}</p>
        ${ep ? `<p class="epi-label">Epigraphe</p><blockquote class="epi"><p>${esc(ep[0])}</p>${ep[1] ? `<p class="la" lang="la">${esc(ep[1])}</p>` : ""}<footer>—— ${esc(ep[2])}</footer></blockquote>` : ""}
        <div class="lead flow${ep ? "" : " high"}"></div><div class="rule"></div><div class="path" aria-hidden="true">Capitulum ${ch.roman}　<i>${esc(ch.name)}</i></div>`;
      toc.push({ kind: "chapter", ch, page: opener });
      const anchors = {};
      const lead = $(".lead", opener), firstHead = ch.heads.length ? ch.heads[0].at : ch.blocks.length;
      const bodyStart = pages.length;
      let start = 0;
      while (start < firstHead) {
        const b = ch.blocks[start], p = paragraph(b, 0, b.text.length); lead.append(p);
        if (!fits(lead)) { p.remove(); break; }
        anchors["p" + start++] = { page: bodyStart, top: 0 };
      }
      const after = new Map();
      for (const it of ch.items || []) if (it.after) { const i = ch.find(it.after); if (i >= 0) after.set(i, [...(after.get(i) || []), it]); }
      const queue = [];
      for (let k = start; k < ch.blocks.length; k++) {
        for (const h of ch.heads.filter(h => h.at === k)) queue.push({ head: h, key: "h:" + h.title });
        queue.push({ block: ch.blocks[k], key: "p" + k });
        for (const it of after.get(k) || []) queue.push({ item: it });
      }
      let page, main;
      // 组图与补充材料框是浮动的：当前页放不下时，正文继续往下排，图挪到下一页顶部。
      const deferred = [];
      const placeFloat = (it, force) => {
        if (it.kind === "strip") {
          // 跨正文栏与边栏：正文里留出同样高的空位，图本身按页面定位，边栏同一段高度不再放东西。
          const fig = M.strip(it); fig.classList.add("wide"); page.append(fig);
          const space = el(`<div class="strip-space"></div>`); space.style.height = fig.offsetHeight + "px"; main.append(space);
          if (!force && !fits(main) && main.children.length > 1) { fig.remove(); space.remove(); return false; }
          fig.style.top = (main.offsetTop + space.offsetTop) + "px";
          page.occupied.push([space.offsetTop, space.offsetTop + space.offsetHeight]);
          return true;
        }
        const node = M[it.kind](it); main.append(node);
        if (!force && !fits(main) && main.children.length > 1) { node.remove(); return false; }
        return true;
      };
      const turn = () => {
        page = bodyPage(ch); main = $(".main", page);
        while (deferred.length) placeFloat(deferred.shift(), true);
      };
      turn();
      const room = () => main.clientHeight - (main.lastElementChild ? main.lastElementChild.offsetTop + main.lastElementChild.offsetHeight : 0);
      const mark = (key, node) => { anchors[key] = { page: pages.indexOf(page), top: node.offsetTop }; };
      for (const q of queue) {
        if (q.head) {
          const node = section(q.head); main.append(node);
          if ((!fits(main) || room() < lineHeight * 3) && main.children.length > 1) { node.remove(); turn(); main.append(node); }
          mark(q.key, node);
          if (q.head.level === 1) toc.push({ kind: "section", title: q.head.title, page });
          continue;
        }
        if (q.item) { if (deferred.length || !placeFloat(q.item)) deferred.push(q.item); continue; }
        const block = q.block, text = block.text, length = text.length;
        let offset = 0, first = true;
        while (offset < length) {
          const cont = offset > 0;
          const p = paragraph(block, offset, length, cont); main.append(p);
          if (fits(main)) { if (first) mark(q.key, p); break; }
          p.remove();
          const probe = (from, to, c = cont) => { const x = paragraph(block, from, to, c); main.append(x); const r = { ok: fits(main), h: x.offsetHeight }; x.remove(); return r; };
          let lo = offset, hi = length;
          while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (probe(offset, mid).ok) lo = mid; else hi = mid - 1; }
          if (lo - offset < perLine * 2 && main.children.length) { turn(); continue; }
          // 余下不足一行时，按实际行高退回一整行；本页放不下两行以上时整段移到下一页。
          if (probe(lo, length, true).h < lineHeight * 1.5) {
            const target = probe(offset, lo).h - lineHeight + 1;
            let a = offset, b = lo;
            while (a < b) { const m = Math.ceil((a + b) / 2); if (probe(offset, m).h <= target) a = m; else b = m - 1; }
            if (a - offset >= perLine * 2) lo = a;
            else if (main.children.length) { turn(); continue; }
          }
          // 不让下一页以句读开头，也不把开引号留在本页末尾；不拆开代理对。
          while (lo > offset && /[，。！？；：、）》」』”’]/.test(text[lo])) lo--;
          while (lo > offset && /[（《「『“‘]/.test(text[lo - 1])) lo--;
          if (lo > offset && /[\uD800-\uDBFF]/.test(text[lo - 1])) lo--;
          if (lo === offset) { turn(); continue; }
          const part = paragraph(block, offset, lo, cont); main.append(part);
          if (first) mark(q.key, part);
          offset = lo; first = false; turn();
        }
      }
      if (deferred.length) turn();
      // 边栏：与所依段落对齐；放不下就往下找空位，再顺延到下一页。
      for (const it of ch.items || []) {
        if (it.after || it.kind === "insert") continue;
        const key = it.anchor.startsWith("h:") ? it.anchor : "p" + ch.find(it.anchor);
        const anchor = anchors[key];
        if (!anchor) { ch.warn.push("锚点 " + it.anchor); continue; }
        if (placeSide(Math.max(anchor.page, bodyStart), anchor.page >= bodyStart ? anchor.top : 0, () => M[it.kind](it)) < 0) ch.warn.push("放不下 " + (it.id || it.what));
      }
      for (const it of ch.items || []) if (it.kind === "insert") insertPage(ch, it);
    }
    function placeSide(start, anchorTop, make) {
      // 边栏按正文顺序往下排：尽量与所依段落对齐；下面放不下时，把本页已放的图往上挪；再不行顺延到下一页。
      const gap = 5 * MM;
      for (let n = start; n < pages.length; n++) {
        const page = pages[n], side = $(".side", page); if (!side) continue;
        const node = make(); side.append(node);
        const h = node.offsetHeight, H = side.clientHeight, stack = page.stack || (page.stack = []);
        const clear = (t, hh) => !page.occupied.some(([a, b]) => t < b + gap && t + hh > a - gap);
        let top = Math.max(n === start ? anchorTop : 0, stack.length ? stack.at(-1).top + stack.at(-1).h + gap : 0);
        for (const [a, b] of [...page.occupied].sort((x, y) => x[0] - y[0])) if (top < b + gap && top + h > a - gap) top = b + gap;
        const tops = stack.map(s => s.top);
        if (top + h > H) {
          top = H - h;
          for (let i = stack.length - 1, next = top; i >= 0; i--) { tops[i] = Math.min(stack[i].top, next - gap - stack[i].h); next = tops[i]; }
        }
        const ok = top >= 0 && clear(top, h) && tops.every((t, i) => t >= 0 && clear(t, stack[i].h));
        if (!ok) { node.remove(); continue; }
        stack.forEach((s, i) => { s.top = tops[i]; s.node.style.top = tops[i] + "px"; });
        node.style.top = top + "px"; stack.push({ node, top, h });
        return n;
      }
      return -1;
    }
    function insertPage(ch, it) {
      // 夹页先试着放进本章最后一页的空白里，放不下再单独占一页。
      const last = pages.at(-1), main = last.classList.contains("body") ? $(".main", last) : null;
      if (main) {
        const fig = M.insert(it); fig.classList.add("in"); main.append(fig);
        if (fits(main)) return;
        fig.remove();
      }
      const page = newPage("insert", ch.slug); page.dataset.chapter = ch.num;
      page.innerHTML = `${head()}<div class="folio"><span></span></div><div class="path" aria-hidden="true">${pathText(ch, page.classList.contains("verso"))}</div>${thumb(ch)}`;
      page.append(M.insert(it));
    }
    function prefacePages() {
      // 序用手写体，按段落排进一到两页；换页落在句末，落款与签名在最后。
      const paras = [...(preface || ["此页留给图拉曼的序。"])];
      const sign = paras.length > 1 && /^图拉曼/.test(paras.at(-1)) ? paras.pop() : "";
      const make = first => chromePage("preface", "book-preface", `${first ? '<div class="ghost-p" aria-hidden="true">Praefatio</div>' : ""}<div class="letter"></div><div class="folio"><span></span></div>`);
      let page = make(true), box = $(".letter", page);
      prefaceStart = page;
      const add = (text, cls, cont) => { const p = document.createElement("p"); p.textContent = text; if (cls) p.className = cls; if (cont) p.classList.add("cont"); box.append(p); return p; };
      paras.forEach((text, i) => {
        let cont = false;
        while (text) {
          const p = add(text, i ? "" : "salute", cont);
          if (fits(box)) break;
          p.remove();
          let lo = 0, hi = text.length;
          while (lo < hi) { const mid = Math.ceil((lo + hi) / 2), q = add(text.slice(0, mid), i ? "" : "salute", cont), ok = fits(box); q.remove(); if (ok) lo = mid; else hi = mid - 1; }
          const end = Math.max(...["。", "！", "？", "；"].map(c => text.lastIndexOf(c, lo - 1)));
          lo = end >= 0 ? end + 1 : 0;
          if (lo > 0 && /[”’」』]/.test(text[lo])) lo++;
          if (lo > 0) add(text.slice(0, lo), "", cont);
          text = text.slice(lo); cont = true; page = make(false); box = $(".letter", page);
        }
      });
      const close = el(`<div class="signoff"><p>${esc(sign)}</p><span class="sig"><img src="assets/plates/sign.webp" alt="Turaman"></span></div>`);
      box.append(close);
      if (!fits(box)) { close.remove(); page = make(false); box = $(".letter", page); box.append(close); }
    }
    function backMatter() {
      const record = first => chromePage("record", "book-sources", `<header><div><span class="tag">Archivum Turris Albae · Acta</span><p>档案归档 / 馆员批注 · 本书所据</p></div><dl><div><dt>归档号 <i>Numerus</i></dt><dd>DFA</dd></div><div><dt>权限等级 <i>Gradus</i></dt><dd class="levels">${SEALS.map((s, i) => `<span${i ? "" : ' class="on"'}>${s[1]}</span>`).join("")}</dd></div><div><dt>经手馆员 <i>Custos</i></dt><dd class="sign-h">白塔馆员</dd></div></dl></header><div class="grid"></div>${first ? '<h2 class="rec-h">本书所据<span lang="la">Fontes</span></h2>' : ""}<div class="slips"></div><p class="pagina">PAGINA <span></span></p>`);
      let page = record(true), box = $(".slips", page);
      toc.push({ kind: "extra", title: "附录 · 本书所据", la: "Fontes", page });
      for (const ch of chapters) {
        const slip = el(`<section class="slip-s"><h3><b>${ch.roman}</b>${esc(ch.name)}</h3><ol>${(sources.get(ch.num) || ["（编者材料未列来源）"]).map(s => `<li>${esc(s)}</li>`).join("")}</ol></section>`);
        box.append(slip);
        if (!fits(box)) { slip.remove(); page = record(false); box = $(".slips", page); box.append(slip); }
      }
      chromePage("colophon", "book-end", `<p class="finis" lang="la">Finis</p><p class="finis-cn">全书完</p><span class="c-rule"></span><dl class="colo"><dt>版式</dt><dd>页面 210 × 299.5 mm · 正文 ${PT} pt，行距 ${LEADING}</dd><dt>字体</dt><dd>正文与题记思源宋体；标题与标签思源黑体；导语与注释霞鹜文楷；拉丁文 Cormorant Garamond、Jost；手写龙藏体（均为 SIL OFL）</dd><dt>插图</dt><dd>本书插图均为概念演绎，不构成已确认的建筑式样、徽记、器物或历史事件</dd></dl><div class="folio"><span></span></div>`);
    }
    function fillToc() {
      const lists = pages.filter(p => p.classList.contains("toc")).map(p => $(".toc-list", p));
      let li = 0;
      const rows = [`<div class="toc-x"><span class="n">${prefaceStart ? prefaceStart.dataset.folio : ""}</span><span>序<i lang="la">Praefatio</i><small>图拉曼·秘银·奥瑟坦</small></span></div>`];
      for (const e of toc) {
        if (e.kind === "chapter") rows.push(`<div class="toc-c"><span class="n">${e.page.dataset.folio}</span><span><b>Capitulum ${e.ch.roman}　${esc(e.ch.name)}</b><em>${esc(e.ch.en)}</em></span></div>`);
        else if (e.kind === "section") rows.push(`<div class="toc-s"><span class="n">${e.page.dataset.folio}</span><span>${esc(e.title)}</span></div>`);
        else rows.push(`<div class="toc-x"><span class="n">${e.page.dataset.folio}</span><span>${esc(e.title)}<i lang="la">${e.la}</i></span></div>`);
      }
      for (const row of rows) {
        const node = el(row); lists[li].append(node);
        if (!fits(lists[li]) && li + 1 < lists.length) { node.remove(); lists[++li].append(node); }
      }
    }

    // 第一个对开是合着的书：封面单独在右；翻开后衬页对书名页。
    chromePage("void", "book-cover", "");
    chromePage("cover", "book-cover", bookCoverHTML());
    chromePage("endpaper", "book-title", bookEndpaperHTML());
    chromePage("title", "book-title", bookTitleHTML());
    prefacePages();
    for (let i = 0; i < 2; i++) chromePage("toc", "book-contents", `${head()}${i ? "" : '<h2 class="toc-h">目录<span lang="la">Index</span></h2>'}<div class="toc-list"></div><div class="folio"><span></span></div>`);
    for (const ch of chapters) {
      layoutChapter(ch);
      await new Promise(r => setTimeout(r));
      if (cancelled()) return null;
    }
    backMatter();
    // 页码：前置页从书名页起用罗马数字，封面与衬页不编页；正文从第一章章首起算。
    const front = pages.findIndex(p => p.classList.contains("opener")), T = pages.findIndex(p => p.classList.contains("title"));
    pages.forEach((p, i) => {
      const n = i < front ? (i < T ? "" : roman(i - T + 1)) : i - front + 1;
      p.dataset.folio = i < front ? n : pad3(n);
      const f = $(".folio span", p); if (f) f.textContent = n;
      const g = $(".pagina span", p); if (g) g.textContent = n;
    });
    fillToc();
    const titles = { "book-cover": "封面", "book-title": "书名页", "book-preface": "序", "book-contents": "目录", "book-sources": "本书所据", "book-end": "终页" };
    const meta = pages.map(p => {
      const ch = chapters.find(c => c.slug === p.dataset.section);
      return {
        section: p.dataset.section, title: ch ? ch.name : titles[p.dataset.section] || "", kind: [...p.classList].find(c => !["page", "verso", "recto"].includes(c)),
        void: p.classList.contains("void"), folio: p.dataset.folio,
        items: [...p.querySelectorAll("[data-block]")].map(n => ({ key: n.dataset.block, start: Number(n.dataset.start), end: Number(n.dataset.end) })),
        heads: [...p.querySelectorAll("[data-head]")].map(n => n.dataset.head)
      };
    });
    return { pages, meta, chapters, warnings: chapters.flatMap(ch => ch.warn.map(w => `第${ch.num}章：${w}`)), front };
  }

  // 阅读器文字版：把插图、批注与图示按排版计划插进段落之间（手机与窄窗口用）。
  function flowFigures(chapter, plan, plates) {
    const p = plan.chapters.find(x => x.num === chapter.num);
    if (!p) return { plate: null, after: new Map() };
    const M = makers(plates), after = new Map(), texts = chapter.nodes.map(n => n.textContent.trim());
    const put = (i, node) => after.set(i, [...(after.get(i) || []), node]);
    const at = anchor => anchor.startsWith("h:")
      ? chapter.nodes.findIndex(n => /^H[34]$/.test(n.tagName) && n.textContent.trim() === anchor.slice(2))
      : texts.findIndex(t => t.startsWith(anchor));
    for (const it of p.items || []) {
      const node = it.kind === "insert" ? M.insert(it) : it.kind === "strip" ? M.strip(it) : M[it.kind](it);
      // 文字版按宽高比定图宽（book.css 的 --ar），图还没加载时分页也能量准。
      node.querySelectorAll("img[width][height]").forEach(img => img.style.setProperty("--ar", (img.getAttribute("width") / img.getAttribute("height")).toFixed(4)));
      const box = document.createElement("div"); box.className = "fzb reader-figure reader-figure-" + it.kind; box.append(node);
      box.dataset.bookKey = `${slug(chapter.id)}:fig-${it.id || (it.ids ? it.ids[0] : it.what)}`;
      const i = it.kind === "insert" ? chapter.nodes.length - 1 : at(it.after || it.anchor);
      put(i < 0 ? chapter.nodes.length - 1 : i, box);
    }
    return { plate: p.plate, after };
  }

  return { build, flowFigures, loadNoteFont, parsePreface, parseSources, PAGE_W, PAGE_H, PT, LEADING };
})();
