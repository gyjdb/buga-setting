'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const papers = JSON.parse(fs.readFileSync(path.join(root, 'site/library_portal/data/papers.json'), 'utf8')).papers;
const source = fs.readFileSync(path.join(__dirname, 'web/papers.js'), 'utf8');
const portalSource = fs.readFileSync(path.join(__dirname, 'web/portal.js'), 'utf8');
const scope = vm.createContext({window: {}, URLSearchParams, encodeURIComponent});
vm.runInContext(source, scope);
const api = scope.window.Papers;
const ids = query => Array.from(api.selectPapers(papers, new URLSearchParams(query)), p => p.id);
const before = JSON.stringify(papers);
assert.equal(papers.length, 20);
assert.equal(new Set(papers.map(p => p.id)).size, 20);
assert.deepEqual(ids('format=web'), ['alding', 'metcalfe', 'stanhope']);
assert.equal(ids('format=pdf').length, 17);
assert.deepEqual(ids('q=DENSITY PRIMES'), ['alding']);
assert.deepEqual(ids('q=梅特卡夫&discipline=元素与术式'), ['metcalfe']);
assert.deepEqual(ids('q=梅特卡夫&discipline=商贸'), []);
assert.deepEqual(ids('q=卡明斯'), ['cummings-decidable', 'cummings-insight']);
assert.deepEqual(ids('q=不存在的论文'), []);
assert.equal(ids('sort=title').length, 20);
assert.equal(JSON.stringify(papers), before, 'filtering and sorting cannot mutate the catalogue');
const from = new URLSearchParams({q: '质数 疏密', format: 'web'}).toString();
const url = api.paperURL('alding', {lang: 'en', section: 'en-1', from});
const params = new URLSearchParams(url.split('?')[1]);
assert.equal(params.get('from'), from, 'return-to-search query survives language and section links');
assert.equal(params.get('lang'), 'en');
assert.equal(params.get('section'), 'en-1');

// Exercise the real router and rendering functions with inert DOM controls.
// These checks intentionally inspect requests and visible payloads, not CSS.
function routeRuntime(hash, bodyFetch = null, theme = 'night') {
  const node = {
    dataset: {}, style: {}, isConnected: true, classList: {add() {}, remove() {}, toggle() {}, contains() {return false;}},
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    querySelector() {return node;}, querySelectorAll() {return [];}, append() {}, remove() {}, focus() {},
    getBoundingClientRect() {return {width: 800};},
  };
  const target = {...node, dataset: {}, innerHTML: '', contains() {return false;}};
  // 顶栏“学术文献”的 data-nav 自 2026-11-08 起是 scholarship。
  const nav = {dataset: {nav: 'scholarship'}, current: null, setAttribute(_, value) {this.current = value;}, removeAttribute() {this.current = null;}};
  const document = {
    body: {dataset: {}}, documentElement: {dataset: {theme}}, title: '',
    querySelector: selector => selector === '#main' ? target : node,
    querySelectorAll: selector => selector === '.rs-nav [data-nav]' ? [nav] : [],
    addEventListener() {}, getElementById() {return null;}, createElement() {return {...node, dataset: {}, style: {}};},
  };
  const requests = [];
  const storageReads = [];
  const storageWrites = [];
  const location = {hash, replace(next) {this.hash = next;}};
  const scope = vm.createContext({
    document, location, URLSearchParams, encodeURIComponent, setTimeout, clearTimeout,
    window: {scrollTo() {}, addEventListener() {}, removeEventListener() {}},
    localStorage: {getItem(key) {storageReads.push(key); return key === 'rs-papers-mode' ? 'day' : null;}, setItem(key, value) {storageWrites.push([key, value]);}},
    CSS: {escape: value => value}, activeBookReader: null,
    matchMedia: () => ({matches: true, addEventListener() {}, removeEventListener() {}}),
    requestAnimationFrame() {return 1;}, cancelAnimationFrame() {},
    fetch: async url => {
      requests.push(url);
      if (url === 'data/papers.json') return {ok: true, json: async () => ({papers})};
      if (url === 'papers/alding.json') {
        if (bodyFetch) return bodyFetch();
        return {ok: true, json: async () => ({paper: papers.find(p => p.id === 'alding'),
          zh: {html: '<h2 id="zh-正文">正文</h2><p>ACADEMIC_BODY_ZH</p>', toc: [{id: 'zh-正文', label: '正文', level: 2}]},
          en: {html: '<h2 id="en-1">Section 1</h2><p>ACADEMIC_BODY_EN</p>', toc: [{id: 'en-1', label: 'Section 1', level: 2}]}})};
      }
      throw new Error('Unexpected academic request: ' + url);
    },
  });
  vm.runInContext(source, scope);
  vm.runInContext(portalSource, scope);
  vm.runInContext('docs = []; byId = new Map();', scope);
  return {scope, target, nav, document, location, requests, storageReads, storageWrites, route: vm.runInContext('route', scope)};
}

function generatedLinks(markup) {
  return [...markup.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
}

function assertSharedTheme(runtime, theme) {
  assert.equal(runtime.document.documentElement.dataset.theme, theme, 'academic pages keep the archive-wide theme');
  assert.equal(runtime.target.dataset.paperTheme, undefined, 'academic pages have no independent theme override');
  assert.equal(runtime.document.body.dataset.academic, 'true', 'academic route marker must not encode a separate theme');
  assert.ok(!runtime.target.innerHTML.includes('data-paper-theme-toggle'), 'the archive controls the theme without a second local switch');
  assert.ok(!runtime.storageReads.includes('rs-papers-mode'), 'obsolete academic theme preferences must be ignored');
  assert.ok(!runtime.storageWrites.some(([key]) => key === 'rs-papers-mode'), 'academic pages must not persist a separate theme');
}

async function sharedThemeCheck() {
  for (const theme of ['night', 'day']) {
    for (const route of ['#/papers', '#/paper/alding', '#/paper-read/alding?lang=en']) {
      const runtime = routeRuntime(route, null, theme);
      await runtime.route();
      assertSharedTheme(runtime, theme);
      runtime.scope.window.Papers.destroy();
      assert.equal(runtime.document.body.dataset.academic, undefined, 'leaving an academic page removes its route marker');
      assert.equal(runtime.document.documentElement.dataset.theme, theme, 'leaving an academic page leaves the archive theme intact');
    }
  }
}

async function separateReaderCheck() {
  assert.equal(typeof api.readerURL, 'function', 'reader URLs have a separate stable route');
  const readerURL = api.readerURL('alding', {lang: 'en', section: 'en-1', from});
  assert.ok(readerURL.startsWith('#/paper-read/alding?'));
  const readerParams = new URLSearchParams(readerURL.split('?')[1]);
  assert.equal(readerParams.get('from'), from);
  assert.equal(readerParams.get('lang'), 'en');
  assert.equal(readerParams.get('section'), 'en-1');

  for (const query of [new URLSearchParams({from}), new URLSearchParams({from, lang: 'zh'})]) {
    const runtime = routeRuntime('#/paper/alding?' + query);
    await runtime.route();
    assert.deepEqual(runtime.requests, ['data/papers.json'], 'ordinary details must not download the full text');
    assert.ok(!runtime.target.innerHTML.includes('ACADEMIC_BODY_'));
    assert.ok(runtime.target.innerHTML.includes('论质数的疏密'), 'metadata is still displayed');
    assert.equal(runtime.target.dataset.view, 'paper');
    assertSharedTheme(runtime, 'night');
    assert.equal(runtime.nav.current, 'page');
    const readLinks = generatedLinks(runtime.target.innerHTML).filter(link => link.startsWith('#/paper-read/alding'));
    assert.ok(readLinks.length, 'details expose an explicit read action');
    assert.ok(readLinks.every(link => new URLSearchParams(link.split('?')[1]).get('from') === from));
    const catalogueLink = generatedLinks(runtime.target.innerHTML).find(link => link.startsWith('#/papers?'));
    assert.ok(catalogueLink, 'record links back to the filtered catalogue');
    const catalogueParams = new URLSearchParams(catalogueLink.split('?')[1]);
    assert.equal(catalogueParams.get('q'), '质数 疏密');
    assert.equal(catalogueParams.get('format'), 'web');
    const summaryLink = runtime.target.innerHTML.match(/class="ap-summary-link" href="([^"]+)"/);
    assert.ok(summaryLink, 'an excerpt provides a route to the complete introduction');
    const summaryURL = summaryLink[1].replaceAll('&amp;', '&');
    assert.ok(summaryURL.startsWith('#/paper-read/alding?'));
    const summaryParams = new URLSearchParams(summaryURL.split('?')[1]);
    assert.equal(summaryParams.get('section'), 'zh-题解');
    assert.equal(summaryParams.get('from'), from);
    const citation = runtime.target.innerHTML.match(/class="ap-citation"[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1] || '';
    assert.equal((citation.match(/混沌纪年/g) || []).length, 1, 'citation does not repeat the year already recorded in the venue');
  }

  for (const [route, query, language] of [
    ['paper-read', {from}, 'ZH'],
    ['paper-read', {from, lang: 'en', section: 'en-1'}, 'EN'],
    ['paper', {from, lang: 'en'}, 'EN'],
    ['paper', {from, section: 'zh-正文'}, 'ZH'],
  ]) {
    const runtime = routeRuntime('#/' + route + '/alding?' + new URLSearchParams(query));
    await runtime.route();
    assert.deepEqual(runtime.requests, ['data/papers.json', 'papers/alding.json'], 'only reading routes request the body');
    assert.equal(runtime.target.dataset.view, 'paper-read');
    assertSharedTheme(runtime, 'night');
    assert.ok(runtime.target.innerHTML.includes('ACADEMIC_BODY_' + language), 'selected language body is rendered');
    assert.ok(!runtime.target.innerHTML.includes('ACADEMIC_BODY_' + (language === 'EN' ? 'ZH' : 'EN')));
    assert.equal(runtime.nav.current, 'page', 'reader keeps the academic navigation selected');
    const links = generatedLinks(runtime.target.innerHTML);
    const metadataLink = links.find(link => link.startsWith('#/paper/alding'));
    assert.ok(metadataLink, 'reader provides a distinct return to the paper record');
    const metadataParams = new URLSearchParams(metadataLink.split('?')[1]);
    assert.equal(metadataParams.get('from'), from, 'return to details preserves the search');
    assert.ok(!metadataParams.has('section') && !metadataParams.has('lang'), 'return to details must not re-enter legacy reading mode');
    for (const link of links.filter(link => link.startsWith('#/paper-read/alding'))) {
      assert.equal(new URLSearchParams(link.split('?')[1]).get('from'), from, 'language and chapter links retain search context');
    }
    const chapterLink = links.find(link => link.startsWith('#/paper-read/alding') && new URLSearchParams(link.split('?')[1]).has('section'));
    assert.ok(chapterLink, 'reader TOC targets the dedicated route');
    const chapterParams = new URLSearchParams(chapterLink.split('?')[1]);
    assert.equal(chapterParams.get('section'), language === 'EN' ? 'en-1' : 'zh-正文');
    assert.equal(chapterParams.get('lang'), language === 'EN' ? 'en' : null);
  }
}

async function pdfIntroductionCheck() {
  const paper = papers.find(p => p.id === 'westphal');
  assert.equal(paper.webReady, false);
  const runtime = routeRuntime('#/paper/westphal?' + new URLSearchParams({from}));
  await runtime.route();
  assert.deepEqual(runtime.requests, ['data/papers.json'], 'a PDF-only record never requests missing HTML');
  const summaryLink = runtime.target.innerHTML.match(/class="ap-summary-link" href="([^"]+)"/);
  assert.ok(summaryLink, 'PDF-only records still link to the complete introduction');
  assert.equal(summaryLink[1].replaceAll('&amp;', '&'), paper.volumeUrl + '#page=' + paper.volumePage);
  assert.ok(!generatedLinks(runtime.target.innerHTML).some(link => link.startsWith('#/paper-read/westphal')), 'PDF-only works must not advertise unavailable web text');
}

async function bodyRaceCheck() {
  let resolveBody;
  let bodyStarted;
  const started = new Promise(resolve => {bodyStarted = resolve;});
  const delayed = new Promise(resolve => {resolveBody = resolve;});
  const runtime = routeRuntime('#/paper-read/alding', () => {bodyStarted(); return delayed;});
  const pending = runtime.route();
  await started;
  runtime.scope.window.Papers.destroy();
  assert.equal(runtime.document.body.dataset.academic, undefined, 'leaving a reading route clears its academic marker');
  runtime.target.innerHTML = 'next route while full text loads';
  resolveBody({ok: true, json: async () => ({zh: {html: '<p>STALE_BODY</p>', toc: []}})});
  await pending;
  assert.equal(runtime.target.innerHTML, 'next route while full text loads', 'late reader payload cannot replace the next route');
}

// Render requests must not overwrite the next route after a delayed fetch.
async function raceCheck() {
  let resolveFetch;
  const delayed = new Promise(resolve => { resolveFetch = resolve; });
  const delayedScope = vm.createContext({window: {}, document: {body: {dataset: {}}}, URLSearchParams, encodeURIComponent, fetch: () => delayed});
  vm.runInContext(source, delayedScope);
  const target = {dataset: {}, innerHTML: ''};
  const pending = delayedScope.window.Papers.render(target, 'paper', 'missing', new URLSearchParams(), () => true);
  delayedScope.window.Papers.destroy();
  target.innerHTML = 'next route';
  resolveFetch({ok: true, json: async () => ({papers})});
  await pending;
  assert.equal(target.innerHTML, 'next route');
}

// Same PDF, different hash page: update both embedded reader and external link.
async function pdfPageCheck() {
  const frame = {src: 'raw/volume.pdf#page=7', getAttribute() {return this.src;}, setAttribute(_, value) {this.src = value;}};
  const open = {href: '', setAttribute(_, value) {this.href = value;}};
  const target = {dataset: {doc: 'volume'}, querySelector: sel => sel === '.rs-pdf-frame' ? frame : sel === '.rs-pdf-links a[target]' ? open : null};
  const document = {querySelector: sel => sel === '#main' ? target : null, addEventListener() {}, getElementById() {return null;}};
  const pdfScope = vm.createContext({document, window: {scrollTo() {}}, URLSearchParams, CSS: {escape: x => x}, setTimeout});
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'web/portal.js'), 'utf8'), pdfScope);
  vm.runInContext('byId = new Map([["volume", {id:"volume", extension:".pdf", rawUrl:"raw/volume.pdf"}]]);', pdfScope);
  const docPage = vm.runInContext('docPage', pdfScope);
  await docPage('volume', new URLSearchParams('page=79'), 1);
  assert.equal(frame.src, 'raw/volume.pdf#page=79');
  assert.equal(open.href, 'raw/volume.pdf#page=79');
  await docPage('volume', new URLSearchParams(), 1);
  assert.equal(frame.src, 'raw/volume.pdf');
}
Promise.all([raceCheck(), bodyRaceCheck(), pdfPageCheck(), separateReaderCheck(), sharedThemeCheck(), pdfIntroductionCheck()]).then(() => console.log('PASS: academic discovery, shared archive theme, metadata-only details, dedicated reader, legacy reading links, complete introduction links, preserved search context, stale-route cancellation and PDF page navigation')).catch(error => {console.error(error); process.exitCode = 1;});
