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
const ISSUES_PATH = "00_PROJECT/OPEN_ISSUES.md";
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
function archiveReturnToResults(doc) {
  // Only when this document (or its provenance page) is the link last followed out of the remembered list:
  // the click handler below stores that href, and sessionStorage keeps it across reloads.
  const last = archiveLastBrowse, opened = /^#\/(?:doc|provenance)\/([^?]+)/.exec(archiveBrowseState(last).focusHref || "")?.[1] === doc.id;
  return last.startsWith("#/browse") && opened ? `<a class="return-results" href="${esc(last)}">← 返回检索结果</a><span class="breadcrumb-separator" aria-hidden="true">/</span>` : "";
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
// Phones with a keyword (main[data-search], set in route()): 文件状态 and 关联主题 wait inside 更多筛选 so the
// first result reaches the first screen. The selects move in the DOM, not only on screen, so tab and
// screen-reader order follow what is shown; the breakpoint is archive.css's phone width. When one of them
// has focus, or gets it back after a filter change (control), the disclosure opens so focus is not lost.
const archiveSearchPhone = matchMedia("(max-width:540px)");
function archiveFitSearchFilters(control = "") {
  const common = main.querySelector(".filter-common"), more = $("#catalogue-refinements");
  if (!common || !more) return;
  const tuck = archiveSearchPhone.matches && main.hasAttribute("data-search");
  if (tuck === (common.parentElement === more)) return;
  const focused = common.contains(document.activeElement) ? document.activeElement : null;
  if (tuck) {
    more.querySelector("summary").after(common);
    if (focused || ["status", "topic"].includes(control)) more.open = true;
  } else more.before(common);
  focused?.focus({preventScroll:true});
}
function browse(params) {
  main.innerHTML = prototypeBrowseShell(params);
  const viewState = archiveBrowseState(location.hash);
  if (typeof viewState.expanded === "boolean") $("#catalogue-refinements").open = viewState.expanded;
  archiveFitSearchFilters(viewState.control);
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
    // Equal relevance: current canon first, superseded versions last, path order within each group.
    const rank = (r) => ({ CURRENT_CANON: 0, SUPERSEDED: 2 })[byId.get(r.id).status] ?? 1;
    rows.sort((a, b) =>
      sort === "current"
        ? Number(byId.get(b.id).status === "CURRENT_CANON") - Number(byId.get(a.id).status === "CURRENT_CANON") || byId.get(a.id).path.localeCompare(byId.get(b.id).path, "zh-CN")
        : sort === "title"
        ? byId.get(a.id).title.localeCompare(byId.get(b.id).title, "zh-CN")
        : sort === "modified"
          ? byId.get(b.id).modified.localeCompare(byId.get(a.id).modified)
          : b.score - a.score || rank(a) - rank(b) ||
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
  // The consolidation audit and the scenario review describe the 2026-09-18 candidates; show their dates.
  const auditDate = byId.get(a.auditSource)?.date || "日期未标",
    scenarioDate = byId.get(a.scenarioSource)?.date || "日期未标";
  main.innerHTML =
    heading(
      "项目编校资料 / 审计与复核",
      "审计与测试",
      "按来源口径展示现行冲突、作者未决与历史审计，各项注明来源日期。候选层面的修复不等于现行原件已改写。",
    ) +
    `<dl class="audit-summary-register">${[
      [
        "原 F 编号 · OPEN",
        conflictCounts ? conflictCounts.OPEN || 0 : null,
        "原 F 编号登记，不含 EC / CC 队列",
        a.conflictSource,
      ],
      [
        "作者未决 · 现行登记",
        // Count the open rows of the register's 议题 tables; the date goes in the caption so phones do not split it.
        a.issueRows ? a.issueRows.filter((r) => !/^已/.test(r[2] || "")).length : null,
        `议题表开放条目；OPEN_ISSUES.md ${esc(a.issuesUpdated || "日期未标")} 更新，分段见下`,
        a.issuesSource,
      ],
      [
        "整编底稿正文",
        index.counts.CANDIDATE || 0,
        "不含 CHANGELOG",
        docAt("00_PROJECT/CANDIDATE_CANON_INDEX.md")?.id,
      ],
      ["未来制度接口", a.futureInterfaces, "IF 编号，现行登记", a.issuesSource],
    ]
      .map(
        ([label, n, caption, id]) =>
          `<div><dt>${label}</dt><dd><strong>${n ?? "未提供"}</strong><span>${caption}</span>${linkDoc(id, "查阅依据")}</dd></div>`,
      )
      .join("")}</dl>
 <div class="audit-grid"><section class="panel"><div class="section-head"><h2>场景推演 · ${esc(scenarioDate)}</h2>${linkDoc(a.scenarioSource, "完整记录 →")}</div><p>对 ${esc(scenarioDate)} 候选法典的文本推演，共 ${total} 项；CONDITIONAL 表示仍有条件与缺口，不计为通过。这是当时的历史记录，此后的修订版不会自动改变这些结果。</p><progress class="scenario-progress" value="${pass}" max="${total || 1}" aria-label="无条件文本推演通过 ${pass} / ${total}"></progress><div class="legend"><span>PASS · ${pass}</span><span>CONDITIONAL · ${conditional}</span></div><p class="row-meta">这些结果来自项目场景文档，不是本次网站的软件测试。</p></section>
 <section class="panel"><div class="section-head"><h2>现行法典版本</h2>${linkDoc(a.latest.id, "修订记录 →")}</div><span class="badge">${latestLabel()}</span><p>${esc(byId.get(a.latest.id)?.title || "修订记录")}：现行正文 ${a.latest.count ?? "—"} 份，${esc(a.latest.date || "日期未标")} 批准。${linkDoc(a.latest.manifest, "机器清单")}</p><p>${esc(a.latest.status)}</p><p class="row-meta">${esc(auditDate)} 的候选一致性审计列 ${repaired} 项 CANDIDATE_RESOLVED，是当时候选层面的历史结论；与现行冲突表、跨文件 CC 记录口径不同，不相加为独立冲突总数。</p>${linkDoc(a.auditSource, `查看 ${auditDate} 一致性审计 →`)}</section></div>
 <section class="section"><h2>原 F 编号记录的状态分布</h2><p class="muted">按 CONFLICTS 原 F 编号表的“现行状态”列汇总，不与 EC、CC 等队列合计。没有 OPEN 记录不代表所有作者未决事项或来源风险已消失。适用范围与本批修订结果请查阅 ${linkDoc(a.conflictSource, "CONFLICTS.md")}。</p>${dataTable(["状态", "记录数"], Object.entries(conflictCounts || {}))}</section>
 <section class="section"><div class="section-head"><h2>当前作者未决</h2>${linkDoc(a.issuesSource, "查看现行登记 →")}</div><p class="muted">以现行未决登记 OPEN_ISSUES.md（${esc(a.issuesUpdated || "日期未标")} 更新）为准。登记按时间分段、较新的在上，下表“登记”栏是该段的更新日期；${esc(auditDate)} 晋升时保留的作者级问题见下一节，较晚的答复写在其状态栏。</p>${dataTable(["登记", "议题", "状态", "说明"], a.issueRows || [])}</section>
 <section class="section"><div class="section-head"><h2>${esc(auditDate)} 保留的作者级问题（CC-A）</h2>${linkDoc(a.auditSource, "原始审计（历史）→")}</div><p class="muted">晋升时保留 ${a.authorRows.length} 项，现仍开放 ${a.authorUnresolved ?? "—"} 项；表格取自现行登记。早期 AU / Q 队列按原始文档保留。</p>${dataTable(["编号", "原队列", "问题", "状态", "当前安全边界"], a.authorRows.map((r) => [r[0], r[1], r[2], r[3], r[5] ?? ""]))}</section>
 <section class="section"><div class="section-head"><h2>场景推演清单 · ${esc(scenarioDate)}</h2>${linkDoc(a.scenarioSource, "查阅依据与保留条件 →")}</div>${dataTable(["编号", "场景", "结果"], a.scenarioRows)}</section>
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
  if (page === "issues") {
    // The sidebar's "未决事项" opens the author's open-issues register; the UNRESOLVED filter is empty since 2026-09-25.
    const issues = docAt(ISSUES_PATH);
    location.replace(issues ? "#/doc/" + issues.id : browseUrl({ status: "UNRESOLVED" }));
    return;
  }
  if (archiveWithinReader(page, targetDoc, params)) return;
  archiveEnter(page);
  delete main.dataset.readerId;
  main.classList.add("prototype");
  main.dataset.view = page;
  main.toggleAttribute("data-search", page === "browse" && !!params.get("q")?.trim());
  const navByStatus = { CURRENT_CANON: "canon", SUPERSEDED: "archive", CANDIDATE: "candidate", AUTHOR_CANON: "author", PROPOSAL: "proposal", UNRESOLVED: "unresolved" };
  let activeNav = page;
  if (page === "provenance") activeNav = "archive";
  else if (page === "institution") activeNav = "institutions";
  else if (page === "doc") activeNav = targetDoc?.path === ISSUES_PATH ? "unresolved" : navByStatus[targetDoc?.status] || (targetDoc?.collection === "07_WORLD_GUIDE" ? "guide" : targetDoc?.collection === "90_AUDIT" ? "audit" : targetDoc?.collection === "00_PROJECT" ? "project" : "browse");
  else if (page === "browse") activeNav = params.has("directory") || params.has("path") ? "directory" : params.get("topic") ? "topics" : params.get("institution") ? "institutions" : params.get("collection") === "07_WORLD_GUIDE" ? "guide" : params.get("collection") === "00_PROJECT" ? "project" : params.get("collection") === "90_AUDIT" ? "audit" : navByStatus[params.get("status")] || "browse";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active = a.dataset.nav === activeNav;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const maintenanceNav = $("#maintenance-nav"), maintenanceActive = maintenanceNav.querySelector("a.active")?.dataset.nav || ""; if (maintenanceActive && maintenanceActive !== maintenanceNav.dataset.entered) maintenanceNav.open = true; maintenanceNav.dataset.entered = maintenanceActive;
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
    // The sidebar's 编校与维护 group starts folded; route() unfolds it on its own pages. The state lasts for the session.
    const maintenanceNav = $("#maintenance-nav");
    try { if (sessionStorage.getItem("baita-nav-maintenance") === "open") maintenanceNav.open = true; } catch (_) { /* Storage is optional. */ }
    maintenanceNav.addEventListener("toggle", () => {
      try { sessionStorage.setItem("baita-nav-maintenance", maintenanceNav.open ? "open" : "closed"); } catch (_) { /* Storage is optional. */ }
    });
    window.addEventListener("hashchange", route);
    $("#global-search").addEventListener("submit", (e) => {
      e.preventDefault();
      location.hash =
        "/browse?" + new URLSearchParams({ q: $("#global-query").value });
    });
    $("#menu-toggle").addEventListener("click", () => {
      // The reader docks the sidebar on desktop and only collapses it; phones use the drawer.
      if (bookNavDocked()) { bookToggleNav(); return; }
      const open = $("#sidebar").classList.toggle("open");
      $("#menu-toggle").setAttribute("aria-expanded", String(open));
      archiveNavSync();
      // A folded group hides its active link; focus that group's summary instead.
      const active = $("#sidebar a.active");
      if (open) (active?.closest("details:not([open])")?.querySelector("summary") || active || $("#sidebar a")).focus();
    });
    document.addEventListener("click", event => {
      if (!event.target.closest("#sidebar, #menu-toggle, .reader-dialog") && $("#sidebar").classList.contains("open") && (!document.body.dataset.bookReader || matchMedia("(max-width:780px)").matches)) {
        $("#sidebar").classList.remove("open");
        $("#menu-toggle").setAttribute("aria-expanded", "false");
  archiveNavSync();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && $("#sidebar").classList.contains("open") && (!document.body.dataset.bookReader || matchMedia("(max-width:780px)").matches)) {
        const targets = [$("#menu-toggle"), ...document.querySelectorAll("#sidebar a, #sidebar button, #sidebar select, #sidebar summary")].filter(e => e.getClientRects().length && !e.disabled && !e.closest("details:not([open]) > :not(summary)"));
        const at = targets.indexOf(document.activeElement);
        if (at >= 0) {event.preventDefault(); targets[(at + (event.shiftKey ? targets.length - 1 : 1)) % targets.length].focus();}
      }
      if (
        event.key === "/" &&
        !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
      ) {
        event.preventDefault();
        // Above phone width the home page shows only the hero search; "/" focuses whichever box is on screen.
        const box = [$("#global-query"), $("#hero-query")].find((e) => e && e.getClientRects().length);
        // The tablet drawer covers the hero search, so close it before focusing there.
        if (box?.id === "hero-query" && $("#sidebar").classList.contains("open")) {
          $("#sidebar").classList.remove("open");
          archiveNavSync();
        }
        if (box) box.focus();
      }
      if (event.key === "Escape" && !document.querySelector(".reader-dialog[open]")) {
        const wasOpen = $("#sidebar").classList.contains("open");
        $("#sidebar").classList.remove("open");
        $("#menu-toggle").setAttribute("aria-expanded", "false");
  archiveNavSync();
        if (wasOpen) $("#menu-toggle").focus();
      }
    });
    archiveNavSync();
    matchMedia("(max-width:780px)").addEventListener("change",archiveNavSync);
    archiveSearchPhone.addEventListener("change",()=>archiveFitSearchFilters());
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
