"""Build scholarly reading pages from the approved source sections, without editing them.

The public registry contains metadata only. Typst is an asset-export dependency,
never a dependency of this static build. Missing/stale figures or formulae fail closed.
"""
from __future__ import annotations

import hashlib
import html
import json
import posixpath
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "data" / "papers.json"
ASSETS = HERE / "data" / "paper-assets.json"
CN = "一二三四五六七八九十"


def read_text(path):
    return Path(path).read_text(encoding="utf-8-sig")


def digest_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_registry(path=None):
    data = json.loads(read_text(path or REGISTRY))
    papers = data.get("papers", [])
    ids = [p.get("id") for p in papers]
    titles = [p.get("sourceHeading") for p in papers]
    if data.get("schemaVersion") != 1 or not papers or len(set(ids)) != len(ids) or len(set(titles)) != len(titles):
        raise ValueError("Invalid or duplicate paper registry entries")
    if any(not re.fullmatch(r"[a-z][a-z0-9-]*", str(i)) for i in ids):
        raise ValueError("Paper IDs must be stable lowercase slugs")
    for paper in papers:
        for key in ("sourceZhPath", "sourceEnPath"):
            safe_relative(paper[key])
    return data


def safe_relative(value):
    path = Path(value)
    if path.is_absolute() or ".." in path.parts or "\\" in str(value) or ":" in str(value):
        raise ValueError("Unsafe relative path: " + str(value))
    return path


def slice_zh(text, heading):
    """Only the first, in-world anthology section; never the editorial second section."""
    boundaries = list(re.finditer(r"^##\s+(.+?)\s*$", text, re.M))
    first = next((m for m in boundaries if re.match(r"一[、.．]", m.group(1))), None)
    if first is None:
        raise ValueError("Chinese anthology section 一 is missing")
    end = next((m.start() for m in boundaries if m.start() > first.start()), len(text))
    body = text[first.end():end]
    matches = list(re.finditer(r"^### " + re.escape(heading) + r"[ \t]*$", body, re.M))
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one Chinese paper heading: {heading}")
    start = matches[0].start()
    following = re.search(r"^#{1,3}\s", body[matches[0].end():], re.M)
    stop = matches[0].end() + following.start() if following else len(body)
    return body[start:stop].strip() + "\n"


def slice_en(text, heading):
    matches = list(re.finditer(r"^## " + re.escape(heading) + r"[ \t]*$", text, re.M))
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one English paper heading: {heading}")
    start = matches[0].start()
    following = re.search(r"^#{1,2}\s", text[matches[0].end():], re.M)
    stop = matches[0].end() + following.start() if following else len(text)
    return text[start:stop].strip() + "\n"


def reading_body(section, lang):
    if lang == "zh":
        match = re.search(r"^#### 题解\s*$", section, re.M)
        if not match:
            raise ValueError("A Chinese paper must contain its editor's introduction")
        return section[match.start():]
    lines = section.splitlines()
    lines = lines[1:]
    while lines and not lines[0].strip():
        lines.pop(0)
    heading = section.splitlines()[0].removeprefix("## ").casefold().rstrip(".")
    if lines and re.fullmatch(r"\*\*.+\*\*", lines[0]) and lines[0][2:-2].casefold().rstrip(".") == heading:
        lines.pop(0)  # duplicate display title; page heading already names the work
    return "\n".join(lines).strip() + "\n"


def display_formula(line, lang):
    if lang == "en":
        match = re.fullmatch(r"\$\$\s+(.+?)\s+\$\$(?:\s+\((\d+)\))?", line.strip())
        if match:
            return match.group(1).strip(), f"({match.group(2)})" if match.group(2) else ""
    elif line.startswith("　　"):
        body = line.strip()
        number = re.search(r"\s+(（[一二三四五六七八九十百]+）)$", body)
        if number:
            body = body[:number.start()].strip()
        if body.startswith("$") and body.endswith("$"):
            return body[1:-1].strip(), number.group(1) if number else ""
    return None


def math_fragments(body, lang):
    """Canonical Typst expressions used by both the offline exporter and this build."""
    result, in_code = [], False
    for line in body.splitlines():
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        block = display_formula(line, lang)
        if block:
            result.append({"expression": block[0], "display": True})
        else:
            for m in re.finditer(r"(?<!\\)\$([^$\n]+)(?<!\\)\$", line):
                result.append({"expression": m.group(1).strip(), "display": False})
    return result


def math_key(expression, display):
    return digest_text(("display" if display else "inline") + "\n" + expression.strip())


def figure_number(line, lang):
    match = (re.match(r"^图([一二三四五六七八九十]+)　(.+)$", line) if lang == "zh"
             else re.match(r"^Fig\. (\d+)\. (.+)$", line))
    if not match:
        return None
    number = match.group(1)
    if lang == "zh":
        number = (CN.index(number) + 1 if len(number) == 1 else 10 + CN.index(number[-1]) + 1)
    return str(number)


class AssetReader:
    def __init__(self, manifest=None, asset_root=None):
        self.manifest = manifest if manifest is not None else json.loads(read_text(ASSETS))
        if self.manifest.get("schemaVersion") != 1:
            raise ValueError("Unsupported academic asset manifest")
        self.root = Path(asset_root or HERE / "web")
        self.checked = set()

    def language(self, paper_id, lang, section):
        try:
            data = self.manifest["papers"][paper_id]["languages"][lang]
        except KeyError as exc:
            raise ValueError(f"Missing academic assets: {paper_id}/{lang}") from exc
        if data.get("source", {}).get("sha256") != digest_text(section):
            raise ValueError(f"Stale academic assets: {paper_id}/{lang}; re-export from the current source")
        return data

    def validate(self, asset):
        url = asset.get("url", "")
        relative = safe_relative(url)
        if not url.startswith("assets/papers/") or relative.suffix.lower() != ".svg":
            raise ValueError("Academic assets must be local SVGs under assets/papers/")
        if url not in self.checked:
            target = self.root / relative
            if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != asset.get("sha256"):
                raise ValueError("Missing or changed academic asset: " + url)
            svg = target.read_text(encoding="utf-8")
            if re.search(r"<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*[\"'](?:https?:|javascript:|data:)", svg, re.I):
                raise ValueError("Unsafe academic SVG: " + url)
            self.checked.add(url)
        for dimension in ("widthPt", "heightPt"):
            if not isinstance(asset.get(dimension), (int, float)) or not 0 < asset[dimension] < 100000:
                raise ValueError("Invalid asset dimensions: " + url)
        return asset

    def math(self, data, expression, display):
        key = math_key(expression, display)
        try:
            asset = data["math"][key]
        except KeyError as exc:
            raise ValueError("Missing Typst formula asset: " + expression) from exc
        if asset.get("expression", "").strip() != expression.strip() or asset.get("display") is not display:
            raise ValueError("Formula asset key disagrees with source")
        return self.validate(asset)

    def figure(self, data, number, caption):
        try:
            asset = data["figures"][number]
        except KeyError as exc:
            raise ValueError("Missing scholarly figure: " + number) from exc
        if asset.get("caption") != caption:
            raise ValueError("Figure caption changed; re-export assets: " + number)
        return self.validate(asset)


def _markdown():
    sys.path.insert(0, str(HERE / ".deps"))
    from markdown_it import MarkdownIt
    return MarkdownIt("commonmark", {"html": False}).enable("table")


def render_body(body, lang, paper_id, asset_reader, asset_data, source_path="", by_path=None):
    """Render only trusted structure; Markdown raw HTML remains disabled."""
    md = _markdown()
    blocks = {}
    toc = []

    def formula_image(expression, display):
        asset = asset_reader.math(asset_data, expression, display)
        size = float(asset.get("fontSizePt", 11))
        width, height = asset["widthPt"], asset["heightPt"]
        cls = "paper-display-math" if display else "paper-inline-math"
        baseline = float(asset.get("baselinePt", height))
        alignment = f' data-depth-em="{(height - baseline) / size:.5f}"' if not display else ""
        return (f'<img class="{cls}" src="{html.escape(asset["url"], quote=True)}" '
                f'alt="{html.escape(expression, quote=True)}" width="{width:.3f}" height="{height:.3f}" '
                f'data-width-em="{width / size:.5f}" data-height-em="{height / size:.5f}"{alignment} '
                'data-math-format="typst">')

    def math_rule(state, silent):
        start = state.pos
        if state.src[start:start + 1] != "$" or state.src[start:start + 2] == "$$":
            return False
        match = re.match(r"\$([^$\n]+)(?<!\\)\$", state.src[start:])
        if not match:
            return False
        if not silent:
            token = state.push("paper_math", "", 0)
            token.content = formula_image(match.group(1).strip(), False)
        state.pos += match.end()
        return True

    def cite_rule(state, silent):
        match = re.match(r"(?:［(\d+)］|\[(\d+)\](?!\())", state.src[state.pos:])
        if not match:
            return False
        if not silent:
            token = state.push("paper_cite", "", 0)
            n = match.group(1) or match.group(2)
            token.content = f'<a class="paper-cite" href="#{lang}-ref-{n}" aria-label="引文 {n}">{html.escape(match.group(0))}</a>'
        state.pos += match.end()
        return True

    md.inline.ruler.before("escape", "paper_math", math_rule)
    md.inline.ruler.before("link", "paper_cite", cite_rule)
    md.renderer.rules["paper_math"] = lambda tokens, idx, *_: tokens[idx].content
    md.renderer.rules["paper_cite"] = lambda tokens, idx, *_: tokens[idx].content

    def block(value):
        key = "PAPERBLOCK" + str(len(blocks)) + "PLACEHOLDER"
        blocks[key] = value
        return "\n" + key + "\n"

    normalized = []
    in_code = False
    for line in body.splitlines():
        if line.lstrip().startswith("```"):
            in_code = not in_code
        if in_code or line.lstrip().startswith("```"):
            normalized.append(line)
            continue
        number = figure_number(line, lang)
        equation = display_formula(line, lang)
        if number:
            asset = asset_reader.figure(asset_data, number, line)
            normalized.append(block(f'<figure class="paper-figure" id="{lang}-figure-{number}"><img loading="lazy" '
                f'src="{html.escape(asset["url"], quote=True)}" alt="{html.escape(line, quote=True)}" '
                f'width="{asset["widthPt"]:.3f}" height="{asset["heightPt"]:.3f}">'
                f'<figcaption>{md.renderInline(line)}</figcaption></figure>'))
        elif equation:
            normalized.append(block(f'<div class="paper-math">{formula_image(equation[0], True)}'
                f'<span class="paper-equation-number">{html.escape(equation[1])}</span></div>'))
        elif line.startswith("◇ "):
            normalized.append(block(f'<p class="paper-omission">{md.renderInline(line)}</p>'))
        elif line.startswith("　　"):
            normalized.append(block(f'<div class="paper-math paper-text-equation">{md.renderInline(line.strip())}</div>'))
        elif re.match(r"^####\s", line):
            normalized.append(re.sub(r"^####", "##", line))
        elif re.fullmatch(r"\*\*.+\*\*", line):
            title = line[2:-2]
            level = "##" if title in {"引文", "References"} else "###"
            if re.match(r"^(?:第[一二三四五六七八九十]+章|CHAPTER )", title):
                level = "####"
            normalized.append(level + " " + title)
        else:
            normalized.append(line)
    tokens = md.parse("\n".join(normalized))
    from markdown_it.token import Token
    # Full-width citation brackets are ordinary text to CommonMark's text rule.
    # Split only text tokens; inline code and formula expressions stay untouched.
    for token in tokens:
        if not token.children:
            continue
        children = []
        for child in token.children:
            if child.type != "text" or not re.search(r"［\d+］", child.content):
                children.append(child)
                continue
            cursor = 0
            for match in re.finditer(r"［(\d+)］", child.content):
                if match.start() > cursor:
                    part = Token("text", "", 0)
                    part.content = child.content[cursor:match.start()]
                    children.append(part)
                cite = Token("paper_cite", "", 0)
                cite.content = f'<a class="paper-cite" href="#{lang}-ref-{match.group(1)}" aria-label="引文 {match.group(1)}">{match.group(0)}</a>'
                children.append(cite)
                cursor = match.end()
            if cursor < len(child.content):
                part = Token("text", "", 0)
                part.content = child.content[cursor:]
                children.append(part)
        token.children = children
    headings = Counter()
    refs, ref_index, caption_id = False, 0, None
    for i, token in enumerate(tokens):
        if token.type == "heading_open":
            label = tokens[i + 1].content
            base = re.sub(r"[^\w -]", "", label.lower()).strip().replace(" ", "-") or "section"
            headings[base] += 1
            anchor = lang + "-" + base + ("-" + str(headings[base]) if headings[base] > 1 else "")
            token.attrSet("id", anchor)
            toc.append({"id": anchor, "label": label, "level": int(token.tag[1:])})
            refs = label in {"引文", "References"}
        elif token.type == "ordered_list_open" and refs:
            token.attrSet("class", "paper-references")
            ref_index = int(token.attrGet("start") or 1) - 1
        elif token.type == "list_item_open" and refs:
            ref_index += 1
            token.attrSet("id", f"{lang}-ref-{ref_index}")
        elif token.type == "paragraph_open" and i + 1 < len(tokens):
            content = tokens[i + 1].content
            if content in blocks:
                token.hidden = True
                tokens[i + 1].type = "paper_block"
                tokens[i + 1].content = blocks[content]
                tokens[i + 1].children = None
                tokens[i + 2].hidden = True
            elif re.match(r"^(?:定义|定理|引理|证[　：]|THEOREM |LEMMA |Proof\.)", content):
                token.attrSet("class", "paper-theorem")
            elif content.startswith("【编者注"):
                token.attrSet("class", "paper-editor-note")
            elif re.match(r"^\*\*(?:提要|摘要|Abstract\.|Summary\.)", content):
                token.attrSet("class", "paper-abstract")
            elif re.match(r"^(?:表[一二三四五六七八九十]+　|Table [IVXLC\d]+\. )", content):
                caption_id = f"{lang}-table-caption-{i}"
                token.attrSet("id", caption_id)
                token.attrSet("class", "paper-table-caption")
        elif token.type == "table_open":
            token.attrSet("class", "paper-table")
            if caption_id:
                token.attrSet("aria-labelledby", caption_id)
                caption_id = None
        for child in token.children or []:
            if child.type == "link_open":
                href = child.attrGet("href") or ""
                parts = urlsplit(href)
                if parts.scheme in {"http", "https"}:
                    child.attrSet("rel", "noopener noreferrer")
                elif not parts.scheme and not parts.netloc:
                    path = posixpath.normpath(posixpath.join(posixpath.dirname(source_path), unquote(parts.path)))
                    found = (by_path or {}).get(path)
                    if found:
                        child.attrSet("href", "#/doc/" + found["id"])
                    else:
                        child.attrs.pop("href", None)
                else:
                    child.attrs.pop("href", None)
            elif child.type == "image":
                # All figure and equation images come from the validated manifest.
                child.type = "text"
                child.content = child.content or "[image]"
    md.renderer.rules["paper_block"] = lambda tokens, idx, *_: tokens[idx].content
    return {"html": md.renderer.render(tokens, md.options, {}), "toc": toc}


def _fields(section):
    fields = {}
    for line in section.split("####", 1)[0].splitlines():
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) == 2:
                fields[cells[0]] = cells[1]
    required = {"篇名", "外文篇名", "作者", "刊处", "门类", "所答之问", "收录"}
    if not required.issubset(fields):
        raise ValueError("Paper information table changed or has missing fields")
    return fields


def _contents(text):
    rows = []
    for line in text.splitlines():
        if re.match(r"^\|\s*\d+\s*\|", line):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) != 7 or not cells[4].isdigit():
                raise ValueError("Anthology contents columns changed")
            rows.append(cells)
    if not rows or [int(c[0]) for c in rows] != list(range(1, len(rows) + 1)):
        raise ValueError("Anthology contents are missing or not consecutively numbered")
    return rows


def world_date(venue, imprint_year):
    """The anthology's dated publication is authoritative; print metadata must agree."""
    source_dates = re.findall(r"(混沌纪年|第一纪)\s*(\d+)\s*年", venue)
    if len(source_dates) != 1:
        raise ValueError("Missing or ambiguous publication year in anthology contents: " + venue)
    era, year = source_dates[0]
    printed = re.findall(r"(C\.R\.|F\.E\.)\s+(\d+)", imprint_year)
    expected = ("C.R." if era == "混沌纪年" else "F.E.", year)
    if printed != [expected]:
        raise ValueError("Print imprint_year disagrees with anthology contents: " + venue)
    return f"{era} {year} 年"


def verify_local_template(manifest, project_root=None):
    """Local template edits invalidate SVGs; public builds do not ship the template."""
    relative = "tools/paper_pdf/template.typ"
    path = Path(project_root or HERE.parents[1]) / relative
    if not path.exists():
        return
    recorded = manifest.get("template", {})
    if (not path.is_file() or recorded.get("path") != relative
            or hashlib.sha256(path.read_bytes()).hexdigest() != recorded.get("sha256")):
        raise ValueError("Stale academic assets: local PDF template changed; re-export assets")


def _compile_data(source, by_path):
    source = Path(source)
    registry = load_registry()
    portal_overrides = json.loads(read_text(HERE / "portal_config.json")).get("overrides", {})
    registered = {p["sourceHeading"]: p for p in registry["papers"]}
    contents = _contents(read_text(source / safe_relative(registry["contentsPath"])))
    if set(registered) != {row[1] for row in contents}:
        raise ValueError("Academic registry and anthology contents disagree")
    volume = by_path[registry["volumePath"]]
    assets = None
    catalogue, details = [], {}
    for row in contents:
        order, title, authors, venue, printed_page, pdf_link, decision_links = row
        item = registered[title]
        zh_section = slice_zh(read_text(source / item["sourceZhPath"]), title)
        en_section = slice_en(read_text(source / item["sourceEnPath"]), item["print"]["en_title"])
        fields = _fields(zh_section)
        if fields["篇名"] != title or fields["外文篇名"] != item.get("sourceEnTitle", item["print"]["en_title"]):
            raise ValueError("Academic registered titles disagree with source: " + title)
        pdf_relative = re.search(r"\]\(([^)]+)\)", pdf_link)
        if not pdf_relative:
            raise ValueError("Missing original PDF in anthology contents: " + title)
        pdf_path = posixpath.normpath(posixpath.join(posixpath.dirname(registry["contentsPath"]), pdf_relative.group(1)))
        pdf = by_path[pdf_path]
        if not isinstance(pdf.get("volumePage"), int) or pdf["volumePage"] < int(printed_page):
            raise ValueError("Missing or invalid volumePage: " + title)
        if portal_overrides.get(pdf_path, {}).get("volumePage") != pdf["volumePage"]:
            raise ValueError("Paper volume page disagrees with current portal_config: " + title)
        source_doc = by_path[item["sourceZhPath"]]
        en_doc = by_path[item["sourceEnPath"]]
        decisions = []
        for label, link in re.findall(r"\[([^]]+)\]\(([^)]+)\)", decision_links):
            if not re.fullmatch(r"D\d+", label):
                continue
            decision_path = posixpath.normpath(posixpath.join(posixpath.dirname(registry["contentsPath"]), link))
            decisions.append({"label": label, "url": "#/doc/" + by_path[decision_path]["id"]})
        # 2026-11-08 起篇目第七栏改为各批中译稿，作者的定稿决定不公开（记在本机 00_PROJECT/HOLDINGS_REGISTER.md），这里不再必有。
        author_detail = fields["作者"]
        affiliations = []
        for author in author_detail.split("；"):
            if re.search(r"[，,]", author):
                affiliations.append(re.split(r"[，,]", author, maxsplit=1)[1])
        affiliation = "；".join(affiliations)
        date = world_date(venue, item["print"].get("imprint_year", ""))
        intro = reading_body(zh_section, "zh").split("\n\n", 2)
        summary = intro[1].strip() if len(intro) > 1 else ""
        entry = {"id": item["id"], "order": int(order), "title": title, "enTitle": item["print"]["en_title"],
                 "authors": authors, "affiliation": affiliation, "sourceAuthors": author_detail, "venue": fields["刊处"], "worldDate": date,
                 "discipline": fields["门类"], "genre": item["genre"], "style": item["print"].get("style", "journal"),
                 "webReady": bool(item["webReady"]), "sourceZhPath": item["sourceZhPath"], "sourceEnPath": item["sourceEnPath"],
                 "enPdfUrl": pdf["rawUrl"], "volumeUrl": volume["rawUrl"], "volumePage": pdf["volumePage"],
                 "volumePrintedPage": int(printed_page), "sourceDocUrl": "#/doc/" + source_doc["id"],
                 "sourceEnDocUrl": "#/doc/" + en_doc["id"], "decisionUrls": decisions,
                 "question": fields["所答之问"], "coverage": fields["收录"], "summary": summary,
                 "print": item["print"], "sourceHashes": {"zh": digest_text(zh_section), "en": digest_text(en_section)}}
        catalogue.append(entry)
        if item["webReady"]:
            if assets is None:
                assets = AssetReader()
                verify_local_template(assets.manifest)
            detail = {"paper": entry}
            for lang, section, path in (("zh", zh_section, item["sourceZhPath"]), ("en", en_section, item["sourceEnPath"])):
                data = assets.language(item["id"], lang, section)
                detail[lang] = render_body(reading_body(section, lang), lang, item["id"], assets, data, path, by_path)
            details[item["id"]] = detail
    return catalogue, details, assets


def compile_papers(source, output, by_path):
    output = Path(output)
    catalogue, details, assets = _compile_data(source, by_path)
    # Validate everything first; a failed rebuild must not partially replace the catalogue.
    (output / "data").mkdir(parents=True, exist_ok=True)
    (output / "papers").mkdir(parents=True, exist_ok=True)
    files = ["data/papers.json"]
    for paper_id, detail in details.items():
        name = "papers/" + paper_id + ".json"
        (output / name).write_text(json.dumps(detail, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        files.append(name)
    (output / "data/papers.json").write_text(json.dumps({"schemaVersion": 1, "papers": catalogue}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for stale in (output / "papers").glob("*.json"):
        if stale.stem not in details:
            stale.unlink()
    return {"count": len(catalogue), "webReady": len(details), "files": files,
            "assets": sorted(assets.checked) if assets else []}


def verify_papers(source, output, by_path):
    """Read-only verification against the current source and registered assets."""
    output = Path(output)
    catalogue, details, assets = _compile_data(source, by_path)
    expected = {"schemaVersion": 1, "papers": catalogue}
    if json.loads(read_text(output / "data/papers.json")) != expected:
        raise ValueError("Generated paper catalogue disagrees with its current sources")
    actual_ids = {p.stem for p in (output / "papers").glob("*.json")}
    if actual_ids != set(details):
        raise ValueError("Generated paper detail set disagrees with webReady registry")
    for paper_id, detail in details.items():
        actual = json.loads(read_text(output / "papers" / (paper_id + ".json")))
        if actual != detail:
            raise ValueError("Generated paper body disagrees with its source: " + paper_id)
        for lang in ("zh", "en"):
            body = actual[lang]["html"]
            if re.search(r"<(?:script|iframe|object|embed)\b|\bon\w+\s*=|(?:href|src)=[\"'](?:javascript:|data:)", body, re.I):
                raise ValueError("Unsafe generated scholarly HTML: " + paper_id)
            anchors = re.findall(r'\bid="([^"]+)"', body)
            if len(set(anchors)) != len(anchors):
                raise ValueError("Duplicate reading anchors: " + paper_id)
            if any(item["id"] not in anchors for item in actual[lang]["toc"]):
                raise ValueError("Reading TOC has missing targets: " + paper_id)
            for target in re.findall(r'href="#(' + lang + r'-ref-\d+)"', body):
                if target not in anchors:
                    raise ValueError("Reading reference has no target: " + paper_id + "/" + target)
    for url in assets.checked if assets else []:
        src, dest = HERE / "web" / url, output / url
        if not dest.is_file() or src.read_bytes() != dest.read_bytes():
            raise ValueError("Academic output asset is missing or stale: " + url)
    return {"count": len(catalogue), "webReady": len(details), "assets": len(assets.checked) if assets else 0}
