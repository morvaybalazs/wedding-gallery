# Niki & Balázs · Wedding gallery

A small static photo gallery for family, published with GitHub Pages:
https://morvaybalazs.github.io/wedding-gallery/

Links that open in Polish or Hungarian:
- https://morvaybalazs.github.io/wedding-gallery/?lang=pl
- https://morvaybalazs.github.io/wedding-gallery/?lang=hu

There is no framework and no build tool, just HTML, CSS and JavaScript.

## What's on the page

- **Language switch:** English, Polski and Magyar. Phones set to Polish or Hungarian open in that language; everyone else gets English. A visitor's own pick is remembered and kept in the link.
- **Carousel of all 42 photos:** it moves sideways only, one photo per swipe, and opens on photo 20 (the two of us at the signing). Every photo has a Download button.
- **Play slideshow:** opens the full-screen viewer and moves to the next photo every 3.5 seconds, with a Pause button.
- **Grid in two chapters:** The ceremony (01–26) and In the garden (28–53).
- **Black & white and Framed switches:** both on by default, so first-time visitors see black & white prints. Each visitor's choice is remembered. The main "Download all" button follows the version on screen.
- **Full-screen viewer:** Close, Previous/Next, swipe, pinch-zoom, and Download photo.
  - On iPhone and iPad, Download opens the share sheet, so "Save Image" puts the photo in Photos.
  - On Android and computers, the file downloads directly.
- **Download all:** four zips (colour, black & white, and both framed), attached to the `photos` GitHub release.

## Files

- `index.html` is the page.
- `assets/app.js` holds the behaviour. To change the first photo in the carousel, edit `OPENER_ID`.
- `assets/i18n.js` holds all page text in the three languages.
- `assets/style.css` is the design.
- `assets/flags/` holds the three flags.
- `photos/<version>/<large|thumb>/<id>.jpg` are the web copies. The versions are `colour`, `bw`, `framed-colour` and `framed-bw`. Large copies are 2048px on the long edge and thumbnails 900px, all with camera and location data removed.
- `photos.json` lists every photo with its size per version, plus the names and sizes of the zips.
- `dist/` (not in git) holds the four zips that are uploaded to the release.

## Preview locally

```sh
python3 -m http.server 4321
```

Then open http://127.0.0.1:4321.

## Change the photos

The photos come from `~/Photos/Wedding/Final`, which holds four folders with the same file names. To rebuild the web copies, the zips and `photos.json`:

```sh
python3 tools/build_photos.py
```

Add `--no-zips` to skip the zips. To change where the ceremony chapter ends, edit `CEREMONY_LAST` in the same file.

After a rebuild, commit and push; Pages republishes in about a minute. Browsers may keep old copies for up to 10 minutes, so after changing `style.css`, `i18n.js` or `app.js`, bump the `?v=` number on those three links in `index.html`. If the zips changed, replace the release files as well:

```sh
gh release upload photos dist/*.zip --clobber
```

## Design

- **Fonts:** Boska for display and Switzer for text, both linked from Fontshare (free, ITF Free Font License). They load without blocking the page.
- **Colours:** gallery white `#fafaf8`, suit black `#121212`, and bow-tie burgundy `#6b1c2a` as the only accent.
- **Motif:** the crescent echoes the moon-shaped floral arch from the ceremony.

The page asks search engines not to index it, but anyone with the link can view it.
