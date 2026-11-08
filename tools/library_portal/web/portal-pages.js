"use strict";
// 其余页面：全部馆藏与检索、主题总目、机构总目与机构详情、版本与关系、审计与测试。
// 与 portal.js 共用数据与工具函数；筛选、计数口径与说明文字沿用原版门户（2026-10 改版前的 app.js、prototype.js、institutions.js）。

const KINDS = [["document", "文档"], ["candidate", "候选正文"], ["changelog", "修订记录"], ["data", "数据与脚本"]];
// local: 编校用的筛选（文件状态、目录、类型），公开站点不显示。
const FACETS = [
  { key: "category", label: "馆藏门类", values: () => index.categories.map((c) => [c.id, c.name]), test: (d, v) => d.holding?.category === v, keepEmpty: true },
  { key: "status", label: "文件状态", values: () => [...COMPOSITION, "UNRESOLVED"].filter((s) => index.statuses.includes(s)).map((s) => [s, STAMPS[s]?.[0] || s]), test: (d, v) => d.status === v, keepEmpty: true, local: true },
  { key: "topic", label: "关联主题", values: () => index.topics.filter((t) => docs.some((d) => d.topics.includes(t))).map((t) => [t, t]), test: (d, v) => d.topics.includes(v), keepEmpty: true },
  { key: "institution", label: "关联机构", values: () => index.institutions.map((t) => [t, t]), test: (d, v) => d.institutions.includes(v), keepEmpty: true },
  { key: "collection", label: "目录类别", values: () => Object.entries(index.collections), test: (d, v) => d.collection === v, local: true },
  { key: "kind", label: "文件类型", values: () => KINDS, test: (d, v) => d.kind === v, local: true },
];
const shownFacets = () => FACETS.filter((f) => !(f.local && isPublic()));
// 各状态的总目标题与说明（原 browseContext 与 documentNotice 的口径）。
const STATUS_TITLES = { CURRENT_CANON: "现行法典", SUPERSEDED: "旧版正文", AUTHOR_CANON: "作者设定", CANDIDATE: "整编底稿", PROPOSAL: "提案", UNRESOLVED: "待决材料", REFERENCE: "参考材料", DELEGATED_DESIGN: "授权设计" };
const STATUS_NOTES = {
  CURRENT_CANON: "现行正文收入核定的现行文献清单，是当前有效的设定文本。",
  CANDIDATE: "这是整理成现行正文之前的原始底稿，保留下来是为了追查条文的来源。它不是更新的草案，也不会自动成为现行正文。",
  SUPERSEDED: "这是一份旧版正文，已由现行正文取代，保留供查考。引用时请以现行正文为准。",
  AUTHOR_CANON: "这是作者直接给出的设定，效力高于现行正文。适用范围以原文所写为准。",
  DELEGATED_DESIGN: "这是作者授权代为设计的材料，在授权范围内有效，范围以原文所写为准。",
  PROPOSAL: "这是一份提案，尚未采纳，不属于现行设定。",
  UNRESOLVED: "这份材料涉及尚未决定的问题，其中的内容暂不作为设定使用。具体待决事项见正文。",
  REFERENCE: "这是参考材料，用于理解背景或整理过程，本身不构成设定。",
};
// 主题导语与图标（原 TOPIC_GUIDES 与 topicIcon）。
const TOPIC_GUIDES = {
  宪政与治理: "从宪章到议会与执政机关，查阅规范层级和权力边界。",
  魔法体系与魔法法: "查阅环级认定、施法许可与禁术边界。",
  司法监察与治安: "查阅监察、裁断与治安机关的职责和程序。",
  军事与防务: "了解联盟防务制度与战备组织。",
  学术与研究机构: "了解白塔、图书馆和学会的典藏与研究规则。",
  财政货币与经济: "查阅联盟货币、储备系统及其职责。",
  审计与测试: "查阅项目整编、冲突登记与场景推演；此处为项目资料。",
};
const TOPIC_ICONS = { 宪政与治理: "topic-constitution", 魔法体系与魔法法: "topic-magic", 司法监察与治安: "topic-justice", 军事与防务: "topic-defense", 学术与研究机构: "topic-academy", 财政货币与经济: "topic-treasury", 审计与测试: "nav-versions" };
const PAGE_SIZE = 25;

function highlight(value, query) {
  const text = String(value || "");
  const terms = String(query || "").trim().split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!terms.length) return esc(text);
  const pattern = new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "giu");
  let out = "", last = 0;
  for (const m of text.matchAll(pattern)) {
    out += esc(text.slice(last, m.index)) + "<mark>" + esc(m[0]) + "</mark>";
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
function setIcons(root) {
  root.querySelectorAll("[data-icon]").forEach((el) => el.style.setProperty("--icon", `url("assets/icons-v3/${el.dataset.icon}.svg")`));
}
// crumbs 是上级目录 [[名称, 地址], …]；页面自己的名称只在标题里出现一次。
function pageHead(latin, crumbs, title, desc) {
  return `<header class="rs-page-head"><p class="rs-crumbs"><a href="#/home">档案馆</a>${crumbs.map(([label, href]) => ` / <a href="${href}">${esc(label)}</a>`).join("")}</p><h1>${esc(title)}</h1>${latin ? `<p class="rs-subtitle" lang="la">${esc(latin)}</p>` : ""}${desc ? `<p class="rs-page-desc">${esc(desc)}</p>` : ""}</header>`;
}
function tableHTML(headers, rows, cell = (v) => esc(v)) {
  if (!rows.length) return `<p class="rs-vnote">当前索引未提供可展示的条目，请查阅本节来源文件。</p>`;
  return `<div class="rs-table-wrap" tabindex="0" role="region" aria-label="${esc(headers.join("、"))}"><table class="rs-table"><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v, i) => `<td>${cell(v, i, row)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/* ---------- 全部馆藏与检索 ---------- */

let searchWorker = null, searchSerial = 0;
function searchDocs(documents, query, scope, onProgress) {
  searchWorker ??= new Worker("search-worker.js");
  const request = ++searchSerial;
  return new Promise((resolve, reject) => {
    searchWorker.onmessage = ({ data }) => {
      if (data.type === "progress") { if (request === searchSerial) onProgress?.(data); return; }
      if (data.request !== request) return;
      if (data.type === "results") resolve(data.results);
      else if (data.type === "error") reject(new Error(data.message));
    };
    searchWorker.onerror = () => reject(new Error("搜索线程启动失败"));
    searchWorker.postMessage({
      type: "search", request, query, scope, shards: index.searchShards,
      documents: documents.map((d) => ({ id: d.id, title: d.title, name: d.name, path: d.path, alias: d.alias, institutions: d.institutions, topics: d.topics })),
    });
  });
}
function browseContext(params) {
  const status = params.get("status"), topic = params.get("topic"), institution = params.get("institution"), collection = params.get("collection");
  let title = "全部馆藏", desc = isPublic() ? "检索标题、全文与著录，可按门类、主题与机构筛选。多个关键词以空格分隔，匹配同时包含这些词的文献。" : "按门类、主题、机构与文件状态检索。多个关键词以空格分隔，匹配同时包含这些词的文件。", latin = "Collectio", crumbs = [];
  const category = categoryOf(params.get("category"));
  if (category) { title = category.name; desc = category.intro; latin = category.latin; crumbs = [["全部馆藏", "#/browse"]]; }
  if (params.has("directory")) { title = "完整源文件目录"; desc = "按原有路径浏览全部入藏文件，含项目资料、来源材料与工具文件。"; latin = "Index fontium"; crumbs = [["编校", "#/audit"]]; }
  if (collection) { title = index.collections[collection] || collection; desc = "依原目录归集，文件状态与权威仍以各自记录为准。"; crumbs = ["00_PROJECT", "90_AUDIT"].includes(collection) ? [["编校", "#/audit"]] : [["全部馆藏", "#/browse"]]; }
  if (params.get("path")) { title = "目录馆藏"; desc = params.get("path"); latin = "Index fontium"; crumbs = [["编校", "#/audit"], ["完整源文件目录", "#/browse?directory=1"]]; }
  if (status) { title = STATUS_TITLES[status] || status; desc = STATUS_NOTES[status] || ""; latin = { CURRENT_CANON: "Leges vigentes", SUPERSEDED: "Editiones priores", AUTHOR_CANON: "Decreta" }[status] || latin; crumbs = ["AUTHOR_CANON", "CANDIDATE", "PROPOSAL", "UNRESOLVED", "DELEGATED_DESIGN"].includes(status) ? [["编校", "#/audit"]] : [["全部馆藏", "#/browse"]]; }
  if (topic || institution) {
    title = topic || institution;
    desc = topic ? "依目录与标题关键词归入本主题；同一文献可以属于多个主题。" : "依文本中的名称与别名提及关联，不代表机构隶属、颁布机关或文件授权。";
    latin = topic ? "Argumentum" : "Institutum";
    crumbs = topic ? [["主题总目", "#/topics"]] : [["机构总目", "#/institutions"]];
  }
  if (params.get("q") && !topic && !institution) { title = "检索馆藏"; desc = isPublic() ? "检索标题、全文与著录。" : "搜索标题、全文与元数据；权威及适用限制见文献记录。"; if (!crumbs.length) crumbs = [["全部馆藏", "#/browse"]]; }
  return { title, desc, latin, crumbs };
}
function treeHTML(selected) {
  const root = { dirs: {}, files: [], n: 0 };
  for (const d of docs) {
    let node = root;
    node.n++;
    for (const part of d.path.split("/").slice(0, -1)) { node = node.dirs[part] ??= { dirs: {}, files: [], n: 0 }; node.n++; }
    node.files.push(d);
  }
  const walk = (node, prefix) => Object.keys(node.dirs).sort().map((name) => {
    const path = prefix ? prefix + "/" + name : name, child = node.dirs[name];
    const open = selected === path || selected.startsWith(path + "/");
    return `<details${open ? " open" : ""}><summary><a href="#/browse?${new URLSearchParams({ path, directory: 1 })}"${selected === path ? ' aria-current="true"' : ""}>${esc(index.collections[name] || name)}</a><small>${child.n}</small></summary>${walk(child, path)}</details>`;
  }).join("") + node.files.map((d) => `<a class="rs-tree-file" href="${docHref(d.id)}">${esc(d.name)}</a>`).join("");
  return `<section class="rs-tree"><h2>源文件目录</h2><a class="rs-tree-all" href="#/browse?directory=1"${selected ? "" : ' aria-current="true"'}>全部文件<small>${docs.length}</small></a>${walk(root, "")}</section>`;
}
function facetHTML(facet, pool, current, keep) {
  const counts = facet.values().map(([value, label]) => [value, label, pool.filter((d) => facet.test(d, value)).length])
    .filter(([value, , n]) => n || facet.keepEmpty || value === current);
  const max = Math.max(1, ...counts.map(([, , n]) => n));
  return `<section class="rs-facet"><h2>${esc(facet.label)}</h2><ul>
    <li><a href="${keep({ [facet.key]: null })}"${current ? "" : ' aria-current="true"'}><span>全部</span><b>${pool.length}</b></a></li>
    ${counts.map(([value, label, n]) => `<li><a class="${n ? "" : "is-empty"}" href="${keep({ [facet.key]: value === current ? null : value })}"${value === current ? ' aria-current="true"' : ""}><span>${esc(label)}</span><b>${n}</b><s><i data-w="${n / max}"></i></s></a></li>`).join("")}
  </ul></section>`;
}
function rowHTML(d, query, snippet) {
  const text = snippet ? snippet.replace(/(^|\s)#{1,6}\s/g, "$1") : d.status === "CURRENT_CANON" ? GUIDES[d.alias] || "" : "";
  const category = d.holding && categoryOf(d.holding.category);
  const group = d.holding?.group || (d.status === "CURRENT_CANON" ? lawGroup(d) : "");
  // 公开站点按馆藏著录列：门类与分组、编号、发布者、年代；本机另列状态、版本与路径。
  const meta = isPublic()
    ? `${category ? `<span class="rs-row-cat">${esc(category.name)}${group ? `<i>${esc(group)}</i>` : ""}</span>` : ""}${d.holding?.number || d.alias ? `<span class="rs-mono">${esc(d.holding?.number || d.alias)}</span>` : ""}${d.holding?.issuer ? `<span>${esc(d.holding.issuer)}</span>` : ""}${d.holding?.issued ? `<span>${esc(d.holding.issued)}</span>` : ""}`
    : `${stamp(d.status)}${category ? `<span class="rs-row-cat">${esc(category.name)}${group ? `<i>${esc(group)}</i>` : ""}</span>` : ""}${d.version && d.version !== "未标注" ? `<span class="rs-mono">${esc(d.version)}</span>` : ""}${d.holding?.number || d.alias ? `<span class="rs-mono">${esc(d.holding?.number || d.alias)}</span>` : ""}<span>${esc(d.category)}</span>${d.date ? `<span class="rs-mono">${esc(d.date)}</span>` : ""}`;
  return `<article class="rs-row${d.status === "SUPERSEDED" ? " is-old" : ""}">
    <h3><a href="${docHref(d.id)}">${highlight(titleOf(d), query)}</a></h3>
    <p class="rs-row-meta">${meta}</p>
    ${text ? `<p class="rs-row-text">${highlight(text, query)}</p>` : ""}
    ${isPublic() ? "" : `<p class="rs-row-path" translate="no">${esc(d.path)}</p>`}
  </article>`;
}
// 门类排序：法典与规章、学术文献、百科与年表、公文与手稿，各类里按分组与年代。
function catalogueOrder(d) {
  const c = index.categories.findIndex((x) => x.id === d.holding?.category);
  const groups = c >= 0 ? index.categories[c].groups.map((g) => g.name) : [];
  const group = d.holding?.group || (d.status === "CURRENT_CANON" ? lawGroup(d) : "");
  return [c >= 0 ? c : 99, Math.max(0, groups.indexOf(group)), d.status === "CURRENT_CANON" ? 0 : 1];
}
function sortRows(rows, sort) {
  const doc = (r) => byId.get(r.id), rank = (r) => ({ CURRENT_CANON: 0, SUPERSEDED: 2 })[doc(r).status] ?? 1;
  const byPath = (a, b) => doc(a).path.localeCompare(doc(b).path, "zh-CN");
  const catalogue = (a, b) => { const x = catalogueOrder(doc(a)), y = catalogueOrder(doc(b)); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || bySort(doc(a), doc(b)) || byPath(a, b); };
  rows.sort((a, b) =>
    sort === "catalogue" ? catalogue(a, b)
    : sort === "current" ? Number(doc(b).status === "CURRENT_CANON") - Number(doc(a).status === "CURRENT_CANON") || byPath(a, b)
    : sort === "title" ? doc(a).title.localeCompare(doc(b).title, "zh-CN")
    : sort === "modified" ? doc(b).modified.localeCompare(doc(a).modified)
    : b.score - a.score || rank(a) - rank(b) || byPath(a, b));
}
function pagerHTML(pageNo, pages, params) {
  if (pages <= 1) return "";
  const href = (n) => { const p = new URLSearchParams(params); p.set("page", n); return "#/browse?" + p; };
  const nums = [...new Set([1, pageNo - 2, pageNo - 1, pageNo, pageNo + 1, pageNo + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  let html = pageNo > 1 ? `<a href="${href(pageNo - 1)}">上一页</a>` : `<span class="is-off">上一页</span>`, last = 0;
  for (const n of nums) {
    if (n - last > 1) html += `<span class="is-gap">…</span>`;
    html += n === pageNo ? `<span aria-current="page">${n}</span>` : `<a href="${href(n)}">${n}</a>`;
    last = n;
  }
  return html + (pageNo < pages ? `<a href="${href(pageNo + 1)}">下一页</a>` : `<span class="is-off">下一页</span>`);
}
function tokensHTML(params, keep) {
  const labels = { q: "关键词", category: "门类", status: "状态", topic: "主题", institution: "机构", collection: "目录", kind: "类型", scope: "范围", path: "路径" };
  const value = (k, v) => (k === "category" ? categoryOf(v)?.name || v : k === "status" ? STAMPS[v]?.[0] || v : k === "collection" ? index.collections[v] || v : k === "kind" ? KINDS.find(([x]) => x === v)?.[1] || v : k === "scope" ? "仅标题" : v);
  const items = Object.entries(labels).filter(([k]) => params.get(k)).map(([k, label]) => {
    const text = `${label}：${value(k, params.get(k))}`;
    return `<a class="rs-token" href="${keep({ [k]: null })}" aria-label="清除${esc(text)}">${esc(text)}<span aria-hidden="true">×</span></a>`;
  });
  return items.length ? items.join("") + `<a class="rs-link" href="#/browse">清除全部条件</a>` : "";
}

async function browsePage(params, my) {
  const ctx = browseContext(params);
  document.title = `${ctx.title} · 白塔档案馆`;
  const q = params.get("q") || "", scope = params.get("scope") || "";
  const sort = params.get("sort") || (q.trim() ? "relevance" : "catalogue");
  const keep = (changes) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) v == null ? p.delete(k) : p.set(k, v);
    p.delete("page");
    return "#/browse?" + p;
  };
  const directory = params.has("directory") || !!params.get("path");
  main.innerHTML = `<div class="rs-page rs-browse">
    ${pageHead(ctx.latin, ctx.crumbs, ctx.title, ctx.desc)}
    <form class="rs-hero-search rs-browse-search" role="search"><label class="rs-sr" for="rs-browse-query">检索</label><input id="rs-browse-query" type="search" autocomplete="off" value="${esc(q)}" placeholder="文献名称、机构或术语…"><kbd>/</kbd><button type="submit">检索</button></form>
    <p class="rs-seg" role="group" aria-label="检索范围"><a href="${keep({ scope: null })}"${scope ? "" : ' aria-current="true"'}>标题、全文与元数据</a><a href="${keep({ scope: "title" })}"${scope === "title" ? ' aria-current="true"' : ""}>仅标题</a></p>
    <div class="rs-browse-grid">
      <aside class="rs-facets" aria-label="筛选">
        <details class="rs-facets-box" open><summary>筛选</summary>${directory ? treeHTML(params.get("path") || "") : ""}<div id="rs-facets"><p class="rs-vnote">正在统计…</p></div></details>
      </aside>
      <section class="rs-results" aria-labelledby="rs-results-title">
        <h2 class="rs-sr" id="rs-results-title">检索结果</h2>
        <div class="rs-results-bar"><p id="rs-count" aria-live="polite">正在检索…</p><label class="rs-sort">排序<select id="rs-sort">${(isPublic() ? [["catalogue", "门类"], ["relevance", "相关度"], ["title", "标题"]] : [["catalogue", "门类"], ["current", "现行优先"], ["relevance", "相关度"], ["title", "标题"], ["modified", "文件修改时间"]]).map(([v, l]) => `<option value="${v}"${v === sort ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>
        <nav class="rs-tokens" aria-label="已选条件">${tokensHTML(params, keep)}</nav>
        <div id="rs-list"></div>
        <nav class="rs-pager" id="rs-pager" aria-label="分页"></nav>
      </section>
    </div>
  </div>`;
  if (matchMedia("(max-width: 900px)").matches) main.querySelector(".rs-facets-box").open = false;
  main.querySelector(".rs-browse-search").addEventListener("submit", (event) => {
    event.preventDefault();
    location.hash = keep({ q: $("#rs-browse-query").value.trim() || null }).slice(1);
  });
  $("#rs-sort").addEventListener("change", (event) => { location.hash = keep({ sort: event.target.value }).slice(1); });

  // 关键词交给检索线程；各组筛选的计数都按“其余条件已选”时的结果统计，与列表一致。
  const base = docs.filter((d) => !params.get("path") || d.path.startsWith(params.get("path") + "/"));
  let rows;
  if (q.trim()) {
    try {
      rows = await searchDocs(base, q, scope, (p) => { if (my === serial) $("#rs-count").textContent = `首次载入全文索引 ${p.done}/${p.total}，页面可继续操作…`; });
    } catch (error) {
      if (my !== serial) return;
      $("#rs-count").textContent = "检索失败";
      $("#rs-list").innerHTML = `<p class="rs-error">${esc(error.message)}。请刷新页面重试。</p>`;
      return;
    }
    if (my !== serial) return;
  } else rows = base.map((d) => ({ id: d.id, score: 0, snippet: "" }));
  const active = shownFacets().filter((f) => params.get(f.key));
  const passes = (d, except) => active.every((f) => f === except || f.test(d, params.get(f.key)));
  const pool = rows.map((r) => byId.get(r.id));
  $("#rs-facets").innerHTML = shownFacets().map((f) => facetHTML(f, pool.filter((d) => passes(d, f)), params.get(f.key) || "", keep)).join("");
  const hits = rows.filter((r) => passes(byId.get(r.id)));
  sortRows(hits, sort);
  const pages = Math.max(1, Math.ceil(hits.length / PAGE_SIZE));
  const pageNo = Math.min(Math.max(1, Math.floor(+params.get("page")) || 1), pages);
  $("#rs-count").innerHTML = `<b>${hits.length}</b> 份${q.trim() ? `含“${esc(q.trim())}”` : ""}${pages > 1 ? `<span>第 ${pageNo} / ${pages} 页</span>` : ""}`;
  $("#rs-list").innerHTML = hits.length
    ? hits.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE).map((r) => rowHTML(byId.get(r.id), q, r.snippet)).join("")
    : `<div class="rs-empty"><h2>没有找到匹配的档案</h2><p>尝试减少关键词，或在左侧逐项清除筛选。</p></div>`;
  $("#rs-pager").innerHTML = pagerHTML(pageNo, pages, params);
  setBars(main);
}

/* ---------- 主题总目 ---------- */

function topicsPage() {
  document.title = "主题总目 · 白塔档案馆";
  const entry = (t) => {
    const related = docs.filter((d) => d.topics.includes(t)), canon = related.filter((d) => d.status === "CURRENT_CANON");
    const parts = COMPOSITION.map((s) => [s, related.filter((d) => d.status === s).length]).filter(([, n]) => n);
    return `<section class="rs-topic">
      <span class="rs-topic-icon" data-icon="${TOPIC_ICONS[t] || "nav-codex"}" aria-hidden="true"></span>
      <div class="rs-topic-main"><h2><a href="${browseHref({ topic: t })}">${esc(t)}</a></h2><p>${esc(TOPIC_GUIDES[t] || "按主题查阅现有文献。")}</p>
        ${canon.length ? `<p class="rs-topic-canon">${canon.map((d) => `<a href="${docHref(d.id)}">${esc(d.title)}</a>`).join("")}</p>` : ""}</div>
      <div class="rs-topic-stats"><p><b>${related.length}</b> 份相关文献，其中现行 <b>${canon.length}</b> 份</p>
        <div class="rs-composition" role="img" aria-label="${parts.map(([s, n]) => `${STAMPS[s][0]} ${n} 份`).join("，")}">${parts.map(([s, n]) => `<span class="${STAMPS[s][1]}" data-grow="${n}"></span>`).join("")}</div>
        <p class="rs-topic-legend">${parts.map(([s, n]) => `<span><i class="${STAMPS[s][1]}"></i>${esc(STAMPS[s][0])} ${n}</span>`).join("")}</p>
        <p class="rs-topic-links"><a class="rs-link" href="${browseHref({ topic: t })}">查阅全部</a>${canon.length ? `<a class="rs-link" href="${browseHref({ topic: t, status: "CURRENT_CANON" })}">仅看现行</a>` : ""}</p></div>
    </section>`;
  };
  const world = index.topics.filter((t) => TOPIC_WORDS[t]), project = index.topics.filter((t) => !TOPIC_WORDS[t]);
  main.innerHTML = `<div class="rs-page">
    ${pageHead("Argumenta", [], "主题总目", "从文献的主题进入馆藏。分类依据目录与标题关键词，同一文件可归入多个主题。")}
    <div class="rs-topics">${world.map(entry).join("")}</div>
    ${project.length ? `<h2 class="rs-subhead">项目资料</h2><div class="rs-topics">${project.map(entry).join("")}</div>` : ""}
  </div>`;
  setBars(main);
  setIcons(main);
}

/* ---------- 机构总目与机构详情（口径同原版机构名录） ---------- */

const ORG = {
  hierarchy: new Set(["internal", "subordinate", "direct"]),
  status: { current: "现行机构", historical: "历史机构", abolished: "已撤销", conditional: "条件性机制", planned: "拟设", unknown: "状态不明" },
  relation: { management: ["主管机关", "主管单位"], internal: ["内设于", "内设单位"], subordinate: ["隶属／由其管理", "所属单位"], direct: ["直属于", "直属单位"], dual: ["双重领导／业务指导", "双重领导／业务指导"], oversight: ["监督对象", "监督来源"], appointment: ["任命关系", "任命关系"], authorization: ["授权对象", "授权来源"], cooperation: ["协作", "协作"], business: ["业务联系", "业务联系"], history: ["历史沿革", "历史沿革"], accountability: ["负责对象", "向本机关负责"], joint: ["联合组成", "联合机制"], appeal: ["上诉审级", "下级审级"] },
  scopes: [["current", "现行机构"], ["other", "历史、撤销与条件性"], ["facilities", "具名设施"], ["all", "全部条目"]],
  kindLabel: { 组成部门: "组成部门（部委）", 专项局: "部委管理的专项局" },
  merged: { police: "executive", prohibition: "executive" },
  role: { establishes: "设立", regulates: "规范", describes: "描述", status: "状态", alias: "别名" },
};
let orgMapCache = null;
const orgMap = () => (orgMapCache ??= new Map(registry.institutions.map((r) => [r.id, r])));
const orgParent = (r) => r.relations.find((e) => ORG.hierarchy.has(e.type)) || r.relations.find((e) => e.type === "dual");
function orgSection(category) {
  const id = ORG.merged[category] || category;
  const c = registry.categories.find((x) => x.id === id);
  return c ? c.section || c.id : id;
}
const orgInScope = (r, scope) => scope === "all" || (scope === "facilities" ? r.kind === "设施" : r.kind !== "设施" && (scope === "other" ? r.status !== "current" : r.status === scope));
const orgMatches = (r, q) => !q.trim() || [r.name, ...r.aliases].some((n) => n.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()));
function orgUnits(r, kids) {
  const list = kids.get(r.id) || [];
  return list.some((c) => c.kind === "组成部门") ? [...list, ...list.flatMap((c) => (kids.get(c.id) || []).filter((g) => g.kind === "专项局"))] : list;
}
function orgByKind(rows) {
  if (!rows.some((r) => r.kind === "组成部门")) return [["", rows]];
  const groups = new Map();
  for (const r of rows) { if (!groups.has(r.kind)) groups.set(r.kind, []); groups.get(r.kind).push(r); }
  return [...groups];
}
const orgStatusStamp = (r) => (r.kind !== "设施" && r.status !== "current" ? `<span class="rs-stamp is-superseded">${esc(ORG.status[r.status] || r.status)}</span>` : "");

function institutionsPage(params) {
  document.title = "机构总目 · 白塔档案馆";
  const state = { q: params.get("q") || "", scope: params.get("status") || "current", group: params.get("group") || "" };
  if (!ORG.scopes.some(([id]) => id === state.scope)) state.scope = "current";
  state.group = orgSection(state.group);
  if (!registry.sections.some((s) => s.id === state.group)) state.group = "";
  main.innerHTML = `<div class="rs-page rs-orgs">
    ${pageHead("Instituta", [], "机构总目", "银色联盟的议会、行政、司法、军事与学术机关。点开机构名称，可查看职责、下设单位、相关机关和依据条文。")}
    <form class="rs-org-tools" role="search"><label class="rs-sr" for="rs-org-q">查找机构</label><input id="rs-org-q" type="search" autocomplete="off" placeholder="查找机构，如：白塔、反垄断局…" value="${esc(state.q)}"><p class="rs-seg" role="group" aria-label="显示范围" id="rs-org-scopes"></p></form>
    <nav class="rs-jumps" aria-label="机构分组"></nav>
    <p id="rs-org-count" class="rs-vnote" aria-live="polite"></p>
    <div id="rs-org-results"></div>
  </div>`;
  const query = () => { const p = {}; if (state.q) p.q = state.q; if (state.scope !== "current") p.status = state.scope; return p; };
  const render = () => {
    $("#rs-org-scopes").innerHTML = ORG.scopes.map(([id, label]) => `<button type="button" data-scope="${id}"${id === state.scope ? ' aria-current="true"' : ""}>${label}<b>${registry.institutions.filter((r) => orgInScope(r, id) && orgMatches(r, state.q)).length}</b></button>`).join("");
    const selected = registry.institutions.filter((r) => orgInScope(r, state.scope) && orgMatches(r, state.q));
    $("#rs-org-count").textContent = state.q ? `找到 ${selected.length} 个${state.scope === "facilities" ? "设施" : "条目"}` : "";
    const groups = registry.sections.map((sec) => [sec, registry.categories.filter((c) => (c.section || c.id) === sec.id).map((c) => [c, selected.filter((r) => r.category === c.id)]).filter(([, m]) => m.length)]).filter(([, cats]) => cats.length);
    main.querySelector(".rs-jumps").innerHTML = groups.map(([sec, cats]) => `<a href="#/institutions?${new URLSearchParams({ ...query(), group: sec.id })}" data-group="${sec.id}">${esc(sec.name)}<b>${cats.reduce((n, [, m]) => n + m.length, 0)}</b></a>`).join("");
    $("#rs-org-results").innerHTML = groups.length ? groups.map(([sec, cats]) => {
      const body = cats.map(([cat, members]) => {
        let rows = members, kids = null;
        if (!state.q) {
          const ids = new Set(members.map((r) => r.id));
          kids = new Map();
          for (const r of members) { const p = orgParent(r); if (p && ids.has(p.target)) { if (!kids.has(p.target)) kids.set(p.target, []); kids.get(p.target).push(r); } }
          rows = members.filter((r) => { const p = orgParent(r); return !p || !ids.has(p.target); });
        }
        // 小标题与首个机构同名（如“白银议会”）时，机构名直接作小标题，条目里不再重复。
        const lead = cats.length > 1 && rows[0]?.name === cat.name ? rows[0] : null;
        const head = lead ? `<a href="${orgHref(lead.id)}">${esc(lead.name)}</a>${orgStatusStamp(lead)}` : esc(cat.name);
        return `${cats.length > 1 ? `<h3 class="rs-org-subhead">${head}</h3>` : ""}<ul class="rs-org-list">${rows.map((r) => orgEntryHTML(r, kids, r === lead)).join("")}</ul>`;
      }).join("");
      return `<section class="rs-org-group" id="rs-group-${sec.id}" aria-labelledby="rs-group-title-${sec.id}"><h2 id="rs-group-title-${sec.id}" tabindex="-1">${esc(sec.name)}<small>${cats.reduce((n, [, m]) => n + m.length, 0)}</small></h2>${body}</section>`;
    }).join("") : `<div class="rs-empty"><h2>没有找到匹配的机构</h2><p>可以换用正式名称、简称或别名，或者把显示范围切换为“全部条目”。</p></div>`;
  };
  const sync = () => { history.replaceState(null, "", "#/institutions" + (Object.keys(query()).length ? "?" + new URLSearchParams(query()) : "")); render(); };
  main.querySelector(".rs-org-tools").addEventListener("submit", (event) => event.preventDefault());
  $("#rs-org-q").addEventListener("input", (event) => { state.q = event.target.value; sync(); });
  main.querySelector(".rs-org-tools").addEventListener("click", (event) => {
    const button = event.target.closest("[data-scope]");
    if (!button) return;
    state.scope = button.dataset.scope;
    sync();
  });
  main.querySelector(".rs-jumps").addEventListener("click", (event) => {
    const jump = event.target.closest("[data-group]");
    if (!jump) return;
    event.preventDefault();
    history.replaceState(null, "", "#/institutions?" + new URLSearchParams({ ...query(), group: jump.dataset.group }));
    document.getElementById("rs-group-" + jump.dataset.group)?.scrollIntoView({ block: "start" });
  });
  render();
  if (state.group) requestAnimationFrame(() => document.getElementById("rs-group-" + state.group)?.scrollIntoView({ block: "start" }));
}
function orgEntryHTML(r, kids, bare) {
  const context = !kids && orgParent(r) ? orgMap().get(orgParent(r).target)?.name : "";
  const units = kids ? orgUnits(r, kids) : [];
  const groups = orgByKind(units);
  const list = (rows) => `<ul class="rs-org-units">${rows.map((k) => `<li><a href="${orgHref(k.id)}">${esc(k.name)}</a>${orgStatusStamp(k)}</li>`).join("")}</ul>`;
  const body = groups.length > 1
    ? groups.map(([kind, rows]) => `<details class="rs-org-branch"><summary>${esc(ORG.kindLabel[kind] || kind)}<b>${rows.length}</b></summary>${list(rows)}</details>`).join("")
    : units.length ? `<details class="rs-org-branch"><summary>下设单位<b>${units.length}</b></summary>${list(units)}</details>` : "";
  return `<li class="rs-org${groups.length > 1 ? " is-wide" : ""}">${bare ? "" : `<p class="rs-org-head"><a class="rs-org-name" href="${orgHref(r.id)}">${esc(r.name)}</a>${orgStatusStamp(r)}${context ? `<small>${esc(context)}</small>` : ""}</p>`}<p class="rs-org-summary">${esc(r.summary)}</p>${body}</li>`;
}

function institutionPage(ref) {
  const key = decodeURIComponent(ref || "");
  const mapped = registry.legacy?.[key] || key;
  if (mapped.startsWith("category:")) { location.replace("#/institutions?" + new URLSearchParams({ group: mapped.slice(9) })); return; }
  const map = orgMap(), r = map.get(mapped);
  if (!r) { main.innerHTML = `<p class="rs-error">该机构未收入名录。<a class="rs-link" href="#/institutions">返回机构总目</a></p>`; return; }
  document.title = `${r.name} · 机构总目 · 白塔档案馆`;
  const chain = [];
  for (let p = orgParent(r), guard = 0; p && guard < 8; guard++) { const x = map.get(p.target); if (!x) break; chain.unshift(x); p = orgParent(x); }
  const kids = new Map(registry.institutions.map((x) => [x.id, []]));
  for (const x of registry.institutions) { const p = orgParent(x); if (p && kids.has(p.target)) kids.get(p.target).push(x); }
  const units = orgUnits(r, kids), unitGroups = orgByKind(units);
  const parentEdge = orgParent(r);
  const outgoing = r.relations.map((e, i) => ({ row: map.get(e.target), edge: e, owner: r, i, incoming: false })).filter((x) => x.row && x.edge !== parentEdge);
  const incoming = registry.institutions.flatMap((x) => x.relations.map((e, i) => ({ row: x, edge: e, owner: x, i, incoming: true })).filter((x) => x.edge.target === r.id && !ORG.hierarchy.has(x.edge.type) && orgParent(x.row) !== x.edge));
  const relations = [...outgoing, ...incoming];
  const seen = new Set();
  const sources = r.sources.filter((s) => { const k = s.docId + ":" + s.anchor + ":" + s.role; if (seen.has(k)) return false; seen.add(k); return true; });
  const mentions = (r.mentions || []).map((id) => byId.get(id)).filter(Boolean);
  const rank = (d) => COMPOSITION.indexOf(d.status) < 0 ? 99 : COMPOSITION.indexOf(d.status);
  mentions.sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path, "zh-CN"));
  const section = registry.sections.find((s) => s.id === orgSection(r.category));
  const category = registry.categories.find((c) => c.id === r.category);
  const unitList = (rows) => `<ul class="rs-org-list">${rows.map((k) => `<li class="rs-org"><p class="rs-org-head"><a class="rs-org-name" href="${orgHref(k.id)}">${esc(k.name)}</a>${orgStatusStamp(k)}<small>${esc(k.kind)}</small></p><p class="rs-org-summary">${esc(k.summary)}</p></li>`).join("")}</ul>`;
  const quote = (s) => clip(String(s.quote || "").replace(/^#{1,6}[^\n]*\n+/, "").replace(/\s+/g, " ").trim(), 150);
  main.innerHTML = `<div class="rs-page rs-org-page">
    <p class="rs-crumbs"><a href="#/institutions">机构总目</a>${section ? ` / <a href="#/institutions?${new URLSearchParams({ group: section.id })}">${esc(section.name)}</a>` : ""}${chain.map((x) => ` / <a href="${orgHref(x.id)}">${esc(x.name)}</a>`).join("")}</p>
    <header class="rs-page-head">
      <h1>${esc(r.name)}</h1>
      <p class="rs-subtitle">${esc(r.kind)}</p>
      <dl class="rs-card-fields rs-org-fields">
        <div><dt>状态</dt><dd>${r.kind === "设施" ? `<span class="rs-stamp is-reference">具名设施</span>` : `<span class="rs-stamp ${r.status === "current" ? "is-current" : "is-superseded"}">${esc(ORG.status[r.status] || r.status)}</span>`}</dd></div>
        ${category ? `<div><dt>名录类别</dt><dd>${esc(category.name)}</dd></div>` : ""}
        ${units.length ? `<div><dt>下设单位</dt><dd><span class="rs-num">${units.length}</span> 个</dd></div>` : ""}
        ${relations.length ? `<div><dt>相关机关</dt><dd><span class="rs-num">${relations.length}</span> 个</dd></div>` : ""}
        <div><dt>依据</dt><dd><span class="rs-num">${sources.length}</span> 处</dd></div>
        <div><dt>全文提及</dt><dd><span class="rs-num">${mentions.length}</span> 份</dd></div>
      </dl>
      ${r.aliases.length ? `<p class="rs-org-aliases">又称：${r.aliases.map(esc).join("、")}</p>` : ""}
      <p class="rs-lead">${esc(r.summary)}</p>
      ${r.kind !== "设施" && r.status !== "current" ? `<p class="rs-org-note">${esc(ORG.status[r.status] || r.status)}。${esc(r.statusNote || "")}</p>` : ""}
      ${r.note ? `<p class="rs-org-note">${esc(r.note)}</p>` : ""}
    </header>
    <div class="rs-org-grid">
      <div class="rs-col">
        ${sources.length ? `<section class="rs-section">${sectionHead("", "依据", "Fontes", "名录记下的文件、章节与原文。")}
          <ol class="rs-sources">${sources.map((s) => `<li><span class="rs-stamp${s.role === "establishes" ? " is-current" : ""}">${esc(ORG.role[s.role] || s.role)}</span><div><a class="rs-xref" href="${docHref(s.docId, s.anchor ? { anchor: s.anchor } : null)}">${esc(s.title || byId.get(s.docId)?.title || "")}${s.section ? ` ${esc(s.section)}` : ""}</a><blockquote>${esc(quote(s))}</blockquote><small class="rs-mono">${esc(s.path)}${s.line ? ` · 第 ${s.line} 行` : ""}</small></div></li>`).join("")}</ol></section>` : ""}
        ${units.length ? `<section class="rs-section">${sectionHead("", "下设单位", "Membra", "按名录记下的隶属关系。")}${unitGroups.length > 1 ? unitGroups.map(([kind, rows]) => `<h3 class="rs-org-subhead">${esc(ORG.kindLabel[kind] || kind)}<small>${rows.length}</small></h3>${unitList(rows)}`).join("") : unitList(units)}</section>` : ""}
        ${relations.length ? `<section class="rs-section">${sectionHead("", "相关机关", "Nexus", "带类型的有据关系；指针移到“依据”上可看原文。")}
          <ul class="rs-relations">${relations.map(({ row, edge, owner, i, incoming: inc }) => `<li><span class="rs-rel-type">${esc((ORG.relation[edge.type] || [edge.type, edge.type])[inc ? 1 : 0])}</span><div><a class="rs-org-name" href="${orgHref(row.id)}">${esc(row.name)}</a>${edge.detail ? `<p>${esc(edge.detail)}</p>` : ""}${edge.sources?.length ? `<button type="button" class="rs-peekable" data-peek="evidence" data-org="${esc(owner.id)}" data-rel="${i}">依据 ${edge.sources.length} 处</button>` : ""}</div></li>`).join("")}</ul></section>` : ""}
      </div>
      <aside class="rs-rail" aria-label="提及本机构的馆藏">
        <section class="rs-panel"><h2>提及本机构的馆藏${rubric("Mentiones")}</h2>
          ${mentions.length ? `<dl class="rs-kv">${COMPOSITION.map((s) => [s, mentions.filter((d) => d.status === s).length]).filter(([, n]) => n).map(([s, n]) => `<div><dt>${esc(STAMPS[s][0])}</dt><dd>${n}</dd></div>`).join("")}</dl>
          <ol class="rs-acta rs-mentions">${mentions.slice(0, 12).map((d) => `<li><a href="${docHref(d.id)}"><b>${esc(d.alias || "")}</b><span>${esc(titleOf(d))}</span><time>${esc(STAMPS[d.status]?.[0] || "")}</time></a></li>`).join("")}</ol>
          ${mentions.length > 12 ? `<p class="rs-panel-foot">另有 ${mentions.length - 12} 份；按现行、作者设定、旧版、参考的顺序列出。</p>` : ""}` : `<p class="rs-vnote">名录未记录全文提及。</p>`}
          <p class="rs-panel-foot">全文提及只表示名称出现，不代表设立、隶属或授权。</p></section>
      </aside>
    </div>
  </div>`;
  window.scrollTo(0, 0);
}

/* ---------- 版本与关系 ---------- */

async function versionsPage(my) {
  document.title = "版本与关系 · 白塔档案馆";
  const sets = new Map(index.versionSets.map((s) => [s.current, s]));
  const canon = docs.filter((d) => d.status === "CURRENT_CANON" && sets.has(d.id));
  const byAlias = new Map(canon.map((d) => [d.alias, d]));
  const placed = new Set();
  const levels = CANON_LEVELS.map(([level, groups]) => [level, groups.map(([name, aliases]) => [name, aliases.map((a) => byAlias.get(a)).filter(Boolean)]).filter(([, list]) => list.length)]);
  levels.forEach(([, groups]) => groups.forEach(([, list]) => list.forEach((d) => placed.add(d.id))));
  const rest = canon.filter((d) => !placed.has(d.id));
  if (rest.length) levels.push(["其他", [["未分层", rest]]]);
  const latestRound = roundOf(byId.get(index.audit.latest?.id));
  const chain = (d) => familyVersions(d).map((v) => `<a class="rs-vchip${v.doc.id === d.id ? " is-current" : ""}${v.branch ? " is-branch" : ""}" href="${docHref(v.doc.id)}" title="${esc(STAMPS[v.doc.status]?.[0] || "")}：${esc(v.doc.path)}">${esc(v.label)}</a>`).join("");
  const row = (d) => {
    const set = sets.get(d.id), changelog = byId.get(set.changelog), candidate = byId.get(set.candidate), evidence = byId.get(set.evidence);
    const round = roundOf(changelog);
    return `<tr data-doc="${d.id}"><td class="rs-no">${esc(d.alias)}</td>
      <td class="rs-title"><a href="${docHref(d.id)}">${esc(d.title)}</a><small>${esc(d.category)}</small></td>
      <td><div class="rs-vchain">${chain(d)}</div></td>
      <td class="rs-sub rs-opt">${candidate ? `<a class="rs-link" href="${docHref(candidate.id)}">${esc(candidate.version)}</a>` : "—"}</td>
      <td class="rs-sub rs-opt">${changelog ? `<a class="rs-round${round === latestRound ? " is-latest" : ""}" href="${docHref(changelog.id)}">${round ? `第${round}版` : esc(changelog.title)}</a>` : "—"}${evidence ? `<small><a class="rs-link" href="${docHref(evidence.id)}">清单</a></small>` : ""}</td>
      <td class="rs-num rs-delta"><span class="rs-vnote">对照中…</span></td></tr>`;
  };
  main.innerHTML = `<div class="rs-page rs-versions">
    ${pageHead("Editiones", [], "版本与关系", `列出 ${canon.length} 份现行正文的同文系版本、整编底稿和修订记录。版本按版本号排列，便于逐条对照；版本号本身不证明先后，内容不同的同号分支并列显示。`)}
    <p class="rs-record-line rs-version-links"><span class="rs-k">登记依据　</span>${[["00_PROJECT/VERSION_LEDGER.md", "版本沿革登记"], ["00_PROJECT/CANDIDATE_CANON_INDEX.md", "原候选 Canon 索引"]].map(([path, label]) => { const d = docs.find((x) => x.path === path); return d ? `<a class="rs-link" href="${docHref(d.id)}">${label}</a>` : ""; }).join("")}<a class="rs-link" href="${browseHref({ status: "SUPERSEDED" })}">已替代正文 ${index.counts.SUPERSEDED || 0} 份</a></p>
    <p class="rs-intro">整编底稿保留供追查来源，不是较新的待定版本；第八版起新增的正文来自主题设定稿，没有整编底稿。最右一栏把每份现行正文与前一个版本号逐条对照，数出改动、新增与删去的条文；点进正文可以看每一条的版本线。</p>
    <table class="rs-register rs-version-table">
      <thead><tr><th>编号</th><th>名称</th><th>版本（按版本号）</th><th class="rs-opt">整编底稿</th><th class="rs-opt">末次修订</th><th>与前一版号对照</th></tr></thead>
      <tbody>${levels.map(([level, groups]) => groups.map(([group, list]) => `<tr class="rs-group"><td colspan="6">${esc(level)}${level === group ? "" : `<span>${esc(group)}</span>`}<small>${list.length}</small></td></tr>${list.map(row).join("")}`).join("")).join("")}</tbody>
    </table>
    <p class="rs-legend-line"><i class="is-filled"></i>现行正文　<i></i>旧版正文　<i class="is-dashed"></i>同号分支（内容不同，并列显示，不作为下一版的对照对象）</p>
  </div>`;
  // 逐份读取现行版与前一个主线版本，数出条文差异；按表格自上而下，读完一份填一格。
  for (const d of levels.flatMap(([, groups]) => groups.flatMap(([, list]) => list))) {
    const versions = familyVersions(d), here = versions.findIndex((v) => v.doc.id === d.id);
    let prev = -1;
    for (let i = here - 1; i >= 0; i--) if (!versions[i].branch) { prev = i; break; }
    const cell = main.querySelector(`tr[data-doc="${d.id}"] .rs-delta`);
    if (prev < 0) { cell.innerHTML = `<span class="rs-vnote">现存最早一版</span>`; continue; }
    const [now, before] = await Promise.all([loadDoc(d.id), loadDoc(versions[prev].doc.id)]).catch(() => [null, null]);
    if (my !== serial) return;
    if (!now?.html || !before?.html) { cell.innerHTML = `<span class="rs-vnote">未能读取</span>`; continue; }
    const a = articleMap(before.html), b = articleMap(now.html);
    if (!b.size) { cell.innerHTML = `<span class="rs-vnote">无条文编号</span>`; continue; }
    let changed = 0, added = 0, removed = 0;
    for (const [k, art] of b) { const old = a.get(k); if (!old) added++; else if (signature(old) !== signature(art)) changed++; }
    for (const k of a.keys()) if (!b.has(k)) removed++;
    const total = changed + added + removed;
    cell.innerHTML = total
      ? `<a class="rs-delta-link" href="${docHref(d.id)}" title="与 ${esc(versions[prev].label)} 对照"><span class="rs-mono">${esc(versions[prev].label)}</span>${changed ? `<b>改 ${changed}</b>` : ""}${added ? `<b>增 ${added}</b>` : ""}${removed ? `<b>删 ${removed}</b>` : ""}</a>`
      : `<span class="rs-vnote">与 ${esc(versions[prev].label)} 条文相同</span>`;
  }
}

/* ---------- 审计与测试（口径同原版审计面板） ---------- */

// CONFLICTS.md 原 F 编号表：编号 | 现行状态 | 规则位置 | 范围。只按“现行状态”列计数；表缺失或格式不符时返回 null（页面写“未提供”，不当作 0）。
function conflictStatusSummary(rows) {
  if (!Array.isArray(rows) || !rows.length || !rows.every((row) => row.length === 4 && /^F\d+$/.test(row[0]) && /^[A-Z][A-Z_]+$/.test(row[1]))) return null;
  return rows.reduce((counts, row) => { counts[row[1]] = (counts[row[1]] || 0) + 1; return counts; }, {});
}

function auditPage() {
  document.title = "审计与测试 · 白塔档案馆";
  const a = index.audit, total = (a.scenarioRows || []).length, pass = a.scenarios?.PASS || 0, conditional = a.scenarios?.CONDITIONAL || 0;
  const conflictCounts = conflictStatusSummary(a.conflictRows);
  const repaired = (a.candidateFindings || []).filter((r) => r[1] === "CANDIDATE_RESOLVED").length;
  const auditDate = byId.get(a.auditSource)?.date || "日期未标", scenarioDate = byId.get(a.scenarioSource)?.date || "日期未标";
  const openIssues = (a.issueRows || []).filter((r) => !/^已/.test(r[2] || "")).length;
  const at = (path) => docs.find((d) => d.path === path);
  const link = (id, label) => (id && byId.has(id) ? `<a class="rs-link" href="${docHref(id)}">${esc(label)}</a>` : "");
  const latest = byId.get(a.latest?.id);
  const tiles = [
    ["原 F 编号（OPEN）", conflictCounts ? conflictCounts.OPEN || 0 : "未提供", "原 F 编号登记，不含 EC / CC 队列", a.conflictSource],
    ["作者未决（现行登记）", openIssues, `议题表开放条目；OPEN_ISSUES.md ${a.issuesUpdated || "日期未标"} 更新`, a.issuesSource],
    ["整编底稿正文", index.counts.CANDIDATE || 0, "不含 CHANGELOG", at("00_PROJECT/CANDIDATE_CANON_INDEX.md")?.id],
    ["未来制度接口", a.futureInterfaces ?? "—", "IF 编号，现行登记", a.issuesSource],
  ];
  const statusCell = (v, i) => (i === 2 && /^(PASS|CONDITIONAL)$/.test(v) ? `<span class="rs-stamp${v === "PASS" ? " is-current" : " is-proposal"}">${esc(v)}</span>` : esc(v));
  const maxConflict = Math.max(1, ...Object.values(conflictCounts || {}));
  const register = at("00_PROJECT/HOLDINGS_REGISTER.md");
  const views = [["馆藏登记", register ? docHref(register.id) : "#/browse", index.counts.HOLDING], ["主题总目", "#/topics", index.topics.length], ["版本与关系", "#/versions", index.versionSets.length], ["作者设定", browseHref({ status: "AUTHOR_CANON" }), index.counts.AUTHOR_CANON], ["整编底稿", browseHref({ status: "CANDIDATE" }), index.counts.CANDIDATE], ["提案", browseHref({ status: "PROPOSAL" }), index.counts.PROPOSAL], ["未决事项", "#/issues", openIssues], ["项目总卷", browseHref({ collection: "00_PROJECT" }), docs.filter((d) => d.collection === "00_PROJECT").length], ["完整源文件目录", "#/browse?directory=1", docs.length]];
  main.innerHTML = `<div class="rs-page rs-audit">
    ${pageHead("Recensio", [], "审计与测试", "按来源口径展示现行冲突、作者未决与历史审计，各项注明来源日期。候选层面的修复不等于现行原件已改写。")}
    <nav class="rs-maint" aria-label="编校与维护">${views.map(([label, href, n]) => `<a href="${href}"><span>${label}</span><b>${n ?? "—"}</b></a>`).join("")}</nav>
    <dl class="rs-tiles">${tiles.map(([label, n, caption, id]) => `<div><dt>${esc(label)}</dt><dd><b>${esc(n)}</b><span>${esc(caption)}</span>${link(id, "查阅依据")}</dd></div>`).join("")}</dl>
    <div class="rs-audit-grid">
      <section class="rs-panel"><h2>场景推演${rubric("Probationes")}</h2><p class="rs-note">${esc(scenarioDate)} 的历史记录</p>
        <p>对 ${esc(scenarioDate)} 候选法典的文本推演，共 ${total} 项；CONDITIONAL 表示仍有条件与缺口，不计为通过。这是当时的历史记录，此后的修订版不会自动改变这些结果。</p>
        <div class="rs-composition rs-scenario" role="img" aria-label="PASS ${pass}，CONDITIONAL ${conditional}"><span class="is-current" data-grow="${pass}"></span><span class="is-proposal" data-grow="${conditional}"></span></div>
        <ul class="rs-legend"><li><span><i class="is-current"></i>PASS <b>${pass}</b></span></li><li><span><i class="is-proposal"></i>CONDITIONAL <b>${conditional}</b></span></li></ul>
        <p class="rs-panel-foot">这些结果来自项目场景文档，不是本网站的软件测试。${link(a.scenarioSource, "完整记录")}</p></section>
      ${decisionsPanel()}
      <section class="rs-panel rs-plaque"><h2>现行法典版本${rubric("Editio vigens")}</h2>
        ${latest ? `<a class="rs-latest" href="${docHref(latest.id)}"><b>${esc(latest.title)}</b><time>${esc(a.latest.date || "")}</time><p>现行正文 ${a.latest.count ?? "—"} 份。${esc(a.latest.status)}</p></a>` : ""}
        <p class="rs-panel-foot">${esc(auditDate)} 的候选一致性审计列 ${repaired} 项 CANDIDATE_RESOLVED，是当时候选层面的历史结论；与现行冲突表、跨文件 CC 记录口径不同，不相加为独立冲突总数。${link(a.auditSource, `查看 ${auditDate} 一致性审计`)} ${link(a.latest?.manifest, "机器清单")}</p></section>
    </div>
    <section class="rs-section">${sectionHead("", "原 F 编号记录的状态分布", "Controversiae", "按 CONFLICTS 原 F 编号表的“现行状态”列汇总。", link(a.conflictSource, "查阅 CONFLICTS.md"))}
      <p class="rs-intro">不与 EC、CC 等队列合计。没有 OPEN 记录不代表所有作者未决事项或来源风险已消失。</p>
      ${conflictCounts ? `<ul class="rs-bars rs-bars-wide">${Object.entries(conflictCounts).sort((x, y) => y[1] - x[1]).map(([status, n]) => `<li><span class="rs-bar-row"><span class="rs-mono">${esc(status)}</span><b>${n}</b><s><i data-w="${n / maxConflict}"></i></s></span></li>`).join("")}</ul>` : `<p class="rs-vnote">未提供：CONFLICTS.md 的原 F 编号表缺失或格式不符。</p>`}</section>
    <section class="rs-section">${sectionHead("", "当前作者未决", "Quaestiones", `以现行未决登记 OPEN_ISSUES.md 为准，${esc(a.issuesUpdated || "日期未标")} 更新。`, link(a.issuesSource, "查看现行登记"))}
      <p class="rs-intro">登记按时间分段、较新的在上，“登记”栏是该段的更新日期；${esc(auditDate)} 晋升时保留的作者级问题见下一节，较晚的答复写在其状态栏。</p>
      ${tableHTML(["登记", "议题", "状态", "说明"], a.issueRows || [], (v, i) => (i === 0 ? `<span class="rs-mono">${esc(v)}</span>` : i === 2 ? (/^已/.test(v) ? `<span class="rs-vnote">${esc(v)}</span>` : `<span class="rs-stamp is-proposal">${esc(v)}</span>`) : esc(v)))}</section>
    <section class="rs-section">${sectionHead("", `${auditDate} 保留的作者级问题`, "", `CC-A：晋升时保留 ${(a.authorRows || []).length} 项，现仍开放 ${a.authorUnresolved ?? "—"} 项；表格取自现行登记。`, link(a.auditSource, "原始审计（历史）"))}
      ${tableHTML(["编号", "原队列", "问题", "状态", "当前安全边界"], (a.authorRows || []).map((r) => [r[0], r[1], r[2], r[3], r[5] ?? ""]), (v, i) => (i < 2 ? `<span class="rs-mono">${esc(v)}</span>` : esc(v)))}</section>
    <section class="rs-section">${sectionHead("", "场景推演清单", "Casus", `${total} 项，${esc(scenarioDate)} 的候选法典推演。`, link(a.scenarioSource, "查阅依据与保留条件"))}
      ${tableHTML(["编号", "场景", "结果"], a.scenarioRows || [], (v, i) => (i === 0 ? `<span class="rs-mono">${esc(v)}</span>` : statusCell(v, i)))}</section>
    <section class="rs-section">${sectionHead("", "最近整编文件", "Acta", "先按声明日期，再按文件修改时间排列。")}
      <p class="rs-intro">不据此判定权威或版本先后。</p>
      <div class="rs-list">${(a.recent || []).map((id) => byId.get(id)).filter(Boolean).map((d) => rowHTML(d, "", "")).join("")}</div></section>
    <section class="rs-section">${sectionHead("", "索引覆盖与来源说明", "", "本次构建。")}
      <p class="rs-intro">${docs.length} 份文件已纳入，${index.textFiles} 份非空文本进入全文检索。Git 内部数据与程序缓存不列入馆藏，构建前后已逐文件核对 SHA256。主题使用目录与标题关键词，机构使用文本提及；状态依据在文献页列明，未声明的权威不会根据关键词自动提升。原始链接未定位 ${Object.values(relationships).reduce((n, r) => n + r.missing.length, 0)} 处，保留在对应文献页供追溯。</p>
      <p class="rs-record-line"><a class="rs-link" href="data/build-report.json" download>下载本次构建报告</a><a class="rs-link" href="data/source-manifest.json" download>下载源文件哈希清单</a></p></section>
  </div>`;
  setBars(main);
}
