"""Verify public source integrity, font identity and static hosting boundaries."""
from pathlib import Path
import hashlib
import json
import re

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
    print(f"PASS: {len(manifest)} public source hashes, 4 font hashes, licenses and project-path assets")


if __name__ == "__main__":
    verify()
