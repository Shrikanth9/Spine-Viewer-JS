# Spine Viewer JS

A browser-based Spine viewer and debugging utility built with PixiJS 8, Vite, and `@esotericsoftware/spine-pixi-v8`.

The viewer loads Spine assets from local file uploads. It is useful for quickly checking Spine exports, textures, slots, bounds, skins, events, and animation track behavior before integrating the asset into a game codebase.

## Features

- Runtime upload for Spine skeleton files: `.json`, `.spine`, `.skel`
- Runtime upload for matching `.atlas` files
- Skeleton format detection by file content, so JSON skeletons named `.spine` are handled correctly
- Texture source modes:
  - Loose sprite images
  - TexturePacker spritesheet JSON + image files
- TexturePacker multipack support when all related JSON and image files are uploaded together
- Rotated TexturePacker frame support
- Animation playback by selected Spine track number
- Multiple animations running at the same time on separate tracks
- Track clearing for selected track or all tracks
- Skin switching
- Slot list and slot / attachment inspector
- Spine bounds, slot transform points, and attachment bounds preview
- `rm_` slot click-to-mark support
- Spine event log
- Zoom and pan support

## Getting started

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open the root URL shown by Vite, usually:

```txt
http://localhost:5173/
```

Do not open `dist/index.html` while running the dev server. The `dist` folder is only for production build output.

## Build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Upload workflow

Upload the Spine skeleton and atlas together:

```txt
main_layout_spine.spine
main_layout_spine.atlas
```

or:

```txt
main_layout_spine.json
main_layout_spine.atlas
```

Then choose one texture source mode.

### Sprites mode

Use this when every atlas region has its own image file.

Example:

```txt
main_layout_spine.spine
main_layout_spine.atlas
button_play.png
logo.png
panel_bg.png
```

### Spritesheets mode

Use this when textures are packed using TexturePacker JSON.

For multipacks, upload all related files together:

```txt
ads_ss_0.json
ads_ss_0.png
ads_ss_1.json
ads_ss_1.png
ads_ss_2.json
ads_ss_2.png
```

The spritesheet frame names should match the Spine atlas region names.

## Project structure

```txt
src/
  main.js                     Application bootstrap and viewer UI behavior
  style.css                   Viewer styling
  spine/
    atlasParser.js            Minimal Spine atlas parser used for uploaded assets
    skeletonAsset.js          Skeleton JSON / binary detection and parsing preparation
    textureAtlasBuilder.js    Texture source handling for sprites and spritesheets
  ui/
    template.js               Static UI template
  utils/
    index.js                  Shared utility helpers
```

## Version note

Spine runtime versions should match the Spine editor/export version used by the art pipeline. This project currently uses `@esotericsoftware/spine-pixi-v8`.
