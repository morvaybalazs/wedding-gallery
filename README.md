# Niki & Balázs · Wedding gallery

A small static photo gallery for family, published with GitHub Pages:
https://morvaybalazs.github.io/wedding-gallery/

There is no framework and no build tool, just HTML, CSS and JavaScript.

- `index.html` is the page.
- `assets/style.css` and `assets/app.js` hold the design and the behaviour: the highlights carousel, the chapter grid, the full-screen viewer and the Colour/B&W and Plain/Framed switches.
- `photos/<version>/<large|thumb>/<id>.jpg` are the web copies. The versions are `colour`, `bw`, `framed-colour` and `framed-bw`. Large copies are 2048px on the long edge and thumbnails 900px, all with camera and location data removed.
- `photos.json` lists every photo with its size per version, plus the highlights shown in the carousel.

## Preview locally

```sh
python3 -m http.server 4321
```

Then open http://127.0.0.1:4321.

## Change the photos

The photos come from `~/Photos/Wedding/Final`, which holds four folders with the same file names. To rebuild the web copies and `photos.json`:

```sh
python3 tools/build_photos.py
```

To change which photos appear in the carousel, edit `HIGHLIGHTS` in `tools/build_photos.py`. To change where the ceremony chapter ends, edit `CEREMONY_LAST` in the same file. After either change, rebuild, commit and push; Pages republishes in about a minute.

## Design

- **Fonts:** Boska for display and Switzer for text, both linked from Fontshare (free, ITF Free Font License).
- **Colours:** gallery white `#fafaf8`, suit black `#121212`, and bow-tie burgundy `#6b1c2a` as the only accent.
- **Motif:** the crescent echoes the moon-shaped floral arch from the ceremony.

The page asks search engines not to index it, but anyone with the link can view it.
