"use strict";
// Presentation vocabulary only. No document status, authority or relation is inferred here.
const ARCHIVE_GUIDES = {
  K12:'由规范层级、成员城邦与公民保障，进入议会、行政、裁断和财政制度。',
  K28:'了解白塔的位面性质、法则守护，以及寰宇文库的保管和查阅规则。',
  K20:'查阅魔力取用、环级认定、施法许可与禁制，以及相关公共秩序。',
  K29:'从知识收存、分层与移交，了解典藏记录的保管与查阅。'
};
const TOPIC_GUIDES = {
  '宪政与治理':'从宪章到议会与执政机关，查阅规范层级和权力边界。',
  '魔法体系与魔法法':'查阅环级认定、施法许可与禁术边界。',
  '司法监察与治安':'查阅监察、裁断与治安机关的职责和程序。',
  '军事与防务':'了解联盟防务制度与战备组织。',
  '学术与研究机构':'了解白塔、图书馆和学会的典藏与研究规则。',
  '财政货币与经济':'查阅联盟货币、储备系统及其职责。',
  '审计与测试':'查阅项目整编、冲突登记与场景推演；此处为项目资料。'
};
// Only functional utility marks remain from the previous implementation.
const ICON_PATHS = {
  search:'M17 10a7 7 0 11-14 0 7 7 0 0114 0M15 15l6 6',
  menu:'M3 6h18M3 12h18M3 18h18',
  arrow:'M4 12h15M13 6l6 6-6 6'
};
function archiveIcon(name='book') {
  const names={tower:'emblem-b-small',home:'nav-home',book:'nav-codex',shelves:'nav-holdings',topics:'nav-topics',institution:'nav-institutions',relations:'nav-versions',archive:'nav-history',quill:'nav-author',shield:'topic-defense',magic:'topic-magic',law:'topic-justice',coin:'topic-treasury',audit:'nav-versions'};
  if(BAITA_ICONS[name]||names[name])return baitaIcon(names[name]||name);
  return `<svg class="icon utility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name] || ICON_PATHS.arrow}"/></svg>`;
}
function silverOrnament(){return '<svg class="silver-weave" viewBox="0 0 144 26" fill="none" aria-hidden="true"><path d="M1 13h47l12-8 12 8 12-8 12 8h47M16 18h32l12-8 12 8 12-8 12 8h32M1 13l5-4v8zm142 0-5-4v8zM67 13l5-8 5 8-5 8z" stroke="currentColor" stroke-width="1"/></svg>'}
function silverCorners(){return ['tl','tr','br','bl'].map(c=>`<svg class="silver-corner ${c}" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M1 47V1h46M7 38V7h31M1 23l22-22M8 26l18-18M13 18l5-5 5 5-5 5z" stroke="currentColor"/><path d="M2 40V2h38" stroke="#d6dfdc" stroke-opacity=".6"/></svg>`).join('')}
function engravedDivider(){return `<div class="engraved-divider" aria-hidden="true">${silverOrnament()}</div>`}
function topicIcon(t){return ({'宪政与治理':'topic-constitution','魔法体系与魔法法':'topic-magic','司法监察与治安':'topic-justice','军事与防务':'topic-defense','学术与研究机构':'topic-academy','财政货币与经济':'topic-treasury','审计与测试':'nav-versions'})[t] || 'nav-codex'}
function displayTitle(doc){
  const names={
    'CURRENT_CANON_MANIFEST.json':'现行文献清单',
    'VERSION_LEDGER.md':'版本沿革登记',
    'CANDIDATE_CANON_INDEX.md':'原整编候选索引',
    'PROJECT_INDEX.md':'项目总卷索引',
    'CANON_INDEX.md':'权威与适用限制',
    'AUTHOR_FOUNDATIONS_v0.1.md':'作者基础设定',
    'CONFLICTS.md':'冲突与处理记录'
  };
  if(names[doc.name])return names[doc.name];
  if(doc.kind==='changelog'){
    const group=index.versionSets.find(g=>g.changelog===doc.id),current=byId.get(group?.current);
    if(current)return current.title+' · 修订记录';
  }
  return doc.title;
}
function archiveEnter(page){archiveObserver?.abort();document.body.dataset.page=page;document.body.dataset.design='archive'}
function archiveNavSync(){
  const sidebar=document.querySelector('#sidebar');
  sidebar.inert=matchMedia('(max-width:780px)').matches&&!sidebar.classList.contains('open');
}
let archiveObserver;
function markArchiveChapter(id){
  main.querySelectorAll('#toc a').forEach(a=>{
    if(a.dataset.section===id){a.setAttribute('aria-current','location');const parent=a.closest('.toc-group');if(parent){parent.classList.add('toc-current');if(!parent.open)parent.open=true}}
    else a.removeAttribute('aria-current');
  });
  main.querySelectorAll('.toc-group').forEach(g=>g.classList.toggle('toc-current',!!g.querySelector('[aria-current]')));
}
function archiveWithinReader(page,doc,params){
  if(!['doc','provenance'].includes(page)||main.dataset.readerId!==doc?.id||main.dataset.readerRoute!==page)return false;
  const target=document.getElementById(params.get('section')==='record'?'source-record':'section-'+params.get('anchor'));
  if(!target||(!params.get('anchor')&&!params.get('section')))return false;
  if(!matchMedia('(min-width:1241px)').matches)document.querySelector('.reader-contents').open=false;
  target.scrollIntoView();target.tabIndex=-1;target.focus({preventScroll:true});markArchiveChapter(target.id);return true;
}
function archiveReader(doc,content,provenance=false){
  main.dataset.readerId=doc.id;main.dataset.readerRoute=provenance?'provenance':'doc';
  const title=main.querySelector('.document-body-title');
  const repeatedSlug=title?.id?.replace(/^section-/, '');
  if(title){main.querySelector('.document-header').id=title.id;title.hidden=true;title.removeAttribute('id')}
  const route=provenance?'provenance':'doc',groups=[];
  content.toc.filter(h=>h.slug!==repeatedSlug).forEach(h=>{if(h.level<=2||!groups.length)groups.push({heading:h,children:[]});else groups.at(-1).children.push(h)});
  const link=(h,label=h.label)=>`<a class="${h.level>3?'toc-deep':''}" data-section="section-${esc(h.slug)}" href="#/${route}/${doc.id}?anchor=${encodeURIComponent(h.slug)}">${esc(label)}</a>`;
  $('#toc').innerHTML=groups.map(g=>g.children.length?`<details class="toc-group"><summary>${esc(g.heading.label)}</summary><div>${link(g.heading,'本节起始')}${g.children.map(h=>link(h)).join('')}</div></details>`:link(g.heading)).join('')||'<p class="catalogue-note">此文件没有章节标题。</p>';
  const contents=$('.reader-contents');contents.open=!provenance&&matchMedia('(min-width:1241px)').matches;
  contents.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href]');
    if(anchor?.getAttribute('href')===location.hash){event.preventDefault();archiveWithinReader(route,doc,new URLSearchParams(location.hash.split('?')[1]||''))}
  });
  contents.insertAdjacentHTML('beforeend',`<a class="toc-record" href="#/${route}/${doc.id}?section=record">编目、来源与适用依据</a>`);
  // The page owns reading scroll. Only the bounded, sticky contents can scroll separately.
  archiveObserver=new AbortController();
  const headings=[...main.querySelectorAll('.document-body h1[id],.document-body h2[id],.document-body h3[id],.document-body h4[id]')];
  let scheduled=false,activeId='';
  const updateChapter=()=>{scheduled=false;let current=headings[0];for(const h of headings){if(h.getBoundingClientRect().top>150)break;current=h}if(current&&current.id!==activeId){activeId=current.id;markArchiveChapter(activeId)}};
  window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateChapter)}},{passive:true,signal:archiveObserver.signal});
  updateChapter();
}
async function archiveHome(serial){
  const canon=docs.filter(d=>d.status==='CURRENT_CANON'),charter=canon.find(d=>d.alias==='K12'),tower=canon.find(d=>d.alias==='K28');
  if(!charter||!tower){prototypeHome();return}
  const guide=docAt(GUIDE_PATH);
  const texts=await Promise.all([charter,tower,guide].filter(Boolean).map(d=>fetch(`docs/${d.id}.json`).then(r=>{if(!r.ok)throw new Error('首页文献读取失败');return r.json()})));
  if(serial!==routeSerial)return;
  const sixth=texts[1].toc.find(h=>h.label.startsWith('第六条'));
  const parsed=new DOMParser().parseFromString(texts[0].html,'text/html');
  const second=[...parsed.querySelectorAll('h3')].find(h=>h.textContent.startsWith('第二条'));
  const excerpt=second?.nextElementSibling?.textContent.match(/^.*?[。；]/)?.[0]||'';
  const record=d=>`<div class="item-meta">${archiveStatus(d)}<span>${esc(d.version)}</span><span>来源编号 ${esc(d.alias)}</span></div>`;
  const secondary=['K28','K20'].map(alias=>canon.find(d=>d.alias===alias)).filter(Boolean);
  main.innerHTML=`<section class="archive-hero" aria-labelledby="archive-title"><img class="hero-art" src="assets/charter-hall.png" width="1672" height="941" fetchpriority="high" alt="深色皮革宪章典籍与哑银书扣，封面题名 Charta Foederis Argentei，远处为层叠石构书廊；概念演绎"><div class="hero-copy"><h1 id="archive-title">白塔档案馆</h1>${silverOrnament()}<p>${guide?'初次来访，可先读《布加风土志》认识布加；<br>再从联盟宪章出发，查阅法典与机构章程。':'从联盟宪章出发，<br>查阅法典、机构章程与历代知识的来源。'}</p><blockquote>白塔封存的知识不予销毁。</blockquote><cite><a href="#/doc/${tower.id}${sixth?'?anchor='+encodeURIComponent(sixth.slug):''}">《白塔章程》第六条</a></cite><div class="hero-actions">${guide?`<a class="button primary" href="#/doc/${guide.id}">阅读《布加风土志》${archiveIcon('arrow')}</a><a class="text-link" href="#/doc/${charter.id}">阅读现行宪章${archiveIcon('arrow')}</a>`:`<a class="button primary" href="#/doc/${charter.id}">阅读现行宪章${archiveIcon('arrow')}</a>`}</div></div></section>
    <div class="home-content">${guide&&texts[2]?guideSection(guide,texts[2]):''}<section class="home-section" aria-labelledby="canon-title"><div class="register-heading"><h2 id="canon-title">现行法典</h2><a href="${browseUrl({status:'CURRENT_CANON'})}" class="text-link">查阅现行文献清单${archiveIcon('arrow')}</a></div><p class="section-intro">从基础文献了解联盟的制度与知识传统。</p><div class="featured-register"><article class="featured-volume">${silverCorners()}${record(charter)}<h3>${linkDoc(charter.id)}</h3><p>${ARCHIVE_GUIDES.K12}</p>${excerpt?`<blockquote>${esc(excerpt)}</blockquote><a class="text-link" href="#/doc/${charter.id}?anchor=${encodeURIComponent(texts[0].toc.find(h=>h.label.startsWith('第二条'))?.slug||'')}">第二条 · 规范层级</a>`:''}</article><div class="featured-secondary">${secondary.map(d=>`<article>${record(d)}<h3>${linkDoc(d.id)}</h3><p>${ARCHIVE_GUIDES[d.alias]}</p><a class="text-link" href="#/doc/${d.id}">阅读条文${archiveIcon('arrow')}</a></article>`).join('')}</div></div></section>
    ${engravedDivider()}<section class="home-explore" aria-labelledby="explore-title"><div class="register-heading"><h2 id="explore-title">探索馆藏</h2></div>
    <div class="explore-group"><div class="explore-head"><h3>按主题</h3><a class="text-link" href="#/topics">主题总目${archiveIcon('arrow')}</a></div><div class="topic-portals">${index.topics.filter(t=>t!=='审计与测试').map(t=>`<article class="topic-portal">${archiveIcon(topicIcon(t))}<h4><a href="${browseUrl({topic:t,status:'CURRENT_CANON'})}">${esc(t)}</a></h4><p>${esc(TOPIC_GUIDES[t]||'按主题查阅现有文献。')}</p><small>${canon.filter(d=>d.topics.includes(t)).length} 份现行文献</small></article>`).join('')}</div></div>
    ${institutionRegistry?.institutions?`<div class="explore-group"><div class="explore-head"><h3>按机构</h3><a class="text-link" href="#/institutions">机构总目${archiveIcon('arrow')}</a></div><ul class="institution-portals">${orgSections().map(sec=>[sec,institutionRegistry.institutions.filter(r=>r.status==='current'&&r.kind!=='设施'&&orgSectionOf(r.category)===sec.id).length]).filter(([,n])=>n).map(([sec,n])=>`<li><a href="${esc(orgDirectoryUrl({group:sec.id}))}">${esc(sec.name)}</a><small>${n} 个现行机构</small></li>`).join('')}</ul></div>`:''}</section>
    <section class="home-maintenance" aria-labelledby="maintenance-title"><h2 id="maintenance-title">来源与编校</h2><p class="catalogue-note">现行正文以清单为依据，受作者最高依据与明确决定约束；原整编候选与修订记录保留供回查。</p><nav class="maintenance-links" aria-label="来源与编校">${docLink('00_PROJECT/CANON_INDEX.md','权威与适用限制')}<a href="#/provenance/${charter.id}">宪章来源</a><a href="#/versions">版本与关系</a>${docLink('00_PROJECT/AUTHOR_FOUNDATIONS_v0.1.md','作者基础设定')}<a href="#/browse?status=CANDIDATE">原整编候选</a><a href="#/browse?status=PROPOSAL">提案</a><a href="#/browse?status=UNRESOLVED">待决材料</a><a href="#/audit">审计与测试</a></nav><details class="collection-summary"><summary>馆藏统计与索引信息</summary><p>索引更新 ${dateOnly(index.builtAt)}；共 ${docs.length} 份文件，包含项目资料与历史来源。</p><ul>${index.statuses.map(s=>`<li><a href="${browseUrl({status:s})}">${esc(prototypeStatusLabel(s))}<span>${index.counts[s]||0}</span></a></li>`).join('')}</ul></details></section></div>`;
}
function guideSection(guide,text){
  const chapters=text.toc.filter(h=>/^[一二三四五六七八九十]+、/.test(h.label));
  return `<section class="home-section home-guide" aria-labelledby="guide-title"><div class="register-heading"><h2 id="guide-title">初识布加</h2><a class="text-link" href="#/doc/${guide.id}">从头阅读${archiveIcon('arrow')}</a></div><p class="section-intro">《布加风土志》以地上学者的口吻，介绍这个天上国度的城邦、巫师、魔法与岁时。适合第一次接触布加的读者。</p>${chapters.length?`<ol class="guide-chapters">${chapters.slice(0,4).map(h=>`<li><a href="#/doc/${guide.id}?anchor=${encodeURIComponent(h.slug)}">${esc(h.label)}</a></li>`).join('')}</ol>${chapters.length>4?`<p class="guide-more">另有${chapters.slice(4).map(h=>esc(h.label.replace(/^[一二三四五六七八九十]+、/,''))).join('、')}等 ${chapters.length-4} 章，<a href="#/doc/${guide.id}">见全文目录</a>。</p>`:''}`:''}</section>${engravedDivider()}`;
}
function archiveCatalogue(type){
  const topic=type==='topics',key=topic?'topics':'institutions';
  document.title=(topic?'主题总目':'机构总目')+' / '+index.title;
  main.innerHTML=pageHeading(topic?'主题总目':'机构总目',topic?'从文献的主题进入馆藏。分类依据目录与标题关键词，同一文件可归入多个主题。':'按文献中的名称与别名提及查阅，不代表机构隶属、颁布机关或文件授权。')+`<div class="subject-register">${index[key].map(value=>{
    const related=docs.filter(d=>d[key].includes(value)),canon=related.filter(d=>d.status==='CURRENT_CANON'),sample=canon.slice(0,2);
    return `<section class="subject-entry">${archiveIcon(topic?topicIcon(value):'institution')}<h2><a href="${browseUrl({[topic?'topic':'institution']:value})}">${esc(value)}</a></h2>${topic&&TOPIC_GUIDES[value]?`<p class="subject-guide">${esc(TOPIC_GUIDES[value])}</p>`:''}<p class="subject-count">${related.length} 份相关文献<span>其中现行 ${canon.length} 份</span></p>${sample.length?`<p class="subject-sample">${sample.map(d=>linkDoc(d.id)).join('、')}</p>`:''}<nav aria-label="${esc(value)}馆藏入口"><a href="${browseUrl({[topic?'topic':'institution']:value})}">查阅全部</a>${canon.length?`<a href="${browseUrl({[topic?'topic':'institution']:value,status:'CURRENT_CANON'})}">仅看现行</a>`:''}</nav></section>`;
  }).join('')}</div>`;
}
document.addEventListener('DOMContentLoaded',()=>{
  const names={home:'nav-home',guide:'nav-author',canon:'nav-codex',browse:'nav-holdings',topics:'nav-topics',institutions:'nav-institutions',versions:'nav-versions',archive:'nav-history',author:'nav-author',candidate:'nav-drafts',proposal:'nav-proposal',unresolved:'nav-proposal',audit:'nav-versions',project:'nav-codex',directory:'nav-holdings'};
  document.querySelectorAll('.sidebar [data-nav]').forEach(a=>a.insertAdjacentHTML('afterbegin',archiveIcon(names[a.dataset.nav])));
  document.querySelector('.brand-mark-slot').innerHTML=archiveIcon('tower');
  document.querySelector('#global-search .search-icon').innerHTML=archiveIcon('search');
  document.querySelector('#menu-toggle').insertAdjacentHTML('afterbegin',archiveIcon('menu'));
});
