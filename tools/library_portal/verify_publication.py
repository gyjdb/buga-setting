"""Verify public source integrity, font identity and static hosting boundaries."""
from pathlib import Path
import hashlib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site/library_portal"
SOURCE = ROOT / "organized_project"


def verify():
    manifest = json.loads((ROOT / "docs/public-source-manifest.json").read_text(encoding="utf-8"))
    actual = {p.relative_to(SOURCE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in SOURCE.rglob("*") if p.is_file()}
    assert actual == manifest, "Public source snapshot differs from registered hashes"
    for name, spec in json.loads((SITE / "fonts/SOURCES.json").read_text(encoding="utf-8")).items():
        assert hashlib.sha256((SITE / "fonts" / name).read_bytes()).hexdigest() == spec["sha256"], name
        assert (SITE / "fonts" / spec["license"]).is_file(), name
    forbidden = {".git", ".agents", ".codex", ".impeccable", "node_modules", ".deps", "stone-study", "stone-edition"}
    for p in SITE.rglob("*"):
        assert not forbidden.intersection(p.relative_to(SITE).parts), p
    for name in ("index.html", "archive.css"):
        text = (SITE / name).read_text(encoding="utf-8")
        for match in re.finditer(r'''(?:src|href)=["']([^"']+)["']|url\(["']?([^)'" ]+)''', text):
            link = next(g for g in match.groups() if g is not None)
            if link.startswith(("#", "https:", "data:")):
                continue
            assert not link.startswith("/"), "Root-relative asset breaks project Pages: " + link
            assert (SITE / link.split("?")[0]).is_file(), "Missing asset: " + link
    assert (SITE / ".nojekyll").is_file()
    archive = json.loads((ROOT / "archive/manifest.json").read_text(encoding="utf-8"))
    for entry in archive["files"]:
        target = (ROOT / entry["target"]).resolve()
        assert ROOT in target.parents, "Archive path leaves repository"
        assert hashlib.sha256(target.read_bytes()).hexdigest() == entry["sha256"], entry["target"]
        assert not (ROOT / entry["original"]).exists(), "Old root copy was not removed"
    svg_ns = {"svg": "http://www.w3.org/2000/svg"}
    original = ET.parse(SITE / "assets/icons-v3/emblem-b-small.svg")
    favicon = ET.parse(SITE / "assets/favicon.svg")
    assert [p.attrib["d"] for p in original.findall(".//svg:path", svg_ns)] == [p.attrib["d"] for p in favicon.findall(".//svg:path", svg_ns)], "Approved emblem geometry changed"
    print(f"PASS: {len(manifest)} public source hashes, 4 font hashes, licenses and project-path assets")
    print(f"PASS: {len(archive['files'])} archived/deduplicated originals and unchanged favicon emblem paths")


if __name__ == "__main__":
    verify()
