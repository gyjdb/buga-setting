"use strict";
// 白塔档案馆外壳：路由、首页与文献页（校勘本：档案卡式著录、悬停预览、条文旁注、逐条版本线）；风土志阅读器（book.js）挂在顶栏上。
// 只读 build.py 生成的数据；状态、权威、版本与机构关系照原数据显示，这里不做推断。其余页面在 portal-pages.js。
const $ = (s, root = document) => root.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const main = $("#main");

const STAMPS = {
  CURRENT_CANON: ["现行正文", "is-current"],
  AUTHOR_CANON: ["作者设定", "is-author"],
  DELEGATED_DESIGN: ["授权设计", "is-delegated"],
  PROPOSAL: ["提案", "is-proposal"],
  UNRESOLVED: ["待决材料", "is-proposal"],
  CANDIDATE: ["整编底稿", "is-candidate"],
  SUPERSEDED: ["旧版正文", "is-superseded"],
  REFERENCE: ["参考材料", "is-reference"],
};
const COMPOSITION = ["CURRENT_CANON", "AUTHOR_CANON", "DELEGATED_DESIGN", "PROPOSAL", "CANDIDATE", "SUPERSEDED", "REFERENCE"];
// 现行法典依《银色联盟宪章》第二条的规范层级编排。
const CANON_LEVELS = [
  ["宪章", [["宪章", ["K12"]]]],
  ["法律", [["基本法", ["K20", "K18"]], ["组织法", ["K14", "K25", "K26"]], ["专项法律", ["K34", "K39", "K61", "K35", "K48", "K38", "K40", "K41", "K45", "K52", "K42", "K44", "K47", "K33", "K60", "K31", "K59"]], ["章程", ["K28", "K29", "K27", "K43", "K24"]]]],
  ["实施规范", [["组织架构", ["K10", "K49", "K50", "K51", "K19", "K23", "K11", "K55", "K56", "K57", "K58", "K32"]], ["规程与标准", ["K15", "K21", "K13", "K36", "K30", "K37", "K46"]], ["名录与清单", ["K53", "K54"]]]],
];
// 几部主要法典的一句导读。
const GUIDES = {
  K12: "由规范层级、成员城邦与公民保障，进入议会、行政、裁断和财政制度。",
  K28: "了解白塔的位面性质、法则守护，以及寰宇文库的保管和查阅规则。",
  K20: "查阅魔力取用、环级认定、施法许可与禁制，以及相关公共秩序。",
  K29: "从知识收存、分层与移交，了解典藏记录的保管与查阅。",
};
const HINTS = ["红线事件", "环级认定", "遗产", "施法许可"];
// 主题关键词同 portal_config.json 的 topics（馆藏筛选用的同一组词）；条文旁注按它标主题。
const TOPIC_WORDS = {
  宪政与治理: ["宪章", "议会", "执政院", "立法", "公民"],
  魔法体系与魔法法: ["魔法", "施法", "禁魔", "环级", "节点取能"],
  司法监察与治安: ["裁断", "监察", "治安", "司法", "警务"],
  军事与防务: ["防务", "军事", "银烛", "舰队", "军种"],
  学术与研究机构: ["白塔", "学会", "图书馆", "学术", "研究"],
  财政货币与经济: ["财政", "货币", "经济", "储备", "拨款"],
};
const GUIDE_PATH = "07_WORLD_GUIDE/银色联盟风土志.md";
const CN_DIGITS = "一二三四五六七八九十百零〇两";
const ARTICLE = new RegExp(`^第[${CN_DIGITS}]+条(?:之[一二三四五六七八九十]+)?`);
const SERIES = /^(?:第(?:[0-9一二三四五六七八九十百]+|（[一二三四五六七八九十]+）)[款项目])*(?:、|和|与|及|以及|或者|至|到)$/;
const XREF = new RegExp(`《([^《》\\n]{1,40})》(第[${CN_DIGITS}]+条(?:之[一二三四五六七八九十]+)?)?|第[${CN_DIGITS}]+条(?:之[一二三四五六七八九十]+)?`, "g");
// 法规版式不设条标题：条号与第一款同段，后接全角空格。
const ARTICLE_LEAD = new RegExp(`^(${ARTICLE.source.slice(1)})　`);

let index, docs, byId, relationships, registry, plan;
let serial = 0;
let page = null; // 当前文献页的版本与条文状态，悬停预览读它
const docCache = new Map();

const fetchJSON = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(url + "（" + r.status + "）");
    return r.json();
  });
const loadDoc = (id) => {
  if (!docCache.has(id)) docCache.set(id, fetchJSON("docs/" + id + ".json"));
  return docCache.get(id);
};
const stamp = (status) => {
  const [label, cls] = STAMPS[status] || [status, "is-reference"];
  return `<span class="rs-stamp ${cls}">${esc(label)}</span>`;
};
const docHref = (id, params) => `#/doc/${id}${params ? "?" + new URLSearchParams(params) : ""}`;
const browseHref = (params) => "#/browse?" + new URLSearchParams(params);
const orgHref = (id) => "#/institution/" + encodeURIComponent(id);
// 纯文本文件很大时分批显示，每批约二十万字符。
const TEXT_BATCH = 200000;

// 风土志阅读器（book.js）沿用原有外壳约定的名字：路由序号、观察器、按路径找文件、链接、图标与导航同步。
let routeSerial = 0;
let archiveObserver = null;
const docAt = (path) => docs.find((d) => d.path === path);
const linkDoc = (id, text) => (id && byId.has(id) ? `<a href="${docHref(id)}">${esc(text || titleOf(byId.get(id)))}</a>` : esc(text || "未提供"));
const ICON_PATHS = { menu: "M3 6h18M3 12h18M3 18h18", search: "M17 10a7 7 0 11-14 0 7 7 0 0114 0M15 15l6 6" };
function archiveIcon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name] || ICON_PATHS.menu}"/></svg>`;
}
// 阅读器里站内导航收进顶栏左端的按钮，点开是一张下拉列表。
function archiveNavSync() {
  const open = "navOpen" in document.body.dataset, toggle = $("#menu-toggle");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "收起档案馆导航" : "档案馆导航");
}
// 风土志拆不出章节时退回普通文献页（完整正文与著录）。
function prototypeDetail(doc, params, my) { return docPage(doc.id, new URLSearchParams({ view: "record" }), my); }
// 几份项目文件用通行名称，单一文件的修订记录挂上正文名。
const TITLE_NAMES = { "CURRENT_CANON_MANIFEST.json": "现行文献清单", "VERSION_LEDGER.md": "版本沿革登记", "CANDIDATE_CANON_INDEX.md": "整编底稿索引", "PROJECT_INDEX.md": "项目总卷索引", "CANON_INDEX.md": "权威与适用限制", "AUTHOR_FOUNDATIONS_v0.1.md": "作者基础设定", "CONFLICTS.md": "冲突与处理记录" };
function titleOf(doc) {
  if (TITLE_NAMES[doc.name]) return TITLE_NAMES[doc.name];
  if (doc.kind === "changelog") {
    const groups = index.versionSets.filter((g) => g.changelog === doc.id), current = groups.length === 1 && byId.get(groups[0].current);
    if (current) return current.title + "修订记录";
  }
  return doc.title;
}
const plain = (title) => String(title).replace(/^《/, "").replace(/》$/, "");
const squash = (s) => String(s).replace(/\s+/g, " ").trim();
const share = (n, total) => (total ? n / total : 0);
function localDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function compareVersions(a, b) {
  const x = (String(a).match(/\d+/g) || []).map(Number), y = (String(b).match(/\d+/g) || []).map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d) return d;
  }
  return 0;
}
function cnNumber(s) {
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  let total = 0, current = 0;
  for (const ch of s) {
    if (ch in digits) current = digits[ch];
    else if (ch === "十") { total += (current || 1) * 10; current = 0; }
    else if (ch === "百") { total += (current || 1) * 100; current = 0; }
  }
  return total + current;
}
function roman(n) {
  const marks = [[100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [value, mark] of marks) while (n >= value) { out += mark; n -= value; }
  return out;
}
const roundOf = (doc) => (doc?.title.match(/第([一二三四五六七八九十]+)版/) || [])[1];
const canonByAlias = () => new Map(docs.filter((d) => d.status === "CURRENT_CANON").map((d) => [d.alias, d]));
function canonLevel(alias) {
  for (const [level, groups] of CANON_LEVELS) for (const [group, aliases] of groups) if (aliases.includes(alias)) return [level, group];
  return null;
}
function setBars(root) {
  root.querySelectorAll("[data-w]").forEach((el) => { el.style.width = (Math.max(0, Math.min(1, +el.dataset.w)) * 100).toFixed(2) + "%"; });
  root.querySelectorAll("[data-grow]").forEach((el) => { el.style.flex = `${el.dataset.grow} 0 0`; });
}

/* ---------- 首页 ---------- */

// 标题后跟一行拉丁斜体副题（同风土志：中文管内容，拉丁文管结构）；说明另起一行。
const rubric = (latin) => (latin ? `<span class="rs-rubric" lang="la">${esc(latin)}</span>` : "");
function sectionHead(id, title, latin, note = "", aside = "") {
  return `<div class="rs-head"><div><h2${id ? ` id="${id}"` : ""}>${esc(title)}${rubric(latin)}</h2>${note ? `<p class="rs-note">${note}</p>` : ""}</div>${aside ? `<p class="rs-head-meta">${aside}</p>` : ""}</div>`;
}
// 徽记：洞察之眼居中，外围十二枚小环（联盟的象征与银色十二环）。放在页脚作书末印记，随文字颜色。
function sigilHTML() {
  const eye = bookEmblem("").replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const rings = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6 - Math.PI / 2;
    return `<circle cx="${(100 * Math.cos(a)).toFixed(1)}" cy="${(100 * Math.sin(a)).toFixed(1)}" r="6.5"/>`;
  }).join("");
  return `<svg class="rs-sigil" viewBox="-124 -124 248 248" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="4"><circle r="100"/><circle r="114" stroke-width="2.4"/>${rings}</g><g transform="translate(0 6) scale(.6)">${eye}</g></svg>`;
}

async function home(my) {
  document.title = "白塔档案馆 · 银色联盟法典库";
  const canon = docs.filter((d) => d.status === "CURRENT_CANON");
  const byAlias = canonByAlias();
  const guide = docs.find((d) => d.path === GUIDE_PATH);
  const tower = byAlias.get("K28");
  const [guideText, towerText] = await Promise.all([guide && loadDoc(guide.id).catch(() => null), tower && loadDoc(tower.id).catch(() => null)]);
  if (my !== serial) return;
  const sixth = towerText?.toc.find((h) => h.label.startsWith("第六条"));
  const institutions = registry.institutions.filter((r) => r.status === "current" && r.kind !== "设施");
  const counters = [
    [docs.length, "份馆藏", "#/browse"],
    [index.counts.CURRENT_CANON || 0, "份现行正文", "#/canon", true],
    [index.counts.AUTHOR_CANON || 0, "份作者设定", browseHref({ status: "AUTHOR_CANON" })],
    [index.counts.PROPOSAL || 0, "份提案", browseHref({ status: "PROPOSAL" })],
    [index.counts.SUPERSEDED || 0, "份旧版正文", browseHref({ status: "SUPERSEDED" })],
    [institutions.length, "个现行机构", "#/institutions"],
  ];
  // 首页只有一处显眼：现有的宪章典籍图与竖排的银箔馆名。其余保持安静。
  main.innerHTML = `<section class="rs-hero" aria-labelledby="rs-title">
    <img class="rs-hero-art" src="assets/charter-hall.webp" width="1672" height="941" fetchpriority="high" alt="深色皮革宪章典籍与哑银书扣，封面题名 Charta Foederis Argentei，远处为层叠石构书廊；概念演绎">
    <div class="rs-hero-inner">
      <div class="rs-hero-title"><h1 id="rs-title"><span class="rs-foil">白塔档案馆</span></h1><p class="rs-hero-sub">银色联盟法典库</p></div>
      <div class="rs-hero-foot">
        <p class="rs-lead">银色联盟的法典、机构章程与馆藏读物。初次来访，可先读《${esc(BOOK_TITLE)}》认识布加，再从宪章出发查阅法典与机构。</p>
        ${tower ? `<p class="rs-motto"><q>白塔封存的知识不予销毁。</q><a href="${docHref(tower.id, sixth ? { anchor: sixth.slug } : null)}">《白塔章程》第六条</a></p>` : ""}
        <form class="rs-hero-search" role="search"><label class="rs-sr" for="rs-hero-query">检索全部馆藏</label><input id="rs-hero-query" type="search" autocomplete="off" placeholder="检索条文、机构或术语…"><kbd>/</kbd><button type="submit">检索</button></form>
        <p class="rs-hints"><span>常见检索</span>${HINTS.map((q) => `<a href="${browseHref({ q })}">${esc(q)}</a>`).join("")}</p>
      </div>
    </div>
  </section>
  <div class="rs-home">
    <div class="rs-col">
      <nav class="rs-counters" aria-label="馆藏计数">${counters.map(([n, label, href, key]) => `<a class="rs-counter${key ? " is-key" : ""}" href="${href}"><b>${n.toLocaleString("en-US")}</b><span>${label}</span></a>`).join("")}</nav>
      ${canonSection(canon)}
      ${guide ? bookSection(guide, guideText) : ""}
      ${compositionSection(institutions)}
    </div>
    ${rail()}
  </div>`;
  setBars(main);
  main.querySelector(".rs-hero-search").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = $("#rs-hero-query").value.trim();
    if (q) location.href = browseHref({ q });
  });
}

function canonSection(canon) {
  const byAlias = new Map(canon.map((d) => [d.alias, d]));
  const latest = byId.get(index.audit.latest?.id);
  const latestRound = roundOf(latest);
  const approved = canon.map((d) => d.date).filter(Boolean).sort().pop();
  const placed = new Set();
  const levels = CANON_LEVELS.map(([level, groups]) => [level, groups.map(([name, aliases]) => [name, aliases.map((a) => byAlias.get(a)).filter(Boolean)]).filter(([, list]) => list.length)]);
  levels.forEach(([, groups]) => groups.forEach(([, list]) => list.forEach((d) => placed.add(d.alias))));
  const rest = canon.filter((d) => !placed.has(d.alias));
  if (rest.length) levels.push(["其他现行文献", [["未分层", rest]]]);
  const row = (d) => {
    const set = index.versionSets.find((s) => s.current === d.id);
    const changelog = set && byId.get(set.changelog);
    const round = roundOf(changelog);
    const olds = (relationships[d.id]?.family || []).filter((id) => byId.get(id)?.status === "SUPERSEDED").length;
    return `<tr><td class="rs-no">${esc(d.alias)}</td>
      <td class="rs-title"><a href="${docHref(d.id)}">${esc(d.title)}</a>${GUIDES[d.alias] ? `<small>${esc(GUIDES[d.alias])}</small>` : ""}</td>
      <td class="rs-num">${esc(d.version)}</td>
      <td class="rs-num rs-opt">${olds || "—"}</td>
      <td class="rs-sub rs-opt">${round ? `<a class="rs-round${round === latestRound ? " is-latest" : ""}" href="${docHref(changelog.id)}">第${round}版</a>` : "—"}</td>
      <td class="rs-sub rs-opt">${esc(d.category)}</td></tr>`;
  };
  const note = `依宪章第二条的规范层级编排：宪章、法律与实施规范。${approved ? `清单 ${esc(approved)} 核定${latestRound ? `，第${latestRound}版` : ""}，共 ${canon.length} 份。` : ""}`;
  return `<section class="rs-section" id="rs-canon" aria-labelledby="rs-canon-title">
    ${sectionHead("rs-canon-title", "现行法典", "Leges vigentes", note, `<a class="rs-link" href="${browseHref({ status: "CURRENT_CANON" })}">现行文献清单</a>`)}
    <table class="rs-register">
      <thead><tr><th>编号</th><th>名称</th><th>版本</th><th class="rs-opt">旧版</th><th class="rs-opt">末次修订</th><th class="rs-opt">主题</th></tr></thead>
      <tbody>${levels.map(([level, groups]) => groups.map(([group, list]) => `<tr class="rs-group"><td colspan="6">${esc(level)}${level === group ? "" : `<span>${esc(group)}</span>`}<small>${list.length}</small></td></tr>${list.map(row).join("")}`).join("")).join("")}</tbody>
    </table>
  </section>`;
}

function bookSection(guide, text) {
  const chapters = (text?.toc || []).filter((h) => /^[一二三四五六七八九十]+、/.test(h.label)).map((h) => {
    const [, num, name] = h.label.match(/^([一二三四五六七八九十]+)、(.+)$/);
    return { num, name, slug: h.slug, info: BOOK_CHAPTERS[num] || {}, plate: plan.chapters.find((c) => c.num === num)?.plate };
  });
  const chapterHref = (c) => docHref(guide.id, { anchor: c.slug });
  return `<section class="rs-section" aria-labelledby="rs-book-title">
    ${sectionHead("rs-book-title", "初识布加", BOOK_LATIN, "馆藏读物，适合第一次接触布加的读者。", `<a class="rs-link" href="${docHref(guide.id)}">开卷阅读</a>`)}
    <div class="rs-book">
      <a class="book-cover" href="${docHref(guide.id)}" aria-label="开卷阅读《${esc(BOOK_TITLE)}》">${bookCoverHTML()}</a>
      <div>
        <h3>《${esc(BOOK_TITLE)}》</h3>
        <p class="rs-book-sub" lang="en">${esc(BOOK_SUBTITLE)}</p>
        <p class="rs-book-by">${esc(BOOK_AUTHOR[0])}著，图拉曼作序。出自克鲁兹帝国圣埃博松学院一位学者之手，从地上人的眼光介绍这个天上国度的城邦、巫师、魔法与岁时。</p>
        ${chapters.length ? `<ol class="rs-chapters">${chapters.map((c) => `<li><a href="${chapterHref(c)}"><span>${esc(BOOK_ROMAN[c.num] || c.num)}</span><b>${esc(c.name)}</b><small lang="la">${esc(c.info.ghost || "")}</small></a></li>`).join("")}</ol>` : ""}
      </div>
    </div>
    ${chapters.some((c) => c.plate) ? `<div class="rs-plates" aria-label="章首插图">${chapters.filter((c) => c.plate).map((c) => `<figure class="rs-plate"><a href="${chapterHref(c)}"><img src="assets/plates/${esc(c.plate)}.webp" width="1536" height="819" loading="lazy" alt="第${esc(c.num)}章章首插图：${esc(c.name)}（概念演绎）"></a><figcaption><span>${esc(BOOK_ROMAN[c.num] || c.num)}</span>${esc(c.name)}<i lang="en">${esc(c.info.en || "")}</i></figcaption></figure>`).join("")}</div>
    <p class="rs-plates-note">九章的章首插图，点开进入对应章节。插画为概念演绎。</p>` : ""}
  </section>`;
}

function compositionSection(institutions) {
  const total = COMPOSITION.reduce((n, s) => n + (index.counts[s] || 0), 0);
  const topics = index.topics.filter((t) => TOPIC_WORDS[t]).map((t) => {
    const related = docs.filter((d) => d.topics.includes(t));
    return { t, related: related.length, canon: related.filter((d) => d.status === "CURRENT_CANON").length };
  });
  const topMax = Math.max(1, ...topics.map((x) => x.related));
  const merged = { police: "executive", prohibition: "executive" };
  const sectionOf = (category) => {
    const id = merged[category] || category;
    const c = registry.categories.find((x) => x.id === id);
    return c ? c.section || c.id : id;
  };
  const sections = (registry.sections || []).map((s) => ({ ...s, n: institutions.filter((r) => sectionOf(r.category) === s.id).length })).filter((s) => s.n);
  const orgMax = Math.max(1, ...sections.map((s) => s.n));
  return `<section class="rs-section" aria-labelledby="rs-collection-title">
    ${sectionHead("rs-collection-title", "馆藏构成", "Collectio", `按文件状态统计，共 ${total} 份。`, `<a class="rs-link" href="#/browse">全部馆藏</a>`)}
    <div class="rs-composition" role="img" aria-label="${COMPOSITION.map((s) => `${STAMPS[s][0]} ${index.counts[s] || 0} 份`).join("，")}">${COMPOSITION.map((s) => `<span class="${STAMPS[s][1]}" data-grow="${index.counts[s] || 0}"></span>`).join("")}</div>
    <ul class="rs-legend">${COMPOSITION.map((s) => `<li><a href="${browseHref({ status: s })}"><i class="rs-composition-key ${STAMPS[s][1]}"></i>${esc(STAMPS[s][0])}<b>${index.counts[s] || 0}</b></a></li>`).join("")}</ul>
    <div class="rs-split">
      <div><h3>主题${rubric("Argumenta")}</h3><p class="rs-note">按目录与标题关键词归类，一份文件可属于多个主题。</p>
        <ul class="rs-bars">${topics.map((x) => `<li><a href="${browseHref({ topic: x.t })}"><span>${esc(x.t)}</span><b>${x.related}</b><small>其中现行 ${x.canon} 份</small><s><i data-w="${share(x.related, topMax)}"></i></s></a></li>`).join("")}</ul></div>
      <div><h3>机构${rubric("Instituta")}</h3><p class="rs-note">现行机构，不含具名设施。</p>
        <ul class="rs-bars">${sections.map((s) => `<li><a href="${"#/institutions?" + new URLSearchParams({ group: s.id })}"><span>${esc(s.name)}</span><b>${s.n}</b><small>个现行机构</small><s><i data-w="${share(s.n, orgMax)}"></i></s></a></li>`).join("")}</ul></div>
    </div>
  </section>`;
}

function rail() {
  const audit = index.audit;
  const latest = audit.latest && byId.get(audit.latest.id);
  const open = (audit.conflictRows || []).filter((r) => r[1] === "OPEN").length;
  const openIssues = (audit.issueRows || []).filter((r) => !/^已/.test(r[2] || "")).length; // 同审计页：现行登记里未答复的议题
  const scenario = byId.get(audit.scenarioSource);
  const scenarios = audit.scenarios || {};
  const decisionNo = (d) => +(d.title.match(/D(\d+)/) || [0, 0])[1];
  const decisions = (audit.recent || []).map((id) => byId.get(id)).filter((d) => d && d.status === "AUTHOR_CANON")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || decisionNo(b) - decisionNo(a)).slice(0, 6);
  return `<aside class="rs-rail" aria-label="编校面板">
    ${latest ? `<section class="rs-panel rs-plaque"><h2>最新整编${rubric("Acta recentia")}</h2>
      <a class="rs-latest" href="${docHref(latest.id)}"><b>${esc(latest.title)}</b><time>${esc(audit.latest.date || "")}</time><p>${esc(audit.latest.status)}</p></a>
      <p class="rs-panel-foot">现行正文 ${audit.latest.count} 份。<a class="rs-link" href="#/versions">版本与关系</a></p></section>` : ""}
    <section class="rs-panel"><h2>编校状态${rubric("Recensio")}</h2>
      <dl class="rs-kv">
        <div><dt>开放冲突<small>原 F 编号登记中状态为 OPEN 的记录</small></dt><dd><a href="#/audit">${open}</a></dd></div>
        <div><dt>作者未决<small>现行登记 ${esc(audit.issuesUpdated || "—")} 更新</small></dt><dd><a href="#/issues">${openIssues}</a></dd></div>
        <div><dt>未来制度接口</dt><dd><a href="#/audit">${audit.futureInterfaces ?? "—"}</a></dd></div>
        <div><dt>场景推演<small>${scenarios.PASS || 0} 项通过，${scenarios.CONDITIONAL || 0} 项有条件${scenario?.date ? `；${esc(scenario.date)} 的历史记录` : ""}</small></dt><dd><a href="#/audit">${(scenarios.PASS || 0) + (scenarios.CONDITIONAL || 0)}</a></dd></div>
      </dl><p class="rs-panel-foot"><a class="rs-link" href="#/audit">审计与测试</a></p></section>
    ${decisions.length ? `<section class="rs-panel"><h2>最近的作者决定${rubric("Decreta")}</h2><ol class="rs-acta">${decisions.map((d) => {
      const [, code, title] = d.title.match(/^作者决定\s*(D\d+)[：:]\s*(.+)$/) || [null, "", d.title];
      return `<li><a href="${docHref(d.id)}"><b>${esc(code)}</b><span>${esc(title)}</span><time>${esc(d.date || "")}</time></a></li>`;
    }).join("")}</ol></section>` : ""}
  </aside>`;
}

/* ---------- 文献页 ---------- */

// 把正文切成编、章、条和普通段落；条文按“第N条”识别，层级不固定。
// 有条标题的，条号在标题里；法规版式的，条号在段首（lead），遇到下一个标题即止。
function structure(html) {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const blocks = [], ids = new Set([...body.querySelectorAll("[id]")].map((n) => n.id));
  let article = null, flow = null;
  for (const el of [...body.children]) {
    const tag = el.tagName;
    if (tag === "H1") continue;
    if (tag === "HR") { article = null; flow = null; continue; }
    if (/^H[2-6]$/.test(tag)) {
      const text = squash(el.textContent), level = +tag[1];
      const m = text.match(ARTICLE);
      if (m) {
        article = { type: "article", key: m[0], title: text.slice(m[0].length).trim(), id: el.id, level, nodes: [] };
        blocks.push(article);
        flow = null;
        continue;
      }
      if (article && level > article.level) { article.nodes.push(el); continue; }
      article = null;
      flow = null;
      if (tag === "H2") blocks.push({ type: "part", text, id: el.id });
      else if (/^第[一二三四五六七八九十百]+章/.test(text)) blocks.push({ type: "chapter", text, id: el.id });
      else { flow = { type: "flow", nodes: [el] }; blocks.push(flow); }
      continue;
    }
    const lead = tag === "P" && el.textContent.match(ARTICLE_LEAD);
    if (lead) {
      let id = "section-" + lead[1];
      for (let n = 1; ids.has(id); n++) id = `section-${lead[1]}-${n}`;
      ids.add(id);
      article = { type: "article", key: lead[1], title: "", id, level: 7, lead: true, nodes: [leadNumber(el, lead)] };
      blocks.push(article);
      flow = null;
      continue;
    }
    if (article) article.nodes.push(el);
    else {
      if (!flow) { flow = { type: "flow", nodes: [] }; blocks.push(flow); }
      flow.nodes.push(el);
    }
  }
  return blocks;
}
// 五列以上的表格（名录之类）包一层，跨出正文栏，占满主栏。
const flowHTML = (n) => n.tagName === "TABLE" && n.rows[0]?.cells.length >= 5 ? `<div class="rs-wide-table">${n.outerHTML}</div>` : n.outerHTML;
// 段首条号包进 .rs-art-no；条号被其他标记拆开时原样保留。
function leadNumber(p, m) {
  const t = p.firstChild;
  if (t?.nodeType !== 3 || !t.data.startsWith(m[0])) return p;
  t.data = t.data.slice(m[0].length);
  const no = p.ownerDocument.createElement("span");
  no.className = "rs-art-no";
  no.textContent = m[1];
  p.prepend(no, "　");
  return p;
}
function blockText(node) {
  if (node.tagName === "OL" || node.tagName === "UL")
    return [...node.children].map((li, i) => (node.tagName === "OL" ? `${i + 1}. ` : "· ") + squash(li.textContent)).join("\n");
  if (node.tagName === "TABLE") return [...node.rows].map((r) => [...r.cells].map((c) => squash(c.textContent)).join(" | ")).join("\n");
  return squash(node.textContent);
}
function articleMap(html) {
  const map = new Map();
  for (const b of structure(html)) if (b.type === "article" && !map.has(b.key)) {
    const text = b.nodes.map(blockText).filter(Boolean).join("\n");
    map.set(b.key, { key: b.key, title: b.title, text: b.lead ? text.slice(b.key.length).trim() : text });
  }
  return map;
}
const signature = (a) => (a.title + a.text).replace(/\s+/g, "");

// 同一文系的现行版与旧版，按版本号排列以便逐条对照；版本号本身不证明先后。
// 内容相同的同号副本只取一份（正在看的那份优先）；内容不同的同号分支并列：01、05 目录里那份作主线，
// 其余标为分支，与前一个主线版本对照，但不作为下一版的对照对象。
function familyVersions(doc) {
  const groups = new Map();
  for (const id of [doc.id, ...(relationships[doc.id]?.family || [])]) {
    const d = byId.get(id);
    if (!d || d.kind === "changelog" || !/\d/.test(d.version)) continue;
    if (d.id !== doc.id && !["CURRENT_CANON", "SUPERSEDED"].includes(d.status)) continue;
    if (!groups.has(d.version)) groups.set(d.version, []);
    const list = groups.get(d.version), same = list.findIndex((x) => x.sha256 === d.sha256);
    if (same < 0) list.push(d);
    else if (d.id === doc.id) list[same] = d;
  }
  const out = [];
  for (const [version, list] of [...groups].sort((a, b) => compareVersions(a[0], b[0]))) {
    const lead = list.find((d) => /^0[15]_/.test(d.path)) || list[0];
    for (const d of [lead, ...list.filter((x) => x !== lead)]) out.push({ doc: d, label: list.length > 1 ? `${version}（${branchHint(d, plain(doc.title))}）` : version, branch: d !== lead });
  }
  return out;
}
// 同号分支的称呼取文件名里正文名以外的部分，如“草案”“修订稿改进版”。
function branchHint(d, base) {
  const hint = d.name.replace(/\.[^.]+$/, "").replace(/_?v\d+(?:_\d+)*_?/i, "_").split("_").filter((part) => part && !base.includes(part)).join("");
  return hint || d.path.split("/")[0];
}
const prevLead = (versions, i) => { for (let k = i - 1; k >= 0; k--) if (!versions[k].branch) return k; return -1; };
// 每一条在各版里的状态：origin 现存最早一版已有 · new 新增 · changed 有改动 · same 未改 · absent 无此条 · unknown 读不到。
// from 是对照的那一版（前一个有此条的主线版本）。
function histories(versions) {
  const first = versions.findIndex((v) => v.map && !v.branch);
  const keys = new Set();
  versions.forEach((v) => v.map?.forEach((_, k) => keys.add(k)));
  const out = new Map();
  for (const key of keys) {
    let before = null, from = -1;
    out.set(key, versions.map((v, i) => {
      if (!v.map) return { state: "unknown" };
      const article = v.map.get(key);
      if (!article) return { state: "absent" };
      const state = !before ? (i === first ? "origin" : "new") : signature(before) === signature(article) ? "same" : "changed";
      const item = { state, article, before, from };
      if (!v.branch) { before = article; from = i; }
      return item;
    }));
  }
  return out;
}

// 只标本文件主题以外的主题：宪章里每条都属“宪政与治理”，再标一遍没有信息。
function topicTags(text, own) {
  return Object.entries(TOPIC_WORDS)
    .filter(([topic]) => !own.includes(topic))
    .map(([topic, words]) => [topic, words.reduce((n, w) => n + text.split(w).length - 1, 0)])
    .filter(([, n]) => n)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([topic]) => topic);
}
// 机构提及：名称与别名逐字匹配（三字以上；两字的只认档案馆筛选用的八个机构名），长名优先，不重叠。
let orgMatcher = null;
function orgNames() {
  if (orgMatcher) return orgMatcher;
  const short = new Set(index.institutions);
  const names = [];
  for (const r of registry.institutions) {
    if (r.status !== "current") continue;
    for (const name of [r.name, ...(r.aliases || [])]) if (name && (name.length >= 3 || short.has(name))) names.push([name, r]);
  }
  orgMatcher = names.sort((a, b) => b[0].length - a[0].length);
  return orgMatcher;
}
function orgMentions(text, doc, slug) {
  const taken = new Array(text.length).fill(false), found = [];
  for (const [name, r] of orgNames()) {
    let at = text.indexOf(name);
    while (at >= 0) {
      if (!taken.slice(at, at + name.length).some(Boolean)) {
        for (let i = at; i < at + name.length; i++) taken[i] = true;
        const prior = found.find((f) => f.r === r);
        if (!prior) found.push({ r, at, name });
        else if (at < prior.at) Object.assign(prior, { at, name }); // 同一机构显示正文里先出现的那个名字
      }
      at = text.indexOf(name, at + name.length);
    }
  }
  return found.sort((a, b) => a.at - b.at).slice(0, 4).map(({ r, name }) => {
    const evidence = r.sources.find((s) => s.docId === doc.id && s.anchor === slug && ["establishes", "regulates"].includes(s.role));
    return { r, name, evidence: evidence?.role };
  });
}

function vlineHTML(key, states, versions, here) {
  const words = { origin: "现存最早一版已有此条", new: "新增此条", changed: "有改动", same: "未改" };
  return `<div class="rs-vline" role="group" aria-label="${esc(key)}的历次版本">${states.map((s, i) => {
    const label = versions[i].label;
    const branch = versions[i].branch ? " is-branch" : "";
    if (!words[s.state]) return `<span class="${branch}" title="${esc(label)}：${s.state === "absent" ? "无此条" : "未能读取"}"></span>`;
    return `<button type="button" class="is-${s.state}${branch}${i === here ? " is-here" : ""}" data-peek="diff" data-key="${esc(key)}" data-v="${i}" aria-label="${esc(label)}：${words[s.state]}${branch ? "（同号分支）" : ""}"></button>`;
  }).join("")}</div>`;
}
function vnoteHTML(states, versions, here) {
  if (states[here]?.state === "new") return `<b>${esc(versions[here].label)}</b> 新增`;
  const changed = states.map((s, i) => (i <= here && !versions[i].branch && (s.state === "changed" || s.state === "new") ? versions[i].label : null)).filter(Boolean);
  if (!changed.length) {
    const first = states.findIndex((s) => s.article);
    return first >= 0 ? `自 <b>${esc(versions[first].label)}</b> 起未改` : "";
  }
  return `改于 ${changed.slice(-3).map((l) => `<b>${esc(l)}</b>`).join("、")}${changed.length > 3 ? ` 等 ${changed.length} 次` : ""}`;
}

async function docPage(ref, params, my) {
  const doc = byId.get(ref) || canonByAlias().get(ref);
  if (!doc) {
    main.innerHTML = `<p class="rs-error">没有这份文件。<a class="rs-link" href="#/home">回首页</a></p>`;
    return;
  }
  if (main.dataset.doc === doc.id) { reveal(params); return; }
  let versions = familyVersions(doc);
  if (!versions.some((v) => v.doc.id === doc.id)) versions = []; // 本文件没有版本号：不排版本线
  const texts = await Promise.all(versions.map((v) => loadDoc(v.doc.id).catch(() => null)));
  const here = versions.findIndex((v) => v.doc.id === doc.id);
  const content = here >= 0 ? texts[here] : await loadDoc(doc.id).catch(() => null);
  if (my !== serial) return;
  document.title = `${titleOf(doc)} · 白塔档案馆`;
  versions.forEach((v, i) => { v.map = texts[i]?.html ? articleMap(texts[i].html) : null; });
  const history = versions.length > 1 ? histories(versions) : new Map();
  page = { doc, versions, history, here };

  const blocks = content?.html ? structure(content.html) : [];
  const articles = blocks.filter((b) => b.type === "article");
  const revised = new Set(articles.filter((b) => ["changed", "new"].includes(history.get(b.key)?.[here]?.state) && here > 0).map((b) => b.key));
  const added = articles.filter((b) => history.get(b.key)?.[here]?.state === "new" && here > 0).length;
  const lead = prevLead(versions, here);
  const removed = lead >= 0 ? [...history.values()].filter((s) => s[here]?.state === "absent" && s[lead]?.article).length : 0;
  const prev = lead >= 0 ? versions[lead].label : "";

  const level = doc.status === "CURRENT_CANON" ? canonLevel(doc.alias) : null;
  // 只有宪章有现成的拉丁题名（首页旧图上的 Charta Foederis Argentei），其余文献不另起拉丁名。
  const latin = doc.alias === "K12" && doc.status === "CURRENT_CANON" ? "Charta Foederis Argentei" : "";
  const levelName = level ? (level[0] === level[1] ? level[0] : `${level[0]}（${level[1]}）`) : index.collections[doc.collection] || doc.collection;
  const set = index.versionSets.find((s) => s.current === doc.id);
  const changelog = set && byId.get(set.changelog);
  const backlinks = relationships[doc.id]?.backlinks || [];
  const wordCount = content?.html ? (new DOMParser().parseFromString(content.html, "text/html").body.textContent.match(/[一-鿿]/g) || []).length : 0;
  const showAuthority = doc.status === "CURRENT_CANON" && doc.authority;

  // 著录做成一张档案卡：格子里一项一值，不连成一串。现行正文盖档案馆的馆藏章（同风土志封面那枚）。
  const fields = [
    ["状态", stamp(doc.status)],
    doc.version && doc.version !== "未标注" ? ["版本", `<span class="rs-num">${esc(doc.version)}</span>`] : null,
    doc.alias ? ["馆藏编号", `<span class="rs-num">${esc(doc.alias)}</span>`] : null,
    ["层级", esc(levelName)],
    doc.date ? [doc.status === "CURRENT_CANON" ? "清单核定" : "日期", `<span class="rs-num">${esc(doc.date)}</span>`] : null,
    changelog ? ["末次修订", `<a class="rs-link" href="${docHref(changelog.id)}">${esc(changelog.title)}</a>`] : null,
    articles.length || wordCount ? ["篇幅", [articles.length ? `<span class="rs-num">${articles.length}</span> 条` : "", wordCount ? `约 <span class="rs-num">${wordCount.toLocaleString("en-US")}</span> 字` : ""].filter(Boolean).join("，")] : null,
  ].filter(Boolean);
  const record = `<div class="rs-card">
    ${doc.status === "CURRENT_CANON" ? `<div class="rs-seal" aria-hidden="true">${bookStamp()}</div>` : ""}
    <dl class="rs-card-fields">${fields.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    ${versions.length > 1 ? `<p class="rs-card-row"><span class="rs-k">版本</span><span class="rs-versions">${versions.map((v, i) => (i === here ? `<span class="is-here">${esc(v.label)}</span>` : `<a class="${v.branch ? "is-branch" : ""}" href="${docHref(v.doc.id)}" title="${esc(STAMPS[v.doc.status]?.[0] || "")}${v.branch ? "，同号分支" : ""}">${esc(v.label)}</a>`)).join("")}</span></p>` : ""}
    ${doc.topics.length ? `<p class="rs-card-row"><span class="rs-k">主题</span><span>${doc.topics.map((t) => `<a class="rs-link" href="${browseHref({ topic: t })}">${esc(t)}</a>`).join("、")}</span></p>` : ""}
    ${doc.institutions.length ? `<p class="rs-card-row"><span class="rs-k">提及机构</span><span>${doc.institutions.map((n) => `<a class="rs-link" href="${orgHref(n)}">${esc(n)}</a>`).join("、")}</span></p>` : ""}
    ${showAuthority ? `<p class="rs-card-row"><span class="rs-k">适用依据</span><span class="rs-authority">${esc(doc.authority)}</span></p>` : ""}
    <p class="rs-card-actions">${backlinks.length ? `<button class="rs-peekable" type="button" data-peek="backlinks">被引 ${backlinks.length} 处</button>` : ""}<a class="rs-link" href="${esc(doc.rawUrl)}" download>下载原件（${esc(doc.extension)}）</a></p>
  </div>`;

  const branches = versions.some((v) => v.branch);
  const revbar = history.size && lead >= 0
    ? `<div class="rs-revbar"><span>与 <b>${esc(prev)}</b> 对照：改动 <b>${revised.size - added}</b> 条，新增 <b>${added}</b> 条${removed ? `，删去 <b>${removed}</b> 条` : ""}。</span>${revised.size ? `<label><input type="checkbox" class="rs-only-revised">只看改动</label>` : ""}<span class="rs-legend-line"><i></i>未改　<i class="is-filled"></i>有改动　<i class="is-bar"></i>本版改动${branches ? `　<i class="is-dashed"></i>同号分支` : ""}　每条左侧一格一版，按版本号排列（${esc(versions[0].label)} 至 ${esc(versions.at(-1).label)}）以便逐条对照；版本号本身不证明先后${branches ? "，内容不同的同号分支并列，不作为下一版的对照对象" : ""}。指针移到方块上看与前一版号的差异。“也涉及”按馆藏筛选的关键词标出本文件主题以外的主题；“提及”是名称出现，不代表隶属或授权，加粗的在机构名录里有本条的设立或规范依据。</span></div>`
    : history.size ? `<div class="rs-revbar"><span>这是版本号最早的一版，共 ${versions.length} 版。</span></div>` : "";

  const body = blocks.map((b) => {
    const slug = (b.id || "").replace(/^section-/, "");
    if (b.type === "part") {
      const m = b.text.match(/^第([一二三四五六七八九十百]+)编/);
      return `<h2 class="rs-part" id="${esc(b.id)}">${m ? `<small lang="la">Pars ${roman(cnNumber(m[1]))}</small>` : ""}${esc(b.text)}</h2>`;
    }
    if (b.type === "chapter") return `<h3 class="rs-chapter" id="${esc(b.id)}">${esc(b.text)}</h3>`;
    if (b.type === "flow") return `<div class="rs-flow">${b.nodes.map(flowHTML).join("")}</div>`;
    const states = history.get(b.key);
    const text = b.title + "\n" + b.nodes.map(blockText).join("\n");
    const topics = topicTags(text, doc.topics);
    const orgs = orgMentions(text, doc, slug);
    const isRevised = revised.has(b.key);
    const gutter = `${states ? vlineHTML(b.key, states, versions, here) + `<p class="rs-vnote">${vnoteHTML(states, versions, here)}</p>` : ""}
      ${topics.length ? `<p class="rs-tags"><em>也涉及</em>${topics.map((t) => `<a href="${browseHref({ topic: t })}">${esc(t)}</a>`).join("")}</p>` : ""}
      ${orgs.length ? `<p class="rs-tags"><em>提及</em>${orgs.map(({ r, name, evidence }) => `<a class="${evidence ? "is-evidence" : ""}" href="${orgHref(r.id)}" title="${esc(r.name)}：${esc(r.summary || "")}${evidence ? (evidence === "establishes" ? "（本条设立）" : "（本条规范）") : ""}">${esc(name)}</a>`).join("")}</p>` : ""}`;
    const mark = isRevised ? `<span class="rs-stamp is-revision">${history.get(b.key)[here].state === "new" ? "本版新增" : "本版改动"}</span>` : "";
    const head = b.lead ? (mark ? `<p class="rs-art-mark">${mark}</p>` : "") : `<h3><span class="rs-art-no">${esc(b.key)}</span>${esc(b.title)}${mark}</h3>`;
    return `<section class="rs-art${b.lead ? " is-lead" : ""}${isRevised ? " is-revised" : ""}" id="${esc(b.id)}" data-key="${esc(b.key)}">
      <aside class="rs-art-gutter">${gutter}</aside>
      <div class="rs-art-body">${head}${b.nodes.map((n) => n.outerHTML).join("")}</div>
    </section>`;
  }).join("");

  const rest = (shown) => `继续显示（还剩 ${(content.text.length - shown).toLocaleString("en-US")} 字符）`;
  const fallback = !content ? `<p class="rs-error">正文读取失败。</p>` : content.text !== undefined ? `<div class="rs-flow"><pre class="rs-plain">${esc(content.text.slice(0, TEXT_BATCH))}</pre>${content.text.length > TEXT_BATCH ? `<button class="rs-more" type="button">${rest(TEXT_BATCH)}</button>` : ""}</div>` : "";
  const parts = blocks.filter((b) => b.type !== "flow");
  const toc = parts.length ? tocHTML(blocks, revised, doc) : (content?.toc || []).filter((h) => h.level >= 2 && h.level <= 3).map((h) => `<li><a href="${docHref(doc.id, { anchor: h.slug })}" data-target="section-${esc(h.slug)}">${esc(h.label)}</a></li>`).join("");

  main.dataset.doc = doc.id;
  main.innerHTML = `<div class="rs-doc">
    <nav class="rs-toc" aria-label="本页目录"><p class="rs-toc-title">目录${rubric("Index")}</p>${toc ? `<ol>${toc}</ol>` : `<p class="rs-vnote">此文件没有章节标题。</p>`}</nav>
    <article class="rs-doc-main">
      <button class="rs-toc-toggle" type="button" aria-expanded="false">目录</button>
      <p class="rs-crumbs"><a href="#/home">档案馆</a> / <a href="${browseHref({ collection: doc.collection })}">${esc(index.collections[doc.collection] || doc.collection)}</a>${doc.category && doc.category !== doc.collection ? ` / ${esc(doc.category)}` : ""}</p>
      <header class="rs-doc-head">
        <h1>${esc(titleOf(doc))}</h1>
        ${latin ? `<p class="rs-subtitle" lang="la">${esc(latin)}</p>` : ""}
        ${GUIDES[doc.alias] && doc.status === "CURRENT_CANON" ? `<p class="rs-doc-guide">${esc(GUIDES[doc.alias])}</p>` : ""}
        ${record}
      </header>
      ${revbar}
      <div class="rs-text">${body || fallback}</div>
      ${colophon(doc)}
    </article>
  </div>`;
  linkRefs(main.querySelector(".rs-text"), doc, new Set(articles.map((b) => b.key)));
  const more = main.querySelector(".rs-more");
  let shown = TEXT_BATCH;
  more?.addEventListener("click", () => {
    main.querySelector(".rs-plain").append(content.text.slice(shown, shown + TEXT_BATCH));
    shown += TEXT_BATCH;
    if (shown >= content.text.length) more.remove();
    else more.textContent = rest(shown);
  });
  wireDoc(doc);
  reveal(params);
}

function tocHTML(blocks, revised, doc) {
  let html = "", open = false;
  const link = (b, label, cls = "") => `<a class="${cls}" href="${docHref(doc.id, { anchor: (b.id || "").replace(/^section-/, "") })}" data-target="${esc(b.id)}">${esc(label)}</a>`;
  for (const b of blocks) {
    if (b.type === "part") {
      if (open) html += "</ol></li>";
      html += `<li class="rs-toc-part">${link(b, b.text)}<ol>`;
      open = true;
    } else if (b.type === "chapter" || b.type === "article") {
      if (!open) { html += `<li class="rs-toc-part"><ol>`; open = true; }
      html += `<li class="${b.type === "chapter" ? "rs-toc-chapter" : ""}">${link(b, b.type === "article" ? [b.key, b.title].filter(Boolean).join(" ") : b.text, revised.has(b.key) ? "is-revised" : "")}</li>`;
    }
  }
  return open ? html + "</ol></li>" : html;
}

function colophon(doc) {
  const rows = [
    ["路径", `<span translate="no">${esc(doc.path)}</span>`],
    ["所在", esc(index.collections[doc.collection] || doc.collection)],
    ["状态依据", esc(doc.statusBasis || "未标注")],
    ["来源", esc(doc.source || "未标注")],
    ["权威", esc(doc.authority || "未标注")],
    ["来源日期", esc(doc.date || "未标注")],
    ["文件修改", `${esc(localDate(doc.modified))}<span class="rs-vnote">　只用于辅助排序，不证明法规更新</span>`],
    ["SHA-256", `<span class="rs-mono" translate="no">${esc(doc.sha256)}</span>`],
    ["原件", `<a class="rs-link" href="${esc(doc.rawUrl)}" download>${esc(doc.name)}</a>`],
  ];
  return `<section class="rs-colophon" aria-label="著录"><h2>著录${rubric("Descriptio")}</h2><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></section>`;
}

// 文内引用：《书名》链到现行文献，《书名》第N条与本文件的“第N条”链到条文；悬停即看原文。
function linkRefs(root, doc, ownArticles) {
  if (!root) return;
  const titles = new Map(docs.filter((d) => d.status === "CURRENT_CANON").map((d) => [plain(d.title), d]));
  // 法律标题带国名（D93）；风土志与旧稿里的简称、“联盟××法”的旧写法照样链到现行正文。
  for (const [t, d] of [...titles]) if (t.startsWith("银色联盟")) for (const alias of [t.slice(4), "联盟" + t.slice(4)]) if (!titles.has(alias)) titles.set(alias, d);
  const charter = canonByAlias().get("K12");
  if (charter) titles.set("宪章", charter); // 法律正文里《宪章》即联盟宪章
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest("h1,h2,h3,h4,h5,h6,a,code,pre,.rs-art-gutter,.rs-art-no") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    let match, last = 0, frag = null, prev = null;
    XREF.lastIndex = 0;
    while ((match = XREF.exec(text))) {
      let target = null, art = null;
      if (match[1] !== undefined) {
        target = titles.get(match[1]) || null;
        art = match[2] || null;
      } else {
        art = match[0];
        const gap = prev ? text.slice(prev.end, match.index) : null;
        // “《某法》第二条、第四条”“宪章第八条第2款至第十条”：接在顿号、和、至之后的条号仍属前一部法。
        if (prev?.art && SERIES.test(gap)) target = prev.target;
        else if (text.slice(Math.max(0, match.index - 2), match.index) === "行政") {
          // “《白银执政院组织架构》行政第二条”是该文行政编的条文，只链到该文。
          target = prev && !prev.art && gap === "行政" ? prev.target : null;
          art = null;
        } else {
          target = text.slice(Math.max(0, match.index - 2), match.index) === "宪章" && doc.alias !== "K12" ? charter : doc;
          if (target?.id === doc.id && !ownArticles.has(art)) target = null;
        }
      }
      prev = null;
      if (!target || (target.id === doc.id && !art)) continue;
      prev = { target, art, end: match.index + match[0].length };
      const a = document.createElement("a");
      a.className = "rs-xref" + (target.id === doc.id ? " is-local" : "");
      a.href = docHref(target.id, art ? { art } : null);
      a.textContent = match[0];
      a.dataset.peek = art ? "article" : "doc";
      a.dataset.doc = target.id;
      if (art) a.dataset.art = art;
      frag ??= document.createDocumentFragment();
      frag.append(text.slice(last, match.index), a);
      last = match.index + match[0].length;
    }
    if (frag) {
      frag.append(text.slice(last));
      node.replaceWith(frag);
    }
  }
}

let docScroll = null;
function wireDoc(doc) {
  docScroll?.abort();
  docScroll = new AbortController();
  const shell = main.querySelector(".rs-doc"), toc = main.querySelector(".rs-toc");
  main.querySelector(".rs-only-revised")?.addEventListener("change", (event) => shell.classList.toggle("is-only-revised", event.target.checked));
  const toggle = main.querySelector(".rs-toc-toggle");
  toggle.addEventListener("click", () => {
    const open = shell.classList.toggle("is-toc-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  const targets = [...main.querySelectorAll(".rs-text [id]")].filter((el) => toc.querySelector(`[data-target="${CSS.escape(el.id)}"]`));
  let queued = false, active = "";
  const spy = () => {
    queued = false;
    let current = targets[0];
    for (const el of targets) { if (el.getBoundingClientRect().top > 120) break; current = el; }
    if (!current || current.id === active) return;
    active = current.id;
    toc.querySelectorAll("a[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
    const link = toc.querySelector(`[data-target="${CSS.escape(active)}"]`);
    if (!link) return;
    link.setAttribute("aria-current", "location");
    const top = link.offsetTop - toc.offsetTop, view = toc.clientHeight;
    if (top < toc.scrollTop + 40 || top > toc.scrollTop + view - 60) toc.scrollTop = Math.max(0, top - view / 3);
  };
  window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(spy); } }, { passive: true, signal: docScroll.signal });
  spy();
}

// 按 ?art=第N条、?anchor=节标题或 ?section=record（著录）定位；同一份文件内跳转不重排页面。
function reveal(params) {
  const art = params.get("art"), anchor = params.get("anchor");
  const target = art ? main.querySelector(`.rs-art[data-key="${CSS.escape(art)}"]`) : anchor ? document.getElementById("section-" + anchor) : params.get("section") === "record" ? main.querySelector(".rs-colophon") : null;
  if (!target) { window.scrollTo(0, 0); return; }
  target.scrollIntoView({ block: "start" });
  target.classList.remove("is-flash");
  void target.offsetWidth;
  target.classList.add("is-flash");
  setTimeout(() => target.classList.remove("is-flash"), 1800);
}

/* ---------- 悬停预览 ---------- */

const peek = { el: null, anchor: null, showTimer: 0, hideTimer: 0 };
function setupPeek() {
  peek.el = document.createElement("div");
  peek.el.className = "rs-peek";
  peek.el.hidden = true;
  peek.el.setAttribute("role", "tooltip");
  peek.el.id = "rs-peek";
  document.body.append(peek.el);
  document.addEventListener("pointerover", (event) => {
    if (event.target.closest(".rs-peek")) { clearTimeout(peek.hideTimer); return; }
    const t = event.target.closest("[data-peek]");
    if (t && event.pointerType !== "touch") schedulePeek(t, 220);
  });
  document.addEventListener("pointerout", (event) => {
    const t = event.target.closest("[data-peek], .rs-peek");
    if (t && !t.contains(event.relatedTarget)) { clearTimeout(peek.showTimer); scheduleHide(); }
  });
  document.addEventListener("focusin", (event) => {
    const t = event.target.closest("[data-peek]");
    if (t) schedulePeek(t, 0);
  });
  document.addEventListener("focusout", (event) => { if (event.target.closest("[data-peek]")) scheduleHide(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") hidePeek(); });
  // 滚动时收起预览；键盘聚焦的链接还在焦点上时（Tab 会把页面滚到它那里）跟着重新定位。
  window.addEventListener("scroll", () => {
    if (peek.el.hidden || peek.el.matches(":hover")) return;
    if (peek.anchor && peek.anchor === document.activeElement) placePeek(peek.anchor);
    else hidePeek();
  }, { passive: true });
}
function schedulePeek(target, delay) {
  clearTimeout(peek.hideTimer);
  clearTimeout(peek.showTimer);
  if (peek.anchor === target && !peek.el.hidden) return;
  peek.showTimer = setTimeout(async () => {
    peek.anchor = target;
    let html;
    try { html = await peekContent(target); } catch (error) { html = `<p class="rs-peek-body">读取失败：${esc(error.message)}</p>`; }
    if (peek.anchor !== target || !html || !target.isConnected) return;
    peek.el.innerHTML = html;
    placePeek(target);
    target.setAttribute("aria-describedby", "rs-peek");
  }, delay);
}
function scheduleHide() {
  clearTimeout(peek.hideTimer);
  peek.hideTimer = setTimeout(hidePeek, 260);
}
function hidePeek() {
  clearTimeout(peek.showTimer);
  peek.anchor?.removeAttribute("aria-describedby");
  if (peek.el) peek.el.hidden = true;
  peek.anchor = null;
}
function placePeek(anchor) {
  const el = peek.el, r = anchor.getBoundingClientRect();
  el.style.left = "0px";
  el.style.top = "0px";
  el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight;
  const left = Math.min(Math.max(12, r.left - 8), innerWidth - w - 12);
  let top = r.bottom + 8;
  if (top + h > innerHeight - 12 && r.top - h - 8 > 12) top = r.top - h - 8;
  el.style.left = left + "px";
  el.style.top = Math.max(12, top) + "px";
}
const clip = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() + "……" : s);
async function peekContent(t) {
  const kind = t.dataset.peek;
  if (kind === "diff") return diffPeek(t.dataset.key, +t.dataset.v);
  if (kind === "evidence") {
    // 机构关系的依据：文件、章节与原文（机构名录 data/institutions.json）。
    const owner = registry.institutions.find((x) => x.id === t.dataset.org), edge = owner?.relations[+t.dataset.rel];
    if (!edge) return "";
    const target = registry.institutions.find((x) => x.id === edge.target);
    return `<div class="rs-peek-head"><span class="rs-peek-title">${esc(owner.name)} → ${esc(target?.name || "")}</span><span class="rs-peek-meta">${esc((ORG.relation[edge.type] || [edge.type])[0])}</span></div><ul class="rs-peek-list">${(edge.sources || []).map((s) => `<li><a href="${docHref(s.docId, s.anchor ? { anchor: s.anchor } : null)}">${esc(s.title || "")} ${esc(s.section || "")}</a><div class="rs-peek-body">${esc(clip(String(s.quote || "").replace(/^#{1,6}[^\n]*\n+/, "").replace(/\s+/g, " ").trim(), 220))}</div></li>`).join("")}</ul>`;
  }
  if (kind === "backlinks") {
    const list = (relationships[page?.doc.id]?.backlinks || []).map((id) => byId.get(id)).filter(Boolean);
    return `<div class="rs-peek-head"><span class="rs-peek-title">引用本文件的馆藏</span><span class="rs-peek-meta">${list.length} 处</span></div><ul class="rs-peek-list">${list.map((d) => `<li>${stamp(d.status)} <a href="${docHref(d.id)}">${esc(d.title)}</a><div class="rs-peek-meta">${esc(d.path)}</div></li>`).join("")}</ul>`;
  }
  const d = byId.get(t.dataset.doc);
  if (!d) return "";
  const head = (extra = "") => `<div class="rs-peek-head">${stamp(d.status)}<span class="rs-peek-title">${esc(d.title)}${extra}</span><span class="rs-peek-meta">${esc(d.version)}</span>${d.alias ? `<span class="rs-peek-meta">${esc(d.alias)}</span>` : ""}</div>`;
  if (kind === "article") {
    const content = await loadDoc(d.id);
    const article = articleMap(content.html || "").get(t.dataset.art);
    if (!article) return `${head()}<p class="rs-peek-body">没有找到${esc(t.dataset.art)}。</p>`;
    return `${head()}<div class="rs-peek-body"><b>${esc(article.key)} ${esc(article.title)}</b>\n${esc(clip(article.text, 420))}</div><div class="rs-peek-foot"><span>${d.id === page?.doc.id ? "本文件" : "其他文件"}</span><a class="rs-link" href="${docHref(d.id, { art: t.dataset.art })}">打开这一条</a></div>`;
  }
  const content = await loadDoc(d.id);
  const first = content.html ? [...new DOMParser().parseFromString(content.html, "text/html").body.querySelectorAll("p")].map((p) => squash(p.textContent)).find((s) => s.length > 20) : squash(content.text || "");
  return `${head()}<div class="rs-peek-body">${esc(GUIDES[d.alias] && d.status === "CURRENT_CANON" ? GUIDES[d.alias] : clip(first || d.excerpt || "", 180))}</div><div class="rs-peek-foot"><span>${esc(d.category || "")}</span><a class="rs-link" href="${docHref(d.id)}">打开全文</a></div>`;
}
function diffPeek(key, i) {
  if (!page) return "";
  const s = page.history.get(key)?.[i], v = page.versions[i];
  if (!s?.article) return "";
  const range = s.before ? `${v.label} 与 ${page.versions[s.from]?.label} 对照` : v.label;
  const words = { origin: "版本号最早的一版", new: "此版新增", changed: "有改动", same: "条文相同" };
  const after = `${s.article.title}\n${s.article.text}`;
  const body = s.state === "changed" ? diffHTML(`${s.before.title}\n${s.before.text}`, after) : s.state === "new" ? `<ins>${esc(after)}</ins>` : esc(after);
  return `<div class="rs-peek-head"><span class="rs-peek-title">${esc(key)} ${esc(s.article.title)}</span><span class="rs-peek-meta">${esc(range)}，${words[s.state]}</span></div><div class="rs-peek-body">${body}</div><div class="rs-peek-foot"><span>${s.state === "changed" ? "<del>删去的字</del>　<ins>增补的字</ins>" : ""}</span><a class="rs-link" href="${docHref(v.doc.id, { art: key })}">打开 ${esc(v.label)} 的这一条</a></div>`;
}

// 先按句读切分比对，成对改动的句子再逐字比对，只标出改动的字。
function tokens(text) { return text.match(/[^。；，、：！？\n]*[。；，、：！？]|[^。；，、：！？\n]+|\n/g) || []; }
function lcs(a, b) {
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push(["=", a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(["-", a[i++]]);
    else ops.push(["+", b[j++]]);
  }
  while (i < n) ops.push(["-", a[i++]]);
  while (j < m) ops.push(["+", b[j++]]);
  return ops;
}
function diffHTML(before, after) {
  const ops = lcs(tokens(before), tokens(after));
  let html = "", k = 0;
  while (k < ops.length) {
    if (ops[k][0] === "=") { html += esc(ops[k++][1]); continue; }
    const del = [], ins = [];
    while (k < ops.length && ops[k][0] !== "=") (ops[k][0] === "-" ? del : ins).push(ops[k++][1]);
    const a = del.join(""), b = ins.join("");
    if (a && b && a.length * b.length <= 60000)
      html += lcs([...a], [...b]).map(([op, ch]) => (op === "=" ? esc(ch) : op === "-" ? `<del>${esc(ch)}</del>` : `<ins>${esc(ch)}</ins>`)).join("").replace(/<\/del><del>|<\/ins><ins>/g, "");
    else html += (a ? `<del>${esc(a)}</del>` : "") + (b ? `<ins>${esc(b)}</ins>` : "");
  }
  return html;
}

/* ---------- 外壳 ---------- */

async function route() {
  const my = ++serial;
  routeSerial = my;
  hidePeek();
  delete document.body.dataset.navOpen;
  const [path, query = ""] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const [name = "home", ref] = path.split("/").filter(Boolean);
  if (name === "issues") {
    // “未决事项”打开作者的现行未决登记。
    const issues = docs.find((d) => d.path === "00_PROJECT/OPEN_ISSUES.md");
    location.replace(issues ? "#/doc/" + issues.id : "#/audit");
    return;
  }
  if (name === "guide") {
    const guide = docAt(GUIDE_PATH);
    location.replace(guide ? docHref(guide.id) : browseHref({ collection: "07_WORLD_GUIDE" }));
    return;
  }
  // 旧版的“来源与编校”页并入文献页的著录。
  if (name === "provenance") { location.replace(ref ? docHref(ref, { section: "record" }) : "#/browse"); return; }
  const doc = name === "doc" ? byId.get(ref) || canonByAlias().get(ref) : null;
  const reading = doc?.path === GUIDE_PATH && params.get("view") !== "record";
  // 在风土志里换位置（目录、后退）只翻到那一页，不重排整本书。
  if (reading && activeBookReader?.docId === doc.id) { activeBookReader.navigate(params); return; }
  activeBookReader?.destroy();
  archiveObserver?.abort();
  archiveObserver = null;
  delete main.dataset.readerId;
  delete main.dataset.readerRoute;
  // 首页以外各页顶上透出书廊纵深图（见 CSS 的 main::before）；风土志由 book.js 改成 book。
  main.dataset.view = name === "doc" ? "doc" : ["browse", "topics", "institutions", "institution", "versions", "audit"].includes(name) ? name : "home";
  // 编校与维护的材料（作者设定、底稿、提案、项目总卷、审计、源文件目录）归到“编校”。
  const upkeep = (d) => ["AUTHOR_CANON", "CANDIDATE", "PROPOSAL", "UNRESOLVED", "DELEGATED_DESIGN"].includes(d?.status) || ["00_PROJECT", "90_AUDIT"].includes(d?.collection);
  let nav = { home: "home", canon: "canon", browse: "browse", topics: "topics", institutions: "institutions", institution: "institutions", versions: "versions", audit: "audit" }[name] || "";
  if (name === "doc") nav = doc?.path === GUIDE_PATH ? "guide" : doc?.status === "CURRENT_CANON" ? "canon" : upkeep(doc) ? "audit" : "browse";
  if (name === "browse") nav = params.get("topic") ? "topics" : params.get("status") === "CURRENT_CANON" ? "canon" : params.has("directory") || upkeep({ status: params.get("status"), collection: params.get("collection") }) ? "audit" : "browse";
  document.querySelectorAll(".rs-nav [data-nav]").forEach((a) => (a.dataset.nav === nav ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  if (name !== "doc" || reading) {
    delete main.dataset.doc;
    page = null;
    docScroll?.abort();
  }
  try {
    if (reading) { window.scrollTo(0, 0); await bookDetail(doc, params, my); }
    else if (name === "doc") await docPage(ref, params, my);
    else if (["browse", "topics", "institutions", "institution", "versions", "audit"].includes(name)) {
      window.scrollTo(0, 0);
      if (name === "browse") await browsePage(params, my);
      else if (name === "topics") topicsPage();
      else if (name === "institutions") institutionsPage(params);
      else if (name === "institution") institutionPage(ref);
      else if (name === "versions") await versionsPage(my);
      else auditPage();
    } else {
      await home(my);
      if (my !== serial) return;
      if (name === "canon") $("#rs-canon")?.scrollIntoView({ block: "start" });
      else window.scrollTo(0, 0);
    }
  } catch (error) {
    if (my === serial) main.innerHTML = `<p class="rs-error">读取失败：${esc(error.message)}</p>`;
  }
}

function setupChrome() {
  // 默认石室（暗色）；白昼是纸本阅读模式。选择只存本机。
  $(".rs-foot").insertAdjacentHTML("afterbegin", `<span class="rs-foot-mark">${sigilHTML()}</span>`);
  const button = $(".rs-theme");
  let mode = "night";
  try { mode = localStorage.getItem("rs-mode") === "day" ? "day" : "night"; } catch {}
  const forced = new URLSearchParams(location.search).get("mode"); // ?mode=day 只管这一次打开，便于截图
  if (forced === "day" || forced === "night") mode = forced;
  const apply = (value) => {
    if (value === "day") document.documentElement.dataset.theme = "day";
    else delete document.documentElement.dataset.theme;
    button.setAttribute("aria-pressed", String(value === "day"));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", value === "day" ? "#f2f1ec" : "#151816");
  };
  apply(mode);
  button.addEventListener("click", () => {
    mode = mode === "day" ? "night" : "day";
    apply(mode);
    try { localStorage.setItem("rs-mode", mode); } catch {}
  });
  $("#global-search").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = $("#global-query").value.trim();
    if (q) location.href = browseHref({ q });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.target.closest("input, textarea")) return;
    const field = [$("#rs-hero-query"), $("#global-query")].find((el) => el && el.getClientRects().length);
    if (field) { event.preventDefault(); field.focus(); }
  });
  // 阅读器里的站内导航：左端按钮开合下拉列表，点别处、按 Escape 或换页时收起。
  const menu = $("#menu-toggle");
  const setNav = (open) => {
    if (open) document.body.dataset.navOpen = "";
    else delete document.body.dataset.navOpen;
    archiveNavSync();
  };
  menu.addEventListener("click", () => setNav(!("navOpen" in document.body.dataset)));
  document.addEventListener("click", (event) => { if ("navOpen" in document.body.dataset && !event.target.closest("#site-nav, #menu-toggle")) setNav(false); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && "navOpen" in document.body.dataset) { setNav(false); menu.focus(); }
  });
  setupPeek();
}

async function start() {
  try {
    [index, relationships, registry, plan] = await Promise.all(["data/metadata.json", "data/relationships.json", "data/institutions.json", "book-plan.json"].map(fetchJSON));
  } catch (error) {
    main.innerHTML = `<p class="rs-error">馆藏索引读取失败：${esc(error.message)}。请先运行 build.py，并用本地 HTTP 服务打开。</p>`;
    return;
  }
  docs = index.documents;
  byId = new Map(docs.map((d) => [d.id, d]));
  const built = $("#rs-built");
  built.textContent = localDate(index.builtAt);
  built.dateTime = index.builtAt;
  setupChrome();
  window.addEventListener("hashchange", route);
  route();
}
document.addEventListener("DOMContentLoaded", start);
