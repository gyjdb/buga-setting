"""Validate editorial entities and resolve evidence; mentions never infer edges."""
from collections import Counter
from copy import deepcopy
import re

HIERARCHY = {'internal', 'subordinate', 'direct'}
RELATIONS = HIERARCHY | {'dual', 'oversight', 'appointment', 'authorization', 'cooperation', 'business', 'history', 'accountability', 'joint', 'appeal', 'management'}
STATUSES = {'current', 'historical', 'abolished', 'conditional', 'planned', 'unknown'}

def compile_registry(data, by_path, texts, markdown, slugger, manifest):
    data = deepcopy(data)
    rows = data['institutions']
    entities = {r['id']: r for r in rows}
    if len(rows) != len(entities):
        raise ValueError('机构 ID 重复')
    categories = [c['id'] for c in data['categories']]
    if len(categories) != len(set(categories)):
        raise ValueError('机构分类 ID 重复')
    expected = {r['path']: r['sha256'] for r in manifest['files']}
    covered = {r['path']: r['sha256'] for r in data['coverage']}
    if covered != expected or len(data['coverage']) != len(expected):
        raise ValueError('机构覆盖清单与现行正文清单不一致，请重新核对')
    headings = {}
    source_checks = 0

    def resolve(source):
        nonlocal source_checks
        path = source['path']
        doc = by_path.get(path)
        if doc is None:
            raise ValueError('机构引用文件不存在: ' + path)
        text = texts[doc['id']]
        line, quote = source['line'], source['quote']
        if not isinstance(line, int) or line < 1 or not quote or not '\n'.join(text.splitlines()[line-1:]).startswith(quote):
            raise ValueError(f'机构引文或行号不匹配: {path}:{line}')
        if path not in headings:
            tokens = markdown.parse(text)
            seen, found = Counter(), []
            for i, token in enumerate(tokens):
                if token.type == 'heading_open':
                    label = tokens[i+1].content
                    base = slugger(label) or 'section'
                    slug = base + ('-' + str(seen[base]) if seen[base] else '')
                    seen[base] += 1
                    found.append((token.map[0]+1, re.sub(r'[*`]', '', label), slug))
            headings[path] = found
        prior = [h for h in headings[path] if h[0] <= line]
        heading = prior[-1] if prior else None
        if source['section'] != (heading[1] if heading else ''):
            raise ValueError(f'机构条款不匹配: {path}:{line} {source["section"]}')
        source.update(docId=doc['id'], anchor=heading[2] if heading else '', title=doc['title'])
        source_checks += 1

    for row in rows:
        if not re.fullmatch(r'org-[a-z0-9-]+', row['id']) or not row['name'] or not row['summary']:
            raise ValueError('机构缺少稳定 ID、名称或简介')
        if row['category'] not in categories or row['status'] not in STATUSES:
            raise ValueError('机构分类或存续状态无效: ' + row['name'])
        if not row['sources']:
            raise ValueError('机构缺少简介来源: ' + row['name'])
        for source in row['sources']:
            if source.get('role') not in {'establishes', 'regulates', 'describes', 'alias', 'status'}:
                raise ValueError('来源用途无效')
            resolve(source)
        for edge in row['relations']:
            if edge['target'] not in entities or edge['target'] == row['id']:
                raise ValueError('机构关系目标无效: ' + row['name'])
            if edge['type'] not in RELATIONS or not edge.get('detail') or not edge.get('sources'):
                raise ValueError('机构关系类型或依据无效: ' + row['name'])
            for source in edge['sources']:
                resolve(source)
    visited, active = set(), set()
    def visit(id):
        if id in active:
            raise ValueError('机构上下级关系存在循环: ' + entities[id]['name'])
        if id in visited:
            return
        active.add(id)
        for edge in entities[id]['relations']:
            if edge['type'] in HIERARCHY:
                visit(edge['target'])
        active.remove(id)
        visited.add(id)
    for id in entities:
        visit(id)
    for name, target in data['legacy'].items():
        if target not in entities and not (target.startswith('category:') and target[9:] in categories):
            raise ValueError('旧机构入口映射无效: ' + name)
    for note in data['notes']:
        for source in note['sources']:
            resolve(source)
    # Ambiguous short names require parent context, still only lexical retrieval.
    names = Counter(r['name'] for r in rows)
    for row in rows:
        parents = [entities[e['target']]['name'] for e in row['relations'] if e['type'] in HIERARCHY]
        terms = [row['name'], *row['aliases']]
        linked = {s['docId'] for s in row['sources']}
        linked.update(s['docId'] for e in row['relations'] for s in e['sources'])
        matches = []
        for doc in by_path.values():
            if doc['id'] in linked or not doc.get('searchable'):
                continue
            text = texts[doc['id']]
            if any(term and term in text for term in terms):
                if (names[row['name']] > 1 or len(row['name']) <= 3) and parents and not any(p in text for p in parents):
                    continue
                matches.append(doc['id'])
        row['mentions'] = matches
    data['counts'] = dict(Counter(r['status'] for r in rows if r['kind'] != '设施'))
    data['facilityCount'] = sum(r['kind'] == '设施' for r in rows)
    data['validation'] = {'entities':len(rows), 'sources':source_checks, 'relations':sum(len(r['relations']) for r in rows), 'manifestFiles':len(expected), 'hierarchyAcyclic':True}
    return data
