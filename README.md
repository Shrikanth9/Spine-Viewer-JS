# Spine Viewer JS

A browser-based Spine viewer built with PixiJS 8, Vite, and `@esotericsoftware/spine-pixi-v8`.

The viewer loads Spine assets from local files and provides tools for validating playback, textures, skins, slots, events, and multi-track animation behaviors.

## Features

- Load Spine skeleton files: `.json`, `.spine`, `.skel`
- Load matching Spine atlas files: `.atlas`
- Detect JSON skeletons even when they use a `.spine` extension
- Texture source modes:
  - Loose sprite images
  - TexturePacker spritesheet JSON + image files
- TexturePacker multipack support when all related JSON/image files are uploaded together
- Rotated TexturePacker frame support
- High-DPI Pixi rendering with antialiasing and linear texture filtering
- Animation playback on a selected Spine track
- Multiple animations running together on different tracks
- Clear selected track or all tracks
- Skin switching
- Timeline scrub, frame step, pause/resume, playback speed, and loop count controls
- Slot list and slot/attachment inspector
- `rm_` slot transform markers
- Spine event log
- Zoom and pan controls

## Requirements

- Node.js 18 or newer
- npm

## Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the root URL shown by Vite, usually:

```txt
http://localhost:5173/
```

## Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Asset upload workflow

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

Then choose the texture source mode.

### Sprites mode

Use this mode when each atlas region has a matching standalone image file.

Example:

```txt
main_layout_spine.spine
main_layout_spine.atlas
button_play.png
logo.png
panel_bg.png
```

### Spritesheets mode

Use this mode when textures are packed using TexturePacker JSON.

For multipacks, upload all related JSON and image files together:

```txt
ads_ss_0.json
ads_ss_0.png
ads_ss_1.json
ads_ss_1.png
ads_ss_2.json
ads_ss_2.png
```

Spritesheet frame names should match the Spine atlas region names.

## Project structure

```txt
src/
  main.js                     Application bootstrap and UI behavior
  style.css                   Viewer styles
  spine/
    atlasParser.js            Spine atlas parser for uploaded atlas files
    skeletonAsset.js          Skeleton JSON/binary detection and validation
    textureAtlasBuilder.js    Texture handling for sprites and spritesheets
  ui/
    template.js               Static UI markup
  utils/
    index.js                  Shared helpers
```

## Notes

Spine runtime versions should match the Spine editor/export version used by the asset pipeline. This project uses `@esotericsoftware/spine-pixi-v8`.
