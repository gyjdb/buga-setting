"""Copy the frontend into site/library_portal. One allowlist serves the local archive and the public checkout.

PRODUCTION is exactly what index.html, portal.js and book.js load; the public build ships these plus assets/ and fonts/.
STUDIES are local design specimens and comparison pages: copied when present, never synced to the public repository.
"""
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
PRODUCTION = ("index.html", "archive-fonts.css", "portal.css", "portal.js", "portal-pages.js", "papers.js", "papers.css", "search-worker.js",
              "book.js", "book.css", "book-pages.js", "book-pages.css", "book-hand.css", "book-note.css", "book-plan.json")
STUDIES = ("styles.css", "favicon.svg", "design-system.css", "silver-weave.svg", "silver-weave-document.svg", "phase3-fonts.css",
           "type-specimen.html", "type-specimen.css", "type-specimen.js", "phase3.css", "phase3.js", "silver-folio.svg",
           "book-specimen.html", "fengtuzhi-specimen.html", "fengtuzhi-layout.html", "fengtuzhi-layout.js",
           "fengtuzhi-type.html", "fengtuzhi-type.js", "fengtuzhi-cover.html", "font-check.html", "font-check.js",
           "archive.css")  # archive.css: the pre-2026-10 shell's styles, still used by fengtuzhi-cover.html and font-check.html


def sync_frontend():
    source = HERE / "web"
    target = HERE.parent.parent / "site" / "library_portal"
    target.mkdir(parents=True, exist_ok=True)
    copied = []
    for name in PRODUCTION:
        shutil.copyfile(source / name, target / name)
        copied.append(name)
    for name in STUDIES:
        if (source / name).is_file():
            shutil.copyfile(source / name, target / name)
            copied.append(name)
    for folder in ("assets", "fonts"):
        for asset in sorted((source / folder).rglob("*")):
            if asset.is_file():
                relative = asset.relative_to(source)
                (target / relative).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(asset, target / relative)
                copied.append(relative.as_posix())
    # GitHub Pages must serve names starting with "_" or "." as they are.
    (target / ".nojekyll").write_text("", encoding="utf-8")
    return copied


if __name__ == "__main__":
    print("Frontend assets synchronized: " + ", ".join(sync_frontend()))
