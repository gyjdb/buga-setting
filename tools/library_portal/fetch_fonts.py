"""Download pinned OFL fonts at build time, verify SHA256, then serve locally.

No visitor connects to GitHub or a font CDN. Existing correct files are reused,
so later builds and local reading can run offline.
"""
from pathlib import Path
import hashlib
import json
from urllib.request import Request, urlopen

FONTS = Path(__file__).resolve().parent / "web/fonts"


def fetch_fonts():
    manifest = json.loads((FONTS / "SOURCES.json").read_text(encoding="utf-8"))
    for name, spec in manifest.items():
        target = FONTS / name
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == spec["sha256"]:
            print("Verified cached font:", name)
            continue
        with urlopen(Request(spec["url"], headers={"User-Agent": "BaitaArchive-build"}), timeout=120) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != spec["sha256"]:
            raise ValueError("Font SHA256 mismatch: " + name)
        target.write_bytes(data)
        print("Downloaded and verified:", name)


if __name__ == "__main__":
    fetch_fonts()

