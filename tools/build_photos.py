"""Make web copies of the final wedding photos for the gallery.

Reads the four finished folders (same 42 file names in each), writes
resized JPEGs with all camera metadata removed, and writes photos.json
with each image's size so the page can lay out rows before images load.

Usage:  python3 tools/build_photos.py [path/to/Final]
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Photos/Wedding/Final"
OUT = ROOT / "photos"

VERSIONS = {
    "colour": "Colour",
    "bw": "Black and White",
    "framed-colour": "Framed - Colour",
    "framed-bw": "Framed - Black and White",
}
SIZES = {"large": (2048, 84), "thumb": (900, 78)}  # long edge px, JPEG quality

# Photos up to this number are indoors; the rest are in the gardens.
CEREMONY_LAST = 26
HIGHLIGHTS = ["15", "30", "22", "40", "28", "45", "33", "21", "46", "49"]


def save(img, path, long_edge, quality, icc):
    img = img.copy()
    img.thumbnail((long_edge, long_edge), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    # No exif argument, so camera data and any location are dropped.
    img.save(path, "JPEG", quality=quality, optimize=True, progressive=True, icc_profile=icc)
    return img.size


def main():
    names = sorted(p.name for p in (SOURCE / VERSIONS["colour"]).glob("*.jpg"))
    for folder in VERSIONS.values():
        other = sorted(p.name for p in (SOURCE / folder).glob("*.jpg"))
        if other != names:
            sys.exit(f"'{folder}' does not hold the same photos as Colour")

    photos = []
    for name in names:
        pid = name.split(" - ")[0]
        entry = {"id": pid, "chapter": "ceremony" if int(pid) <= CEREMONY_LAST else "gardens", "v": {}}
        for key, folder in VERSIONS.items():
            with Image.open(SOURCE / folder / name) as im:
                icc = im.info.get("icc_profile")
                im = ImageOps.exif_transpose(im).convert("RGB")
                for size, (edge, q) in SIZES.items():
                    w, h = save(im, OUT / key / size / f"{pid}.jpg", edge, q, icc)
                entry["v"][key] = [w, h]  # size of the large copy
        photos.append(entry)
        print("done", pid)

    data = {"highlights": [h for h in HIGHLIGHTS if h in {p["id"] for p in photos}], "photos": photos}
    (ROOT / "photos.json").write_text(json.dumps(data, separators=(",", ":")))
    print(len(photos), "photos")


if __name__ == "__main__":
    main()
