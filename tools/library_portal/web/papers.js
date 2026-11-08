/* 学术文献：一篇作品一个入口。正文与著录均来自构建产物，不在前端补写史实。 */
"use strict";
window.Papers = (() => {
  const html = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const cache = new Map();
  let cleanup = () => {};
  let revision = 0;
  const onDestroy = (fn) => { const prior = cleanup; cleanup = () => { prior(); fn(); }; };
  const read = (url) => {
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error("读取学术文献失败（" + r.status + "）");
      return r.json();
    }).catch((error) => { cache.delete(url); throw error; }));
    return cache.get(url);
  };
  const value = (v) => Array.isArray(v) ? v.map((x) => typeof x === "string" ? x : x.name || x.label || "").filter(Boolean).join("、") : String(v ?? "");
  const paperURL = (id, params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ""));
    return "#/paper/" + encodeURIComponent(id) + (query.size ? "?" + query : "");
  };
  const readerURL = (id, params = {}) => paperURL(id, params).replace("#/paper/", "#/paper-read/");
  const catalogueURL = (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ""));
    return "#/papers" + (query.size ? "?" + query : "");
  };
  // The URLs are generated locally. Reject active URL schemes even if a catalogue is malformed.
  const safeURL = (url) => {
    const s = String(url || "").trim();
    return s && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(s) ? s : /^https?:\/\//i.test(s) ? s : "";
  };
  const editionLink = (url, title, subtitle, primary = false) => {
    const href = safeURL(url);
    return href ? `<a class="ap-edition-link${primary ? " is-primary" : ""}" href="${html(href)}" target="_blank" rel="noopener"><span class="ap-edition-copy"><b>${html(title)}</b><small>${html(subtitle)}</small></span><span class="ap-file-kind">PDF<span aria-hidden="true"> ↗</span></span></a>` : "";
  };
  const volumeURL = (paper) => {
    const volume = safeURL(paper.volumeUrl);
    return volume && paper.volumePage ? volume.split("#")[0] + "#page=" + Number(paper.volumePage) : volume;
  };
  const fields = (items) => items.filter(([, v]) => v).map(([label, v]) => `<div><dt>${html(label)}</dt><dd>${html(value(v))}</dd></div>`).join("");
  const n = (number) => String(number).padStart(2, "0");
  const opts = (items, selected, label) => `<option value="">${label}</option>${items.map((s) => `<option value="${html(s)}"${s === selected ? " selected" : ""}>${html(s)}</option>`).join("")}`;

  function selectPapers(papers, params = new URLSearchParams()) {
    const q = params.get("q") || "", discipline = params.get("discipline") || "", format = params.get("format") || "";
    const sort = ["order", "title", "author"].includes(params.get("sort")) ? params.get("sort") : "order";
    const terms = q.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return papers.filter((p) => {
      const haystack = [p.title, p.enTitle, p.authors, p.affiliation, p.venue, p.worldDate, p.discipline, p.genre, p.summary, p.question].map(value).join(" ").toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term)) && (!discipline || value(p.discipline) === discipline) && (!format || (format === "web" ? p.webReady : format === "pdf" ? !p.webReady : true));
    }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title, "zh-CN") : sort === "author" ? value(a.authors).localeCompare(value(b.authors), "zh-CN") || a.order - b.order : a.order - b.order);
  }

  function directory(main, papers, params) {
    const q = params.get("q") || "", discipline = params.get("discipline") || "", format = params.get("format") || "";
    const sort = ["order", "title", "author"].includes(params.get("sort")) ? params.get("sort") : "order";
    const selected = selectPapers(papers, params);
    const link = (p) => paperURL(p.id, { from: params.toString() || null });
    const disciplines = [...new Set(papers.map((p) => value(p.discipline)).filter(Boolean))];
    document.title = "学术文献 · 白塔档案馆";
    main.innerHTML = `<div class="ap-catalogue">
      <header class="ap-directory-head">
        <div class="ap-page-tools"><p class="ap-eyebrow"><span lang="la">Scripta classica</span><span>白塔档案馆</span></p></div>
        <div class="ap-title-line"><h1>学术文献</h1><p class="ap-total"><b>${papers.length}</b><span>篇馆藏</span></p></div>
        <p class="ap-deck">《联盟学术名篇》<span class="ap-deck-rule" aria-hidden="true"></span>恰恩大学出版部编</p>
        <p class="ap-introduction">从一篇文献进入联盟的学问史。查阅作者、原载与题解，阅读中译，或翻开保留原刊版式的英文排印本。</p>
      </header>
      <section class="ap-catalogue-section" aria-labelledby="ap-catalogue-title">
        <div class="ap-section-heading"><h2 id="ap-catalogue-title">篇目</h2><span lang="la">Conspectus</span></div>
        <form class="ap-filters" role="search" aria-label="检索学术文献">
          <label class="ap-query"><span>检索篇目与著录</span><div><input name="q" type="search" value="${html(q)}" placeholder="篇名、作者、刊物或关键词" autocomplete="off"><button type="submit">检索</button></div></label>
          <label><span>学科</span><select name="discipline">${opts(disciplines, discipline, "全部学科")}</select></label>
          <label><span>阅读方式</span><select name="format"><option value="">全部篇目</option><option value="web"${format === "web" ? " selected" : ""}>网页与排印本</option><option value="pdf"${format === "pdf" ? " selected" : ""}>排印本</option></select></label>
          <label><span>排序</span><select name="sort"><option value="order"${sort === "order" ? " selected" : ""}>选本篇次</option><option value="title"${sort === "title" ? " selected" : ""}>篇名</option><option value="author"${sort === "author" ? " selected" : ""}>作者</option></select></label>
        </form>
        <p class="ap-result-count" role="status"><span>${q || discipline || format ? `找到 <b>${selected.length}</b> 篇，共 ${papers.length} 篇` : `共 <b>${papers.length}</b> 篇，依${{order: "选本篇次", title: "篇名", author: "作者"}[sort]}排列`}</span>${q || discipline || format || sort !== "order" ? `<a href="#/papers">清除条件</a>` : ""}</p>
        <ol class="ap-list" aria-label="学术篇目">${selected.map((p) => `<li value="${Number(p.order)}">
          <span class="ap-order" aria-label="第${Number(p.order)}篇">${n(p.order)}</span>
          <article><div class="ap-list-meta"><span>${html(value(p.discipline))}</span><span>${html(value(p.worldDate))}</span></div>
            <h3><a href="${link(p)}">${html(p.title)}</a></h3>
            <p class="ap-list-english" lang="en">${html(p.enTitle)}</p>
            <p class="ap-byline">${html(value(p.authors))}<span aria-hidden="true"> · </span>${html(value(p.venue))}</p>
            ${p.question ? `<p class="ap-question">${html(p.question)}</p>` : ""}
          </article>
          <div class="ap-list-actions"><a class="ap-entry" href="${link(p)}">查看文献<span aria-hidden="true">→</span></a><span class="ap-format">${p.webReady ? "中译 / English · 网页与PDF" : "中译 / 英文 · PDF"}</span></div>
        </li>`).join("")}</ol>
        ${selected.length ? "" : `<div class="ap-empty"><h3>没有符合条件的篇目</h3><p>可缩短检索词，或清除学科与阅读方式筛选。</p><a class="ap-button" href="#/papers">查看全部篇目</a></div>`}
      </section>
      <p class="ap-catalogue-note">原载、纪年与机构名称依馆藏著录。</p>
    </div>`;
    const form = main.querySelector(".ap-filters");
    const apply = () => {
      const data = new FormData(form);
      const next = Object.fromEntries(data);
      next.q = String(next.q).trim();
      if (next.sort === "order") delete next.sort;
      location.hash = catalogueURL(next).slice(1);
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); apply(); });
    form.querySelectorAll("select").forEach((select) => select.addEventListener("change", apply));
    window.scrollTo(0, 0);
  }

  const sourceLink = (item, fallback) => {
    const url = safeURL(typeof item === "string" ? item : item?.url);
    const label = typeof item === "string" ? fallback : item?.label || fallback;
    return url ? `<a href="${html(url)}">${html(label)}</a>` : "";
  };
  function sources(paper) {
    const decisions = (paper.decisionUrls || []).map((item) => sourceLink(item, "定稿记录")).filter(Boolean);
    return `<details class="ap-sources"><summary>来源<span>中译稿 · 英文原刊</span></summary><div>
      <p>本页著录及正文据馆藏源文件生成；中译、英文原刊与选本排印本分别保留各自的文本形式。</p>
      <nav aria-label="本文来源">${sourceLink(paper.sourceDocUrl, "中译稿")}${sourceLink(paper.sourceEnDocUrl, "英文原刊")}${decisions.join("")}</nav>
    </div></details>`;
  }

  function pdfActions(paper) {
    return `<div class="ap-downloads">${editionLink(paper.enPdfUrl, "英文原刊", "保留原刊版式", true)}${editionLink(volumeURL(paper), "中译合订本", paper.volumePrintedPage ? `《联盟学术名篇》·第${paper.volumePrintedPage}页` : "《联盟学术名篇》")}</div>`;
  }

  function detail(main, paper, payload, params, isCurrent, asReader = false) {
    const lang = params.get("lang") === "en" ? "en" : "zh";
    const from = params.get("from") || null;
    const catalogueParams = new URLSearchParams(from || "");
    const back = catalogueURL(Object.fromEntries(["q", "discipline", "format", "sort"].map((key) => [key, catalogueParams.get(key)])));
    const link = (options = {}) => readerURL(paper.id, { from, ...options });
    const recordURL = paperURL(paper.id, { from });
    const reading = asReader && paper.webReady && payload?.[lang]?.html;
    const content = reading ? payload[lang] : null;
    const toc = (content?.toc || []).filter((h) => h.id && h.label);
    const citation = [value(paper.authors), `《${paper.title}》`, value(paper.venue) || value(paper.worldDate)].filter(Boolean).join("，") + "。";
    const languages = `<nav class="ap-languages" aria-label="正文语言"><a href="${link()}"${lang === "zh" ? ' aria-current="page"' : ""}>中译</a><a href="${link({ lang: "en" })}" lang="en"${lang === "en" ? ' aria-current="page"' : ""}>English</a></nav>`;
    const tocItems = toc.map((heading) => `<li class="ap-toc-level-${Math.min(4, Math.max(1, heading.level || 2))}"><a href="${link({ lang: lang === "en" ? "en" : null, section: heading.id })}">${html(heading.label)}</a></li>`).join("");
    const citationHTML = `<section class="ap-citation" aria-labelledby="ap-citation-title"><h2 id="ap-citation-title">引用著录</h2><p>${html(citation)}</p><button type="button" class="ap-copy" data-copy-citation>复制著录</button><span class="ap-copy-status" role="status" aria-live="polite"></span></section>`;
    document.title = `${reading && lang === "en" ? paper.enTitle : paper.title} · ${reading ? "网页阅读" : "学术文献"} · 白塔档案馆`;
    if (reading) {
      const imprint = paper.print || {};
      const title = lang === "en" ? paper.enTitle : paper.title;
      const author = lang === "en" ? imprint.en_author || paper.authors : paper.authors;
      const venue = lang === "en" ? [imprint.journal_en || imprint.imprint_en, imprint.cover_vol || imprint.imprint_year].filter(Boolean).join(" · ") : paper.venue;
      main.innerHTML = `<div class="ap-paper ap-reader" data-paper="${html(paper.id)}">
        <nav class="ap-reader-toolbar" aria-label="阅读工具"><a class="ap-reader-back" href="${recordURL}">← 文献详情</a>${languages}<button type="button" class="ap-toc-jump" aria-haspopup="dialog" aria-controls="ap-toc-dialog">目录</button></nav>
        <header class="ap-reader-head" lang="${lang === "en" ? "en" : "zh-CN"}"><p class="ap-eyebrow">${lang === "en" ? "Full text" : "网页阅读"}</p><h1>${html(title)}</h1><p class="ap-author">${html(value(author))}</p><p class="ap-reader-venue">${html(value(venue))}</p></header>
        <div class="ap-reading-layout">
          <aside class="ap-reading-side"><details class="ap-toc"${matchMedia("(min-width: 901px)").matches ? " open" : ""}><summary>本文目录<span aria-hidden="true">＋</span></summary><nav aria-label="论文目录"><ol>${tocItems}</ol></nav></details></aside>
          <div class="ap-reading-main"><article class="ap-text" lang="${lang === "en" ? "en" : "zh-CN"}" id="ap-paper-text">${content.html}</article><p class="ap-text-end"><span aria-hidden="true">◇</span>${lang === "en" ? "End of text" : "正文终"}</p><a class="ap-back" href="${recordURL}">← 返回文献详情</a></div>
        </div>
      </div>`;
      const tocPanel = main.querySelector(".ap-toc");
      const wide = matchMedia("(min-width: 901px)");
      let tocChosen = false;
      tocPanel.querySelector("summary").addEventListener("click", () => { tocChosen = true; });
      const resizeToc = () => { if (!tocChosen) tocPanel.open = wide.matches; };
      wide.addEventListener("change", resizeToc);
      onDestroy(() => wide.removeEventListener("change", resizeToc));
      // The mobile contents opens over the current paragraph; closing it does
      // not move the reader. Native dialog supplies focus containment and Escape.
      const tocDialog = document.createElement("dialog");
      tocDialog.id = "ap-toc-dialog";
      tocDialog.className = "ap-toc-dialog";
      tocDialog.setAttribute("aria-labelledby", "ap-toc-dialog-title");
      tocDialog.innerHTML = `<div class="ap-toc-dialog-head"><h2 id="ap-toc-dialog-title">本文目录</h2><button type="button" aria-label="关闭目录">关闭<span aria-hidden="true"> ×</span></button></div><nav aria-label="选择章节"><ol>${tocItems}</ol></nav>`;
      main.append(tocDialog);
      main.querySelector(".ap-toc-jump").addEventListener("click", () => tocDialog.showModal());
      tocDialog.querySelector("button").addEventListener("click", () => tocDialog.close());
      tocDialog.querySelectorAll("a").forEach((a) => {
        if (new URLSearchParams(a.hash.split("?")[1]).get("section") === params.get("section")) a.setAttribute("aria-current", "location");
        a.addEventListener("click", () => tocDialog.close());
      });
      onDestroy(() => { if (tocDialog.open) tocDialog.close(); tocDialog.remove(); });
      enhanceText(main, (section) => link({ lang: lang === "en" ? "en" : null, section }));
    } else {
      main.innerHTML = `<div class="ap-paper is-catalogue-record" data-paper="${html(paper.id)}">
        <div class="ap-page-tools"><nav class="ap-breadcrumb" aria-label="所在位置"><a href="#/home">白塔档案馆</a><span aria-hidden="true">/</span><a href="${back}">学术文献</a><span aria-hidden="true">/</span><span>第${Number(paper.order)}篇</span></nav></div>
        <div class="ap-record-layout"><div class="ap-record-main">
          <header class="ap-paper-head"><p class="ap-eyebrow"><span>${html(value(paper.genre))}</span><span>《联盟学术名篇》第${Number(paper.order)}篇</span></p>
            <h1>${html(paper.title)}</h1><p class="ap-original-title" lang="en">${html(paper.enTitle)}</p>
            <div class="ap-author-block"><p class="ap-author">${html(value(paper.authors))}</p>${paper.affiliation ? `<p class="ap-affiliation">${html(value(paper.affiliation))}</p>` : ""}</div>
            <dl class="ap-bibliography">${fields([["原载", paper.venue], ["纪年", paper.worldDate], ["学科", paper.discipline]])}</dl>
          </header>
          ${paper.summary ? `<section class="ap-summary" aria-labelledby="ap-summary-title"><h2 id="ap-summary-title">编者题解<span>摘录</span></h2><p>${html(paper.summary)}</p>${paper.question ? `<p class="ap-paper-question"><span>所答之问</span>${html(paper.question)}</p>` : ""}${paper.webReady ? `<a class="ap-summary-link" href="${link({ section: "zh-题解" })}">阅读完整题解<span aria-hidden="true"> →</span></a>` : volumeURL(paper) ? `<a class="ap-summary-link" href="${html(volumeURL(paper))}" target="_blank" rel="noopener">完整题解 · 中译合订本<span aria-hidden="true"> ↗</span></a>` : ""}</section>` : ""}
          <footer class="ap-paper-footer">${citationHTML}${sources(paper)}<a class="ap-back" href="${back}">← 返回学术篇目</a></footer>
        </div><aside class="ap-access" aria-label="阅读版本"><h2>阅读版本</h2>${pdfActions(paper)}
          ${paper.webReady ? `<section class="ap-web-access"><h3>网页全文</h3><a class="ap-button" href="${link()}">中译<span aria-hidden="true">→</span></a><a class="ap-button" href="${link({ lang: "en" })}" lang="en">English<span aria-hidden="true">→</span></a></section>` : ""}
          <dl class="ap-bibliography">${fields([["中译收录", paper.coverage], ["选本", "《联盟学术名篇》"], ["编者", "恰恩大学出版部"]])}</dl>
        </aside></div>
      </div>`;
      main.querySelector("[data-copy-citation]").addEventListener("click", async () => {
        const status = main.querySelector(".ap-copy-status");
        try { await navigator.clipboard.writeText(citation); if (status?.isConnected) status.textContent = "已复制"; }
        catch { if (status?.isConnected) status.textContent = "未能自动复制，可选中上方著录复制。"; }
      });
    }
    const section = params.get("section");
    requestAnimationFrame(() => {
      if (!isCurrent()) return;
      if (!main.querySelector(`[data-paper="${CSS.escape(paper.id)}"]`)) return;
      const target = reading && section ? document.getElementById(section) : null;
      if (target && main.contains(target)) {
        target.scrollIntoView({ block: "start" });
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        main.querySelectorAll(".ap-toc a").forEach((a) => { if (new URLSearchParams(a.hash.split("?")[1]).get("section") === section) a.setAttribute("aria-current", "location"); });
      } else window.scrollTo(0, 0);
    });
  }

  function enhanceText(main, sectionURL) {
    const text = main.querySelector(".ap-text");
    text.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      const target = anchor.getAttribute("href");
      if (target.length > 1 && !target.startsWith("#/")) {
        let id = target.slice(1);
        try { id = decodeURIComponent(id); } catch { /* Preserve an already literal source anchor. */ }
        anchor.href = sectionURL(id);
      }
    });
    text.querySelectorAll("img[data-width-em]").forEach((img) => {
      for (const [attribute, property] of [["widthEm", "width"], ["heightEm", "height"]]) {
        const size = Number(img.dataset[attribute]);
        if (Number.isFinite(size) && size > 0) img.style[property] = size + "em";
      }
      const depth = Number(img.dataset.depthEm);
      if (Number.isFinite(depth) && depth >= 0 && img.classList.contains("paper-inline-math")) img.style.verticalAlign = -depth + "em";
    });
    // An inline formula keeps its native size and baseline, including when it
    // is wider than a phone's text column. The wrapper itself can shrink and
    // scroll; short formulae add neither a scrollbar nor a line-height gap.
    const inlineMath = [...text.querySelectorAll("img.paper-inline-math")].map((img) => {
      const wrapper = document.createElement("span");
      wrapper.className = "ap-inline-math";
      const depth = Number(img.dataset.depthEm);
      if (Number.isFinite(depth) && depth >= 0) wrapper.style.verticalAlign = -depth + "em";
      img.style.verticalAlign = "";
      img.replaceWith(wrapper);
      wrapper.append(img);
      return wrapper;
    });
    const fitInlineMath = () => {
      for (const wrapper of inlineMath) {
        const overflowing = wrapper.scrollWidth > wrapper.clientWidth + 1;
        wrapper.classList.toggle("is-scrollable", overflowing);
        if (overflowing) {
          wrapper.tabIndex = 0;
          wrapper.setAttribute("role", "region");
          wrapper.setAttribute("aria-label", "较宽的行内公式，可横向滚动");
          wrapper.title = "可横向滚动查看完整公式";
        } else {
          for (const attribute of ["tabindex", "role", "aria-label", "title"]) wrapper.removeAttribute(attribute);
        }
      }
    };
    if (inlineMath.length) {
      fitInlineMath();
      const mathObserver = new ResizeObserver(fitInlineMath);
      mathObserver.observe(text);
      onDestroy(() => mathObserver.disconnect());
    }
    text.querySelectorAll("table").forEach((table, i) => {
      const wrapper = document.createElement("div");
      wrapper.className = "ap-table-scroll";
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", table.querySelector("caption")?.textContent || `表格${i + 1}，可横向滚动`);
      if (table.hasAttribute("aria-labelledby")) wrapper.setAttribute("aria-labelledby", table.getAttribute("aria-labelledby"));
      table.replaceWith(wrapper);
      wrapper.append(table);
    });
    text.querySelectorAll(".paper-math").forEach((math) => { math.tabIndex = 0; math.setAttribute("role", "region"); math.setAttribute("aria-label", "公式，可横向滚动"); });
    const images = [...text.querySelectorAll("figure img, .paper-figure img")].filter((img) => !img.closest(".paper-math, .paper-inline-math, .paper-math-inline"));
    if (!images.length) return;
    const dialog = document.createElement("dialog");
    dialog.className = "ap-image-dialog";
    dialog.setAttribute("aria-labelledby", "ap-image-dialog-title");
    dialog.innerHTML = `<div class="ap-dialog-head"><h2 id="ap-image-dialog-title">图版</h2><div class="ap-image-zoom" role="group" aria-label="图版缩放"><button type="button" data-zoom="-1" aria-label="缩小图版">−</button><output aria-live="polite">100%</output><button type="button" data-zoom="1" aria-label="放大图版">＋</button></div><button type="button" class="ap-image-close" aria-label="关闭图版">关闭<span aria-hidden="true">×</span></button></div><div class="ap-image-scroll" tabindex="0" role="region" aria-label="图版，可横向与纵向滚动"><img alt=""></div><p class="ap-image-caption"></p>`;
    main.append(dialog);
    let opener = null;
    let zoom = 1;
    const setZoom = (next) => {
      zoom = Math.max(1, Math.min(4, next));
      dialog.querySelector("img").style.width = 100 * zoom + "%";
      dialog.querySelector("output").textContent = Math.round(zoom * 100) + "%";
      dialog.querySelector('[data-zoom="-1"]').disabled = zoom === 1;
      dialog.querySelector('[data-zoom="1"]').disabled = zoom === 4;
    };
    dialog.querySelectorAll("[data-zoom]").forEach((button) => button.addEventListener("click", () => setZoom(zoom + Number(button.dataset.zoom) * .5)));
    const close = () => dialog.close();
    dialog.querySelector(".ap-image-close").addEventListener("click", close);
    dialog.addEventListener("click", (event) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
    dialog.addEventListener("close", () => { opener?.focus({ preventScroll: true }); });
    images.forEach((img) => {
      const figure = img.closest("figure, .paper-figure");
      const caption = figure?.querySelector("figcaption, .paper-caption")?.textContent || img.alt || "图版";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ap-image-open";
      button.setAttribute("aria-label", "放大图版：" + caption);
      img.replaceWith(button);
      button.append(img);
      const hint = document.createElement("span");
      hint.className = "ap-image-hint";
      hint.textContent = "放大图版 ↗";
      button.append(hint);
      button.addEventListener("click", () => {
        opener = button;
        const large = dialog.querySelector("img");
        large.src = img.currentSrc || img.src;
        large.alt = img.alt || caption;
        dialog.querySelector(".ap-image-caption").textContent = caption;
        dialog.querySelector("#ap-image-dialog-title").textContent = "图版阅读";
        dialog.showModal();
        setZoom(1);
        dialog.querySelector(".ap-image-close").focus();
        dialog.querySelector(".ap-image-scroll").scrollTo(0, 0);
      });
    });
    onDestroy(() => { if (dialog.open) dialog.close(); dialog.remove(); });
  }

  async function render(main, route, id, params = new URLSearchParams(), isCurrent = () => true) {
    cleanup(); cleanup = () => {};
    const turn = ++revision;
    const current = () => revision === turn && isCurrent();
    const asReader = route === "paper-read" || (route === "paper" && (params.has("section") || params.get("lang") === "en"));
    main.dataset.view = asReader ? "paper-read" : route === "paper" ? "paper" : "papers";
    document.body.dataset.academic = "true";
    onDestroy(() => { delete document.body.dataset.academic; });
    main.innerHTML = '<p class="rs-loading">正在读取学术文献…</p>';
    try {
      const data = await read("data/papers.json");
      if (!current()) return;
      const papers = data.papers || data.entries || [];
      if (route === "papers") { directory(main, papers, params); return; }
      const paper = papers.find((p) => p.id === id);
      if (!paper) {
        main.innerHTML = '<div class="ap-empty"><h1>未找到这篇文献</h1><p>可从学术篇目重新查找。</p><a class="ap-button" href="#/papers">查看学术篇目</a></div>';
        return;
      }
      const payload = asReader && paper.webReady ? await read("papers/" + encodeURIComponent(paper.id) + ".json") : null;
      if (!current()) return;
      if (!payload && asReader) main.dataset.view = "paper";
      detail(main, paper, payload, params, current, asReader);
    } catch (error) {
      if (current()) main.innerHTML = `<div class="ap-empty"><h1>文献暂时无法读取</h1><p>${html(error.message)}。请刷新页面重试。</p><a class="ap-button" href="#/papers">返回学术篇目</a></div>`;
    }
  }
  return { render, destroy: () => { revision++; cleanup(); cleanup = () => {}; }, paperURL, readerURL, selectPapers };
})();
