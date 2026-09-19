"""Copy the production frontend only; omit local design studies and caches."""
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
ASSETS = ("index.html", "archive.css", "app.js", "archive.js", "prototype.js",
          "baita-icons.js", "search-worker.js")


def sync_frontend():
    source = HERE / "web"
    target = HERE.parent.parent / "site/library_portal"
    target.mkdir(parents=True, exist_ok=True)
    for name in ASSETS:
        shutil.copyfile(source / name, target / name)
    for folder in ("assets", "fonts"):
        shutil.copytree(source / folder, target / folder, dirs_exist_ok=True)
    (target / ".nojekyll").write_text("", encoding="utf-8")


if __name__ == "__main__":
    sync_frontend()

