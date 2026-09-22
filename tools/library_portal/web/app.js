"use strict";
const $ = (s, root = document) => root.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const labels = {
  AUTHOR_CANON: "作者设定",
  CURRENT_CANON: "现行正文",
  PROPOSAL: "提案",
  UNRESOLVED: "待决材料",
  SUPERSEDED: "旧版正文",
  REFERENCE: "参考材料",
  DELEGATED_DESIGN: "授权设计",
  CANDIDATE: "整编底稿",
};
let index,
  docs,
  byId,
  relationships,
  worker,
  requestId = 0,
  routeSerial = 0;
const main = $("#main");
const latestLabel = () => index.audit.latest.status.includes("AWAITING_WHOLE_SET_REVIEW")
  ? "候选整编待整体审核" : "最新整编记录";

const linkDoc = (id, text) =>
  id && byId.has(id)
    ? `<a href="#/doc/${id}">${esc(text || displayTitle(byId.get(id)))}</a>`
    : esc(text || "未提供");
const docAt = (path) => docs.find((d) => d.path === path);
const docLink = (path, label) => linkDoc(docAt(path)?.id, label);
const GUIDE_PATH = "07_WORLD_GUIDE/银色联盟风土志.md";
const browseUrl = (params) => "#/browse?" + new URLSearchParams(params);
const dateOnly = (value) => (value ? value.slice(0, 10) : "未标注");
function heading(kicker, title, desc = "") {
  return pageHeading(title, desc, kicker);
}
function highlight(value, query) {
  let text = String(value || "");
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return esc(text);
  const pattern = new RegExp(
    terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "giu",
  );
  let result = "",
    last = 0;
  for (const match of text.matchAll(pattern)) {
    result +=
      esc(text.slice(last, match.index)) + "<mark>" + esc(match[0]) + "</mark>";
    last = match.index + match[0].length;
  }
  return result + esc(text.slice(last));
}
function docRow(doc, query = "", snippet = "") {
  return prototypeDocumentRow(doc, query, snippet);
}
function home() { return archiveHome(routeSerial); }
function treeNode(node, prefix = "", selected = "", depth = 0) {
  return (
    Object.keys(node.dirs)
      .sort()
      .map((name) => {
        const path = prefix ? prefix + "/" + name : name;
        return `<details ${selected.startsWith(path + "/") || selected === path ? "open" : ""}><summary><a href="${browseUrl({ path })}">${esc(index.collections[name] || name)}</a></summary>${treeNode(node.dirs[name], path, selected, depth + 1)}</details>`;
      })
      .join("") +
    node.files
      .map(
        (d) =>
          `<a class="tree-file ${selected === d.path ? "active" : ""}" href="#/doc/${d.id}">${esc(d.name)}</a>`,
      )
      .join("")
  );
}
function tree(selected = "") {
  const root = { dirs: {}, files: [] };
  for (const doc of docs) {
    let node = root;
    const parts = doc.path.split("/");
    for (const part of parts.slice(0, -1))
      node = node.dirs[part] ??= { dirs: {}, files: [] };
    node.files.push(doc);
  }
  return `<aside class="directory-tree"><h3>馆藏目录</h3><a href="#/browse">全部文件 · ${docs.length}</a>${treeNode(root, "", selected)}</aside>`;
}
function options(values, current, label) {
  return (
    `<option value="">${label}</option>` +
    values
      .map(
        ([value, text]) =>
          `<option value="${esc(value)}" ${current === value ? "selected" : ""}>${esc(text)}</option>`,
      )
      .join("")
  );
}
// URL parameters remain the source of truth. Session snapshots restore the
// browsing position only after synchronous or Worker search results exist.
let archiveListViews = {}, archiveRenderedBrowse = "", archiveLastBrowse = "", archiveRestoring = false;
const archiveStateKey = "baita-browse-v3";
function archiveBrowseState(hash) { return archiveListViews[hash] || {}; }
function archivePersistBrowse() {
  try { sessionStorage.setItem(archiveStateKey, JSON.stringify({builtAt:index.builtAt, views:archiveListViews, last:archiveLastBrowse})); } catch (_) { /* Storage is optional. */ }
}
function archiveSaveBrowse() {
  if (!archiveRenderedBrowse || !$("#filters") || archiveRestoring) return;
  const current = archiveBrowseState(archiveRenderedBrowse);
  archiveListViews[archiveRenderedBrowse] = {...current, y:window.scrollY, expanded:$("#catalogue-refinements").open,
    openRows:[...main.querySelectorAll('.row-source[open]')].map(el=>el.closest('[data-document]').dataset.document)};
  archivePersistBrowse();
}
function archiveRestoreBrowse() {
  const hash = location.hash, serial = routeSerial, state = archiveBrowseState(hash);
  archiveRenderedBrowse = hash; archiveLastBrowse = hash; archiveRestoring = true;
  for (const id of state.openRows || []) { const row = main.querySelector(`[data-document="${CSS.escape(id)}"] .row-source`); if (row) row.open = true; }
  const apply = () => {
    if (serial !== routeSerial) return;
    const focus = state.control ? (state.control === "sort" ? $("#sort") : $("#filters").elements.namedItem(state.control))
      : state.focusHref ? [...main.querySelectorAll("a[href]")].find(a=>a.getAttribute("href")===state.focusHref) : null;
    focus?.focus({preventScroll:true});
    window.scrollTo(0, Number(state.y) || 0);
    archiveRestoring = false; archivePersistBrowse();
  };
  // Font readiness matters on first offline load; otherwise rows move after restore.
  document.fonts.ready.then(()=>requestAnimationFrame(()=>requestAnimationFrame(apply)));
}
function archiveReturnToResults() {
  return archiveLastBrowse.startsWith("#/browse") ? `<a class="return-results" href="${esc(archiveLastBrowse)}">← 返回检索结果</a><span class="breadcrumb-separator" aria-hidden="true">/</span>` : "";
}
function archiveStartBrowseMemory() {
  history.scrollRestoration = "manual";
  try {
    const saved = JSON.parse(sessionStorage.getItem(archiveStateKey) || "null");
    if (saved?.builtAt === index.builtAt) {archiveListViews=saved.views || {};archiveLastBrowse=saved.last || "";}
  } catch (_) { /* A malformed or disabled store must not affect navigation. */ }
  let timer;
  window.addEventListener("scroll",()=>{clearTimeout(timer);timer=setTimeout(archiveSaveBrowse,120);},{passive:true});
  window.addEventListener("pagehide",archiveSaveBrowse);
  document.addEventListener("click",event=>{
    if (!archiveRenderedBrowse || !$("#filters")) return;
    const link=event.target.closest("a[href]");
    if(link){archiveSaveBrowse();archiveListViews[archiveRenderedBrowse]={...archiveBrowseState(archiveRenderedBrowse),focusHref:link.getAttribute("href"),control:null};archivePersistBrowse();}
  });
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape")return;
    const open=main.querySelector(".more-actions[open]");
    if(open){open.open=false;open.querySelector("summary").focus();}
  });
  document.addEventListener("click",event=>{
    main.querySelectorAll(".more-actions[open]").forEach(open=>{if(!open.contains(event.target))open.open=false;});
  });
}
function browse(params) {
  main.innerHTML = prototypeBrowseShell(params);
  const viewState = archiveBrowseState(location.hash);
  if (typeof viewState.expanded === "boolean") $("#catalogue-refinements").open = viewState.expanded;
  const form = $("#filters");
  function submit(event) {
    event?.preventDefault();
    const values = new URLSearchParams(new FormData(form));
    for (const [k, v] of [...values]) if (!v) values.delete(k);
    const sort = $("#sort").value;
    if (sort) values.set("sort", sort);
    archiveSaveBrowse();
    const nextHash = "#/browse?" + values;
    archiveListViews[nextHash] = {...archiveBrowseState(nextHash), y:0, expanded:$("#catalogue-refinements").open, control:event?.target === form ? "query" : event?.target?.name || event?.target?.id || "query"};
    location.hash = "/browse?" + values;
  }
  form.addEventListener("submit", submit);
  form
    .querySelectorAll("select")
    .forEach((el) => el.addEventListener("change", submit));
  $("#sort").addEventListener("change", submit);
  const filtered = docs.filter(
    (d) =>
      (!params.get("status") || d.status === params.get("status")) &&
      (!params.get("topic") || d.topics.includes(params.get("topic"))) &&
      (!params.get("institution") ||
        d.institutions.includes(params.get("institution"))) &&
      (!params.get("collection") ||
        d.collection === params.get("collection")) &&
      (!params.get("kind") || d.kind === params.get("kind")) &&
      (!params.get("path") || d.path.startsWith(params.get("path") + "/")),
  );
  const current = ++requestId;
  const query = params.get("q") || "";
  function renderResults(rows) {
    if (current !== requestId) return;
    const sort = params.get("sort") || (params.get("q") ? "relevance" : "current");
    rows.sort((a, b) =>
      sort === "current"
        ? Number(byId.get(b.id).status === "CURRENT_CANON") - Number(byId.get(a.id).status === "CURRENT_CANON") || byId.get(a.id).path.localeCompare(byId.get(b.id).path, "zh-CN")
        : sort === "title"
        ? byId.get(a.id).title.localeCompare(byId.get(b.id).title, "zh-CN")
        : sort === "modified"
          ? byId.get(b.id).modified.localeCompare(byId.get(a.id).modified)
          : b.score - a.score ||
            byId.get(a.id).path.localeCompare(byId.get(b.id).path, "zh-CN"),
    );
    const page = Math.min(
      Math.max(1, Math.floor(Number(params.get("page"))) || 1),
      Math.max(1, Math.ceil(rows.length / 25)),
    );
    $("#result-count").textContent =
      `${rows.length} 份匹配文件${query ? " · 搜索完成" : ""}`;
    $("#results").innerHTML = rows.length
      ? `<div class="doc-list">${rows
          .slice((page - 1) * 25, page * 25)
          .map((r) => docRow(byId.get(r.id), query, r.snippet))
          .join("")}</div>`
      : emptyState("没有找到匹配的档案", "尝试减少关键词，或通过上方条件逐项清除筛选。");
    $("#pagination").innerHTML =
      rows.length > 25
        ? `<div class="pagination"><button id="prev" ${page <= 1 ? "disabled" : ""}>上一页</button><span>第 ${page} / ${Math.ceil(rows.length / 25)} 页</span><button id="next" ${page * 25 >= rows.length ? "disabled" : ""}>下一页</button></div>`
        : "";
    for (const [id, delta] of [
      ["prev", -1],
      ["next", 1],
    ])
          $("#" + id)?.addEventListener("click", () => {
        const next = new URLSearchParams(params);
        next.set("page", page + delta);
        location.hash = "/browse?" + next;
      });
    archiveRestoreBrowse();
  }
  if (!query.trim()) {
    renderResults(filtered.map((d) => ({ id: d.id, score: 0, snippet: "" })));
    return;
  }
  worker.onmessage = ({ data }) => {
    if (current !== requestId) return;
    if (data.type === "progress")
      $("#result-count").textContent =
        `首次载入全文索引 ${data.done}/${data.total}，页面可继续操作…`;
    else if (data.request === current && data.type === "results")
      renderResults(data.results);
    else if (data.request === current && data.type === "error") {
      $("#result-count").textContent = "检索失败";
      $("#results").innerHTML =
        `<div class="empty">${esc(data.message)}。请刷新页面重试。</div>`;
      archiveRestoreBrowse();
    }
  };
  worker.postMessage({
    type: "search",
    request: current,
    query,
    scope: params.get("scope"),
    shards: index.searchShards,
    documents: filtered.map((d) => ({
      id: d.id,
      title: d.title,
      name: d.name,
      path: d.path,
      alias: d.alias,
      institutions: d.institutions,
      topics: d.topics,
    })),
  });
}
function catalogue(type) { archiveCatalogue(type); }
function relationLinks(ids, empty = "暂无记录") {
  return ids.length
    ? ids.map((id) => linkDoc(id)).join("")
    : `<span class="muted">${empty}</span>`;
}
async function detail(id, params, serial) {
  const doc = byId.get(id);
  if (!doc) { main.innerHTML = emptyState("文件未入藏", "该文件不在当前索引中，请返回馆藏查找。"); return; }
  document.title = doc.title + " / " + index.title;
  if (doc.path === GUIDE_PATH && params.get("view") !== "record") { await bookDetail(doc, params, serial); return; }
  await prototypeDetail(doc, params, serial);
}
function versions() { versionPage(); }
function dataTable(headers, rows) {
  if (!rows.length) return '<p class="catalogue-note">当前索引未提供可展示的条目，请查阅本节来源文件。</p>';
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(headers.join('、'))}，可横向滚动"><table class="data-table"><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function audit() {
  main.dataset.view = "maintenance";
  document.title = "审计与测试 / " + index.title;
  const a = index.audit,
    total = a.scenarioRows.length,
    pass = a.scenarios.PASS || 0,
    conditional = a.scenarios.CONDITIONAL || 0;
  const conflictCounts = conflictStatusSummary(a.conflictRows);
  const repaired = a.candidateFindings.filter(
    (r) => r[1] === "CANDIDATE_RESOLVED",
  ).length;
  main.innerHTML =
    heading(
      "项目编校资料 / 审计与复核",
      "审计与测试",
      "按来源口径展示现行冲突、候选整编与保留问题。候选层面的修复不等于现行原件已改写。",
    ) +
    `<dl class="audit-summary-register">${[
      [
        "原 F 编号 · OPEN",
        conflictCounts ? conflictCounts.OPEN || 0 : null,
        "原 F 编号登记，不含 EC / CC 队列",
        a.conflictSource,
      ],
      [
        "作者未决 · AUTHOR_ONLY",
        a.authorUnresolved,
        "最新候选审计口径",
        a.auditSource,
      ],
      [
        "整编底稿正文",
        index.counts.CANDIDATE || 0,
        "不含 CHANGELOG",
        docAt("00_PROJECT/CANDIDATE_CANON_INDEX.md")?.id,
      ],
      ["未来制度接口", a.futureInterfaces, "IF 编号登记", a.auditSource],
    ]
      .map(
        ([label, n, caption, id]) =>
          `<div><dt>${label}</dt><dd><strong>${n ?? "未提供"}</strong><span>${caption}</span>${linkDoc(id, "查阅依据")}</dd></div>`,
      )
      .join("")}</dl>
 <div class="audit-grid"><section class="panel"><div class="section-head"><h2>场景测试概况</h2>${linkDoc(a.scenarioSource, "完整记录 →")}</div><p>对候选法典的文本推演，共 ${total} 项；CONDITIONAL 表示仍有条件与缺口，不计为通过。</p><progress class="scenario-progress" value="${pass}" max="${total || 1}" aria-label="无条件文本推演通过 ${pass} / ${total}"></progress><div class="legend"><span>PASS · ${pass}</span><span>CONDITIONAL · ${conditional}</span></div><p class="row-meta">这些结果来自项目场景文档，不是本次网站的软件测试。</p></section>
 <section class="panel"><div class="section-head"><h2>最新整编状态</h2>${linkDoc(a.latest.id, "整编报告 →")}</div><span class="badge">${latestLabel()}</span><p>${esc(a.latest.status)}</p><p>候选审计列 ${repaired} 项 CANDIDATE_RESOLVED；与现行冲突表、跨文件 CC 记录口径不同，不相加为独立冲突总数。</p>${linkDoc(a.auditSource, "查看完整一致性审计 →")}</section></div>
 <section class="section"><h2>原 F 编号记录的状态分布</h2><p class="muted">按 CONFLICTS 原 F 编号表的“现行状态”列汇总，不与 EC、CC 等队列合计。没有 OPEN 记录不代表所有作者未决事项或来源风险已消失。适用范围与本批修订结果请查阅 ${linkDoc(a.conflictSource, "CONFLICTS.md")}。</p>${dataTable(["状态", "记录数"], Object.entries(conflictCounts || {}))}</section>
 <section class="section"><div class="section-head"><h2>场景推演清单</h2>${linkDoc(a.scenarioSource, "查阅依据与保留条件 →")}</div>${dataTable(["编号", "场景", "结果"], a.scenarioRows)}</section>
 <section class="section"><div class="section-head"><h2>作者未决问题</h2>${linkDoc(a.auditSource, "查看原始登记 →")}</div><p class="muted">以下 ${a.authorUnresolved ?? "—"} 项采用最新整编审计 CC-A 口径；早期 AU / Q 队列按原始文档保留。</p>${dataTable(["编号", "原队列", "问题", "作者依据", "保留边界"], a.authorRows)}</section>
 <section class="section"><h2>最近整编文件</h2><p class="muted">优先按文件声明日期，再按文件系统修改时间排列；不据此判定权威或版本先后。</p><div class="doc-list">${a.recent.map((id) => docRow(byId.get(id))).join("")}</div></section>
 <section class="section panel"><h2>索引覆盖与来源说明</h2><p>${docs.length} 份文件已纳入，${index.textFiles} 份非空文本进入全文检索。Git 内部数据与程序缓存不列入馆藏。构建前后已逐文件核对 SHA256。</p><p>主题使用目录与标题关键词，机构使用文本提及；状态依据会在详情页列明。未声明的权威不会根据关键词自动提升。</p><p>原始链接未定位 ${Object.values(relationships).reduce((n, r) => n + r.missing.length, 0)} 处，保留在对应详情页供追溯。</p>${
   index.warnings.length
     ? `<details class="disclosure"><summary>${index.warnings.length} 份文件未进入正文索引</summary>${dataTable(
         ["文件", "原因"],
         index.warnings.map((w) => [w.path, w.kind]),
       )}</details>`
     : ""
 }<a href="data/build-report.json" download>下载本次构建报告</a> · <a href="data/source-manifest.json" download>下载源文件哈希清单</a></section>`;
}
async function route() {
  // Do not let late scroll events from another route overwrite this snapshot.
  archiveRenderedBrowse = "";
  archiveRestoring = false;
  const serial = ++routeSerial;
  ++requestId;
  const raw = (location.hash || "#/home").slice(1);
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const page = parts[0] || "home";
  const params = new URLSearchParams(query);
  const targetDoc = byId.get(parts[1]);
  if (page === "guide") {
    const guide = docAt(GUIDE_PATH);
    location.replace(guide ? "#/doc/" + guide.id : browseUrl({ collection: "07_WORLD_GUIDE" }));
    return;
  }
  if (archiveWithinReader(page, targetDoc, params)) return;
  archiveEnter(page);
  delete main.dataset.readerId;
  main.classList.add("prototype");
  main.dataset.view = page;
  const navByStatus = { CURRENT_CANON: "canon", SUPERSEDED: "archive", CANDIDATE: "candidate", AUTHOR_CANON: "author", PROPOSAL: "proposal", UNRESOLVED: "unresolved" };
  let activeNav = page;
  if (page === "provenance") activeNav = "archive";
  else if (page === "institution") activeNav = "institutions";
  else if (page === "doc") activeNav = navByStatus[targetDoc?.status] || (targetDoc?.collection === "07_WORLD_GUIDE" ? "guide" : targetDoc?.collection === "90_AUDIT" ? "audit" : targetDoc?.collection === "00_PROJECT" ? "project" : "browse");
  else if (page === "browse") activeNav = params.has("directory") || params.has("path") ? "directory" : params.get("topic") ? "topics" : params.get("institution") ? "institutions" : params.get("collection") === "07_WORLD_GUIDE" ? "guide" : params.get("collection") === "00_PROJECT" ? "project" : params.get("collection") === "90_AUDIT" ? "audit" : navByStatus[params.get("status")] || "browse";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active = a.dataset.nav === activeNav;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const sidebarWasOpen = $("#sidebar").classList.contains("open");
  $("#sidebar").classList.remove("open");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  archiveNavSync();
  // Scroll only the navigation well: never move the reading page to reveal a menu item.
  const navScroll = $(".sidebar-scroll"), activeLink = $(".sidebar a.active");
  if (activeLink) {
    const item = activeLink.getBoundingClientRect(), well = navScroll.getBoundingClientRect();
    if (item.bottom > well.bottom) navScroll.scrollTop += item.bottom - well.bottom + 8;
    if (item.top < well.top) navScroll.scrollTop -= well.top - item.top + 8;
  }
  document.title = "白塔档案馆 · 银色联盟法典库";
  try {
    if (page === "home") await home();
    else if (page === "browse") { browse(params); institutionLegacyBanner(params); }
    else if (page === "topics") catalogue(page);
    else if (page === "institutions") institutionDirectory(params);
    else if (page === "institution") institutionDetail(parts[1], params);
    else if (page === "doc") await detail(parts[1], params, serial);
    else if (page === "provenance") {
      if (!targetDoc) throw new Error("该文件不在当前馆藏索引中，请返回全部馆藏查找。");
      document.title = targetDoc.title + " / " + index.title;
      await prototypeDetail(targetDoc, params, serial, true);
    }
    else if (page === "versions") versions();
    else if (page === "audit") audit();
    else
      main.innerHTML = emptyState("此页面未入藏", "请从馆藏或导航入口继续查阅。", "#/home", "返回首页");
  } catch (error) {
    if (serial !== routeSerial) return;
    main.innerHTML = emptyState("未能读取该页面", error.message);
  }
  if (serial === routeSerial && page !== "browse" && page !== "institutions" && page !== "institution" && !params.get("anchor") && !params.get("section")) window.scrollTo(0, 0);
  if (serial === routeSerial && sidebarWasOpen) main.focus({preventScroll:true});
}
async function start() {
  if (location.protocol === "file:") {
    main.innerHTML =
      '<div class="empty"><h1>请通过本地服务打开档案馆</h1><p>在项目根目录运行：</p><pre>python tools/library_portal/serve.py</pre><p>然后访问 http://127.0.0.1:8765</p></div>';
    return;
  }
  try {
    const responses = await Promise.all([
      fetch("data/metadata.json"),
      fetch("data/relationships.json"),
      fetch("data/institutions.json"),
    ]);
    if (responses.some((r) => !r.ok))
      throw new Error("索引缺失，请先重新构建站点");
    [index, relationships, institutionRegistry] = await Promise.all(responses.map((r) => r.json()));
    docs = index.documents;
    byId = new Map(docs.map((d) => [d.id, d]));
    archiveStartBrowseMemory();
    worker = new Worker("search-worker.js");
    worker.onerror = () => {
      const result = $("#result-count");
      if (result) result.textContent = "搜索线程启动失败，请刷新后重试。";
    };
    $("#build-date").innerHTML =
      "<span>索引更新 " + esc(dateOnly(index.builtAt)) + "</span> · <span>" + docs.length + " 份文件</span>";
    window.addEventListener("hashchange", route);
    $("#global-search").addEventListener("submit", (e) => {
      e.preventDefault();
      location.hash =
        "/browse?" + new URLSearchParams({ q: $("#global-query").value });
    });
    $("#menu-toggle").addEventListener("click", () => {
      const open = $("#sidebar").classList.toggle("open");
      $("#menu-toggle").setAttribute("aria-expanded", String(open));
      archiveNavSync();
      if (open) ($("#sidebar a.active") || $("#sidebar a")).focus();
    });
    document.addEventListener("click", event => {
      if (!event.target.closest("#sidebar, #menu-toggle") && $("#sidebar").classList.contains("open")) {
        $("#sidebar").classList.remove("open");
        $("#menu-toggle").setAttribute("aria-expanded", "false");
  archiveNavSync();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && $("#sidebar").classList.contains("open")) {
        const targets = [$("#menu-toggle"), ...document.querySelectorAll("#sidebar a")];
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
      }
      if (
        event.key === "/" &&
        !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
      ) {
        event.preventDefault();
        $("#global-query").focus();
      }
      if (event.key === "Escape") {
        const wasOpen = $("#sidebar").classList.contains("open");
        $("#sidebar").classList.remove("open");
        $("#menu-toggle").setAttribute("aria-expanded", "false");
  archiveNavSync();
        if (wasOpen) $("#menu-toggle").focus();
      }
    });
    archiveNavSync();
    matchMedia("(max-width:780px)").addEventListener("change",archiveNavSync);
    await route();
  } catch (error) {
    main.innerHTML = `<div class="empty"><h1>档案馆暂未就绪</h1><p>${esc(error.message)}</p><p>请运行 build.py 后，通过 serve.py 重新打开。</p></div>`;
  }
}
$(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView();
});
start();
