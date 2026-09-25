"use strict";

// Presentation-only components. All status and relationship values come from the index.
function silverWeave() { return silverOrnament(); }
function prototypeStatusLabel(status) {
  return labels[status] || status;
}
function pageHeading(title, description, context = "") {
  return `<header class="catalogue-heading">${silverWeave()}${context ? `<p class="page-context">${esc(context)}</p>` : ""}<h1>${esc(title)}</h1><p>${esc(description)}</p></header>`;
}
function emptyState(title, message, href = "#/browse", label = "返回全部馆藏") {
  return `<section class="empty" role="status"><h2>${esc(title)}</h2><p>${esc(message)}</p><a href="${esc(href)}">${esc(label)}</a></section>`;
}
function conflictStatusSummary(rows) {
  // Existing CONFLICTS F table: ID | current status | rule location | scope.
  // Older aggregate fields used the rule-location column. Keep stored data intact.
  if (!Array.isArray(rows) || !rows.length || !rows.every(row => row.length === 4 && /^F\d+$/.test(row[0]) && /^[A-Z][A-Z_]+$/.test(row[1]))) return null;
  return rows.reduce((counts, row) => { counts[row[1]] = (counts[row[1]] || 0) + 1; return counts; }, {});
}
function historicalContext(doc) {
  return doc.status === "SUPERSEDED" || ["05_SUPERSEDED", "06_HISTORY", "99_SOURCE_ARCHIVE_INDEX"].includes(doc.collection) || doc.path.includes("previous_chatgpt_ready/");
}
function browseContext(params) {
  const status = params.get("status"), topic = params.get("topic"), institution = params.get("institution"), collection = params.get("collection");
  const names = {CURRENT_CANON:"现行法典",SUPERSEDED:"旧版正文",AUTHOR_CANON:"作者设定",CANDIDATE:"整编底稿",PROPOSAL:"提案",UNRESOLVED:"待决材料",REFERENCE:"参考材料",DELEGATED_DESIGN:"授权设计"};
  let title = "全部馆藏", description = "按主题、机构与文件状态检索。多个关键词以空格分隔，匹配同时包含这些词的文件。", context = "", back = "";
  if (params.has("directory")) { title = "完整源文件目录"; description = "按原有路径浏览全部入藏文件，含项目资料、来源材料与工具文件。"; context = "项目资料 / 源文件索引"; }
  if (collection) { title = index.collections[collection] || collection; description = "依原目录归集，文件状态与权威仍以各自记录为准。"; context = ["00_PROJECT","90_AUDIT"].includes(collection) ? "项目编校资料" : "目录馆藏"; }
  if (params.get("path")) { title = "目录馆藏"; description = params.get("path"); context = "完整源文件目录"; back = '<a href="#/browse?directory=1">返回源文件目录</a>'; }
  if (status) { title = names[status] || status; description = documentNotice({status,path:""}); context = ["AUTHOR_CANON","CANDIDATE","PROPOSAL","UNRESOLVED","DELEGATED_DESIGN"].includes(status) ? "编校与维护" : ""; }
  if (topic || institution) { title = topic || institution; description = topic ? "依目录与标题关键词归入本主题；同一文献可以属于多个主题。" : "依文本中的名称与别名提及关联，不代表机构隶属、颁布机关或文件授权。"; context = topic ? "主题详情" : "机构详情"; back = `<a href="#/${topic ? "topics" : "institutions"}">返回${topic ? "主题" : "机构"}总目</a>`; }
  if (params.get("q") && !topic && !institution) { title = "检索馆藏"; description = "搜索标题、全文与元数据；权威及适用限制见文献记录。"; }
  return {title,description,context,back};
}
function activeFilters(params) {
  const labels = {q:"关键词",status:"状态",topic:"主题",institution:"机构",collection:"目录",kind:"类型",scope:"范围",path:"路径"};
  const chips = Object.entries(labels).filter(([key])=>params.get(key)).map(([key,label])=>{
    const next = new URLSearchParams(params); next.delete(key); next.delete("page");
    const value = key === "status" ? prototypeStatusLabel(params.get(key)) : key === "collection" ? index.collections[params.get(key)] || params.get(key) : key === "scope" ? "仅标题" : params.get(key);
    return `<a class="filter-token" href="${browseUrl(next)}" aria-label="${esc(`清除${label}：${value}`)}">${esc(label)}：${esc(value)} <span aria-hidden="true">×</span></a>`;
  });
  return chips.length ? `<nav class="active-filters" aria-label="已选筛选条件">${chips.join("")}<a href="#/browse" class="clear-filters">清除全部条件</a></nav>` : "";
}
function catalogueRegister(type) {
  const topic = type === "topics", key = topic ? "topics" : "institutions";
  document.title = (topic ? "主题总目" : "机构总目") + " / " + index.title;
  main.innerHTML = pageHeading(topic ? "主题总目" : "机构总目",topic ? "依据目录与标题关键词建立主题入口；同一文件可以归入多个主题。" : "依据文本提及建立检索入口，不表示机构隶属或文件授权。") + `<div class="subject-register">${index[key].map(value=>{
    const related = docs.filter(d=>d[key].includes(value)), canon = related.filter(d=>d.status === "CURRENT_CANON");
    return `<section class="subject-entry"><div><h2><a href="${browseUrl({[topic ? "topic" : "institution"]:value})}">${esc(value)}</a></h2><p class="subject-count">${related.length} 份相关文献 <span>其中现行正文 ${canon.length} 份</span></p></div><nav aria-label="${esc(value)}馆藏入口"><a href="${browseUrl({[topic ? "topic" : "institution"]:value})}">查阅文献 <span aria-hidden="true">→</span></a>${canon.length ? `<a href="${browseUrl({[topic ? "topic" : "institution"]:value,status:"CURRENT_CANON"})}">仅看现行</a>` : ""}</nav></section>`;
  }).join("")}</div>`;
}
function versionRegister(group) {
  return `<dl class="relationship-register">${[["现行正文",group.current],["整编底稿",group.candidate],["修订记录",group.changelog],["对应依据",group.evidence]].map(([label,id])=>`<div><dt>${label}</dt><dd>${linkDoc(id)}${byId.has(id) ? `<span class="relation-details">${archiveStatus(byId.get(id))}${byId.get(id).version && byId.get(id).version !== "未标注" ? `<span>${esc(byId.get(id).version)}</span>` : ""}</span>` : ""}</dd></div>`).join("")}</dl>`;
}
function versionPage() {
  document.title = "版本与关系 / " + index.title;
  main.innerHTML = pageHeading("版本与关系","依现行文献清单列出现行正文、整编底稿和修订记录。只记录对应关系，不据版本号或日期推断先后。") + `<nav class="record-links" aria-label="版本登记依据">${docLink("00_PROJECT/VERSION_LEDGER.md","版本沿革登记")}${docLink("00_PROJECT/CANDIDATE_CANON_INDEX.md","原候选 Canon 索引")}<a href="#/browse?status=SUPERSEDED">已替代正文</a></nav><p class="catalogue-note">共 ${index.versionSets.length} 组有清单依据的对应关系。整编底稿保留供追查来源，不是较新的待定版本。</p><div class="version-register">${index.versionSets.map(group=>{const doc = byId.get(group.current); return `<section class="version-entry"><div class="register-heading"><h2>${esc(doc?.title || "未提供标题")}</h2>${doc?.alias ? `<span class="catalogue-note">馆藏编号 ${esc(doc.alias)}</span>` : ""}</div>${versionRegister(group)}${doc ? `<a class="version-provenance" href="#/provenance/${doc.id}">查阅同文系分支与原文引用</a>` : ""}</section>`;}).join("") || emptyState("暂无对应组","请查阅已有版本沿革登记。")}</div>`;
}
function archiveStatus(doc) {
  return `<span class="archive-status archive-status--${esc(doc.status)}" title="${esc(doc.status)}"><span class="status-mark" aria-hidden="true"></span>${esc(prototypeStatusLabel(doc.status))}</span>`;
}
function maintenanceContext(doc) {
  // Directory context is explicit; it does not confer status, authority or ownership.
  return ["00_PROJECT", "90_AUDIT"].includes(doc.collection) || doc.path.startsWith(".") || doc.kind === "changelog";
}
function prototypeDocumentRow(doc, query = "", snippet = "") {
  const historical = historicalContext(doc);
  return `<article class="document-row${historical ? " document-row--archive" : ""}" data-document="${doc.id}">
    <div class="document-row-heading"><a class="document-row-title" href="#/doc/${doc.id}">${highlight(displayTitle(doc), query)}</a>${archiveStatus(doc)}</div>
    <div class="document-row-meta"><span>${esc(doc.category)}</span><span>${esc(doc.version)}</span>${doc.alias ? `<span>馆藏编号 ${esc(doc.alias)}</span>` : ""}${maintenanceContext(doc) ? '<span class="context-label">项目编校资料</span>' : ""}<a class="row-provenance" href="#/provenance/${doc.id}">来源与沿革</a><details class="row-source"><summary>原始文件</summary><p>${esc(doc.path)}</p></details></div>
    ${snippet || (doc.status === "CURRENT_CANON" && ARCHIVE_GUIDES[doc.alias]) ? `<p class="document-row-excerpt">${highlight(snippet ? snippet.replace(/(^|\s)#{1,6}\s/g, "$1") : ARCHIVE_GUIDES[doc.alias], query)}</p>` : ""}
  </article>`;
}
function prototypeHome() {
  const canon = docs.filter((d) => d.status === "CURRENT_CANON");
  const order = ["K12", "K20", "K10", "K28"];
  const featured = order.map((alias) => canon.find((d) => d.alias === alias)).filter(Boolean);
  const worldTopics = index.topics.filter((t) => t !== "审计与测试");
  main.innerHTML = `<header class="archive-masthead">${silverWeave("full")}<p class="masthead-subtitle">银色联盟法典库</p><h1>白塔档案馆</h1><p class="masthead-description">查阅现行法典，循主题与机构入藏。<br>保存依据，辨明版本。</p></header>
    <section class="canon-selection" aria-labelledby="canon-heading"><div class="register-heading"><h2 id="canon-heading">现行法典</h2><a href="${browseUrl({ status: "CURRENT_CANON" })}">查阅全部 ${canon.length} 份</a></div><div class="document-register">${featured.map((d) => prototypeDocumentRow(d)).join("")}</div></section>
    <div class="home-indices"><section aria-labelledby="topic-heading"><div class="register-heading"><h2 id="topic-heading">主题总目</h2><a href="#/topics">全部主题</a></div><ul class="index-register">${worldTopics.map((t) => `<li><a href="${browseUrl({ topic: t })}">${esc(t)}</a></li>`).join("")}</ul></section>
    <section aria-labelledby="institution-heading"><div class="register-heading"><h2 id="institution-heading">机构总目</h2><a href="#/institutions">全部机构</a></div><ul class="institution-register">${index.institutions.map((t) => `<li><a href="${browseUrl({ institution: t })}">${esc(t)}</a></li>`).join("")}</ul><p class="catalogue-note">按文献提及关联，不表示机构隶属或文件授权。</p></section></div>
    <section class="maintenance-strip" aria-labelledby="maintenance-heading"><div class="register-heading"><h2 id="maintenance-heading">编校与维护</h2><a href="#/audit">审计与测试</a></div><p>作者设定优先于现行正文；整编底稿与历史材料保留供查考。</p><div class="maintenance-links">${docLink("00_PROJECT/AUTHOR_FOUNDATIONS_v0.1.md", "作者基础设定")}${docLink("00_PROJECT/CANON_INDEX.md", "权威与适用限制")}${linkDoc(index.audit.latest.id, "最新整编记录")}${docLink("00_PROJECT/OPEN_ISSUES.md", "未决事项")}</div><details class="collection-summary"><summary>馆藏统计与各状态入口</summary><p>索引更新 ${dateOnly(index.builtAt)}；共 ${docs.length} 份文件，含项目维护及来源材料。</p><ul>${index.statuses.map((s) => `<li><a href="${browseUrl({ status: s })}">${esc(prototypeStatusLabel(s))} <span>${index.counts[s] || 0}</span></a></li>`).join("")}</ul><a href="${browseUrl({ topic: "审计与测试" })}">审计与测试主题</a></details></section>`;
}
function prototypeBrowseShell(params) {
  const status = params.get("status"), archive = status === "SUPERSEDED";
  const context = browseContext(params);
  document.title = context.title + " / " + index.title;
  const filter = (name, label, values) => `<label><span>${label}</span><select name="${name}" aria-label="${esc(label)}">${options(values, params.get(name), name === "scope" ? "标题 + 全文 + 元数据" : "全部")}</select></label>`;
  const scoped = ["status","topic","institution","collection","kind","path"].some(key=>params.get(key));
  return `${context.back ? `<nav class="catalogue-return" aria-label="返回总目">${context.back}</nav>` : ""}${pageHeading(context.title,context.description,context.back ? "" : context.context)}
    ${params.has("directory") || params.has("path") ? `<div class="catalogue-tools"><details class="source-directory" ${params.has("directory") ? "open" : ""}><summary>完整源文件目录<span>含项目维护与来源文件</span></summary>${tree(params.get("path") || "")}</details></div>` : ""}
    <section aria-label="馆藏检索结果"><form id="filters" class="catalogue-filters" role="search" aria-label="当前列表检索"><label class="filter-query-label" for="query">${scoped ? "在当前范围内检索" : "检索全部馆藏"}</label><div class="filter-query"><input type="search" name="q" id="query" value="${esc(params.get("q") || "")}" placeholder="文献名称、机构或术语"><button class="primary" type="submit">查找</button></div>
    <div class="filter-common">${filter("status", "文件状态", index.statuses.map((s) => [s, prototypeStatusLabel(s)]))}${filter("topic", "关联主题", index.topics.map((t) => [t,t]))}</div>
    <details id="catalogue-refinements" class="catalogue-refinements"><summary>更多筛选<span>机构、目录与检索范围</span></summary><div class="catalogue-filter-grid">${filter("institution", "关联机构", index.institutions.map((t) => [t,t]))}${filter("collection", "目录类别", Object.entries(index.collections))}${filter("kind", "文件类型", [["document","文档"],["candidate","候选正文"],["changelog","修订记录"],["data","数据与脚本"]])}${filter("scope", "搜索范围", [["title","仅标题"]])}</div></details>
    ${params.get("path") ? `<input type="hidden" name="path" value="${esc(params.get("path"))}">` : ""}${params.has("directory") ? '<input type="hidden" name="directory" value="1">' : ""}</form><div class="results-toolbar"><span id="result-count" aria-live="polite">正在检索…</span>${activeFilters(params)}<label>排序 <select id="sort">${options([["current","现行优先"],["relevance","相关度"],["title","标题"],["modified","文件修改时间"]], params.get("sort") || (params.get("q") ? "relevance" : "current"), "默认")}</select></label></div><div id="results" class="document-register${archive ? " archive-register" : ""}"></div><div id="pagination"></div></section>`;
}
function documentHeader(doc, archival = false, provenance = false) {
  return `<header class="document-header${archival ? " document-header--archive" : ""}">${silverWeave()}${archival ? `<p class="document-context">${provenance ? "来源与沿革" : "历史馆藏"}</p>` : ""}<h1>${esc(displayTitle(doc))}</h1><div class="document-info-row"><div class="document-edition">${archiveStatus(doc)}${doc.version && doc.version !== "未标注" ? `<span>${esc(doc.version)}</span>` : ""}${doc.alias ? `<span>馆藏编号 ${esc(doc.alias)}</span>` : ""}</div><nav class="document-actions" aria-label="文献操作">${provenance ? `<a href="#/doc/${doc.id}">返回文献阅读</a><a href="#/provenance/${doc.id}?section=record">文献信息</a>` : `<a href="#/provenance/${doc.id}">版本沿革</a><a href="#/doc/${doc.id}?section=record">文献信息</a>`}<details class="more-actions"><summary>原件下载</summary><div><a href="${esc(doc.rawUrl)}" download="${esc(doc.name)}">下载原始文件</a><a href="${browseUrl({ collection: doc.collection })}">同目录馆藏</a></div></details></nav></div></header>`;
}
function documentNotice(doc) {
  if (doc.path.includes("previous_chatgpt_ready/")) return "这是一份早期的审计副本，保留当时的结论；之后的决定以项目总卷为准。";
  if (doc.status === "CURRENT_CANON") return "现行正文收入核定的现行文献清单，是当前有效的设定文本。";
  if (doc.status === "CANDIDATE") return "这是整理成现行正文之前的原始底稿，保留下来是为了追查条文的来源。它不是更新的草案，也不会自动成为现行正文。";
  if (doc.status === "SUPERSEDED") return "这是一份旧版正文，已由现行正文取代，保留供查考。引用时请以现行正文为准。";
  if (doc.status === "AUTHOR_CANON") return "这是作者直接给出的设定，效力高于现行正文。适用范围以原文所写为准。";
  if (doc.status === "DELEGATED_DESIGN") return "这是作者授权代为设计的材料，在授权范围内有效，范围以原文所写为准。";
  if (doc.status === "PROPOSAL") return "这是一份提案，尚未采纳，不属于现行设定。";
  if (doc.status === "UNRESOLVED") return "这份材料涉及尚未决定的问题，其中的内容暂不作为设定使用。具体待决事项见正文。";
  if (doc.status === "REFERENCE") return "这是参考材料，用于理解背景或整理过程，本身不构成设定。";
  return "文件状态与来源按原始记录展示。";
}
const readableBasis = (value) => value === "highest" ? "最高效力（作者设定）" : value && value.replace(/CURRENT_CANON_MANIFEST(\.json)?/g, "现行文献清单").replace("路径与SHA256核验", "已核对文件指纹");
function documentMetadata(doc, side = false) {
  const current = doc.status === "CURRENT_CANON", previous = doc.source && docAt(doc.source);
  const fields = [["原始文件名",esc(doc.name)],["分类",esc(doc.category)],["状态",esc(prototypeStatusLabel(doc.status))],["版本",esc(doc.version)],[current ? "上一版" : "来源",previous ? `${linkDoc(previous.id)} ${esc(previous.version)}` : esc(doc.source)],[current ? "修订依据" : "适用依据",esc(readableBasis(doc.authority))],["收录依据",esc(readableBasis(doc.statusBasis))],[current ? "核定日期" : "声明日期",doc.date ? esc(dateOnly(doc.date)) : ""],["馆藏编号",esc([doc.sourceId,doc.alias].filter(Boolean).join(" / "))]];
  return `<${side ? "aside" : "section"} class="provenance-record${side ? " provenance-sidebar" : ""}" id="source-record"><h2>文献信息</h2><dl>${fields.map(([label,value])=>`<div><dt>${label}</dt><dd>${value || "未标注"}</dd></div>`).join("")}</dl><p class="provenance-date-note">日期为项目编目记录，不作为世界内颁布日期。</p><details class="record-integrity"><summary>路径与完整性信息</summary><p>${esc(doc.path)}</p><p>SHA256：<code>${esc(doc.sha256)}</code></p><p>${doc.size.toLocaleString()} bytes；${esc(doc.encoding || "二进制 / 未识别")}</p><p>文件修改时间：${esc(dateOnly(doc.modified))}（仅文件系统）</p><p>${esc(doc.note || "未提供额外来源说明。")}</p></details></${side ? "aside" : "section"}>`;
}
function currentNotice(doc, relation) {
  const older = relation.family.filter((id) => byId.get(id)?.status === "SUPERSEDED").length;
  return `这是${esc(displayTitle(doc))}的现行正文（${esc(doc.version)}）${doc.date ? `，收入 ${esc(dateOnly(doc.date))} 核定的现行文献清单` : ""}。${older ? ` <a href="#/provenance/${doc.id}">对照旧版（${older} 份）</a>` : ""}`;
}
function structuredRelations(doc, relation) {
  const group = relation.versionSet;
  return `<section class="source-relations"><h2>版本沿革</h2>${group ? `${versionRegister(group)}<p class="catalogue-note">底稿和修订记录保留供查考；这里列出的是对应关系，不代表先后顺序。</p>` : '<p class="catalogue-note">清单未为此文件指定现行版、原候选与变更记录的对应组。</p>'}
    <details class="related-files"><summary>同一文献的其他版本 <span>${relation.family.length}</span></summary><p class="catalogue-note">按整理记录列出；版本号和修改时间不代表先后，是否现行以状态标记为准。</p><ul>${relation.family.map(id=>`<li>${linkDoc(id)} ${byId.has(id) ? archiveStatus(byId.get(id)) : ""}</li>`).join("") || '<li>暂无记录</li>'}</ul></details>
    <details class="related-files"><summary>本文引用与被引用 <span>${relation.links.length + relation.backlinks.length}</span></summary><h3>本文引用</h3>${relationLinks(relation.links)}<h3>引用本文件</h3>${relationLinks(relation.backlinks)}</details>
    ${relation.missing.length ? `<details class="related-files"><summary>未能找到的引用 <span>${relation.missing.length}</span></summary><p>保留原始引用，不猜测链接到同名档案。</p><ul>${[...new Set(relation.missing)].map(v=>`<li>${esc(v)}</li>`).join("")}</ul></details>` : ""}</section>`;
}
async function prototypeDetail(doc, params, serial, provenance = false) {
  const archival = provenance || historicalContext(doc);
  const relation = relationships[doc.id] || {links:[],backlinks:[],family:[],missing:[]};
  const group = relation.versionSet;
  const currentLink = group && group.current !== doc.id ? linkDoc(group.current, "查看对应现行正文") : "";
  main.classList.add("prototype");
  main.dataset.view = provenance ? "provenance" : archival ? "archive" : maintenanceContext(doc) ? "maintenance" : "document";
  const toc = '<details class="reader-contents"><summary>本页目录</summary><nav id="toc" aria-label="本页目录"></nav></details>';
  const body = `<article class="article document-body" id="document-content" aria-label="文件正文"><p class="loading">正在读取正文…</p></article>`;
  main.innerHTML = `<nav class="document-breadcrumb" aria-label="面包屑">${archiveReturnToResults()}<a href="#/home">档案馆</a><span>/</span><a href="${browseUrl({status:doc.status})}">${esc(prototypeStatusLabel(doc.status))}</a><span>/</span><span>${provenance ? "来源与沿革" : "文献阅读"}</span></nav>${documentHeader(doc,archival,provenance)}
    <div class="document-notice">${maintenanceContext(doc) ? '<span class="context-label">项目编校资料</span> ' : ""}${doc.status === "CURRENT_CANON" ? currentNotice(doc, relation) : esc(documentNotice(doc))} ${currentLink}${doc.note ? `<p class="source-limitation"><strong>来源说明：</strong>${esc(doc.note)}</p>` : ""}${doc.authority && doc.authority !== "highest" && !["CURRENT_CANON","SUPERSEDED","REFERENCE"].includes(doc.status) ? `<p class="source-limitation"><strong>适用依据：</strong>${esc(readableBasis(doc.authority))}</p>` : ""}</div>
    ${provenance ? `<div class="provenance-layout">${structuredRelations(doc,relation)}${documentMetadata(doc,true)}<section class="source-transcript"><h2>原文</h2>${toc}${body}</section></div>` : `<div class="reader-layout"><div class="reader-main">${toc}${body}</div></div><div class="document-records">${documentMetadata(doc)}${structuredRelations(doc,relation)}</div>`}
    <section class="document-associations"><h2>索引关联</h2><p>主题：${doc.topics.map(t=>`<a href="${browseUrl({topic:t})}">${esc(t)}</a>`).join("、") || "未归类"}</p><p>关联机构：${doc.institutions.map(t=>`<a href="${browseUrl({institution:t})}">${esc(t)}</a>`).join("、") || "未识别到名称提及"}</p><p class="catalogue-note">这里列出正文中提到的机构，不代表隶属或授权关系。</p></section>`;
  const response = await fetch("docs/" + doc.id + ".json");
  if (!response.ok) throw new Error("正文读取失败（"+response.status+"）");
  const content = await response.json();
  if (serial !== routeSerial) return;
  const article = $("#document-content");
  if (doc.readError) article.innerHTML = `<p class="document-notice">${esc(doc.readError)}</p>`;
  else if (content.html !== undefined) {
    article.innerHTML = content.html || '<p class="muted">原文件为空。</p>';
    const first = article.firstElementChild;
    const normalized = value => value.replace(/[\s《》〈〉]/g, "");
    if (first?.tagName === "H1" && normalized(first.textContent) === normalized(doc.title)) first.classList.add("document-body-title");
  } else if (!content.text) {
    article.innerHTML = '<p class="muted">原文件为空。</p>';
  } else {
    const lines = (content.text || "").split("\n");
    let shown = 0;
    article.innerHTML = `${[".html",".rtf"].includes(doc.extension) ? '<p class="document-notice">原件以源码显示；完整格式请下载原始文件。</p>' : ""}<pre id="plain-content"></pre><div id="text-more"></div>`;
    function append() {
      const next = Math.min(shown+300,lines.length);
      $("#plain-content").append(document.createTextNode((shown ? "\n" : "")+lines.slice(shown,next).join("\n")));
      shown = next;
      $("#text-more").innerHTML = shown < lines.length ? `<p>已显示 ${shown} / ${lines.length} 行。</p><button id="more-lines">继续显示 300 行</button>` : "";
      $("#more-lines")?.addEventListener("click",append);
    }
    append();
  }
  // Scroll wide source tables locally, preserving every source cell and anchor.
  article.querySelectorAll("table").forEach((table, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap"; wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region"); wrapper.setAttribute("aria-label", `正文表格 ${i + 1}，可横向滚动`);
    table.before(wrapper); wrapper.append(table);
  });
  article.querySelectorAll("pre").forEach(pre => {pre.tabIndex = 0; pre.setAttribute("aria-label", "原文代码或纯文本，可滚动阅读");});
  archiveReader(doc, content, provenance);
  if (params.get("anchor")) {
    const target = document.getElementById("section-"+params.get("anchor"));
    if (target) { target.scrollIntoView(); target.tabIndex = -1; target.focus({preventScroll:true}); markArchiveChapter(target.id); }
    else { article.insertAdjacentHTML("afterbegin",`<p class="document-notice">未找到原文锚点「${esc(params.get("anchor"))}」，已展示完整正文。</p>`); article.scrollIntoView(); }
  } else if (params.get("section") === "record") { const record = $("#source-record"); record.scrollIntoView(); record.tabIndex = -1; record.focus({preventScroll:true}); }
}
