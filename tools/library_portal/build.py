"""Read-only archive indexer. All output is confined to site/library_portal."""
from __future__ import annotations

import csv
import hashlib
import html
import json
import os
import posixpath
import re
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCE = ROOT / "organized_project"
OUTPUT = ROOT / "site" / "library_portal"
sys.path.insert(0, str(HERE / ".deps"))
try:
    from markdown_it import MarkdownIt
except ImportError:
    raise SystemExit("请先运行 python -m pip install -r tools/library_portal/requirements.txt --target tools/library_portal/.deps")

TEXT_EXTENSIONS = {".md", ".txt", ".csv", ".json", ".jsonl", ".py", ".diff", ".sha256", ".html", ".yaml", ".yml", ".xml", ".toml", ".css", ".js", ".rtf"}
STATUS_BY_DIR = {"01_CURRENT_CANON": "CURRENT_CANON", "02_PROPOSALS": "PROPOSAL", "03_UNRESOLVED": "UNRESOLVED", "05_SUPERSEDED": "SUPERSEDED"}
STATES = ["AUTHOR_CANON", "CURRENT_CANON", "PROPOSAL", "UNRESOLVED", "SUPERSEDED", "REFERENCE", "DELEGATED_DESIGN", "CANDIDATE"]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def source_files(excludes):
    for current, dirs, files in os.walk(SOURCE, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in excludes and not (Path(current) / d).is_symlink())
        for name in sorted(files):
            path = Path(current) / name
            if not path.is_symlink():
                yield path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def plain_title(text, fallback):
    match = re.search(r"^#\s+(.+)$", text, re.M)
    title = match.group(1).strip() if match else fallback
    return re.sub(r"[*`]", "", title)


def frontmatter(text):
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    fields = {}
    if match:
        for line in match.group(1).splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                fields[key.strip()] = value.strip().strip("\"'")
    return fields


def heading_slug(text):
    return re.sub(r"[^\w\- ]", "", text.lower()).strip().replace(" ", "-")


def table_rows(text, pattern):
    rows = []
    for line in text.splitlines():
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if cells and re.fullmatch(pattern, cells[0]):
                rows.append(cells)
    return rows


def family_key(name):
    name = re.sub(r"^\d{4}-\d{2}-\d{2}_.+?_m\d+_a\d+_", "", name)
    name = re.sub(r"_?v\d.*$", "", name, flags=re.I)
    name = re.sub(r"草案|修订稿|改进版|candidate|CHANGELOG|[《》_（）()\s]", "", name, flags=re.I)
    return {"白银宪章": "银色联盟宪章", "白银枢密院": "白银执政院"}.get(name, name)


def current_selection():
    """Fail closed: immutable old bodies must never become current by directory."""
    manifest = read_json(SOURCE / "00_PROJECT/CURRENT_CANON_MANIFEST.json")
    entries = manifest["files"]
    if len(entries) != manifest["count"] or len({e["alias"] for e in entries}) != len(entries):
        raise ValueError("现行清单数量或文系重复")
    selected = {}
    for entry in entries:
        relative = entry["path"]
        path = (SOURCE / relative).resolve()
        if SOURCE.resolve() not in path.parents or not relative.startswith("01_CURRENT_CANON/"):
            raise ValueError("现行清单路径越界：" + relative)
        if relative in selected or entry["status"] != "CURRENT_CANON" or digest(path) != entry["sha256"]:
            raise ValueError("现行清单状态、路径或哈希错误：" + relative)
        selected[relative] = entry
    return manifest, selected


def build():
    config = read_json(HERE / "portal_config.json")
    current_manifest, selected = current_selection()
    files = list(source_files(set(config["exclude_dirs"])))
    baseline = {p.relative_to(SOURCE).as_posix(): digest(p) for p in files}
    if SOURCE.resolve() == OUTPUT.resolve() or SOURCE.resolve() in OUTPUT.resolve().parents:
        raise RuntimeError("输出目录不得位于原始文档目录内")
    for folder in [OUTPUT, OUTPUT / "data", OUTPUT / "docs", OUTPUT / "raw"]:
        folder.mkdir(parents=True, exist_ok=True)
    mapping = {}
    map_path = SOURCE / "00_PROJECT/FILE_MAP.csv"
    if map_path.exists():
        with map_path.open(encoding="utf-8-sig", newline="") as stream:
            mapping = {r["target_path"].replace("\\", "/"): r for r in csv.DictReader(stream)}
    documents, texts, warnings = [], {}, []
    for path in files:
        relative = path.relative_to(SOURCE).as_posix()
        key = hashlib.sha256(relative.encode()).hexdigest()[:20]
        raw = path.read_bytes()
        text, encoding, read_error = "", None, None
        apple_metadata = path.name.startswith("._") or path.name == ".DS_Store"
        if apple_metadata:
            read_error = "macOS 附属元数据；不是文档正文，可下载原件"
        elif path.suffix.lower() in TEXT_EXTENSIONS:
            try:
                if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
                    encoding = "utf-16"
                else:
                    encoding = "utf-8-sig"
                text = raw.decode(encoding, errors="strict")
            except UnicodeDecodeError as exc:
                read_error = "无法严格解码；可下载原件，正文未进入全文索引"
                warnings.append({"path": relative, "kind": "decode", "detail": str(exc)})
        else:
            read_error = "此格式仅提供元数据与原件下载"
        texts[key] = text
        fm = frontmatter(text) if path.suffix.lower() == ".md" else {}
        row = mapping.get(relative, {})
        collection = relative.split("/")[0]
        candidate = path.name.endswith("_candidate.md") and collection == "10_WORKING_DRAFTS"
        changelog = path.name.endswith("_CHANGELOG.md")
        status = row.get("status") or STATUS_BY_DIR.get(collection, "REFERENCE")
        basis = "FILE_MAP.csv" if row else "目录归类（门户推定）"
        if fm.get("status") in STATES:
            status, basis = fm["status"], "文件头元数据"
        if candidate:
            status, basis = "CANDIDATE", "候选目录与文件名；未晋升"
        match_text = relative + " " + text
        topics = [topic for topic, terms in config["topics"].items() if topic in relative or any(term.lower() in (relative + " " + plain_title(text, path.stem)).lower() for term in terms)]
        if collection == "90_AUDIT" and "审计与测试" not in topics:
            topics.append("审计与测试")
        institutions = [org for org, terms in config["institutions"].items() if any(term in match_text for term in terms)]
        # Never mistake a version cited in the body for this file's own version.
        title = plain_title(text, path.stem) if path.suffix.lower() == ".md" else path.name
        version = re.search(r"(?i)(?<![a-z])v(\d+(?:[._]\d+)+)", path.name + " " + title)
        own_source = re.search(r"(?m)^>\s*date:[^\n]*?source:\s*([A-Z]+\d+)", text[:1500])
        date = re.search(r"(?m)^>?\s*date:\s*(\d{4}-\d{2}-\d{2})", text[:1500])
        doc = {"id": key, "path": relative, "name": path.name, "title": plain_title(text, path.stem) if path.suffix.lower() == ".md" else path.name,
               "collection": collection, "category": next((t for t in config["topics"] if t in relative), topics[0] if topics else config["collections"].get(collection, collection)),
               "status": status, "statusBasis": basis, "kind": "data" if apple_metadata else "candidate" if candidate else "changelog" if changelog else "document" if path.suffix.lower() in {".md", ".txt", ".html", ".rtf"} else "data",
               "version": fm.get("version") or ("v" + version.group(1).replace("_", ".") if version else "未标注"),
               "source": row.get("source_path") or fm.get("source") or (own_source.group(1) if own_source else "organized_project/" + relative),
               "sourceId": row.get("source_id", ""), "alias": row.get("alias") or (own_source.group(1) if own_source else ""),
               "authority": row.get("authority") or fm.get("authority") or ("候选 · 待整体审核" if candidate else "未单独标注；不据正文提及推定权威"),
               "topics": topics, "institutions": institutions, "date": date.group(1) if date else None,
               "modified": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
               "size": len(raw), "sha256": baseline[relative], "extension": path.suffix.lower(), "encoding": encoding,
               "readError": read_error, "searchable": bool(text), "rawUrl": "raw/" + key + path.suffix.lower(),
               "excerpt": re.sub(r"\s+", " ", text).strip()[:180], "note": row.get("note", "")}
        override = config["overrides"].get(relative, {})
        doc.update(override)
        if "status" in override:
            doc["statusBasis"] = "门户显式映射（依据文件声明）"
        # The selected manifest outranks legacy mapping and copied frontmatter.
        if relative in selected:
            entry = selected[relative]
            doc.update(status="CURRENT_CANON", statusBasis="CURRENT_CANON_MANIFEST.json（路径与SHA256核验）",
                       alias=entry["alias"], version="v" + entry["version"],
                       authority=current_manifest["approval_decision"],
                       source=entry["previous_baseline"], date=current_manifest["approved_date"])
        elif collection == "01_CURRENT_CANON":
            doc.update(status="SUPERSEDED", statusBasis="不在当前清单中；保留的历史正文",
                       authority="历史正文；现行效力以CURRENT_CANON_MANIFEST为准")
        elif collection == "90_AUDIT" or changelog:
            doc.update(status="REFERENCE", statusBasis="审计、快照或修改记录；不继承被引正文身份",
                       authority="审计与来源记录，不是独立Canon正文")
        elif candidate:
            doc["authority"] = "历史候选；批准记录及现行选取见CURRENT_CANON_MANIFEST"
        documents.append(doc)
        # Copies are byte-identical, never written back to SOURCE.
        (OUTPUT / doc["rawUrl"]).write_bytes(raw)

    by_path = {d["path"]: d for d in documents}
    by_id = {d["id"]: d for d in documents}
    by_name = defaultdict(list)
    for doc in documents:
        by_name[doc["name"]].append(doc)
    old_paths = {r["source_path"]: by_path[t] for t, r in mapping.items() if t in by_path}
    relations = {d["id"]: {"links": [], "backlinks": [], "family": [], "missing": []} for d in documents}
    md = MarkdownIt("commonmark", {"html": False}).enable("table").enable("strikethrough")

    def resolve_link(current, target):
        parts = urlsplit(target)
        if parts.scheme or parts.netloc:
            return None
        decoded = unquote(parts.path).replace("\\", "/")
        if not decoded:
            return by_path[current]
        rel = posixpath.normpath(posixpath.join(posixpath.dirname(current), decoded))
        for test in [rel, decoded.removeprefix("organized_project/")]:
            if test in by_path:
                return by_path[test]
            if test in old_paths:
                return old_paths[test]
        matches = by_name.get(posixpath.basename(decoded), [])
        return matches[0] if len(matches) == 1 else None

    for doc in documents:
        text = texts[doc["id"]]
        toc = []
        if doc["extension"] == ".md":
            tokens = md.parse(text)
            slug_counts = Counter()
            for i, token in enumerate(tokens):
                if token.type == "heading_open":
                    label = tokens[i + 1].content
                    slug = heading_slug(label) or "section"
                    count = slug_counts[slug]
                    slug_counts[slug] += 1
                    if count:
                        slug += "-" + str(count)
                    token.attrSet("id", "section-" + slug)
                    toc.append({"label": re.sub(r"[*`]", "", label), "slug": slug, "level": int(token.tag[1])})
                for child in token.children or []:
                    if child.type == "link_open":
                        href = child.attrGet("href") or ""
                        found = resolve_link(doc["path"], href)
                        if found:
                            fragment = unquote(urlsplit(href).fragment)
                            url = "#/doc/" + found["id"] + ("?anchor=" + quote(fragment) if fragment else "")
                            child.attrSet("href", url)
                            if found["id"] != doc["id"] and found["id"] not in relations[doc["id"]]["links"]:
                                relations[doc["id"]]["links"].append(found["id"])
                                relations[found["id"]]["backlinks"].append(doc["id"])
                        elif urlsplit(href).scheme in {"https", "http", "mailto"}:
                            child.attrSet("rel", "noopener noreferrer")
                        else:
                            child.attrs.pop("href", None)
                            child.attrSet("class", "unresolved-link")
                            child.attrSet("title", "原文引用未定位：" + href)
                            relations[doc["id"]]["missing"].append(href)
                    elif child.type == "image":
                        found = resolve_link(doc["path"], child.attrGet("src") or "")
                        if found and found["extension"] in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
                            child.attrSet("src", found["rawUrl"])
                        else:
                            child.type = "text"
                            child.content = "[图像：" + child.content + "]"
            rendered = md.renderer.render(tokens, md.options, {})
            save_json(OUTPUT / "docs" / (doc["id"] + ".json"), {"html": rendered, "toc": toc})
        else:
            save_json(OUTPUT / "docs" / (doc["id"] + ".json"), {"text": text, "toc": []})

    families = defaultdict(list)
    for doc in documents:
        if doc["status"] in {"CURRENT_CANON", "SUPERSEDED", "UNRESOLVED", "PROPOSAL", "CANDIDATE"} or doc["kind"] == "changelog":
            if doc["extension"] == ".md":
                families[family_key(Path(doc["path"]).stem)].append(doc["id"])
    for members in families.values():
        for member in members:
            relations[member]["family"] = [v for v in members if v != member]
    # Keep the existing triplet shape, with the actual current body and latest log.
    version_sets = []
    for entry in current_manifest["files"]:
        found = [by_path[entry[k]] for k in ("path", "approved_candidate", "changelog")]
        group = {"current": found[0]["id"], "candidate": found[1]["id"], "changelog": found[2]["id"],
                 "evidence": by_path["00_PROJECT/CURRENT_CANON_MANIFEST.json"]["id"]}
        version_sets.append(group)
        for doc in found:
            relations[doc["id"]]["versionSet"] = group
        # Include the immediately previous edition in the same navigation family.
        related = found + [by_path[entry["previous_baseline"]]]
        for doc in related:
            relations[doc["id"]]["family"] = sorted(set(relations[doc["id"]]["family"]) | {d["id"] for d in related if d["id"] != doc["id"]})

    def source_text(path):
        return texts[by_path[path]["id"]] if path in by_path else ""

    conflict_path = "00_PROJECT/CONFLICTS.md"
    audit_path = "90_AUDIT/CANON_CONSOLIDATION_AUDIT.md"
    scenario_path = "90_AUDIT/CANON_SCENARIO_TESTS.md"
    conflict_rows = table_rows(source_text(conflict_path), r"F\d+")
    conflict_counts = Counter(row[2] for row in conflict_rows if len(row) > 2)
    audit_text = source_text(audit_path)
    author_rows = table_rows(audit_text, r"CC-A\d+")
    scenario_rows = table_rows(source_text(scenario_path), r"S\d+")
    scenarios = Counter(row[2] for row in scenario_rows if len(row) > 2)
    audit = {"conflictSource": by_path.get(conflict_path, {}).get("id"), "auditSource": by_path.get(audit_path, {}).get("id"),
             "scenarioSource": by_path.get(scenario_path, {}).get("id"), "conflictCounts": conflict_counts,
             "openConflicts": conflict_counts.get("OPEN") if conflict_rows else None, "conflictRows": conflict_rows,
             "authorUnresolved": len(author_rows) if author_rows else None, "authorRows": author_rows,
             "futureInterfaces": len(table_rows(audit_text, r"IF\d+")), "candidateFindings": table_rows(audit_text, r"F\d+"),
             "scenarios": scenarios, "scenarioRows": scenario_rows}
    report_path = "00_PROJECT/IN_WORLD_REGISTER_REPORT.md" if "00_PROJECT/IN_WORLD_REGISTER_REPORT.md" in by_path else "00_PROJECT/CANON_CONSOLIDATION_REPORT.md"
    report_text = source_text(report_path)
    report_status = re.search(r"^status:\s*(.+)$", report_text, re.M)
    report_intro = next((s.strip() for s in report_text.split("\n\n") if s.startswith("全部")), "暂无整编报告，请查看项目总卷。")
    audit["latest"] = {"id": by_path.get(report_path, {}).get("id"), "status": report_status.group(1) if report_status else "未提供", "summary": report_intro}
    recent = sorted([d for d in documents if d["collection"] in {"00_PROJECT", "10_WORKING_DRAFTS"} and d["extension"] == ".md"], key=lambda d: (d["date"] or "", d["modified"]), reverse=True)[:12]
    audit["recent"] = [d["id"] for d in recent]
    shards, batch, size = [], [], 0
    for doc in documents:
        text = texts[doc["id"]]
        entry = {"id": doc["id"], "text": text}
        batch.append(entry)
        size += len(text.encode("utf-8"))
        if size >= 1_000_000:
            name = "data/search-" + str(len(shards)) + ".json"
            save_json(OUTPUT / name, batch)
            shards.append(name)
            batch, size = [], 0
    if batch:
        name = "data/search-" + str(len(shards)) + ".json"
        save_json(OUTPUT / name, batch)
        shards.append(name)
    after = {p.relative_to(SOURCE).as_posix(): digest(p) for p in source_files(set(config["exclude_dirs"]))}
    if baseline != after:
        raise RuntimeError("构建期间源目录发生变化，请确认后重新构建；未发布新索引")
    counts = Counter(d["status"] for d in documents)
    result = {"schemaVersion": 1, "builtAt": datetime.now(timezone.utc).isoformat(), "title": config["title"], "subtitle": config["subtitle"],
              "documents": documents, "counts": counts, "topics": list(config["topics"]), "institutions": list(config["institutions"]),
              "collections": config["collections"], "statuses": STATES, "searchShards": shards, "versionSets": version_sets, "audit": audit,
              "textFiles": sum(d["searchable"] for d in documents), "warnings": warnings, "excludedDirectories": config["exclude_dirs"]}
    save_json(OUTPUT / "data/metadata.json", result)
    save_json(OUTPUT / "data/relationships.json", relations)
    save_json(OUTPUT / "data/source-manifest.json", baseline)
    save_json(OUTPUT / "data/build-report.json", {"sourceUnchanged": True, "files": len(files), "counts": counts, "decodeWarnings": warnings, "missingReferences": sum(len(r["missing"]) for r in relations.values())})
    # Remove only obsolete generated files, never user-authored files or SOURCE.
    keep_docs = {d["id"] + ".json" for d in documents}
    keep_raw = {Path(d["rawUrl"]).name for d in documents}
    for folder, keep in [(OUTPUT / "docs", keep_docs), (OUTPUT / "raw", keep_raw)]:
        for old in folder.iterdir():
            if old.is_file() and re.match(r"^[0-9a-f]{20}(\.|$)", old.name) and old.name not in keep:
                old.unlink()
    for old in (OUTPUT / "data").glob("search-*.json"):
        if "data/" + old.name not in shards:
            old.unlink()
    from frontend_assets import sync_frontend
    sync_frontend()
    print(json.dumps({"output": str(OUTPUT), "files": len(documents), "textFiles": result["textFiles"], "counts": counts, "versionSets": len(version_sets), "sourceUnchanged": True, "warnings": len(warnings)}, ensure_ascii=False))


if __name__ == "__main__":
    build()
