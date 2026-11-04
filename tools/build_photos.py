"""Make the gallery's photos from the four finished folders.

Reads ~/Photos/Wedding/Final (same file names in each folder) and writes:
  photos/<version>/<large|thumb>/<id>.jpg   web copies for the page
  dist/Niki-and-Balazs-<Version>.zip        full-size copies for "Download all"
  photos.json                               sizes and colour washes per version, chapters, zip sizes

Every copy is re-saved without camera metadata or location (the sRGB colour
profile is kept).
The zips are too big for the site itself; they are attached to a GitHub release
(see README) and the page links to the latest release.

Usage:  python3 tools/build_photos.py [path/to/Final] [--no-zips]
"""

import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
SOURCE = Path(args[0]) if args else Path.home() / "Photos/Wedding/Final"
MAKE_ZIPS = "--no-zips" not in sys.argv
OUT = ROOT / "photos"
DIST = ROOT / "dist"

# key: (source folder, name used in zip files and on the page)
VERSIONS = {
    "colour": ("Colour", "Colour"),
    "bw": ("Black and White", "Black-and-White"),
    "framed-colour": ("Framed - Colour", "Framed-Colour"),
    "framed-bw": ("Framed - Black and White", "Framed-Black-and-White"),
}
SIZES = {"large": (2048, 84), "thumb": (900, 78)}  # long edge px, JPEG quality

# Photos up to this number are indoors; the rest are in the garden.
CEREMONY_LAST = 26


def save(img, path, long_edge, quality, icc):
    img = img.copy()
    img.thumbnail((long_edge, long_edge), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    # No exif argument, so camera data and any location are dropped.
    img.save(path, "JPEG", quality=quality, optimize=True, progressive=True, icc_profile=icc)
    return img.size


def tones(img):
    """Average colour of the top, middle and bottom third: a soft wash shown while the photo loads."""
    small = img.resize((1, 3), Image.BOX)
    return " ".join("#%02x%02x%02x" % small.getpixel((0, y)) for y in range(3))


def full_size_bytes(img, icc):
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=95, subsampling=0, optimize=True, icc_profile=icc)
    return buf.getvalue()


def main():
    names = sorted(p.name for p in (SOURCE / VERSIONS["colour"][0]).glob("*.jpg"))
    for folder, _ in VERSIONS.values():
        if sorted(p.name for p in (SOURCE / folder).glob("*.jpg")) != names:
            sys.exit(f"'{folder}' does not hold the same photos as Colour")

    zips = {}
    if MAKE_ZIPS:
        DIST.mkdir(exist_ok=True)
        for key, (_, label) in VERSIONS.items():
            zips[key] = zipfile.ZipFile(DIST / f"Niki-and-Balazs-{label}.zip", "w", zipfile.ZIP_STORED)

    photos = []
    for number, name in enumerate(names, 1):
        pid = name.split(" - ")[0]
        entry = {"id": pid, "chapter": "ceremony" if int(pid) <= CEREMONY_LAST else "garden", "v": {}, "g": {}}
        for key, (folder, label) in VERSIONS.items():
            with Image.open(SOURCE / folder / name) as im:
                icc = im.info.get("icc_profile")  # keep the colour profile (sRGB)
                im = ImageOps.exif_transpose(im).convert("RGB")
                sizes = {size: save(im, OUT / key / size / f"{pid}.jpg", edge, q, icc) for size, (edge, q) in SIZES.items()}
                entry["v"][key] = list(sizes["large"])
                entry["g"][key] = tones(im)
                if MAKE_ZIPS:
                    zips[key].writestr(f"Niki & Balazs - {label.replace('-', ' ')}/Niki-and-Balazs-{number:02d}.jpg", full_size_bytes(im, icc))
        photos.append(entry)
        print("done", pid)

    data = {"photos": photos}
    if MAKE_ZIPS:
        for z in zips.values():
            z.close()
        data["zips"] = {
            key: {"file": Path(z.filename).name, "mb": round(Path(z.filename).stat().st_size / 1e6)}
            for key, z in zips.items()
        }
    elif (ROOT / "photos.json").exists():
        old = json.loads((ROOT / "photos.json").read_text())
        if "zips" in old:
            data["zips"] = old["zips"]

    (ROOT / "photos.json").write_text(json.dumps(data, separators=(",", ":")))
    print(len(photos), "photos", data.get("zips", ""))


if __name__ == "__main__":
    main()
