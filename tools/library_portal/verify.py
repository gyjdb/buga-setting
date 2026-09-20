"""Integration checks against actual project files and generated output. No source writes."""
import hashlib
import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import SOURCE, OUTPUT, HERE, source_files, read_json, family_key, table_rows, current_selection


class InspectHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids, self.unsafe = [], [], []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag in {"script", "iframe", "object", "embed"}:
            self.unsafe.append(tag)
        self.unsafe.extend(k for k, v in attrs if k.startswith("on"))
        if "id" in values:
            self.ids.append(values["id"])
        if tag == "a" and "href" in values:
            self.links.append(values["href"])


def verify():
    data = read_json(OUTPUT / "data/metadata.json")
    config = read_json(HERE / "portal_config.json")
    manifest = read_json(OUTPUT / "data/source-manifest.json")
    relation = read_json(OUTPUT / "data/relationships.json")
    docs = data["documents"]
    by_id = {d["id"]: d for d in docs}
    by_path = {d["path"]: d for d in docs}
    checks = []

    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        checks.append(name)

    actual = {p.relative_to(SOURCE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in source_files(set(config["exclude_dirs"]))}
    check("source bytes unchanged since build", manifest == actual)
    check("complete source inventory", set(by_path) == set(actual) and len(by_id) == len(docs))
    check("accurate status totals", dict(Counter(d["status"] for d in docs)) == data["counts"])
    current_manifest, selected = current_selection()
    check("current set equals authoritative manifest", {d["path"] for d in docs if d["status"] == "CURRENT_CANON"} == set(selected))
    for path, entry in selected.items():
        check("current identity and body " + entry["alias"], by_path[path]["alias"] == entry["alias"] and by_path[path]["version"] == "v" + entry["version"] and by_path[path]["sha256"] == entry["sha256"])
    check("audit snapshots cannot inherit canon status", all(d["status"] == "REFERENCE" for d in docs if d["collection"] == "90_AUDIT"))
    for doc in docs:
        check("raw copy " + doc["id"], hashlib.sha256((OUTPUT / doc["rawUrl"]).read_bytes()).hexdigest() == doc["sha256"] == actual[doc["path"]])
    candidates = {d["id"] for d in docs if d["kind"] == "candidate"}
    check("all candidate triplets covered", {v["candidate"] for v in data["versionSets"]} == candidates)
    for group in data["versionSets"]:
        check("version triplet " + group["current"], by_id[group["current"]]["status"] == "CURRENT_CANON" and by_id[group["candidate"]]["status"] == "CANDIDATE" and by_id[group["changelog"]]["kind"] == "changelog")
    search = {}
    for shard in data["searchShards"]:
        for row in read_json(OUTPUT / shard):
            check("unique search entry " + row["id"], row["id"] not in search)
            search[row["id"]] = row["text"]
    check("all files searchable by metadata", set(search) == set(by_id))
    link_count = 0
    missing_anchors = []
    anchors = {}
    all_links = []
    for doc in docs:
        if not doc["readError"]:
            raw_text = (SOURCE / doc["path"]).read_bytes().decode(doc["encoding"], errors="strict")
            check("full untruncated search content " + doc["id"], search[doc["id"]] == raw_text)
        body = read_json(OUTPUT / "docs" / (doc["id"] + ".json"))
        parsed = InspectHTML()
        parsed.feed(body.get("html", ""))
        check("safe rendered document " + doc["id"], not parsed.unsafe)
        check("unique heading anchors " + doc["id"], len(parsed.ids) == len(set(parsed.ids)))
        anchors[doc["id"]] = set(parsed.ids)
        for link in parsed.links:
            if link.startswith("#/doc/"):
                link_count += 1
                target = link.split("#/doc/")[1].split("?")[0]
                check("resolved internal link", target in by_id)
                all_links.append((doc["id"], target, link))
        for target in relation[doc["id"]]["links"]:
            check("reciprocal relationship", doc["id"] in relation[target]["backlinks"])
    for src, target, link in all_links:
        if "?anchor=" in link:
            fragment = unquote(link.split("?anchor=")[1])
            if "section-" + fragment not in anchors[target]:
                missing_anchors.append({"source": src, "target": target, "anchor": fragment})
    check("historical body citations are not own version", all(d["version"] == "未标注" for d in docs if d["path"].endswith("CONFLICT_REASSESSMENT.json")))
    check("family grouping retains old versions", family_key("白塔章程_草案_v2_1_") == family_key("白塔章程_v2_2_candidate_CHANGELOG"))
    check("author status is not inherited by changelogs", all(d["status"] == "REFERENCE" for d in docs if d["kind"] == "changelog"))
    check("expected browsing dimensions", len(data["topics"]) >= 7 and len(data["institutions"]) >= 8)
    check("scenario totals match rows", sum(data["audit"]["scenarios"].values()) == len(data["audit"]["scenarioRows"]))
    orgs = read_json(OUTPUT / 'data/institutions.json')
    org_ids = {r['id'] for r in orgs['institutions']}
    check('unique institution IDs', len(org_ids) == len(orgs['institutions']))
    check('institution current count', orgs['counts']['current'] == sum(r['status'] == 'current' and r['kind'] != '设施' for r in orgs['institutions']))
    org_sources = [s for r in orgs['institutions'] for s in r['sources']]
    for row in orgs['institutions']:
        for edge in row['relations']:
            check('institution relation target', edge['target'] in org_ids)
            org_sources.extend(edge['sources'])
        check('institution mention targets', all(id in by_id for id in row['mentions']))
    org_sources.extend(s for note in orgs['notes'] for s in note['sources'])
    for source in org_sources:
        check('institution source reader target', source['docId'] in by_id)
        check('institution source reader anchor', not source['anchor'] or 'section-' + source['anchor'] in anchors[source['docId']])
    result = {"status": "PASS", "checks": len(checks), "sourceFiles": len(docs), "sourceUnchanged": True,
              "rawCopiesVerified": len(docs), "resolvedLinks": link_count, "versionTriplets": len(data["versionSets"]),
              "fullTextEntries": len(search), "unresolvedOriginalAnchors": missing_anchors,
              "limits": "结构、字节、索引与链接检查；不判断 Canon 内容正确性。未定位原文引用保留在详情页。"}
    (OUTPUT / "data/validation-report.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    verify()
